/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext } from 'react';
import { GameState } from '../../engine/models';

export const GameStateContext = createContext<GameState | undefined>(undefined);

export interface GameStateProviderProps {
  value?: GameState;
  children: React.ReactNode;
}

export const GameStateProvider: React.FC<GameStateProviderProps> = ({ value, children }) => {
  return <GameStateContext.Provider value={value}>{children}</GameStateContext.Provider>;
};

export function useGameState(): GameState | undefined {
  return useContext(GameStateContext);
}
