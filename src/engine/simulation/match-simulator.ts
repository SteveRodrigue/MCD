import { GameState, GamePhase, getActiveVillain } from '@engine/models';
import { dispatchAction, peekDecisionPrompt } from '../pipeline';
import { chooseBotAction, chooseDefenderOption } from './player-bot';
import { assertGameStateInvariants } from '../state/state-validator';

export interface MatchSimulationOptions {
  maxRounds?: number;
  maxActionsPerTurn?: number;
  seed?: string;
}

export interface MatchSimulationResult {
  winner: 'HEROES' | 'VILLAIN' | 'TIMEOUT';
  roundsPlayed: number;
  totalActionsExecuted: number;
  finalState: GameState;
  logSummary: string[];
  seed?: string;
  heroNames: string[];
  villainName: string;
  difficulty: string;
  playerCount: number;
}

/**
 * Automatically and legally resolves a single pending decision prompt using heuristic defaults.
 */
function resolveDecisionPromptHeuristically(state: GameState, seed: string): GameState {
  const prompt = peekDecisionPrompt(state);
  if (!prompt) return state;

  // 1. Multi-select prompt (selection: { min, max }); the clean-up discard keeps the whole hand
  if (prompt.selection) {
    const min = prompt.selection.min;
    const max = prompt.selection.max;
    const validOptions = prompt.options.filter((o) => !o.disabled && o.id !== 'confirm');
    const keepsHand = prompt.kind === 'PLAYER_CLEANUP';
    const chosenCount = keepsHand
      ? 0
      : Math.min(max, Math.max(min, validOptions.length > 0 ? 1 : 0));
    const chosen = validOptions.slice(0, chosenCount).map((o) => o.id);
    const confirmOpt = prompt.options.find((o) => o.id === 'confirm') || prompt.options[0];
    const { state: nextState, result } = dispatchAction(state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: prompt.playerId,
      selectedOptionId: confirmOpt?.id || chosen[0] || '',
      selectedOptionIds: chosen,
    });
    if (!result.success) {
      throw new Error(
        `[MatchSimulator] Failed to resolve multi-select prompt '${prompt.title}': ${result.error || 'unknown error'} (seed: ${seed})`,
      );
    }
    return nextState;
  }

  // 2. Distribution prompt (DISTRIBUTE_POINTS / distributionConfig)
  if (prompt.distributionConfig || prompt.kind === 'DISTRIBUTE_POINTS') {
    const config = prompt.distributionConfig;
    if (config) {
      const targets = (config.targets || []).filter((t) => t.isEligible !== false);
      const budget = config.effectiveBudget ?? config.totalBudget ?? 0;
      const assignments: Record<string, number> = {};
      let remaining = budget;
      for (const t of targets) {
        if (remaining <= 0) break;
        const cap = t.allocationCap ?? remaining;
        const alloc = Math.min(remaining, cap);
        if (alloc > 0) {
          assignments[t.instanceId] = alloc;
          remaining -= alloc;
        }
      }
      const confirmOpt =
        prompt.options.find((o) => o.id === 'confirm_distribution' || o.id === 'confirm') ||
        prompt.options[0];
      const { state: nextState, result } = dispatchAction(state, {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId: prompt.playerId,
        selectedOptionId: confirmOpt?.id || 'confirm_distribution',
        assignments,
      });
      if (result.success) return nextState;

      if (config.canCancel || prompt.isVoluntary) {
        const { state: cancelState, result: cancelRes } = dispatchAction(state, {
          type: 'RESOLVE_DECISION_PROMPT',
          playerId: prompt.playerId,
          selectedOptionId: 'cancel',
        });
        if (cancelRes.success) return cancelState;
      }
    }
  }

  // 3. Defender declaration: defend only when the hit is dangerous (the bot's defender policy)
  const defenderId = chooseDefenderOption(state, prompt);
  if (defenderId) {
    const { state: nextState, result } = dispatchAction(state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: prompt.playerId,
      selectedOptionId: defenderId,
    });
    if (result.success) return nextState;
  }

  // 4. Standard decision prompt: pick first enabled option
  const enabledOptions = prompt.options.filter((o) => !o.disabled);
  if (enabledOptions.length === 0) {
    if (prompt.isVoluntary) {
      const passOpt = prompt.options.find((o) => o.id === 'pass' || o.id === 'cancel');
      if (passOpt) {
        const { state: passState, result: passRes } = dispatchAction(state, {
          type: 'RESOLVE_DECISION_PROMPT',
          playerId: prompt.playerId,
          selectedOptionId: passOpt.id,
        });
        if (passRes.success) return passState;
      }
    }
    throw new Error(
      `[MatchSimulator] Prompt '${prompt.title}' (${prompt.promptId}) has no enabled options to select (seed: ${seed}).`,
    );
  }

  const rejections: string[] = [];
  for (const candidate of enabledOptions) {
    const { state: nextState, result } = dispatchAction(state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: prompt.playerId,
      selectedOptionId: candidate.id,
    });
    if (result.success) {
      return nextState;
    }
    rejections.push(`${candidate.id}: ${result.error ?? 'rejected'}`);
  }

  throw new Error(
    `[MatchSimulator] Failed to legally resolve prompt '${prompt.title}' across ${enabledOptions.length} candidate option(s) [${rejections.join('; ')}] (seed: ${seed}).`,
  );
}

/**
 * Drain all queued decision prompts iteratively until empty or game ends.
 */
function drainPrompts(currentState: GameState, seed: string): GameState {
  let s = currentState;
  let count = 0;
  const MAX_ATTEMPTS = 50;

  while (peekDecisionPrompt(s) && !s.winner) {
    if (count >= MAX_ATTEMPTS) {
      const prompt = peekDecisionPrompt(s);
      throw new Error(
        `[MatchSimulator] Exceeded max prompt resolution attempts (${MAX_ATTEMPTS}) on prompt '${prompt?.title}' (ID: ${prompt?.promptId}) with seed: ${seed}`,
      );
    }
    s = resolveDecisionPromptHeuristically(s, seed);
    count++;
  }

  return s;
}

/**
 * Runs a complete headless match simulation from the given starting GameState.
 */
export function runMatch(
  initialState: GameState,
  options: MatchSimulationOptions = {},
): MatchSimulationResult {
  const maxRounds = options.maxRounds || 30;
  const maxActionsPerTurn = options.maxActionsPerTurn || 15;
  const seed = options.seed || (initialState.rng ? String(initialState.rng.seed) : 'unseeded');

  // Capture match metadata from initial state
  const heroNames = initialState.players.map((p) => p.hero?.name || p.name);
  const villainName = getActiveVillain(initialState)?.card?.name || 'Rhino';
  const difficulty = initialState.difficulty || 'STANDARD';
  const playerCount = initialState.players.length;

  let state: GameState = initialState;
  let totalActions = 0;

  // 0. Auto-resolve mulligan if match starts in SETUP_PHASE
  if (state.phase === GamePhase.SETUP_PHASE) {
    for (const p of state.players) {
      if (state.setupState && !state.setupState.mulliganCompleted[p.id]) {
        const { state: nextState } = dispatchAction(state, {
          type: 'RESOLVE_MULLIGAN',
          playerId: p.id,
          discardCardInstanceIds: [],
        });
        state = nextState;
      }
    }
  }

  // Drain any setup prompts (e.g. Black Panther's Foresight)
  state = drainPrompts(state, seed);

  // The engine drives the round: END_PLAYER_TURN runs clean-up, the villain phase and round upkeep.
  let actionCountForTurn = 0;
  while (!state.winner && state.roundNumber <= maxRounds) {
    if (state.phase !== GamePhase.PLAYER_PHASE) {
      throw new Error(
        `[MatchSimulator] Expected PLAYER_PHASE with no pending prompt, found ${state.phase} at step ${state.villainPhaseStep} after '${state.log.at(-1)?.key}' (seed: ${seed}).`,
      );
    }
    const player = state.players[state.activePlayerIndex];

    if (actionCountForTurn < maxActionsPerTurn) {
      const botAction = chooseBotAction({ state, playerId: player.id });
      if (botAction.type !== 'END_PLAYER_TURN') {
        const dispatchResult = dispatchAction(state, botAction);
        // An illegal bot choice ends the turn
        if (dispatchResult.result.success) {
          state = drainPrompts(dispatchResult.state, seed);
          totalActions += 1;
          actionCountForTurn += 1;
          continue;
        }
      }
    }

    const roundBefore = state.roundNumber;
    const endTurn = dispatchAction(state, { type: 'END_PLAYER_TURN', playerId: player.id });
    if (!endTurn.result.success) {
      throw new Error(
        `[MatchSimulator] END_PLAYER_TURN rejected for ${player.id}: ${endTurn.result.error} (seed: ${seed}).`,
      );
    }
    state = drainPrompts(endTurn.state, seed);
    actionCountForTurn = 0;

    if (state.roundNumber !== roundBefore) {
      assertGameStateInvariants(state);
    }
  }

  // Invariant assertion at match end
  assertGameStateInvariants(state);

  const finalWinner = state.winner || 'TIMEOUT';

  return {
    winner: finalWinner,
    roundsPlayed: state.roundNumber,
    totalActionsExecuted: totalActions,
    finalState: state,
    logSummary: state.log.map(
      (l) => `[Round ${state.roundNumber}] ${l.onomatopoeia ? l.onomatopoeia + ' ' : ''}${l.key}`,
    ),
    seed,
    heroNames,
    villainName,
    difficulty,
    playerCount,
  };
}
