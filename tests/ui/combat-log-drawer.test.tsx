import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CombatLogDrawer } from '../../src/ui/components/board/CombatLogDrawer';
import { TopBar } from '../../src/ui/components/board/TopBar';
import { GameSettingsProvider } from '../../src/ui/context/GameSettingsProvider';
import { GameLogEntry, GamePhase, GameState } from '../../src/engine/models';

describe('CombatLogDrawer Component (Issue #142)', () => {
  const mockLogs: GameLogEntry[] = [
    {
      id: 'log-1',
      timestamp: 1000,
      round: 1,
      phase: GamePhase.PLAYER_PHASE,
      key: 'DEAL_DAMAGE',
      actor: { name: 'Iron-Man', type: 'hero' },
      params: {
        who_attacks: 'Iron-Man',
        who_is_taking_damage: 'Rhino',
        amount: 2,
      },
    },
    {
      id: 'log-2',
      timestamp: 2000,
      round: 1,
      phase: GamePhase.VILLAIN_PHASE,
      key: 'VILLAIN_ATTACK',
      actor: { name: 'Rhino', type: 'villain' },
      params: {
        villain: 'Rhino',
        target: 'Spider-Man',
        totalDamage: 3,
      },
    },
    {
      id: 'log-3',
      timestamp: 3000,
      phase: GamePhase.PLAYER_PHASE,
      key: 'ROUND_STARTED',
      round: 2,
    },
  ];

  const mockGameState: Partial<GameState> = {
    players: [
      {
        id: 'p1',
        name: 'Iron-Man',
        currentForm: 'hero',
        hero: {
          code: '01029a',
          name: 'Iron-Man',
          meta: {
            colors: ['#c2410c', '#f59e0b', '#dc2626', '#ffffff'],
          },
        } as any,
      } as any,
    ],
    villain: {
      card: {
        name: 'Rhino',
        code: '01094',
      } as any,
    } as any,
    mainScheme: {
      card: {
        name: 'The Break-In!',
        code: '01097',
      } as any,
    } as any,
  };

  it('renders Daily Bugle masthead and action chronicle headline', () => {
    const onClose = vi.fn();
    render(
      <CombatLogDrawer
        isOpen={true}
        onClose={onClose}
        logs={mockLogs}
        gameState={mockGameState as GameState}
      />,
    );

    expect(screen.getByText('DAILY BUGLE')).toBeDefined();
    expect(screen.getByText(/FLASH NEWS & ACTION CHRONICLE/)).toBeDefined();
    expect(screen.getByText('Iron-Man dealt 2 damage to Rhino.')).toBeDefined();
  });

  it('applies docked desktop classes to drawer container', () => {
    const onClose = vi.fn();
    const { container } = render(
      <CombatLogDrawer
        isOpen={true}
        onClose={onClose}
        logs={mockLogs}
        gameState={mockGameState as GameState}
      />,
    );

    const drawer = container.firstChild as HTMLElement;
    expect(drawer.className).toContain('fixed');
    expect(drawer.className).toContain('lg:fixed');
    expect(drawer.className).toContain('lg:w-[420px]');
  });

  it('filters log items when category buttons are clicked', () => {
    const onClose = vi.fn();
    render(
      <CombatLogDrawer
        isOpen={true}
        onClose={onClose}
        logs={mockLogs}
        gameState={mockGameState as GameState}
      />,
    );

    // Initial state: ALL logs displayed
    expect(screen.getByText('Iron-Man dealt 2 damage to Rhino.')).toBeDefined();

    // Click VILLAINS filter button
    const villainsBtn = screen.getByRole('button', { name: /VILLAINS/i });
    fireEvent.click(villainsBtn);

    // Iron-Man attack should now be filtered out
    expect(screen.queryByText('Iron-Man dealt 2 damage to Rhino.')).toBeNull();
    // Rhino attack should still be present
    expect(screen.getByText(/Rhino attacks Spider-Man/i)).toBeDefined();

    // Click HEROES filter button
    const heroesBtn = screen.getByRole('button', { name: /HEROES/i });
    fireEvent.click(heroesBtn);
    expect(screen.getByText('Iron-Man dealt 2 damage to Rhino.')).toBeDefined();
    expect(screen.queryByText(/Rhino attacks Spider-Man/i)).toBeNull();
  });

  it('switches between English and French locales via language toggle', () => {
    const onClose = vi.fn();
    render(
      <CombatLogDrawer
        isOpen={true}
        onClose={onClose}
        logs={mockLogs}
        currentLocale="en"
        gameState={mockGameState as GameState}
      />,
    );

    expect(screen.getByText('Iron-Man dealt 2 damage to Rhino.')).toBeDefined();

    const localeBtn = screen.getByTitle(/Toggle Language/i);
    fireEvent.click(localeBtn);

    // After switching to French, should show French translated text
    expect(screen.getByText('Iron-Man a infligé 2 dégâts à Rhino.')).toBeDefined();
  });

  it('shifts TopBar right edge to accommodate docked combat log on desktop', () => {
    const { container, rerender } = render(
      <GameSettingsProvider>
        <TopBar
          gameState={mockGameState as GameState}
          activeSeatIndex={0}
          onSelectSeat={vi.fn()}
          onToggleLog={vi.fn()}
          isLogOpen={false}
          onReset={vi.fn()}
        />
      </GameSettingsProvider>,
    );

    const headerClosed = container.querySelector('header');
    expect(headerClosed?.className).toContain('right-0');
    expect(headerClosed?.className).not.toContain('lg:right-[420px]');

    rerender(
      <GameSettingsProvider>
        <TopBar
          gameState={mockGameState as GameState}
          activeSeatIndex={0}
          onSelectSeat={vi.fn()}
          onToggleLog={vi.fn()}
          isLogOpen={true}
          onReset={vi.fn()}
        />
      </GameSettingsProvider>,
    );

    const headerOpen = container.querySelector('header');
    expect(headerOpen?.className).toContain('lg:right-[420px]');
  });
});
