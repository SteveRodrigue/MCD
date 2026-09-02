import { createContext } from 'react';
import { DifficultyMode } from '../../engine/models';

export type EdgeScrollSpeed = 'slow' | 'normal' | 'fast';
export type CardZoomLevel = 'small' | 'normal' | 'larger';

export interface GameSettings {
  devMode: boolean;
  soundEnabled: boolean;
  animationsSpeed: 'normal' | 'fast' | 'instant';
  edgeScrollSpeed: EdgeScrollSpeed;
  cardZoomLevel: CardZoomLevel;
  defaultDifficulty: DifficultyMode;
  defaultHeroicLevel: number;
}

export interface GameSettingsContextType {
  settings: GameSettings;
  devMode: boolean;
  edgeScrollSpeed: EdgeScrollSpeed;
  cardZoomLevel: CardZoomLevel;
  defaultDifficulty: DifficultyMode;
  defaultHeroicLevel: number;
  setDevMode: (enabled: boolean) => void;
  toggleDevMode: () => void;
  setEdgeScrollSpeed: (speed: EdgeScrollSpeed) => void;
  setCardZoomLevel: (level: CardZoomLevel) => void;
  setDefaultDifficulty: (difficulty: DifficultyMode) => void;
  setDefaultHeroicLevel: (level: number) => void;
  updateSettings: (partial: Partial<GameSettings>) => void;
}

export const DEFAULT_SETTINGS: GameSettings = {
  devMode: true,
  soundEnabled: true,
  animationsSpeed: 'normal',
  edgeScrollSpeed: 'normal',
  cardZoomLevel: 'normal',
  defaultDifficulty: 'STANDARD',
  defaultHeroicLevel: 0,
};

export const STORAGE_KEY = 'mcd_game_settings';

export const GameSettingsContext = createContext<GameSettingsContextType | undefined>(undefined);
