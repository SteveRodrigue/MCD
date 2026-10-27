import React, { useState, useMemo, useEffect } from 'react';
import { Sparkles, Shield, Swords, Zap, AlertTriangle, Heart, Users } from 'lucide-react';
import {
  CardInstance,
  GameState,
  PlayerState,
  CardType,
  VillainState,
} from '../../../engine/models';
import { getPlayTargetChoice } from '../../../engine/effects/target-choice';
import type { ResolvedTarget } from '../../../engine/effects/target-resolver';
import { getCardEnrichment } from '../../../data/supplemental';
import {
  isResourceAbility,
  isAbilityPlayableInForm,
  getEffectiveCardCost,
  getDiscardCostBounds,
} from '../../../engine/pipeline/cost-engine';
import {
  getEffectiveMaxHealth,
  getEffectiveMinionHitPoints,
} from '../../../engine/pipeline/stat-calculator';
import { matchesCardFilter } from '../../../engine/filters/card-filter';
import type { UniversalCardFilter, CardLocationSelector } from '../../../data/supplemental/schema';
import { FormattedCardText } from '../cards/FormattedCardText';
import { CardArtThumbnail } from '../cards/CardArtThumbnail';
import { locateCard, readCardResources } from '../../../engine/queries/card-inspector';
import { isHandCardIneligibleForCost, isGeneratorIneligibleForCost } from './payment-eligibility';
import { useGameSession } from '../../context/GameStateContext';
import { useOnChange } from '../../hooks/useOnChange';
import { AccentStripe } from '../../theme/AccentStripe';
import { CardRef } from '../../theme/CardRef';
import { ModalScaffold } from '../../theme/ModalScaffold';
import { useModalStyle } from '../../theme/useModalStyle';

interface CardPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  cardToPlay: CardInstance | null;
  abilityCost?: {
    amount?: number;
    resourceType?: 'physical' | 'energy' | 'mental' | 'wild';
    requirePrinted?: boolean;
    /** The ability's amount is the number of resources spent (`RESOURCES_SPENT`), e.g. Energy Channel. */
    scalesWithResources?: boolean;
    title?: string;
    /** Most cards the discard cost takes. */
    discardCount?: number;
    /** Fewest cards the discard cost takes (defaults to `discardCount`; "up to N" costs use 1). */
    discardMin?: number;
    discardFilter?: UniversalCardFilter;
  };
  player: PlayerState;
  onConfirmPlay: (
    paymentHandCardIds: string[],
    generatorCardIds: string[],
    targetInstanceId?: string,
    selectedDiscardCardIds?: string[],
  ) => void;
}

type ChoiceTone = 'danger' | 'warn' | 'info';

const CHOICE_RINGS: Record<ChoiceTone, string> = {
  danger: 'ring-2 ring-comic-red',
  warn: 'ring-2 ring-comic-yellow',
  info: 'ring-2 ring-comic-blue',
};

interface ChoiceCardProps {
  code?: string;
  name: string;
  subline: string;
  selected: boolean;
  disabled?: boolean;
  tone: ChoiceTone;
  badge: React.ReactNode;
  onClick: () => void;
}

/** A hand card, discard candidate or resource generator the player can toggle. */
const ChoiceCard: React.FC<ChoiceCardProps> = ({
  code,
  name,
  subline,
  selected,
  disabled = false,
  tone,
  badge,
  onClick,
}) => {
  const { style } = useModalStyle();

  return (
    <button
      type="button"
      disabled={disabled}
      data-card-anchor={code ?? ''}
      onClick={onClick}
      className={`relative flex items-center justify-between p-2.5 sm:p-3 pl-4 text-left transition-all ${
        disabled
          ? `${style.tile} opacity-40 cursor-not-allowed`
          : selected
            ? `${style.tileSelected} ${CHOICE_RINGS[tone]} font-bold`
            : `${style.tile} cursor-pointer`
      }`}
    >
      <AccentStripe code={code ?? ''} />
      <div className="flex items-center gap-2.5 pr-2 min-w-0">
        <CardArtThumbnail cardCode={code} cardName={name} size="sm" />
        <div className="space-y-0.5 min-w-0">
          <div className="text-xs font-black truncate">{name}</div>
          <div className={`text-micro font-bold uppercase truncate ${style.muted}`}>{subline}</div>
        </div>
      </div>
      <div className="shrink-0">{badge}</div>
    </button>
  );
};

type TargetTone = 'danger' | 'info' | 'success' | 'purple';

const TARGET_SELECTED: Record<TargetTone, string> = {
  danger: 'bg-comic-red',
  info: 'bg-comic-blue',
  success: 'bg-emerald-600',
  purple: 'bg-purple-600',
};

interface TargetChoice {
  id: string;
  code?: string;
  name: string;
  trailing?: (selected: boolean) => React.ReactNode;
}

interface TargetChoicesProps {
  title: string;
  icon: React.ReactNode;
  tone: TargetTone;
  targets: TargetChoice[];
  selectedId?: string;
  onSelect: (id: string) => void;
}

/** One "Select X Target" list: a titled grid of buttons, the chosen one coloured by `tone`. */
const TargetChoices: React.FC<TargetChoicesProps> = ({
  title,
  icon,
  tone,
  targets,
  selectedId,
  onSelect,
}) => {
  const { style } = useModalStyle();

  return (
    <div className={`space-y-2 pt-2 border-t-2 ${style.panelHead} border-b-0!`}>
      <label className="text-xs font-black uppercase flex items-center space-x-1">
        {icon}
        <span>{title}</span>
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {targets.map((t) => {
          const selected = selectedId === t.id;
          return (
            <button
              key={t.id}
              type="button"
              data-card-anchor={t.code ?? ''}
              onClick={() => onSelect(t.id)}
              className={`relative flex items-center justify-between gap-2 p-2.5 pl-4 text-xs font-bold cursor-pointer ${
                selected
                  ? `${TARGET_SELECTED[tone]} text-white border-2 border-comic-black rounded-sm shadow-comic-sm`
                  : style.tile
              }`}
            >
              <AccentStripe code={t.code ?? ''} />
              <span className="min-w-0">
                <CardRef code={t.code} name={t.name} size="xs" />
              </span>
              {t.trailing?.(selected)}
            </button>
          );
        })}
      </div>
    </div>
  );
};

function getDiscardCost(
  abilityCost: CardPaymentModalProps['abilityCost'],
  cardToPlay: CardInstance | null | undefined,
): { max: number; min: number; filter?: UniversalCardFilter } | undefined {
  if (abilityCost?.discardCount && abilityCost.discardCount > 0) {
    return {
      max: abilityCost.discardCount,
      min: abilityCost.discardMin ?? abilityCost.discardCount,
      filter: abilityCost.discardFilter,
    };
  }
  if (abilityCost || !cardToPlay || cardToPlay.card.type !== CardType.EVENT) return undefined;
  for (const ability of cardToPlay.card.enrichment?.abilities || []) {
    const declared = ability.cost?.discardCard;
    if (declared?.from === 'HAND' && declared.mode !== 'RANDOM') {
      return { ...getDiscardCostBounds(declared), filter: declared.filter };
    }
  }
  return undefined;
}

interface TargetPicker {
  title: string;
  icon: React.ReactNode;
  tone: TargetTone;
}

/** The picker a played card's chosen-target selector (`CHOSEN_SCHEME`, `CHOSEN_ENEMY`, ...) is shown in. */
function getTargetPicker(selector: string): TargetPicker {
  if (selector.includes('SCHEME')) {
    return {
      title: 'Select Scheme Target:',
      icon: <Shield className="w-4 h-4 text-comic-blue" />,
      tone: 'info',
    };
  }
  if (selector.includes('ENEMY') || selector.includes('MINION')) {
    return {
      title: 'Select Enemy Target:',
      icon: <Swords className="w-4 h-4 text-comic-red" />,
      tone: 'danger',
    };
  }
  if (selector.includes('ALLY')) {
    return {
      title: 'Select Ally Target:',
      icon: <Users className="w-4 h-4 text-comic-blue" />,
      tone: 'info',
    };
  }
  if (selector.includes('PLAYER')) {
    return {
      title: 'Select Player Target:',
      icon: <Users className="w-4 h-4 text-purple-600" />,
      tone: 'purple',
    };
  }
  return {
    title: 'Select Character Target:',
    icon: <Heart className="w-4 h-4 text-emerald-600" />,
    tone: 'success',
  };
}

interface TargetOption {
  id: string;
  code?: string;
  name: string;
  detail?: string;
}

/** How one engine-resolved target is named and summarised in a picker. */
function describeTarget(
  gameState: GameState,
  player: PlayerState,
  target: ResolvedTarget,
): TargetOption {
  const whose = (owner: PlayerState | undefined, noun: string, name: string) =>
    !owner || owner.id === player.id ? `${name} (${noun})` : `${name} (${owner.name}'s ${noun})`;

  if (target.kind === 'scheme') {
    return {
      id: target.id,
      code: target.entity.card.code,
      name: `${target.entity.card.name} (${target.entityType === 'main_scheme' ? 'Main' : 'Side'} Scheme)`,
      detail: `${target.entity.threat} Threat`,
    };
  }
  if (target.kind === 'player') {
    const p = target.entity;
    return {
      id: target.id,
      code: p.activeFormCard.code,
      name: `${p.name} (${p.activeFormCard.name})`,
    };
  }
  if (target.kind === 'card') {
    return { id: target.id, code: target.entity.card.code, name: target.entity.card.name };
  }

  if (target.entityType === 'hero' || target.entityType === 'alter_ego') {
    const p = target.entity as PlayerState;
    return {
      id: target.id,
      code: p.activeFormCard.code,
      name: `${p.name} (${p.activeFormCard.name})`,
      detail: `${p.health}/${getEffectiveMaxHealth(p, gameState)} HP`,
    };
  }
  if (target.entityType === 'villain') {
    const villain = target.entity as VillainState;
    return {
      id: target.id,
      code: villain.card.code,
      name: `${villain.card.name} (Villain)`,
      detail: `${villain.health} HP`,
    };
  }
  const inst = target.entity as CardInstance;
  if (target.entityType === 'minion') {
    return {
      id: target.id,
      code: inst.card.code,
      name: whose(target.player, 'Minion', inst.card.name),
      detail: `${Math.max(0, getEffectiveMinionHitPoints(gameState, inst) - (inst.tokens?.damage || 0))} HP`,
    };
  }
  return {
    id: target.id,
    code: inst.card.code,
    name: whose(target.player, 'Ally', inst.card.name),
    detail: inst.exhausted ? 'Exhausted' : 'Ready',
  };
}

/**
 * What the modal starts with for `cardToPlay`: the matching "The Power of..." cards for its cost, and
 * the likeliest target of its event.
 */
function getDefaultSelection(
  gameState: GameState,
  player: PlayerState,
  cardToPlay: CardInstance,
): { handCardIds: string[]; targetId: string | undefined } {
  let targetId: string | undefined;
  // Auto-select "The Power of [Aspect]" matching resource cards as a QoL improvement
  const autoSelectedHandIds: string[] = [];
  const cardCost = getEffectiveCardCost(gameState, player, cardToPlay).effectiveCost;
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
        (aspectDoubleStep && aspectDoubleStep.effectParams?.aspect === cardFaction) ||
        (hCard.card.name.toLowerCase().startsWith('the power of') &&
          hCard.card.faction === cardFaction);

      if (isMatchingPowerOf) {
        autoSelectedHandIds.push(hCard.instanceId);
        accumulatedRes += 2;
      }
    }
  }

  // Default target: the first valid target of what the card runs when played
  targetId = getPlayTargetChoice(gameState, player, cardToPlay)?.targets[0]?.id;
  return { handCardIds: autoSelectedHandIds, targetId };
}

export const CardPaymentModal: React.FC<CardPaymentModalProps> = ({
  isOpen,
  onClose,
  cardToPlay,
  abilityCost,
  player,
  onConfirmPlay,
}) => {
  const { state: gameState } = useGameSession();
  const { style } = useModalStyle();
  const [selectedHandCardIds, setSelectedHandCardIds] = useState<string[]>([]);
  const [selectedGeneratorIds, setSelectedGeneratorIds] = useState<string[]>([]);
  const [selectedDiscardCardIds, setSelectedDiscardCardIds] = useState<string[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState<string | undefined>(undefined);

  // Reset selections whenever a new card is selected, auto-selecting matching "The Power of..." cards
  const selectionInputs = useMemo(
    () => ({ cardToPlay, player, gameState }),
    [cardToPlay, player, gameState],
  );
  useOnChange(
    selectionInputs,
    ({ cardToPlay: card }) => {
      if (!card) return;
      const { handCardIds, targetId } = getDefaultSelection(gameState, player, card);
      setSelectedHandCardIds(handCardIds);
      setSelectedGeneratorIds([]);
      setSelectedDiscardCardIds([]);
      setSelectedTargetId(targetId);
    },
    { runOnMount: true },
  );

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

  const { effectiveCost, baseCost, reductions, totalReduction } = useMemo(() => {
    if (abilityCost) {
      const amt = abilityCost.amount || 0;
      return {
        effectiveCost: amt,
        baseCost: amt,
        reductions: [],
        totalReduction: 0,
      };
    }
    if (cardToPlay) {
      return getEffectiveCardCost(gameState, player, cardToPlay);
    }
    return {
      effectiveCost: 0,
      baseCost: 0,
      reductions: [],
      totalReduction: 0,
    };
  }, [abilityCost, cardToPlay, gameState, player]);

  const cost = effectiveCost;

  // Available hand payment cards (all hand cards except the card being played if played from hand)
  const availableHandCards = player.hand.filter((c) => c.instanceId !== cardToPlay?.instanceId);

  // Available generators: Identity resource abilities + ready tableau generators (ADR-0018)
  const availableGenerators = useMemo(() => {
    const list: {
      id: string;
      /** Catalog code of the generating card, for its thumbnail. */
      code: string;
      name: string;
      sublabel: string;
      resourceType?: string;
      amount: number;
      resources?: string[];
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

        const resType = (genStep?.effectParams?.resource as string) || 'resource';
        const amount = Number(genStep?.effectParams?.amount) || 1;
        list.push({
          id: 'identity_ability',
          code: player.activeFormCard.code,
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
      const generatorAbilities = abilities.filter(
        (a) =>
          isResourceAbility(a.timing) ||
          a.steps?.some(
            (s) => s.effect === 'GENERATE_RESOURCE' || s.effect === 'DOUBLE_RESOURCE_FOR_ASPECT',
          ),
      );

      if (generatorAbilities.length === 0) continue;

      // Filter out generators that require a different form
      const canUseInForm = generatorAbilities.some((a) =>
        isAbilityPlayableInForm(a.timing as any, player.currentForm),
      );
      if (!canUseInForm) continue;

      const genStep = generatorAbilities
        .flatMap((a) => a.steps || [])
        .find((s) => s.effect === 'GENERATE_RESOURCE');

      if (genStep?.effectParams?.fromCard) {
        const fromCardSelector = genStep.effectParams.fromCard as CardLocationSelector;
        const targetCard =
          fromCardSelector.zone === 'PLAYER_DISCARD' && fromCardSelector.position === 'TOP'
            ? player.discard[player.discard.length - 1]
            : locateCard(gameState, fromCardSelector, { player, sourceCardInstance: c });

        if (targetCard) {
          const cardObj = 'card' in targetCard ? targetCard.card : targetCard;
          const res = cardObj.resources;
          const resList: string[] = [];
          if (res) {
            for (let i = 0; i < (res.physical || 0); i++) resList.push('physical');
            for (let i = 0; i < (res.energy || 0); i++) resList.push('energy');
            for (let i = 0; i < (res.mental || 0); i++) resList.push('mental');
            for (let i = 0; i < (res.wild || 0); i++) resList.push('wild');
          }
          const totalAmt = resList.length > 0 ? resList.length : res?.total || 1;
          const typesDesc = resList.length > 0 ? resList.join(', ') : 'wild';
          list.push({
            id: c.instanceId,
            code: c.card.code,
            name: c.card.name,
            sublabel: `Top Discard: ${cardObj.name} (+${totalAmt} ${typesDesc})`,
            resourceType: resList.length === 1 ? resList[0] : 'wild',
            amount: totalAmt,
            resources: resList,
          });
        } else {
          list.push({
            id: c.instanceId,
            code: c.card.code,
            name: c.card.name,
            sublabel: 'Discard pile empty',
            resourceType: 'wild',
            amount: 0,
            resources: [],
          });
        }
        continue;
      }

      if (uses) {
        if ((c.tokens?.counters || 0) > 0) {
          list.push({
            id: c.instanceId,
            code: c.card.code,
            name: c.card.name,
            sublabel: `${c.tokens?.counters || 0} ${uses.counterType || 'Counters'} Remaining`,
            resourceType: 'wild',
            amount: 1,
          });
        }
      } else {
        list.push({
          id: c.instanceId,
          code: c.card.code,
          name: c.card.name,
          sublabel: 'Table Resource Generator / Reducer',
          resourceType: 'wild',
          amount: 1,
        });
      }
    }

    return list;
  }, [player, gameState]);

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

      const isDoubled = aspectDoubleStep && aspectDoubleStep.effectParams?.aspect === card?.faction;
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
      if (!gen || gen.amount === 0) continue;

      if (gen.resources && gen.resources.length > 0) {
        for (const r of gen.resources) {
          if (r === 'energy') energyCount += 1;
          else if (r === 'mental') mentalCount += 1;
          else if (r === 'physical') physicalCount += 1;
          else wildCount += 1;
        }
        total += gen.resources.length;
      } else {
        if (gen.resourceType === 'energy') energyCount += gen.amount;
        else if (gen.resourceType === 'mental') mentalCount += gen.amount;
        else if (gen.resourceType === 'physical') physicalCount += gen.amount;
        else wildCount += gen.amount;

        total += gen.amount;
      }
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

  const isRequirePrinted = Boolean(abilityCost?.requirePrinted);
  const isScalingPerResource = Boolean(abilityCost?.scalesWithResources);

  const committedMatching = useMemo(() => {
    if (abilityCost?.resourceType) {
      const matching =
        abilityCost.resourceType === 'physical'
          ? resourceBreakdown.physicalCount
          : abilityCost.resourceType === 'energy'
            ? resourceBreakdown.energyCount
            : abilityCost.resourceType === 'mental'
              ? resourceBreakdown.mentalCount
              : totalGenerated;
      return isRequirePrinted ? matching : matching + resourceBreakdown.wildCount;
    }
    return totalGenerated;
  }, [abilityCost, isRequirePrinted, resourceBreakdown, totalGenerated]);

  const isResourceCostCovered = useMemo(() => {
    if (cost <= 0) return true;
    if (abilityCost?.resourceType) {
      return committedMatching >= cost;
    }
    return totalGenerated >= cost;
  }, [abilityCost?.resourceType, committedMatching, totalGenerated, cost]);

  // The discard cost: given by the ability being used, or declared on the event being played.
  const discardCost = useMemo(
    () => getDiscardCost(abilityCost, cardToPlay),
    [abilityCost, cardToPlay],
  );

  const isDiscardCostCovered = useMemo(() => {
    if (!discardCost) return true;
    return (
      selectedDiscardCardIds.length >= discardCost.min &&
      selectedDiscardCardIds.length <= discardCost.max
    );
  }, [discardCost, selectedDiscardCardIds.length]);

  const isCostCovered = isResourceCostCovered && isDiscardCostCovered;

  const availableDiscardCards = useMemo(() => {
    if (!discardCost) return [];
    return player.hand.filter((c) => {
      if (c.instanceId === cardToPlay?.instanceId) return false;
      if (discardCost.filter) {
        return matchesCardFilter(c, discardCost.filter, { player, state: gameState });
      }
      return true;
    });
  }, [discardCost, cardToPlay?.instanceId, player, gameState]);

  // An event runs its abilities and an upgrade or support attaches to a host when played from hand
  // (RR v1.8 p. 12, 23; Issue #94); other cards enter play without targets.
  // The engine decides which targets are valid (RR v1.8 "Target", ADR-0090); the modal only shows them.
  const playTargetChoice = useMemo(
    () =>
      abilityCost || !cardToPlay ? undefined : getPlayTargetChoice(gameState, player, cardToPlay),
    [abilityCost, cardToPlay, gameState, player],
  );
  const playTargetPicker = playTargetChoice && getTargetPicker(playTargetChoice.selector);
  const playTargets = useMemo(
    () => (playTargetChoice?.targets ?? []).map((t) => describeTarget(gameState, player, t)),
    [playTargetChoice, gameState, player],
  );

  if (!isOpen || !cardToPlay || !card) return null;

  const toggleHandCard = (instanceId: string) => {
    if (selectedDiscardCardIds.includes(instanceId)) return;
    setSelectedHandCardIds((prev) =>
      prev.includes(instanceId) ? prev.filter((id) => id !== instanceId) : [...prev, instanceId],
    );
  };

  const toggleDiscardCard = (instanceId: string) => {
    if (selectedHandCardIds.includes(instanceId)) return;
    const required = discardCost?.max || 1;
    setSelectedDiscardCardIds((prev) => {
      if (prev.includes(instanceId)) {
        return prev.filter((id) => id !== instanceId);
      }
      if (prev.length >= required) {
        if (required === 1) {
          return [instanceId];
        }
        return prev;
      }
      return [...prev, instanceId];
    });
  };

  const toggleGenerator = (instanceId: string) => {
    setSelectedGeneratorIds((prev) =>
      prev.includes(instanceId) ? prev.filter((id) => id !== instanceId) : [...prev, instanceId],
    );
  };

  const handleConfirm = () => {
    if (!isCostCovered) return;
    onConfirmPlay(
      selectedHandCardIds,
      selectedGeneratorIds,
      selectedTargetId,
      selectedDiscardCardIds,
    );
  };

  return (
    <ModalScaffold
      title={abilityCost?.title || `Play ${card.name}`}
      kicker="Resource Payment & Action"
      verb="yellow"
      trigger={null}
      icon={<Zap className="w-5 h-5" />}
      onClose={onClose}
      maxWidthClass="max-w-2xl"
      testId="card-payment-modal"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className={`ml-auto px-4 py-2 font-black uppercase text-xs cursor-pointer ${style.btnMove}`}
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={!isCostCovered}
            onClick={handleConfirm}
            className={`px-6 py-2.5 font-black uppercase text-sm flex items-center space-x-2 cursor-pointer disabled:cursor-not-allowed ${style.btnGo}`}
          >
            <Sparkles className="w-4 h-4" />
            <span>
              {isScalingPerResource
                ? `Confirm & Place +${committedMatching} Tokens!`
                : 'Confirm & Play!'}
            </span>
          </button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Card Overview & Cost Header */}
        <div
          data-card-ref={card.code}
          className={`relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 pl-5 ${style.panel}`}
        >
          <AccentStripe code={card.code} />
          <div className="flex items-start gap-3">
            <CardArtThumbnail cardCode={card.code} cardName={card.name} size="md" />
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-black uppercase px-2 py-0.5 bg-comic-blue text-white rounded-sm border border-comic-black">
                  {card.type}
                </span>
                <span className={`text-xs font-black uppercase px-2 py-0.5 ${style.chip}`}>
                  {card.faction}
                </span>
              </div>
              <div className="text-xs font-medium">
                <FormattedCardText text={card.text} />
              </div>
            </div>
          </div>

          {/* Cost Badge */}
          <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto shrink-0 pl-2">
            <span className={`text-xs font-black uppercase ${style.muted}`}>
              {isScalingPerResource ? 'Placement Value' : 'Required Cost'}
            </span>
            <div className="flex items-center space-x-1">
              {cost > 0 ? (
                <>
                  {reductions.length > 0 && baseCost > 0 && (
                    <span
                      className={`font-comic line-through text-lg mr-1.5 font-bold ${style.muted}`}
                    >
                      {baseCost}
                    </span>
                  )}
                  <span
                    className={`font-comic text-3xl font-black ${
                      isCostCovered ? 'text-comic-green' : 'text-comic-red'
                    }`}
                  >
                    {isScalingPerResource ? `+${committedMatching}` : cost}
                  </span>
                  <span className="text-xs font-bold uppercase">
                    {isScalingPerResource
                      ? 'Tokens'
                      : abilityCost?.resourceType
                        ? abilityCost.resourceType
                        : 'Res'}
                  </span>
                </>
              ) : discardCost ? (
                <span className="text-sm font-black uppercase px-2.5 py-1 bg-comic-red text-white rounded-sm border border-comic-black shadow-comic-xs">
                  Discard {discardCost.min < discardCost.max ? 'up to ' : ''}
                  {discardCost.max}
                </span>
              ) : (
                <span className="font-comic text-3xl font-black text-comic-green">0</span>
              )}
            </div>
            {isRequirePrinted && (
              <span className="mt-1 text-nano font-black uppercase px-1.5 py-0.5 bg-comic-red text-white rounded-sm border border-comic-black shadow-comic-xs">
                Printed Only (No Wild)
              </span>
            )}
          </div>
        </div>

        {/* Active Cost Reduction Banner */}
        {reductions.length > 0 && baseCost > 0 && (
          <div className={`flex items-center gap-2 px-3 py-2 text-xs font-bold ${style.inset}`}>
            <Sparkles className="w-4 h-4 text-comic-yellow shrink-0" />
            <span>
              Cost reduced by {totalReduction} from{' '}
              {reductions.map((r) => r.sourceCardName).join(', ')}
            </span>
          </div>
        )}

        {/* 0-Cost Card Consumption Caution Banner */}
        {reductions.length > 0 && baseCost === 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-comic-red/10 border-2 border-comic-red rounded-md text-xs font-black text-comic-red shadow-comic-sm">
            <AlertTriangle className="w-4 h-4 text-comic-red shrink-0" />
            <span>
              Caution: Playing this 0-cost card will consume your active cost reduction (
              {reductions.map((r) => r.sourceCardName).join(', ')}: -{totalReduction})!
            </span>
          </div>
        )}

        {/* Discard Hand Cards as Cost Section */}
        {discardCost && (
          <div className="space-y-3 p-4 bg-comic-red/5 border-2 border-comic-red/30 rounded-lg">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-black uppercase tracking-wider flex items-center space-x-1.5">
                <AlertTriangle className="w-4 h-4 text-comic-red" />
                <span>
                  Choose {discardCost.min < discardCost.max ? 'up to ' : ''}
                  {discardCost.max} Card{discardCost.max > 1 ? 's' : ''} to Discard as Cost:
                </span>
              </h3>
              <span
                className={`text-xs font-black px-2 py-0.5 shrink-0 ${
                  isDiscardCostCovered
                    ? 'bg-comic-green text-white rounded-sm border border-comic-black'
                    : style.chip
                }`}
              >
                Selected: {selectedDiscardCardIds.length} / {discardCost.max}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {availableDiscardCards.map((hCard) => {
                const isSelected = selectedDiscardCardIds.includes(hCard.instanceId);
                const isUsedForPayment = selectedHandCardIds.includes(hCard.instanceId);

                return (
                  <ChoiceCard
                    key={hCard.instanceId}
                    code={hCard.card.code}
                    name={hCard.card.name}
                    subline={`${hCard.card.type} • ${hCard.card.faction}`}
                    selected={isSelected}
                    disabled={isUsedForPayment}
                    tone="danger"
                    onClick={() => toggleDiscardCard(hCard.instanceId)}
                    badge={
                      <span
                        className={`text-xs font-black px-2 py-0.5 ${
                          isSelected
                            ? 'bg-comic-red text-white rounded-sm border border-comic-black'
                            : style.chip
                        }`}
                      >
                        {isSelected ? 'DISCARD' : 'SELECT'}
                      </span>
                    }
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Payment Progress Bar */}
        {cost > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-black uppercase tracking-wide">
                {isScalingPerResource
                  ? `Tokens to Place (+${committedMatching}):`
                  : 'Resources Committed:'}
              </span>
              <span
                className={`text-sm font-black uppercase ${
                  isCostCovered ? 'text-comic-green' : 'text-comic-red'
                }`}
              >
                {isScalingPerResource
                  ? `${committedMatching} ${abilityCost?.resourceType || 'matching'} (Min ${cost} needed)`
                  : `${abilityCost?.resourceType ? committedMatching : totalGenerated} / ${cost} ${
                      isCostCovered
                        ? '✓ (Ready)'
                        : `(Need ${cost - (abilityCost?.resourceType ? committedMatching : totalGenerated)} more)`
                    }`}
              </span>
            </div>

            {/* Visual Meter Bar */}
            <div className={`w-full h-4 overflow-hidden flex rounded-full! ${style.inset}`}>
              <div
                className={`h-full transition-all duration-300 ${
                  isCostCovered ? 'bg-comic-green' : 'bg-comic-yellow'
                }`}
                style={{
                  width: `${Math.min(
                    100,
                    cost === 0
                      ? 100
                      : ((abilityCost?.resourceType ? committedMatching : totalGenerated) / cost) *
                          100,
                  )}%`,
                }}
              />
            </div>

            {/* Resource Affinity Pills */}
            <div className="flex flex-wrap gap-2 pt-1 text-xs font-bold text-slate-900">
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
        )}

        {/* Hand Cards Selection */}
        {availableHandCards.length > 0 && cost > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider flex items-center space-x-1.5">
                <span>Discard Hand Cards for Resources:</span>
              </h3>
              <span className={`text-micro font-bold uppercase ${style.muted}`}>
                (Click cards to toggle)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {availableHandCards.map((hCard) => {
                const isSelected = selectedHandCardIds.includes(hCard.instanceId);
                const isUsedForDiscardCost = selectedDiscardCardIds.includes(hCard.instanceId);
                const res = hCard.card.resources;
                const aspectDoubleStep = hCard.card.enrichment?.abilities
                  ?.flatMap((a) => a.steps || [])
                  .find((s) => s.effect === 'DOUBLE_RESOURCE_FOR_ASPECT');
                const isDoubled =
                  aspectDoubleStep && aspectDoubleStep.effectParams?.aspect === card.faction;
                const printedIcons = readCardResources(hCard);
                const matchingPrintedCount =
                  isRequirePrinted && abilityCost?.resourceType
                    ? printedIcons.filter((r) => r === abilityCost.resourceType).length
                    : undefined;
                const isHandCardDisabled =
                  isUsedForDiscardCost ||
                  isHandCardIneligibleForCost(hCard, abilityCost?.resourceType, isRequirePrinted);

                return (
                  <ChoiceCard
                    key={hCard.instanceId}
                    code={hCard.card.code}
                    name={hCard.card.name}
                    subline={`${hCard.card.type} • ${hCard.card.faction}`}
                    selected={isSelected}
                    disabled={isHandCardDisabled}
                    tone="warn"
                    onClick={() => toggleHandCard(hCard.instanceId)}
                    badge={
                      matchingPrintedCount !== undefined ? (
                        <span className={`text-xs font-black px-2 py-0.5 ${style.chip}`}>
                          {matchingPrintedCount} {abilityCost?.resourceType?.toUpperCase()}
                        </span>
                      ) : isDoubled ? (
                        <span className="text-xs font-black px-2.5 py-0.5 bg-emerald-600 text-white rounded-md border-2 border-comic-black shadow-comic-sm">
                          2 Res (2× Aspect)
                        </span>
                      ) : (
                        <span className={`text-xs font-black px-2 py-0.5 ${style.chip}`}>
                          {res.total || 1} Res
                        </span>
                      )
                    }
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Generators & Cost Reducers */}
        {availableGenerators.length > 0 && cost > 0 && (
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-black uppercase tracking-wider">
              Identity & Table Resource Generators:
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {availableGenerators.map((gen) => {
                const isSelected = selectedGeneratorIds.includes(gen.id);
                const isGenDisabled =
                  gen.amount === 0 ||
                  isGeneratorIneligibleForCost(gen, abilityCost?.resourceType, isRequirePrinted);
                return (
                  <ChoiceCard
                    key={gen.id}
                    code={gen.code}
                    name={gen.name}
                    subline={gen.sublabel}
                    selected={isSelected}
                    disabled={isGenDisabled}
                    tone="info"
                    onClick={() => !isGenDisabled && toggleGenerator(gen.id)}
                    badge={
                      <span className={`text-xs font-black px-2 py-0.5 shrink-0 ${style.chip}`}>
                        +{gen.amount} {gen.resourceType ? gen.resourceType.toUpperCase() : 'RES'}
                      </span>
                    }
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Target Selector: the target an event or an attachment's host asks for */}
        {playTargetPicker && (
          <TargetChoices
            title={playTargetPicker.title}
            icon={playTargetPicker.icon}
            tone={playTargetPicker.tone}
            selectedId={selectedTargetId}
            onSelect={setSelectedTargetId}
            targets={playTargets.map((t) => ({
              id: t.id,
              code: t.code,
              name: t.name,
              trailing: t.detail ? () => <span>{t.detail}</span> : undefined,
            }))}
          />
        )}
      </div>
    </ModalScaffold>
  );
};
