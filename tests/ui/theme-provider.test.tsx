import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { GameSettingsProvider } from '../../src/ui/context/GameSettingsProvider';
import { useGameSettings } from '../../src/ui/context/useGameSettings';
import { STORAGE_KEY } from '../../src/ui/context/game-settings-context';
import { GAME_THEME_STORAGE_KEY, ThemeProvider } from '../../src/ui/theme/ThemeProvider';
import { useGameTheme } from '../../src/ui/theme/useGameTheme';
import { useModalStyle } from '../../src/ui/theme/useModalStyle';
import { ModalScaffold } from '../../src/ui/theme/ModalScaffold';
import { ModalStyleProvider } from '../../src/ui/theme/ModalStyleContext';
import { DEFAULT_MODAL_STYLE } from '../../src/ui/theme/modal-styles';

const Probe: React.FC = () => {
  const { style, cardAccents } = useModalStyle();
  const { activeThemeId, gameThemeId, rollGameTheme } = useGameTheme();
  const { updateSettings } = useGameSettings();
  return (
    <div>
      <span data-testid="style">{style.id}</span>
      <span data-testid="active">{activeThemeId}</span>
      <span data-testid="game">{gameThemeId ?? 'none'}</span>
      <span data-testid="accents">{String(cardAccents)}</span>
      <button onClick={() => rollGameTheme()}>roll</button>
      <button onClick={() => updateSettings({ themeMode: 'random', themeId: 'night' })}>
        random
      </button>
      <button onClick={() => updateSettings({ themeMode: 'fixed', themeId: 'hud' })}>hud</button>
      <button onClick={() => updateSettings({ cardAccents: false })}>accents off</button>
    </div>
  );
};

const mount = (saved?: Record<string, unknown>) => {
  if (saved) localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  return render(
    <GameSettingsProvider>
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    </GameSettingsProvider>,
  );
};
const text = (id: string) => screen.getByTestId(id).textContent;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

describe('ThemeProvider', () => {
  it('defaults to the Pop-Art theme with accents on', () => {
    mount();
    expect(text('style')).toBe('pop-art');
    expect(text('accents')).toBe('true');
  });

  it('applies the fixed theme from saved settings', () => {
    mount({ themeId: 'dossier' });
    expect(text('style')).toBe('dossier');
  });

  it('falls back to the default for an unknown saved theme id', () => {
    mount({ themeMode: 'random', themeId: 'gone', randomThemePool: ['gone'] });
    expect(text('style')).toBe('pop-art');
  });

  it('follows a settings change immediately in fixed mode', () => {
    mount();
    fireEvent.click(screen.getByText('hud'));
    expect(text('style')).toBe('hud');
    fireEvent.click(screen.getByText('accents off'));
    expect(text('accents')).toBe('false');
  });

  it('keeps the fixed choice until a game rolls in Random mode, then uses the roll', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    mount({ themeMode: 'random', themeId: 'night', randomThemePool: ['splash', 'hud'] });
    expect(text('active')).toBe('night');

    fireEvent.click(screen.getByText('roll'));
    expect(text('game')).toBe('splash');
    expect(text('style')).toBe('splash');
    expect(sessionStorage.getItem(GAME_THEME_STORAGE_KEY)).toBe('splash');
  });

  it('keeps the roll across re-renders and rolls a different theme for the next game', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    mount({ themeMode: 'random', randomThemePool: ['splash', 'hud'] });
    fireEvent.click(screen.getByText('roll'));
    expect(text('style')).toBe('splash');

    fireEvent.click(screen.getByText('accents off'));
    expect(text('style')).toBe('splash');

    fireEvent.click(screen.getByText('roll'));
    expect(text('style')).toBe('hud');
  });

  it('keeps the roll after a reload mid-game', () => {
    sessionStorage.setItem(GAME_THEME_STORAGE_KEY, 'dossier');
    mount({ themeMode: 'random' });
    expect(text('game')).toBe('dossier');
    expect(text('style')).toBe('dossier');
  });

  it('ignores an invalid stored roll', () => {
    sessionStorage.setItem(GAME_THEME_STORAGE_KEY, 'nope');
    mount({ themeMode: 'random', themeId: 'night' });
    expect(text('game')).toBe('none');
  });

  it('in fixed mode a roll resolves to the fixed theme', () => {
    mount({ themeId: 'newsprint' });
    fireEvent.click(screen.getByText('roll'));
    expect(text('style')).toBe('newsprint');
  });

  it('switching to Random before any game keeps the fixed theme', () => {
    mount({ themeId: 'pop-art' });
    fireEvent.click(screen.getByText('random'));
    expect(text('style')).toBe('night');
  });

  it('survives unavailable session storage', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    mount({ themeMode: 'random', randomThemePool: ['hud', 'night'] });
    expect(() => fireEvent.click(screen.getByText('roll'))).not.toThrow();
  });
});

describe('ModalScaffold dismissal and layering', () => {
  const renderScaffold = (props: Partial<React.ComponentProps<typeof ModalScaffold>> = {}) =>
    render(
      <ModalStyleProvider style={DEFAULT_MODAL_STYLE}>
        <ModalScaffold title="TITLE" trigger={null} testId="scaffold" {...props}>
          <button>inside</button>
        </ModalScaffold>
      </ModalStyleProvider>,
    );

  it('shows no close button for a forced prompt', () => {
    renderScaffold();
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
  });

  it('closes from the close button and the Escape key when dismissible', () => {
    const onClose = vi.fn();
    renderScaffold({ onClose });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('ignores Escape when not dismissible', () => {
    const onClose = vi.fn();
    renderScaffold();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on backdrop click only when asked to, never on a click inside', () => {
    const onClose = vi.fn();
    const first = renderScaffold({ onClose });
    fireEvent.click(screen.getByTestId('scaffold'));
    expect(onClose).not.toHaveBeenCalled();
    first.unmount();

    renderScaffold({ onClose, closeOnBackdrop: true });
    fireEvent.click(screen.getByText('inside'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('scaffold'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('uses the critical layer for forced prompts', () => {
    renderScaffold({ layer: 'critical' });
    expect(screen.getByTestId('scaffold').className).toContain('z-critical');
  });

  it('moves focus into the dialog on open and back on close', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();

    const { unmount } = renderScaffold();
    expect(screen.getByTestId('scaffold').contains(document.activeElement)).toBe(true);

    unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it('keeps focus on an element that already has it inside', () => {
    render(
      <ModalStyleProvider style={DEFAULT_MODAL_STYLE}>
        <ModalScaffold title="T" trigger={null}>
          <input autoFocus aria-label="name" />
        </ModalScaffold>
      </ModalStyleProvider>,
    );
    expect(document.activeElement).toBe(screen.getByLabelText('name'));
  });
});

describe('GameSettingsProvider theme persistence', () => {
  it('writes theme settings to the shared settings key', () => {
    mount();
    act(() => {
      fireEvent.click(screen.getByText('hud'));
    });
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(stored).toMatchObject({ themeMode: 'fixed', themeId: 'hud', cardAccents: true });
  });
});
