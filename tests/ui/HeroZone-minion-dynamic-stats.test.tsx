import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HeroZone } from '../../src/ui/components/board/HeroZone';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { setupGame, createCardInstance } from '../../src/engine/state/game-setup';
import { HeroCard, AlterEgoCard, MinionCard } from '../../src/engine/models';
import { TestSession } from '../support/render-with-session';

vi.mock('../../src/ui/hooks/useCardArt', () => ({
  useCardArt: vi.fn().mockReturnValue({
    artUrl: 'https://cdn.example.com/test.jpg',
    loading: false,
    error: null,
  }),
}));

describe('HeroZone Minion Dynamic Stats Display (#386)', () => {
  const sheHulkHero = cardCatalog.getCard('01019a') as HeroCard;
  const jenniferWaltersAlterEgo = cardCatalog.getCard('01019b') as AlterEgoCard;

  function createTestGame() {
    return setupGame({
      catalog: cardCatalog,
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'She-Hulk',
          hero: sheHulkHero,
          alterEgo: jenniferWaltersAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      skipMulligan: true,
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Titania (01162) dynamic ATK 6 (not -1) upon entering play', () => {
    const gameState = createTestGame();
    const player = gameState.players[0];

    const titaniaCard = cardCatalog.getCard('01162') as MinionCard;
    const titania = createCardInstance(titaniaCard);
    player.engagedMinions = [titania];

    render(
      <TestSession state={gameState}>
        <HeroZone player={player} seatNumber={1} isFocused={true} isMultiHero={false} />
      </TestSession>,
    );

    // Titania has remaining hit points = 6, so her dynamic attack must render as ATK 6
    const atkBadge = screen.getByTitle('Attack: 6');
    expect(atkBadge).toBeDefined();
    expect(atkBadge.textContent).toContain('ATK 6');
    expect(screen.queryByTitle('Attack: -1')).toBeNull();
    expect(screen.queryByText('ATK -1')).toBeNull();
  });

  it('updates Titania ATK badge to ATK 4 when she has 2 damage', () => {
    const gameState = createTestGame();
    const player = gameState.players[0];

    const titaniaCard = cardCatalog.getCard('01162') as MinionCard;
    const titania = createCardInstance(titaniaCard);
    titania.tokens = { damage: 2 };
    player.engagedMinions = [titania];

    render(
      <TestSession state={gameState}>
        <HeroZone player={player} seatNumber={1} isFocused={true} isMultiHero={false} />
      </TestSession>,
    );

    const atkBadge = screen.getByTitle('Attack: 4');
    expect(atkBadge).toBeDefined();
    expect(atkBadge.textContent).toContain('ATK 4');
  });

  it('renders Hulk (01050) ally with dash THW display in tableau', () => {
    const gameState = createTestGame();
    const player = gameState.players[0];

    const hulkCard = cardCatalog.getCard('01050')!;
    const hulkAlly = createCardInstance(hulkCard);
    player.allies = [hulkAlly];

    render(
      <TestSession state={gameState}>
        <HeroZone player={player} seatNumber={1} isFocused={true} isMultiHero={false} />
      </TestSession>,
    );

    // Hulk ally has dash THW ('–')
    expect(screen.getByText('🛡️ –')).toBeDefined();
    expect(screen.getByText('THW')).toBeDefined();
    expect(screen.getAllByText('–').length).toBeGreaterThan(0);
  });
});
