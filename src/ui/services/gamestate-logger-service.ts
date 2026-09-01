import { GameState, GameAction } from '../../engine/models';

export interface GameStateSnapshotPayload {
  state: GameState;
  action?: GameAction;
  label?: string;
  timestamp: number;
}

/**
 * Saves a GameState snapshot to the local logs/gamestates/ directory via the Vite dev server endpoint.
 * Also persists the latest state to client-side localStorage/sessionStorage as backup.
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

  // 1. Backup to sessionStorage
  try {
    sessionStorage.setItem('mcd_latest_gamestate', JSON.stringify(payload));
  } catch (e) {
    // Ignore storage quota limits in browser
  }

  // 2. Post to Vite / Server snapshot endpoint
  try {
    await fetch('/api/logs/gamestate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    // Gracefully ignore network errors when running standalone
  }
}
