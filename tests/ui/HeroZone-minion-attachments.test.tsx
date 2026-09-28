import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HeroZone } from '../../src/ui/components/board/HeroZone';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { setupGame, createCardInstance } from '../../src/engine/state/game-setup';
import { HeroCard, AlterEgoCard } from '../../src/engine/models';

vi.mock('../../src/ui/hooks/useCardArt', () => ({
  useCardArt: vi.fn().mockReturnValue({
    artUrl: 'https://cdn.example.com/test.jpg',
    loading: false,
    error: null,
  }),
}));

describe('HeroZone Engaged Minion Attachments Rendering (Issue #134)', () => {
  const spiderManHero = cardCatalog.getCard('01001a') as HeroCard;
  const peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;

  function createTestGame() {
    return setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
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

  it('renders CardAttachmentFan for an engaged minion with attached cards in staircase mode', () => {
    const gameState = createTestGame();
    const player = gameState.players[0];

    // Setup engaged minion with attached Spider-Tracer
    const minionCard = cardCatalog.getCard('01101')!; // Hydra Mercenary
    const minion = createCardInstance(minionCard);

    const spiderTracerCard = cardCatalog.getCard('01007')!; // Spider-Tracer
    const spiderTracer = createCardInstance(spiderTracerCard);
    minion.attachments = [spiderTracer];

    player.engagedMinions = [minion];

    render(
      <HeroZone
        player={player}
        gameState={gameState}
        seatNumber={1}
        isFocused={true}
        isMultiHero={false}
      />,
    );

    // Host minion card is rendered
    const minionCardImage = screen.getByAltText('Hydra Mercenary');
    expect(minionCardImage).toBeDefined();

    // Attached card (Spider-Tracer) is rendered by CardAttachmentFan
    const attachedTracerImage = screen.getByAltText('Spider-Tracer');
    expect(attachedTracerImage).toBeDefined();
  });
});
