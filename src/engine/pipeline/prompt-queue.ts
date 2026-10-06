import {
  GameState,
  PendingDecisionPrompt,
  DistributionPromptConfig,
  ExecutionFrame,
  ActionResult,
  CardAbility,
} from '../models';
import {
  executeEffect,
  hasPendingSequence,
  resumePendingSequence,
  type EffectExecutionContext,
} from '../effects';
import { abilityHasValidTarget } from '../effects/target-choice';
import {
  executeAbilityCost,
  executeResourceCostPayment,
  AbilityPaymentOptions,
} from './cost-engine';
import { resolveActiveEncounterCardAfterInterrupt } from './villain-phase';
import { evaluateStepGate } from './step-gate-evaluator';
import { canPayAbilityCost } from './cost-engine';
import { discardResolvedObligation } from './obligations';
import { finishPendingThreatPlacements } from './threat-pipeline';

/**
 * Re-evaluates per-option availability (`gate`, `cost`) against the current state (Issue #158).
 * Run whenever a prompt becomes the active head, so options reflect effects of earlier prompts
 * in the same sequence (e.g. a voluntary form flip before "Exhaust <alter-ego>").
 */
export function refreshPromptOptionAvailability(
  state: GameState,
  prompt?: PendingDecisionPrompt,
): void {
  if (!prompt) return;
  const player = state.players.find((p) => p.id === prompt.playerId);
  if (!player) return;
  const source = prompt.sourceCardInstanceId
    ? [...(player.obligations || []), ...player.tableau, ...player.allies].find(
        (c) => c.instanceId === prompt.sourceCardInstanceId,
      )
    : undefined;

  for (const option of prompt.options) {
    if (!option.gate && !option.cost) continue;
    let reason: string | undefined;

    if (option.gate) {
      const ok = evaluateStepGate(
        option.gate,
        undefined,
        state,
        { effect: 'RESOLVED', gate: option.gate, gateParams: option.gateParams },
        { playerId: player.id },
      );
      if (!ok) {
        const form = String(option.gateParams?.form ?? '').replace('_', '-');
        reason =
          option.gate === 'IF_FORM' && form
            ? `Requires ${form} form`
            : 'Option requirements not met';
      }
    }

    if (!reason && option.cost) {
      const check = canPayAbilityCost(
        state,
        player,
        { id: `${prompt.promptId}_${option.id}`, timing: 'ACTION', cost: option.cost, steps: [] },
        source,
      );
      if (!check.allowed) reason = check.reason || 'Cannot pay the cost';
    }

    option.disabled = Boolean(reason);
    option.disabledReason = reason;
  }
}

/**
 * Enqueue a decision prompt into the structured FIFO prompt queue (ADR-0032).
 */
export function enqueueDecisionPrompt(state: GameState, prompt: PendingDecisionPrompt): GameState {
  if (!state.pendingDecisionQueue) {
    state.pendingDecisionQueue = [];
  }
  const queue = state.pendingDecisionQueue;

  queue.push({
    ...prompt,
    queuePosition: queue.length + 1,
    totalQueued: queue.length + 1,
  });

  // Re-index total queued count for all elements in queue
  const total = queue.length;
  for (let i = 0; i < queue.length; i++) {
    queue[i].queuePosition = i + 1;
    queue[i].totalQueued = total;
  }

  if (queue.length === 1) refreshPromptOptionAvailability(state, queue[0]);

  return state;
}

/**
 * Enqueue an interactive distribution prompt with dynamic capacity ceiling and shortfall notice (ADR-0064).
 */
export function enqueueDistributionPrompt(
  state: GameState,
  promptOrConfig:
    | PendingDecisionPrompt
    | (DistributionPromptConfig & {
        promptId?: string;
        playerId?: string;
        title?: string;
        description?: string;
        sourceCardName?: string;
      }),
): GameState {
  let prompt: PendingDecisionPrompt;
  let config: DistributionPromptConfig;

  if ('targets' in promptOrConfig && !('options' in promptOrConfig)) {
    config = promptOrConfig;
    prompt = {
      promptId:
        promptOrConfig.promptId ||
        `prompt_dist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      playerId: promptOrConfig.playerId || state.players[0]?.id || '',
      title: promptOrConfig.title || `Distribute ${config.budgetLabel || 'Points'}`,
      description: promptOrConfig.description || `Assign points across eligible targets:`,
      sourceCardName: promptOrConfig.sourceCardName || 'Game Effect',
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
  } else {
    prompt = promptOrConfig as PendingDecisionPrompt;
    prompt.kind = 'DISTRIBUTE_POINTS';
    if (!prompt.distributionConfig) {
      return enqueueDecisionPrompt(state, prompt);
    }
    config = prompt.distributionConfig;
  }

  // 1. Calculate total capacity across eligible targets
  const eligibleTargets = config.targets.filter((t) => t.isEligible !== false);
  const totalCapacity = eligibleTargets.reduce((sum, t) => sum + (t.allocationCap ?? 0), 0);

  // 2. Dynamic budget ceiling
  const effectiveBudget = Math.min(config.totalBudget, totalCapacity);
  config.effectiveBudget = effectiveBudget;

  // 3. If effectiveBudget === 0, auto-bypass prompt and return state
  if (effectiveBudget === 0) {
    return state;
  }

  // 4. If capacity < totalBudget, set shortfallNotice
  if (totalCapacity < config.totalBudget && !config.shortfallNotice) {
    config.shortfallNotice = `Only ${totalCapacity} available capacity across targets (reduced from ${config.totalBudget}).`;
  }

  if (!prompt.options || prompt.options.length === 0) {
    prompt.options = [
      {
        id: 'confirm_distribution',
        label: 'Confirm Assignment',
        effect: 'DISTRIBUTE_POINTS',
      },
    ];
  }

  return enqueueDecisionPrompt(state, prompt);
}

/**
 * Peek at the active head decision prompt waiting for player response.
 */
export function peekDecisionPrompt(state: GameState): PendingDecisionPrompt | undefined {
  return state.pendingDecisionQueue && state.pendingDecisionQueue.length > 0
    ? state.pendingDecisionQueue[0]
    : undefined;
}

/**
 * Pop the active head decision prompt after resolution.
 */
export function popDecisionPrompt(state: GameState): {
  state: GameState;
  prompt?: PendingDecisionPrompt;
} {
  if (!state.pendingDecisionQueue) {
    state.pendingDecisionQueue = [];
  }
  const queue = state.pendingDecisionQueue;
  const popped = queue.shift();

  // Re-index remaining queue
  const total = queue.length;
  for (let i = 0; i < queue.length; i++) {
    queue[i].queuePosition = i + 1;
    queue[i].totalQueued = total;
  }

  if (queue.length > 0) refreshPromptOptionAvailability(state, queue[0]);

  return { state, prompt: popped };
}

/**
 * Push an execution frame onto the resolution stack (ADR-0032).
 */
export function pushExecutionFrame(state: GameState, frame: ExecutionFrame): GameState {
  const nextState = { ...state };
  const stack = nextState.executionStack ? [...nextState.executionStack] : [];
  stack.push(frame);
  nextState.executionStack = stack;
  return nextState;
}

/**
 * Peek at the top execution frame on the resolution stack.
 */
export function peekExecutionFrame(state: GameState): ExecutionFrame | undefined {
  if (state.executionStack && state.executionStack.length > 0) {
    return state.executionStack[state.executionStack.length - 1];
  }
  return undefined;
}

/**
 * Pop the top execution frame from the resolution stack.
 */
export function popExecutionFrame(state: GameState): {
  state: GameState;
  frame?: ExecutionFrame;
} {
  const nextState = { ...state };
  const stack = nextState.executionStack ? [...nextState.executionStack] : [];
  const popped = stack.pop();
  nextState.executionStack = stack;
  return { state: nextState, frame: popped };
}

/** The threat placement a queued interrupt prompt belongs to, if any (#266). */
function threatPlacementIdOf(prompt: PendingDecisionPrompt): string | undefined {
  for (const option of prompt.options) {
    const id = (option.params?.context as { threatPlacementId?: string } | undefined)
      ?.threatPlacementId;
    if (id) return id;
  }
  return undefined;
}

/**
 * True while a queued threat interrupt can still be used: the card is where it was offered, its
 * cost is payable and its limit is unused (RR v1.8 Initiating Abilities).
 */
function isThreatInterruptStillUsable(state: GameState, prompt: PendingDecisionPrompt): boolean {
  const option = prompt.options.find((o) => o.effect === 'EXECUTE_OPTIONAL_TRIGGER');
  const ability = option?.params?.ability as CardAbility | undefined;
  const player = state.players.find((p) => p.id === prompt.playerId);
  if (!option || !ability || !player) return true;

  if (ability.limit === 'ONCE_PER_ROUND' && player.usedAbilitiesThisRound?.[ability.id]) {
    return false;
  }
  if (ability.limit === 'ONCE_PER_PHASE' && player.usedAbilitiesThisPhase?.[ability.id]) {
    return false;
  }

  const sourceId = option.params?.sourceCardInstanceId as string | undefined;
  if (!sourceId) return canPayAbilityCost(state, player, ability).allowed;

  const source =
    ability.zone === 'HAND'
      ? player.hand.find((c) => c.instanceId === sourceId)
      : [...player.tableau, ...player.allies, ...(player.attachments ?? [])].find(
          (c) => c.instanceId === sourceId,
        );
  return source ? canPayAbilityCost(state, player, ability, source).allowed : false;
}

/**
 * Closes the interrupt window of threat placements (#266): prompts of a placement with nothing
 * left to place are dropped without paying anything, and a queued prompt whose card is no longer
 * usable is dropped when it comes up.
 */
function pruneThreatInterruptPrompts(state: GameState): void {
  const queue = state.pendingDecisionQueue;
  if (!queue || queue.length === 0) return;
  const placements = state.pendingThreatPlacements ?? [];
  const isOpen = (id: string) => placements.some((p) => p.id === id && p.amount > 0);

  const kept = queue.filter((prompt) => {
    const id = threatPlacementIdOf(prompt);
    return !id || isOpen(id);
  });
  while (kept.length > 0) {
    const head = kept[0];
    if (!threatPlacementIdOf(head)) break;
    refreshPromptOptionAvailability(state, head);
    if (isThreatInterruptStillUsable(state, head)) break;
    kept.shift();
  }

  if (kept.length === queue.length) return;
  queue.splice(0, queue.length, ...kept);
  const total = queue.length;
  for (let i = 0; i < queue.length; i++) {
    queue[i].queuePosition = i + 1;
    queue[i].totalQueued = total;
  }
  if (queue.length > 0) refreshPromptOptionAvailability(state, queue[0]);
}

/**
 * After a prompt is answered: close the threat interrupt window, and once the queue is empty
 * finish the paused threat placements, then resume paused sequences (#248, #266).
 */
function resumeAfterPromptResolved(state: GameState): GameState {
  pruneThreatInterruptPrompts(state);
  if (peekDecisionPrompt(state)) return state;

  let current = state;
  if (current.pendingThreatPlacements && current.pendingThreatPlacements.length > 0) {
    current = finishPendingThreatPlacements(current);
  }
  if (!peekDecisionPrompt(current) && hasPendingSequence(current)) {
    current = resumePendingSequence(current);
  }
  return current;
}

/**
 * Resolve the active head decision prompt with player choice or voluntary pass (ADR-0032).
 */
export function resolveDecisionPrompt(
  state: GameState,
  playerId: string,
  selectedOptionId: string,
  paymentOptions?: AbilityPaymentOptions,
): {
  state: GameState;
  result: ActionResult;
  executedEffectRes?: any;
} {
  const prompt = peekDecisionPrompt(state);
  if (!prompt) {
    return { state, result: { success: false, error: 'No pending decision prompt active' } };
  }

  if (prompt.playerId !== playerId) {
    return {
      state,
      result: { success: false, error: 'Decision prompt belongs to another player' },
    };
  }

  // Handle explicit voluntary "Pass" option or option selection
  const isPassOption = selectedOptionId === 'pass' || selectedOptionId === 'PASS';
  const selectedOption = prompt.options.find((opt) => opt.id === selectedOptionId);

  if (!selectedOption && !isPassOption && !prompt.isVoluntary) {
    return {
      state,
      result: { success: false, error: `Invalid option id '${selectedOptionId}'` },
    };
  }

  refreshPromptOptionAvailability(state, prompt);
  if (selectedOption?.disabled && (selectedOption.gate || selectedOption.cost)) {
    return {
      state,
      result: { success: false, error: selectedOption.disabledReason || 'Option is disabled' },
    };
  }

  // Pop prompt from queue
  const { state: nextState } = popDecisionPrompt(state);
  const player = nextState.players.find((p) => p.id === playerId);
  const playerName = player ? player.name : playerId;

  if (
    isPassOption ||
    (selectedOption && (selectedOption.effect === 'PASS' || selectedOption.id === 'pass'))
  ) {
    nextState.log.push({
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      round: nextState.roundNumber,
      phase: nextState.phase,
      category: 'ability',
      key: 'decision.prompt.passed',
      params: { player: playerName, promptId: prompt.promptId, source: prompt.sourceCardName },
      onomatopoeia: 'PASSED',
    });

    // If resolving an encounter card interrupt (e.g. WHEN_REVEALED / TREACHERY_REVEALED)
    if (nextState.activeEncounterContext) {
      const activeCtx = nextState.activeEncounterContext;
      const targetPlayer = nextState.players.find((p) => p.id === activeCtx.targetPlayerId);
      if (targetPlayer && activeCtx.encounterCard) {
        resolveActiveEncounterCardAfterInterrupt(
          nextState,
          activeCtx.encounterCard,
          targetPlayer,
          Boolean(activeCtx.cancelled),
        );
      }
    }

    const finalState = resumeAfterPromptResolved(nextState);

    return {
      state: finalState,
      result: { success: true, onomatopoeia: 'PASSED' },
    };
  }

  const optionLabel = selectedOption ? selectedOption.label : selectedOptionId;

  nextState.log.push({
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now(),
    round: nextState.roundNumber,
    phase: nextState.phase,
    category: 'ability',
    key: 'decision.prompt.resolved',
    params: { player: playerName, option: optionLabel, promptId: prompt.promptId },
    onomatopoeia: 'CHOICE MADE!',
  });

  // Handle optional trigger execution
  const optContext = selectedOption?.params?.context as any;
  if (selectedOption?.effect === 'EXECUTE_OPTIONAL_TRIGGER' && selectedOption.params?.ability) {
    const optAbility = selectedOption.params.ability as CardAbility;
    const sourceCardInstanceId = selectedOption.params.sourceCardInstanceId as string | undefined;

    let sourceCardInst = sourceCardInstanceId
      ? player?.tableau.find((c) => c.instanceId === sourceCardInstanceId) ||
        player?.allies.find((c) => c.instanceId === sourceCardInstanceId) ||
        player?.attachments?.find((c) => c.instanceId === sourceCardInstanceId) ||
        player?.hand.find((c) => c.instanceId === sourceCardInstanceId)
      : undefined;

    // RR v1.8 "Initiating Abilities" steps 2-5: the board may have changed since the ability was
    // offered. Without a valid target it cannot be initiated: abort before paying any cost.
    const canInitiate =
      !player || abilityHasValidTarget(nextState, player, optAbility, sourceCardInst);
    if (!canInitiate) {
      nextState.log.push({
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp: Date.now(),
        round: nextState.roundNumber,
        phase: nextState.phase,
        category: 'ability',
        key: 'ability.aborted.noValidTarget',
        params: { player: playerName, ability: optAbility.id },
        onomatopoeia: 'NO VALID TARGET!',
      });
    }

    if (canInitiate && optAbility.cost && player) {
      executeAbilityCost(nextState, player, optAbility, sourceCardInst, paymentOptions);
    }

    if (canInitiate && player) {
      if (optAbility.limit === 'ONCE_PER_ROUND') {
        if (!player.usedAbilitiesThisRound) player.usedAbilitiesThisRound = {};
        player.usedAbilitiesThisRound[optAbility.id] =
          (player.usedAbilitiesThisRound[optAbility.id] || 0) + 1;
      } else if (optAbility.limit === 'ONCE_PER_PHASE') {
        if (!player.usedAbilitiesThisPhase) player.usedAbilitiesThisPhase = {};
        player.usedAbilitiesThisPhase[optAbility.id] =
          (player.usedAbilitiesThisPhase[optAbility.id] || 0) + 1;
      }
    }

    // A threat interrupt reads and changes the live amount of its paused placement, not the
    // snapshot taken when the prompt was built (#266).
    const pendingPlacement = optContext?.threatPlacementId
      ? nextState.pendingThreatPlacements?.find((p) => p.id === optContext.threatPlacementId)
      : undefined;
    const effectContext: EffectExecutionContext = {
      playerId,
      sourceCardInstance: sourceCardInst,
      eventTargetType: optContext?.targetType,
      eventTargetInstanceId: optContext?.targetInstanceId,
      threatAmount: pendingPlacement ? pendingPlacement.amount : optContext?.threatAmount,
      damageAmount: optContext?.damageAmount,
      interceptedValue: pendingPlacement
        ? pendingPlacement.amount
        : (optContext?.interceptedValue ?? optContext?.threatAmount ?? optContext?.damageAmount),
      resourcesSpent: selectedOption?.params?.resourcesSpent || optContext?.resourcesSpent,
    };
    const effectRes = canInitiate
      ? executeEffect(nextState, optAbility, effectContext)
      : { state: nextState, success: true, mutatedState: false, onomatopoeia: 'NO VALID TARGET!' };
    if (canInitiate && pendingPlacement && effectContext.threatAmount !== undefined) {
      pendingPlacement.amount = Math.max(0, effectContext.threatAmount);
    }

    if (
      canInitiate &&
      optAbility.steps?.some(
        (s) =>
          s.effect === 'CANCEL_WHEN_REVEALED' ||
          s.effect === 'CANCEL_WHEN_REVEALED_AND_ATTACK' ||
          s.effect === 'CANCEL_WHEN_REVEALED_AND_REVEAL_ANOTHER',
      )
    ) {
      if (nextState.activeEncounterContext) {
        nextState.activeEncounterContext.cancelled = true;
      }
    }

    if (canInitiate) {
      nextState.log.push({
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp: Date.now(),
        round: nextState.roundNumber,
        phase: nextState.phase,
        category: 'ability',
        key: `ability.${optAbility.id}.triggered`,
        params: { player: playerName },
        onomatopoeia: 'ABILITY TRIGGERED!',
      });
    }

    // If resolving an encounter card interrupt (e.g. WHEN_REVEALED / TREACHERY_REVEALED)
    if (nextState.activeEncounterContext) {
      const activeCtx = nextState.activeEncounterContext;
      const targetPlayer = nextState.players.find((p) => p.id === activeCtx.targetPlayerId);
      if (targetPlayer && activeCtx.encounterCard) {
        resolveActiveEncounterCardAfterInterrupt(
          nextState,
          activeCtx.encounterCard,
          targetPlayer,
          Boolean(activeCtx.cancelled),
        );
      }
    }

    const finalState = resumeAfterPromptResolved(nextState);

    return {
      state: finalState,
      result: {
        success: true,
        onomatopoeia: effectRes.onomatopoeia || 'ABILITY TRIGGERED!',
      },
      executedEffectRes: effectRes,
    };
  }

  // Look up source card instance if prompt originated from a specific in-play card
  const promptCardInst = prompt.sourceCardInstanceId
    ? player?.obligations?.find((c) => c.instanceId === prompt.sourceCardInstanceId) ||
      player?.allies.find((c) => c.instanceId === prompt.sourceCardInstanceId) ||
      player?.tableau.find((c) => c.instanceId === prompt.sourceCardInstanceId) ||
      player?.attachments?.find((c) => c.instanceId === prompt.sourceCardInstanceId) ||
      player?.hand.find((c) => c.instanceId === prompt.sourceCardInstanceId)
    : prompt.sourceCardCode
      ? player?.allies.find((c) => c.card.code === prompt.sourceCardCode) ||
        player?.tableau.find((c) => c.card.code === prompt.sourceCardCode)
      : undefined;

  // Process payment if paymentOptions were supplied for this choice prompt (ADR-0072)
  if (
    player &&
    paymentOptions &&
    ((paymentOptions.generatorInstanceIds && paymentOptions.generatorInstanceIds.length > 0) ||
      (paymentOptions.paymentCardInstanceIds && paymentOptions.paymentCardInstanceIds.length > 0))
  ) {
    const optParams = selectedOption?.params as Record<string, any> | undefined;
    const reqAmount =
      optParams?.resourceCost?.amount ??
      (typeof optParams?.resourceCost === 'number' ? optParams.resourceCost : undefined) ??
      (typeof optParams?.amount === 'number' && optParams.requiresPayment
        ? optParams.amount
        : undefined) ??
      1;
    const reqType = optParams?.resourceCost?.resourceType;

    executeResourceCostPayment(
      nextState,
      player,
      reqAmount,
      reqType,
      false,
      paymentOptions,
      promptCardInst,
      promptCardInst?.card?.faction,
    );
  }

  // Pay the chosen option's own cost (e.g. exhaust the identity) before its steps (Issue #158)
  if (player && selectedOption?.cost) {
    executeAbilityCost(
      nextState,
      player,
      {
        id: `${prompt.promptId}_${selectedOption.id}`,
        timing: 'ACTION',
        cost: selectedOption.cost,
        steps: [],
      },
      promptCardInst,
      paymentOptions,
    );
  }

  // Synthesize and execute ability
  const syntheticAbility: CardAbility = {
    id: `${prompt.promptId}_${selectedOption!.id}`,
    timing: 'ACTION',
    // A target chosen for a labelled ability keeps the ability's labels (#247)
    ...(Array.isArray(selectedOption?.params?.labels)
      ? { labels: selectedOption.params.labels as NonNullable<CardAbility['labels']> }
      : {}),
    steps:
      (selectedOption as any)?.steps && Array.isArray((selectedOption as any).steps)
        ? (selectedOption as any).steps
        : [
            {
              effect: selectedOption!.effect || 'RESOLVED',
              effectParams: selectedOption!.params || {},
            },
          ],
  };

  const effectRes = executeEffect(nextState, syntheticAbility, {
    playerId,
    sourceCardInstance: promptCardInst,
    sourceCardId: prompt.sourceCardInstanceId || prompt.sourceCardCode,
    resourcesSpent: selectedOption?.params?.resourcesSpent || optContext?.resourcesSpent,
    discardedCards: prompt.discardedCards,
    isFinalStep: prompt.isFinalStep,
  });

  // Completion default for obligations: discard unless an option already removed it from play
  if (prompt.completion === 'DISCARD_SOURCE_OBLIGATION' && prompt.sourceCardInstanceId) {
    discardResolvedObligation(effectRes.state, prompt.sourceCardInstanceId);
  }

  // The chosen option may have changed state later prompts depend on (e.g. a form flip)
  refreshPromptOptionAvailability(effectRes.state, peekDecisionPrompt(effectRes.state));

  const finalState = resumeAfterPromptResolved(effectRes.state);

  return {
    state: finalState,
    result: {
      success: true,
      onomatopoeia: effectRes.onomatopoeia || 'CHOICE RESOLVED!',
    },
    executedEffectRes: effectRes,
  };
}
