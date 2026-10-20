import React from 'react';
import { vi } from 'vitest';
import type { GameAction, GameState } from '../../src/engine/models';
import { GameSessionProvider } from '../../src/ui/context/GameStateContext';

interface TestSessionProps {
  state: GameState;
  dispatch?: (action: GameAction) => void;
  children: React.ReactNode;
}

/** The game session the board components read; `dispatch` defaults to a mock nobody inspects. */
export const TestSession: React.FC<TestSessionProps> = ({ state, dispatch, children }) => (
  <GameSessionProvider state={state} dispatch={dispatch ?? vi.fn()}>
    {children}
  </GameSessionProvider>
);
