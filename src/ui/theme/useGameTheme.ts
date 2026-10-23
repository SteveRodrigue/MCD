import { createContext, useContext } from 'react';
import type { ModalStyleId } from './modal-styles';

export interface GameThemeContextValue {
  /** The theme in effect right now (fixed choice, or this game's Random roll). */
  activeThemeId: ModalStyleId;
  /** The Random roll of the current game, or null before any game started. */
  gameThemeId: ModalStyleId | null;
  /** Resolves the theme for a new game (or a Re-roll) from the player's settings and returns it. */
  rollGameTheme: () => ModalStyleId;
}

export const GameThemeContext = createContext<GameThemeContextValue | undefined>(undefined);

export const useGameTheme = (): GameThemeContextValue => {
  const value = useContext(GameThemeContext);
  if (!value) throw new Error('useGameTheme must be used inside ThemeProvider');
  return value;
};
