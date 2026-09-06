import {
  GameState,
  PendingDecisionPrompt,
  ExecutionFrame,
  ActionResult,
  CardAbility,
} from '../models';
import { executeEffect } from '../effects';
import { executeAbilityCost } from './cost-engine';
import { resolveActiveEncounterCardAfterInterrupt } from './villain-phase';

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

  state.pendingDecisionPrompt = queue[0];
  return state;
}

/**
 * Peek at the active head decision prompt waiting for player response.
 */
export function peekDecisionPrompt(state: GameState): PendingDecisionPrompt | undefined {
  if (state.pendingDecisionQueue && state.pendingDecisionQueue.length > 0) {
    return state.pendingDecisionQueue[0];
  }
  return state.pendingDecisionPrompt;
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

  state.pendingDecisionPrompt = queue.length > 0 ? queue[0] : undefined;
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

/**
 * Resolve the active head decision prompt with player choice or voluntary pass (ADR-0032).
 */
export function resolveDecisionPrompt(
  state: GameState,
  playerId: string,
  selectedOptionId: string,
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

    return {
      state: nextState,
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
  if (selectedOption?.effect === 'EXECUTE_OPTIONAL_TRIGGER' && selectedOption.params?.ability) {
    const optAbility = selectedOption.params.ability as CardAbility;
    const optContext = selectedOption.params.context as any;
    const sourceCardInstanceId = selectedOption.params.sourceCardInstanceId as string | undefined;

    let sourceCardInst = sourceCardInstanceId
      ? player?.tableau.find((c) => c.instanceId === sourceCardInstanceId) ||
        player?.attachments?.find((c) => c.instanceId === sourceCardInstanceId) ||
        player?.hand.find((c) => c.instanceId === sourceCardInstanceId)
      : undefined;

    if (optAbility.cost && player) {
      executeAbilityCost(nextState, player, optAbility, sourceCardInst);
    }

    if (player) {
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

    const effectRes = executeEffect(nextState, optAbility, {
      playerId,
      sourceCardInstance: sourceCardInst,
      targetType: optContext?.targetType,
      targetInstanceId: optContext?.targetInstanceId,
    });

    if (
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

    return {
      state: nextState,
      result: {
        success: true,
        onomatopoeia: effectRes.onomatopoeia || 'ABILITY TRIGGERED!',
      },
      executedEffectRes: effectRes,
    };
  }

  // Synthesize and execute ability
  const syntheticAbility: CardAbility = {
    id: `${prompt.promptId}_${selectedOption!.id}`,
    timing: 'ACTION',
    steps:
      (selectedOption as any)?.steps && Array.isArray((selectedOption as any).steps)
        ? (selectedOption as any).steps
        : [
            {
              effect: selectedOption!.effect || 'RESOLVED',
              params: selectedOption!.params || {},
            },
          ],
  };

  const effectRes = executeEffect(nextState, syntheticAbility, {
    playerId,
  });

  return {
    state: effectRes.state,
    result: {
      success: true,
      onomatopoeia: effectRes.onomatopoeia || 'CHOICE RESOLVED!',
    },
    executedEffectRes: effectRes,
  };
}
