import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CombatLogDrawer } from '../../src/ui/components/board/CombatLogDrawer';
import { GameBoard } from '../../src/ui/components/board/GameBoard';
import { GameSettingsProvider } from '../../src/ui/context/GameSettingsProvider';
import { GameLogEntry, GamePhase, GameState } from '../../src/engine/models';
import { setupGame } from '../../src/engine/state/game-setup';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { TestSession } from '../support/render-with-session';

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
      <TestSession state={mockGameState as GameState}>
        <CombatLogDrawer isOpen={true} onClose={onClose} logs={mockLogs} />
      </TestSession>,
    );

    expect(screen.getByText('DAILY BUGLE')).toBeDefined();
    expect(screen.getByText(/FLASH NEWS & ACTION CHRONICLE/)).toBeDefined();
    expect(screen.getByText('Iron-Man dealt 2 damage to Rhino.')).toBeDefined();
  });

  it('applies docked desktop classes to drawer container', () => {
    const onClose = vi.fn();
    render(
      <TestSession state={mockGameState as GameState}>
        <CombatLogDrawer isOpen={true} onClose={onClose} logs={mockLogs} />
      </TestSession>,
    );

    // The drawer renders through ModalLayer (portal under document.body).
    const drawer = document.body.querySelector('.z-drawer') as HTMLElement;
    expect(drawer).not.toBeNull();
    expect(drawer.className).toContain('fixed');
    expect(drawer.className).toContain('z-drawer');
    expect(drawer.className).toContain('lg:w-[420px]');
  });

  it('filters log items when category buttons are clicked', () => {
    const onClose = vi.fn();
    render(
      <TestSession state={mockGameState as GameState}>
        <CombatLogDrawer isOpen={true} onClose={onClose} logs={mockLogs} />
      </TestSession>,
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
      <TestSession state={mockGameState as GameState}>
        <CombatLogDrawer isOpen={true} onClose={onClose} logs={mockLogs} currentLocale="en" />
      </TestSession>,
    );

    expect(screen.getByText('Iron-Man dealt 2 damage to Rhino.')).toBeDefined();

    const localeBtn = screen.getByTitle(/Toggle Language/i);
    fireEvent.click(localeBtn);

    // After switching to French, should show French translated text
    expect(screen.getByText('Iron-Man a infligé 2 dégâts à Rhino.')).toBeDefined();
  });

  it('renders source card badge when log entry has source attribution (Issue #204)', () => {
    const logWithSource: GameLogEntry[] = [
      {
        id: 'log-pb-1',
        timestamp: 1000,
        round: 1,
        phase: GamePhase.PLAYER_PHASE,
        key: 'card.effect.drawCards',
        actor: { name: 'Captain Marvel', type: 'hero' },
        params: {
          who: 'Captain Marvel',
          count: 1,
          cards: 'Energy Absorption',
          source: 'Photonic Blast',
        },
      },
    ];

    render(
      <TestSession state={mockGameState as GameState}>
        <CombatLogDrawer isOpen={true} onClose={vi.fn()} logs={logWithSource} />
      </TestSession>,
    );

    expect(screen.getByText(/🃏 Photonic Blast/)).toBeDefined();
    expect(
      screen.getByText(/Captain Marvel drew 1 card\(s\) \(Photonic Blast\): Energy Absorption\./),
    ).toBeDefined();
  });

  it('GameBoard initializes with Combat Log drawer open by default (Issue #204)', () => {
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Carol Danvers',
          hero: cardCatalog.getCard('01010b') as any,
          alterEgo: cardCatalog.getCard('01010a') as any,
          deckCards: Array(15).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    render(
      <GameSettingsProvider>
        <TestSession state={state} dispatch={vi.fn()}>
          <GameBoard onReset={vi.fn()} />
        </TestSession>
      </GameSettingsProvider>,
    );

    expect(screen.getByText(/FLASH NEWS & ACTION CHRONICLE/)).toBeDefined();
  });
});
