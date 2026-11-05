import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  DEFAULT_SETTINGS,
  GameSettings,
  GameSettingsContext,
  type PhaseStepperSide,
  STORAGE_KEY,
} from './game-settings-context';
import { setDisabledArtPacks } from '../../data/content/store';
import { sanitizeThemeSettings } from '../theme/theme-settings';

/** A saved list that is not an array of strings is treated as "every art pack on". */
function sanitizeDisabledArtPacks(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((id): id is string => typeof id === 'string'))]
    : [];
}

export const GameSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<GameSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
        return sanitizeThemeSettings({
          ...parsed,
          disabledArtPacks: sanitizeDisabledArtPacks(parsed.disabledArtPacks),
        });
      }
    } catch (error) {
      console.warn('Failed to read game settings from localStorage:', error);
    }
    return DEFAULT_SETTINGS;
  });

  // The art lookup is a plain function outside React, so it learns the switches here. A layout
  // effect runs before paint, so a saved "off" never flashes the pack's art.
  useLayoutEffect(() => {
    setDisabledArtPacks(settings.disabledArtPacks);
  }, [settings.disabledArtPacks]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.warn('Failed to save game settings to localStorage:', error);
    }
  }, [settings]);

  // setSettings never changes, so the setters are built once and the context value only changes
  // with the settings; consumers (every CardView) then skip re-renders caused by game updates.
  const actions = useMemo(() => {
    const setDevMode = (enabled: boolean) => {
      setSettings((previous) => ({ ...previous, devMode: enabled }));
    };

    const toggleDevMode = () => {
      setSettings((previous) => ({ ...previous, devMode: !previous.devMode }));
    };

    const setAutoResolveUnambiguous = (enabled: boolean) => {
      setSettings((previous) => ({ ...previous, autoResolveUnambiguous: enabled }));
    };

    const toggleAutoResolveUnambiguous = () => {
      setSettings((previous) => ({
        ...previous,
        autoResolveUnambiguous: !(previous.autoResolveUnambiguous !== false),
      }));
    };

    const setEdgeScrollSpeed = (speed: 'slow' | 'normal' | 'fast') => {
      setSettings((previous) => ({ ...previous, edgeScrollSpeed: speed }));
    };

    const setCardZoomLevel = (level: 'small' | 'normal' | 'larger') => {
      setSettings((previous) => ({ ...previous, cardZoomLevel: level }));
    };

    const setVillainPhasePacing = (pacing: 'auto_normal' | 'auto_fast' | 'manual' | 'instant') => {
      setSettings((previous) => ({ ...previous, villainPhasePacing: pacing }));
    };

    const setPhaseStepperSide = (side: 'left' | 'right') => {
      setSettings((previous) => ({ ...previous, phaseStepperSide: side }));
    };

    const setDefaultDifficulty = (difficulty: typeof DEFAULT_SETTINGS.defaultDifficulty) => {
      setSettings((previous) => ({ ...previous, defaultDifficulty: difficulty }));
    };

    const setDefaultHeroicLevel = (level: number) => {
      setSettings((previous) => ({ ...previous, defaultHeroicLevel: Math.max(0, level) }));
    };

    const setArtPackEnabled = (id: string, enabled: boolean) => {
      setSettings((previous) => {
        const others = previous.disabledArtPacks.filter((disabledId) => disabledId !== id);
        return { ...previous, disabledArtPacks: enabled ? others : [...others, id] };
      });
    };

    const updateSettings = (partial: Partial<typeof DEFAULT_SETTINGS>) => {
      setSettings((previous) => ({ ...previous, ...partial }));
    };

    return {
      setDevMode,
      toggleDevMode,
      setAutoResolveUnambiguous,
      toggleAutoResolveUnambiguous,
      setEdgeScrollSpeed,
      setCardZoomLevel,
      setVillainPhasePacing,
      setPhaseStepperSide,
      setDefaultDifficulty,
      setDefaultHeroicLevel,
      setArtPackEnabled,
      updateSettings,
    };
  }, []);

  const value = useMemo(
    () => ({
      settings,
      devMode: settings.devMode,
      autoResolveUnambiguous: settings.autoResolveUnambiguous !== false,
      edgeScrollSpeed: settings.edgeScrollSpeed || 'normal',
      cardZoomLevel: settings.cardZoomLevel || 'normal',
      villainPhasePacing: settings.villainPhasePacing || 'auto_normal',
      phaseStepperSide: (settings.phaseStepperSide === 'right'
        ? 'right'
        : 'left') as PhaseStepperSide,
      defaultDifficulty: settings.defaultDifficulty || 'STANDARD',
      defaultHeroicLevel: settings.defaultHeroicLevel || 0,
      disabledArtPacks: settings.disabledArtPacks,
      ...actions,
    }),
    [settings, actions],
  );

  return <GameSettingsContext.Provider value={value}>{children}</GameSettingsContext.Provider>;
};
