import { GameState } from '@engine/models';
import { ScenarioRegistry } from '@engine/scenarios';

/**
 * Handles a villain reaching 0 HP by delegating stage progression,
 * When Revealed triggers, or victory evaluation to the registered ScenarioPlugin.
 */
export function handleVillainDefeat(state: GameState, villainInstanceId?: string): GameState {
  const scenarioId = state.scenarioId || 'rhino';
  if (ScenarioRegistry.has(scenarioId)) {
    const plugin = ScenarioRegistry.get(scenarioId);
    const targetId =
      villainInstanceId || state.villains?.[state.activeVillainIndex ?? 0]?.instanceId || '';
    const res = plugin.onVillainDefeated(state, targetId);
    return res.state;
  }

  state.winner = 'HEROES';
  return state;
}

/**
 * Handles a main scheme reaching its target threat threshold by delegating stage progression
 * or game defeat to the registered ScenarioPlugin.
 */
export function handleMainSchemeCompletion(
  state: GameState,
  mainSchemeInstanceId?: string,
): GameState {
  const scenarioId = state.scenarioId || 'rhino';
  if (ScenarioRegistry.has(scenarioId)) {
    const plugin = ScenarioRegistry.get(scenarioId);
    const targetId =
      mainSchemeInstanceId ||
      state.mainSchemes?.[state.activeMainSchemeIndex ?? 0]?.instanceId ||
      '';
    const res = plugin.onMainSchemeCompleted(state, targetId);
    return res.state;
  }

  state.winner = 'VILLAIN';
  return state;
}
