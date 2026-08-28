import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, Shield, Swords, Zap } from 'lucide-react';
import { CardInstance, PlayerState, GameState, MinionCard } from '../../../engine/models';

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

  // Reset selections whenever a new card is selected
  useEffect(() => {
    if (cardToPlay) {
      setSelectedHandCardIds([]);
      setSelectedGeneratorIds([]);

      // Default target: villain for attacks, main scheme for thwarts
      const abilities = cardToPlay.card.enrichment?.abilities || [];
      const hasAttack = abilities.some((a) => a.tags?.includes('ATTACK'));
      const hasThwart = abilities.some((a) => a.tags?.includes('THWART'));

      if (hasAttack) {
        setSelectedTargetId(gameState.villain.card.code);
      } else if (hasThwart) {
        setSelectedTargetId(gameState.mainScheme.card.code);
      } else {
        setSelectedTargetId(undefined);
      }
    }
  }, [cardToPlay, gameState.villain.card.code, gameState.mainScheme.card.code]);

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

  if (!isOpen || !cardToPlay) return null;

  const card = cardToPlay.card;
  const cost = card.cost ?? 0;

  // Available hand payment cards (all hand cards except the card being played)
  const availableHandCards = player.hand.filter(
    (c) => c.instanceId !== cardToPlay.instanceId,
  );

  // Available tableau generators (ready generators with counters/ability)
  const availableGenerators = player.tableau.filter((c) => {
    if (c.exhausted) return false;
    // Web-Shooter: has counters
    if (c.card.code === '01008') return (c.tokens?.counters || 0) > 0;
    // Helicarrier / Generators
    if (c.card.code === '01092') return true;
    return false;
  });

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

      const aspectDouble = hCard.card.enrichment?.abilities?.find(
        (a) => a.effect === 'DOUBLE_RESOURCE_FOR_ASPECT',
      );

      const isDoubled = aspectDouble && aspectDouble.params?.aspect === card.faction;
      const multiplier = isDoubled ? 2 : 1;

      const res = hCard.card.resources;
      energyCount += (res.energy || 0) * multiplier;
      mentalCount += (res.mental || 0) * multiplier;
      physicalCount += (res.physical || 0) * multiplier;
      wildCount += (res.wild || 0) * multiplier;

      total += (res.total || 1) * multiplier;
    }

    // 2. Generators
    for (const gId of selectedGeneratorIds) {
      const gCard = availableGenerators.find((c) => c.instanceId === gId);
      if (!gCard) continue;
      if (gCard.card.code === '01008') {
        wildCount += 1;
      } else {
        wildCount += 1;
      }
      total += 1;
    }

    return {
      totalGenerated: total,
      resourceBreakdown: { energyCount, mentalCount, physicalCount, wildCount },
    };
  }, [selectedHandCardIds, selectedGeneratorIds, availableHandCards, availableGenerators, card.faction]);

  const isCostCovered = totalGenerated >= cost;

  // Potential Targets (Enemies or Schemes)
  const abilities = card.enrichment?.abilities || [];
  const isAttack = abilities.some((a) => a.tags?.includes('ATTACK'));
  const isThwart = abilities.some((a) => a.tags?.includes('THWART'));

  const enemyTargets = useMemo(() => {
    const targets: { id: string; name: string; type: 'villain' | 'minion'; hp: number }[] = [
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
        hp: (m.card as MinionCard).health ? (m.card as MinionCard).health - (m.tokens?.damage || 0) : 0,
      });
    });
    return targets;
  }, [gameState.villain, player.engagedMinions]);

  const schemeTargets = useMemo(() => {
    const targets: { id: string; name: string; type: 'main_scheme' | 'side_scheme'; threat: number }[] = [
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
              <p className="text-xs text-comic-black/80 font-medium line-clamp-2">{card.text}</p>
            </div>

            {/* Cost Badge */}
            <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto shrink-0 pl-2">
              <span className="text-xs font-black uppercase text-comic-black/60">Required Cost</span>
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
                {totalGenerated} / {cost} {isCostCovered ? '✓ (Ready)' : `(Need ${cost - totalGenerated} more)`}
              </span>
            </div>

            {/* Visual Meter Bar */}
            <div className="w-full h-4 bg-comic-paper border-2 border-comic-black rounded-full overflow-hidden flex">
              <div
                className={`h-full transition-all duration-300 ${
                  isCostCovered ? 'bg-comic-green' : 'bg-comic-yellow'
                }`}
                style={{ width: `${Math.min(100, cost === 0 ? 100 : (totalGenerated / cost) * 100)}%` }}
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
                  const aspectDouble = hCard.card.enrichment?.abilities?.find(
                    (a) => a.effect === 'DOUBLE_RESOURCE_FOR_ASPECT',
                  );
                  const isDoubled = aspectDouble && aspectDouble.params?.aspect === card.faction;

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
                          <span className="text-xs font-black px-2 py-0.5 bg-comic-green text-white rounded border border-comic-black flex items-center space-x-1">
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

          {/* Table Generators & Cost Reducers */}
          {availableGenerators.length > 0 && (
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-black uppercase text-comic-black tracking-wider">
                Exhaust Table Generators & Reducers:
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {availableGenerators.map((gCard) => {
                  const isSelected = selectedGeneratorIds.includes(gCard.instanceId);
                  return (
                    <button
                      key={gCard.instanceId}
                      type="button"
                      onClick={() => toggleGenerator(gCard.instanceId)}
                      className={`flex items-center justify-between p-3 rounded-lg border-2 text-left transition-all ${
                        isSelected
                          ? 'bg-comic-blue/20 border-comic-black shadow-comic-sm font-bold scale-[1.01]'
                          : 'bg-white border-comic-black/40 hover:border-comic-black hover:bg-comic-paper'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-black text-comic-black">{gCard.card.name}</div>
                        <div className="text-[10px] text-comic-black/60 font-bold uppercase">
                          {gCard.card.code === '01008'
                            ? `${gCard.tokens?.counters || 0} Web Counters`
                            : 'Cost Reducer'}
                        </div>
                      </div>
                      <span className="text-xs font-black px-2 py-0.5 bg-comic-paper border border-comic-black rounded">
                        +1 Res
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
