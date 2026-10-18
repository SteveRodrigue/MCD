import { useContext } from 'react';
import { GameSettingsContext, GameSettingsContextType } from './game-settings-context';

/** The game settings, or undefined when rendered outside a GameSettingsProvider (isolated tests). */
export function useOptionalGameSettings(): GameSettingsContextType | undefined {
  return useContext(GameSettingsContext);
}

export function useGameSettings(): GameSettingsContextType {
  const context = useOptionalGameSettings();
  if (!context) {
    throw new Error('useGameSettings must be used within a GameSettingsProvider');
  }
  return context;
}
