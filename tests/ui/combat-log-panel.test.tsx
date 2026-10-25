import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CombatLogPanel } from '../../src/ui/components/board/CombatLogPanel';
import { GameLogEntry, GamePhase, GameState } from '../../src/engine/models';
import { TestSession } from '../support/render-with-session';

describe('CombatLogPanel Component (Issue #142)', () => {
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
    villains: [
      {
        card: {
          name: 'Rhino',
          code: '01094',
        } as any,
      } as any,
    ],
    mainSchemes: [
      {
        card: {
          name: 'The Break-In!',
          code: '01097',
        } as any,
      } as any,
    ],
  };

  it('renders Daily Bugle masthead and action chronicle headline', () => {
    render(
      <TestSession state={mockGameState as GameState}>
        <CombatLogPanel logs={mockLogs} />
      </TestSession>,
    );

    expect(screen.getByRole('heading', { name: /DAILY BUGLE/ })).toBeDefined();
    expect(screen.getByText(/Flash news & action chronicle/)).toBeDefined();
    expect(screen.getByText('Iron-Man dealt 2 damage to Rhino.')).toBeDefined();
  });

  it('has no font selector: the log is a newspaper page that follows the theme (Newspaper fonts)', () => {
    render(
      <TestSession state={mockGameState as GameState}>
        <CombatLogPanel logs={mockLogs} />
      </TestSession>,
    );
    expect(screen.queryByRole('button', { name: /font/i })).toBeNull();
    expect(screen.queryByText(/^Font:/)).toBeNull();
    const dialogue = screen.getByText('Iron-Man dealt 2 damage to Rhino.');
    expect(dialogue.className).toContain('font-news-body');
    expect(document.body.querySelector('[data-newspaper]')).not.toBeNull();
  });

  it('filters log items when category buttons are clicked', () => {
    render(
      <TestSession state={mockGameState as GameState}>
        <CombatLogPanel logs={mockLogs} />
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
    render(
      <TestSession state={mockGameState as GameState}>
        <CombatLogPanel logs={mockLogs} currentLocale="en" />
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
        <CombatLogPanel logs={logWithSource} />
      </TestSession>,
    );

    expect(screen.getByText(/🃏 Photonic Blast/)).toBeDefined();
    expect(
      screen.getByText(/Captain Marvel drew 1 card\(s\) \(Photonic Blast\): Energy Absorption\./),
    ).toBeDefined();
  });

  describe('threat removal entries (Issue #343)', () => {
    const removal = (id: string, amount: number): GameLogEntry => ({
      id,
      timestamp: 1000,
      round: 1,
      phase: GamePhase.PLAYER_PHASE,
      key: 'card.effect.removeThreat',
      actor: { name: 'Iron-Man', type: 'hero' },
      params: {
        actor: 'Iron-Man',
        source: 'Mark V Helmet',
        target: 'The Break-In!',
        amount,
        remainingThreat: 4,
      },
    });

    const renderLogs = (logs: GameLogEntry[], devMode: boolean) =>
      render(
        <TestSession state={mockGameState as GameState}>
          <CombatLogPanel logs={logs} devMode={devMode} />
        </TestSession>,
      );

    it('words a Crisis or Patrol block and a side scheme defeat as sentences, not raw keys', () => {
      const blocked = (id: string, key: GameLogEntry['key']): GameLogEntry => ({
        ...removal(id, 0),
        key,
        params: { actor: 'Iron-Man', source: 'Mark V Helmet', target: 'The Break-In!' },
      });
      renderLogs(
        [
          blocked('log-crisis', 'card.effect.threatBlockedByCrisis'),
          blocked('log-patrol', 'card.effect.threatBlockedByPatrol'),
          blocked('log-defeated', 'side_scheme.defeated'),
        ],
        false,
      );

      expect(
        screen.getByText(
          /Mark V Helmet cannot remove threat from The Break-In! while a Crisis icon/,
        ),
      ).toBeDefined();
      expect(
        screen.getByText(
          /Mark V Helmet cannot remove threat from The Break-In! while an engaged minion has Patrol/,
        ),
      ).toBeDefined();
      expect(screen.getByText(/The Break-In! has been completely thwarted/)).toBeDefined();
    });

    it('lists a real removal in both modes, with the source card badge', () => {
      const logs = [removal('log-r1', 2)];

      const player = renderLogs(logs, false);
      expect(screen.getByText(/Iron-Man removed 2 threat from The Break-In!/)).toBeDefined();
      expect(screen.getByText(/Mark V Helmet/)).toBeDefined();
      player.unmount();

      renderLogs(logs, true);
      expect(screen.getByText(/Iron-Man removed 2 threat from The Break-In!/)).toBeDefined();
    });
  });
});
