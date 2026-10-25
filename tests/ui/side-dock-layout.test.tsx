import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { GameBoard } from '../../src/ui/components/board/GameBoard';
import { QuickMenu } from '../../src/ui/components/board/QuickMenu';
import { SideDock } from '../../src/ui/components/board/SideDock';
import { GameSettingsProvider } from '../../src/ui/context/GameSettingsProvider';
import { ModalStyleProvider } from '../../src/ui/theme/ModalStyleContext';
import { MODAL_STYLES } from '../../src/ui/theme/modal-styles';
import { GamePhase, GameState } from '../../src/engine/models';
import { newRhinoGame } from '../support/game-fixtures';
import { TestSession } from '../support/render-with-session';

const board = (state: GameState) => (
  <GameSettingsProvider>
    <TestSession state={state}>
      <GameBoard onReset={vi.fn()} />
    </TestSession>
  </GameSettingsProvider>
);

const rail = (state: GameState, props: Partial<React.ComponentProps<typeof QuickMenu>> = {}) => (
  <GameSettingsProvider>
    <TestSession state={state}>
      <QuickMenu onReset={vi.fn()} {...props} />
    </TestSession>
  </GameSettingsProvider>
);

describe('Side dock: quick-menu rail above the combat log (Issue #378)', () => {
  beforeEach(() => {
    localStorage.clear();
    Element.prototype.scrollTo = vi.fn();
    Element.prototype.scrollBy = vi.fn();
  });

  describe('layout', () => {
    it('has no top bar: nothing sticky, no header, no Combat Log toggle', () => {
      const { container } = render(board(newRhinoGame()));
      expect(container.querySelector('.sticky')).toBeNull();
      expect(container.querySelector('header[class*="top-0"]')).toBeNull();
      expect(screen.queryByRole('button', { name: /combat log/i })).toBeNull();
    });

    it('docks one 420 px column on the right, rail first, log second', () => {
      render(board(newRhinoGame()));
      const dock = document.body.querySelector('.z-drawer') as HTMLElement;
      expect(dock).not.toBeNull();
      for (const cls of ['fixed', 'inset-y-0', 'right-0', 'w-[420px]']) {
        expect(dock.className).toContain(cls);
      }
      // The portal sets the theme's font roles itself, so the rail and the log follow the theme.
      expect(dock.className).toContain('font-body');
      expect(dock.style.getPropertyValue('--font-comic')).not.toBe('');
      // Desktop only: no responsive variants on the dock.
      expect(dock.className).not.toMatch(/(?:^|\s)(?:sm|md|lg):/);

      const toolbar = within(dock).getByRole('toolbar');
      const log = dock.querySelector('[data-newspaper]') as HTMLElement;
      expect(log).not.toBeNull();
      expect(toolbar.compareDocumentPosition(log) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('keeps the board column beside the dock at every game state', () => {
      const { container } = render(board(newRhinoGame()));
      const column = container.querySelector('main')?.parentElement;
      expect(column?.className).toContain('w-[calc(100%-420px)]');
      expect(column?.className).not.toContain('lg:');
    });

    it('shows the combat log from the first frame, with no way to close it', () => {
      render(board(newRhinoGame()));
      expect(screen.getByText(/Flash news & action chronicle/)).toBeDefined();
      expect(screen.queryByRole('button', { name: /close newspaper/i })).toBeNull();
    });

    it('App and GameBoard roots clip horizontally without becoming scroll containers (Issue #312)', () => {
      const source = readFileSync(join(__dirname, '..', '..', 'src', 'ui', 'App.tsx'), 'utf8');
      const rootLine = source.match(/^.*relative min-h-screen w-full flex.*$/m)?.[0];
      expect(rootLine).toBeDefined();
      expect(rootLine).toContain('overflow-x-clip');
      expect(rootLine).not.toContain('overflow-x-hidden');
      expect(rootLine).not.toContain('overflow-y-auto');

      const { container } = render(board(newRhinoGame()));
      const boardRoot = container.firstElementChild as HTMLElement;
      expect(boardRoot.className).toContain('overflow-x-clip');
      expect(boardRoot.className).not.toContain('overflow-x-hidden');
      expect(boardRoot.className).not.toContain('overflow-y-auto');
    });
  });

  describe('rail content', () => {
    it('shows the round and a short phase, with the full wording in the title', () => {
      const state = newRhinoGame();
      state.phase = GamePhase.PLAYER_PHASE;
      const { rerender } = render(rail(state));

      expect(screen.getByText('R1').getAttribute('title')).toBe('Round 1');
      const phase = screen.getByText('PLAYER PHASE');
      expect(phase.getAttribute('title')).toBe('Heroes assemble! (Player phase)');

      rerender(rail({ ...state, phase: GamePhase.VILLAIN_PHASE }));
      expect(screen.getByText('VILLAIN PHASE')).toBeDefined();
    });

    it('has no seat selector: the seat headers switch seats', () => {
      render(rail(newRhinoGame({ players: 2 })));
      expect(screen.queryByText(/jump to hero/i)).toBeNull();
      expect(screen.queryByRole('button', { name: /^seat \d/i })).toBeNull();
    });

    it('opens the Daily Bugle from a named icon button that carries the legal-move count', () => {
      const onOpenNewspaper = vi.fn();
      render(rail(newRhinoGame(), { legalActionCount: 5, onOpenNewspaper }));
      const bugle = screen.getByRole('button', { name: 'Daily Bugle: 5 legal moves' });
      expect(bugle.textContent).toContain('5');
      fireEvent.click(bugle);
      expect(onOpenNewspaper).toHaveBeenCalledTimes(1);
    });

    it('has no Daily Bugle button when the board gives it nothing to open', () => {
      render(rail(newRhinoGame()));
      expect(screen.queryByRole('button', { name: /daily bugle/i })).toBeNull();
    });

    it('opens the Options modal from the gear', () => {
      render(rail(newRhinoGame()));
      fireEvent.click(screen.getByRole('button', { name: 'Options' }));
      expect(screen.getByRole('dialog')).toBeDefined();
    });
  });

  describe('overflow menu', () => {
    const openMenu = () => fireEvent.click(screen.getByRole('button', { name: 'More' }));

    it('lists Report a problem, Dev mode and New game', () => {
      render(rail(newRhinoGame()));
      expect(screen.queryByRole('menu')).toBeNull();
      openMenu();
      const items = within(screen.getByRole('menu')).getAllByRole('menuitem');
      expect(items.map((i) => i.textContent)).toEqual([
        'Report a problem',
        expect.stringMatching(/^Dev mode: (ON|OFF)$/),
        'New game',
      ]);
    });

    it('closes on Escape and on an outside click', () => {
      render(rail(newRhinoGame()));
      openMenu();
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByRole('menu')).toBeNull();
      openMenu();
      fireEvent.mouseDown(document.body);
      expect(screen.queryByRole('menu')).toBeNull();
    });

    it('New game resets and closes the menu', () => {
      const onReset = vi.fn();
      render(rail(newRhinoGame(), { onReset }));
      openMenu();
      fireEvent.click(screen.getByRole('menuitem', { name: 'New game' }));
      expect(onReset).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('menu')).toBeNull();
    });

    it('Report a problem opens the report dialog', () => {
      render(rail(newRhinoGame()));
      openMenu();
      fireEvent.click(screen.getByRole('menuitem', { name: 'Report a problem' }));
      expect(screen.queryByRole('menu')).toBeNull();
      expect(screen.getByRole('dialog')).toBeDefined();
    });

    it('toggles Dev mode, and a DEV dot on the button shows it while the menu is closed', () => {
      render(rail(newRhinoGame()));
      const dot = () => screen.queryByTestId('dev-mode-dot');
      const before = dot() !== null;

      openMenu();
      const label = before ? 'Dev mode: ON' : 'Dev mode: OFF';
      fireEvent.click(screen.getByRole('menuitem', { name: label }));
      expect(dot() !== null).toBe(!before);

      openMenu();
      expect(
        screen.getByRole('menuitem', { name: before ? 'Dev mode: OFF' : 'Dev mode: ON' }),
      ).toBeDefined();
    });
  });

  describe('attention beacon on the Daily Bugle button', () => {
    const open = { legalActionCount: 3, onOpenNewspaper: vi.fn() };

    it('is quiet when no Call for Action or Villain action is waiting', () => {
      render(rail(newRhinoGame(), { ...open, extraActionCount: 0 }));
      expect(screen.queryByTestId('attention-beacon')).toBeNull();
    });

    it('rings and says so in the accessible name when extra actions wait', () => {
      render(rail(newRhinoGame(), { ...open, extraActionCount: 2 }));
      expect(screen.getByTestId('attention-beacon')).toBeDefined();
      expect(
        screen.getByRole('button', {
          name: 'Daily Bugle: 3 legal moves, 2 extra actions waiting',
        }),
      ).toBeDefined();
    });

    it('stops while the newspaper is open', () => {
      render(rail(newRhinoGame(), { ...open, extraActionCount: 2, isNewspaperOpen: true }));
      expect(screen.queryByTestId('attention-beacon')).toBeNull();
    });
  });

  describe.each(MODAL_STYLES.map((s) => [s.label, s] as const))(
    'under the %s theme',
    (_l, style) => {
      const mountDock = () =>
        render(
          <ModalStyleProvider style={style} cardAccents>
            <GameSettingsProvider>
              <TestSession state={newRhinoGame()}>
                <SideDock
                  legalActionCount={4}
                  extraActionCount={1}
                  isNewspaperOpen={false}
                  onOpenNewspaper={vi.fn()}
                  onReset={vi.fn()}
                />
              </TestSession>
            </GameSettingsProvider>
          </ModalStyleProvider>,
        );

      it('renders the rail and the log, and every control has an accessible name', () => {
        mountDock();
        const toolbar = screen.getByRole('toolbar');
        for (const button of within(toolbar).getAllByRole('button')) {
          expect(button.getAttribute('aria-label') ?? button.textContent).toBeTruthy();
        }
        expect(screen.getByText(/Flash news & action chronicle/)).toBeDefined();
        expect(screen.getByTestId('attention-beacon')).toBeDefined();
      });

      it('opens the overflow menu with its three items', () => {
        mountDock();
        fireEvent.click(screen.getByRole('button', { name: 'More' }));
        expect(within(screen.getByRole('menu')).getAllByRole('menuitem')).toHaveLength(3);
      });
    },
  );
});
