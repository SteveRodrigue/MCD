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
import { getEffectiveMaxHealth, hasEntityKeyword } from '../pipeline/stat-calculator';
import { enqueueDecisionPrompt } from '../pipeline/prompt-queue';
import { getEligibleTargets, type ResolvedTarget } from './target-resolver';
import type { EffectExecutionContext } from './index';

/**
 * Player-chosen target selection (RR v1.8 "Target", "Choose (Game Element)", "Initiating Abilities").
 *
 * A step whose target is a single-target CHOSEN_* selector is resolved against the target the
 * player chose. When nobody has chosen yet, the valid targets are computed from the board at that
 * moment: 0 means the step does nothing, 1 is used without asking, 2 or more open a prompt whose
 * options re-run the same step with the chosen target.
 */
export const PLAYER_CHOSEN_SELECTORS: ReadonlySet<string> = new Set([
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

/** Whether this step's effect can affect the target (RR v1.8 "Target": valid targets only). */
const canAffect = (state: GameState, step: AbilityStep, target: ResolvedTarget): boolean => {
  const entity = target.entity as any;
  switch (step.effect) {
    case 'ADD_STATUS': {
      if (target.kind !== 'character') return false;
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
    }
    case 'REMOVE_THREAT':
      return target.kind === 'scheme' && (entity.threat ?? 0) > 0;
    case 'HEAL_DAMAGE':
    case 'HEAL': {
      if (target.kind !== 'character') return false;
      if (target.entityType === 'hero' || target.entityType === 'alter_ego') {
        const p = entity as PlayerState;
        return p.health < getEffectiveMaxHealth(p, state);
      }
      if (target.entityType === 'villain') {
        const v = entity as VillainState;
        return v.health < v.maxHealth;
      }
      return ((entity as CardInstance).tokens?.damage ?? 0) > 0;
    }
    case 'EXHAUST':
      return !entity.exhausted;
    case 'READY':
      return Boolean(entity.exhausted);
    default:
      return true;
  }
};

/** Valid targets for a step with a CHOSEN_* selector, computed from the current board. */
export function getValidStepTargets(
  state: GameState,
  player: PlayerState,
  step: AbilityStep,
  context: Pick<EffectExecutionContext, 'sourceCardInstance' | 'distinctFromId' | 'ignoresCrisis'>,
): ResolvedTarget[] {
  const selector = stepTargetSelector(step);
  if (!selector) return [];
  const candidates = getEligibleTargets(state, player, selector, {
    isPlayerSource: context.sourceCardInstance?.card?.faction !== 'encounter',
    ignoresCrisis: Boolean(step.effectParams?.ignoresCrisis || context.ignoresCrisis),
  });
  const excluded = context.distinctFromId;
  return candidates.filter(
    (t) => !(excluded && isSameScheme(t, excluded)) && canAffect(state, step, t),
  );
}

const targetLabel = (target: ResolvedTarget): { label: string; cardCode?: string } => {
  const entity = target.entity as any;
  const isIdentity =
    target.kind === 'player' ||
    (target.kind === 'character' &&
      (target.entityType === 'hero' || target.entityType === 'alter_ego'));
  if (isIdentity) {
    const p = entity as PlayerState;
    return { label: p.activeFormCard?.name || p.name, cardCode: p.activeFormCard?.code };
  }
  const name = entity.card?.name ?? 'Target';
  const suffix = target.kind === 'scheme' ? ` (${entity.threat ?? 0} Threat)` : '';
  return { label: `${name}${suffix}`, cardCode: entity.card?.code };
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

  enqueueDecisionPrompt(state, {
    promptId: `choose_target_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    playerId: player.id,
    title: `${sourceName ? `${sourceName}: ` : ''}Choose ${noun}`,
    description: `Choose ${noun} for ${step.effect}.`,
    sourceCardName: sourceName ?? step.effect,
    sourceCardCode: context.sourceCardInstance?.card.code,
    sourceCardInstanceId: context.sourceCardInstance?.instanceId,
    discardedCards: context.discardedCards ?? context.previousResult?.discardedCards,
    isFinalStep: context.isFinalStep,
    isVoluntary: false,
    options,
  });
  return { kind: 'PROMPTED' };
}

const stepsNeedingChoice = (ability: CardAbility): AbilityStep[] =>
  (ability.steps ?? []).filter((s) => stepTargetSelector(s) !== undefined);

/**
 * RR v1.8 "Target" / "Initiating Abilities" step 2: an ability that requires a target can only be
 * initiated if it has at least one valid target. An ability with any step that needs no chosen
 * target can always be initiated.
 */
export function abilityHasValidTarget(
  state: GameState,
  player: PlayerState,
  ability: CardAbility,
  sourceCardInstance?: CardInstance,
): boolean {
  const choiceSteps = stepsNeedingChoice(ability);
  if (choiceSteps.length === 0 || choiceSteps.length < (ability.steps ?? []).length) return true;
  return choiceSteps.some(
    (step) => getValidStepTargets(state, player, step, { sourceCardInstance }).length > 0,
  );
}
