import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, Shield, Swords, Zap } from 'lucide-react';
import { CardInstance, PlayerState, GameState, MinionCard } from '../../../engine/models';
import { getCardEnrichment } from '../../../data/supplemental';
import { isResourceAbility } from '../../../engine/pipeline/cost-engine';
import { FormattedCardText } from '../cards/FormattedCardText';

interface CardPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  cardToPlay: CardInstance | null;
  player: PlayerState;
  gameState: GameState;
  onConfirmPlay: (
    paymentHandCardIds: string[],
    generatorCardIds: string[],
    targetInstanceId?: string,
  ) => void;
}

export const CardPaymentModal: React.FC<CardPaymentModalProps> = ({
  isOpen,
  onClose,
  cardToPlay,
  player,
  gameState,
  onConfirmPlay,
}) => {
  const [selectedHandCardIds, setSelectedHandCardIds] = useState<string[]>([]);
  const [selectedGeneratorIds, setSelectedGeneratorIds] = useState<string[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState<string | undefined>(undefined);

  // Reset selections whenever a new card is selected, auto-selecting matching "The Power of..." cards
  useEffect(() => {
    if (cardToPlay) {
      // Auto-select "The Power of [Aspect]" matching resource cards as a QoL improvement
      const autoSelectedHandIds: string[] = [];
      const cardCost = cardToPlay.card.cost ?? 0;
      const cardFaction = cardToPlay.card.faction;

      if (cardCost > 0 && cardFaction) {
        let accumulatedRes = 0;
        for (const hCard of player.hand) {
          if (hCard.instanceId === cardToPlay.instanceId) continue;
          if (accumulatedRes >= cardCost) break;

          const aspectDoubleStep = hCard.card.enrichment?.abilities
            ?.flatMap((a) => a.steps || [])
            .find((s) => s.effect === 'DOUBLE_RESOURCE_FOR_ASPECT');

          const isMatchingPowerOf =
            (aspectDoubleStep && aspectDoubleStep.params?.aspect === cardFaction) ||
            (hCard.card.name.toLowerCase().startsWith('the power of') &&
              hCard.card.faction === cardFaction);

          if (isMatchingPowerOf) {
            autoSelectedHandIds.push(hCard.instanceId);
            accumulatedRes += 2;
          }
        }
      }

      setSelectedHandCardIds(autoSelectedHandIds);
      setSelectedGeneratorIds([]);

      // Default target: villain for attacks, main scheme for thwarts
      const abilities = cardToPlay.card.enrichment?.abilities || [];
      const hasAttack = abilities.some((a) =>
        (a.steps || []).some((s) =>
          ['DEAL_DAMAGE', 'DEAL_DAMAGE_ALL_ENEMIES', 'REPULSOR_BLAST', 'EXPLOSION'].includes(
            s.effect,
          ),
        ),
      );
      const hasThwart = abilities.some((a) =>
        (a.steps || []).some((s) => s.effect === 'REMOVE_THREAT'),
      );

      if (hasAttack) {
        setSelectedTargetId(gameState.villain.card.code);
      } else if (hasThwart) {
        setSelectedTargetId(gameState.mainScheme.card.code);
      } else {
        setSelectedTargetId(undefined);
      }
    }
  }, [cardToPlay, player.hand, gameState.villain.card.code, gameState.mainScheme.card.code]);

  // Keyboard shortcut: Esc to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const card = cardToPlay?.card;
  const cost = card?.cost ?? 0;

  // Available hand payment cards (all hand cards except the card being played)
  const availableHandCards = player.hand.filter((c) => c.instanceId !== cardToPlay?.instanceId);

  // Available generators: Identity resource abilities + ready tableau generators (ADR-0018)
  const availableGenerators = useMemo(() => {
    const list: {
      id: string;
      name: string;
      sublabel: string;
      resourceType?: string;
      amount: number;
    }[] = [];

    // 1. Identity Resource Abilities (e.g. Peter Parker: Scientist, Carol Danvers: Rechannel)
    const idAbilities = player.activeFormCard.enrichment?.abilities || [];
    for (const ab of idAbilities) {
      const genStep = ab.steps?.find((s) => s.effect === 'GENERATE_RESOURCE');
      if (
        ab.timing === 'RESOURCE' ||
        ab.timing === 'HERO_RESOURCE' ||
        ab.timing === 'ALTER_EGO_RESOURCE' ||
        genStep
      ) {
        const isUsedThisRound =
          ab.limit === 'ONCE_PER_ROUND' && (player.usedAbilitiesThisRound?.[ab.id] || 0) >= 1;
        const isUsedThisPhase =
          ab.limit === 'ONCE_PER_PHASE' && (player.usedAbilitiesThisPhase?.[ab.id] || 0) >= 1;
        if (isUsedThisRound || isUsedThisPhase) continue;

        if (ab.timing === 'HERO_RESOURCE' && player.currentForm !== 'hero') continue;
        if (ab.timing === 'ALTER_EGO_RESOURCE' && player.currentForm !== 'alter_ego') continue;

        const resType = (genStep?.params?.resource as string) || 'resource';
        const amount = Number(genStep?.params?.amount) || 1;
        list.push({
          id: 'identity_ability',
          name: `${player.activeFormCard.name} (${ab.id.replace(/_/g, ' ').toUpperCase()})`,
          sublabel: `Identity Ability • +${amount} ${resType.toUpperCase()}`,
          resourceType: resType,
          amount,
        });
      }
    }

    // 2. Tableau Generators & Counter Cards
    for (const c of player.tableau) {
      if (c.exhausted) continue;
      const enrichment = c.card.enrichment || getCardEnrichment(c.card.code);
      const uses = enrichment?.uses;
      const abilities = enrichment?.abilities || [];

      // Check if this card is a genuine resource generator or cost reducer (RR v1.8 p. 25 / Issue #43)
      const isGenuineGenerator =
        abilities.some((a) => isResourceAbility(a.timing)) ||
        abilities.some((a) =>
          a.steps?.some(
            (s) =>
              s.effect === 'GENERATE_RESOURCE' ||
              s.effect === 'COST_REDUCER' ||
              s.effect === 'GENERATE_TOP_DISCARD_RESOURCES' ||
              s.effect === 'DOUBLE_RESOURCE_FOR_ASPECT',
          ),
        ) ||
        (c.card.text || '').toLowerCase().includes('hero resource:') ||
        (c.card.text || '').toLowerCase().includes('alter-ego resource:') ||
        (c.card.text || '').toLowerCase().includes('resource:');

      if (!isGenuineGenerator) continue;

      const isHeroRestricted =
        abilities.some(
          (a) =>
            a.timing === 'HERO_RESOURCE' ||
            a.timing === 'HERO_ACTION' ||
            a.timing?.startsWith('HERO_'),
        ) ||
        (c.card.text || '').toLowerCase().includes('hero resource:') ||
        (c.card.text || '').toLowerCase().includes('hero action:');
      const isAlterEgoRestricted =
        abilities.some(
          (a) =>
            a.timing === 'ALTER_EGO_RESOURCE' ||
            a.timing === 'ALTER_EGO_ACTION' ||
            a.timing?.startsWith('ALTER_EGO_'),
        ) ||
        (c.card.text || '').toLowerCase().includes('alter-ego resource:') ||
        (c.card.text || '').toLowerCase().includes('alter-ego action:');

      // Filter out generators that require a different form
      if (isHeroRestricted && player.currentForm !== 'hero') continue;
      if (isAlterEgoRestricted && player.currentForm !== 'alter_ego') continue;

      if (uses) {
        if ((c.tokens?.counters || 0) > 0) {
          list.push({
            id: c.instanceId,
            name: c.card.name,
            sublabel: `${c.tokens?.counters || 0} ${uses.type || 'Counters'} Remaining`,
            resourceType: 'wild',
            amount: 1,
          });
        }
      } else {
        list.push({
          id: c.instanceId,
          name: c.card.name,
          sublabel: 'Table Resource Generator / Reducer',
          resourceType: 'wild',
          amount: 1,
        });
      }
    }

    return list;
  }, [
    player.activeFormCard,
    player.tableau,
    player.currentForm,
    player.usedAbilitiesThisPhase,
    player.usedAbilitiesThisRound,
  ]);

  // Calculate generated resources and breakdown
  const { totalGenerated, resourceBreakdown } = useMemo(() => {
    let total = 0;
    let energyCount = 0;
    let mentalCount = 0;
    let physicalCount = 0;
    let wildCount = 0;

    // 1. Hand cards
    for (const hId of selectedHandCardIds) {
      const hCard = availableHandCards.find((c) => c.instanceId === hId);
      if (!hCard) continue;

      const aspectDoubleStep = hCard.card.enrichment?.abilities
        ?.flatMap((a) => a.steps || [])
        .find((s) => s.effect === 'DOUBLE_RESOURCE_FOR_ASPECT');

      const isDoubled = aspectDoubleStep && aspectDoubleStep.params?.aspect === card?.faction;
      const multiplier = isDoubled ? 2 : 1;

      const res = hCard.card.resources;
      energyCount += (res.energy || 0) * multiplier;
      mentalCount += (res.mental || 0) * multiplier;
      physicalCount += (res.physical || 0) * multiplier;
      wildCount += (res.wild || 0) * multiplier;

      total += (res.total || 1) * multiplier;
    }

    // 2. Generators (Identity abilities + Tableau generators)
    for (const gId of selectedGeneratorIds) {
      const gen = availableGenerators.find((g) => g.id === gId);
      if (!gen) continue;

      if (gen.resourceType === 'energy') energyCount += gen.amount;
      else if (gen.resourceType === 'mental') mentalCount += gen.amount;
      else if (gen.resourceType === 'physical') physicalCount += gen.amount;
      else wildCount += gen.amount;

      total += gen.amount;
    }

    return {
      totalGenerated: total,
      resourceBreakdown: { energyCount, mentalCount, physicalCount, wildCount },
    };
  }, [
    selectedHandCardIds,
    selectedGeneratorIds,
    availableHandCards,
    availableGenerators,
    card?.faction,
  ]);

  const isCostCovered = totalGenerated >= cost;

  // Potential Targets (Enemies or Schemes)
  const abilities = card?.enrichment?.abilities || [];
  const isAttack = abilities.some((a) =>
    (a.steps || []).some((s) =>
      ['DEAL_DAMAGE', 'DEAL_DAMAGE_ALL_ENEMIES', 'REPULSOR_BLAST', 'EXPLOSION'].includes(
        s.effect,
      ),
    ),
  );
  const isThwart = abilities.some((a) =>
    (a.steps || []).some((s) => s.effect === 'REMOVE_THREAT'),
  );

  const enemyTargets = useMemo(() => {
    const targets: {
      id: string;
      name: string;
      type: 'villain' | 'minion';
      hp: number;
    }[] = [
      {
        id: gameState.villain.card.code,
        name: `${gameState.villain.card.name} (Villain)`,
        type: 'villain',
        hp: gameState.villain.health,
      },
    ];
    // Engaged minions
    player.engagedMinions.forEach((m) => {
      targets.push({
        id: m.instanceId,
        name: `${m.card.name} (Minion)`,
        type: 'minion',
        hp: (m.card as MinionCard).health
          ? (m.card as MinionCard).health - (m.tokens?.damage || 0)
          : 0,
      });
    });
    return targets;
  }, [gameState.villain, player.engagedMinions]);

  const schemeTargets = useMemo(() => {
    const targets: {
      id: string;
      name: string;
      type: 'main_scheme' | 'side_scheme';
      threat: number;
    }[] = [
      {
        id: gameState.mainScheme.card.code,
        name: `${gameState.mainScheme.card.name} (Main Scheme)`,
        type: 'main_scheme',
        threat: gameState.mainScheme.threat,
      },
    ];
    gameState.sideSchemes.forEach((s) => {
      targets.push({
        id: s.instanceId,
        name: `${s.card.name} (Side Scheme)`,
        type: 'side_scheme',
        threat: s.threat,
      });
    });
    return targets;
  }, [gameState.mainScheme, gameState.sideSchemes]);

  if (!isOpen || !cardToPlay || !card) return null;

  const toggleHandCard = (instanceId: string) => {
    setSelectedHandCardIds((prev) =>
      prev.includes(instanceId) ? prev.filter((id) => id !== instanceId) : [...prev, instanceId],
    );
  };

  const toggleGenerator = (instanceId: string) => {
    setSelectedGeneratorIds((prev) =>
      prev.includes(instanceId) ? prev.filter((id) => id !== instanceId) : [...prev, instanceId],
    );
  };

  const handleConfirm = () => {
    if (!isCostCovered) return;
    onConfirmPlay(selectedHandCardIds, selectedGeneratorIds, selectedTargetId);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-comic-black/75 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-comic-paper border-4 border-comic-black rounded-lg shadow-comic-xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* 1. Pop-Art Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-comic-yellow border-b-4 border-comic-black">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-comic-black text-comic-yellow rounded shadow-comic">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-comic-black/70">
                Resource Payment & Action
              </span>
              <h2 className="text-xl font-black uppercase text-comic-black tracking-tight leading-none">
                Play {card.name}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 bg-comic-paper hover:bg-comic-red hover:text-white border-2 border-comic-black rounded transition-colors shadow-comic-sm"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Card Overview & Cost Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-white border-2 border-comic-black rounded-lg shadow-comic-sm">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-black uppercase px-2 py-0.5 bg-comic-blue text-white rounded border border-comic-black">
                  {card.type}
                </span>
                <span className="text-xs font-black uppercase px-2 py-0.5 bg-comic-paper text-comic-black rounded border border-comic-black">
                  {card.faction}
                </span>
              </div>
              <div className="text-xs text-comic-black/90 font-medium">
                <FormattedCardText text={card.text} />
              </div>
            </div>

            {/* Cost Badge */}
            <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto shrink-0 pl-2">
              <span className="text-xs font-black uppercase text-comic-black/60">
                Required Cost
              </span>
              <div className="flex items-center space-x-1">
                <span className="text-3xl font-black text-comic-red">{cost}</span>
                <span className="text-xs font-bold uppercase text-comic-black">Res</span>
              </div>
            </div>
          </div>

          {/* Payment Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-comic-black tracking-wide">
                Resources Committed:
              </span>
              <span
                className={`text-sm font-black uppercase ${
                  isCostCovered ? 'text-comic-green' : 'text-comic-red'
                }`}
              >
                {totalGenerated} / {cost}{' '}
                {isCostCovered ? '✓ (Ready)' : `(Need ${cost - totalGenerated} more)`}
              </span>
            </div>

            {/* Visual Meter Bar */}
            <div className="w-full h-4 bg-comic-paper border-2 border-comic-black rounded-full overflow-hidden flex">
              <div
                className={`h-full transition-all duration-300 ${
                  isCostCovered ? 'bg-comic-green' : 'bg-comic-yellow'
                }`}
                style={{
                  width: `${Math.min(100, cost === 0 ? 100 : (totalGenerated / cost) * 100)}%`,
                }}
              />
            </div>

            {/* Resource Affinity Pills */}
            <div className="flex flex-wrap gap-2 pt-1 text-xs font-bold text-comic-black">
              {resourceBreakdown.energyCount > 0 && (
                <span className="px-2 py-0.5 bg-amber-100 border border-amber-400 rounded-full flex items-center space-x-1">
                  <span>⚡</span> <span>{resourceBreakdown.energyCount} Energy</span>
                </span>
              )}
              {resourceBreakdown.mentalCount > 0 && (
                <span className="px-2 py-0.5 bg-blue-100 border border-blue-400 rounded-full flex items-center space-x-1">
                  <span>🧠</span> <span>{resourceBreakdown.mentalCount} Mental</span>
                </span>
              )}
              {resourceBreakdown.physicalCount > 0 && (
                <span className="px-2 py-0.5 bg-red-100 border border-red-400 rounded-full flex items-center space-x-1">
                  <span>👊</span> <span>{resourceBreakdown.physicalCount} Physical</span>
                </span>
              )}
              {resourceBreakdown.wildCount > 0 && (
                <span className="px-2 py-0.5 bg-purple-100 border border-purple-400 rounded-full flex items-center space-x-1">
                  <span>⭐</span> <span>{resourceBreakdown.wildCount} Wild</span>
                </span>
              )}
            </div>
          </div>

          {/* Hand Cards Selection */}
          {availableHandCards.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase text-comic-black tracking-wider flex items-center space-x-1.5">
                  <span>Discard Hand Cards for Resources:</span>
                </h3>
                <span className="text-[10px] text-comic-black/60 font-bold uppercase">
                  (Click cards to toggle)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {availableHandCards.map((hCard) => {
                  const isSelected = selectedHandCardIds.includes(hCard.instanceId);
                  const res = hCard.card.resources;
                  const aspectDoubleStep = hCard.card.enrichment?.abilities
                    ?.flatMap((a) => a.steps || [])
                    .find((s) => s.effect === 'DOUBLE_RESOURCE_FOR_ASPECT');
                  const isDoubled =
                    aspectDoubleStep && aspectDoubleStep.params?.aspect === card.faction;

                  return (
                    <button
                      key={hCard.instanceId}
                      type="button"
                      onClick={() => toggleHandCard(hCard.instanceId)}
                      className={`flex items-center justify-between p-3 rounded-lg border-2 text-left transition-all ${
                        isSelected
                          ? 'bg-comic-yellow/30 border-comic-black shadow-comic-sm font-bold scale-[1.01]'
                          : 'bg-white border-comic-black/40 hover:border-comic-black hover:bg-comic-paper'
                      }`}
                    >
                      <div className="space-y-0.5 pr-2">
                        <div className="text-xs font-black text-comic-black line-clamp-1">
                          {hCard.card.name}
                        </div>
                        <div className="text-[10px] font-bold text-comic-black/60 uppercase">
                          {hCard.card.type} • {hCard.card.faction}
                        </div>
                      </div>

                      {/* Resource Yield Badge */}
                      <div className="flex items-center space-x-1 shrink-0">
                        {isDoubled ? (
                          <span className="text-xs font-black px-2.5 py-0.5 bg-emerald-600 text-white rounded-md border-2 border-comic-black shadow-comic-sm flex items-center space-x-1">
                            <span>2 Res (2× Aspect)</span>
                          </span>
                        ) : (
                          <span className="text-xs font-black px-2 py-0.5 bg-comic-paper text-comic-black rounded border border-comic-black flex items-center space-x-1">
                            <span>{res.total || 1} Res</span>
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Generators & Cost Reducers */}
          {availableGenerators.length > 0 && (
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-black uppercase text-comic-black tracking-wider">
                Identity & Table Resource Generators:
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {availableGenerators.map((gen) => {
                  const isSelected = selectedGeneratorIds.includes(gen.id);
                  return (
                    <button
                      key={gen.id}
                      type="button"
                      onClick={() => toggleGenerator(gen.id)}
                      className={`flex items-center justify-between p-3 rounded-lg border-2 text-left transition-all ${
                        isSelected
                          ? 'bg-comic-blue/20 border-comic-black shadow-comic-sm font-bold scale-[1.01]'
                          : 'bg-white border-comic-black/40 hover:border-comic-black hover:bg-comic-paper'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-black text-comic-black">{gen.name}</div>
                        <div className="text-[10px] text-comic-black/60 font-bold uppercase">
                          {gen.sublabel}
                        </div>
                      </div>
                      <span className="text-xs font-black px-2 py-0.5 bg-comic-paper border border-comic-black rounded">
                        +{gen.amount} {gen.resourceType ? gen.resourceType.toUpperCase() : 'RES'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Target Selector (if Attack or Thwart) */}
          {isAttack && (
            <div className="space-y-2 pt-2 border-t-2 border-comic-black/20">
              <label className="text-xs font-black uppercase text-comic-black flex items-center space-x-1">
                <Swords className="w-4 h-4 text-comic-red" />
                <span>Select Attack Target:</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {enemyTargets.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTargetId(t.id)}
                    className={`flex items-center justify-between p-2.5 rounded border-2 text-xs font-bold ${
                      selectedTargetId === t.id
                        ? 'bg-comic-red text-white border-comic-black shadow-comic-sm'
                        : 'bg-white text-comic-black border-comic-black/40 hover:border-comic-black'
                    }`}
                  >
                    <span>{t.name}</span>
                    <span>{t.hp} HP</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {isThwart && (
            <div className="space-y-2 pt-2 border-t-2 border-comic-black/20">
              <label className="text-xs font-black uppercase text-comic-black flex items-center space-x-1">
                <Shield className="w-4 h-4 text-comic-blue" />
                <span>Select Scheme Target:</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {schemeTargets.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTargetId(t.id)}
                    className={`flex items-center justify-between p-2.5 rounded border-2 text-xs font-bold ${
                      selectedTargetId === t.id
                        ? 'bg-comic-blue text-white border-comic-black shadow-comic-sm'
                        : 'bg-white text-comic-black border-comic-black/40 hover:border-comic-black'
                    }`}
                  >
                    <span>{t.name}</span>
                    <span>{t.threat} Threat</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 3. Modal Footer */}
        <div className="flex items-center justify-end space-x-3 px-6 py-4 bg-comic-paper border-t-4 border-comic-black">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 font-black uppercase text-xs text-comic-black bg-white hover:bg-comic-paper border-2 border-comic-black rounded shadow-comic-sm transition-all"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={!isCostCovered}
            onClick={handleConfirm}
            className={`px-6 py-2.5 font-black uppercase text-sm border-2 border-comic-black rounded shadow-comic transition-all flex items-center space-x-2 ${
              isCostCovered
                ? 'bg-comic-yellow hover:bg-yellow-400 text-comic-black hover:scale-105 active:scale-95'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-60'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Confirm & Play!</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
