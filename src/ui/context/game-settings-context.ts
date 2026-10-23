import { createContext } from 'react';
import { DifficultyMode } from '../../engine/models';
import { DEFAULT_THEME_SETTINGS, type ThemeSettings } from '../theme/theme-settings';

export type EdgeScrollSpeed = 'slow' | 'normal' | 'fast';
export type CardZoomLevel = 'small' | 'normal' | 'larger';
export type VillainPhasePacing = 'auto_normal' | 'auto_fast' | 'manual' | 'instant';

export interface GameSettings extends ThemeSettings {
  devMode: boolean;
  autoResolveUnambiguous: boolean;
  soundEnabled: boolean;
  animationsSpeed: 'normal' | 'fast' | 'instant';
  edgeScrollSpeed: EdgeScrollSpeed;
  cardZoomLevel: CardZoomLevel;
  villainPhasePacing: VillainPhasePacing;
  defaultDifficulty: DifficultyMode;
  defaultHeroicLevel: number;
}

export interface GameSettingsContextType {
  settings: GameSettings;
  devMode: boolean;
  autoResolveUnambiguous: boolean;
  edgeScrollSpeed: EdgeScrollSpeed;
  cardZoomLevel: CardZoomLevel;
  villainPhasePacing: VillainPhasePacing;
  defaultDifficulty: DifficultyMode;
  defaultHeroicLevel: number;
  setDevMode: (enabled: boolean) => void;
  toggleDevMode: () => void;
  setAutoResolveUnambiguous: (enabled: boolean) => void;
  toggleAutoResolveUnambiguous: () => void;
  setEdgeScrollSpeed: (speed: EdgeScrollSpeed) => void;
  setCardZoomLevel: (level: CardZoomLevel) => void;
  setVillainPhasePacing: (pacing: VillainPhasePacing) => void;
  setDefaultDifficulty: (difficulty: DifficultyMode) => void;
  setDefaultHeroicLevel: (level: number) => void;
  updateSettings: (partial: Partial<GameSettings>) => void;
}

export const DEFAULT_SETTINGS: GameSettings = {
  devMode: true,
  autoResolveUnambiguous: true,
  soundEnabled: true,
  animationsSpeed: 'normal',
  edgeScrollSpeed: 'normal',
  cardZoomLevel: 'normal',
  villainPhasePacing: 'auto_normal',
  defaultDifficulty: 'STANDARD',
  defaultHeroicLevel: 0,
  ...DEFAULT_THEME_SETTINGS,
};

export const STORAGE_KEY = 'mcd_game_settings';

export const GameSettingsContext = createContext<GameSettingsContextType | undefined>(undefined);
