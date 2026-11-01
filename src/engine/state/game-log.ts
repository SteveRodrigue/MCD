import { GamePhase } from '@engine/models';
import type { GameLogEntry, GameState, LogEvents, TypedGameLogEntry } from '@engine/models';
import { nextEngineId } from './rng';

type EmptyObject = Record<string, never>;

/** A log entry as written by the engine: id, timestamp, round and phase are filled in. */
export type LogEntryInput<K extends keyof LogEvents = keyof LogEvents> = {
  key: K;
  category?: GameLogEntry['category'];
  actor?: GameLogEntry['actor'];
  onomatopoeia?: string;
  text?: string;
  round?: number;
  phase?: GameLogEntry['phase'];
} & ([LogEvents[K]] extends [EmptyObject] ? { params?: LogEvents[K] } : { params: LogEvents[K] });

/**
 * Appends an entry to the game log (ADR-0081). The id and the timestamp come from the engine id
 * counter, so the same seed always produces the same log; round and phase default to the
 * state's current ones, and a player-phase entry records whose turn it is (`turnPlayerId`).
 */
export function appendLog<K extends keyof LogEvents>(
  state: GameState,
  entry: LogEntryInput<K>,
): TypedGameLogEntry<K> {
  const id = nextEngineId(state, 'log');
  const logEntry: GameLogEntry = {
    id,
    timestamp: state.idCounter ?? 0,
    round: state.roundNumber,
    phase: state.phase,
    ...(state.phase === GamePhase.PLAYER_PHASE &&
      state.players[state.activePlayerIndex] && {
        turnPlayerId: state.players[state.activePlayerIndex].id,
      }),
    ...entry,
  };
  state.log.push(logEntry);
  return logEntry as unknown as TypedGameLogEntry<K>;
}
