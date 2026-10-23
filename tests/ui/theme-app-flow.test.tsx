import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { App } from '../../src/ui/App';
import { STORAGE_KEY } from '../../src/ui/context/game-settings-context';
import { GAME_THEME_STORAGE_KEY } from '../../src/ui/theme/ThemeProvider';

const startMission = async () =>
  fireEvent.click(await screen.findByRole('button', { name: /START MISSION/i }, { timeout: 5000 }));

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState({}, '', '/');
});
afterEach(() => vi.restoreAllMocks());

describe('theme engine in the app flow', () => {
  it('rolls the theme once when a game starts in Random mode', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ themeMode: 'random', randomThemePool: ['splash', 'hud'] }),
    );
    render(<App />);
    expect(sessionStorage.getItem(GAME_THEME_STORAGE_KEY)).toBeNull();

    await startMission();

    expect(sessionStorage.getItem(GAME_THEME_STORAGE_KEY)).toBe('splash');
  });

  it('keeps the fixed theme when a game starts in Fixed mode', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ themeMode: 'fixed', themeId: 'night' }));
    render(<App />);

    await startMission();

    expect(sessionStorage.getItem(GAME_THEME_STORAGE_KEY)).toBe('night');
  });
});
