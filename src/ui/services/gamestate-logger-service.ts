import { GameState, GameAction } from '../../engine/models';

export interface GameStateSnapshotPayload {
  state: GameState;
  action?: GameAction;
  label?: string;
  timestamp: number;
}

/**
 * Saves a GameState snapshot to the local logs/gamestates/ directory via the Vite dev server endpoint.
 */
export async function logGameStateSnapshot(
  state: GameState,
  action?: GameAction,
  label?: string,
): Promise<void> {
  const payload: GameStateSnapshotPayload = {
    state,
    action,
    label: label || (action ? `Action: ${action.type}` : 'State Transition'),
    timestamp: Date.now(),
  };

  try {
    await fetch('/api/logs/gamestate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // Gracefully ignore network errors when running standalone
  }
}

/**
 * Snapshots `state` once the browser is idle, so serialising it never delays an action.
 * Returns a cancel function: a newer state replaces a snapshot that is still waiting.
 */
export function scheduleGameStateSnapshot(state: GameState): () => void {
  const snapshot = () => void logGameStateSnapshot(state);
  if (typeof requestIdleCallback === 'function') {
    const handle = requestIdleCallback(snapshot);
    return () => cancelIdleCallback(handle);
  }
  const handle = setTimeout(snapshot, 0);
  return () => clearTimeout(handle);
}
