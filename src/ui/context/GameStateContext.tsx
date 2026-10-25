/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useMemo } from 'react';
import { GameAction, GameState } from '../../engine/models';
import {
  evaluateCardPlayability,
  type CardPlayabilityStatus,
} from '../../engine/pipeline/legality-checker';

/** What every board component reads: the state, the way to change it, and what the hands may play. */
export interface GameSession {
  state: GameState;
  dispatch: (action: GameAction) => void;
  /** One playability result per hand card (by instance id); built on first use, once per state. */
  getPlayability: () => ReadonlyMap<string, CardPlayabilityStatus>;
}

export const GameSessionContext = createContext<GameSession | undefined>(undefined);

export interface GameSessionProviderProps {
  state: GameState;
  dispatch: (action: GameAction) => void;
  children: React.ReactNode;
}

/** Calls `make` on the first call and returns that result from then on. */
function once<T>(make: () => T): () => T {
  let made: { value: T } | undefined;
  return () => (made ??= { value: make() }).value;
}

function buildPlayability(state: GameState): Map<string, CardPlayabilityStatus> {
  const playability = new Map<string, CardPlayabilityStatus>();
  for (const player of state.players) {
    for (const cardInst of player.hand) {
      playability.set(cardInst.instanceId, evaluateCardPlayability(state, player.id, cardInst));
    }
  }
  return playability;
}

export const GameSessionProvider: React.FC<GameSessionProviderProps> = ({
  state,
  dispatch,
  children,
}) => {
  const session = useMemo<GameSession>(
    () => ({ state, dispatch, getPlayability: once(() => buildPlayability(state)) }),
    [state, dispatch],
  );
  return <GameSessionContext.Provider value={session}>{children}</GameSessionContext.Provider>;
};

/** For components that also render outside a game (card previews in the editor and setup). */
export function useOptionalGameSession(): GameSession | undefined {
  return useContext(GameSessionContext);
}

export function useGameSession(): GameSession {
  const session = useOptionalGameSession();
  if (!session) throw new Error('useGameSession must be used inside a GameSessionProvider');
  return session;
}
