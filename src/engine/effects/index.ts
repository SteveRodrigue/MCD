import { applyToughnessOnEntry } from '../state/card-instance';
import { evaluateStepGate } from '../pipeline/step-gate-evaluator';
import {
  GameState,
  CardInstance,
  StatusCard,
  MinionCard,
  CardAbility,
  AbilityStep,
  CardType,
  SideSchemeCard,
  ConditionGate,
  StepResolutionResult,
  DecisionPromptOption,
  PendingDecisionPrompt,
  DistributionPromptConfig,
  TargetAllocationItem,
  NormalizedCard,
  PlayerState,
  VillainState,
  Keyword,
  hasKeyword,
  ActiveCostReduction,
  getActiveVillain,
  getActiveMainScheme,
  getVillainsInPlay,
  getVillainById,
  PendingSequence,
  DamagedCharacter,
  getPerPlayerCount,
} from '@engine/models';
import { handleVillainDefeat } from '../pipeline/scenario-helpers';
import { matchesCardFilter } from '../filters/card-filter';
import {
  executeVillainAttackAgainstPlayer,
  executeVillainSchemeAgainstPlayer,
  executeMinionAttackAgainstPlayer,
  resolveActiveEncounterCardAfterInterrupt,
} from '../pipeline/villain-phase';
import type { SearchZone } from '../../data/supplemental/schema';
import { getStepEffectParams, getStepGateParams } from '../../data/supplemental/schema';
import {
  discardFromEncounterDeckUntil,
  drawEncounterCard,
  exhaustPlayerDeck,
  drawPlayerCard,
} from '../pipeline/deck-exhaustion';
import { dealSurgeCard } from '../pipeline/surge';
import { chooseStepTarget } from './target-choice';
import {
  enqueueDecisionPrompt,
  enqueueDistributionPrompt,
  peekDecisionPrompt,
} from '../pipeline/prompt-queue';
import { beginEnemyAttack, resolveDefenderDeclaration } from '../pipeline/combat-pipeline';
import {
  applyDamageToTarget,
  type DamageRequest,
  type DamageResult,
  type TargetEntityRef,
} from '../pipeline/damage-pipeline';
import { applyThreatPlacement, applyThwart } from '../pipeline/threat-pipeline';
import {
  getEffectiveMaxHealth,
  getEffectiveHandSize,
  hasEntityKeyword,
} from '../pipeline/stat-calculator';
import { dispatchTrigger, matchesTriggerFilter } from '../triggers/trigger-dispatcher';
import { TriggerCallNode } from '../errors/infinite-loop-error';
import { getSpecialHandler } from '../specials/special-registry';
import '../specials/wakanda-forever';
import {
  attachCardToHost,
  removeCardFromAllZones,
  initializeCardUses,
} from '../state/state-validator';
import { locateCard, readCardResources } from '../queries/card-inspector';
import {
  hasCrisisInPlay,
  getPlayerAllyLimit,
  checkUniqueCardPlayable,
} from '../pipeline/legality-checker';

/**
 * Narrows resolved targets with an optional UniversalCardFilter (ADR-0046) so that EXHAUST and READY
 * honor the `filter` parameter the Card Editor already offers (Issue #158).
 */
function filterResolvedTargets(
  state: GameState,
  targets: ResolvedTarget[],
  filter: Record<string, any> | undefined,
  player: PlayerState,
): ResolvedTarget[] {
  if (!filter) return targets;
  return targets.filter((t) => {
    let card: NormalizedCard | undefined;
    if (t.kind === 'card') {
      card = t.entity.card;
    } else if (t.kind === 'player') {
      card = t.entity.activeFormCard;
    } else if (t.kind === 'character') {
      if (t.entityType === 'hero' || t.entityType === 'alter_ego') {
        card = (t.entity as PlayerState).activeFormCard;
      } else if (t.entityType === 'villain') {
        card = (t.entity as VillainState).card;
      } else {
        card = (t.entity as CardInstance).card;
      }
    }
    return card ? matchesCardFilter(card, filter, { player, state }) : false;
  });
}

export type EffectTargetType =
  'villain' | 'minion' | 'main_scheme' | 'side_scheme' | 'ally' | 'hero' | 'character' | 'identity';

export interface EffectExecutionContext {
  playerId: string;
  targetPlayerId?: string;
  sourceCardInstance?: CardInstance;
  targetCardInstance?: CardInstance;
  sourceCardId?: string;
  /**
   * The target the player chose for this ability: the UI selection carried by a player action,
   * or the answer to a target prompt. Never the target of the triggering event.
   */
  chosenTargetType?: EffectTargetType;
  chosenTargetInstanceId?: string;
  /**
   * The target of the event that triggered this ability (the thwarted scheme, the defeated minion,
   * the attacking enemy). Read by TRIGGERING_* selectors and "that" references only.
   */
  eventTargetType?: string;
  eventTargetInstanceId?: string;
  resourcesSpent?: string[];
  previousResult?: StepResolutionResult;
  collectedCardInstanceIds?: string[];
  threatAmount?: number;
  damageAmount?: number;
  interceptedValue?: number;
  remainingInterceptedValue?: number;
  isAttack?: boolean;
  /**
   * The resolving ability is labelled "(attack)": its damage is an attack by the player's identity
   * (RR v1.8 glossary L). One labelled ability is one attack, however many damage instances.
   */
  labelledAttack?: boolean;
  /** The first enemy a labelled attack damaged; ATTACK_RESOLVED is dispatched for it, once. */
  attackedEnemy?: { targetType: 'villain' | 'minion'; instanceId: string };
  attackResolvedDispatched?: boolean;
  isFinalStep?: boolean;
  discardedCards?: CardInstance[];
  assignments?: Record<string, number>;
  interactivePrompt?: boolean;
  /** Active chain of trigger nodes for cycle detection & depth tracking (ADR-0053) */
  triggerChain?: TriggerCallNode[];
  /** Host ability context for timing, trigger, and cost evaluation */
  ability?: CardAbility;
  distinctFromId?: string;
  ignoresCrisis?: boolean;
  /** Attack being resolved (boost cards): who attacks and who defended, for UNDEFENDED_ATTACK. */
  attackerType?: 'VILLAIN' | 'MINION';
  defenderType?: 'HERO' | 'ALLY' | 'UNDEFENDED';
  /** Final damage of the activation, set while a deferred boost ability resolves (IF_ACTIVATION_DEALT_DAMAGE). */
  activationDamage?: number;
  /** The hero or ally that took that damage, resolved by the DAMAGED_CHARACTER selector. */
  damagedCharacter?: DamagedCharacter;
}

export { evaluateDynamicAmount } from './dynamic-formula-evaluator';
import { evaluateDynamicAmount } from './dynamic-formula-evaluator';
export {
  resolveTargets,
  resolveCharacterTargets,
  resolveSchemeTargets,
  resolvePlayerTargets,
  resolveCardTargets,
  resolveEntityByInstanceId,
} from './target-resolver';
export type {
  EffectContext,
  ResolvedTarget,
  CharacterTarget,
  SchemeTarget,
  PlayerTarget,
  CardTarget,
} from './target-resolver';
import {
  resolveTargets,
  resolveCharacterTargets,
  resolveSchemeTargets,
  resolvePlayerTargets,
  resolveEntityByInstanceId,
  type EffectContext,
  type SchemeTarget,
  type ResolvedTarget,
} from './target-resolver';

/**
 * Universal dynamic numeric amount resolver (ADR-0049, ADR-0052)
 * Resolves literal numbers, tokens, and DynamicValueSource with full math, fractions, and clamping.
 */
export function resolveNumericAmount(
  amountParam: any,
  context: Partial<EffectExecutionContext>,
  fallback: number = 0,
  options?: {
    state?: GameState;
    player?: PlayerState;
    targetInstanceId?: string;
    targetCardInstance?: CardInstance;
    sourceCardInstance?: CardInstance;
  },
): number {
  return evaluateDynamicAmount(amountParam, context, {
    fallback,
    state: options?.state || (context as any)?.state,
    player: options?.player || (context as any)?.player,
    targetInstanceId: options?.targetInstanceId || context?.chosenTargetInstanceId,
    targetCardInstance: options?.targetCardInstance || (context as any)?.targetCardInstance,
    sourceCardInstance: options?.sourceCardInstance || context?.sourceCardInstance,
  });
}

export interface EffectResult {
  state: GameState;
  success: boolean;
  error?: string;
  onomatopoeia?: string;
  mutatedState?: boolean;
  value?: number;
  selectedCardInstanceIds?: string[];
  targetId?: string;
  conditionMet?: boolean;
  discardedCards?: CardInstance[];
}

/**
 * Universal helper to reset transient gameplay state when a card leaves play or is discarded (RR v1.8 p. 15).
 * Resets exhausted, tokens, counters, statusCards, activeStatModifiers, attachments, and cardsUnderneath
 * while strictly preserving immutable identity attributes (instanceId, card, ownerId).
 */
export function resetCardState(card: CardInstance): void {
  if (!card) return;
  card.exhausted = false;
  card.tokens = {};
  card.counters = {};
  card.statusCards = [];
  card.activeStatModifiers = [];
  card.attachments = [];
  card.cardsUnderneath = [];
}

/**
 * Routes a defeated card to the permanent Victory Display if it carries the printed
 * 'Victory X' keyword, or to its normal discard pile otherwise (RR v1.8 p. 30, ADR-0034).
 * Reusable across every defeat path (minions, side schemes, player side schemes).
 */
export function moveDefeatedCardToPile(
  state: GameState,
  cardInstance: CardInstance,
  discardPile: CardInstance[],
): void {
  resetCardState(cardInstance);
  if (hasEntityKeyword(cardInstance, 'Victory')) {
    state.victoryDisplay.push(cardInstance);
  } else {
    discardPile.push(cardInstance);
  }
}

/**
 * Universal declarative card filter evaluator (ADR-0046, RR v1.8 p. 19, 26, 28).
 * Delegates to pure engine module src/engine/filters/card-filter.ts.
 */
export { matchesCardFilter } from '../filters/card-filter';

export function matchCardFilter(card: NormalizedCard, filter?: any, player?: PlayerState): boolean {
  return matchesCardFilter(card, filter, { player });
}

import { checkAndDiscardZeroCounterCard, getAvailableResources } from '../pipeline/cost-engine';
export { checkAndDiscardZeroCounterCard };

/**
 * Checks whether a card belongs to the encounter deck pool (RR v1.8 p. 11).
 */
export function isEncounterCard(card: NormalizedCard): boolean {
  if (!card) return false;
  const t = card.type?.toLowerCase();
  return (
    t === 'attachment' ||
    t === 'minion' ||
    t === 'treachery' ||
    t === 'main_scheme' ||
    t === 'side_scheme' ||
    t === 'villain' ||
    t === 'obligation' ||
    t === 'environment' ||
    (card as any).faction_code === 'encounter' ||
    Boolean((card as any).card_set_code)
  );
}

/**
 * Universal helper to cleanly discard all attachments and cards underneath when a host leaves play (RR v1.8 p. 5, 6).
 */
export function discardHostAttachmentsAndTuckedCards(
  state: GameState,
  host: { attachments?: CardInstance[]; cardsUnderneath?: CardInstance[] },
  ownerPlayerId?: string,
): void {
  if (!host) return;

  // 1. Discard all active attachments to appropriate discard piles
  if (host.attachments && host.attachments.length > 0) {
    for (const attachment of host.attachments) {
      if (isEncounterCard(attachment.card)) {
        state.encounterDiscard.push(attachment);
      } else {
        const ownerId = (attachment as any).ownerId || ownerPlayerId;
        const targetP = state.players.find((p) => p.id === ownerId) || state.players[0];
        targetP.discard.push(attachment);
        dispatchTrigger(state, 'CARD_DISCARDED', {
          targetPlayerId: targetP.id,
          sourceInstanceId: attachment.instanceId,
        });
      }
    }
    host.attachments = [];
  }

  // 2. Discard all face-down/out-of-play cards placed underneath
  if (host.cardsUnderneath && host.cardsUnderneath.length > 0) {
    for (const tucked of host.cardsUnderneath) {
      if (isEncounterCard(tucked.card)) {
        state.encounterDiscard.push(tucked);
      } else {
        const ownerId = (tucked as any).ownerId || ownerPlayerId;
        const targetP = state.players.find((p) => p.id === ownerId) || state.players[0];
        targetP.discard.push(tucked);
        dispatchTrigger(state, 'CARD_DISCARDED', {
          targetPlayerId: targetP.id,
          sourceInstanceId: tucked.instanceId,
        });
      }
    }
    host.cardsUnderneath = [];
  }
}

/**
 * Universal helper to cleanly discard a card instance respecting persistent ownership invariants (RR v1.8 p. 11, 23, ADR-0040, ADR-0068).
 */
export function discardCardInstance(
  state: GameState,
  card: CardInstance,
  fallbackPlayerId?: string,
): void {
  if (!card) return;

  // 1. Cascade host attachments and tucked cards
  discardHostAttachmentsAndTuckedCards(state, card, fallbackPlayerId);

  // 2. Atomic remove from all zones
  removeCardFromAllZones(state, card.instanceId);

  // 3. Reset card state (leaves play / discard invariant per RR v1.8 p. 15)
  resetCardState(card);

  // 4. Proper destination routing based on encounter vs. player card ownership
  if (isEncounterCard(card.card)) {
    state.encounterDiscard.push(card);
  } else {
    const targetPlayer =
      (card.ownerId ? state.players.find((p) => p.id === card.ownerId) : undefined) ||
      (fallbackPlayerId ? state.players.find((p) => p.id === fallbackPlayerId) : undefined) ||
      state.players[0];

    if (targetPlayer) {
      targetPlayer.discard.push(card);
      dispatchTrigger(state, 'CARD_DISCARDED', {
        targetPlayerId: targetPlayer.id,
        sourceInstanceId: card.instanceId,
      });
    }
  }
}

/**
 * Returns the in-play zone entity that stands for `source`, so effects mutate the real host
 * instead of a reveal-time copy. Side schemes live as `SideSchemeState` in `state.sideSchemes`.
 */
function resolveSourceHostZone(
  state: GameState,
  source?: CardInstance,
): { cardsUnderneath?: CardInstance[] } | undefined {
  if (!source) return undefined;
  return state.sideSchemes.find((s) => s.instanceId === source.instanceId);
}

/**
 * Universal helper to process character defeat when cards are attached (RR v1.8 p. 6, 13).
 * Triggers all 'HOST_DEFEATED' interrupt abilities on attached cards, then cleanly discards them.
 */
export function processHostDefeated(
  state: GameState,
  hostCard: CardInstance,
  context?: { player?: PlayerState; sourceCardInstance?: CardInstance },
): void {
  const attachments = hostCard.attachments || [];
  const cardsUnderneath = hostCard.cardsUnderneath || [];
  if (attachments.length === 0 && cardsUnderneath.length === 0) return;

  for (const att of attachments) {
    (att as any).hostInstanceId = (att as any).hostInstanceId || hostCard.instanceId;
    const abilities = att.card.enrichment?.abilities || [];
    for (const ab of abilities) {
      if (ab.trigger === 'CHARACTER_DEFEATED' || ab.trigger === 'DEFEATED') {
        const ownerId = (att as any).ownerId;
        const owner =
          (ownerId ? state.players.find((p) => p.id === ownerId) : undefined) ||
          context?.player ||
          state.players[0];

        if (ab.triggerFilter) {
          const filterCtx = {
            targetPlayerId: owner.id,
            targetInstanceId: hostCard.instanceId,
            sourceInstanceId: hostCard.instanceId,
            targetType: hostCard.card.type ? hostCard.card.type.toUpperCase() : undefined,
          };
          if (!matchesTriggerFilter(ab.triggerFilter, filterCtx, owner, att, ab.trigger)) {
            continue;
          }
        }

        executeEffect(state, ab, {
          playerId: owner.id,
          sourceCardInstance: att,
        });

        state.log.push({
          id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          timestamp: Date.now(),
          round: state.roundNumber,
          phase: state.phase,
          key: `ability.${ab.id}.triggered`,
          params: { card: att.card.name, host: hostCard.card.name },
          onomatopoeia: 'HOST DEFEATED!',
        });
      }
    }
  }

  const ownerPlayerId = context?.player?.id || state.players[0]?.id;
  discardHostAttachmentsAndTuckedCards(state, hostCard, ownerPlayerId);
}

/**
 * Defeats a side scheme (RR v1.8 p. 9, 25, 30, ADR-0034, ADR-0058).
 * Slices it from state.sideSchemes, processes host attachments/tucked cards,
 * dispatches DEFEATED and SCHEME_DEFEATED triggers, executes declared 'When Defeated'
 * abilities, routes to Victory Display or the appropriate discard pile, and logs the event.
 */
export function defeatSideScheme(
  state: GameState,
  sideSchemeInstanceId: string,
  defeatingPlayerId?: string,
): boolean {
  const schemeIndex = (state.sideSchemes || []).findIndex(
    (s) => s.instanceId === sideSchemeInstanceId || s.card.code === sideSchemeInstanceId,
  );
  if (schemeIndex === -1) {
    return false;
  }

  const sideScheme = state.sideSchemes[schemeIndex];
  state.sideSchemes.splice(schemeIndex, 1);

  const defeatedInstance: CardInstance = {
    instanceId: sideScheme.instanceId,
    card: sideScheme.card,
    ownerId: sideScheme.ownerId,
    attachments: sideScheme.attachments,
    cardsUnderneath: sideScheme.cardsUnderneath,
  };

  const player = defeatingPlayerId
    ? state.players.find((p) => p.id === defeatingPlayerId)
    : (sideScheme.ownerId ? state.players.find((p) => p.id === sideScheme.ownerId) : undefined) ||
      state.players[0];
  const targetPlayerId = player?.id || state.players[0]?.id || 'p1';

  // 1. Dispatch canonical defeat triggers
  const defeatContext = {
    targetPlayerId,
    sourceInstanceId: defeatedInstance.instanceId,
    entityType: 'SCHEME' as const,
  };
  dispatchTrigger(state, 'DEFEATED', defeatContext);
  dispatchTrigger(state, 'SCHEME_DEFEATED', defeatContext);

  // 2. Resolve 'When Defeated' abilities declared on the scheme itself, before its attachments and
  // facedown cards are cleaned up, so "return each card here" still sees them (#238)
  const defeatedAbilities = sideScheme.card.enrichment?.abilities || [];
  for (const ability of defeatedAbilities) {
    const trigger = ability.trigger as string | undefined;
    const timing = ability.timing as string | undefined;
    if (
      (trigger === 'DEFEATED' || trigger === 'WHEN_DEFEATED') &&
      (timing === 'FORCED_RESPONSE' ||
        timing === 'RESPONSE' ||
        timing === 'WHEN_DEFEATED' ||
        !timing)
    ) {
      executeEffect(state, ability, {
        playerId: sideScheme.ownerId || targetPlayerId,
        sourceCardInstance: defeatedInstance,
      });
    }
  }

  // 3. Clean up whatever is still attached or underneath (attachments, tucked cards)
  processHostDefeated(state, defeatedInstance, { player });

  // 4. Route to Victory Display or the appropriate discard pile (RR v1.8 p. 30, ADR-0034)
  const destinationPile = sideScheme.ownerId
    ? state.players.find((p) => p.id === sideScheme.ownerId)?.discard || state.players[0]?.discard
    : state.encounterDiscard;
  moveDefeatedCardToPile(state, defeatedInstance, destinationPile);

  // 5. Comic event log
  state.log.push({
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: Date.now(),
    round: state.roundNumber,
    phase: state.phase,
    category: 'scheme',
    key: 'scheme.defeated',
    params: {
      scheme: sideScheme.card.name,
      player: player?.name || 'Player',
    },
    onomatopoeia: 'SCHEME DEFEATED!',
  });

  return true;
}

/**
 * Compiles eligible and ineligible distribution targets with dynamic capacity limits (ADR-0064).
 */
export function compileDistributionTargets(
  state: GameState,
  targetScope: string,
  allocationDomain: string,
  capRule?: string,
): TargetAllocationItem[] {
  const targets: TargetAllocationItem[] = [];

  const includeHeroes =
    targetScope === 'ALL_HEROES_AND_ALLIES' ||
    targetScope === 'ALL_HEROES' ||
    targetScope === 'ALL_PLAYERS' ||
    targetScope === 'ALL_FRIENDLY_CHARACTERS' ||
    targetScope === 'ALL_CHARACTERS' ||
    targetScope === 'CHOSEN_CHARACTER' ||
    targetScope === 'CHOSEN_FRIENDLY_CHARACTER' ||
    targetScope === 'CHOSEN_HERO';

  const includeAllies =
    targetScope === 'ALL_HEROES_AND_ALLIES' ||
    targetScope === 'ALL_ALLIES' ||
    targetScope === 'ALL_FRIENDLY_CHARACTERS' ||
    targetScope === 'ALL_CONTROLLED_CHARACTERS' ||
    targetScope === 'ALL_CHARACTERS' ||
    targetScope === 'CHOSEN_CHARACTER' ||
    targetScope === 'CHOSEN_FRIENDLY_CHARACTER' ||
    targetScope === 'CHOSEN_ALLY';

  const includeSchemes =
    targetScope === 'ALL_SCHEMES' ||
    targetScope === 'ALL_SIDE_SCHEMES' ||
    targetScope === 'MAIN_SCHEME' ||
    targetScope === 'CHOSEN_SCHEME' ||
    targetScope === 'CHOSEN_SIDE_SCHEME' ||
    allocationDomain === 'THREAT_REMOVAL';

  const includeEnemies =
    targetScope === 'ALL_ENEMIES' ||
    targetScope === 'ALL_CHARACTERS' ||
    targetScope === 'CHOSEN_ENEMY';

  // 1. Players / Identities & Allies
  for (const p of state.players) {
    if (includeHeroes) {
      const isHero = p.currentForm === 'hero';
      const isFormRestricted =
        (targetScope === 'ALL_HEROES' || targetScope === 'ALL_HEROES_AND_ALLIES') && !isHero;
      const hasTough = p.statusCards.includes(StatusCard.TOUGH);
      let isEligible = true;
      let ineligibilityReason: string | undefined;
      let allocationCap: number = p.health;

      if (isFormRestricted) {
        isEligible = false;
        ineligibilityReason = 'Alter-Ego (Immune)';
        allocationCap = 0;
      } else if (allocationDomain === 'HEAL') {
        const damageSuffered = p.maxHealth - p.health;
        if (damageSuffered <= 0) {
          isEligible = false;
          ineligibilityReason = 'At full health';
          allocationCap = 0;
        } else {
          allocationCap = damageSuffered;
        }
      } else if (allocationDomain === 'EXHAUST') {
        if (p.exhausted) {
          isEligible = false;
          ineligibilityReason = 'Already exhausted';
          allocationCap = 0;
        } else {
          allocationCap = 1;
        }
      } else if (allocationDomain === 'DAMAGE') {
        if (capRule === 'REMAINING_HP') {
          allocationCap = p.health;
        } else if (capRule === 'NONE') {
          allocationCap = 999;
        } else {
          allocationCap = p.health;
        }
      }

      targets.push({
        instanceId: p.id,
        name: p.activeFormCard?.name || p.hero?.name || p.name,
        cardCode: p.activeFormCard?.code || p.hero?.code,
        cardType: isHero ? 'hero' : 'alter_ego',
        controllerPlayerId: p.id,
        controllerName: p.name,
        currentValue: p.health,
        maxValue: p.maxHealth,
        allocationCap,
        hasTough,
        statusCards: p.statusCards,
        isEligible,
        ineligibilityReason,
      });
    }

    if (includeAllies) {
      for (const ally of p.allies) {
        const allyHp = (ally.card as any).health || 1;
        const currentDmg = ally.tokens?.damage || 0;
        const currentHp = Math.max(0, allyHp - currentDmg);
        const hasTough = (ally.statusCards || []).includes(StatusCard.TOUGH);
        let isEligible = true;
        let ineligibilityReason: string | undefined;
        let allocationCap: number = currentHp;

        if (allocationDomain === 'HEAL') {
          if (currentDmg <= 0) {
            isEligible = false;
            ineligibilityReason = 'At full health';
            allocationCap = 0;
          } else {
            allocationCap = currentDmg;
          }
        } else if (allocationDomain === 'EXHAUST') {
          if (ally.exhausted) {
            isEligible = false;
            ineligibilityReason = 'Already exhausted';
            allocationCap = 0;
          } else {
            allocationCap = 1;
          }
        } else if (allocationDomain === 'DAMAGE') {
          if (capRule === 'REMAINING_HP') {
            allocationCap = currentHp;
          } else if (capRule === 'NONE') {
            allocationCap = 999;
          } else {
            allocationCap = currentHp;
          }
        }

        targets.push({
          instanceId: ally.instanceId,
          name: ally.card.name,
          cardCode: ally.card.code,
          cardType: 'ally',
          controllerPlayerId: p.id,
          controllerName: p.name,
          currentValue: currentHp,
          maxValue: allyHp,
          allocationCap,
          hasTough,
          statusCards: ally.statusCards,
          isEligible,
          ineligibilityReason,
        });
      }
    }
  }

  // 2. Schemes (Main Scheme + Side Schemes)
  if (includeSchemes && getActiveMainScheme(state)) {
    const mainThreat = getActiveMainScheme(state).threat || 0;
    const isMainEligible = mainThreat > 0;
    targets.push({
      instanceId: 'main_scheme',
      name: getActiveMainScheme(state).card.name,
      cardCode: getActiveMainScheme(state).card.code,
      cardType: 'main_scheme',
      currentValue: mainThreat,
      allocationCap: mainThreat,
      isEligible: isMainEligible,
      ineligibilityReason: isMainEligible ? undefined : 'No threat on scheme',
    });

    for (const side of state.sideSchemes || []) {
      const sideThreat = side.threat || 0;
      const isSideEligible = sideThreat > 0;
      targets.push({
        instanceId: side.instanceId,
        name: side.card.name,
        cardCode: side.card.code,
        cardType: 'side_scheme',
        currentValue: sideThreat,
        allocationCap: sideThreat,
        isEligible: isSideEligible,
        ineligibilityReason: isSideEligible ? undefined : 'No threat on scheme',
      });
    }
  }

  // 3. Enemies (Villain + Minions)
  if (includeEnemies) {
    const villainsInPlay = getVillainsInPlay(state);
    for (const villain of villainsInPlay.length > 0 ? villainsInPlay : [getActiveVillain(state)]) {
      if (!villain) continue;
      targets.push({
        instanceId: villain.instanceId || 'villain',
        name: villain.card.name,
        cardCode: villain.card.code,
        cardType: 'villain',
        currentValue: villain.health,
        allocationCap: villain.health,
        hasTough: villain.statusCards.includes(StatusCard.TOUGH),
        statusCards: villain.statusCards,
        isEligible: true,
      });
    }
    for (const p of state.players) {
      for (const m of p.engagedMinions) {
        const mHp = (m.card as MinionCard).health || 1;
        const currentDmg = m.tokens?.damage || 0;
        const currentHp = Math.max(0, mHp - currentDmg);
        const mTough = (m.statusCards || []).includes(StatusCard.TOUGH);
        targets.push({
          instanceId: m.instanceId,
          name: m.card.name,
          cardCode: m.card.code,
          cardType: 'minion',
          controllerPlayerId: p.id,
          controllerName: p.name,
          currentValue: currentHp,
          maxValue: mHp,
          allocationCap: currentHp,
          hasTough: mTough,
          statusCards: m.statusCards,
          isEligible: true,
        });
      }
    }
  }

  return targets;
}

/**
 * Evaluates whether a sequential step gate condition is satisfied (RR v1.8 p. 2, 24).
 * Delegates to the shared evaluator (Issue #122).
 */
export function shouldExecuteStep(
  gate: ConditionGate | undefined,
  prevResult: StepResolutionResult | undefined,
  state: GameState,
  step: AbilityStep,
  context: EffectExecutionContext,
  stepResultsMap?: Map<string, StepResolutionResult>,
): boolean {
  return evaluateStepGate(gate, prevResult, state, step, context, stepResultsMap);
}

/** How a DEAL_DAMAGE step hands its damage to the pipeline (#247). */
interface AbilityDamageOptions {
  sourceType?: DamageRequest['sourceType'];
  sourcePlayerId: string;
  sourceCardInstance?: CardInstance;
  isAttack: boolean;
  hasPiercing: boolean;
  triggerChain?: TriggerCallNode[];
}

function villainTargetRef(villain: VillainState): TargetEntityRef {
  return {
    type: 'villain',
    entity: villain,
    name: villain.card.name,
    attachments: villain.attachments,
    statusCards: villain.statusCards,
  };
}

function minionTargetRef(minion: CardInstance, controllerId: string): TargetEntityRef {
  return {
    type: 'minion',
    entity: minion,
    instanceId: minion.instanceId,
    name: minion.card.name,
    targetPlayerId: controllerId,
    attachments: minion.attachments,
    statusCards: minion.statusCards,
  };
}

function allyTargetRef(ally: CardInstance, controllerId: string): TargetEntityRef {
  return {
    type: 'ally',
    entity: ally,
    instanceId: ally.instanceId,
    name: ally.card.name,
    targetPlayerId: controllerId,
    attachments: ally.attachments,
    statusCards: ally.statusCards,
  };
}

function playerTargetRef(player: PlayerState): TargetEntityRef {
  return {
    type: 'player',
    entity: player,
    name: player.name,
    targetPlayerId: player.id,
    attachments: player.attachments,
    statusCards: player.statusCards,
  };
}

/** Ability damage to one character: always through the damage pipeline. */
function applyAbilityDamage(
  state: GameState,
  target: TargetEntityRef,
  amount: number,
  opts: AbilityDamageOptions,
  extra: Partial<DamageRequest> = {},
): { state: GameState; result: DamageResult } {
  return applyDamageToTarget(state, {
    target,
    amount,
    sourceType: opts.sourceType ?? 'CARD_EFFECT',
    sourceCardInstance: opts.sourceCardInstance,
    sourcePlayerId: opts.sourcePlayerId,
    isAttack: opts.isAttack,
    hasPiercing: opts.hasPiercing,
    ...extra,
  });
}

/**
 * Damage to a player's identity (hero or alter-ego), through the pipeline. Tough and damage shields
 * apply first, then the DAMAGE_TAKEN interrupt window opens and the hit points drop. Shared by the
 * identity selectors (`SELF_IDENTITY`, `SELF_HERO`) and `ALL_HEROES`.
 */
function dealDamageToIdentity(
  state: GameState,
  player: PlayerState,
  amount: number,
  opts: AbilityDamageOptions,
): GameState {
  return applyAbilityDamage(state, playerTargetRef(player), amount, opts, {
    dispatchDamageTaken: true,
    triggerChain: opts.triggerChain,
  }).state;
}

/** Damage a player assigns to a hero while distributing points: through the damage pipeline. */
export function dealDistributedDamageToPlayer(
  state: GameState,
  player: PlayerState,
  amount: number,
  sourceCardInstance?: CardInstance,
): GameState {
  return applyAbilityDamage(state, playerTargetRef(player), amount, {
    sourceType: 'CARD_EFFECT',
    sourcePlayerId: player.id,
    sourceCardInstance,
    isAttack: false,
    hasPiercing: false,
  }).state;
}

/** Damage to an ally (by instance id) or, failing that, to the player with that id. */
function dealDamageToAllyOrHero(
  state: GameState,
  id: string,
  fallbackPlayer: PlayerState,
  amount: number,
  opts: AbilityDamageOptions,
): GameState {
  for (const p of state.players) {
    const ally = p.allies.find((a) => a.instanceId === id);
    if (ally) return applyAbilityDamage(state, allyTargetRef(ally, p.id), amount, opts).state;
  }
  const hero = state.players.find((pl) => pl.id === id) || fallbackPlayer;
  return applyAbilityDamage(state, playerTargetRef(hero), amount, opts).state;
}

/** Damage to every minion engaged with the given players, last engaged first. */
function dealDamageToMinions(
  state: GameState,
  amount: number,
  minionOwners: PlayerState[],
  opts: AbilityDamageOptions,
): GameState {
  for (const owner of minionOwners) {
    for (const minion of [...owner.engagedMinions].reverse()) {
      state = applyAbilityDamage(state, minionTargetRef(minion, owner.id), amount, opts).state;
    }
  }
  return state;
}

/**
 * Deals damage to the villain and to every minion engaged with the given players, each through the
 * pipeline (Tough, shields, defeat and Overkill rules are the pipeline's).
 */
function dealDamageToEnemies(
  state: GameState,
  amount: number,
  minionOwners: PlayerState[],
  opts: AbilityDamageOptions,
): GameState {
  state = applyAbilityDamage(state, villainTargetRef(getActiveVillain(state)), amount, opts).state;
  return dealDamageToMinions(state, amount, minionOwners, opts);
}

export function pushPendingSequence(state: GameState, sequence: PendingSequence): void {
  if (!state.pendingSequences) {
    state.pendingSequences = [];
  }
  state.pendingSequences.push(sequence);
}

export function popPendingSequence(state: GameState): PendingSequence | undefined {
  return state.pendingSequences?.pop();
}

export function peekPendingSequence(state: GameState): PendingSequence | undefined {
  if (!state.pendingSequences || state.pendingSequences.length === 0) return undefined;
  return state.pendingSequences[state.pendingSequences.length - 1];
}

export function hasPendingSequence(state: GameState): boolean {
  return Boolean(state.pendingSequences && state.pendingSequences.length > 0);
}

export function resumePendingSequence(state: GameState): GameState {
  let currentState = state;
  while (!peekDecisionPrompt(currentState) && hasPendingSequence(currentState)) {
    const pending = popPendingSequence(currentState);
    if (!pending) break;
    const stepResultsMap = new Map<string, StepResolutionResult>(
      Object.entries(pending.stepResultsMap || {}),
    );
    const pendingBefore = currentState.pendingSequences?.length ?? 0;
    const forEachPlayerIds = pending.context.forEachPlayerIds as string[] | undefined;
    if (forEachPlayerIds) {
      currentState = executeForEachPlayer(
        currentState,
        pending.remainingSteps,
        pending.context as EffectExecutionContext,
        forEachPlayerIds,
      ).state;
      continue;
    }
    const res = executeSequence(
      currentState,
      pending.remainingSteps,
      pending.context as EffectExecutionContext,
      {
        prevResult: pending.previousResult as StepResolutionResult,
        stepResultsMap,
        onomatopoeias: pending.onomatopoeias,
        anyStepMutated: pending.anyStepMutated,
      },
    );
    currentState = res.state;
    if ((currentState.pendingSequences?.length ?? 0) <= pendingBefore) {
      finishLabelledAttack(currentState, pending.context as EffectExecutionContext);
    }
  }
  return currentState;
}

/** Player ids in player order: the first player, then clockwise (RR v1.8 "Player Order"). */
function playerIdsInOrder(state: GameState): string[] {
  const count = state.players.length;
  const first = state.firstPlayerIndex ?? 0;
  return state.players.map((_, i) => state.players[(first + i) % count].id);
}

/**
 * Resolves a step list once per player, in the given order ("each player ... that player",
 * ability `forEachPlayer`, #220). Each pass starts without the results of the previous one, so
 * `previousResult` and `discardedCards` belong to one player. When a pass opens a prompt, the
 * players not yet resolved wait in a pending entry placed beneath the rest of that pass.
 */
function executeForEachPlayer(
  state: GameState,
  steps: AbilityStep[],
  context: EffectExecutionContext,
  playerIds: string[],
): EffectResult {
  let currentState = state;
  let anyStepMutated = false;
  for (let i = 0; i < playerIds.length; i++) {
    const pendingBefore = currentState.pendingSequences?.length ?? 0;
    const promptsBefore = currentState.pendingDecisionQueue?.length ?? 0;
    const res = executeSequence(currentState, steps, {
      ...context,
      playerId: playerIds[i],
      targetPlayerId: undefined,
      chosenTargetInstanceId: undefined,
      previousResult: undefined,
      discardedCards: undefined,
    });
    currentState = res.state;
    anyStepMutated = anyStepMutated || Boolean(res.mutatedState);
    if (!res.success) {
      return {
        state: currentState,
        success: false,
        error: res.error,
        mutatedState: anyStepMutated,
      };
    }

    const remaining = playerIds.slice(i + 1);
    const paused = (currentState.pendingDecisionQueue?.length ?? 0) > promptsBefore;
    if (paused && remaining.length > 0) {
      currentState.pendingSequences ??= [];
      currentState.pendingSequences.splice(pendingBefore, 0, {
        remainingSteps: steps,
        context: { ...context, forEachPlayerIds: remaining },
      });
      break;
    }
  }
  return {
    state: currentState,
    success: true,
    mutatedState: anyStepMutated,
    onomatopoeia: 'EACH PLAYER RESOLVED!',
  };
}

/**
 * Writes an `engine.stepError` log entry for a step that failed with an error (#225). The engine
 * always records it; the UI shows it in Dev Mode only.
 */
function logStepError(
  state: GameState,
  step: AbilityStep,
  error: string,
  context: EffectExecutionContext,
): void {
  const cardCode = context.sourceCardInstance?.card.code;
  state.log.push({
    id: `log_${Date.now()}_step_error_${state.log.length}`,
    timestamp: Date.now(),
    round: state.roundNumber,
    phase: state.phase,
    category: 'ability',
    key: 'engine.stepError',
    params: { effect: step.effect, error, ...(cardCode ? { card: cardCode } : {}) },
    text: `${cardCode ? `${cardCode} ` : ''}${step.effect} failed: ${error}`,
  });
}

/**
 * Executes a declarative sequence of sub-action steps.
 */
export function executeSequence(
  state: GameState,
  steps: AbilityStep[],
  context: EffectExecutionContext,
  resumeState?: {
    prevResult?: StepResolutionResult;
    stepResultsMap?: Map<string, StepResolutionResult>;
    onomatopoeias?: string[];
    anyStepMutated?: boolean;
  },
): EffectResult {
  let currentState = state;
  let prevResult: StepResolutionResult | undefined =
    resumeState?.prevResult ?? context.previousResult;
  let anyStepMutated = resumeState?.anyStepMutated ?? false;
  const stepResultsMap = resumeState?.stepResultsMap ?? new Map<string, StepResolutionResult>();
  const onomatopoeias: string[] = resumeState?.onomatopoeias ? [...resumeState.onomatopoeias] : [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const shouldRun = shouldExecuteStep(
      step.gate,
      prevResult,
      currentState,
      step,
      context,
      stepResultsMap,
    );
    if (!shouldRun) {
      if (step.id) {
        stepResultsMap.set(step.id, {
          success: false,
          mutatedState: false,
          conditionMet: false,
        });
      }
      continue;
    }

    const effectParams = getStepEffectParams(step);
    const gateParams = getStepGateParams(step);
    const normalizedStep: AbilityStep = {
      ...step,
      effectParams,
      gateParams,
    };

    const isDistinctFromPrevious =
      step.distinctFrom === 'PREVIOUS_TARGET' || effectParams.distinctFrom === 'PREVIOUS_TARGET';

    const stepContext: EffectExecutionContext = {
      ...context,
      sourceCardInstance: (step as any).sourceCardInstance ?? context.sourceCardInstance,
      isFinalStep:
        (step as any).isFinalStep ?? (i === steps.length - 1 ? context.isFinalStep : false),
      previousResult: prevResult,
      distinctFromId: isDistinctFromPrevious
        ? prevResult?.targetId || context.chosenTargetInstanceId
        : context.distinctFromId,
      chosenTargetInstanceId: isDistinctFromPrevious
        ? undefined
        : effectParams.target === 'PREVIOUS_TARGET'
          ? (prevResult?.targetId ?? context.chosenTargetInstanceId)
          : context.chosenTargetInstanceId,
    };

    const promptsBefore = currentState.pendingDecisionQueue?.length ?? 0;
    const res = executeStep(currentState, normalizedStep, stepContext);
    currentState = res.state;

    if (res.discardedCards) {
      context.discardedCards = res.discardedCards;
    }

    // Propagate mutated context fields back to sequence context
    if (stepContext.remainingInterceptedValue !== undefined) {
      context.remainingInterceptedValue = stepContext.remainingInterceptedValue;
    }
    if (stepContext.threatAmount !== undefined) {
      context.threatAmount = stepContext.threatAmount;
    }
    if (stepContext.damageAmount !== undefined) {
      context.damageAmount = stepContext.damageAmount;
    }
    if (stepContext.attackedEnemy && !context.attackedEnemy) {
      context.attackedEnemy = stepContext.attackedEnemy;
    }

    const stepMutated = res.mutatedState ?? res.success;
    if (stepMutated) {
      anyStepMutated = true;
    }

    // A step that fails with an `error` is malformed data or an unsupported input: report it and
    // stop. A failure without one is an outcome ("did not attack") that later gates may read (#225).
    if (!res.success && res.error) {
      logStepError(currentState, step, res.error, context);
      return {
        state: currentState,
        success: false,
        error: res.error,
        mutatedState: anyStepMutated,
      };
    }

    prevResult = {
      success: res.success,
      mutatedState: stepMutated,
      value: res.value,
      conditionMet: res.conditionMet,
      targetId:
        res.targetId || res.selectedCardInstanceIds?.[0] || stepContext.chosenTargetInstanceId,
      discardedCards: res.discardedCards ?? prevResult?.discardedCards,
    };

    if (step.id) {
      stepResultsMap.set(step.id, prevResult);
    }

    if (res.onomatopoeia) {
      onomatopoeias.push(res.onomatopoeia);
    }

    // Check if this step enqueued a decision prompt that pauses execution of subsequent steps (#248)
    const promptsAfter = currentState.pendingDecisionQueue?.length ?? 0;
    if (promptsAfter > promptsBefore && i + 1 < steps.length) {
      pushPendingSequence(currentState, {
        remainingSteps: steps.slice(i + 1),
        context: {
          ...context,
          previousResult: prevResult,
        },
        previousResult: prevResult,
        stepResultsMap: Object.fromEntries(stepResultsMap.entries()),
        onomatopoeias,
        anyStepMutated,
      });

      return {
        state: currentState,
        success: true,
        mutatedState: anyStepMutated,
        value: prevResult?.value,
        conditionMet: prevResult?.conditionMet,
        onomatopoeia: onomatopoeias.length > 0 ? onomatopoeias.join(' ➔ ') : 'SEQUENCE PAUSED',
      };
    }
  }

  return {
    state: currentState,
    success: true,
    mutatedState: anyStepMutated,
    value: prevResult?.value,
    conditionMet: prevResult?.conditionMet,
    onomatopoeia: onomatopoeias.length > 0 ? onomatopoeias.join(' ➔ ') : 'SEQUENCE RESOLVED!',
  };
}

function recordAttackedEnemy(
  context: EffectExecutionContext,
  targetType: 'villain' | 'minion',
  instanceId: string,
): void {
  if (context.labelledAttack && !context.attackedEnemy) {
    context.attackedEnemy = { targetType, instanceId };
  }
}

/**
 * After a labelled "(attack)" ability has fully resolved: ATTACK_RESOLVED for the attacked enemy,
 * once, as a basic attack does ("after your hero attacks" Responses).
 */
function finishLabelledAttack(state: GameState, context: EffectExecutionContext): void {
  const enemy = context.attackedEnemy;
  if (!context.labelledAttack || !enemy || context.attackResolvedDispatched) return;
  context.attackResolvedDispatched = true;
  dispatchTrigger(
    state,
    'ATTACK_RESOLVED',
    enemy.targetType === 'villain'
      ? { targetPlayerId: context.playerId, targetType: 'villain' }
      : {
          targetPlayerId: context.playerId,
          targetType: 'minion',
          targetInstanceId: enemy.instanceId,
        },
  );
}

/**
 * Executes a declarative effect or ability on the GameState.
 */
export function executeEffect(
  state: GameState,
  abilityOrStep: CardAbility | AbilityStep,
  context: EffectExecutionContext,
): EffectResult {
  // Normalize interceptedValue from legacy / caller-provided threatAmount or damageAmount
  if (context.interceptedValue === undefined) {
    context.interceptedValue = context.threatAmount ?? context.damageAmount;
  }

  // Handle ability cost (e.g. discardSelf on in-play upgrades/attachments)
  if (
    'cost' in abilityOrStep &&
    (abilityOrStep as CardAbility).cost?.discardSelf &&
    context.sourceCardInstance
  ) {
    const cardToDiscard = context.sourceCardInstance;
    // Snapshot source card's pre-discard transient state for ability resolution (RR v1.8 p. 15, e.g. Energy Channel 01018)
    context.sourceCardInstance = {
      ...cardToDiscard,
      tokens: { ...(cardToDiscard.tokens || {}) },
      counters: { ...(cardToDiscard.counters || {}) },
      activeStatModifiers: [...(cardToDiscard.activeStatModifiers || [])],
    };
    discardCardInstance(state, cardToDiscard, context.playerId);
  }

  if (
    'steps' in abilityOrStep &&
    Array.isArray(abilityOrStep.steps) &&
    abilityOrStep.steps.length > 0
  ) {
    if ((abilityOrStep as CardAbility).timing) {
      context.ability = abilityOrStep as CardAbility;
    }
    if ((abilityOrStep as CardAbility).forEachPlayer) {
      return executeForEachPlayer(state, abilityOrStep.steps, context, playerIdsInOrder(state));
    }
    if ((abilityOrStep as CardAbility).labels?.includes('ATTACK')) {
      // An "(attack)" ability is one attack by the player's identity (RR v1.8 glossary L)
      const attackContext: EffectExecutionContext = {
        ...context,
        isAttack: true,
        labelledAttack: true,
      };
      const pendingBefore = state.pendingSequences?.length ?? 0;
      const attackRes = executeSequence(state, abilityOrStep.steps, attackContext);
      if ((attackRes.state.pendingSequences?.length ?? 0) <= pendingBefore) {
        finishLabelledAttack(attackRes.state, attackContext);
      }
      return attackRes;
    }
    return executeSequence(state, abilityOrStep.steps, context);
  }

  if (
    'sequence' in abilityOrStep &&
    Array.isArray((abilityOrStep as any).sequence) &&
    (abilityOrStep as any).sequence.length > 0
  ) {
    if ((abilityOrStep as CardAbility).timing) {
      context.ability = abilityOrStep as CardAbility;
    }
    return executeSequence(state, (abilityOrStep as any).sequence, context);
  }

  if ('effect' in abilityOrStep && abilityOrStep.effect) {
    return executeStep(state, abilityOrStep as AbilityStep, context);
  }

  return { state, success: true, onomatopoeia: 'RESOLVED!' };
}

/**
 * Universal DISCARD Primitive Handler (RR v1.8 p. 10, Issue #66)
 * Handles card attrition/removal across all valid game zones (hand, deck, encounter deck, tableau, host, self, cards under host).
 */
export function executeDiscard(
  state: GameState,
  step: AbilityStep,
  context: EffectExecutionContext,
): EffectResult {
  const player = state.players.find((p) => p.id === context.playerId);
  if (!player) return { state, success: false, error: 'Player not found' };

  const params = getStepEffectParams(step);
  const source = (params.source as string) || 'HAND';
  const rawCount = params.count;
  const isCountAll = rawCount === 'ALL';
  const count = typeof rawCount === 'number' ? rawCount : 1;
  const mode =
    (params.mode as string) ||
    (source === 'DECK' || source === 'ENCOUNTER_DECK' ? 'TOP' : 'CHOSEN');
  const fallback = params.fallback as string | undefined;
  const filter = (params.filter || step.filter) as any;

  // 1. DISCARD FROM HAND
  if (source === 'HAND') {
    const resolved = resolvePlayerTargets(state, params.target as any, context);
    const targetPlayers = resolved.length > 0 ? resolved : [player];
    const isRandom = mode === 'RANDOM';
    const discardedCards: CardInstance[] = [];

    for (const targetPlayer of targetPlayers) {
      const candidates = filter
        ? targetPlayer.hand.filter((c) => matchCardFilter(c.card, filter, targetPlayer))
        : [...targetPlayer.hand];
      const toDiscardCount = isCountAll ? candidates.length : Math.min(count, candidates.length);
      const chosen: CardInstance[] = [];
      for (let i = 0; i < toDiscardCount; i++) {
        const idx = isRandom ? Math.floor(Math.random() * candidates.length) : 0;
        chosen.push(...candidates.splice(idx, 1));
      }
      if (chosen.length === 0) continue;

      for (const discarded of chosen) {
        const handIdx = targetPlayer.hand.indexOf(discarded);
        targetPlayer.hand.splice(handIdx, 1);
        targetPlayer.discard.push(discarded);
        discardedCards.push(discarded);
        dispatchTrigger(state, 'CARD_DISCARDED', {
          targetPlayerId: targetPlayer.id,
          sourceInstanceId: discarded.instanceId,
          triggerChain: context.triggerChain,
        });
      }
      state.log.push({
        id: `log_${Date.now()}_discard_hand_${targetPlayer.id}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        category: 'combat',
        key: 'card.discarded.fromHand',
        params: {
          who: targetPlayer.name,
          player: targetPlayer.name,
          count: chosen.length,
          source: 'hand',
          cards: chosen.map((c) => c.card.name).join(', '),
        },
        onomatopoeia: isRandom ? 'RANDOM DISCARD!' : `DISCARDED ${chosen.length} CARDS!`,
      });
    }

    const discardedCount = discardedCards.length;
    return {
      state,
      success: true,
      mutatedState: discardedCount > 0,
      value: discardedCount,
      discardedCards,
      onomatopoeia: isRandom ? 'RANDOM DISCARD!' : `DISCARDED ${discardedCount} CARDS!`,
    };
  }

  // 2. DISCARD FROM PLAYER DECK
  if (source === 'DECK') {
    let discardedCount = 0;
    const discardedCards: CardInstance[] = [];
    const addedToHandCards: CardInstance[] = [];
    const matchingDestination = params.matchingDestination as string | undefined;
    for (let i = 0; i < count; i++) {
      // RR v1.8 "Player Deck": a deck that empties while discarding is reset, but no further card
      // is discarded from the new deck.
      if (i > 0 && player.deck.length === 0) {
        exhaustPlayerDeck(state, player.id);
        break;
      }
      const card = drawPlayerCard(state, player.id);
      if (card) {
        if (matchingDestination && filter && matchCardFilter(card.card, filter, player)) {
          if (matchingDestination === 'HAND') {
            player.hand.push(card);
            addedToHandCards.push(card);
          } else if (matchingDestination === 'PLAY') {
            player.tableau.push(card);
          } else {
            player.discard.push(card);
            discardedCards.push(card);
          }
        } else {
          player.discard.push(card);
          discardedCards.push(card);
        }
        discardedCount++;
        dispatchTrigger(state, 'CARD_DISCARDED', {
          targetPlayerId: player.id,
          sourceInstanceId: card.instanceId,
          triggerChain: context.triggerChain,
        });
      }
    }
    if (discardedCards.length > 0) {
      state.log.push({
        id: `log_${Date.now()}_discard_deck`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        category: 'combat',
        key: 'card.discarded.fromDeck',
        params: {
          who: player.name,
          player: player.name,
          count: discardedCards.length,
          source: 'deck',
          cards: discardedCards.map((c) => c.card.name).join(', '),
        },
        onomatopoeia: `DISCARDED ${discardedCards.length} CARDS!`,
      });
    }
    for (const card of addedToHandCards) {
      state.log.push({
        id: `log_${Date.now()}_black_cat_${card.instanceId}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        category: 'ability',
        key: 'black_cat.fetch',
        params: {
          who: player.name,
          player: player.name,
          card: card.card.name,
        },
        onomatopoeia: 'RETRIEVED!',
      });
    }
    return {
      state,
      success: true,
      mutatedState: discardedCount > 0,
      value: discardedCount,
      discardedCards,
      onomatopoeia: `DISCARDED ${discardedCount} CARDS!`,
    };
  }

  // 3. DISCARD FROM ENCOUNTER DECK
  if (source === 'ENCOUNTER_DECK') {
    if (mode === 'UNTIL_MATCH') {
      // "Discard cards from the top of the encounter deck until <match>" (RR v1.8 glossary
      // "Encounter Deck"): stops at the match, or when the deck is emptied (the effect is then
      // fulfilled and the deck is reset; it does not continue into the new deck).
      const untilFilter = params.untilFilter as any;
      if (!untilFilter) {
        return { state, success: false, error: 'DISCARD UNTIL_MATCH requires untilFilter' };
      }
      const matchingDestination = (params.matchingDestination as string | undefined) ?? 'DISCARD';
      if (matchingDestination !== 'DISCARD' && matchingDestination !== 'REVEAL') {
        return {
          state,
          success: false,
          error: `DISCARD from ENCOUNTER_DECK does not support matchingDestination ${matchingDestination}`,
        };
      }
      const { found, discarded } = discardFromEncounterDeckUntil(state, (c) =>
        matchesCardFilter(c.card, untilFilter, { player, state }),
      );
      if (found && matchingDestination === 'DISCARD') {
        state.encounterDiscard.push(found);
      }
      if (discarded.length > 0) {
        state.log.push({
          id: `log_${Date.now()}_discard_encounter_until`,
          timestamp: Date.now(),
          round: state.roundNumber,
          phase: state.phase,
          category: 'combat',
          key: 'card.discarded.fromDeck',
          params: {
            who: 'Encounter',
            count: discarded.length,
            source: 'encounter deck',
            cards: discarded.map((c) => c.card.name).join(', '),
          },
          onomatopoeia: `DISCARDED ${discarded.length} ENCOUNTER CARDS!`,
        });
      }
      if (found && matchingDestination === 'REVEAL') {
        // The player resolving the ability reveals the matching card (RR v1.8 glossary "Reveal").
        resolveActiveEncounterCardAfterInterrupt(state, found, player, false);
      }
      return {
        state,
        success: true,
        mutatedState: discarded.length > 0,
        value: discarded.length,
        discardedCards: discarded,
        onomatopoeia: `DISCARDED ${discarded.length} ENCOUNTER CARDS!`,
      };
    }
    let discardedCount = 0;
    const discardedCards: CardInstance[] = [];
    for (let i = 0; i < count; i++) {
      const card = drawEncounterCard(state);
      if (card) {
        state.encounterDiscard.push(card);
        discardedCards.push(card);
        discardedCount++;
      }
    }
    if (discardedCount > 0) {
      state.log.push({
        id: `log_${Date.now()}_discard_encounter`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        category: 'combat',
        key: 'card.discarded.fromDeck',
        params: {
          who: 'Encounter',
          count: discardedCount,
          source: 'encounter deck',
          cards: discardedCards.map((c) => c.card.name).join(', '),
        },
        onomatopoeia: `DISCARDED ${discardedCount} ENCOUNTER CARDS!`,
      });
    }
    return {
      state,
      success: true,
      mutatedState: discardedCount > 0,
      value: discardedCount,
      discardedCards,
      onomatopoeia: `DISCARDED ${discardedCount} ENCOUNTER CARDS!`,
    };
  }

  // 4. DISCARD FROM TABLEAU
  if (source === 'TABLEAU') {
    const targetInstanceId = (params.targetInstanceId || context.chosenTargetInstanceId) as
      string | undefined;
    if (targetInstanceId) {
      const targetCard = player.tableau.find((c) => c.instanceId === targetInstanceId);
      if (targetCard) {
        discardCardInstance(state, targetCard, player.id);
        state.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          round: state.roundNumber,
          phase: state.phase,
          category: 'combat',
          key: 'player.tableau.discarded',
          params: { player: player.name, card: targetCard.card.name },
          onomatopoeia: 'TABLEAU DISCARDED!',
        });
        return {
          state,
          success: true,
          mutatedState: true,
          onomatopoeia: `DISCARDED ${targetCard.card.name.toUpperCase()}!`,
        };
      }
      return { state, success: false, error: 'Target card not found in tableau' };
    }

    const matchingCards = player.tableau.filter(
      (inst) => !filter || matchesCardFilter(inst.card, filter, { player, state }),
    );

    if (matchingCards.length === 0) {
      if (fallback === 'SURGE') {
        dealSurgeCard(state, player, context.sourceCardInstance?.card.name);
        return { state, success: true, mutatedState: true, onomatopoeia: 'SURGE!' };
      }
      return { state, success: true, mutatedState: false };
    }

    if (matchingCards.length === 1) {
      const targetCard = matchingCards[0];
      discardCardInstance(state, targetCard, player.id);
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        category: 'combat',
        key: 'player.tableau.discarded',
        params: { player: player.name, card: targetCard.card.name },
        onomatopoeia: 'TABLEAU DISCARDED!',
      });
      return {
        state,
        success: true,
        mutatedState: true,
        onomatopoeia: `DISCARDED ${targetCard.card.name.toUpperCase()}!`,
      };
    }

    const options: DecisionPromptOption[] = matchingCards.map((c) => ({
      id: c.instanceId,
      label: c.card.name,
      cardCode: c.card.code,
      description: c.card.text || `Discard ${c.card.name} from your tableau`,
      effect: 'DISCARD',
      params: { source: 'TABLEAU', targetInstanceId: c.instanceId },
    }));

    enqueueDecisionPrompt(state, {
      promptId: `prompt_discard_tableau_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      playerId: player.id,
      title: 'Discard Upgrade or Support',
      description: 'Choose an upgrade or support you control to discard:',
      sourceCardName: context.sourceCardInstance?.card.name || 'Caught Off Guard',
      sourceCardCode: context.sourceCardInstance?.card.code,
      isVoluntary: false,
      options,
    });

    return {
      state,
      success: true,
      mutatedState: true,
      onomatopoeia: 'CHOOSE CARD TO DISCARD!',
    };
  }

  // 5. DISCARD SELF
  if (source === 'SELF') {
    const cardInst = context.sourceCardInstance;
    if (cardInst) {
      discardCardInstance(state, cardInst, player.id);
      return {
        state,
        success: true,
        mutatedState: true,
        discardedCards: [cardInst],
        onomatopoeia: `${cardInst.card.name.toUpperCase()} DISCARDED!`,
      };
    }
    return { state, success: true };
  }

  // 6. DISCARD FROM HOST (ATTACHMENT)
  if (source === 'HOST') {
    if (context.sourceCardInstance) {
      const vIdx = (getActiveVillain(state).attachments || []).indexOf(context.sourceCardInstance);
      if (vIdx !== -1) {
        getActiveVillain(state).attachments.splice(vIdx, 1);
        state.encounterDiscard.push(context.sourceCardInstance);
        return {
          state,
          success: true,
          mutatedState: true,
          onomatopoeia: 'ATTACHMENT DISCARDED!',
        };
      }
      for (const p of state.players) {
        const hIdx = (p.attachments || []).indexOf(context.sourceCardInstance);
        if (hIdx !== -1) {
          p.attachments?.splice(hIdx, 1);
          if (isEncounterCard(context.sourceCardInstance.card)) {
            state.encounterDiscard.push(context.sourceCardInstance);
          } else {
            p.discard.push(context.sourceCardInstance);
          }
          return {
            state,
            success: true,
            mutatedState: true,
            onomatopoeia: 'ATTACHMENT DISCARDED!',
          };
        }
      }
    }
    return { state, success: true };
  }

  // 7. DISCARD CARDS UNDER HOST
  if (source === 'CARDS_UNDER_HOST') {
    const targetHost = (params.target as string) || 'VILLAIN';
    let cardsToDiscard: CardInstance[] = [];

    if (targetHost === 'VILLAIN') {
      cardsToDiscard = getActiveVillain(state).cardsUnderneath || [];
      getActiveVillain(state).cardsUnderneath = [];
    } else if (targetHost === 'MAIN_SCHEME') {
      cardsToDiscard = getActiveMainScheme(state).cardsUnderneath || [];
      getActiveMainScheme(state).cardsUnderneath = [];
    }

    for (const card of cardsToDiscard) {
      if (isEncounterCard(card.card)) {
        state.encounterDiscard.push(card);
      } else {
        const owner = state.players.find((p) => p.id === (card as any).ownerId) || player;
        owner.discard.push(card);
      }
    }

    return {
      state,
      success: true,
      mutatedState: cardsToDiscard.length > 0,
      onomatopoeia: 'CARDS DISCARDED FROM UNDER!',
    };
  }

  return { state, success: true };
}

/**
 * Executes a single declarative ability step primitive on the GameState.
 */
export function executeStep(
  state: GameState,
  step: AbilityStep,
  context: EffectExecutionContext,
): EffectResult {
  const player = state.players.find((p) => p.id === context.playerId);
  if (!player) return { state, success: false, error: 'Player not found' };

  step = {
    ...step,
    effectParams: getStepEffectParams(step),
    gateParams: getStepGateParams(step),
  };

  // "an enemy", "a scheme": the player chooses among the valid targets (#234, RR v1.8 "Target").
  const targetChoice = chooseStepTarget(state, player, step, context);
  if (targetChoice.kind === 'PROMPTED') {
    return { state, success: true, mutatedState: true, onomatopoeia: 'CHOOSE TARGET!' };
  }
  if (targetChoice.kind === 'NO_VALID_TARGET') {
    return { state, success: true, mutatedState: false, value: 0, onomatopoeia: 'NO VALID TARGET' };
  }
  if (targetChoice.kind === 'CHOSEN') {
    step = {
      ...step,
      effectParams: { ...step.effectParams, targetInstanceId: targetChoice.targetInstanceId },
    };
  }

  switch (step.effect) {
    case 'DISCARD':
    case 'DISCARD_CARDS': {
      return executeDiscard(state, step, context);
    }
    case 'DRAW': {
      const rawCount = step.effectParams?.count;
      let count =
        rawCount !== undefined
          ? resolveNumericAmount(rawCount, context, 1, {
              state,
              player,
              sourceCardInstance: context.sourceCardInstance,
              targetInstanceId:
                (step.effectParams?.targetInstanceId as string) || context.chosenTargetInstanceId,
            })
          : undefined;
      if (step.effectParams?.dynamicBonus) {
        const bonus = resolveNumericAmount(step.effectParams.dynamicBonus as any, context, 0, {
          state,
          player,
          sourceCardInstance: context.sourceCardInstance,
          targetInstanceId:
            (step.effectParams?.targetInstanceId as string) || context.chosenTargetInstanceId,
        });
        count = (count ?? 1) + bonus;
      }
      const limit = step.effectParams?.limit as 'HAND_SIZE' | 'PRINTED_HAND_SIZE' | undefined;
      const targetParam = step.effectParams?.target as string | undefined;
      const targetPlayerId =
        (step.effectParams?.targetPlayerId as string) ||
        (step.effectParams?.playerId as string) ||
        (context.chosenTargetInstanceId &&
        state.players.some((p) => p.id === context.chosenTargetInstanceId)
          ? context.chosenTargetInstanceId
          : undefined);

      const getPlayerTargetLimit = (p: PlayerState): number | undefined => {
        if (!limit) return undefined;
        if (limit === 'PRINTED_HAND_SIZE') {
          const isHero = p.currentForm === 'hero';
          return isHero
            ? ((p.hero as any)?.handSize ?? p.activeFormCard.raw?.hand_size ?? 5)
            : ((p.alterEgo as any)?.handSize ?? p.activeFormCard.raw?.hand_size ?? 6);
        }
        // limit === 'HAND_SIZE'
        return getEffectiveHandSize(p, state);
      };

      // If a specific target player was designated (e.g. from decision prompt resolution)
      if (targetPlayerId) {
        const targetP = state.players.find((p) => p.id === targetPlayerId);
        if (targetP) {
          const targetLimit = getPlayerTargetLimit(targetP);
          let drawnForP = 0;
          const drawnCardsForP: CardInstance[] = [];
          while (
            (count === undefined || drawnForP < count) &&
            (targetLimit === undefined || targetP.hand.length < targetLimit)
          ) {
            const drawn = drawPlayerCard(state, targetP.id);
            if (!drawn) break;
            targetP.hand.push(drawn);
            drawnCardsForP.push(drawn);
            drawnForP += 1;
          }
          const drawSource =
            context.sourceCardInstance?.card?.name ||
            (context.ability?.id ? String(context.ability.id) : undefined);
          state.log.push({
            id: `log_${Date.now()}_${targetP.id}`,
            timestamp: Date.now(),
            round: state.roundNumber,
            phase: state.phase,
            key: 'card.effect.drawCards',
            params: {
              who: targetP.name,
              player: targetP.name,
              count: drawnForP,
              handSize: targetP.hand.length,
              cards: drawnCardsForP.map((c: any) => c?.card?.name || c?.name || 'Card').join(', '),
              drawnCards: drawnCardsForP.map((c: any) => c?.card?.name || c?.name || 'Card'),
              ...(targetLimit !== undefined ? { targetLimit } : {}),
              ...(drawSource ? { source: drawSource } : {}),
            },
            onomatopoeia: `DRAW +${drawnForP}!`,
          });
          return {
            state,
            success: true,
            mutatedState: drawnForP > 0,
            value: drawnForP,
            onomatopoeia: `DRAW +${drawnForP}!`,
          };
        }
      }

      // If targeting CHOSEN_PLAYER in multiplayer mode, prompt the player to select the recipient
      if (targetParam === 'CHOSEN_PLAYER' && state.players.length > 1) {
        const effectiveCount = count ?? 1;
        const sourceCardName =
          context.sourceCardInstance?.card.name || player.activeFormCard?.name || 'Ability';
        const promptId = `prompt_${Date.now()}_choose_player`;
        state = enqueueDecisionPrompt(state, {
          promptId,
          playerId: player.id,
          title: 'Choose a Player',
          description: `Choose a player to draw ${effectiveCount} card${effectiveCount > 1 ? 's' : ''}:`,
          sourceCardName,
          options: state.players.map((p) => ({
            id: `draw_${p.id}`,
            label: `${p.name} (${p.hero?.name || 'Hero'})`,
            description: `Give ${effectiveCount} card draw to ${p.name} (Cards in hand: ${p.hand.length})`,
            effect: 'DRAW',
            params: {
              count: rawCount,
              limit,
              targetPlayerId: p.id,
            },
          })),
        });

        state.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          round: state.roundNumber,
          phase: state.phase,
          category: 'ability',
          key: 'decision.prompt.opened',
          params: { player: player.name, promptId, source: sourceCardName },
          onomatopoeia: 'CHOOSE PLAYER!',
        });

        return {
          state,
          success: true,
          onomatopoeia: 'CHOOSE PLAYER!',
        };
      }

      const resolvedPlayers = resolvePlayerTargets(state, targetParam as any, context);
      const targetPlayers = resolvedPlayers.length > 0 ? resolvedPlayers : [player];
      let totalDrawn = 0;

      for (const p of targetPlayers) {
        const targetLimit = getPlayerTargetLimit(p);
        let drawnForP = 0;
        const drawnCardsForP: CardInstance[] = [];
        const maxDraw = count !== undefined ? count : limit ? Infinity : 1;
        while (drawnForP < maxDraw && (targetLimit === undefined || p.hand.length < targetLimit)) {
          const drawn = drawPlayerCard(state, p.id);
          if (!drawn) break;
          p.hand.push(drawn);
          drawnCardsForP.push(drawn);
          drawnForP += 1;
          totalDrawn += 1;
        }
        const drawSource =
          context.sourceCardInstance?.card?.name ||
          (context.ability?.id ? String(context.ability.id) : undefined);
        state.log.push({
          id: `log_${Date.now()}_${p.id}`,
          timestamp: Date.now(),
          round: state.roundNumber,
          phase: state.phase,
          key: 'card.effect.drawCards',
          params: {
            who: p.name,
            player: p.name,
            count: drawnForP,
            handSize: p.hand.length,
            cards: drawnCardsForP.map((c: any) => c?.card?.name || c?.name || 'Card').join(', '),
            drawnCards: drawnCardsForP.map((c: any) => c?.card?.name || c?.name || 'Card'),
            ...(targetLimit !== undefined ? { targetLimit } : {}),
            ...(drawSource ? { source: drawSource } : {}),
          },
          onomatopoeia: `DRAW +${drawnForP}!`,
        });
      }

      const onomatopoeia = `DRAW +${totalDrawn}!`;
      return {
        state,
        success: true,
        mutatedState: totalDrawn > 0,
        value: totalDrawn,
        onomatopoeia,
      };
    }

    case 'DEAL_DAMAGE': {
      let amount = resolveNumericAmount(
        step.effectParams?.amount ?? step.effectParams?.baseAmount,
        context,
        0,
        {
          state,
          player,
          sourceCardInstance: context.sourceCardInstance,
          targetInstanceId:
            (step.effectParams?.targetInstanceId as string) || context.chosenTargetInstanceId,
        },
      );
      if (step.effectParams?.dynamicBonus) {
        const bonus = resolveNumericAmount(step.effectParams.dynamicBonus as any, context, 0, {
          state,
          player,
          sourceCardInstance: context.sourceCardInstance,
          targetInstanceId:
            (step.effectParams?.targetInstanceId as string) || context.chosenTargetInstanceId,
        });
        amount += bonus;
      }
      if (context.isFinalStep && step.effectParams?.finisherBonus) {
        amount += (step.effectParams.finisherBonus as number) || 0;
      }
      const targetParam = step.effectParams?.target as string | undefined;

      const isAttack = Boolean(
        step.effectParams?.isAttack || context.isAttack || context.labelledAttack,
      );
      const hasPiercing = Boolean(
        step.effectParams?.piercing ||
        step.effectParams?.keyword === 'Piercing' ||
        (context.sourceCardInstance?.card as any)?.keywords?.includes('Piercing') ||
        (context.sourceCardInstance?.card.raw as any)?.keywords?.includes('Piercing'),
      );
      const damageOpts: AbilityDamageOptions = {
        // A labelled "(attack)" ability is an attack by the player's identity (#247)
        sourceType: context.labelledAttack ? 'HERO' : undefined,
        sourcePlayerId: player.id,
        sourceCardInstance: context.sourceCardInstance,
        isAttack,
        hasPiercing,
        triggerChain: context.triggerChain,
      };

      if (targetParam === 'ALL_CHARACTERS') {
        // 1. Villain and minions
        state = dealDamageToEnemies(state, amount, state.players, damageOpts);

        // 2. Heroes. A snapshot: a hero eliminated by this damage leaves state.players (#246).
        for (const p of [...state.players]) {
          state = applyAbilityDamage(state, playerTargetRef(p), amount, damageOpts).state;
        }

        // 3. Allies
        for (const p of state.players) {
          for (const ally of [...p.allies].reverse()) {
            state = applyAbilityDamage(state, allyTargetRef(ally, p.id), amount, damageOpts).state;
          }
        }

        const onomatopoeia = `WHAM! ${amount} DAMAGE TO ALL CHARACTERS!`;
        state.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          round: state.roundNumber,
          phase: state.phase,
          key: 'card.effect.dealDamage',
          params: { player: player.name, target: 'all_characters', amount },
          onomatopoeia,
        });

        return { state, success: true, mutatedState: amount > 0, value: amount, onomatopoeia };
      }

      if (targetParam === 'ALL_HEROES_AND_ALLIES') {
        if (context.assignments && typeof context.assignments === 'object') {
          for (const [id, dmg] of Object.entries(context.assignments as Record<string, number>)) {
            if (dmg <= 0) continue;
            state = dealDamageToAllyOrHero(state, id, player, dmg, damageOpts);
          }
        } else if (context.chosenTargetInstanceId) {
          state = dealDamageToAllyOrHero(
            state,
            context.chosenTargetInstanceId,
            player,
            amount,
            damageOpts,
          );
        } else if (
          amount > 0 &&
          (context.interactivePrompt || (state as any).interactivePromptMode)
        ) {
          const targets = compileDistributionTargets(
            state,
            'ALL_HEROES_AND_ALLIES',
            'DAMAGE',
            'REMAINING_HP',
          );
          const config: DistributionPromptConfig = {
            totalBudget: amount,
            effectiveBudget: amount,
            budgetLabel: 'DAMAGE',
            unitSingular: 'DMG',
            unitPlural: 'DMG',
            exactMatchRequired: true,
            canCancel: false,
            allocationDomain: 'DAMAGE',
            targets,
          };
          const prompt: PendingDecisionPrompt = {
            promptId: `explosion_dist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            playerId: player.id,
            title: 'Explosion: Assign Damage',
            description: `Assign ${amount} damage among heroes and allies:`,
            sourceCardName: context.sourceCardInstance?.card.name || 'Explosion',
            sourceCardCode: context.sourceCardInstance?.card.code,
            sourceCardInstanceId: context.sourceCardInstance?.instanceId,
            kind: 'DISTRIBUTE_POINTS',
            distributionConfig: config,
            options: [
              {
                id: 'confirm_distribution',
                label: 'Confirm Assignment',
                effect: 'DISTRIBUTE_POINTS',
              },
            ],
          };
          state = enqueueDistributionPrompt(state, prompt);
          return {
            state,
            success: true,
            mutatedState: true,
            onomatopoeia: 'ASSIGN DAMAGE!',
          };
        } else {
          // Default: Hero takes the assigned damage
          state = applyAbilityDamage(state, playerTargetRef(player), amount, damageOpts).state;
        }

        const onomatopoeia = `EXPLOSION! ${amount} DAMAGE ASSIGNED!`;
        state.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          round: state.roundNumber,
          phase: state.phase,
          key: 'card.effect.dealDamage',
          params: { player: player.name, target: 'all_heroes_and_allies', amount },
          onomatopoeia,
        });

        return {
          state,
          success: true,
          mutatedState: amount > 0,
          value: amount,
          onomatopoeia,
        };
      }

      if (targetParam === 'ALL_ENEMIES') {
        state = dealDamageToEnemies(state, amount, state.players, damageOpts);

        const onomatopoeia = `BOOM! ${amount} DAMAGE TO ALL ENEMIES!`;
        state.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          round: state.roundNumber,
          phase: state.phase,
          key: 'card.effect.dealDamage',
          params: { player: player.name, target: 'all_enemies', amount },
          onomatopoeia,
        });

        return { state, success: true, onomatopoeia };
      }

      if (targetParam === 'ENGAGED_ENEMIES') {
        const targetPlayerParam = step.effectParams?.targetPlayer as string | undefined;
        const chosenPlayerId =
          (step.effectParams?.targetPlayerId as string) ||
          context.targetPlayerId ||
          (targetPlayerParam === 'CHOSEN_PLAYER' && state.players.length > 1
            ? undefined
            : player.id);

        // Multiplayer "choose a player": defer the damage to the selected player's engaged enemies.
        // The amount (including any finisher bonus) is fixed now so resolution is order-independent.
        if (!chosenPlayerId) {
          const sourceCardName =
            context.sourceCardInstance?.card.name || player.activeFormCard?.name || 'Ability';
          const promptId = `prompt_${Date.now()}_choose_player`;
          state = enqueueDecisionPrompt(state, {
            promptId,
            playerId: player.id,
            title: 'Choose a Player',
            description: `Deal ${amount} damage to the villain and each enemy engaged with the chosen player:`,
            sourceCardName,
            options: state.players.map((p) => ({
              id: `engaged_enemies_${p.id}`,
              label: `${p.name} (${p.hero?.name || 'Hero'})`,
              description: `Deal ${amount} damage to the villain and to each enemy engaged with ${p.name} (${(p.engagedMinions || []).length} minion${(p.engagedMinions || []).length === 1 ? '' : 's'})`,
              effect: 'DEAL_DAMAGE',
              params: { amount, target: 'ENGAGED_ENEMIES', targetPlayerId: p.id },
            })),
          });
          state.log.push({
            id: `log_${Date.now()}`,
            timestamp: Date.now(),
            round: state.roundNumber,
            phase: state.phase,
            category: 'ability',
            key: 'decision.prompt.opened',
            params: { player: player.name, promptId, source: sourceCardName },
            onomatopoeia: 'CHOOSE PLAYER!',
          });
          return { state, success: true, onomatopoeia: 'CHOOSE PLAYER!' };
        }

        const chosenPlayer = state.players.find((p) => p.id === chosenPlayerId) || player;
        state = dealDamageToEnemies(state, amount, [chosenPlayer], damageOpts);

        const onomatopoeia = `BOOM! ${amount} DAMAGE TO ${chosenPlayer.name.toUpperCase()}'S ENGAGED ENEMIES!`;
        state.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          round: state.roundNumber,
          phase: state.phase,
          key: 'card.effect.dealDamage',
          params: { player: player.name, target: 'engaged_enemies', amount },
          onomatopoeia,
        });

        return { state, success: true, onomatopoeia };
      }

      const targetType =
        targetParam === 'ALL_HEROES' ||
        targetParam === 'HERO' ||
        targetParam === 'SELF_IDENTITY' ||
        targetParam === 'SELF_HERO' ||
        targetParam === 'IDENTITY' ||
        targetParam === 'SELF'
          ? 'hero'
          : context.chosenTargetType || 'villain';

      if (targetParam === 'SELF_HERO' && player.currentForm !== 'hero') {
        // "Your hero" while in alter-ego form: nothing to damage, never fall back to the alter-ego.
        return { state, success: true, mutatedState: false, value: 0 };
      }

      if (
        targetParam === 'SELF_IDENTITY' ||
        targetParam === 'SELF_HERO' ||
        targetParam === 'IDENTITY' ||
        targetParam === 'SELF'
      ) {
        state = dealDamageToIdentity(state, player, amount, damageOpts);
        return {
          state,
          success: true,
          mutatedState: amount > 0,
          value: amount,
          onomatopoeia: `OUCH! ${amount} DAMAGE!`,
        };
      }

      if (
        targetParam === 'ALL_HEROES' ||
        (targetType === 'hero' && !context.chosenTargetInstanceId)
      ) {
        for (const p of state.players.filter((pl) => pl.currentForm === 'hero')) {
          state = dealDamageToIdentity(state, p, amount, damageOpts);
        }
        return {
          state,
          success: true,
          onomatopoeia: `SHOCK! ${amount} DAMAGE TO HEROES!`,
        };
      }

      // 1. If targetInstanceId is specified, check engaged minions first
      const targetMinionId =
        step.effectParams?.target === 'TRIGGERING_MINION' ||
        step.effectParams?.target === 'TRIGGERING_ENEMY'
          ? context.eventTargetInstanceId || (step.effectParams?.targetInstanceId as string)
          : (step.effectParams?.targetInstanceId as string) || context.chosenTargetInstanceId;

      if (targetMinionId) {
        for (const p of state.players) {
          const minion = p.engagedMinions.find((m) => m.instanceId === targetMinionId);
          if (!minion) continue;

          // Overkill: excess damage over the minion goes to the villain (RR v1.8 glossary O)
          const kickerResource: string | undefined =
            (step.effectParams?.kickerResource as string | undefined) ||
            (step.effectParams?.overkillOnPhysical ? 'physical' : undefined);
          const kickerMet = kickerResource
            ? Boolean(
                context.resourcesSpent?.some((r) => {
                  const lower = String(r).toLowerCase();
                  return lower === kickerResource.toLowerCase() || lower === 'wild';
                }),
              )
            : false;
          const hasConditionalOverkill = Boolean(
            step.effectParams?.overkillOnPhysical || step.effectParams?.overkillOnCondition,
          );
          const hasOverkill = Boolean(
            (hasConditionalOverkill && kickerMet) ||
            step.effectParams?.keyword === 'Overkill' ||
            (!hasConditionalOverkill &&
              ((context.sourceCardInstance?.card as any)?.keywords?.includes('Overkill') ||
                (context.sourceCardInstance?.card.raw as any)?.keywords?.includes('Overkill'))),
          );

          const minionHp = (minion.card as MinionCard).health || 1;
          const damageBefore = minion.tokens?.damage || 0;
          const damageRes = applyAbilityDamage(
            state,
            minionTargetRef(minion, p.id),
            amount,
            damageOpts,
            { hasOverkill },
          );
          state = damageRes.state;
          const res = damageRes.result;
          recordAttackedEnemy(context, 'minion', minion.instanceId);

          if (res.toughRemoved && res.damageTaken === 0) {
            const onomatopoeia = 'CLANG!';
            state.log.push({
              id: `log_${Date.now()}`,
              timestamp: Date.now(),
              round: state.roundNumber,
              phase: state.phase,
              key: 'card.effect.dealDamage',
              params: {
                player: player.name,
                target: minion.card.name,
                amount: 0,
                toughAbsorbed: true,
              },
              onomatopoeia,
            });
            return { state, success: true, onomatopoeia };
          }

          const onomatopoeia = res.targetDefeated ? 'SMASH! MINION DEFEATED!' : 'WHAM!';
          state.log.push({
            id: `log_${Date.now()}`,
            timestamp: Date.now(),
            round: state.roundNumber,
            phase: state.phase,
            key: 'card.effect.dealDamage',
            params: {
              player: player.name,
              target: minion.card.name,
              amount,
              ...(res.targetDefeated
                ? { defeated: true }
                : { remainingHealth: minionHp - damageBefore - res.damageTaken }),
            },
            onomatopoeia,
          });

          let conditionMet: boolean | undefined;
          let resValue: number = amount;
          if (step.condition === 'EXCESS_DAMAGE_DEALT') {
            conditionMet = res.excessDamage > 0;
            resValue = res.excessDamage;
          } else if (step.condition === 'TARGET_DEFEATED') {
            conditionMet = res.targetDefeated;
          }

          return {
            state,
            success: true,
            mutatedState: true,
            value: resValue,
            conditionMet,
            onomatopoeia,
          };
        }
      }

      // 2. Default: Deal damage to Villain
      const villain = getActiveVillain(state);
      const damageRes = applyAbilityDamage(state, villainTargetRef(villain), amount, damageOpts);
      recordAttackedEnemy(context, 'villain', villain.instanceId || 'villain');

      state = damageRes.state;
      const onomatopoeia = damageRes.result.onomatopoeia || `KAPOW! ${amount} DAMAGE!`;

      return {
        state,
        success: true,
        onomatopoeia,
      };
    }

    case 'DISTRIBUTE_AMOUNT': {
      const stepParams = getStepEffectParams(step);
      const budget = resolveNumericAmount(stepParams.budget ?? stepParams.amount ?? 0, context, 0, {
        state,
        player,
        sourceCardInstance: context.sourceCardInstance,
        targetInstanceId: (stepParams.targetInstanceId as string) || context.chosenTargetInstanceId,
      });
      const allocationDomain = (stepParams.allocationDomain as any) || 'DAMAGE';
      const targetScope =
        (stepParams.targetScope as string) ||
        (stepParams.target as string) ||
        'ALL_HEROES_AND_ALLIES';
      const capRule = (stepParams.capRule as string) || 'REMAINING_HP';
      const canCancel = Boolean(stepParams.canCancel);
      const exactMatchRequired = stepParams.exactMatchRequired !== false;

      // 1. If assignments already provided, execute immediately
      if (context.assignments && typeof context.assignments === 'object') {
        const assignments = context.assignments;
        for (const [targetId, amount] of Object.entries(assignments)) {
          if (amount <= 0) continue;

          if (allocationDomain === 'DAMAGE') {
            let ally: CardInstance | undefined;
            let allyController: PlayerState | undefined;
            for (const p of state.players) {
              const found = p.allies.find((a) => a.instanceId === targetId);
              if (found) {
                ally = found;
                allyController = p;
                break;
              }
            }

            if (ally && allyController) {
              const allyToughIdx = (ally.statusCards || []).indexOf(StatusCard.TOUGH);
              if (allyToughIdx !== -1) {
                ally.statusCards!.splice(allyToughIdx, 1);
              } else {
                const currentDmg = ally.tokens?.damage || 0;
                const newDmg = currentDmg + amount;
                const allyHp = (ally.card as any).health || 1;
                if (newDmg >= allyHp) {
                  const idx = allyController.allies.indexOf(ally);
                  allyController.allies.splice(idx, 1);
                  processHostDefeated(state, ally, { player: allyController });
                  dispatchTrigger(state, 'CHARACTER_DEFEATED', {
                    targetPlayerId: allyController.id,
                    targetInstanceId: ally.instanceId,
                    targetType: 'ally',
                  });
                  const owner =
                    (ally.ownerId
                      ? state.players.find((pl) => pl.id === ally.ownerId)
                      : undefined) || allyController;
                  owner.discard.push(ally);
                } else {
                  ally.tokens = { ...ally.tokens, damage: newDmg };
                }
              }
            } else {
              const targetPlayer =
                state.players.find(
                  (pl) =>
                    pl.id === targetId ||
                    pl.activeFormCard?.code === targetId ||
                    pl.hero?.code === targetId,
                ) || (targetId === player.id ? player : undefined);
              // A chosen villain is resolved by id so any villain in play can be targeted.
              const targetVillain =
                targetId === 'villain' ? getActiveVillain(state) : getVillainById(state, targetId);

              if (targetPlayer) {
                state = dealDistributedDamageToPlayer(
                  state,
                  targetPlayer,
                  amount,
                  context.sourceCardInstance,
                );
              } else if (targetVillain) {
                const vToughIdx = targetVillain.statusCards.indexOf(StatusCard.TOUGH);
                if (vToughIdx !== -1) {
                  targetVillain.statusCards.splice(vToughIdx, 1);
                } else {
                  targetVillain.health = Math.max(0, targetVillain.health - amount);
                  if (targetVillain.health <= 0) {
                    state = handleVillainDefeat(state, targetVillain.instanceId);
                  }
                }
              } else {
                for (const p of state.players) {
                  const mIdx = p.engagedMinions.findIndex((m) => m.instanceId === targetId);
                  if (mIdx !== -1) {
                    const minion = p.engagedMinions[mIdx];
                    const mToughIdx = (minion.statusCards || []).indexOf(StatusCard.TOUGH);
                    if (mToughIdx !== -1) {
                      minion.statusCards!.splice(mToughIdx, 1);
                    } else {
                      const currentDmg = minion.tokens?.damage || 0;
                      const newDmg = currentDmg + amount;
                      const minionHp = (minion.card as MinionCard).health || 1;
                      if (newDmg >= minionHp) {
                        processHostDefeated(state, minion, { player: p });
                        p.engagedMinions.splice(mIdx, 1);
                        moveDefeatedCardToPile(state, minion, state.encounterDiscard);
                        dispatchTrigger(state, 'CHARACTER_DEFEATED', {
                          targetPlayerId: p.id,
                          targetInstanceId: minion.instanceId,
                          targetType: 'minion',
                        });
                      } else {
                        minion.tokens = { ...minion.tokens, damage: newDmg };
                      }
                    }
                    break;
                  }
                }
              }
            }
          } else if (allocationDomain === 'THREAT_REMOVAL') {
            if (
              targetId === 'main_scheme' ||
              targetId === getActiveMainScheme(state)?.instanceId ||
              targetId === getActiveMainScheme(state)?.card?.code
            ) {
              getActiveMainScheme(state).threat = Math.max(
                0,
                getActiveMainScheme(state).threat - amount,
              );
            } else {
              const sideIdx = (state.sideSchemes || []).findIndex(
                (s) => s.instanceId === targetId || s.card.code === targetId,
              );
              if (sideIdx !== -1) {
                const side = state.sideSchemes![sideIdx];
                side.threat = Math.max(0, (side.threat || 0) - amount);
                if (side.threat <= 0) {
                  state.sideSchemes!.splice(sideIdx, 1);
                  dispatchTrigger(state, 'SCHEME_DEFEATED', {
                    targetPlayerId: player.id,
                    targetInstanceId: side.instanceId,
                    entityType: 'SCHEME',
                  });
                  state.encounterDiscard.push(side);
                }
              }
            }
          } else if (allocationDomain === 'HEAL') {
            let ally: CardInstance | undefined;
            for (const p of state.players) {
              const found = p.allies.find((a) => a.instanceId === targetId);
              if (found) {
                ally = found;
                break;
              }
            }
            if (ally) {
              const currentDmg = ally.tokens?.damage || 0;
              ally.tokens = { ...ally.tokens, damage: Math.max(0, currentDmg - amount) };
            } else {
              const targetPlayer = state.players.find(
                (pl) =>
                  pl.id === targetId ||
                  pl.activeFormCard?.code === targetId ||
                  pl.hero?.code === targetId,
              );
              if (targetPlayer) {
                targetPlayer.health = Math.min(
                  targetPlayer.maxHealth,
                  targetPlayer.health + amount,
                );
              }
            }
          } else if (allocationDomain === 'EXHAUST') {
            for (const p of state.players) {
              const c =
                p.tableau.find((i) => i.instanceId === targetId) ||
                p.allies.find((i) => i.instanceId === targetId);
              if (c) c.exhausted = true;
              if (p.id === targetId) p.exhausted = true;
            }
          } else if (allocationDomain === 'COUNTERS') {
            for (const p of state.players) {
              const c =
                p.tableau.find((i) => i.instanceId === targetId) ||
                p.allies.find((i) => i.instanceId === targetId);
              if (c) {
                c.tokens = { ...c.tokens, counters: (c.tokens?.counters || 0) + amount };
              }
            }
          }
        }

        const totalAssigned = Object.values(assignments).reduce((s, n) => s + (n || 0), 0);
        return {
          state,
          success: true,
          mutatedState: totalAssigned > 0,
          value: totalAssigned,
          onomatopoeia: 'DISTRIBUTED!',
        };
      }

      // 2. Interactive Prompt Mode if interactivePrompt requested or interactivePromptMode active
      if (budget > 0 && (context.interactivePrompt || (state as any).interactivePromptMode)) {
        const targets = compileDistributionTargets(state, targetScope, allocationDomain, capRule);
        const unitSingular =
          stepParams.unitSingular ||
          (allocationDomain === 'DAMAGE'
            ? 'DMG'
            : allocationDomain === 'THREAT_REMOVAL'
              ? 'THW'
              : 'PT');
        const unitPlural =
          stepParams.unitPlural ||
          (allocationDomain === 'DAMAGE'
            ? 'DMG'
            : allocationDomain === 'THREAT_REMOVAL'
              ? 'THW'
              : 'PTS');
        const config: DistributionPromptConfig = {
          totalBudget: budget,
          effectiveBudget: budget,
          budgetLabel: stepParams.budgetLabel || `${allocationDomain.replace('_', ' ')}`,
          unitSingular,
          unitPlural,
          exactMatchRequired,
          canCancel,
          allocationDomain,
          targets,
        };

        const prompt: PendingDecisionPrompt = {
          promptId: `dist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          playerId: player.id,
          title: stepParams.promptTitle || `Distribute ${config.budgetLabel}`,
          description:
            stepParams.promptDescription ||
            `Assign ${budget} ${unitPlural} among eligible targets:`,
          sourceCardName: context.sourceCardInstance?.card.name || 'Game Effect',
          sourceCardCode: context.sourceCardInstance?.card.code,
          sourceCardInstanceId: context.sourceCardInstance?.instanceId,
          kind: 'DISTRIBUTE_POINTS',
          distributionConfig: config,
          options: [
            {
              id: 'confirm_distribution',
              label: 'Confirm Assignment',
              effect: 'DISTRIBUTE_POINTS',
            },
          ],
        };

        state = enqueueDistributionPrompt(state, prompt);
        return {
          state,
          success: true,
          mutatedState: true,
          onomatopoeia: 'ASSIGN POINTS!',
        };
      }

      // 3. Headless fallback: deterministic default
      if (allocationDomain === 'DAMAGE') {
        state = dealDistributedDamageToPlayer(state, player, budget, context.sourceCardInstance);
      } else if (allocationDomain === 'THREAT_REMOVAL') {
        if (getActiveMainScheme(state)) {
          getActiveMainScheme(state).threat = Math.max(
            0,
            getActiveMainScheme(state).threat - budget,
          );
        }
      } else if (allocationDomain === 'HEAL') {
        player.health = Math.min(player.maxHealth, player.health + budget);
      }

      return {
        state,
        success: true,
        mutatedState: budget > 0,
        value: budget,
        onomatopoeia: 'POINTS ASSIGNED!',
      };
    }

    case 'HEAL_DAMAGE': {
      const amount =
        step.effectParams?.amount === 'ALL'
          ? Number.MAX_SAFE_INTEGER
          : resolveNumericAmount(step.effectParams?.amount, context, 0, { state, player });
      const target = (step.effectParams?.target as string) || 'SELF';
      let healed = 0;

      const targetCharacters = resolveCharacterTargets(state, target as any, context);
      const charsToHeal = targetCharacters;

      let isFullyHealed = true;
      for (const targetChar of charsToHeal) {
        const ent: any = targetChar.entity;
        if (targetChar.entityType === 'villain') {
          const currentHp = ent.health;
          const maxHp = ent.maxHealth || 100;
          const h = Math.min(maxHp - currentHp, amount);
          ent.health += h;
          healed += h;
          if (ent.health < maxHp) isFullyHealed = false;
        } else if (targetChar.entityType === 'hero' || targetChar.entityType === 'alter_ego') {
          const currentHp = ent.health;
          const maxHp = ent.maxHealth;
          const h = Math.min(maxHp - currentHp, amount);
          ent.health += h;
          healed += h;
          if (ent.health < maxHp) isFullyHealed = false;
        } else if (targetChar.entityType === 'ally') {
          const currentDmg = ent.tokens?.damage || 0;
          const h = Math.min(currentDmg, amount);
          if (ent.tokens) ent.tokens.damage = Math.max(0, currentDmg - h);
          healed += h;
          if ((ent.tokens?.damage || 0) > 0) isFullyHealed = false;
        } else if (targetChar.entityType === 'minion') {
          const currentDmg = ent.tokens?.damage || 0;
          const h = Math.min(currentDmg, amount);
          if (ent.tokens) ent.tokens.damage = Math.max(0, currentDmg - h);
          healed += h;
          if ((ent.tokens?.damage || 0) > 0) isFullyHealed = false;
        }
      }

      const onomatopoeia = `HEAL +${healed} HP!`;
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        key: 'card.effect.heal',
        params: {
          player: player.name,
          target,
          amount: healed,
          health: target === 'VILLAIN' ? getActiveVillain(state).health : player.health,
        },
        onomatopoeia,
      });

      const isFullyHealedResult = isFullyHealed;
      const conditionMet = step.condition === 'FULLY_HEALED' ? isFullyHealedResult : undefined;

      return {
        state,
        success: true,
        mutatedState: healed > 0,
        value: healed,
        conditionMet,
        onomatopoeia,
      };
    }

    case 'PREVENT_DAMAGE': {
      const currentVal =
        context.remainingInterceptedValue ?? context.interceptedValue ?? context.damageAmount ?? 0;

      const hasInterceptContext =
        context.remainingInterceptedValue !== undefined ||
        context.interceptedValue !== undefined ||
        context.damageAmount !== undefined;

      const amountToPrevent =
        step.effectParams?.amount !== undefined
          ? step.effectParams.amount === 'ALL' || step.effectParams.preventAll
            ? currentVal
            : resolveNumericAmount(step.effectParams.amount, context, currentVal)
          : hasInterceptContext
            ? currentVal
            : step.effectParams?.preventAll
              ? 999
              : 3;

      const consumed = hasInterceptContext
        ? Math.min(currentVal, amountToPrevent)
        : amountToPrevent;
      const remaining = hasInterceptContext ? Math.max(0, currentVal - consumed) : 0;

      if (hasInterceptContext) {
        context.remainingInterceptedValue = remaining;
        if (context.damageAmount !== undefined) {
          context.damageAmount = remaining;
        }
      }

      const onomatopoeia = `PREVENTED ${consumed} DAMAGE!`;

      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        category: 'ability',
        key: 'combat.damage.prevented',
        params: {
          player: player.name,
          amount: consumed,
          consumed,
          remaining,
        },
        onomatopoeia,
      });

      return {
        state,
        success: true,
        mutatedState: consumed > 0,
        value: consumed,
        onomatopoeia,
      };
    }

    case 'PREVENT_THREAT': {
      const currentVal =
        context.remainingInterceptedValue ?? context.threatAmount ?? context.interceptedValue ?? 0;

      const hasInterceptContext =
        context.remainingInterceptedValue !== undefined ||
        context.interceptedValue !== undefined ||
        context.threatAmount !== undefined;

      const amountToPrevent =
        step.effectParams?.amount !== undefined
          ? step.effectParams.amount === 'ALL' || step.effectParams.preventAll
            ? currentVal
            : resolveNumericAmount(step.effectParams.amount, context, currentVal)
          : hasInterceptContext
            ? currentVal
            : step.effectParams?.preventAll
              ? 999
              : 1;

      const consumed = hasInterceptContext
        ? Math.min(currentVal, amountToPrevent)
        : amountToPrevent;
      const remaining = hasInterceptContext ? Math.max(0, currentVal - consumed) : 0;

      if (hasInterceptContext) {
        context.remainingInterceptedValue = remaining;
        if (context.threatAmount !== undefined) {
          context.threatAmount = remaining;
        }
      }

      const onomatopoeia =
        context.threatAmount !== undefined
          ? consumed === currentVal
            ? 'THREAT PREVENTED!'
            : `PREVENTED ${consumed} THREAT!`
          : `PREVENTED ${consumed} THREAT!`;

      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        category: 'ability',
        key: 'card.effect.preventThreat',
        params: {
          player: player.name,
          amount: consumed,
          consumed,
          remaining,
        },
        onomatopoeia,
      });

      return {
        state,
        success: true,
        mutatedState: consumed > 0,
        value: consumed,
        onomatopoeia,
      };
    }

    case 'GENERATE_RESOURCE': {
      const fromCardSelector = step.effectParams?.fromCard;
      if (fromCardSelector) {
        const located = locateCard(state, fromCardSelector, {
          player,
          sourceCardInstance: context.sourceCardInstance,
          targetCardInstance: context.targetCardInstance,
        });

        if (!located) {
          return {
            state,
            success: false,
            value: 0,
            onomatopoeia: 'NO CARD LOCATED!',
          };
        }

        const resources = readCardResources(located);
        const resCount = resources.length;
        const resListStr = resources.map((r) => `[${r}]`).join(' ');

        return {
          state,
          success: true,
          mutatedState: true,
          value: resCount,
          onomatopoeia: `+${resCount} ${resListStr || '[wild]'} RESOURCES!`,
        };
      }

      const resourceType = (step.effectParams?.resource as string) || 'wild';
      const amount = (step.effectParams?.amount as number) || 1;

      return {
        state,
        success: true,
        value: amount,
        onomatopoeia: `+${amount} [${resourceType}] RESOURCE!`,
      };
    }

    case 'REMOVE_THREAT': {
      let amount = resolveNumericAmount(
        step.effectParams?.amount ?? step.effectParams?.baseAmount,
        context,
        1,
        { state, player },
      );
      if (step.effectParams?.dynamicBonus) {
        const bonus = resolveNumericAmount(step.effectParams.dynamicBonus as any, context, 0, {
          state,
          player,
          sourceCardInstance: context.sourceCardInstance,
          targetInstanceId:
            (step.effectParams?.targetInstanceId as string) || context.chosenTargetInstanceId,
        });
        amount += bonus;
      }
      if (context.isFinalStep && step.effectParams?.finisherBonus) {
        amount += (step.effectParams.finisherBonus as number) || 0;
      }
      const targetParam =
        (step.effectParams?.target as string) ||
        (step.effectParams?.targetInstanceId ? 'CHOSEN_SCHEME' : undefined) ||
        'MAIN_SCHEME';
      const targetContext: EffectContext = {
        ...context,
        chosenTargetInstanceId:
          (step.effectParams?.targetInstanceId as string) || context.chosenTargetInstanceId,
      };
      let removed = 0;
      let targetSchemeName = getActiveMainScheme(state)?.card?.name || 'Main Scheme';
      let remainingThreat = getActiveMainScheme(state)?.threat || 0;

      const ignoresCrisis = Boolean(
        step.effectParams?.ignoresCrisis || (step as any).ignoresCrisis || context.ignoresCrisis,
      );
      const isPlayerSource = context.sourceCardInstance?.card?.faction !== 'encounter';
      // The main scheme cannot be thwarted by cards while a Crisis icon is in play (RR v1.8 p. 11)
      // or while the resolving player is engaged with a Patrol minion (Patrol keyword).
      const isMainSchemeBlockedByCrisis =
        !ignoresCrisis && isPlayerSource && hasCrisisInPlay(state);
      const isMainSchemeBlockedByPatrol =
        isPlayerSource &&
        (player.engagedMinions || []).some((m) => hasKeyword(m.card, Keyword.PATROL));
      const isMainSchemeBlocked = isMainSchemeBlockedByCrisis || isMainSchemeBlockedByPatrol;
      const mainSchemeBlock = isMainSchemeBlockedByCrisis
        ? { key: 'card.effect.threatBlockedByCrisis', onomatopoeia: 'CRISIS BLOCKS!' }
        : { key: 'card.effect.threatBlockedByPatrol', onomatopoeia: 'PATROL BLOCKS!' };

      let targetSchemes: SchemeTarget[];

      const schemes = resolveSchemeTargets(state, targetParam as any, targetContext);
      if (isMainSchemeBlocked) {
        const nonMainSchemes = schemes.filter(
          (s) =>
            s.entityType !== 'main_scheme' &&
            s.id !== 'main_scheme' &&
            s.id !== getActiveMainScheme(state)?.instanceId &&
            s.id !== getActiveMainScheme(state)?.card?.code,
        );
        if (nonMainSchemes.length === 0) {
          state.log.push({
            id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            timestamp: Date.now(),
            round: state.roundNumber,
            phase: state.phase,
            category: 'ability',
            key: mainSchemeBlock.key,
            params: {
              player: player.name,
              scheme: getActiveMainScheme(state)?.card?.name || 'Main Scheme',
            },
            onomatopoeia: mainSchemeBlock.onomatopoeia,
          });
          return {
            state,
            success: true,
            mutatedState: false,
            value: 0,
            onomatopoeia: mainSchemeBlock.onomatopoeia,
          };
        }
        targetSchemes = nonMainSchemes;
      } else {
        targetSchemes =
          schemes.length > 0
            ? schemes
            : [
                {
                  kind: 'scheme' as const,
                  entityType: 'main_scheme' as const,
                  entity: getActiveMainScheme(state),
                  id: getActiveMainScheme(state).instanceId || 'main_scheme',
                },
              ];
      }

      for (const st of targetSchemes) {
        const isSide =
          st.entityType === 'side_scheme' ||
          (state.sideSchemes || []).some((s) => s.instanceId === st.id || s.card.code === st.id);

        const thwartRes = applyThwart(state, {
          thwarterType: 'CARD_EFFECT',
          thwarterEntity: context.sourceCardInstance,
          playerId: player.id,
          targetType: isSide ? 'side_scheme' : 'main_scheme',
          targetInstanceId: isSide ? st.id : undefined,
          thwartValue: amount,
          ignoresCrisis,
        });

        removed += thwartRes.result.threatRemoved;
        targetSchemeName = thwartRes.result.targetSchemeName || targetSchemeName;
        remainingThreat = thwartRes.result.remainingThreat;
      }

      const onomatopoeia = `-${removed} THREAT!`;
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        key: 'card.effect.removeThreat',
        params: {
          player: player.name,
          amount: removed,
          scheme: targetSchemeName,
          remainingThreat,
        },
        onomatopoeia,
      });

      const conditionMet = step.condition === 'SCHEME_EMPTY' ? remainingThreat === 0 : undefined;

      return {
        state,
        success: true,
        mutatedState: removed > 0,
        value: removed,
        conditionMet,
        onomatopoeia,
        targetId: targetSchemes[0]?.id || targetSchemes[0]?.entity?.instanceId || 'main_scheme',
      };
    }

    case 'ADD_STATUS': {
      let status: StatusCard = StatusCard.STUNNED;
      const statusParam = step.effectParams?.status;
      if (statusParam === 'TOUGH' || statusParam === StatusCard.TOUGH) status = StatusCard.TOUGH;
      if (statusParam === 'CONFUSED' || statusParam === StatusCard.CONFUSED)
        status = StatusCard.CONFUSED;
      if (statusParam === 'STUNNED' || statusParam === StatusCard.STUNNED)
        status = StatusCard.STUNNED;

      let mutatedState = false;
      let alreadyHadStatus = false;
      let isImmune = false;

      // Helper to apply status to a target entity considering Stalwart and Steady
      const applyStatusToEntity = (entity: any) => {
        if (!entity) return;
        if (!entity.statusCards) entity.statusCards = [];

        // Stalwart check (RR v1.8 p. 28)
        if (
          (status === StatusCard.STUNNED || status === StatusCard.CONFUSED) &&
          hasEntityKeyword(entity, 'Stalwart')
        ) {
          isImmune = true;
          return;
        }

        // Steady check (RR v1.8 p. 28)
        const isSteady = hasEntityKeyword(entity, 'Steady');
        const maxLimit =
          isSteady && (status === StatusCard.STUNNED || status === StatusCard.CONFUSED) ? 2 : 1;
        const currentCount = entity.statusCards.filter((s: StatusCard) => s === status).length;

        if (currentCount < maxLimit) {
          entity.statusCards.push(status);
          mutatedState = true;
        } else {
          alreadyHadStatus = true;
        }
      };

      const targetParam = (step.effectParams?.target as string) || 'VILLAIN';
      const targetContext: EffectContext = {
        ...context,
        chosenTargetInstanceId:
          (step.effectParams?.targetInstanceId as string) || context.chosenTargetInstanceId,
      };
      const targetCharacters = resolveCharacterTargets(state, targetParam as any, targetContext);
      for (const targetChar of targetCharacters) {
        applyStatusToEntity(targetChar.entity);
      }

      // Nothing to apply the status to (e.g. the damaged ally has left play): no effect, no log.
      if (targetCharacters.length === 0) {
        return { state, success: true, mutatedState: false, value: 0, conditionMet: false };
      }

      const firstTarget = targetCharacters[0];
      let targetName: string =
        targetParam === 'VILLAIN'
          ? getActiveVillain(state).card.name
          : String(targetParam || 'Villain');
      if (firstTarget) {
        if (firstTarget.entityType === 'villain') {
          targetName = getActiveVillain(state).card.name;
        } else if (firstTarget.entityType === 'hero' || firstTarget.entityType === 'alter_ego') {
          const p = firstTarget.entity as PlayerState;
          targetName = p.hero?.name || p.name;
        } else if ('card' in firstTarget.entity) {
          targetName = (firstTarget.entity as CardInstance).card.name;
        }
      }

      const sourceCardName = context.sourceCardInstance?.card.name;
      const actorName = sourceCardName || player.hero?.name || player.name;
      const actorType =
        context.sourceCardInstance?.card.type === CardType.ALLY
          ? 'ally'
          : context.sourceCardInstance?.card.type === CardType.MINION
            ? 'minion'
            : player.currentForm === 'hero'
              ? 'hero'
              : 'alter_ego';

      const onomatopoeia = isImmune
        ? 'IMMUNE! (STALWART)'
        : mutatedState
          ? status === StatusCard.STUNNED
            ? 'STUNNED!'
            : status === StatusCard.CONFUSED
              ? 'CONFUSED!'
              : 'TOUGH!'
          : `${status} ALREADY APPLIED!`;

      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        actor: {
          name: actorName,
          type: actorType,
        },
        key: 'card.effect.addStatus',
        params: {
          who: actorName,
          card: sourceCardName || 'Card',
          status,
          target: targetName,
          who_is_taking_damage: targetName,
          mutatedState,
          alreadyHadStatus,
          isImmune,
        },
        onomatopoeia,
      });

      let conditionMet: boolean = alreadyHadStatus;
      if (step.condition === 'STATUS_APPLIED') {
        conditionMet = mutatedState;
      } else if (step.condition === 'ALREADY_HAS_STATUS') {
        conditionMet = alreadyHadStatus;
      }

      return {
        state,
        success: true,
        mutatedState,
        value: mutatedState ? 1 : 0,
        conditionMet,
        onomatopoeia,
      };
    }

    case 'REMOVE_STATUS': {
      const requestedStatus = String(step.effectParams?.status || 'ALL');
      const normalizedStatus =
        requestedStatus === 'STUNNED'
          ? StatusCard.STUNNED
          : requestedStatus === 'CONFUSED'
            ? StatusCard.CONFUSED
            : requestedStatus === 'TOUGH'
              ? StatusCard.TOUGH
              : requestedStatus;
      const statuses =
        normalizedStatus === 'ALL'
          ? [StatusCard.STUNNED, StatusCard.CONFUSED, StatusCard.TOUGH]
          : [normalizedStatus as StatusCard];
      const target = String(step.effectParams?.target || 'VILLAIN');
      const targetPlayer =
        state.players.find((candidate) => candidate.id === context.targetPlayerId) || player;
      const targets: any[] = [];
      const resolved = resolveTargets(state, target as any, context);
      for (const r of resolved) {
        targets.push(r.entity);
      }
      if (targets.length === 0 && context.chosenTargetInstanceId) {
        const fallback = resolveEntityByInstanceId(state, context.chosenTargetInstanceId);
        if (fallback) targets.push(fallback.entity);
      }

      let removedCount = 0;
      for (const entity of targets) {
        if (!Array.isArray(entity?.statusCards)) continue;
        const removedStatuses = statuses.filter((status) => entity.statusCards.includes(status));
        const before = entity.statusCards.length;
        entity.statusCards = entity.statusCards.filter(
          (status: StatusCard) => !statuses.includes(status),
        );
        if (removedStatuses.length > 0) {
          removedCount += before - entity.statusCards.length;
          for (const status of removedStatuses) {
            dispatchTrigger(state, 'STATUS_REMOVED', {
              targetPlayerId: targetPlayer.id,
              targetInstanceId: entity.instanceId,
              status,
            });
          }
        }
      }

      return {
        state,
        success: true,
        mutatedState: removedCount > 0,
        value: removedCount,
        conditionMet: step.condition === 'STATUS_APPLIED' ? removedCount > 0 : undefined,
        onomatopoeia: removedCount > 0 ? 'STATUS REMOVED!' : 'NO STATUS TO REMOVE',
      };
    }

    case 'ATTACH_TO_HOST': {
      const targetHost = step.effectParams?.target as string;
      const sourceCard = context.sourceCardInstance;
      if (!sourceCard) return { state, success: true };

      (sourceCard as any).ownerId = context.playerId;

      attachCardToHost(
        state,
        sourceCard,
        targetHost,
        context.chosenTargetInstanceId || context.targetPlayerId || context.playerId,
      );
      return {
        state,
        success: true,
        mutatedState: true,
        onomatopoeia: 'ATTACHED TO HOST!',
      };
    }

    case 'PLACE_CARD_UNDER_HOST': {
      const targetHost = (step.effectParams?.target as string) || 'SELF';
      const sourceCard = context.sourceCardInstance;
      if (!sourceCard) return { state, success: true };

      if (targetHost === 'VILLAIN' || targetHost === 'ENEMY') {
        const villain = getActiveVillain(state);
        if (!villain.cardsUnderneath) villain.cardsUnderneath = [];
        villain.cardsUnderneath.push(sourceCard);
        return {
          state,
          success: true,
          mutatedState: true,
          onomatopoeia: 'PLACED UNDER VILLAIN!',
        };
      } else if (targetHost === 'MAIN_SCHEME' || targetHost === 'SCHEME') {
        const mainScheme = getActiveMainScheme(state);
        if (!mainScheme.cardsUnderneath) mainScheme.cardsUnderneath = [];
        mainScheme.cardsUnderneath.push(sourceCard);
        return {
          state,
          success: true,
          mutatedState: true,
          onomatopoeia: 'PLACED UNDER SCHEME!',
        };
      } else if (targetHost === 'HERO' || targetHost === 'IDENTITY' || targetHost === 'PLAYER') {
        const targetP =
          state.players.find((p) => p.id === (context.targetPlayerId || context.playerId)) ||
          player;
        if (!targetP.cardsUnderneath) targetP.cardsUnderneath = [];
        targetP.cardsUnderneath.push(sourceCard);
        return {
          state,
          success: true,
          mutatedState: true,
          onomatopoeia: 'PLACED UNDER IDENTITY!',
        };
      }
      return { state, success: true, onomatopoeia: 'PLACED UNDER CARD!' };
    }

    case 'ADD_TRAIT': {
      // A CONSTANT ADD_TRAIT is evaluated by the stat calculator. As an effect step it grants the
      // trait to the resolving player's identity for `duration`, or while the source card stays
      // in play when no duration is given (#131).
      const stepParams = getStepEffectParams(step);
      const trait = (stepParams.trait as string | undefined)?.trim();
      if (!trait) return { state, success: false, error: 'ADD_TRAIT requires a trait' };
      const targetParam = (stepParams.target as string) || 'SELF_IDENTITY';
      if (targetParam !== 'SELF_IDENTITY') {
        return {
          state,
          success: false,
          error: `ADD_TRAIT as an effect step supports target SELF_IDENTITY only (got ${targetParam})`,
        };
      }
      const duration = stepParams.duration as 'PHASE' | 'ROUND' | 'TURN' | undefined;
      const sourceInstanceId = context.sourceCardInstance?.instanceId;
      if (!player.activeTraitModifiers) player.activeTraitModifiers = [];
      const alreadyGranted = player.activeTraitModifiers.some(
        (m) =>
          m.trait === trait && m.duration === duration && m.sourceInstanceId === sourceInstanceId,
      );
      if (!alreadyGranted) {
        player.activeTraitModifiers.push({
          trait,
          duration,
          sourceInstanceId,
          sourceCardName: context.sourceCardInstance?.card.name,
          sourceCardCode: context.sourceCardInstance?.card.code,
        });
      }
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        category: 'status',
        key: 'card.effect.addTrait',
        params: { player: player.name, trait, duration: duration ?? 'WHILE_SOURCE_IN_PLAY' },
        onomatopoeia: 'POWER UP!',
      });
      return { state, success: true, mutatedState: true, onomatopoeia: 'POWER UP!' };
    }

    case 'MODIFY_STAT': {
      const stepParams = getStepEffectParams(step);
      const targetParam =
        (stepParams.target as string) || (step.effectParams?.target as string) || 'SELF';
      const duration =
        (stepParams.duration as 'PHASE' | 'ROUND') ||
        (step.effectParams?.duration as 'PHASE' | 'ROUND') ||
        'PHASE';
      const sourceCardName =
        context.sourceCardInstance?.card.name || player.activeFormCard?.name || 'Stat Modifier';
      const sourceCardCode = context.sourceCardInstance?.card.code;

      if (
        targetParam === 'ALL_CONTROLLED_CHARACTERS' ||
        stepParams.atkBonus !== undefined ||
        stepParams.thwBonus !== undefined
      ) {
        const atkBonus =
          (stepParams.atkBonus as number) ||
          (step.effectParams?.atkBonus as number) ||
          (stepParams.stat === 'ATTACK'
            ? resolveNumericAmount(stepParams.amount, context, 0, { state, player })
            : 0) ||
          0;
        const thwBonus =
          (stepParams.thwBonus as number) ||
          (step.effectParams?.thwBonus as number) ||
          (stepParams.stat === 'THWART'
            ? resolveNumericAmount(stepParams.amount, context, 0, { state, player })
            : 0) ||
          0;

        // "Choose a player": the characters that player controls get the bonus
        const chosenPlayerId =
          (stepParams.targetPlayerId as string) ||
          context.targetPlayerId ||
          (stepParams.targetPlayer === 'CHOSEN_PLAYER' && state.players.length > 1
            ? undefined
            : player.id);
        if (!chosenPlayerId) {
          const promptId = `prompt_${Date.now()}_choose_player`;
          state = enqueueDecisionPrompt(state, {
            promptId,
            playerId: player.id,
            title: 'Choose a Player',
            description: 'Choose a player. Each character that player controls gets the bonus:',
            sourceCardName,
            sourceCardCode,
            options: state.players.map((p) => ({
              id: `modify_stat_${p.id}`,
              label: `${p.name} (${p.hero?.name || 'Hero'})`,
              description: `+${atkBonus} ATK / +${thwBonus} THW to ${p.name}'s hero and ${p.allies.length} ally(ies)`,
              effect: 'MODIFY_STAT',
              params: { ...stepParams, targetPlayerId: p.id },
            })),
          });
          state.log.push({
            id: `log_${Date.now()}`,
            timestamp: Date.now(),
            round: state.roundNumber,
            phase: state.phase,
            category: 'ability',
            key: 'decision.prompt.opened',
            params: { player: player.name, promptId, source: sourceCardName },
            onomatopoeia: 'CHOOSE PLAYER!',
          });
          return { state, success: true, onomatopoeia: 'CHOOSE PLAYER!' };
        }
        const recipient = state.players.find((p) => p.id === chosenPlayerId) || player;

        const pushBonuses = (mods: { stat: 'ATTACK' | 'THWART'; amount: number }[], into: any) => {
          if (!into.activeStatModifiers) into.activeStatModifiers = [];
          for (const m of mods) {
            into.activeStatModifiers.push({ ...m, duration, sourceCardName, sourceCardCode });
          }
        };
        const mods: { stat: 'ATTACK' | 'THWART'; amount: number }[] = [];
        if (atkBonus) mods.push({ stat: 'ATTACK', amount: atkBonus });
        if (thwBonus) mods.push({ stat: 'THWART', amount: thwBonus });

        // The recipient's identity (hero or alter-ego) and allies
        pushBonuses(mods, recipient);
        for (const a of recipient.allies) pushBonuses(mods, a);

        return {
          state,
          success: true,
          mutatedState: true,
          onomatopoeia: `+${atkBonus} ATK / +${thwBonus} THW TO ${recipient.name.toUpperCase()}'S CHARACTERS!`,
        };
      }

      if (
        targetParam === 'SELF' ||
        targetParam === 'TRIGGERING_HERO' ||
        targetParam === 'CHOSEN_CHARACTER' ||
        targetParam === 'CHOSEN_ALLY'
      ) {
        const stat = (stepParams.stat as any) || (step.effectParams?.stat as any) || 'ATTACK';
        const amount = (stepParams.amount as number) || (step.effectParams?.amount as number) || 1;

        // Resolve target card instance
        let targetCard = context.sourceCardInstance;
        if (!targetCard && context.sourceCardId) {
          targetCard =
            player.allies.find(
              (a) => a.instanceId === context.sourceCardId || a.card.code === context.sourceCardId,
            ) ||
            player.tableau.find(
              (t) => t.instanceId === context.sourceCardId || t.card.code === context.sourceCardId,
            );
        }

        if (targetCard) {
          if (!targetCard.activeStatModifiers) targetCard.activeStatModifiers = [];
          targetCard.activeStatModifiers.push({
            stat,
            amount,
            duration,
            sourceCardName,
            sourceCardCode,
          });

          return {
            state,
            success: true,
            mutatedState: true,
            onomatopoeia: `+${amount} ${stat}!`,
          };
        } else {
          // If target is player/hero identity
          if (!player.activeStatModifiers) player.activeStatModifiers = [];
          player.activeStatModifiers.push({
            stat,
            amount,
            duration,
            sourceCardName,
            sourceCardCode,
          });

          return {
            state,
            success: true,
            mutatedState: true,
            onomatopoeia: `+${amount} ${stat}!`,
          };
        }
      }

      // These are declarative constant/trigger primitives evaluated dynamically by stat-calculator and combat pipelines
      return { state, success: true };
    }

    case 'GRANT_KEYWORD':
    case 'ATTACHMENT_DAMAGE_SHIELD': {
      // These are declarative constant/trigger primitives evaluated dynamically by stat-calculator and combat pipelines
      return { state, success: true };
    }

    case 'READY': {
      const targetParam = (step.effectParams?.target as string) || 'SELF_IDENTITY';
      let readyTargetName = player.name;

      const readyFilter = (step.effectParams?.filter || step.filter) as
        Record<string, any> | undefined;
      const targets = filterResolvedTargets(
        state,
        resolveTargets(state, targetParam as any, context),
        readyFilter,
        player,
      );
      if (targets.length === 0 && readyFilter) {
        return { state, success: true, mutatedState: false, onomatopoeia: 'NOTHING TO READY' };
      }
      if (targets.length === 0) {
        player.exhausted = false;
        readyTargetName = player.activeFormCard?.name || player.name;
      } else {
        const names: string[] = [];
        for (const t of targets) {
          if (t.kind === 'character') {
            if (t.entityType === 'hero' || t.entityType === 'alter_ego') {
              (t.entity as PlayerState).exhausted = false;
              names.push(
                (t.entity as PlayerState).activeFormCard?.name || (t.entity as PlayerState).name,
              );
            } else if (t.entityType === 'villain') {
              (t.entity as VillainState).exhausted = false;
              names.push((t.entity as VillainState).card?.name || 'Villain');
            } else {
              (t.entity as CardInstance).exhausted = false;
              names.push((t.entity as CardInstance).card?.name || 'Character');
            }
          } else if (t.kind === 'card') {
            t.entity.exhausted = false;
            names.push(t.entity.card?.name || 'Card');
          } else if (t.kind === 'player') {
            t.entity.exhausted = false;
            names.push(t.entity.activeFormCard?.name || t.entity.name);
          }
        }
        readyTargetName = names.join(', ') || player.name;
      }

      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        category: 'ability',
        key: 'card.effect.readyCharacter',
        params: { player: player.name, target: readyTargetName },
        onomatopoeia: 'READY!',
      });
      return {
        state,
        success: true,
        mutatedState: true,
        onomatopoeia: 'READY!',
      };
    }

    case 'CANCEL_ATTACK': {
      if (state.activeAttackContext) {
        (state.activeAttackContext as any).isCancelled = true;
      }
      (context as any).attackCancelled = true;
      const cancelledBy = context.sourceCardInstance?.card.name || 'Ability';
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        category: 'combat',
        key: 'combat.attack.cancelled',
        params: {
          cancelledBy,
        },
        onomatopoeia: 'ATTACK CANCELLED!',
      });
      return {
        state,
        success: true,
        mutatedState: true,
        onomatopoeia: 'ATTACK CANCELLED!',
      };
    }

    case 'EXHAUST': {
      const targetParam = (step.effectParams?.target as string) || 'SELF_IDENTITY';
      let exhaustTargetName = player.name;

      const exhaustFilter = (step.effectParams?.filter || step.filter) as
        Record<string, any> | undefined;
      const targets = filterResolvedTargets(
        state,
        resolveTargets(state, targetParam as any, context),
        exhaustFilter,
        player,
      );
      if (targets.length === 0 && exhaustFilter) {
        // A filter that matches nothing is a no-op, never an identity fallback
        return { state, success: true, mutatedState: false, onomatopoeia: 'NOTHING TO EXHAUST' };
      }
      if (targets.length === 0) {
        player.exhausted = true;
        exhaustTargetName = player.activeFormCard?.name || player.name;
      } else {
        const names: string[] = [];
        for (const t of targets) {
          if (t.kind === 'character') {
            if (t.entityType === 'hero' || t.entityType === 'alter_ego') {
              (t.entity as PlayerState).exhausted = true;
              names.push(
                (t.entity as PlayerState).activeFormCard?.name || (t.entity as PlayerState).name,
              );
            } else if (t.entityType === 'villain') {
              (t.entity as VillainState).exhausted = true;
              names.push((t.entity as VillainState).card?.name || 'Villain');
            } else {
              (t.entity as CardInstance).exhausted = true;
              names.push((t.entity as CardInstance).card?.name || 'Character');
            }
          } else if (t.kind === 'card') {
            t.entity.exhausted = true;
            names.push(t.entity.card?.name || 'Card');
          } else if (t.kind === 'player') {
            t.entity.exhausted = true;
            names.push(t.entity.activeFormCard?.name || t.entity.name);
          }
        }
        exhaustTargetName = names.join(', ') || player.name;
      }

      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        category: 'status',
        key: 'card.state.exhausted',
        params: { card: exhaustTargetName, player: player.name },
        onomatopoeia: 'EXHAUST',
      });
      return {
        state,
        success: true,
        mutatedState: true,
        onomatopoeia: 'EXHAUSTED!',
      };
    }

    case 'GIVE_ADDITIONAL_BOOST_CARD': {
      if (state.activeAttackContext) {
        const extraCard = drawEncounterCard(state);
        if (extraCard) {
          state.activeAttackContext.boostQueue.push(extraCard);
          state.log.push({
            id: `log_${Date.now()}`,
            timestamp: Date.now(),
            round: state.roundNumber,
            phase: state.phase,
            category: 'combat',
            key: 'villain.boost.added',
            params: { card: extraCard.card.name },
            onomatopoeia: 'CHAIN BOOST ADDED!',
          });
        }
      }
      return { state, success: true, onomatopoeia: 'CHAIN BOOST ADDED!' };
    }

    case 'PLAYER_CHOICE': {
      const options = ((step.effectParams?.options as any[]) || []).map((opt: any) => ({ ...opt }));
      const title =
        (step.effectParams?.title as string) ||
        (step.effectParams?.promptTitle as string) ||
        'Choose an Option';
      const description = (step.effectParams?.description as string) || '';
      const sourceCardName = context.sourceCardInstance?.card.name || step.id || 'Card Ability';
      const promptId = `prompt_${Date.now()}_${step.id || 'choice'}`;
      state = enqueueDecisionPrompt(state, {
        promptId,
        playerId: context.playerId || player.id,
        title,
        description,
        sourceCardName,
        sourceCardCode: context.sourceCardInstance?.card.code,
        sourceCardInstanceId: context.sourceCardInstance?.instanceId,
        triggerSourceCard: context.sourceCardInstance?.card,
        options,
        discardedCards: context.discardedCards,
        isVoluntary: (step.effectParams?.isVoluntary as boolean) ?? false,
        completion:
          context.sourceCardInstance?.card.type === CardType.OBLIGATION
            ? 'DISCARD_SOURCE_OBLIGATION'
            : undefined,
      });

      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        category: 'ability',
        key: 'decision.prompt.opened',
        params: { player: player.name, promptId, source: sourceCardName },
        onomatopoeia: 'CHOICE REQUIRED!',
      });

      return { state, success: true, onomatopoeia: 'CHOOSE AN OPTION!' };
    }

    case 'DECLARE_DEFENDER': {
      const defenderType =
        (step.effectParams?.defenderType as 'HERO' | 'ALLY' | 'UNDEFENDED') || 'UNDEFENDED';
      const allyInstanceId = step.effectParams?.allyInstanceId as string | undefined;
      const playerId = (step.effectParams?.playerId as string) || context.playerId || player.id;
      const resState = resolveDefenderDeclaration(state, {
        type: defenderType,
        playerId,
        allyInstanceId,
      });
      return {
        state: resState,
        success: true,
        onomatopoeia: 'DEFENSE RESOLVED!',
      };
    }

    case 'VILLAIN_SCHEMES': {
      executeVillainSchemeAgainstPlayer(state, player);
      return { state, success: true, onomatopoeia: 'VILLAIN SCHEMES!' };
    }

    case 'VILLAIN_ATTACKS': {
      executeVillainAttackAgainstPlayer(state, player);
      return { state, success: true, onomatopoeia: 'VILLAIN ATTACKS!' };
    }

    case 'ENEMY_ATTACKS': {
      // A specific enemy (card code) attacks the resolving player's hero or identity. The result
      // is `success` and `mutatedState` only when the attack happened, so a later step can gate
      // on "if it did not attack" with `IF_FAILED`; `targetId` is the enemy, attacked or not.
      const enemyCode = step.effectParams?.enemy as string | undefined;
      const targetParam = (step.effectParams?.target as string) || 'SELF_HERO';
      const minion = state.players
        .flatMap((p) => p.engagedMinions)
        .find((m) => m.card.code === enemyCode);
      const villain = getVillainsInPlay(state).find((v) => v.card.code === enemyCode);
      const enemy = minion ?? villain;
      const noAttack = (targetId?: string): EffectResult => ({
        state,
        success: false,
        mutatedState: false,
        targetId,
        onomatopoeia: 'NO ATTACK!',
      });
      if (!enemy) return noAttack();
      const enemyId = enemy.instanceId;
      if (targetParam === 'SELF_HERO' && player.currentForm !== 'hero') {
        // "Your hero" in alter-ego form: there is no hero to attack.
        return noAttack(enemyId);
      }
      const attacker = minion
        ? { type: 'MINION' as const, card: minion }
        : { type: 'VILLAIN' as const, villainId: villain!.instanceId };
      const begun = beginEnemyAttack(state, attacker, player.id);
      return {
        state: begun.state,
        success: begun.attacked,
        mutatedState: begun.attacked,
        targetId: enemyId,
        onomatopoeia: begun.attacked ? 'ENEMY ATTACKS!' : 'NO ATTACK!',
      };
    }

    case 'VILLAIN_AND_ENGAGED_MINIONS_ATTACK': {
      const activations: {
        type: 'VILLAIN' | 'MINION';
        playerId: string;
        minionInstanceId?: string;
      }[] = [
        { type: 'VILLAIN', playerId: player.id },
        ...player.engagedMinions.map((m) => ({
          type: 'MINION' as const,
          playerId: player.id,
          minionInstanceId: m.instanceId,
        })),
      ];
      (state as any).pendingActivations = [
        ...((state as any).pendingActivations || []),
        ...activations,
      ];

      if ((state as any).pendingActivations.length > 0) {
        const act = (state as any).pendingActivations.shift()!;
        if (act.type === 'VILLAIN') {
          executeVillainAttackAgainstPlayer(state, player);
        } else {
          const minion = player.engagedMinions.find((m) => m.instanceId === act.minionInstanceId);
          if (minion) executeMinionAttackAgainstPlayer(state, minion, player);
        }
      }
      return { state, success: true, onomatopoeia: 'GANG UP!' };
    }

    case 'PUT_INTO_PLAY': {
      const fromZone = (step.effectParams?.from as string) || 'SET_ASIDE';
      const toZone = (step.effectParams?.to as string) || 'ENGAGED_WITH_PLAYER';
      const filter = (step.effectParams?.filter || step.filter) as Record<string, any> | undefined;

      // "Reveal ... and put it into play" (RR v1.8 glossary R, W): the When Revealed abilities and
      // keyword-provided Surge resolve. A card only put into play never triggers them.
      const reveal = step.effectParams?.reveal === true;

      let sourceList: CardInstance[] = [];
      if (fromZone === 'SET_ASIDE') {
        sourceList = player.setAsideCards || [];
      } else if (fromZone === 'DISCARD') {
        sourceList = player.discard || [];
      } else if (fromZone === 'DECK') {
        sourceList = player.deck || [];
      } else if (fromZone === 'HAND') {
        sourceList = player.hand || [];
      }

      const matches = (
        step.effectParams?.target === 'SELF' && context.sourceCardInstance
          ? [context.sourceCardInstance]
          : sourceList.filter((c) => matchesCardFilter(c.card, filter, { player, state }))
      ).filter((c) => !c.card.isUnique || checkUniqueCardPlayable(state, c.card).allowed);

      if (matches.length === 0) {
        return {
          state,
          success: true,
          mutatedState: false,
          value: 0,
          selectedCardInstanceIds: [],
          onomatopoeia: 'NO MATCHES FOUND',
        };
      }

      const matchIds = new Set(matches.map((m) => m.instanceId));
      if (fromZone === 'SET_ASIDE') {
        player.setAsideCards = player.setAsideCards.filter((c) => !matchIds.has(c.instanceId));
      } else if (fromZone === 'DISCARD') {
        player.discard = player.discard.filter((c) => !matchIds.has(c.instanceId));
      } else if (fromZone === 'DECK') {
        player.deck = player.deck.filter((c) => !matchIds.has(c.instanceId));
      } else if (fromZone === 'HAND') {
        player.hand = player.hand.filter((c) => !matchIds.has(c.instanceId));
      }

      for (const cardInst of matches) {
        // Cards entering play enter ready with reset transient state (RR v1.8 p. 11, 24)
        resetCardState(cardInst);
        cardInst.exhausted = false;

        // Initialize counters for cards with 'uses' keyword (RR v1.8 p. 30)
        initializeCardUses(cardInst);

        if (toZone === 'SIDE_SCHEMES' || cardInst.card.type === CardType.SIDE_SCHEME) {
          const sideCard = cardInst.card as SideSchemeCard;
          const baseThreat =
            sideCard.baseThreat * (sideCard.baseThreatFixed ? 1 : getPerPlayerCount(state));
          state.sideSchemes.push({
            instanceId: cardInst.instanceId,
            card: sideCard,
            threat: baseThreat,
          });

          if (reveal) {
            const schemeAbilities = sideCard.enrichment?.abilities || [];
            for (const ab of schemeAbilities) {
              if (ab.timing === 'WHEN_REVEALED' || ab.trigger === 'WHEN_REVEALED') {
                executeEffect(state, ab, {
                  playerId: player.id,
                  sourceCardInstance: cardInst,
                });
              }
            }
            if (hasKeyword(sideCard, Keyword.SURGE)) {
              dealSurgeCard(state, player, sideCard.name);
            }
          }
        } else if (
          toZone === 'TABLEAU' ||
          [CardType.ALLY, CardType.SUPPORT, CardType.UPGRADE].includes(cardInst.card.type)
        ) {
          if (cardInst.card.type === CardType.ALLY || toZone === 'ALLIES') {
            applyToughnessOnEntry(cardInst);
            player.allies.push(cardInst);
          } else {
            player.tableau.push(cardInst);
          }
        } else if (toZone === 'ENGAGED_WITH_PLAYER' || cardInst.card.type === CardType.MINION) {
          applyToughnessOnEntry(cardInst);

          player.engagedMinions.push(cardInst as MinionCard & CardInstance);

          const hasQuickstrike = hasKeyword(cardInst.card, Keyword.QUICKSTRIKE);
          if (hasQuickstrike && player.currentForm === 'hero') {
            executeMinionAttackAgainstPlayer(state, cardInst as MinionCard & CardInstance, player);
          }

          if (reveal) {
            const abilities = cardInst.card.enrichment?.abilities || [];
            for (const ab of abilities) {
              if (ab.timing === 'WHEN_REVEALED' || ab.trigger === 'WHEN_REVEALED') {
                executeEffect(state, ab, {
                  playerId: player.id,
                  sourceCardInstance: cardInst,
                });
              }
            }
            if (hasKeyword(cardInst.card, Keyword.SURGE)) {
              dealSurgeCard(state, player, cardInst.card.name);
            }
          }

          dispatchTrigger(state, 'MINION_ENTERS_PLAY', {
            targetPlayerId: player.id,
            sourceInstanceId: cardInst.instanceId,
            targetInstanceId: cardInst.instanceId,
            encounterCardInstance: cardInst,
          });
        }
      }

      const cardNames = matches.map((m) => m.card.name).join(', ');
      const onomatopoeia = `ENTERS PLAY! ${cardNames.toUpperCase()}`;
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        category: 'ability',
        key: 'card.putIntoPlay',
        params: {
          player: player.name,
          cards: cardNames,
          destination: toZone,
        },
        onomatopoeia,
      });

      return {
        state,
        success: true,
        mutatedState: true,
        value: matches.length,
        selectedCardInstanceIds: Array.from(matchIds),
        onomatopoeia,
      };
    }

    case 'SHUFFLE_INTO_DECK': {
      const fromZone =
        (step.effectParams?.from as string) ||
        (step.effectParams?.count !== undefined ? 'DISCARD' : 'SET_ASIDE');
      const toDeck =
        (step.effectParams?.toDeck as string) ||
        (step.effectParams?.count !== undefined ? 'PLAYER_DECK' : 'ENCOUNTER_DECK');
      const filter = (step.effectParams?.filter || step.filter) as Record<string, any> | undefined;
      const count = step.effectParams?.count as number | undefined;
      let sourceList: CardInstance[] = [];
      if (fromZone === 'SET_ASIDE') {
        sourceList = player.setAsideCards || [];
      } else if (fromZone === 'DISCARD') {
        sourceList = player.discard || [];
      } else if (fromZone === 'HAND') {
        sourceList = player.hand || [];
      }

      let matches = filter
        ? sourceList.filter((c) => matchesCardFilter(c.card, filter, { player, state }))
        : [...sourceList];

      if (count !== undefined && matches.length > count) {
        matches = matches.slice(0, count);
      }

      if (matches.length === 0) {
        return {
          state,
          success: true,
          mutatedState: false,
          value: 0,
          selectedCardInstanceIds: [],
          onomatopoeia: 'NO CARDS TO SHUFFLE',
        };
      }

      const matchIds = new Set(matches.map((m) => m.instanceId));
      if (fromZone === 'SET_ASIDE') {
        player.setAsideCards = player.setAsideCards.filter((c) => !matchIds.has(c.instanceId));
      } else if (fromZone === 'DISCARD') {
        player.discard = player.discard.filter((c) => !matchIds.has(c.instanceId));
      } else if (fromZone === 'HAND') {
        player.hand = player.hand.filter((c) => !matchIds.has(c.instanceId));
      }

      if (toDeck === 'ENCOUNTER_DECK') {
        state.encounterDeck.push(...matches);
        state.encounterDeck.sort(() => Math.random() - 0.5);
      } else if (toDeck === 'PLAYER_DECK') {
        player.deck.push(...matches);
        player.deck.sort(() => Math.random() - 0.5);
      }

      const onomatopoeia = `SHUFFLE ${matches.length} CARDS!`;
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        category: 'ability',
        key: 'deck.shuffled',
        params: {
          player: player.name,
          count: matches.length,
          destination: toDeck,
        },
        onomatopoeia,
      });

      return {
        state,
        success: true,
        mutatedState: true,
        value: matches.length,
        selectedCardInstanceIds: Array.from(matchIds),
        onomatopoeia,
      };
    }

    case 'FLIP_FORM':
    case 'CHANGE_FORM': {
      const nextFormCard = player.availableForms.find((f) => f.code !== player.activeFormCard.code);
      const requestedForm = (step.effectParams?.form as string | undefined)
        ?.toLowerCase()
        .replace('-', '_');
      // A requested form the identity is already in is a no-op (e.g. "you may flip to alter-ego form")
      if (requestedForm && requestedForm === player.currentForm) {
        return { state, success: true, mutatedState: false, value: 0 };
      }
      // Optional flip: offer a voluntary choice instead of flipping immediately
      if (step.effectParams?.optional && nextFormCard) {
        enqueueDecisionPrompt(state, {
          promptId: `prompt_optional_flip_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          playerId: context.playerId || player.id,
          title: `Flip to ${nextFormCard.name}?`,
          description: `You may flip to ${nextFormCard.name}.`,
          sourceCardName: context.sourceCardInstance?.card.name || 'Card Ability',
          sourceCardCode: context.sourceCardInstance?.card.code,
          sourceCardInstanceId: context.sourceCardInstance?.instanceId,
          isVoluntary: true,
          options: [
            {
              id: 'flip',
              label: `Flip to ${nextFormCard.name}`,
              description: `Change to ${nextFormCard.name}.`,
              effect: 'CHANGE_FORM',
              params: { form: requestedForm },
            },
          ],
        });
        return { state, success: true, mutatedState: false, onomatopoeia: 'FLIP OPTIONAL!' };
      }
      if (nextFormCard) {
        player.activeFormCard = nextFormCard;
        player.currentForm = nextFormCard.type === CardType.HERO ? 'hero' : 'alter_ego';
      }
      const onomatopoeia = 'FLIP FORM!';
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        key: 'card.effect.flipForm',
        params: { player: player.name, form: player.activeFormCard.name },
        onomatopoeia,
      });
      return {
        state,
        success: true,
        mutatedState: true,
        value: 1,
        onomatopoeia,
      };
    }

    case 'ADD_ACCELERATION': {
      // Acceleration tokens sit on the main scheme (RR v1.8 "Acceleration"): +1 threat per token each villain phase
      const amount = evaluateDynamicAmount(step.effectParams?.amount as any, context, {
        fallback: 1,
        state,
        player,
      });
      state.accelerationTokens = (state.accelerationTokens || 0) + amount;
      state.log.push({
        id: `log_${Date.now()}_acceleration`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        key: 'scheme.acceleration.added',
        params: { amount, card: context.sourceCardInstance?.card.name || 'Card' },
        onomatopoeia: `+${amount} ACCELERATION!`,
      });
      return {
        state,
        success: true,
        mutatedState: amount !== 0,
        value: amount,
        onomatopoeia: `+${amount} ACCELERATION!`,
      };
    }

    case 'REMOVE_FROM_GAME': {
      // Removes the source card (target SELF) from the game: it ends only in removedFromGame
      const source = context.sourceCardInstance;
      if (!source) return { state, success: false, error: 'No card to remove from the game' };
      removeCardFromAllZones(state, source.instanceId);
      state.removedFromGame.push(source);
      state.log.push({
        id: `log_${Date.now()}_removed_from_game`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        key: 'card.removedFromGame',
        params: { card: source.card.name, player: player.name },
        onomatopoeia: 'REMOVED FROM THE GAME!',
      });
      return { state, success: true, mutatedState: true, onomatopoeia: 'REMOVED FROM THE GAME!' };
    }

    case 'SURGE': {
      dealSurgeCard(state, player, context.sourceCardInstance?.card.name);
      const onomatopoeia = 'SURGE!';
      return {
        state,
        success: true,
        mutatedState: true,
        value: 1,
        onomatopoeia,
      };
    }

    case 'REVEAL_ENCOUNTER_CARD': {
      const extraCard = drawEncounterCard(state);
      if (extraCard) {
        player.dealtEncounterCards.push(extraCard);
      }
      const onomatopoeia = 'REVEAL ENCOUNTER CARD!';
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        key: 'encounter.card.revealed',
        params: { player: player.name },
        onomatopoeia,
      });
      return {
        state,
        success: true,
        mutatedState: true,
        value: 1,
        onomatopoeia,
      };
    }

    case 'ADD_THREAT': {
      const baseAmount = resolveNumericAmount(
        step.effectParams?.amount ?? step.effectParams?.amountPerPlayer,
        context,
        1,
        { state, player },
      );
      const isPerPlayer = !!(step.effectParams?.perPlayer || step.effectParams?.amountPerPlayer);
      const amount = isPerPlayer ? baseAmount * getPerPlayerCount(state) : baseAmount;
      const targetParam =
        (step.effectParams?.target as string) ||
        (step.effectParams?.targetInstanceId ? 'CHOSEN_SCHEME' : undefined) ||
        'MAIN_SCHEME';
      const targetContext: EffectContext = {
        ...context,
        chosenTargetInstanceId:
          (step.effectParams?.targetInstanceId as string) || context?.chosenTargetInstanceId,
      };

      if (targetParam === 'ALL_SIDE_SCHEMES') {
        if (state.sideSchemes.length > 0) {
          let totalPlaced = 0;
          let paused = false;
          for (const s of state.sideSchemes) {
            const { result } = applyThreatPlacement(state, {
              targetType: 'side_scheme',
              targetInstanceId: s.instanceId,
              amount,
              sourceType: 'CARD_EFFECT',
              sourceEntityName: context.sourceCardInstance?.card?.name,
              sourcePlayerId: player.id,
            });
            totalPlaced += result.threatPlaced;
            paused ||= result.paused === true;
          }
          return {
            state,
            success: true,
            mutatedState: totalPlaced > 0 || paused,
            value: totalPlaced,
            onomatopoeia: `+${amount} THREAT TO SIDE SCHEMES!`,
          };
        }
        return { state, success: true, mutatedState: false, onomatopoeia: 'NO SIDE SCHEMES' };
      }
      const cardCode =
        (step.effectParams?.cardCode as string) ||
        (targetParam !== 'MAIN_SCHEME' &&
        targetParam !== 'THIS_SIDE_SCHEME' &&
        targetParam !== 'CHOSEN_SCHEME' &&
        /^\d{5}$/.test(targetParam)
          ? targetParam
          : undefined);
      if (cardCode) {
        const sideScheme = (state.sideSchemes || []).find((s) => s.card?.code === cardCode);
        if (sideScheme) {
          const { result } = applyThreatPlacement(state, {
            targetType: 'side_scheme',
            targetInstanceId: sideScheme.instanceId,
            amount,
            sourceType: 'CARD_EFFECT',
            sourceEntityName: context.sourceCardInstance?.card?.name,
            sourcePlayerId: player.id,
          });
          return {
            state,
            success: true,
            mutatedState: result.threatPlaced > 0 || result.paused === true,
            value: result.threatPlaced,
            onomatopoeia: result.onomatopoeia,
          };
        }

        if (getActiveMainScheme(state)?.card?.code === cardCode) {
          const { result } = applyThreatPlacement(state, {
            targetType: 'main_scheme',
            amount,
            sourceType: 'CARD_EFFECT',
            sourceEntityName: context.sourceCardInstance?.card?.name,
            sourcePlayerId: player.id,
          });
          return {
            state,
            success: true,
            mutatedState: result.threatPlaced > 0 || result.paused === true,
            value: result.threatPlaced,
            onomatopoeia: result.onomatopoeia,
          };
        }

        // Targeted scheme is not in play: effect fizzles per RR v1.8 p. 29
        state.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          round: state.roundNumber,
          phase: state.phase,
          key: 'scheme.threat.target_missing',
          params: { cardCode, amount },
        });
        return {
          state,
          success: true,
          mutatedState: false,
          value: 0,
        };
      }

      const targetSchemes = resolveSchemeTargets(state, targetParam as any, targetContext);
      if (targetSchemes.length > 0) {
        let totalPlaced = 0;
        let paused = false;
        let lastResult: any;
        for (const st of targetSchemes) {
          const isSide =
            st.entityType === 'side_scheme' ||
            (state.sideSchemes || []).some((s) => s.instanceId === st.id || s.card.code === st.id);

          const { result } = applyThreatPlacement(state, {
            targetType: isSide ? 'side_scheme' : 'main_scheme',
            targetInstanceId: isSide ? st.id : undefined,
            amount,
            sourceType: 'CARD_EFFECT',
            sourceEntityName: context.sourceCardInstance?.card?.name,
            sourcePlayerId: player.id,
          });
          totalPlaced += result.threatPlaced;
          paused ||= result.paused === true;
          lastResult = result;
        }
        return {
          state,
          success: true,
          mutatedState: totalPlaced > 0 || paused,
          value: totalPlaced,
          onomatopoeia: lastResult?.onomatopoeia || `SCHEME THREAT +${totalPlaced}!`,
        };
      }

      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        key: 'scheme.threat.target_missing',
        params: { target: targetParam, amount },
      });
      return {
        state,
        success: true,
        mutatedState: false,
        value: 0,
      };
    }

    case 'CANCEL_WHEN_REVEALED': {
      const onomatopoeia = 'CANCELLED!';
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        key: 'encounter.whenRevealed.cancelled',
        params: { player: player.name },
        onomatopoeia,
      });
      return {
        state,
        success: true,
        mutatedState: true,
        value: 1,
        onomatopoeia,
      };
    }

    case 'ADD_COUNTERS': {
      const targetParam = (step.effectParams?.target as string) || 'SELF';
      const counterType = (step.effectParams?.counterType as string) || 'all_purpose';
      const amount = resolveNumericAmount(step.effectParams?.amount, context, 1, { state, player });

      if (targetParam === 'IDENTITY') {
        player.counters = player.counters || {};
        player.counters[counterType] = (player.counters[counterType] || 0) + amount;
      } else if (context.sourceCardInstance) {
        context.sourceCardInstance.counters = context.sourceCardInstance.counters || {};
        context.sourceCardInstance.counters[counterType] =
          (context.sourceCardInstance.counters[counterType] || 0) + amount;
        if (!context.sourceCardInstance.tokens) {
          context.sourceCardInstance.tokens = {
            damage: 0,
            threat: 0,
            counters: 0,
          };
        }
        context.sourceCardInstance.tokens.counters =
          (context.sourceCardInstance.tokens.counters || 0) + amount;
      }
      return {
        state,
        success: true,
        mutatedState: true,
        value: amount,
        onomatopoeia: `+${amount} ${counterType.toUpperCase()} COUNTERS!`,
      };
    }

    case 'SPEND_COUNTERS':
    case 'REMOVE_COUNTERS': {
      const targetParam = (step.effectParams?.target as string) || 'SELF';
      const counterType = (step.effectParams?.counterType as string) || 'all_purpose';
      const amount = resolveNumericAmount(step.effectParams?.amount, context, 1, { state, player });

      if (targetParam === 'IDENTITY') {
        player.counters = player.counters || {};
        const current = player.counters[counterType] || 0;
        player.counters[counterType] = Math.max(0, current - amount);
      } else if (context.sourceCardInstance) {
        context.sourceCardInstance.counters = context.sourceCardInstance.counters || {};
        const current =
          context.sourceCardInstance.counters[counterType] ??
          context.sourceCardInstance.tokens?.counters ??
          0;
        context.sourceCardInstance.counters[counterType] = Math.max(0, current - amount);
        if (context.sourceCardInstance.tokens) {
          context.sourceCardInstance.tokens.counters = Math.max(
            0,
            (context.sourceCardInstance.tokens.counters || 0) - amount,
          );
        }

        // Check and discard if Uses counters reached 0 per RR v1.8 p. 30
        checkAndDiscardZeroCounterCard(state, player, context.sourceCardInstance, counterType);
      }
      return {
        state,
        success: true,
        mutatedState: true,
        value: amount,
        onomatopoeia: `-${amount} ${counterType.toUpperCase()} COUNTERS!`,
      };
    }

    case 'REMOVE_COUNTERS_MATCHING_FILTER': {
      const targetZone = (step.effectParams?.targetZone as string) || 'TABLEAU';
      const traitFilter = step.effectParams?.traitFilter as string | undefined;
      const counterType = step.effectParams?.counterType as string | undefined;
      const amountParam = step.effectParams?.amount;

      let targetCards: CardInstance[] = [];
      if (targetZone === 'TABLEAU' || targetZone === 'ALL_CONTROLLED') {
        targetCards = [...player.tableau, ...player.allies];
      }

      if (traitFilter) {
        targetCards = targetCards.filter((c) =>
          (c.card.traits || []).some(
            (t) => t.toLowerCase().trim() === traitFilter.toLowerCase().trim(),
          ),
        );
      }

      let totalRemoved = 0;
      for (const cardInst of targetCards) {
        if (cardInst.counters) {
          for (const [k, count] of Object.entries(cardInst.counters)) {
            if (
              !counterType ||
              counterType === 'ALL' ||
              counterType.toLowerCase() === k.toLowerCase()
            ) {
              if (amountParam === 'ALL') {
                totalRemoved += count;
                cardInst.counters[k] = 0;
              } else if (typeof amountParam === 'number') {
                const toRemove = Math.min(count, amountParam);
                totalRemoved += toRemove;
                cardInst.counters[k] = count - toRemove;
              }
            }
          }
        }
        if (cardInst.tokens?.counters) {
          if (amountParam === 'ALL') {
            totalRemoved += cardInst.tokens.counters;
            cardInst.tokens.counters = 0;
          } else if (typeof amountParam === 'number') {
            const toRemove = Math.min(cardInst.tokens.counters, amountParam);
            totalRemoved += toRemove;
            cardInst.tokens.counters -= toRemove;
          }
        }
        checkAndDiscardZeroCounterCard(state, player, cardInst, counterType);
      }

      return {
        state,
        success: true,
        mutatedState: totalRemoved > 0,
        value: totalRemoved,
        onomatopoeia: `PURGED ${totalRemoved} COUNTERS!`,
      };
    }

    case 'RETURN_TO_HAND': {
      const underneath = context.sourceCardInstance?.cardsUnderneath;
      if (underneath && underneath.length > 0) {
        for (const card of underneath) {
          const owner = state.players.find((p) => p.id === card.ownerId) || player;
          owner.hand.push(card);
        }
        context.sourceCardInstance!.cardsUnderneath = [];
        return {
          state,
          success: true,
          mutatedState: true,
          onomatopoeia: 'CARDS RETURNED TO HANDS!',
        };
      }
      if (context.sourceCardInstance) {
        const allyIdx = player.allies.indexOf(context.sourceCardInstance);
        if (allyIdx !== -1) {
          player.allies.splice(allyIdx, 1);
          player.hand.push(context.sourceCardInstance);
        } else {
          const tabIdx = player.tableau.indexOf(context.sourceCardInstance);
          if (tabIdx !== -1) {
            player.tableau.splice(tabIdx, 1);
            player.hand.push(context.sourceCardInstance);
          }
        }
      }
      return {
        state,
        success: true,
        mutatedState: true,
        onomatopoeia: 'RETURNED TO HAND!',
      };
    }

    case 'SEARCH': {
      const autoResolveEnabled = state.options?.autoResolveUnambiguous !== false;
      const stepAutoSelect = step.effectParams?.autoSelectIfUnambiguous !== false;
      const allowAutoSelect = autoResolveEnabled && stepAutoSelect;

      const rawSource = step.effectParams?.source;
      const sourceZones: SearchZone[] = (
        Array.isArray(rawSource) ? rawSource : [rawSource || 'PLAYER_DECK']
      ) as SearchZone[];

      let resolvedLookCount: number | 'ALL' | undefined = undefined;
      if (step.effectParams?.lookCount === 'ALL') {
        resolvedLookCount = 'ALL';
      } else if (step.effectParams?.lookCount !== undefined) {
        resolvedLookCount = resolveNumericAmount(step.effectParams.lookCount, context, 0, {
          state,
          player,
        });
      }
      const isFullSearch =
        resolvedLookCount === undefined || resolvedLookCount === 'ALL' || resolvedLookCount === 0;
      const isLookCountSpliced =
        !isFullSearch && typeof resolvedLookCount === 'number' && resolvedLookCount > 0;

      let resolvedTakeCount: number | 'ALL' = 1;
      if (step.effectParams?.takeCount === 'ALL') {
        resolvedTakeCount = 'ALL';
      } else if (step.effectParams?.takeCount !== undefined) {
        resolvedTakeCount = resolveNumericAmount(step.effectParams.takeCount, context, 1, {
          state,
          player,
        });
      }
      const isTakeAll = resolvedTakeCount === 'ALL' || resolvedTakeCount === 0;
      const countToTake = isTakeAll ? 0 : Math.max(1, resolvedTakeCount as number);

      const filter =
        (step.effectParams?.filter || step.filter) ??
        (step.effectParams?.targetCardCode ||
        step.effectParams?.targetCardName ||
        step.effectParams?.trait ||
        step.effectParams?.type ||
        step.effectParams?.type_code ||
        step.effectParams?.cardType
          ? {
              targetCardCode: step.effectParams?.targetCardCode,
              targetCardName: step.effectParams?.targetCardName,
              trait: step.effectParams?.trait,
              type:
                step.effectParams?.type ||
                step.effectParams?.type_code ||
                step.effectParams?.cardType,
            }
          : undefined);

      const targetParam =
        (step.effectParams?.target as string) || (step.target as string) || 'SELF';
      let targetPlayerId: string | undefined =
        (step.effectParams?.targetPlayerId as string) || context.targetPlayerId;

      if (targetParam === 'CHOSEN_PLAYER' && state.players.length > 1 && !targetPlayerId) {
        const eligiblePlayers = state.players.filter((p) =>
          p.discard.some((c) => matchesCardFilter(c.card, filter, { state, player: p })),
        );

        if (allowAutoSelect && eligiblePlayers.length === 1) {
          targetPlayerId = eligiblePlayers[0].id;
        } else {
          const promptId = `prompt_${Date.now()}_choose_search_player`;
          const sourceCardName =
            context.sourceCardInstance?.card.name ||
            player.activeFormCard?.name ||
            'Search & Select';

          const prompt: PendingDecisionPrompt = {
            promptId,
            playerId: player.id,
            title: 'Choose a Player',
            description: 'Choose a player to return a card to their hand:',
            sourceCardName,
            sourceCardCode: context.sourceCardInstance?.card.code,
            sourceCardInstanceId: context.sourceCardInstance?.instanceId,
            options: state.players.map((p) => {
              const isEligible = eligiblePlayers.some((ep) => ep.id === p.id);
              return {
                id: `choose_player_${p.id}`,
                label: `${p.name} (${p.hero?.name || 'Hero'})`,
                description: `Choose ${p.name}`,
                effect: 'SEARCH',
                disabled: !isEligible,
                disabledReason: !isEligible ? 'No Tech upgrade in discard pile' : undefined,
                params: {
                  ...step.effectParams,
                  targetPlayerId: p.id,
                  target: 'CHOSEN_PLAYER',
                },
              };
            }),
          };

          state = enqueueDecisionPrompt(state, prompt);
          state.log.push({
            id: `log_${Date.now()}`,
            timestamp: Date.now(),
            round: state.roundNumber,
            phase: state.phase,
            category: 'ability',
            key: 'decision.prompt.opened',
            params: { player: player.name, promptId, source: sourceCardName },
            onomatopoeia: 'CHOOSE PLAYER!',
          });

          return {
            state,
            success: true,
            mutatedState: false,
            onomatopoeia: 'CHOOSE PLAYER!',
          };
        }
      }

      const targetPlayer =
        (targetPlayerId ? state.players.find((p) => p.id === targetPlayerId) : undefined) || player;

      const selectedDestination = (step.effectParams?.selectedDestination as string) || 'HAND';
      const unselectedDestination = step.effectParams?.unselectedDestination as
        string | null | undefined;
      const shuffleAfter =
        step.effectParams?.shuffleAfter !== undefined
          ? (step.effectParams.shuffleAfter as boolean)
          : isFullSearch;

      const timing = context.ability?.timing;
      const trigger = context.ability?.trigger;
      const isAction =
        timing === 'ACTION' || timing === 'HERO_ACTION' || timing === 'ALTER_EGO_ACTION';
      const isForced =
        timing === 'WHEN_REVEALED' ||
        timing === 'FORCED_RESPONSE' ||
        timing === 'FORCED_INTERRUPT' ||
        trigger === 'WHEN_REVEALED';

      let isVoluntary = false;
      if (isForced) {
        isVoluntary = false;
      } else if (step.effectParams?.isVoluntary !== undefined) {
        isVoluntary = Boolean(step.effectParams.isVoluntary);
      } else if (isAction) {
        isVoluntary = true;
      }

      const promptTitle =
        (step.effectParams?.promptTitle as string) ||
        (context.sourceCardInstance
          ? `${context.sourceCardInstance.card.name}: Choose card(s)`
          : 'Search & Select: Choose card(s)');

      const cardOriginMap = new Map<string, SearchZone>();
      const getZonePile = (zone: SearchZone): { pile: CardInstance[]; isDeck: boolean } => {
        switch (zone) {
          case 'PLAYER_DISCARD':
            return { pile: targetPlayer.discard, isDeck: false };
          case 'PLAYER_HAND':
            return { pile: targetPlayer.hand, isDeck: false };
          case 'ENCOUNTER_DECK':
            return { pile: state.encounterDeck, isDeck: true };
          case 'ENCOUNTER_DISCARD':
            return { pile: state.encounterDiscard, isDeck: false };
          case 'PLAYER_DECK':
          default:
            return { pile: targetPlayer.deck, isDeck: true };
        }
      };

      const shuffleSearchedDecks = () => {
        if (sourceZones.includes('ENCOUNTER_DECK')) {
          state.encounterDeck.sort(() => Math.random() - 0.5);
        }
        if (sourceZones.includes('PLAYER_DECK')) {
          targetPlayer.deck.sort(() => Math.random() - 0.5);
        }
      };

      // Determine candidate pool
      let lookedCards: CardInstance[] = [];
      if (isLookCountSpliced) {
        let remainingToLook = resolvedLookCount as number;
        for (const zone of sourceZones) {
          if (remainingToLook <= 0) break;
          const { pile } = getZonePile(zone);
          const isDiscardZone = zone === 'PLAYER_DISCARD' || zone === 'ENCOUNTER_DISCARD';
          const shouldReverse = isDiscardZone && step.effectParams?.fromTop === true;
          const workingPile = shouldReverse ? [...pile].reverse() : pile;
          const sliceCount = Math.min(remainingToLook, workingPile.length);
          const spliced = workingPile.splice(0, sliceCount);
          if (shouldReverse) {
            const splicedIds = new Set(spliced.map((c) => c.instanceId));
            const actualPile = getZonePile(zone).pile;
            for (let i = actualPile.length - 1; i >= 0; i--) {
              if (splicedIds.has(actualPile[i].instanceId)) {
                actualPile.splice(i, 1);
              }
            }
          }
          for (const card of spliced) {
            cardOriginMap.set(card.instanceId, zone);
          }
          lookedCards.push(...spliced);
          remainingToLook -= sliceCount;
        }
      } else {
        for (const zone of sourceZones) {
          const { pile } = getZonePile(zone);
          const isDiscardZone = zone === 'PLAYER_DISCARD' || zone === 'ENCOUNTER_DISCARD';
          const shouldReverse = isDiscardZone && step.effectParams?.fromTop === true;
          const cardsToLook = shouldReverse ? [...pile].reverse() : pile;
          for (const card of cardsToLook) {
            cardOriginMap.set(card.instanceId, zone);
            lookedCards.push(card);
          }
        }
      }

      const routeCards = (cards: CardInstance[], destination: string | null | undefined) => {
        if (cards.length === 0) return;
        if (!destination || destination === 'LEAVE_IN_PLACE') {
          for (const card of cards) {
            const origin = cardOriginMap.get(card.instanceId) || sourceZones[0];
            if (origin === 'PLAYER_DISCARD') targetPlayer.discard.push(card);
            else if (origin === 'PLAYER_HAND') targetPlayer.hand.push(card);
            else if (origin === 'ENCOUNTER_DECK') state.encounterDeck.unshift(card);
            else if (origin === 'ENCOUNTER_DISCARD') state.encounterDiscard.push(card);
            else targetPlayer.deck.unshift(card);
          }
          return;
        }

        if (destination === 'REVEAL') {
          for (const card of cards) {
            resolveActiveEncounterCardAfterInterrupt(state, card, targetPlayer, false);
          }
        } else if (destination === 'TABLEAU') {
          for (const card of cards) {
            if (card.card.type === CardType.SIDE_SCHEME) {
              const sideSchemeCard = card.card as SideSchemeCard;
              const baseThreat =
                sideSchemeCard.baseThreat *
                (sideSchemeCard.baseThreatFixed ? 1 : getPerPlayerCount(state));
              state.sideSchemes.push({
                instanceId: card.instanceId,
                card: sideSchemeCard,
                threat: baseThreat,
              });
              state.log.push({
                id: `log_${Date.now()}`,
                timestamp: Date.now(),
                key: 'encounter.reveal.sideScheme',
                params: { sideScheme: card.card.name, threat: baseThreat },
                onomatopoeia: 'SIDE SCHEME!',
              });
              const abilities = card.card.enrichment?.abilities || [];
              for (const ability of abilities) {
                if (ability.trigger === 'WHEN_REVEALED' || ability.timing === 'WHEN_REVEALED') {
                  executeEffect(state, ability, {
                    playerId: targetPlayer.id,
                    sourceCardInstance: card,
                  });
                }
              }
            } else {
              targetPlayer.tableau.push(card);
            }
          }
        } else if (destination === 'HAND') {
          targetPlayer.hand.push(...cards);
        } else if (destination === 'DISCARD') {
          for (const card of cards) {
            const origin = cardOriginMap.get(card.instanceId) || sourceZones[0];
            if (origin.startsWith('ENCOUNTER') || card.card.faction === 'encounter') {
              state.encounterDiscard.push(card);
            } else {
              targetPlayer.discard.push(card);
            }
          }
        } else if (destination === 'DECK_TOP') {
          for (const card of cards) {
            const origin = cardOriginMap.get(card.instanceId) || sourceZones[0];
            if (origin.startsWith('ENCOUNTER') || card.card.faction === 'encounter') {
              state.encounterDeck.unshift(card);
            } else {
              targetPlayer.deck.unshift(card);
            }
          }
        } else if (destination === 'DECK_BOTTOM') {
          for (const card of cards) {
            const origin = cardOriginMap.get(card.instanceId) || sourceZones[0];
            if (origin.startsWith('ENCOUNTER') || card.card.faction === 'encounter') {
              state.encounterDeck.push(card);
            } else {
              targetPlayer.deck.push(card);
            }
          }
        } else if (destination === 'DECK_SHUFFLE') {
          for (const card of cards) {
            const origin = cardOriginMap.get(card.instanceId) || sourceZones[0];
            if (origin.startsWith('ENCOUNTER') || card.card.faction === 'encounter') {
              state.encounterDeck.push(card);
              state.encounterDeck.sort(() => Math.random() - 0.5);
            } else {
              targetPlayer.deck.push(card);
              targetPlayer.deck.sort(() => Math.random() - 0.5);
            }
          }
        } else if (destination === 'ATTACH_TO_TARGET') {
          for (const card of cards) {
            attachCardToHost(
              state,
              card,
              (step.effectParams?.target as string) || 'VILLAIN',
              context.chosenTargetInstanceId || context.targetPlayerId || targetPlayer.id,
            );
          }
        }
      };

      // Filter matching candidate cards
      let matchingCandidates = lookedCards.filter((c) =>
        matchCardFilter(c.card, filter, targetPlayer),
      );
      if (step.effectParams?.fromTop === true) {
        matchingCandidates = matchingCandidates.slice(0, countToTake);
      }

      if (matchingCandidates.length === 0) {
        if (isLookCountSpliced) {
          if (unselectedDestination === 'DISCARD') {
            routeCards(lookedCards, 'DISCARD');
          } else {
            routeCards(lookedCards, 'LEAVE_IN_PLACE');
          }
        }
        if (shuffleAfter) {
          shuffleSearchedDecks();
        }
        return {
          state,
          success: true,
          mutatedState: false,
          onomatopoeia: 'NO MATCHING TARGET FOUND',
        };
      }

      const effectiveTakeCount = isTakeAll ? matchingCandidates.length : countToTake;
      const shouldAutoSelect =
        isTakeAll ||
        (!step.effectParams?.isVoluntary &&
          allowAutoSelect &&
          matchingCandidates.length <= effectiveTakeCount);

      if (shouldAutoSelect) {
        const selectedCards = matchingCandidates.slice(0, effectiveTakeCount);
        const selectedIds = new Set(selectedCards.map((card) => card.instanceId));
        const unselectedCards = lookedCards.filter((card) => !selectedIds.has(card.instanceId));

        if (!isLookCountSpliced) {
          for (const selectedCard of selectedCards) {
            const zone = cardOriginMap.get(selectedCard.instanceId) || sourceZones[0];
            const { pile } = getZonePile(zone);
            const selectedIndex = pile.findIndex(
              (card) => card.instanceId === selectedCard.instanceId,
            );
            if (selectedIndex !== -1) pile.splice(selectedIndex, 1);
          }
        }

        routeCards(selectedCards, selectedDestination);
        if (isLookCountSpliced) routeCards(unselectedCards, unselectedDestination);
        if (shuffleAfter) shuffleSearchedDecks();

        return {
          state,
          success: true,
          mutatedState: selectedCards.length > 0,
          selectedCardInstanceIds: selectedCards.map((card) => card.instanceId),
          onomatopoeia: `SEARCHED ${selectedCards.length} CARD(S)!`,
        };
      }

      const options: DecisionPromptOption[] = matchingCandidates.map((c) => ({
        id: c.instanceId,
        label: `${c.card.name} (${c.card.type}${c.card.cost !== undefined ? `, Cost: ${c.card.cost}` : ''})`,
        description: c.card.text || `Select ${c.card.name}`,
        effect: 'SEARCH_AND_SELECT_RESOLUTION',
        params: {
          chosenInstanceId: c.instanceId,
          targetPlayerId: targetPlayer.id,
          lookedCards,
          lookedCardInstanceIds: lookedCards.map((l) => l.instanceId),
          sourceZone: cardOriginMap.get(c.instanceId) || sourceZones[0],
          sourceZones,
          selectedDestination,
          unselectedDestination,
          shuffleAfter: shuffleAfter && sourceZones.some((z) => z.includes('DECK')),
          isLookCountSpliced,
          target: step.effectParams?.target,
        },
      }));

      if (isVoluntary) {
        options.push({
          id: 'pass_search',
          label: 'Pass / Do not select',
          description: 'Pass and do not choose any card',
          effect: 'SEARCH_AND_SELECT_PASS',
          params: {
            targetPlayerId: targetPlayer.id,
            lookedCards,
            lookedCardInstanceIds: lookedCards.map((l) => l.instanceId),
            sourceZone: sourceZones[0],
            sourceZones,
            unselectedDestination,
            shuffleAfter: shuffleAfter && sourceZones.some((z) => z.includes('DECK')),
            isLookCountSpliced,
          },
        });
      }

      const prompt: PendingDecisionPrompt = {
        promptId: `prompt_search_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        playerId: context.playerId || player.id,
        title: promptTitle,
        description: `Select up to ${effectiveTakeCount} card(s):`,
        sourceCardName: context.sourceCardInstance?.card.name || 'Search & Select',
        sourceCardCode: context.sourceCardInstance?.card.code,
        sourceCardInstanceId: context.sourceCardInstance?.instanceId,
        options,
        isVoluntary,
      };

      const enqueuedState = enqueueDecisionPrompt(state, prompt);
      return {
        state: enqueuedState,
        success: true,
        onomatopoeia: 'CHOOSE CARD!',
      };
    }

    case 'EXECUTE_SPECIAL': {
      const specialId = step.effectParams?.specialId as string | undefined;
      if (!specialId) {
        return { state, success: false, error: 'EXECUTE_SPECIAL requires effectParams.specialId' };
      }
      const handler = getSpecialHandler(specialId);
      if (!handler) {
        return {
          state,
          success: false,
          error: `Special handler not found for ${specialId}`,
        };
      }
      return handler.execute(state, context, step.effectParams);
    }

    case 'TRANSFER_DAMAGE': {
      let amount = resolveNumericAmount(
        step.effectParams?.amount ?? step.effectParams?.baseAmount,
        context,
        1,
        {
          state,
          player,
          sourceCardInstance: context.sourceCardInstance,
          targetInstanceId:
            (step.effectParams?.targetInstanceId as string) || context.chosenTargetInstanceId,
        },
      );
      if (step.effectParams?.dynamicBonus) {
        const bonus = resolveNumericAmount(step.effectParams.dynamicBonus as any, context, 0, {
          state,
          player,
          sourceCardInstance: context.sourceCardInstance,
          targetInstanceId:
            (step.effectParams?.targetInstanceId as string) || context.chosenTargetInstanceId,
        });
        amount += bonus;
      }
      if (context.isFinalStep && step.effectParams?.finisherBonus) {
        amount += (step.effectParams.finisherBonus as number) || 0;
      }

      const targetEnemyId =
        (step.effectParams?.targetInstanceId as string) || context.chosenTargetInstanceId;
      player.health = Math.min(getEffectiveMaxHealth(player, state), player.health + amount);

      // The enemy side goes through the damage pipeline like DEAL_DAMAGE (#247): shields, Tough,
      // Retaliate for an attack, defeat triggers and villain defeat. A labelled "(attack)" ability
      // is an attack by the player's identity.
      const damageOpts: AbilityDamageOptions = {
        sourceType: context.labelledAttack ? 'HERO' : undefined,
        sourcePlayerId: player.id,
        sourceCardInstance: context.sourceCardInstance,
        isAttack: Boolean(
          step.effectParams?.isAttack || context.isAttack || context.labelledAttack,
        ),
        hasPiercing: false,
        triggerChain: context.triggerChain,
      };
      let targetMinionOwner: PlayerState | undefined;
      let targetMinion: CardInstance | undefined;
      if (targetEnemyId && targetEnemyId !== 'villain') {
        for (const p of state.players) {
          targetMinion = p.engagedMinions.find((m) => m.instanceId === targetEnemyId);
          if (targetMinion) {
            targetMinionOwner = p;
            break;
          }
        }
      }
      if (targetMinion && targetMinionOwner) {
        state = applyAbilityDamage(
          state,
          minionTargetRef(targetMinion, targetMinionOwner.id),
          amount,
          damageOpts,
        ).state;
        recordAttackedEnemy(context, 'minion', targetMinion.instanceId);
      } else {
        const villain = getActiveVillain(state);
        state = applyAbilityDamage(state, villainTargetRef(villain), amount, damageOpts).state;
        recordAttackedEnemy(context, 'villain', villain.instanceId || 'villain');
      }

      return {
        state,
        success: true,
        mutatedState: true,
        value: amount,
        onomatopoeia: `TRANSFERRED ${amount} DAMAGE!`,
      };
    }

    case 'CANCEL_WHEN_REVEALED_AND_REVEAL_ANOTHER': {
      const replacement = drawEncounterCard(state);
      if (replacement) {
        player.dealtEncounterCards.push(replacement);
      }
      return {
        state,
        success: true,
        mutatedState: true,
        onomatopoeia: 'CANCELLED & REVEALED ANOTHER!',
      };
    }

    case 'ATTACH_FACEDOWN_CARDS_FROM_HAND': {
      // Cards go under the host as it exists in state, not under the reveal-time instance (#238).
      const host = resolveSourceHostZone(state, context.sourceCardInstance);
      if (!host) {
        return { state, success: false, error: 'No host in play to place facedown cards under' };
      }
      for (const p of state.players) {
        if (p.hand.length > 0) {
          const randIdx = Math.floor(Math.random() * p.hand.length);
          const [removed] = p.hand.splice(randIdx, 1);
          removed.ownerId = p.id;
          if (!host.cardsUnderneath) host.cardsUnderneath = [];
          host.cardsUnderneath.push(removed);
        }
      }
      return {
        state,
        success: true,
        mutatedState: true,
        onomatopoeia: 'CARDS PLACED FACEDOWN!',
      };
    }

    case 'REDUCE_NEXT_CARD_COST': {
      const stepParams = getStepEffectParams(step);
      const amount = (stepParams.amount as number) || (step.effectParams?.amount as number) || 1;
      const targetParam =
        (stepParams.target as string) || (step.effectParams?.target as string) || 'CHOSEN_PLAYER';
      const duration = (stepParams.duration as 'PHASE' | 'ROUND' | 'TURN') || 'PHASE';
      const cardFilter = stepParams.cardFilter || (stepParams.filter as any) || step.filter;
      const targetPlayerId = (context.targetPlayerId ||
        context.chosenTargetInstanceId ||
        stepParams.targetPlayerId) as string | undefined;

      // In multiplayer mode, if targeting CHOSEN_PLAYER and no target player specified yet, prompt player to choose
      if (targetParam === 'CHOSEN_PLAYER' && state.players.length > 1 && !targetPlayerId) {
        const sourceCardName =
          context.sourceCardInstance?.card.name || player.activeFormCard?.name || 'Helicarrier';
        const promptId = `prompt_${Date.now()}_choose_cost_reduction_player`;
        state = enqueueDecisionPrompt(state, {
          promptId,
          playerId: player.id,
          title: 'Choose a Player',
          description: `Choose a player to reduce the resource cost of the next card they play this phase by ${amount}:`,
          sourceCardName,
          options: state.players.map((p) => ({
            id: `reduce_cost_${p.id}`,
            label: `${p.name} (${p.hero?.name || 'Hero'})`,
            description: `Give -${amount} cost reduction to ${p.name}`,
            effect: 'REDUCE_NEXT_CARD_COST',
            params: {
              amount,
              duration,
              cardFilter,
              targetPlayerId: p.id,
              target: 'CHOSEN_PLAYER',
            },
          })),
        });

        state.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          round: state.roundNumber,
          phase: state.phase,
          category: 'ability',
          key: 'decision.prompt.opened',
          params: { player: player.name, promptId, source: sourceCardName },
          onomatopoeia: 'CHOOSE PLAYER!',
        });

        return {
          state,
          success: true,
          onomatopoeia: 'CHOOSE PLAYER!',
        };
      }

      // Determine recipient player
      let targetPlayer = player;
      if (targetPlayerId) {
        const found = state.players.find((p) => p.id === targetPlayerId);
        if (found) targetPlayer = found;
      }

      const sourceCardName = context.sourceCardInstance?.card.name || 'Helicarrier';
      const sourceCardCode = context.sourceCardInstance?.card.code;

      const reduction: ActiveCostReduction = {
        id: `cost_red_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        sourceCardName,
        sourceCardCode,
        amount,
        duration,
        cardFilter,
        appliesTo: 'NEXT_CARD',
      };

      if (!targetPlayer.activeCostReductions) {
        targetPlayer.activeCostReductions = [];
      }
      targetPlayer.activeCostReductions.push(reduction);
      targetPlayer.costReductions = targetPlayer.activeCostReductions.reduce(
        (sum, r) => sum + r.amount,
        0,
      );

      state.log.push({
        id: `log_${Date.now()}_cost_red`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        category: 'ability',
        key: 'cost.reduced',
        params: {
          player: targetPlayer.name,
          source: sourceCardName,
          amount,
        },
        onomatopoeia: `${sourceCardName.toUpperCase()} DISCOUNT! -${amount} COST`,
      });

      return {
        state,
        success: true,
        mutatedState: true,
        onomatopoeia: `${sourceCardName.toUpperCase()} DISCOUNT! -${amount} COST`,
      };
    }

    case 'PLAY_FROM_ZONE': {
      const source = (step.effectParams?.source as string) || 'PLAYER_DISCARD';
      const filter = (step.effectParams?.filter || step.filter) as Record<string, any> | undefined;
      const costMode = (step.effectParams?.costMode as string) || 'PRINTED_COST';
      const costReduction = (step.effectParams?.costReduction as number) || 0;
      const destination = (step.effectParams?.destination as string) || 'TABLEAU';
      const control = (step.effectParams?.control as string) || 'SELF';
      const promptTitle =
        (step.effectParams?.promptTitle as string) ||
        (context.sourceCardInstance
          ? `${context.sourceCardInstance.card.name}: Choose a card to play`
          : 'Choose a card to play:');

      // 1. Gather candidate cards from designated source
      interface CandidateCard {
        instance: CardInstance;
        owner: PlayerState;
      }
      const candidates: CandidateCard[] = [];

      if (source === 'ANY_PLAYER_DISCARD') {
        for (const p of state.players) {
          for (const cardInst of p.discard) {
            if (matchesCardFilter(cardInst.card, filter, { player, state })) {
              candidates.push({ instance: cardInst, owner: p });
            }
          }
        }
      } else if (source === 'PLAYER_DISCARD') {
        for (const cardInst of player.discard) {
          if (matchesCardFilter(cardInst.card, filter, { player, state })) {
            candidates.push({ instance: cardInst, owner: player });
          }
        }
      } else if (source === 'PLAYER_DECK') {
        for (const cardInst of player.deck) {
          if (matchesCardFilter(cardInst.card, filter, { player, state })) {
            candidates.push({ instance: cardInst, owner: player });
          }
        }
      }

      if (candidates.length === 0) {
        return {
          state,
          success: true,
          mutatedState: false,
          onomatopoeia: 'NO TARGET FOUND',
        };
      }

      // Check Option B: Direct targeted play when targetInstanceId is pre-supplied (e.g. from tests or bot)
      if (context.chosenTargetInstanceId) {
        const matched = candidates.find(
          (c) => c.instance.instanceId === context.chosenTargetInstanceId,
        );
        if (matched) {
          const chosenCard = matched.instance;
          const ownerPlayer = matched.owner;

          // Splice from owner's discard/source
          const spliceIdx = ownerPlayer.discard.findIndex(
            (c) => c.instanceId === chosenCard.instanceId,
          );
          if (spliceIdx !== -1) {
            ownerPlayer.discard.splice(spliceIdx, 1);
          }

          // Track owner for cross-player control per RR v1.8 p. 11
          chosenCard.ownerId = ownerPlayer.id;

          // Reset transient gameplay state and ensure card enters ready (RR v1.8 p. 11, 24)
          resetCardState(chosenCard);
          chosenCard.exhausted = false;

          // Move into controller's tableau / allies
          if (chosenCard.card.type === CardType.ALLY) {
            applyToughnessOnEntry(chosenCard);
            player.allies.push(chosenCard);
          } else {
            player.tableau.push(chosenCard);
          }

          initializeCardUses(chosenCard);

          // Dispatch ENTERS_PLAY only — card is put into play, NOT played (RR v1.8 p.21)
          // CARD_PLAYED does NOT fire here (no cost was paid via the play action)
          dispatchTrigger(state, 'ENTERS_PLAY', {
            targetPlayerId: player.id,
            sourceInstanceId: chosenCard.instanceId,
          });

          const onomatopoeia = `PLAYED ${chosenCard.card.name.toUpperCase()}!`;
          state.log.push({
            id: `log_${Date.now()}`,
            timestamp: Date.now(),
            round: state.roundNumber,
            phase: state.phase,
            category: 'ability',
            key: 'card.playFromZone',
            params: {
              player: player.name,
              card: chosenCard.card.name,
              source,
            },
            onomatopoeia,
          });

          return {
            state,
            success: true,
            mutatedState: true,
            onomatopoeia,
          };
        }
      }

      // Option A: If only 1 candidate or no pre-supplied target, enqueue a Decision Prompt
      const available = getAvailableResources(player, state).total;
      const allyLimit = getPlayerAllyLimit(state, player.id);
      const isAllyLimitReached = player.allies.length >= allyLimit;

      const filteredCandidates = candidates.filter((c) => {
        const cost = c.instance.card.cost ?? 0;
        if (cost > available) return false;

        if (c.instance.card.type === CardType.ALLY && isAllyLimitReached) {
          return false;
        }

        if (c.instance.card.isUnique) {
          for (const p of state.players || []) {
            for (const inPlay of [...(p.allies || []), ...(p.tableau || [])]) {
              if (
                inPlay.card.code === c.instance.card.code ||
                inPlay.card.name.toLowerCase().trim() === c.instance.card.name.toLowerCase().trim()
              ) {
                return false;
              }
            }
          }
          if (!checkUniqueCardPlayable(state, c.instance.card).allowed) {
            return false;
          }
        }

        return true;
      });

      const options: DecisionPromptOption[] = filteredCandidates.map((c) => {
        const cost = c.instance.card.cost ?? 0;
        return {
          id: c.instance.instanceId,
          label: `${c.instance.card.name} (Cost: ${cost}${c.owner.id !== player.id ? `, Owner: ${c.owner.name}` : ''})`,
          description:
            c.instance.card.text || `Play ${c.instance.card.name} from ${c.owner.name}'s discard`,
          effect: 'PLAY_CARD_FROM_ZONE_RESOLUTION',
          requiresPayment: cost > 0,
          params: {
            chosenInstanceId: c.instance.instanceId,
            ownerId: c.owner.id,
            source,
            destination,
            control,
            costMode,
            costReduction,
            requiresPayment: cost > 0,
            resourceCost: { amount: cost },
            costCardInstanceId: c.instance.instanceId,
            cardInstance: c.instance,
          },
        };
      });

      options.push({
        id: 'pass_play_from_zone',
        label: 'Pass / Cancel',
        description: 'Do not play a card',
        effect: 'PLAY_CARD_FROM_ZONE_PASS',
        params: {},
      });

      const prompt: PendingDecisionPrompt = {
        promptId: `prompt_play_from_zone_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        playerId: player.id,
        title: promptTitle,
        description: 'Choose a card to pay for and play into your tableau:',
        sourceCardName: context.sourceCardInstance?.card.name || 'Make the Call',
        sourceCardCode: context.sourceCardInstance?.card.code,
        sourceCardInstanceId: context.sourceCardInstance?.instanceId,
        options,
        isVoluntary: true,
      };

      const enqueuedState = enqueueDecisionPrompt(state, prompt);
      return {
        state: enqueuedState,
        success: true,
        onomatopoeia: 'CHOOSE CARD TO PLAY!',
      };
    }

    case 'MODIFY_RESTRICTED_LIMIT':
    case 'MODIFY_ALLY_LIMIT': {
      // Evaluated as constant modifier in legality-checker getPlayerAllyLimit
      return {
        state,
        success: true,
        mutatedState: false,
        onomatopoeia: 'ALLY LIMIT UPDATED!',
      };
    }

    default:
      return { state, success: true, onomatopoeia: 'RESOLVED!' };
  }
}
