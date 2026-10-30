import { abilitiesRunOnPlay, type EffectType } from '../../data/supplemental/runtime';
import type { TargetSelector, UniversalCardFilter } from '../../data/supplemental/schema';
import { bindKernel, kernel } from '../kernel';
import type {
  AbilityStep,
  CardAbility,
  CardInstance,
  DecisionPromptOption,
  GameState,
  PlayerState,
  VillainState,
} from '../models';
import { StatusCard } from '../models';
import {
  getEffectiveMaxHealth,
  getEffectivePlayerTraits,
  hasEntityKeyword,
  isEntityIncapacitatedByStatus,
} from '../pipeline/stat-calculator';
import { isImmuneToDamage } from '../pipeline/damage-immunity';
import { isStepGateClosedByState } from '../pipeline/step-gate-evaluator';
import {
  GUARD_BLOCK_REASON,
  getMainSchemeThreatBlock,
  isVillainAttackBlockedByGuard,
} from '../pipeline/target-restrictions';
import { nextEngineId } from '../state/rng';
import {
  getEligibleTargets,
  resolvePlayerTargets,
  resolveTargets,
  type ResolvedTarget,
} from './target-resolver';
import {
  attachMaxPerHost,
  cardCounterCount,
  cardsUnderneathHost,
  counterFilterCards,
  discardableHandCards,
  discardableTableauCards,
  holdsMatchingCounter,
  hostHasRoom,
  isAttachedAnywhere,
  isSchemeInPlay,
  namedSchemeCode,
  playerCounterCount,
  putIntoPlayCandidates,
  requestedStatuses,
  searchHasCards,
  stepTarget,
} from './step-selection';
import type { EffectExecutionContext } from './index';

/**
 * How the legality gate treats each target selector (ADR-0090). Exhaustive over the schema, so a new
 * selector fails `typecheck` until it is classified:
 * - CHOSEN: the player picks one target; candidates come from `getEligibleTargets`.
 * - FIXED: the ability names one target.
 * - GROUP: "each ...": valid while at least one member can be affected (RR v1.8 "Target").
 * - EVENT: the enemy or minion the triggering event named ("that enemy").
 * - DEPENDENT: a value an earlier step or the host produces at run time (`PREVIOUS_TARGET`,
 *   `HOST`); it cannot be judged before the ability runs, so it never blocks the ability.
 */
export type SelectorClass = 'CHOSEN' | 'FIXED' | 'GROUP' | 'EVENT' | 'DEPENDENT';

export const SELECTOR_CLASS: Readonly<Record<TargetSelector, SelectorClass>> = {
  SELF: 'FIXED',
  SELF_IDENTITY: 'FIXED',
  SELF_HERO: 'FIXED',
  ACTIVE_PLAYER: 'FIXED',
  FIRST_PLAYER: 'FIXED',
  ALL_PLAYERS: 'GROUP',
  DEFENDING_PLAYER: 'FIXED',
  ENGAGED_PLAYER: 'FIXED',
  ENGAGED_HERO: 'DEPENDENT',
  ALL_HEROES: 'GROUP',
  ALL_OTHER_HEROES: 'GROUP',
  ALL_HEROES_AND_ALLIES: 'GROUP',
  TRIGGERING_HERO: 'DEPENDENT',
  DAMAGED_CHARACTER: 'DEPENDENT',
  CHOSEN_PLAYER: 'CHOSEN',
  VILLAIN: 'FIXED',
  MAIN_SCHEME: 'FIXED',
  CHOSEN_SCHEME: 'CHOSEN',
  CHOSEN_ENEMY: 'CHOSEN',
  ALL_ENEMIES: 'GROUP',
  ENGAGED_ENEMIES: 'GROUP',
  ENGAGED_MINIONS: 'GROUP',
  CHOSEN_MINION: 'CHOSEN',
  CHOSEN_ENGAGED_MINION: 'CHOSEN',
  ALL_MINIONS: 'GROUP',
  CHOSEN_ALLY: 'CHOSEN',
  CHOSEN_CONTROLLED_ALLY: 'CHOSEN',
  ALL_CONTROLLED_ALLIES: 'GROUP',
  ALL_CONTROLLED_TABLEAU: 'GROUP',
  ALL_ALLIES: 'GROUP',
  CHOSEN_CHARACTER: 'CHOSEN',
  CHOSEN_CONTROLLED_CHARACTER: 'CHOSEN',
  ALL_CONTROLLED_CHARACTERS: 'GROUP',
  CHOSEN_FRIENDLY_CHARACTER: 'CHOSEN',
  ALL_FRIENDLY_CHARACTERS: 'GROUP',
  ALL_CHARACTERS: 'GROUP',
  CHOSEN_SIDE_SCHEME: 'CHOSEN',
  THIS_SIDE_SCHEME: 'FIXED',
  ALL_SIDE_SCHEMES: 'GROUP',
  ALL_SCHEMES: 'GROUP',
  TRIGGERING_SCHEME: 'DEPENDENT',
  PREVIOUS_TARGET: 'DEPENDENT',
  PREVIOUS_SELECTED_CARD: 'DEPENDENT',
  TRIGGERING_MINION: 'EVENT',
  TRIGGERING_ENEMY: 'EVENT',
  HOST: 'DEPENDENT',
  HOST_ENEMY: 'DEPENDENT',
};

/**
 * Player-chosen target selection (RR v1.8 "Target", "Choose (Game Element)", "Initiating Abilities").
 *
 * A step whose target is a single-target CHOSEN_* selector is resolved against the target the
 * player chose. When nobody has chosen yet, the valid targets are computed from the board at that
 * moment: 0 means the step does nothing, 1 is used without asking, 2 or more open a prompt whose
 * options re-run the same step with the chosen target.
 *
 * `CHOSEN_PLAYER` is a CHOSEN selector the gate judges (any player is a candidate) but this prompt
 * skips: the handlers that give a card, a resource or damage to a player open their own player
 * prompt.
 */
const PLAYER_CHOSEN_SELECTORS: ReadonlySet<string> = new Set(
  Object.entries(SELECTOR_CLASS)
    .filter(([selector, kind]) => kind === 'CHOSEN' && selector !== 'CHOSEN_PLAYER')
    .map(([selector]) => selector),
);

export type StepTargetChoice =
  | { kind: 'NOT_REQUIRED' }
  | { kind: 'CHOSEN'; targetInstanceId: string }
  | { kind: 'PROMPTED' }
  | { kind: 'NO_VALID_TARGET' };

const stepTargetSelector = (step: AbilityStep): string | undefined => {
  const target = step.effectParams?.target;
  return typeof target === 'string' && PLAYER_CHOSEN_SELECTORS.has(target) ? target : undefined;
};

/**
 * The first step of an ability the player must choose a target for, with its selector: the one
 * definition of "this step needs a target prompt" (#372). The legality gate judges these steps
 * (`judgedSelector` covers them), and the play-time prompts of abilities and events ask for the
 * same one. `isOpen` skips the steps whose state gate is closed.
 */
export function firstChosenTargetStep(
  steps: readonly AbilityStep[] | undefined,
  isOpen: (step: AbilityStep) => boolean = () => true,
): { step: AbilityStep; selector: string } | undefined {
  for (const step of steps ?? []) {
    const selector = stepTargetSelector(step);
    if (selector && isOpen(step)) return { step, selector };
  }
  return undefined;
}

/**
 * How a target is named in a choice prompt and which card it shows: the one description every
 * target prompt uses (an ability's, an event's, a step's and an attachment's host).
 */
export function describeTarget(target: ResolvedTarget): { label: string; cardCode?: string } {
  if (target.kind === 'player') {
    const p = target.entity;
    return { label: p.hero?.name || p.name, cardCode: p.activeFormCard?.code };
  }
  if (target.kind === 'scheme') {
    const scheme = target.entity;
    const name = scheme.card?.name ?? 'Target';
    return { label: `${name} (${scheme.threat ?? 0} Threat)`, cardCode: scheme.card?.code };
  }
  if (target.kind === 'character') {
    if (target.entityType === 'hero' || target.entityType === 'alter_ego') {
      const p = target.entity as PlayerState;
      const form =
        p.activeFormCard?.name ?? (p.currentForm === 'hero' ? p.hero.name : p.alterEgo.name);
      const heroName = p.hero?.name || p.name;
      return {
        label: heroName === form ? form : `${heroName} (${form})`,
        cardCode: p.activeFormCard?.code,
      };
    }
    const card = (target.entity as CardInstance | VillainState).card;
    const name = card?.name ?? 'Target';
    if (target.entityType === 'ally') {
      const owner = target.player?.hero?.name || target.player?.name;
      return {
        label: owner ? `${name} (${owner})` : name,
        cardCode: card?.code,
      };
    }
    return {
      label: name,
      cardCode: card?.code,
    };
  }
  const card = target.entity.card;
  return { label: card?.name ?? target.id, cardCode: card?.code };
}

/**
 * The options of a play-time target prompt (an ability's or an event's chosen target): one per
 * valid target, each carrying the params that resume the play with that target.
 */
export function targetChoiceOptions(
  targets: readonly ResolvedTarget[],
  sourceName: string,
  effect: 'EVENT_CHOSEN_TARGET' | 'ABILITY_CHOSEN_TARGET',
  params: Record<string, unknown>,
): DecisionPromptOption[] {
  const minionNameCounts = new Map<string, number>();
  for (const t of targets) {
    if (t.kind === 'character' && t.entityType === 'minion') {
      const name = (t.entity as CardInstance).card?.name ?? 'Minion';
      minionNameCounts.set(name, (minionNameCounts.get(name) || 0) + 1);
    }
  }

  return targets.map((target) => {
    let { label, cardCode } = describeTarget(target);
    if (
      target.kind === 'character' &&
      target.entityType === 'minion' &&
      target.player &&
      (minionNameCounts.get(label) || 0) > 1
    ) {
      const engagedHero = target.player.hero?.name || target.player.name;
      label = `${label} (engaged with ${engagedHero})`;
    }
    return {
      id: target.id,
      label,
      cardCode,
      description: `Target ${label} with ${sourceName}`,
      effect,
      params,
    };
  });
}

/** Whether `id` names the target: its id, or for the main scheme also `main_scheme` or its card code. */
const isNamedTarget = (target: ResolvedTarget, id: string): boolean => {
  if (target.id === id) return true;
  if (target.kind !== 'scheme' || target.entityType !== 'main_scheme') return false;
  const main = target.entity as { card?: { code?: string } };
  return id === 'main_scheme' || id === main.card?.code;
};

type AffectRule = (
  state: GameState,
  step: AbilityStep,
  target: ResolvedTarget,
  sourceCard: CardInstance | undefined,
  actor: PlayerState,
  ability?: CardAbility,
) => boolean;

const isExhausted = (target: ResolvedTarget): boolean =>
  'exhausted' in target.entity ? Boolean(target.entity.exhausted) : false;

/**
 * The one table of what an effect needs from its target (RR v1.8 "Target": a target is valid when
 * any part of the ability can affect it; ADR-0090). Add a rule here for a new effect; no caller
 * decides this by effect name.
 */
const AFFECT_RULES: Partial<Record<EffectType, AffectRule>> = {
  // A character that cannot take damage (from this source) is not a valid target of an ability
  // whose only effect is damage (#297).
  // The villain is also not a valid target of an attack while a Guard minion is engaged with the
  // actor (RR v1.8 "Guard"; #331). Damage that is not an attack is not limited.
  DEAL_DAMAGE: (state, _step, target, sourceCard, actor, ability) =>
    !(target.kind === 'character' && isImmuneToDamage(state, target.entity, sourceCard)) &&
    !(
      target.kind === 'character' &&
      target.entityType === 'villain' &&
      ability?.labels?.includes('ATTACK') &&
      isVillainAttackBlockedByGuard(actor)
    ),
  TRANSFER_DAMAGE: (state, _step, target, sourceCard) =>
    !(target.kind === 'character' && isImmuneToDamage(state, target.entity, sourceCard)),
  ADD_STATUS: (_state, step, target) => {
    if (target.kind !== 'character') return false;
    const entity = target.entity;
    const status = String(step.effectParams?.status ?? 'STUNNED').toUpperCase();
    const statusCard =
      status === 'TOUGH'
        ? StatusCard.TOUGH
        : status === 'CONFUSED'
          ? StatusCard.CONFUSED
          : StatusCard.STUNNED;
    const isStunOrConfuse = statusCard !== StatusCard.TOUGH;
    if (isStunOrConfuse && hasEntityKeyword(entity, 'Stalwart')) return false;
    const limit = isStunOrConfuse && hasEntityKeyword(entity, 'Steady') ? 2 : 1;
    const held = ((entity.statusCards ?? []) as StatusCard[]).filter((s) => s === statusCard);
    return held.length < limit;
  },
  // A scheme with threat, and not a main scheme that Crisis or Patrol shields from the actor's
  // player cards (RR v1.8 "Crisis Icon", "Patrol"; #331). An encounter source is not limited.
  REMOVE_THREAT: (state, step, target, sourceCard, actor) =>
    target.kind === 'scheme' &&
    (target.entity.threat ?? 0) > 0 &&
    !(
      target.entityType === 'main_scheme' &&
      getMainSchemeThreatBlock(state, actor, {
        isPlayerSource: sourceCard?.card?.faction !== 'encounter',
        ignoresCrisis: Boolean(step.effectParams?.ignoresCrisis),
      })
    ),
  HEAL_DAMAGE: (state, _step, target) => {
    if (target.kind !== 'character') return false;
    if (target.entityType === 'hero' || target.entityType === 'alter_ego') {
      const p = target.entity as PlayerState;
      return p.health < getEffectiveMaxHealth(p, state);
    }
    if (target.entityType === 'villain') {
      const v = target.entity as VillainState;
      return v.health < v.maxHealth;
    }
    return ((target.entity as CardInstance).tokens?.damage ?? 0) > 0;
  },
  EXHAUST: (_state, _step, target) => !isExhausted(target),
  READY: (_state, _step, target) => isExhausted(target),
  // The target must hold a status card the step removes.
  REMOVE_STATUS: (_state, step, target) =>
    target.kind === 'character' &&
    requestedStatuses(step).some((s) => (target.entity.statusCards ?? []).includes(s)),
  // A host that already holds `maxPerHost` copies of the card being played cannot take another.
  // Without the card, the host cannot be judged.
  ATTACH_TO_HOST: (_state, step, target, sourceCard) =>
    !sourceCard ||
    hostHasRoom(
      target.entity as { attachments?: CardInstance[] },
      sourceCard.card,
      attachMaxPerHost(step),
    ),
};

/**
 * The effects whose target is named by their own params rather than a selector (a source zone, a
 * card code, the source card). The rule is whether the step has anything to act on; it shares each
 * handler's selection helper (`step-selection.ts`), so the two cannot disagree (RR v1.8 "Target").
 * `source` is the card whose ability runs; a rule that needs it passes when none is given.
 */
type StepRule = (
  state: GameState,
  player: PlayerState,
  step: AbilityStep,
  source: CardInstance | undefined,
) => boolean;

const STEP_RULES: Partial<Record<EffectType, StepRule>> = {
  // The scheme a card code names must be in play (Yon-Rogg 01177 names the Psyche-Magnitron).
  ADD_THREAT: (state, _player, step) => {
    const code = namedSchemeCode(step);
    return !code || isSchemeInPlay(state, code);
  },
  // The identity must lack the trait it would gain.
  ADD_TRAIT: (state, player, step) => {
    const trait = String(step.effectParams?.trait ?? '')
      .trim()
      .toLowerCase();
    return (
      !trait || !getEffectivePlayerTraits(player, state).some((t) => t.toLowerCase() === trait)
    );
  },
  DISCARD: (state, player, step, source) => {
    const params = step.effectParams ?? {};
    const filter = params.filter as UniversalCardFilter | undefined;
    switch ((params.source as string | undefined) ?? 'HAND') {
      case 'HAND': {
        const resolved = resolvePlayerTargets(state, params.target as string | undefined, {
          playerId: player.id,
          sourceCardInstance: source,
        });
        return (resolved.length > 0 ? resolved : [player]).some(
          (p) => discardableHandCards(p, filter).length > 0,
        );
      }
      // An empty deck is reset by the discard (RR v1.8 "Player Deck"), so cards in the deck or its
      // discard pile are something to act on, as for a draw (`isAlwaysValidStep`).
      case 'DECK':
        return player.deck.length + player.discard.length > 0;
      case 'ENCOUNTER_DECK':
        return state.encounterDeck.length + state.encounterDiscard.length > 0;
      case 'TABLEAU':
        return discardableTableauCards(state, player, filter).length > 0;
      case 'SELF':
        return source !== undefined;
      case 'HOST':
        return source === undefined || isAttachedAnywhere(state, source);
      case 'CARDS_UNDER_HOST':
        return (
          (cardsUnderneathHost(state, params.target as string | undefined)?.cardsUnderneath ?? [])
            .length > 0
        );
      default:
        return true;
    }
  },
  PUT_INTO_PLAY: (state, player, step, source) =>
    putIntoPlayCandidates(state, player, step.effectParams ?? {}, source).length > 0,
  REMOVE_COUNTERS: (_state, player, step, source) => {
    const params = step.effectParams ?? {};
    const counterType = (params.counterType as string | undefined) ?? 'all_purpose';
    if (params.target === 'IDENTITY') return playerCounterCount(player, counterType) > 0;
    return !source || cardCounterCount(source, counterType) > 0;
  },
  REMOVE_COUNTERS_MATCHING_FILTER: (_state, player, step) => {
    const params = step.effectParams ?? {};
    return counterFilterCards(player, params).some((c) =>
      holdsMatchingCounter(c, params.counterType as string | undefined),
    );
  },
  // The source card must be in its controller's play area, or hold cards underneath that go back
  // to hand (Hellcat 01020, Make the Call 01071, Highway Robbery 01166).
  RETURN_TO_HAND: (_state, player, _step, source) =>
    !source ||
    (source.cardsUnderneath?.length ?? 0) > 0 ||
    player.allies.includes(source) ||
    player.tableau.includes(source),
  // A zone to look in: a matching card in a discard pile, or a deck that is not empty.
  SEARCH: (state, player, step) => searchHasCards(state, player, step),
};

/**
 * Effects with no target-state rule, by reason. Every effect is in `AFFECT_RULES`, `STEP_RULES` or
 * here (guard: `tests/engine/legality-gate-guards.test.ts`), so a new effect cannot silently default
 * to "always valid".
 */
export const EFFECTS_WITHOUT_AFFECT_RULE: Readonly<Record<string, readonly EffectType[]>> = {
  'acts on the game, a player or the source card; no target state limits it': [
    'DRAW',
    'ADD_ACCELERATION',
    'ADD_COUNTERS',
    'ATTACHMENT_DAMAGE_SHIELD',
    'ATTACH_FACEDOWN_CARDS_FROM_HAND',
    'CANCEL_ATTACK',
    'CANCEL_WHEN_REVEALED',
    'CANCEL_WHEN_REVEALED_AND_REVEAL_ANOTHER',
    'CANNOT_TAKE_DAMAGE',
    'CHANGE_FORM',
    'DEAL_FACEDOWN_ENCOUNTER_CARD',
    'DECLARE_DEFENDER',
    'DISTRIBUTE_AMOUNT',
    'DOUBLE_RESOURCE_FOR_ASPECT',
    'EXECUTE_SPECIAL',
    'FLIP_FORM',
    'GENERATE_RESOURCE',
    'GIVE_ADDITIONAL_BOOST_CARD',
    'GRANT_KEYWORD',
    'GRANT_ATTACK_KEYWORD',
    'MODIFY_ALLY_LIMIT',
    'MODIFY_HAND_SIZE',
    'MODIFY_MAX_HEALTH',
    'MODIFY_RESTRICTED_LIMIT',
    'MODIFY_STAT',
    'PLACE_CARD_UNDER_HOST',
    'PLAYER_CHOICE',
    'PLAY_FROM_ZONE',
    'PREVENT_DAMAGE',
    'PREVENT_THREAT',
    'REDUCE_NEXT_CARD_COST',
    'REMOVE_FROM_GAME',
    'REVEAL_ENCOUNTER_CARD',
    'SHUFFLE_INTO_DECK',
    'SPEND_COUNTERS',
    'SURGE',
    'ENEMY_ATTACKS',
    'VILLAIN_AND_ENGAGED_MINIONS_ATTACK',
    'VILLAIN_ATTACKS',
    'VILLAIN_SCHEMES',
    'RESTRICT_DEFENSE',
  ],
};

/** Whether this step's effect can affect the target (RR v1.8 "Target": valid targets only). */
export const canAffect: AffectRule = (state, step, target, sourceCard, actor, ability) =>
  AFFECT_RULES[step.effect as EffectType]?.(state, step, target, sourceCard, actor, ability) ??
  true;

/** Effects that have a target-state rule; with `EFFECTS_WITHOUT_AFFECT_RULE` they cover every effect. */
export const EFFECTS_WITH_AFFECT_RULE: readonly string[] = [
  ...Object.keys(AFFECT_RULES),
  ...Object.keys(STEP_RULES),
];

/**
 * A step with a fallback ("attach to X, if able; if you cannot, ...") always has something to do,
 * so a missing target never blocks it.
 */
const hasFallback = (step: AbilityStep): boolean => step.effectParams?.fallback !== undefined;

/**
 * The selector whose targets the legality gate enumerates for this step: every chosen, fixed or
 * group selector (RR v1.8 "Target"). Event selectors are judged against the event's target, and
 * dependent selectors are filled in at run time, so neither is enumerated here.
 */
const judgedSelector = (step: AbilityStep): string | undefined => {
  const target = stepTarget(step);
  if (!target || hasFallback(step)) return undefined;
  const kind = SELECTOR_CLASS[target as TargetSelector];
  return kind === 'CHOSEN' || kind === 'FIXED' || kind === 'GROUP' ? target : undefined;
};

/**
 * The targets a selector names on the board. A chosen selector lists what the player may pick from;
 * a fixed or group selector resolves to the entities the ability names ("each ..." included).
 */
function selectorCandidates(
  state: GameState,
  player: PlayerState,
  selector: string,
  sourceCardInstance: CardInstance | undefined,
): ResolvedTarget[] {
  const kind = SELECTOR_CLASS[selector as TargetSelector];
  return kind === 'FIXED' || kind === 'GROUP'
    ? resolveTargets(state, selector, { playerId: player.id, sourceCardInstance })
    : getEligibleTargets(state, player, selector);
}

/**
 * Valid targets for a step, computed from the current board: the targets its selector names that
 * its effect can affect (ADR-0090). `selectorOverride` serves callers that ask for a selector the
 * player chooses at play time (events and abilities) rather than at step execution.
 */
export function getValidStepTargets(
  state: GameState,
  player: PlayerState,
  step: AbilityStep,
  context: Pick<EffectExecutionContext, 'sourceCardInstance' | 'distinctFromId' | 'ability'>,
  selectorOverride?: string,
): ResolvedTarget[] {
  const selector = selectorOverride ?? judgedSelector(step);
  if (!selector) return [];
  const candidates = selectorCandidates(state, player, selector, context.sourceCardInstance);
  const excluded = context.distinctFromId;
  return candidates.filter(
    (t) =>
      !(excluded && isNamedTarget(t, excluded)) &&
      canAffect(state, step, t, context.sourceCardInstance, player, context.ability),
  );
}

/** What the player picks from when playing a card: its chosen-target selector and valid targets. */
export interface PlayTargetChoice {
  selector: string;
  targets: ResolvedTarget[];
}

/**
 * The target a played card asks the player to choose (RR v1.8 "Target"): the valid targets of the
 * first `CHOSEN_*` step of what it runs when played (an event's actions, an attachment's host), or
 * `undefined` when it chooses nothing. The payment modal offers exactly these, so it never lists a
 * target the gate would refuse (#438).
 */
export function getPlayTargetChoice(
  state: GameState,
  player: PlayerState,
  cardInstance: CardInstance,
): PlayTargetChoice | undefined {
  for (const ability of abilitiesRunOnPlay(cardInstance.card)) {
    const chosen = firstChosenTargetStep(ability.steps);
    if (chosen) {
      const { step, selector } = chosen;
      const targets = getValidStepTargets(
        state,
        player,
        step,
        { sourceCardInstance: cardInstance, ability },
        selector,
      );
      return { selector, targets };
    }
  }
  return undefined;
}

/**
 * The target the player picks before a played card or an initiated ability runs: that of the first
 * chosen-target step whose state gate is open (RR v1.8 "Target"). Asking first keeps the effects in
 * order, since a plain sequence does not pause at a step-level prompt (`chooseStepTarget`, ADR-0077).
 * - `NONE`: nothing to ask: no such step, a target is already named, or the actor's own status card
 *   cancels the ability.
 * - `CHOSEN`: exactly one valid target; it is used without asking.
 * - `CHOICES`: two or more; the caller opens a prompt.
 * - `NO_VALID_TARGET`: the step has nothing to act on.
 */
export type InitialTargetChoice =
  | { kind: 'NONE' }
  | { kind: 'CHOSEN'; target: ResolvedTarget }
  | { kind: 'CHOICES'; targets: ResolvedTarget[] }
  | { kind: 'NO_VALID_TARGET' };

export function chooseInitialTarget(
  state: GameState,
  player: PlayerState,
  abilities: readonly CardAbility[],
  sourceCardInstance: CardInstance | undefined,
  namedTargetId?: string,
): InitialTargetChoice {
  if (namedTargetId || abilities.some((a) => isCancelledByOwnStatus(player, a))) {
    return { kind: 'NONE' };
  }
  const isOpen = (step: AbilityStep) =>
    !isStepGateClosedByState(step, state, { playerId: player.id });
  for (const ability of abilities) {
    const chosen = firstChosenTargetStep(ability.steps, isOpen);
    if (!chosen) continue;
    const targets = getValidStepTargets(
      state,
      player,
      chosen.step,
      { sourceCardInstance, ability },
      chosen.selector,
    );
    if (targets.length === 0) return { kind: 'NO_VALID_TARGET' };
    return targets.length === 1
      ? { kind: 'CHOSEN', target: targets[0] }
      : { kind: 'CHOICES', targets };
  }
  return { kind: 'NONE' };
}

/**
 * Decides the target of a CHOSEN_* step that has no chosen target yet. Called by step execution
 * before the effect runs; when it returns PROMPTED, the effect runs again from the prompt answer.
 */
export function chooseStepTarget(
  state: GameState,
  player: PlayerState,
  step: AbilityStep,
  context: EffectExecutionContext,
): StepTargetChoice {
  if (state.eliminatedPlayers?.some((p) => p.id === player.id)) {
    return { kind: 'NO_VALID_TARGET' };
  }

  const selector = stepTargetSelector(step);
  if (!selector) return { kind: 'NOT_REQUIRED' };
  if (step.effectParams?.targetInstanceId || context.chosenTargetInstanceId) {
    return { kind: 'NOT_REQUIRED' };
  }

  const valid = getValidStepTargets(state, player, step, context);
  if (valid.length === 0) return { kind: 'NO_VALID_TARGET' };
  if (valid.length === 1) return { kind: 'CHOSEN', targetInstanceId: valid[0].id };

  const sourceName = context.sourceCardInstance?.card.name;
  const noun = selector.includes('SCHEME')
    ? 'a Scheme'
    : selector.includes('ENEMY')
      ? 'an Enemy'
      : 'a Target';
  const options: DecisionPromptOption[] = valid.map((target) => {
    const { label, cardCode } = describeTarget(target);
    return {
      id: target.id,
      label,
      cardCode,
      effect: step.effect,
      params: {
        ...(step.effectParams ?? {}),
        targetInstanceId: target.id,
        // The ability's labels travel with the choice, unchanged, so the resumed step keeps them
        ...(context.ability?.labels ? { labels: context.ability.labels } : {}),
        ...(context.resourcesSpent ? { resourcesSpent: context.resourcesSpent } : {}),
      },
    };
  });

  kernel.enqueueDecisionPrompt(state, {
    promptId: nextEngineId(state, 'choose_target'),
    playerId: player.id,
    title: `${sourceName ? `${sourceName}: ` : ''}Choose ${noun}`,
    description: `Choose ${noun} for ${step.effect}.`,
    sourceCardName: sourceName ?? step.effect,
    sourceCardCode: context.sourceCardInstance?.card.code,
    sourceCardInstanceId: context.sourceCardInstance?.instanceId,
    completion:
      context.sourceCardInstance?.card.type === 'event' ? 'DISCARD_RESOLVING_EVENT' : undefined,
    sourceCardInstance:
      context.sourceCardInstance?.card.type === 'event' ? context.sourceCardInstance : undefined,
    discardedCards: context.discardedCards ?? context.previousResult?.discardedCards,
    isFinalStep: context.isFinalStep,
    isVoluntary: false,
    options,
  });
  return { kind: 'PROMPTED' };
}

/** Selectors naming the enemy or minion the triggering event was about ("that enemy"). */
const stepEventSelector = (step: AbilityStep): string | undefined => {
  const target = step.effectParams?.target;
  return typeof target === 'string' && SELECTOR_CLASS[target as TargetSelector] === 'EVENT'
    ? target
    : undefined;
};

/** The steps a PLAYER_CHOICE option runs when it is taken. */
export const optionSteps = (option: DecisionPromptOption): AbilityStep[] =>
  option.steps ?? [{ effect: option.effect as EffectType, effectParams: option.params }];

const choiceOptions = (step: AbilityStep): DecisionPromptOption[] =>
  step.effect === 'PLAYER_CHOICE'
    ? ((step.effectParams?.options as DecisionPromptOption[] | undefined) ?? [])
    : [];

/**
 * A PLAYER_CHOICE the gate judges: every option names a target to judge. When one option needs no
 * target the player can always take it, so the choice never blocks the ability.
 */
const isJudgedChoice = (step: AbilityStep): boolean => {
  const options = choiceOptions(step);
  return options.length > 0 && options.every((o) => stepsNeedingChoice(optionSteps(o)).length > 0);
};

/** Whether the gate judges a step's own params as well as its selector (see `STEP_RULES`). */
const hasStepRule = (step: AbilityStep): boolean =>
  STEP_RULES[step.effect as EffectType] !== undefined && !hasFallback(step);

/**
 * A step judged only by its own params (a discard, a card put into play). Draw is the RR's own
 * example of a step that is a target (RR v1.8 "Target"); these steps follow it only when the
 * ability names no selector target, so a spare discard never excuses a thwart with nothing to
 * thwart (#369).
 */
const isParamsOnlyStep = (step: AbilityStep): boolean =>
  hasStepRule(step) &&
  judgedSelector(step) === undefined &&
  stepEventSelector(step) === undefined &&
  !isJudgedChoice(step);

const stepsNeedingChoice = (steps: AbilityStep[]): AbilityStep[] =>
  steps.filter(
    (s) =>
      judgedSelector(s) !== undefined ||
      stepEventSelector(s) !== undefined ||
      hasStepRule(s) ||
      isJudgedChoice(s),
  );

/**
 * RR v1.8 "Target": an ability that draws always has a valid target while the player has a card
 * to draw. Only a draw that always happens counts: a gated (conditional) draw is not known to
 * happen when the ability is initiated, and no other step without a judged target is a target.
 */
const isAlwaysValidStep = (step: AbilityStep, player: PlayerState): boolean =>
  step.effect === 'DRAW' && !step.gate && player.deck.length + player.discard.length > 0;

/** The target a triggering event named, for abilities whose steps target "that enemy". */
export interface EventTarget {
  targetType?: string;
  targetInstanceId?: string;
  /** A target the player already named (an action's `targetInstanceId`); it must be affectable. */
  chosenTargetId?: string;
}

/** What is missing when no target is valid, by effect; callers prefix their own "Cannot ...". */
const NO_VALID_TARGET_REASON: Partial<Record<EffectType, string>> = {
  HEAL_DAMAGE: 'No character has sustained damage to heal.',
  READY: 'Nothing is exhausted to ready.',
  EXHAUST: 'Nothing is ready to exhaust.',
  REMOVE_THREAT: 'No scheme has threat to remove.',
  ADD_STATUS: 'No character can receive that status card.',
  DEAL_DAMAGE: 'No character can take that damage.',
  REMOVE_STATUS: 'No character has that status card.',
  ADD_THREAT: 'That scheme is not in play.',
  ADD_TRAIT: 'Your identity already has that trait.',
  DISCARD: 'There is no card to discard.',
  PUT_INTO_PLAY: 'No card can be put into play.',
  REMOVE_COUNTERS: 'There is no counter to remove.',
  REMOVE_COUNTERS_MATCHING_FILTER: 'There is no counter to remove.',
  RETURN_TO_HAND: 'There is no card to return to hand.',
  ATTACH_TO_HOST: 'No host can take this card.',
  SEARCH: 'No matching card to search.',
};

/**
 * An attack by a Stunned hero or a thwart by a Confused one discards the status card instead (RR v1.8
 * Stunned, Confused). That is a change to the board: the status card is the target, so the ability
 * is valid even when its own target is missing.
 */
export const isCancelledByOwnStatus = (player: PlayerState, ability: CardAbility): boolean =>
  Boolean(
    (ability.labels?.includes('ATTACK') &&
      isEntityIncapacitatedByStatus(player, StatusCard.STUNNED)) ||
    (ability.labels?.includes('THWART') &&
      isEntityIncapacitatedByStatus(player, StatusCard.CONFUSED)),
  );

export type TargetCheck = { allowed: true } | { allowed: false; reason: string };

/**
 * RR v1.8 "Target" / "Initiating Abilities" step 2: an ability that requires a target can only be
 * initiated if it has at least one valid target. An ability with a draw step that always happens
 * has one while the player has a card to draw (`isAlwaysValidStep`). A step on the enemy the
 * triggering event named ("that enemy", `TRIGGERING_ENEMY`) needs that enemy to be in play and affectable (defeated, already stunned or
 * Stalwart: no valid target); callers that pass no event target skip that check.
 *
 * The one legality gate for target validity (ADR-0090): trigger scans, queued prompts, prompt
 * answers, action buttons and event play all ask it, so none repeats the rule.
 */
export function checkAbilityTargets(
  state: GameState,
  player: PlayerState,
  ability: CardAbility,
  sourceCardInstance?: CardInstance,
  eventTarget?: EventTarget,
): TargetCheck {
  if (isCancelledByOwnStatus(player, ability)) return { allowed: true };
  const unmet = unmetChoiceSteps(
    state,
    player,
    ability,
    ability.steps ?? [],
    sourceCardInstance,
    eventTarget,
  );
  if (!unmet) return { allowed: true };
  const isGuarded =
    unmet[0].effect === 'DEAL_DAMAGE' &&
    ability.labels?.includes('ATTACK') &&
    isVillainAttackBlockedByGuard(player);
  return {
    allowed: false,
    reason: isGuarded
      ? GUARD_BLOCK_REASON
      : (NO_VALID_TARGET_REASON[unmet[0].effect as EffectType] ?? 'No valid target.'),
  };
}

/**
 * The judged steps of `steps` when none has a valid target, or `undefined` when the steps can be
 * initiated. A PLAYER_CHOICE has a valid target when any of its options does (RR v1.8 "Target": a
 * target is valid if any part of the ability can affect it).
 */
function unmetChoiceSteps(
  state: GameState,
  player: PlayerState,
  ability: CardAbility,
  steps: AbilityStep[],
  sourceCardInstance?: CardInstance,
  eventTarget?: EventTarget,
): AbilityStep[] | undefined {
  // A step whose state gate is closed cannot run, so it neither needs a target nor excuses a
  // missing one (Mark V Helmet: one step per Aerial branch).
  const openSteps = steps.filter(
    (s) => !isStepGateClosedByState(s, state, { playerId: player.id }),
  );
  const judgedSteps = stepsNeedingChoice(openSteps);
  if (judgedSteps.length === 0 || openSteps.some((s) => isAlwaysValidStep(s, player))) {
    return undefined;
  }
  const selectorSteps = judgedSteps.filter((s) => !isParamsOnlyStep(s));
  const choiceSteps = selectorSteps.length > 0 ? selectorSteps : judgedSteps;
  const hasTarget = (step: AbilityStep): boolean => {
    if (step.effect === 'PLAYER_CHOICE') {
      return choiceOptions(step).some(
        (o) =>
          !unmetChoiceSteps(
            state,
            player,
            ability,
            optionSteps(o),
            sourceCardInstance,
            eventTarget,
          ),
      );
    }
    const eventSelector = stepEventSelector(step);
    if (!eventSelector) {
      const selector = judgedSelector(step);
      const chosenId = eventTarget?.chosenTargetId;
      const named =
        chosenId && selector
          ? getEligibleTargets(state, player, selector).find((t) => isNamedTarget(t, chosenId))
          : undefined;
      // A named target the effect cannot affect is not a valid target, whatever else is in play.
      if (named) return canAffect(state, step, named, sourceCardInstance, player, ability);
      // "This side scheme" is the source card: without it the selector cannot be judged.
      const selectorHasTarget =
        !selector ||
        (selector === 'THIS_SIDE_SCHEME' && !sourceCardInstance) ||
        getValidStepTargets(state, player, step, { sourceCardInstance, ability }).length > 0;
      const rule = hasStepRule(step) ? STEP_RULES[step.effect as EffectType] : undefined;
      return selectorHasTarget && (!rule || rule(state, player, step, sourceCardInstance));
    }
    // Callers without a triggering event (a prompt answered later) cannot judge "that enemy".
    if (!eventTarget?.targetInstanceId && !eventTarget?.targetType) return true;
    return resolveTargets(state, eventSelector, {
      playerId: player.id,
      sourceCardInstance,
      eventTargetType: eventTarget?.targetType,
      eventTargetInstanceId: eventTarget?.targetInstanceId,
    }).some((t) => canAffect(state, step, t, sourceCardInstance, player, ability));
  };
  return choiceSteps.some(hasTarget) ? undefined : choiceSteps;
}

bindKernel({ checkAbilityTargets });
