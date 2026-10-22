import type { EffectType } from '../../data/supplemental/runtime';
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
  hasEntityKeyword,
  isEntityIncapacitatedByStatus,
} from '../pipeline/stat-calculator';
import { isImmuneToDamage } from '../pipeline/damage-immunity';
import { isStepGateClosedByState } from '../pipeline/step-gate-evaluator';
import { getMainSchemeThreatBlock } from '../pipeline/target-restrictions';
import { nextEngineId } from '../state/rng';
import { getEligibleTargets, resolveTargets, type ResolvedTarget } from './target-resolver';
import type { EffectExecutionContext } from './index';

/**
 * Player-chosen target selection (RR v1.8 "Target", "Choose (Game Element)", "Initiating Abilities").
 *
 * A step whose target is a single-target CHOSEN_* selector is resolved against the target the
 * player chose. When nobody has chosen yet, the valid targets are computed from the board at that
 * moment: 0 means the step does nothing, 1 is used without asking, 2 or more open a prompt whose
 * options re-run the same step with the chosen target.
 */
const PLAYER_CHOSEN_SELECTORS: ReadonlySet<string> = new Set([
  'CHOSEN_ENEMY',
  'CHOSEN_MINION',
  'CHOSEN_ENGAGED_MINION',
  'CHOSEN_CHARACTER',
  'CHOSEN_ALLY',
  'CHOSEN_CONTROLLED_ALLY',
  'CHOSEN_CONTROLLED_CHARACTER',
  'CHOSEN_FRIENDLY_CHARACTER',
  'CHOSEN_SCHEME',
  'CHOSEN_SIDE_SCHEME',
]);

export type StepTargetChoice =
  | { kind: 'NOT_REQUIRED' }
  | { kind: 'CHOSEN'; targetInstanceId: string }
  | { kind: 'PROMPTED' }
  | { kind: 'NO_VALID_TARGET' };

const stepTargetSelector = (step: AbilityStep): string | undefined => {
  const target = step.effectParams?.target;
  return typeof target === 'string' && PLAYER_CHOSEN_SELECTORS.has(target) ? target : undefined;
};

const isSameScheme = (target: ResolvedTarget, id: string): boolean => {
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
  DEAL_DAMAGE: (state, _step, target, sourceCard) =>
    !(target.kind === 'character' && isImmuneToDamage(state, target.entity, sourceCard)),
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
};

/**
 * Effects with no target-state rule, by reason. Every effect is in `AFFECT_RULES` or here
 * (guard: `tests/engine/legality-gate-guards.test.ts`), so a new effect cannot silently default to
 * "always valid".
 */
export const EFFECTS_WITHOUT_AFFECT_RULE: Readonly<Record<string, readonly EffectType[]>> = {
  'acts on the game, a player or the source card; no target state limits it': [
    'DRAW',
    'ADD_ACCELERATION',
    'ATTACHMENT_DAMAGE_SHIELD',
    'ATTACH_FACEDOWN_CARDS_FROM_HAND',
    'ATTACH_TO_HOST',
    'CANCEL_ATTACK',
    'CANCEL_WHEN_REVEALED',
    'CANCEL_WHEN_REVEALED_AND_REVEAL_ANOTHER',
    'CANNOT_TAKE_DAMAGE',
    'CHANGE_FORM',
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
    'PLAYER_CHOICE',
    'PLAY_FROM_ZONE',
    'PREVENT_DAMAGE',
    'PREVENT_THREAT',
    'REDUCE_NEXT_CARD_COST',
    'REVEAL_ENCOUNTER_CARD',
    'SEARCH',
    'SHUFFLE_INTO_DECK',
    'SPEND_COUNTERS',
    'SURGE',
    'ENEMY_ATTACKS',
    'VILLAIN_AND_ENGAGED_MINIONS_ATTACK',
    'VILLAIN_ATTACKS',
    'VILLAIN_SCHEMES',
  ],
  // #365. RETURN_TO_HAND: Hellcat 01020 + Make the Call 01071 show "your hand" is the resolving
  // player's, and the handler only finds a source in that player's play area
  // (tests/engine/hellcat-make-the-call.test.ts).
  'acts on a target but its state rule is not written yet (tracked gap, ADR-0090)': [
    'ADD_COUNTERS',
    'ADD_THREAT',
    'ADD_TRAIT',
    'DISCARD',
    'PLACE_CARD_UNDER_HOST',
    'PUT_INTO_PLAY',
    'REMOVE_COUNTERS',
    'REMOVE_COUNTERS_MATCHING_FILTER',
    'REMOVE_FROM_GAME',
    'REMOVE_STATUS',
    'RETURN_TO_HAND',
  ],
};

/** Whether this step's effect can affect the target (RR v1.8 "Target": valid targets only). */
export const canAffect: AffectRule = (state, step, target, sourceCard, actor) =>
  AFFECT_RULES[step.effect as EffectType]?.(state, step, target, sourceCard, actor) ?? true;

/** Effects that have a target-state rule; with `EFFECTS_WITHOUT_AFFECT_RULE` they cover every effect. */
export const EFFECTS_WITH_AFFECT_RULE: readonly string[] = Object.keys(AFFECT_RULES);

/** Self selectors name the acting player's own hero or identity: a target like any other. */
const SELF_SELECTORS: ReadonlySet<string> = new Set(['SELF_HERO', 'SELF_IDENTITY']);

/**
 * Scheme selectors the ability names rather than the player chooses: the gate judges them like a
 * chosen scheme, but no prompt is opened for them (#331).
 */
const NAMED_SCHEME_SELECTORS: ReadonlySet<string> = new Set([
  'MAIN_SCHEME',
  'SIDE_SCHEME',
  'ALL_SCHEMES',
]);

/** The selector whose targets the legality gate enumerates for this step (chosen or self). */
const judgedSelector = (step: AbilityStep): string | undefined => {
  const target = step.effectParams?.target;
  return typeof target === 'string' &&
    (PLAYER_CHOSEN_SELECTORS.has(target) ||
      SELF_SELECTORS.has(target) ||
      NAMED_SCHEME_SELECTORS.has(target))
    ? target
    : undefined;
};

/**
 * Valid targets for a step, computed from the current board: the targets its selector names that
 * its effect can affect (ADR-0090). `selectorOverride` serves callers that ask for a selector the
 * player chooses at play time (events and abilities) rather than at step execution.
 */
export function getValidStepTargets(
  state: GameState,
  player: PlayerState,
  step: AbilityStep,
  context: Pick<EffectExecutionContext, 'sourceCardInstance' | 'distinctFromId'>,
  selectorOverride?: string,
): ResolvedTarget[] {
  const selector = selectorOverride ?? judgedSelector(step);
  if (!selector) return [];
  const candidates = getEligibleTargets(state, player, selector);
  const excluded = context.distinctFromId;
  return candidates.filter(
    (t) =>
      !(excluded && isSameScheme(t, excluded)) &&
      canAffect(state, step, t, context.sourceCardInstance, player),
  );
}

const targetLabel = (target: ResolvedTarget): { label: string; cardCode?: string } => {
  if (target.kind === 'player') {
    const p = target.entity;
    return { label: p.activeFormCard?.name || p.name, cardCode: p.activeFormCard?.code };
  }
  if (target.kind === 'character') {
    if (target.entityType === 'hero' || target.entityType === 'alter_ego') {
      const p = target.entity as PlayerState;
      return { label: p.activeFormCard?.name || p.name, cardCode: p.activeFormCard?.code };
    }
    const card = (target.entity as CardInstance | VillainState).card;
    return { label: card?.name ?? 'Target', cardCode: card?.code };
  }
  if (target.kind === 'scheme') {
    const s = target.entity;
    const name = s.card?.name ?? 'Target';
    const suffix = ` (${s.threat ?? 0} Threat)`;
    return { label: `${name}${suffix}`, cardCode: s.card?.code };
  }
  const card = target.entity.card;
  return { label: card?.name ?? 'Target', cardCode: card?.code };
};

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
    const { label, cardCode } = targetLabel(target);
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
const EVENT_TARGET_SELECTORS: ReadonlySet<string> = new Set([
  'TRIGGERING_ENEMY',
  'TRIGGERING_MINION',
]);

const stepEventSelector = (step: AbilityStep): string | undefined => {
  const target = step.effectParams?.target;
  return typeof target === 'string' && EVENT_TARGET_SELECTORS.has(target) ? target : undefined;
};

const stepsNeedingChoice = (steps: AbilityStep[]): AbilityStep[] =>
  steps.filter((s) => judgedSelector(s) !== undefined || stepEventSelector(s) !== undefined);

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
 * initiated if it has at least one valid target. An ability with any step that needs no judged
 * target can always be initiated. A step on the enemy the triggering event named ("that enemy",
 * `TRIGGERING_ENEMY`) needs that enemy to be in play and affectable (defeated, already stunned or
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
  // A step whose state gate is closed cannot run, so it neither needs a target nor excuses a
  // missing one (Mark V Helmet: one step per Aerial branch).
  const openSteps = (ability.steps ?? []).filter(
    (s) => !isStepGateClosedByState(s, state, { playerId: player.id }),
  );
  const choiceSteps = stepsNeedingChoice(openSteps);
  if (isCancelledByOwnStatus(player, ability)) return { allowed: true };
  if (choiceSteps.length === 0 || choiceSteps.length < openSteps.length) {
    return { allowed: true };
  }
  const hasTarget = (step: AbilityStep): boolean => {
    const eventSelector = stepEventSelector(step);
    if (!eventSelector) {
      const selector = judgedSelector(step);
      const chosenId = eventTarget?.chosenTargetId;
      const named =
        chosenId && selector
          ? getEligibleTargets(state, player, selector).find((t) => t.id === chosenId)
          : undefined;
      // A named target the effect cannot affect is not a valid target, whatever else is in play.
      if (named) return canAffect(state, step, named, sourceCardInstance, player);
      return getValidStepTargets(state, player, step, { sourceCardInstance }).length > 0;
    }
    // Callers without a triggering event (a prompt answered later) cannot judge "that enemy".
    if (!eventTarget?.targetInstanceId && !eventTarget?.targetType) return true;
    return resolveTargets(state, eventSelector, {
      playerId: player.id,
      sourceCardInstance,
      eventTargetType: eventTarget?.targetType,
      eventTargetInstanceId: eventTarget?.targetInstanceId,
    }).some((t) => canAffect(state, step, t, sourceCardInstance, player));
  };
  if (choiceSteps.some(hasTarget)) return { allowed: true };
  return {
    allowed: false,
    reason: NO_VALID_TARGET_REASON[choiceSteps[0].effect as EffectType] ?? 'No valid target.',
  };
}

bindKernel({ checkAbilityTargets });
