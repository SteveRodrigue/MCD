import { evaluateStepGate } from '../pipeline/step-gate-evaluator';
import {
  GameState,
  CardInstance,
  StatusCard,
  CardAbility,
  AbilityStep,
  StepGate,
  StepFacts,
  StepResolutionResult,
  DecisionPromptOption,
  DistributionPromptConfig,
  TargetAllocationItem,
  NormalizedCard,
  PlayerState,
  VillainState,
  getActiveVillain,
  getActiveMainScheme,
  getVillainsInPlay,
  getVillainById,
  PendingSequence,
  DamagedCharacter,
} from '@engine/models';
import { matchesCardFilter, type FilterSubject } from '../filters/card-filter';
import { resolveActiveEncounterCardAfterInterrupt } from '../pipeline/villain-phase';
import { getStepEffectParams, getStepGateParams } from '../../data/supplemental/runtime';
import {
  discardFromEncounterDeckUntil,
  exhaustPlayerDeck,
  checkAndResetPlayerDeck,
  exhaustEncounterDeck,
  checkDeckExhaustionInvariants,
} from '../pipeline/deck-exhaustion';
import { dealSurgeCard } from '../pipeline/surge';
import { canCancelEncounterReveal } from '../pipeline/encounter-cancel';
import { chooseStepTarget } from './target-choice';
import { enqueueDecisionPrompt, peekDecisionPrompt } from '../pipeline/prompt-queue';
import { getAttackOutcomeFacts } from '../pipeline/combat-pipeline';
import {
  applyDamageToTarget,
  defeatMinionsBeyondHitPoints,
  type DamageRequest,
  type DamageResult,
  type TargetEntityRef,
} from '../pipeline/damage-pipeline';
import { recordAbilityUsage } from '../pipeline/stats';
import {
  getEffectiveMinionHitPoints,
  hasEntityKeyword,
  consumeEntityStatusCards,
  isEntityIncapacitatedByStatus,
} from '../pipeline/stat-calculator';
import {
  dispatchTrigger,
  matchesTriggerFilter,
  type AttackSource,
} from '../triggers/trigger-dispatcher';
import { TriggerCallNode } from '../errors/infinite-loop-error';
import '../specials/wakanda-forever';
import { removeCardFromAllZones } from '../state/state-validator';
import { cardCatalog } from '../../data/importer/card-loader';
import { nextEngineId, randomInt } from '../state/rng';

/**
 * Narrows resolved targets with an optional UniversalCardFilter (ADR-0046) so that EXHAUST and READY
 * honor the `filter` parameter the Card Editor already offers (Issue #158).
 */
export function filterResolvedTargets(
  state: GameState,
  targets: ResolvedTarget[],
  filter: Record<string, any> | undefined,
  player: PlayerState,
): ResolvedTarget[] {
  if (!filter) return targets;
  return targets.filter((t) => {
    let subject: FilterSubject | undefined;
    if (t.kind === 'card') {
      subject = t.entity;
    } else if (t.kind === 'player') {
      subject = t.entity.activeFormCard;
    } else if (t.kind === 'character') {
      if (t.entityType === 'hero' || t.entityType === 'alter_ego') {
        subject = (t.entity as PlayerState).activeFormCard;
      } else {
        subject = t.entity as VillainState | CardInstance;
      }
    }
    return subject ? matchesCardFilter(subject, filter, { player, state }) : false;
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
  isThwart?: boolean;
  /**
   * The resolving ability is labelled "(thwart)": its threat removal is a thwart by the player's identity
   * (RR v1.8 glossary L). One labelled ability is one thwart, however many threat removal instances.
   */
  labelledThwart?: boolean;
  /** The first scheme a labelled thwart targeted; THWART_RESOLVED is dispatched for it, once. */
  thwartedScheme?: { targetType: 'main_scheme' | 'side_scheme'; instanceId?: string };
  thwartResolvedDispatched?: boolean;
  accumulatedThreatRemoved?: number;
  /**
   * Keywords the resolving ability granted to its own attack (`GRANT_ATTACK_KEYWORD`). Lives on
   * this context only, so it ends with the ability and never reaches a card, a player or the state.
   */
  grantedAttackKeywords?: string[];
  isFinalStep?: boolean;
  discardedCards?: CardInstance[];
  assignments?: Record<string, number>;
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
import { resolvePlayerTargets, type ResolvedTarget } from './target-resolver';

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
  facts?: StepFacts;
  discardedCards?: CardInstance[];
  /** An attack step started an attack that is still open (a prompt is pending); its facts arrive on resume (#295). */
  attackPending?: boolean;
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

import { checkAndDiscardZeroCounterCard } from '../pipeline/cost-engine';
import { appendLog } from '../state/game-log';
// Loaded last: handler modules import the pipeline, whose init order depends on this file's imports
import { EFFECT_HANDLERS } from './handlers';
import type { StepHandler } from './handlers/types';
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

  // A hit point bonus that left with the card may leave a minion with damage at its new maximum.
  defeatMinionsBeyondHitPoints(state);

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
      if (targetPlayer.deckEmptiedWithEmptyDiscard && targetPlayer.discard.length > 0) {
        targetPlayer.deckEmptiedWithEmptyDiscard = false;
        exhaustPlayerDeck(state, targetPlayer.id);
      }
    }
  }
}

/**
 * Cancels the reveal in progress: the encounter card's When Revealed effects do not resolve
 * (steps declared `cannotBeCanceled` still do). With `discardCard` the card is also discarded and
 * does not enter play. Returns a failed result when there is nothing to cancel.
 */
export function cancelActiveEncounterReveal(
  state: GameState,
  discardCard: boolean,
): EffectResult | null {
  const encounter = state.activeEncounterContext;
  if (!encounter) return { state, success: false, error: 'No encounter card is being revealed' };
  if (!canCancelEncounterReveal(encounter.encounterCard)) {
    return { state, success: false, error: 'The reveal of this card cannot be canceled' };
  }
  encounter.cancelled = true;
  if (discardCard) encounter.discardCard = true;
  return null;
}

/**
 * Returns the in-play zone entity that stands for `source`, so effects mutate the real host
 * instead of a reveal-time copy. Side schemes live as `SideSchemeState` in `state.sideSchemes`.
 */
export function resolveSourceHostZone(
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
  // Facedown boost cards the host held leave play with it (#263).
  if (hostCard.facedownBoostCards?.length) {
    state.encounterDiscard.push(...hostCard.facedownBoostCards);
    delete hostCard.facedownBoostCards;
  }

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

        appendLog(state, {
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
  appendLog(state, {
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
        const mHp = getEffectiveMinionHitPoints(state, m);
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
function shouldExecuteStep(
  stepOrGate: AbilityStep | StepGate | undefined,
  prevResult: StepResolutionResult | undefined,
  state: GameState,
  stepOrContext: AbilityStep | EffectExecutionContext,
  contextOrMap?: EffectExecutionContext | Map<string, StepResolutionResult>,
  stepResultsMap?: Map<string, StepResolutionResult>,
): boolean {
  if (typeof stepOrGate === 'object' && stepOrGate !== null && 'effect' in stepOrGate) {
    return evaluateStepGate(
      stepOrGate as AbilityStep,
      prevResult,
      state,
      stepOrContext as EffectExecutionContext,
      contextOrMap as Map<string, StepResolutionResult> | undefined,
    );
  }
  return evaluateStepGate(
    stepOrContext as AbilityStep,
    prevResult,
    state,
    contextOrMap as EffectExecutionContext,
    stepResultsMap,
  );
}

/** How a DEAL_DAMAGE step hands its damage to the pipeline (#247). */
export interface AbilityDamageOptions {
  sourceType?: DamageRequest['sourceType'];
  sourcePlayerId: string;
  sourceCardInstance?: CardInstance;
  isAttack: boolean;
  hasPiercing: boolean;
  triggerChain?: TriggerCallNode[];
}

export function villainTargetRef(villain: VillainState): TargetEntityRef {
  return {
    type: 'villain',
    entity: villain,
    name: villain.card.name,
    attachments: villain.attachments,
    statusCards: villain.statusCards,
  };
}

export function minionTargetRef(minion: CardInstance, controllerId: string): TargetEntityRef {
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

export function allyTargetRef(ally: CardInstance, controllerId: string): TargetEntityRef {
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

export function playerTargetRef(player: PlayerState): TargetEntityRef {
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
export function applyAbilityDamage(
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
export function dealDamageToIdentity(
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

/**
 * Applies a distribution of damage (DISTRIBUTE_AMOUNT, domain DAMAGE): every portion goes through
 * the damage pipeline, so Tough, damage shields, DAMAGE_TAKEN interrupts, defeat and its triggers
 * are the ones of any other damage. The source card is the defeat source (#296).
 */
export function applyDistributedDamage(
  state: GameState,
  assignments: Record<string, number>,
  player: PlayerState,
  sourceCardInstance?: CardInstance,
): GameState {
  const opts: AbilityDamageOptions = {
    sourceType: 'CARD_EFFECT',
    sourcePlayerId: player.id,
    sourceCardInstance,
    isAttack: false,
    hasPiercing: false,
  };
  for (const [targetId, amount] of Object.entries(assignments)) {
    if (!(amount > 0)) continue;

    const allyOwner = state.players.find((p) => p.allies.some((a) => a.instanceId === targetId));
    const ally = allyOwner?.allies.find((a) => a.instanceId === targetId);
    if (allyOwner && ally) {
      state = applyAbilityDamage(state, allyTargetRef(ally, allyOwner.id), amount, opts).state;
      continue;
    }

    const targetPlayer = state.players.find(
      (pl) =>
        pl.id === targetId || pl.activeFormCard?.code === targetId || pl.hero?.code === targetId,
    );
    if (targetPlayer) {
      state = dealDamageToIdentity(state, targetPlayer, amount, opts);
      continue;
    }

    // A chosen villain is resolved by id so any villain in play can be targeted.
    const villain =
      targetId === 'villain' ? getActiveVillain(state) : getVillainById(state, targetId);
    if (villain) {
      state = applyAbilityDamage(state, villainTargetRef(villain), amount, opts).state;
      continue;
    }

    for (const p of state.players) {
      const minion = p.engagedMinions.find((m) => m.instanceId === targetId);
      if (minion) {
        state = applyAbilityDamage(state, minionTargetRef(minion, p.id), amount, opts).state;
        break;
      }
    }
  }
  return state;
}

/**
 * Why a submitted distribution is not legal, or undefined when it is: every portion goes to an
 * eligible target and is at most that target's cap (a character takes at most its remaining HP),
 * and the total is the budget (at most the budget when an exact match is not required).
 */
export function validateDistributionAssignments(
  config: DistributionPromptConfig,
  assignments: Record<string, number>,
): string | undefined {
  let total = 0;
  for (const [targetId, amount] of Object.entries(assignments)) {
    if (!(amount > 0)) {
      if (amount < 0 || Number.isNaN(amount)) return `Invalid amount for ${targetId}`;
      continue;
    }
    if (!Number.isInteger(amount)) return `Invalid amount for ${targetId}`;
    const target = config.targets.find((t) => t.instanceId === targetId);
    if (!target || target.isEligible === false) return `${targetId} is not a legal target`;
    if (amount > (target.allocationCap ?? 0)) {
      return `${target.name} can take at most ${target.allocationCap ?? 0}`;
    }
    total += amount;
  }
  if (
    config.exactMatchRequired !== false
      ? total !== config.effectiveBudget
      : total > config.effectiveBudget
  ) {
    return `Assign ${config.effectiveBudget} in total (assigned ${total})`;
  }
  return undefined;
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
export function dealDamageToEnemies(
  state: GameState,
  amount: number,
  minionOwners: PlayerState[],
  opts: AbilityDamageOptions,
): GameState {
  state = applyAbilityDamage(state, villainTargetRef(getActiveVillain(state)), amount, opts).state;
  return dealDamageToMinions(state, amount, minionOwners, opts);
}

function pushPendingSequence(state: GameState, sequence: PendingSequence): void {
  if (!state.pendingSequences) {
    state.pendingSequences = [];
  }
  state.pendingSequences.push(sequence);
}

function popPendingSequence(state: GameState): PendingSequence | undefined {
  return state.pendingSequences?.pop();
}

function peekPendingSequence(state: GameState): PendingSequence | undefined {
  if (!state.pendingSequences || state.pendingSequences.length === 0) return undefined;
  return state.pendingSequences[state.pendingSequences.length - 1];
}

export function hasPendingSequence(state: GameState): boolean {
  return Boolean(state.pendingSequences && state.pendingSequences.length > 0);
}

/**
 * The attack that paused a sequence is over: its damage facts join the result of the step that
 * started it, which the remaining steps read as their previous result (#295).
 */
function joinAttackOutcome(state: GameState, pending: PendingSequence): void {
  const facts = getAttackOutcomeFacts(state);
  if (pending.previousResult) {
    pending.previousResult = {
      ...pending.previousResult,
      facts: { ...(pending.previousResult.facts as StepFacts), ...facts },
    };
  }
  const fromContext = pending.context.previousResult as StepResolutionResult | undefined;
  if (fromContext) {
    pending.context.previousResult = { ...fromContext, facts: { ...fromContext.facts, ...facts } };
  }
}

export function resumePendingSequence(state: GameState): GameState {
  let currentState = state;
  while (!peekDecisionPrompt(currentState) && hasPendingSequence(currentState)) {
    // The attack that paused the sequence is still open: its remaining steps keep waiting (#295).
    if (
      peekPendingSequence(currentState)?.awaitsAttackOutcome &&
      currentState.activeAttackContext
    ) {
      break;
    }
    const pending = popPendingSequence(currentState);
    if (!pending) break;
    if (pending.awaitsAttackOutcome) joinAttackOutcome(currentState, pending);
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
      finishLabelledThwart(currentState, pending.context as EffectExecutionContext);
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
  appendLog(state, {
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
    lastExecutedResult?: StepResolutionResult;
    stepResultsMap?: Map<string, StepResolutionResult>;
    onomatopoeias?: string[];
    anyStepMutated?: boolean;
  },
): EffectResult {
  let currentState = state;
  let lastStepResult: StepResolutionResult | undefined =
    resumeState?.prevResult ?? context.previousResult;
  let lastExecutedResult: StepResolutionResult | undefined =
    resumeState?.lastExecutedResult ??
    (context.previousResult?.skipped ? undefined : context.previousResult);
  let anyStepMutated = resumeState?.anyStepMutated ?? false;
  let accumulatedFacts: StepFacts = {};
  const stepResultsMap = resumeState?.stepResultsMap ?? new Map<string, StepResolutionResult>();
  const onomatopoeias: string[] = resumeState?.onomatopoeias ? [...resumeState.onomatopoeias] : [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const shouldRun = shouldExecuteStep(
      step,
      lastStepResult,
      currentState,
      context,
      stepResultsMap,
    );
    if (!shouldRun) {
      const skippedResult: StepResolutionResult = {
        success: false,
        mutatedState: false,
        skipped: true,
      };
      if (step.id) {
        stepResultsMap.set(step.id, skippedResult);
      }
      lastStepResult = skippedResult;
      continue;
    }

    const effectParams = getStepEffectParams(step);
    const gateParams = getStepGateParams(step);
    const normalizedStep: AbilityStep = {
      ...step,
      effectParams,
      gateParams,
    };

    const isDistinctFromPrevious = effectParams.distinctFrom === 'PREVIOUS_TARGET';

    const stepContext: EffectExecutionContext = {
      ...context,
      sourceCardInstance: (step as any).sourceCardInstance ?? context.sourceCardInstance,
      isFinalStep:
        (step as any).isFinalStep ?? (i === steps.length - 1 ? context.isFinalStep : false),
      previousResult: lastExecutedResult,
      distinctFromId: isDistinctFromPrevious
        ? lastExecutedResult?.targetId || context.chosenTargetInstanceId
        : context.distinctFromId,
      chosenTargetInstanceId: isDistinctFromPrevious
        ? undefined
        : effectParams.target === 'PREVIOUS_TARGET'
          ? (lastExecutedResult?.targetId ?? context.chosenTargetInstanceId)
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
    if (stepContext.grantedAttackKeywords) {
      context.grantedAttackKeywords = stepContext.grantedAttackKeywords;
    }
    if (stepContext.attackedEnemy && !context.attackedEnemy) {
      context.attackedEnemy = stepContext.attackedEnemy;
    }
    if (stepContext.thwartedScheme && !context.thwartedScheme) {
      context.thwartedScheme = stepContext.thwartedScheme;
    }
    if (stepContext.accumulatedThreatRemoved !== undefined) {
      context.accumulatedThreatRemoved = stepContext.accumulatedThreatRemoved;
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

    const amountZero = !stepMutated || (res.value ?? 0) === 0;
    const stepFacts: StepFacts = {
      ...res.facts,
      amountZero,
    };

    const stepRes: StepResolutionResult = {
      success: res.success,
      mutatedState: stepMutated,
      value: res.value,
      targetId:
        res.targetId || res.selectedCardInstanceIds?.[0] || stepContext.chosenTargetInstanceId,
      discardedCards: res.discardedCards ?? lastExecutedResult?.discardedCards,
      facts: stepFacts,
    };

    lastStepResult = stepRes;
    lastExecutedResult = stepRes;
    accumulatedFacts = {
      ...accumulatedFacts,
      ...stepFacts,
    };

    if (step.id) {
      stepResultsMap.set(step.id, stepRes);
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
          previousResult: lastExecutedResult,
        },
        previousResult: lastStepResult,
        stepResultsMap: Object.fromEntries(stepResultsMap.entries()),
        onomatopoeias,
        anyStepMutated,
        ...(res.attackPending ? { awaitsAttackOutcome: true } : {}),
      });

      return {
        state: currentState,
        success: true,
        mutatedState: anyStepMutated,
        value: lastExecutedResult?.value,
        facts:
          Object.keys(accumulatedFacts).length > 0 ? accumulatedFacts : lastExecutedResult?.facts,
        onomatopoeia: onomatopoeias.length > 0 ? onomatopoeias.join(' ➔ ') : 'SEQUENCE PAUSED',
      };
    }
  }

  return {
    state: currentState,
    success: true,
    mutatedState: anyStepMutated,
    value: lastExecutedResult?.value,
    facts: Object.keys(accumulatedFacts).length > 0 ? accumulatedFacts : lastExecutedResult?.facts,
    onomatopoeia: onomatopoeias.length > 0 ? onomatopoeias.join(' ➔ ') : 'SEQUENCE RESOLVED!',
  };
}

/**
 * Result fields of a step that started an enemy attack (#295): the facts when the attack already
 * ended, or the pending flag when it waits for a prompt (the facts join the result on resume).
 */
export function attackOutcome(
  state: GameState,
  attacked: boolean,
): Pick<EffectResult, 'facts' | 'attackPending'> {
  if (!attacked) return {};
  if (state.activeAttackContext) return { attackPending: true };
  return { facts: getAttackOutcomeFacts(state) };
}

export function recordAttackedEnemy(
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
  const attackSource: AttackSource = { kind: 'HERO', playerId: context.playerId };
  dispatchTrigger(
    state,
    'ATTACK_RESOLVED',
    enemy.targetType === 'villain'
      ? { targetPlayerId: context.playerId, targetType: 'villain', attackSource }
      : {
          targetPlayerId: context.playerId,
          targetType: 'minion',
          targetInstanceId: enemy.instanceId,
          attackSource,
        },
  );
}

/**
 * After a labelled "(thwart)" ability has fully resolved: THWART_RESOLVED for the thwarted scheme,
 * once, as a basic thwart does (RR v1.8 glossary L & T).
 */
function finishLabelledThwart(state: GameState, context: EffectExecutionContext): void {
  if (
    !context.labelledThwart ||
    context.thwartResolvedDispatched ||
    (!context.thwartedScheme && !context.accumulatedThreatRemoved)
  ) {
    return;
  }
  context.thwartResolvedDispatched = true;
  const player = state.players.find((p) => p.id === context.playerId) || state.players[0];
  const scheme = context.thwartedScheme;
  dispatchTrigger(state, 'THWART_RESOLVED', {
    targetPlayerId: context.playerId,
    targetType: scheme?.targetType || 'main_scheme',
    targetInstanceId: scheme?.instanceId,
    threatAmount: context.accumulatedThreatRemoved || 0,
    sourceInstanceId: context.playerId,
    sourceCardCode: player?.activeFormCard?.code,
  });
}

/**
 * Executes a declarative effect or ability on the GameState.
 */
function executeEffectInternal(
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

  // Status Cancellation for Labeled Abilities (RR v1.8 p. 17, 28)
  const abilityLabels =
    'labels' in abilityOrStep ? (abilityOrStep as CardAbility).labels : undefined;
  if (abilityLabels && abilityLabels.length > 0) {
    const player = state.players.find((p) => p.id === context.playerId) || state.players[0];
    const willCancelAttack =
      abilityLabels.includes('ATTACK') && isEntityIncapacitatedByStatus(player, StatusCard.STUNNED);
    const willCancelThwart =
      abilityLabels.includes('THWART') &&
      isEntityIncapacitatedByStatus(player, StatusCard.CONFUSED);

    if (willCancelAttack || willCancelThwart) {
      let onom = 'STATUS CLEARED!';
      if (willCancelAttack) {
        consumeEntityStatusCards(player, StatusCard.STUNNED);
        onom = 'STUN CLEARED!';
        appendLog(state, {
          key: 'status.stunned.cleared',
          params: { player: player.name },
          onomatopoeia: 'STUN CLEARED!',
        });
      }
      if (willCancelThwart) {
        consumeEntityStatusCards(player, StatusCard.CONFUSED);
        onom = 'CONFUSION CLEARED!';
        appendLog(state, {
          key: 'status.confused.cleared',
          params: { player: player.name },
          onomatopoeia: 'CONFUSION CLEARED!',
        });
      }
      if (willCancelAttack && willCancelThwart) {
        onom = 'STUN & CONFUSION CLEARED!';
      }
      return {
        state,
        success: true,
        onomatopoeia: onom,
        mutatedState: true,
      };
    }
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
    const hasAttack = (abilityOrStep as CardAbility).labels?.includes('ATTACK');
    const hasThwart = (abilityOrStep as CardAbility).labels?.includes('THWART');
    const hasDefense = (abilityOrStep as CardAbility).labels?.includes('DEFENSE');

    if (hasDefense && state.activeAttackContext) {
      if (state.activeAttackContext.defender?.type !== 'ALLY') {
        const player = state.players.find((p) => p.id === context.playerId) || state.players[0];
        state.activeAttackContext.heroDefended = true;
        state.activeAttackContext.defender = { type: 'HERO', playerId: player.id };
      }
    }

    if (hasAttack || hasThwart) {
      // An "(attack)" or "(thwart)" ability is performed by the player's identity (RR v1.8 glossary L)
      if (hasAttack) {
        context.isAttack = true;
        context.labelledAttack = true;
      }
      if (hasThwart) {
        context.isThwart = true;
        context.labelledThwart = true;
      }
      const pendingBefore = state.pendingSequences?.length ?? 0;
      const res = executeSequence(state, abilityOrStep.steps, context);
      if ((res.state.pendingSequences?.length ?? 0) <= pendingBefore) {
        if (hasAttack) {
          finishLabelledAttack(res.state, context);
        }
        if (hasThwart) {
          finishLabelledThwart(res.state, context);
        }
      }
      return res;
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
 * Executes a declarative effect or ability on the GameState.
 * Enforces deck exhaustion invariants upon effect completion (RR v1.8 p. 11, 18).
 */
export function executeEffect(
  state: GameState,
  abilityOrStep: CardAbility | AbilityStep,
  context: EffectExecutionContext,
): EffectResult {
  const result = executeEffectInternal(state, abilityOrStep, context);
  if (result.state) {
    checkDeckExhaustionInvariants(result.state);
    if (result.success) recordDeclaredAbilityUsage(result.state, abilityOrStep, context);
  }
  return result;
}

/**
 * Counts a resolved ability (#315) only when the source card declares an ability with that id, so
 * synthetic prompt abilities and step ids never create stats entries.
 */
function recordDeclaredAbilityUsage(
  state: GameState,
  abilityOrStep: CardAbility | AbilityStep,
  context: EffectExecutionContext,
): void {
  const abilityId = abilityOrStep.id;
  if (!abilityId) return;
  const sourceCard =
    context.sourceCardInstance?.card ??
    (context.sourceCardId
      ? (cardCatalog.getCard(context.sourceCardId) ??
        findAnyCardInstance(state, context.sourceCardId)?.card)
      : undefined);
  if (sourceCard?.enrichment?.abilities?.some((a) => a.id === abilityId)) {
    recordAbilityUsage(state, sourceCard.code, abilityId);
  }
}

function findAnyCardInstance(state?: GameState, idOrCode?: string): CardInstance | undefined {
  if (!state || !idOrCode) return undefined;
  for (const p of state.players || []) {
    const found =
      p.tableau?.find((c) => c.instanceId === idOrCode || c.card.code === idOrCode) ||
      p.hand?.find((c) => c.instanceId === idOrCode || c.card.code === idOrCode) ||
      p.discard?.find((c) => c.instanceId === idOrCode || c.card.code === idOrCode) ||
      p.deck?.find((c) => c.instanceId === idOrCode || c.card.code === idOrCode) ||
      p.allies?.find((c) => c.instanceId === idOrCode || c.card.code === idOrCode) ||
      p.obligations?.find((c) => c.instanceId === idOrCode || c.card.code === idOrCode);
    if (found) return found;
  }
  const encFound =
    state.encounterDiscard?.find((c) => c.instanceId === idOrCode || c.card.code === idOrCode) ||
    state.encounterDeck?.find((c) => c.instanceId === idOrCode || c.card.code === idOrCode) ||
    state.removedFromGame?.find((c) => c.instanceId === idOrCode || c.card.code === idOrCode);
  if (encFound) return encFound;
  return undefined;
}

/**
 * Dynamic prompt title, description, and source card metadata generator for tableau discard prompts (Issue #233).
 */
function getTableauDiscardPromptMeta(
  filter?: any,
  sourceCardInstance?: CardInstance,
  sourceCardId?: string,
  state?: GameState,
): { title: string; description: string; sourceCardName: string; sourceCardCode?: string } {
  const resolvedInstance =
    sourceCardInstance ||
    (sourceCardId ? findAnyCardInstance(state, sourceCardId) : undefined) ||
    state?.activeEncounterContext?.encounterCard;

  const sourceCardName =
    resolvedInstance?.card?.name ||
    (sourceCardId ? cardCatalog.getCard(sourceCardId)?.name : undefined) ||
    'Encounter Card';

  const sourceCardCode =
    resolvedInstance?.card?.code ||
    (sourceCardId && cardCatalog.getCard(sourceCardId) ? sourceCardId : undefined);

  const rawTraits = filter?.traits || (filter?.trait ? [filter.trait] : []);
  const traits = Array.isArray(rawTraits) ? rawTraits.filter(Boolean) : [];

  const rawTypes = filter?.types || (filter?.type ? [filter.type] : []);
  const types = (Array.isArray(rawTypes) ? rawTypes : [rawTypes])
    .filter(Boolean)
    .map((t: string) => String(t).toLowerCase());

  const hasUpgrade = types.includes('upgrade');
  const hasSupport = types.includes('support');

  if (traits.length > 0) {
    const traitStr = traits.join(' ');
    if (hasUpgrade && !hasSupport) {
      return {
        title: `Discard ${traitStr} Upgrade`,
        description: `Choose a ${traitStr} upgrade you control to discard:`,
        sourceCardName,
        sourceCardCode,
      };
    }
    if (hasSupport && !hasUpgrade) {
      return {
        title: `Discard ${traitStr} Support`,
        description: `Choose a ${traitStr} support you control to discard:`,
        sourceCardName,
        sourceCardCode,
      };
    }
    if (hasUpgrade && hasSupport) {
      return {
        title: `Discard ${traitStr} Upgrade or Support`,
        description: `Choose a ${traitStr} upgrade or support you control to discard:`,
        sourceCardName,
        sourceCardCode,
      };
    }
    return {
      title: `Discard ${traitStr} Card`,
      description: `Choose a ${traitStr} card you control to discard:`,
      sourceCardName,
      sourceCardCode,
    };
  }

  if (hasUpgrade && hasSupport) {
    return {
      title: 'Discard Upgrade or Support',
      description: 'Choose an upgrade or support you control to discard:',
      sourceCardName,
      sourceCardCode,
    };
  }

  if (hasUpgrade) {
    return {
      title: 'Discard Upgrade',
      description: 'Choose an upgrade you control to discard:',
      sourceCardName,
      sourceCardCode,
    };
  }

  if (hasSupport) {
    return {
      title: 'Discard Support',
      description: 'Choose a support you control to discard:',
      sourceCardName,
      sourceCardCode,
    };
  }

  return {
    title: 'Discard Card',
    description: 'Choose a card you control to discard:',
    sourceCardName,
    sourceCardCode,
  };
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
  const filter = params.filter as any;

  // 1. DISCARD FROM HAND
  if (source === 'HAND') {
    const resolved = resolvePlayerTargets(state, params.target as any, context);
    const targetPlayers = resolved.length > 0 ? resolved : [player];
    const isRandom = mode === 'RANDOM';
    const discardedCards: CardInstance[] = [];

    for (const targetPlayer of targetPlayers) {
      const candidates = filter
        ? targetPlayer.hand.filter((c) => matchesCardFilter(c, filter, { player: targetPlayer }))
        : [...targetPlayer.hand];
      const toDiscardCount = isCountAll ? candidates.length : Math.min(count, candidates.length);
      const chosen: CardInstance[] = [];
      for (let i = 0; i < toDiscardCount; i++) {
        const idx = isRandom ? randomInt(state, candidates.length) : 0;
        chosen.push(...candidates.splice(idx, 1));
      }
      if (chosen.length === 0) continue;

      for (const discarded of chosen) {
        const handIdx = targetPlayer.hand.indexOf(discarded);
        targetPlayer.hand.splice(handIdx, 1);
        targetPlayer.discard.push(discarded);
        discardedCards.push(discarded);
      }
      appendLog(state, {
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

    // RR v1.8 "Player Deck": if deck is already empty, reset it; no further cards are discarded from the new deck.
    if (player.deck.length === 0) {
      checkAndResetPlayerDeck(state, player.id);
      return {
        state,
        success: true,
        mutatedState: true,
        value: 0,
        discardedCards: [],
        onomatopoeia: 'DECK RESHUFFLED!',
      };
    }

    for (let i = 0; i < count; i++) {
      const card = player.deck.shift();
      if (card) {
        if (matchingDestination && filter && matchesCardFilter(card, filter, { player })) {
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

        // RR v1.8 "Player Deck": a deck that empties while discarding is reset, but no further card
        // is discarded from the new deck.
        if (player.deck.length === 0) {
          checkAndResetPlayerDeck(state, player.id);
          break;
        }
      }
    }
    if (discardedCards.length > 0) {
      appendLog(state, {
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
      appendLog(state, {
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
        matchesCardFilter(c, untilFilter, { player, state }),
      );
      if (found && matchingDestination === 'DISCARD') {
        state.encounterDiscard.push(found);
      }
      if (discarded.length > 0) {
        appendLog(state, {
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
    // RR v1.8 "Encounter Deck": if deck is already empty, reset it; do not continue discard with the newly shuffled deck.
    if (state.encounterDeck.length === 0) {
      exhaustEncounterDeck(state);
      return {
        state,
        success: true,
        mutatedState: true,
        value: 0,
        discardedCards: [],
        onomatopoeia: 'ENCOUNTER DECK RESHUFFLED!',
      };
    }

    let discardedCount = 0;
    const discardedCards: CardInstance[] = [];
    for (let i = 0; i < count; i++) {
      const card = state.encounterDeck.shift();
      if (card) {
        state.encounterDiscard.push(card);
        discardedCards.push(card);
        discardedCount++;
        if (state.encounterDeck.length === 0) {
          exhaustEncounterDeck(state);
          break;
        }
      }
    }
    if (discardedCount > 0) {
      appendLog(state, {
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
        appendLog(state, {
          category: 'combat',
          key: 'player.tableau.discarded',
          params: { who: player.name, player: player.name, card: targetCard.card.name },
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
      (inst) => !filter || matchesCardFilter(inst, filter, { player, state }),
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
      appendLog(state, {
        category: 'combat',
        key: 'player.tableau.discarded',
        params: { who: player.name, player: player.name, card: targetCard.card.name },
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

    const promptMeta = getTableauDiscardPromptMeta(
      filter,
      context.sourceCardInstance,
      context.sourceCardId,
      state,
    );

    enqueueDecisionPrompt(state, {
      promptId: nextEngineId(state, 'prompt_discard_tableau'),
      playerId: player.id,
      title: promptMeta.title,
      description: promptMeta.description,
      sourceCardName: promptMeta.sourceCardName,
      sourceCardCode: promptMeta.sourceCardCode,
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

  const handler: StepHandler | undefined = EFFECT_HANDLERS[step.effect];
  // An effect without a handler must fail loudly, never resolve as a silent no-op
  if (!handler) throw new Error(`executeStep: no handler for effect '${String(step.effect)}'`);
  return handler(state, step, context, player);
}
