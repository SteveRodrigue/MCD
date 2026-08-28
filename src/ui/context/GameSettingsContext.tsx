import React, { createContext, useContext, useState, useEffect } from 'react';

export type EdgeScrollSpeed = 'slow' | 'normal' | 'fast';

export interface GameSettings {
  devMode: boolean;
  soundEnabled: boolean;
  animationsSpeed: 'normal' | 'fast' | 'instant';
  sideBySideLayout: boolean;
  edgeScrollSpeed: EdgeScrollSpeed;
}

interface GameSettingsContextType {
  settings: GameSettings;
  devMode: boolean;
  sideBySideLayout: boolean;
  edgeScrollSpeed: EdgeScrollSpeed;
  setDevMode: (enabled: boolean) => void;
  toggleDevMode: () => void;
  setSideBySideLayout: (enabled: boolean) => void;
  toggleSideBySide: () => void;
  setEdgeScrollSpeed: (speed: EdgeScrollSpeed) => void;
  updateSettings: (partial: Partial<GameSettings>) => void;
}

const DEFAULT_SETTINGS: GameSettings = {
  devMode: true, // ON by default for development mode
  soundEnabled: true,
  animationsSpeed: 'normal',
  sideBySideLayout: true,
  edgeScrollSpeed: 'normal', // Default is faster than previous slow baseline
};

const STORAGE_KEY = 'mcd_game_settings';

const GameSettingsContext = createContext<GameSettingsContextType | undefined>(undefined);

export const GameSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<GameSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Failed to read game settings from localStorage:', e);
    }
    return DEFAULT_SETTINGS;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn('Failed to save game settings to localStorage:', e);
    }
  }, [settings]);

  const setDevMode = (enabled: boolean) => {
    setSettings((prev) => ({ ...prev, devMode: enabled }));
  };

  const toggleDevMode = () => {
    setSettings((prev) => ({ ...prev, devMode: !prev.devMode }));
  };

  const setSideBySideLayout = (enabled: boolean) => {
    setSettings((prev) => ({ ...prev, sideBySideLayout: enabled }));
  };

  const toggleSideBySide = () => {
    setSettings((prev) => ({ ...prev, sideBySideLayout: !prev.sideBySideLayout }));
  };

  const setEdgeScrollSpeed = (speed: EdgeScrollSpeed) => {
    setSettings((prev) => ({ ...prev, edgeScrollSpeed: speed }));
  };

  const updateSettings = (partial: Partial<GameSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  };

  return (
    <GameSettingsContext.Provider
      value={{
        settings,
        devMode: settings.devMode,
        sideBySideLayout: settings.sideBySideLayout,
        edgeScrollSpeed: settings.edgeScrollSpeed || 'normal',
        setDevMode,
        toggleDevMode,
        setSideBySideLayout,
        toggleSideBySide,
        setEdgeScrollSpeed,
        updateSettings,
      }}
    >
      {children}
    </GameSettingsContext.Provider>
  );
};

export function useGameSettings(): GameSettingsContextType {
  const context = useContext(GameSettingsContext);
  if (!context) {
    throw new Error('useGameSettings must be used within a GameSettingsProvider');
  }
  return context;
}
