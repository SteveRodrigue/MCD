import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { GameSettingsProvider } from '../../src/ui/context/GameSettingsProvider';
import { STORAGE_KEY } from '../../src/ui/context/game-settings-context';
import { ScenarioSelector } from '../../src/ui/components/setup/ScenarioSelector';
import { OptionsMenu } from '../../src/ui/components/board/OptionsMenu';
import { GAME_THEME_STORAGE_KEY, ThemeProvider } from '../../src/ui/theme/ThemeProvider';
import { ThemePicker } from '../../src/ui/theme/ThemePicker';
import { MODAL_STYLES } from '../../src/ui/theme/modal-styles';
import { useGameTheme } from '../../src/ui/theme/useGameTheme';
import { TestSession } from '../support/render-with-session';
import { newRhinoGame } from '../support/game-fixtures';

const saved = () => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');

const renderWithSettings = (ui: React.ReactElement, stored?: Record<string, unknown>) => {
  if (stored) localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  return render(
    <GameSettingsProvider>
      <ThemeProvider>{ui}</ThemeProvider>
    </GameSettingsProvider>,
  );
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

describe('ThemePicker', () => {
  it('offers every theme plus Random, with Pop-Art selected by default', () => {
    renderWithSettings(<ThemePicker />);
    const group = within(screen.getByRole('radiogroup', { name: 'Theme' }));
    expect(group.getAllByRole('radio')).toHaveLength(MODAL_STYLES.length + 1);
    expect(screen.getByTestId('theme-card-pop-art').getAttribute('aria-checked')).toBe('true');
    expect(screen.getByTestId('theme-random').getAttribute('aria-checked')).toBe('false');
  });

  it('selects a fixed theme and saves it with the other settings', () => {
    renderWithSettings(<ThemePicker />);
    fireEvent.click(screen.getByTestId('theme-card-night'));
    expect(screen.getByTestId('theme-card-night').getAttribute('aria-checked')).toBe('true');
    expect(screen.getByTestId('theme-card-pop-art').getAttribute('aria-checked')).toBe('false');
    expect(saved()).toMatchObject({ themeMode: 'fixed', themeId: 'night' });
  });

  it('switches to Random and lets the player choose the pool, keeping at least one theme', () => {
    renderWithSettings(<ThemePicker />);
    expect(screen.queryByText('Include in random')).toBeNull();

    fireEvent.click(screen.getByTestId('theme-random'));
    expect(screen.getByTestId('theme-random').getAttribute('aria-checked')).toBe('true');
    expect(saved().themeMode).toBe('random');
    expect(screen.getAllByRole('checkbox', { checked: true }).length).toBeGreaterThan(
      MODAL_STYLES.length - 1,
    );

    for (const style of MODAL_STYLES.slice(1)) {
      fireEvent.click(screen.getByRole('checkbox', { name: style.label }));
    }
    expect(saved().randomThemePool).toEqual([MODAL_STYLES[0].id]);
    expect(
      (screen.getByRole('checkbox', { name: MODAL_STYLES[0].label }) as HTMLInputElement).disabled,
    ).toBe(true);

    fireEvent.click(screen.getByRole('checkbox', { name: MODAL_STYLES[2].label }));
    expect(saved().randomThemePool).toEqual([MODAL_STYLES[0].id, MODAL_STYLES[2].id]);
  });

  it('toggles card accents', () => {
    renderWithSettings(<ThemePicker />);
    const toggle = screen.getByRole('switch', { name: 'Card accents' }) as HTMLInputElement;
    expect(toggle.checked).toBe(true);
    fireEvent.click(toggle);
    expect(saved().cardAccents).toBe(false);
  });

  it('shows the game theme and a Re-roll button in Random mode during a game', () => {
    const onReroll = vi.fn();
    renderWithSettings(<ThemePicker game={{ activeThemeId: 'splash', onReroll }} />, {
      themeMode: 'random',
    });
    expect(screen.getByTestId('theme-this-game').textContent).toContain('Splash Page');
    fireEvent.click(screen.getByRole('button', { name: /Re-roll/ }));
    expect(onReroll).toHaveBeenCalledTimes(1);
  });

  it('sets dark text on its own light cards and boxes, so a dark page cannot wash them out (#442)', () => {
    renderWithSettings(<ThemePicker />, { themeMode: 'random' });
    const surfaces = [
      ...MODAL_STYLES.map((style) => screen.getByTestId(`theme-card-${style.id}`)),
      screen.getByTestId('theme-random'),
      screen.getByText('Include in random').closest('div'),
      screen.getByText('Card accents').closest('label'),
    ];
    for (const surface of surfaces) {
      expect(surface?.className).toContain('text-comic-black');
    }
  });

  it('offers no Re-roll for a fixed theme or before a game', () => {
    renderWithSettings(<ThemePicker game={{ activeThemeId: 'splash', onReroll: vi.fn() }} />);
    expect(screen.queryByRole('button', { name: /Re-roll/ })).toBeNull();
  });
});

describe('Options menu theme section', () => {
  const Probe: React.FC = () => <span data-testid="active">{useGameTheme().activeThemeId}</span>;

  it('re-rolls the theme of the running game', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    renderWithSettings(
      <TestSession state={newRhinoGame()}>
        <Probe />
        <OptionsMenu isOpen onClose={vi.fn()} />
      </TestSession>,
      { themeMode: 'random', randomThemePool: ['splash', 'hud'] },
    );

    fireEvent.click(screen.getByRole('button', { name: /Re-roll/ }));
    expect(screen.getByTestId('active').textContent).toBe('splash');
    expect(screen.getByTestId('theme-this-game').textContent).toContain('Splash Page');

    fireEvent.click(screen.getByRole('button', { name: /Re-roll/ }));
    expect(screen.getByTestId('active').textContent).toBe('hud');
    expect(sessionStorage.getItem(GAME_THEME_STORAGE_KEY)).toBe('hud');
  });

  it('shows no theme section while closed', () => {
    renderWithSettings(
      <TestSession state={newRhinoGame()}>
        <OptionsMenu isOpen={false} onClose={vi.fn()} />
      </TestSession>,
    );
    expect(screen.queryByRole('radiogroup', { name: 'Theme' })).toBeNull();
  });
});

describe('Setup screen theme section', () => {
  it('summarises the chosen theme and shows the picker with it selected', () => {
    renderWithSettings(<ScenarioSelector onStartSetup={vi.fn()} onOpenContent={vi.fn()} />, {
      themeId: 'dossier',
    });
    expect(screen.getByText(/Theme:/).textContent).toContain('S.H.I.E.L.D. Dossier');
    expect(screen.getByTestId('theme-card-dossier').getAttribute('aria-checked')).toBe('true');
  });

  it('is open on the first screen: every theme and Random can be chosen without opening anything', () => {
    renderWithSettings(<ScenarioSelector onStartSetup={vi.fn()} onOpenContent={vi.fn()} />);
    const section = screen.getByRole('region', { name: /Theme:/ });
    for (const style of MODAL_STYLES) {
      const tile = within(section).getByTestId(`theme-card-${style.id}`);
      expect(tile.closest('details'), `${style.id} is hidden in a closed panel`).toBeNull();
    }
    expect(within(section).getByTestId('theme-random').closest('details')).toBeNull();
    expect(within(section).getAllByRole('radio')).toHaveLength(MODAL_STYLES.length + 1);
  });

  it('saves the theme chosen on the first screen, and starting the mission keeps it', () => {
    const onStartSetup = vi.fn();
    renderWithSettings(<ScenarioSelector onStartSetup={onStartSetup} onOpenContent={vi.fn()} />);
    fireEvent.click(screen.getByTestId('theme-card-night'));
    expect(saved().themeId).toBe('night');
    expect(saved().themeMode).toBe('fixed');
    fireEvent.click(screen.getByText('START MISSION'));
    expect(onStartSetup).toHaveBeenCalledTimes(1);
    expect(saved().themeId).toBe('night');
  });

  it('shows Random in the summary after choosing it', () => {
    renderWithSettings(<ScenarioSelector onStartSetup={vi.fn()} onOpenContent={vi.fn()} />);
    fireEvent.click(screen.getByTestId('theme-random'));
    expect(screen.getByText(/Theme:/).textContent).toContain('Random each game');
    expect(screen.queryByRole('button', { name: /Re-roll/ })).toBeNull();
  });
});
