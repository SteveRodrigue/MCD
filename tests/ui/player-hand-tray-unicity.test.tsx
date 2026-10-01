import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlayerHandTray } from '../../src/ui/components/board/PlayerHandTray';
import { GameSettingsProvider } from '../../src/ui/context/GameSettingsProvider';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { setupGame, createCardInstance } from '../../src/engine/state/game-setup';
import { GameState, HeroCard, AlterEgoCard, GamePhase, AllyCard } from '../../src/engine/models';

vi.mock('../../src/ui/hooks/useCardArt', () => ({
  useCardArt: vi.fn().mockReturnValue({
    artUrl: 'https://cdn.example.com/test.jpg',
    loading: false,
    error: null,
  }),
}));

describe('PlayerHandTray Global Unicity UI Enforcement (Issue #187)', () => {
  let state: GameState;
  let spiderManHero: HeroCard;
  let peterParkerAlterEgo: AlterEgoCard;
  let captainMarvelHero: HeroCard;
  let carolDanversAlterEgo: AlterEgoCard;
  let nickFuryCard: AllyCard;

  beforeEach(() => {
    Element.prototype.scrollTo = vi.fn();
    Element.prototype.scrollBy = vi.fn();
    Element.prototype.getBoundingClientRect = vi.fn().mockReturnValue({
      top: 0,
      left: 0,
      right: 1920,
      bottom: 1080,
      width: 1920,
      height: 1080,
      x: 0,
      y: 0,
    });

    spiderManHero = cardCatalog.getCard('01001a') as HeroCard;
    peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;
    captainMarvelHero = cardCatalog.getCard('01010a') as HeroCard;
    carolDanversAlterEgo = cardCatalog.getCard('01010b') as AlterEgoCard;
    nickFuryCard = cardCatalog.getCard('01084') as AllyCard;

    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
        {
          id: 'p2',
          name: 'Captain Marvel',
          hero: captainMarvelHero,
          alterEgo: carolDanversAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    state.phase = GamePhase.PLAYER_PHASE;
    state.activePlayerIndex = 0;
    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = spiderManHero;
  });

  it('renders Nick Fury in hand with disabled unplayable status and tooltip when Player 2 controls Nick Fury', () => {
    // Player 2 controls Nick Fury
    const p2Fury = createCardInstance(nickFuryCard);
    state.players[1].allies.push(p2Fury);

    // Player 1 has Nick Fury and sufficient payment cards in hand
    const p1Fury = createCardInstance(nickFuryCard);
    const payCards = [
      createCardInstance(cardCatalog.getCard('01005')!),
      createCardInstance(cardCatalog.getCard('01005')!),
      createCardInstance(cardCatalog.getCard('01005')!),
      createCardInstance(cardCatalog.getCard('01005')!),
    ];
    state.players[0].hand = [p1Fury, ...payCards];

    render(
      <GameSettingsProvider>
        <PlayerHandTray
          hand={state.players[0].hand}
          deck={state.players[0].deck}
          discard={state.players[0].discard}
          heroName="Spider-Man"
          handSizeLimit={5}
          player={state.players[0]}
          gameState={state}
        />
      </GameSettingsProvider>,
    );

    // 1. CANNOT PLAY badge is rendered
    const cannotPlayBadges = screen.getAllByText('CANNOT PLAY');
    expect(cannotPlayBadges.length).toBeGreaterThan(0);

    // 2. Unicity disabled reason is surfaced in the title attribute tooltip
    const unicityTooltip = cannotPlayBadges.find((badge) => {
      const title = badge.getAttribute('title');
      return (
        title &&
        title.includes('Global unicity violation') &&
        title.includes(
          "A unique copy of 'Nick Fury' is already in play under Captain Marvel's control",
        )
      );
    });
    expect(unicityTooltip).toBeDefined();

    // 3. Verify Nick Fury does NOT have active green playable styling
    const nickFuryImg = screen.getByAltText('Nick Fury');
    expect(nickFuryImg).toBeDefined();
    const cardOuter = nickFuryImg.closest('.filter');
    expect(cardOuter).toBeDefined();
    // Inactive/unplayable cards receive grayscale and contrast dimming
    expect(cardOuter?.className).toContain('grayscale');
    expect(cardOuter?.className).not.toContain('border-emerald-600');
    expect(cardOuter?.className).not.toContain('ring-emerald-400');

    // 4. Clicking the unplayable Nick Fury card displays the warning banner with unicity violation
    fireEvent.click(nickFuryImg);
    const warningElements = screen.getAllByText(/Cannot play Nick Fury: Global unicity violation/i);
    expect(warningElements.length).toBeGreaterThan(0);
    expect(warningElements[0].textContent).toContain("under Captain Marvel's control");
  });
});
