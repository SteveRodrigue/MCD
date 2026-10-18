import type { GameLogEntry, GameState } from '@engine/models';
import { nextEngineId } from './rng';

/** A log entry as written by the engine: id, timestamp, round and phase are filled in. */
export type LogEntryInput = Omit<GameLogEntry, 'id' | 'timestamp'>;

/**
 * Appends an entry to the game log (ADR-0081). The id and the timestamp come from the engine id
 * counter, so the same seed always produces the same log; round and phase default to the
 * state's current ones.
 */
export function appendLog(state: GameState, entry: LogEntryInput): GameLogEntry {
  const id = nextEngineId(state, 'log');
  const logEntry: GameLogEntry = {
    id,
    timestamp: state.idCounter ?? 0,
    round: state.roundNumber,
    phase: state.phase,
    ...entry,
  };
  state.log.push(logEntry);
  return logEntry;
}
