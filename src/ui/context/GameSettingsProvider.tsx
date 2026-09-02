import React, { useEffect, useState } from 'react';
import {
  DEFAULT_SETTINGS,
  GameSettings,
  GameSettingsContext,
  STORAGE_KEY,
} from './game-settings-context';

export const GameSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<GameSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.warn('Failed to read game settings from localStorage:', error);
    }
    return DEFAULT_SETTINGS;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.warn('Failed to save game settings to localStorage:', error);
    }
  }, [settings]);

  const setDevMode = (enabled: boolean) => {
    setSettings((previous) => ({ ...previous, devMode: enabled }));
  };

  const toggleDevMode = () => {
    setSettings((previous) => ({ ...previous, devMode: !previous.devMode }));
  };

  const setEdgeScrollSpeed = (speed: 'slow' | 'normal' | 'fast') => {
    setSettings((previous) => ({ ...previous, edgeScrollSpeed: speed }));
  };

  const setCardZoomLevel = (level: 'small' | 'normal' | 'larger') => {
    setSettings((previous) => ({ ...previous, cardZoomLevel: level }));
  };

  const setDefaultDifficulty = (difficulty: typeof DEFAULT_SETTINGS.defaultDifficulty) => {
    setSettings((previous) => ({ ...previous, defaultDifficulty: difficulty }));
  };

  const setDefaultHeroicLevel = (level: number) => {
    setSettings((previous) => ({ ...previous, defaultHeroicLevel: Math.max(0, level) }));
  };

  const updateSettings = (partial: Partial<typeof DEFAULT_SETTINGS>) => {
    setSettings((previous) => ({ ...previous, ...partial }));
  };

  return (
    <GameSettingsContext.Provider
      value={{
        settings,
        devMode: settings.devMode,
        edgeScrollSpeed: settings.edgeScrollSpeed || 'normal',
        cardZoomLevel: settings.cardZoomLevel || 'normal',
        defaultDifficulty: settings.defaultDifficulty || 'STANDARD',
        defaultHeroicLevel: settings.defaultHeroicLevel || 0,
        setDevMode,
        toggleDevMode,
        setEdgeScrollSpeed,
        setCardZoomLevel,
        setDefaultDifficulty,
        setDefaultHeroicLevel,
        updateSettings,
      }}
    >
      {children}
    </GameSettingsContext.Provider>
  );
};
