import { createContext, useContext } from 'react';
import { DEFAULT_MODAL_STYLE, type ModalStyleId } from './modal-styles';

export interface GameThemeContextValue {
  /** The theme in effect right now (fixed choice, or this game's Random roll). */
  activeThemeId: ModalStyleId;
  /** The Random roll of the current game, or null before any game started. */
  gameThemeId: ModalStyleId | null;
  /** Resolves the theme for a new game (or a Re-roll) from the player's settings and returns it. */
  rollGameTheme: () => ModalStyleId;
}

/** Without a ThemeProvider (isolated component renders) the default theme applies and rolls are no-ops. */
const NO_PROVIDER: GameThemeContextValue = {
  activeThemeId: DEFAULT_MODAL_STYLE.id,
  gameThemeId: null,
  rollGameTheme: () => DEFAULT_MODAL_STYLE.id,
};

export const GameThemeContext = createContext<GameThemeContextValue>(NO_PROVIDER);

export const useGameTheme = (): GameThemeContextValue => useContext(GameThemeContext);
