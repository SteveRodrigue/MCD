import React, { useCallback, useMemo, useState } from 'react';
import { useGameSettings } from '../context/useGameSettings';
import { ModalStyleProvider } from './ModalStyleContext';
import { DEFAULT_MODAL_STYLE, getModalStyle, isThemeId, type ModalStyleId } from './modal-styles';
import { resolveTheme } from './resolve-theme';
import { GameThemeContext } from './useGameTheme';

/** The Random roll survives a page reload mid-game; a new game replaces it. */
export const GAME_THEME_STORAGE_KEY = 'mcd_game_theme';

const readStoredGameTheme = (): ModalStyleId | null => {
  try {
    const stored = sessionStorage.getItem(GAME_THEME_STORAGE_KEY);
    return isThemeId(stored) ? stored : null;
  } catch {
    return null;
  }
};

const storeGameTheme = (id: ModalStyleId): void => {
  try {
    sessionStorage.setItem(GAME_THEME_STORAGE_KEY, id);
  } catch {
    // Storage can be unavailable (private mode); the roll then lasts until reload.
  }
};

export interface ThemeProviderProps {
  children: React.ReactNode;
}

/**
 * App-level theme engine: the player's fixed theme, or this game's Random roll, plus the card
 * accent switch. `rollGameTheme` is called when a game starts (or on Re-roll).
 */
export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const { settings } = useGameSettings();
  const [gameThemeId, setGameThemeId] = useState<ModalStyleId | null>(readStoredGameTheme);

  const { themeMode, themeId, randomThemePool } = settings;

  const rollGameTheme = useCallback((): ModalStyleId => {
    const rolled = resolveTheme({
      mode: themeMode,
      themeId,
      pool: randomThemePool,
      previousId: gameThemeId,
    });
    setGameThemeId(rolled);
    storeGameTheme(rolled);
    return rolled;
  }, [themeMode, themeId, randomThemePool, gameThemeId]);

  const activeThemeId = themeMode === 'random' ? (gameThemeId ?? themeId) : themeId;
  const style = getModalStyle(activeThemeId) ?? DEFAULT_MODAL_STYLE;

  const value = useMemo(
    () => ({ activeThemeId: style.id, gameThemeId, rollGameTheme }),
    [style.id, gameThemeId, rollGameTheme],
  );

  return (
    <GameThemeContext.Provider value={value}>
      <ModalStyleProvider style={style} cardAccents={settings.cardAccents}>
        {children}
      </ModalStyleProvider>
    </GameThemeContext.Provider>
  );
};
