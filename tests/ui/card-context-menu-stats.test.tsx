import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CardContextMenu } from '../../src/ui/components/cards/CardContextMenu';
import { GameSettingsProvider } from '../../src/ui/context/GameSettingsProvider';
import { TestSession } from '../support/render-with-session';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard, setupGame } from '../../src/engine';
import { STORAGE_KEY } from '../../src/ui/context/game-settings-context';
import * as statsStorageService from '../../src/ui/services/stats-storage-service';

describe('CardContextMenu Stats Recap & Modals (#315)', () => {
  let mockGameState: GameState;
  const spiderManCard = cardCatalog.getCard('01001a')!;

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();

    mockGameState = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: cardCatalog.getCard('01001a') as HeroCard,
          alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    if (mockGameState.stats) {
      mockGameState.stats.cards['01001a'] = {
        played: 3,
        abilitiesUsed: { '01001a_ability': 2 },
        basicActions: { attack: 4, thwart: 1 },
      };
    }
  });

  it('renders quick stats recap with Plays, Abilities, and Actions', async () => {
    vi.spyOn(statsStorageService, 'getAllTimeStats').mockResolvedValue({
      gamesPlayed: 5,
      cards: {
        '01001a': {
          played: 12,
          abilitiesUsed: { '01001a_ability': 8 },
          basicActions: { attack: 15, thwart: 3 },
        },
      },
      basicActions: {
        heroAttack: 15,
        heroThwart: 3,
        heroDefense: 0,
        alterEgoRecover: 0,
        changeForm: 0,
        allyAttack: 0,
        allyThwart: 0,
        villainAttack: 0,
        villainScheme: 0,
        minionAttack: 0,
        minionScheme: 0,
      },
    });

    render(
      <GameSettingsProvider>
        <TestSession state={mockGameState}>
          <CardContextMenu card={spiderManCard} position={{ x: 100, y: 100 }} onClose={vi.fn()} />
        </TestSession>
      </GameSettingsProvider>,
    );

    expect(screen.getByText(/Plays:/i)).toBeDefined();
    expect(screen.getByText(/Abilities:/i)).toBeDefined();

    // Verify all-time counts populated from service
    await waitFor(() => {
      expect(screen.getByText('12')).toBeDefined();
      expect(screen.getByText('8')).toBeDefined();
    });
  });

  it('in Dev Mode (devMode=true), "Reset Card Stats" button is present and opens confirmation modal', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ devMode: true }));

    render(
      <GameSettingsProvider>
        <TestSession state={mockGameState}>
          <CardContextMenu card={spiderManCard} position={{ x: 100, y: 100 }} onClose={vi.fn()} />
        </TestSession>
      </GameSettingsProvider>,
    );

    const resetBtn = screen.getByRole('button', { name: /Reset Card Stats/i });
    expect(resetBtn).toBeDefined();

    fireEvent.click(resetBtn);

    // Confirm modal opens
    expect(screen.getByText(/RESET STATS: Spider-Man/i)).toBeDefined();
    expect(screen.getByText(/This action cannot be undone/i)).toBeDefined();
  });

  it('in Non-Dev Mode (devMode=false), "Reset Card Stats" button is strictly absent', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ devMode: false }));

    render(
      <GameSettingsProvider>
        <TestSession state={mockGameState}>
          <CardContextMenu card={spiderManCard} position={{ x: 100, y: 100 }} onClose={vi.fn()} />
        </TestSession>
      </GameSettingsProvider>,
    );

    const resetBtn = screen.queryByRole('button', { name: /Reset Card Stats/i });
    expect(resetBtn).toBeNull();
  });

  it('clicking "View Detailed Stats" opens CardStatsModal', async () => {
    render(
      <GameSettingsProvider>
        <TestSession state={mockGameState}>
          <CardContextMenu card={spiderManCard} position={{ x: 100, y: 100 }} onClose={vi.fn()} />
        </TestSession>
      </GameSettingsProvider>,
    );

    const viewStatsBtn = screen.getByRole('button', { name: /View Detailed Stats/i });
    fireEvent.click(viewStatsBtn);

    expect(screen.getByText(/Spider-Man — STATS/i)).toBeDefined();
    expect(screen.getByText(/Card Plays & Reveals/i)).toBeDefined();
    expect(screen.getByText(/Basic Actions/i)).toBeDefined();
  });
});
