import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { setupGame, createCardInstance } from '../../src/engine/state/game-setup';
import {
  HeroCard,
  AlterEgoCard,
  SideSchemeCard,
  GameState,
  CardInstance,
  GamePhase,
  getActiveMainScheme,
} from '../../src/engine/models';
import { evaluateTableauCardLegality } from '../../src/ui/components/board/tableau-card-legality';
import { HeroZone } from '../../src/ui/components/board/HeroZone';
import { TestSession } from '../support/render-with-session';

vi.mock('../../src/ui/hooks/useCardArt', () => ({
  useCardArt: vi.fn().mockReturnValue({
    artUrl: 'https://cdn.example.com/test.jpg',
    loading: false,
    error: null,
  }),
}));

describe('Tableau Card Actionability Graying (Issue #185)', () => {
  const spiderManHero = cardCatalog.getCard('01001a') as HeroCard;
  const peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;
  let state: GameState;
  let survTeam: CardInstance;

  beforeEach(() => {
    state = setupGame({
      catalog: cardCatalog,
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
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = spiderManHero;
    state.sideSchemes = [];

    survTeam = createCardInstance(cardCatalog.getCard('01064')!);
    survTeam.tokens = { damage: 0, threat: 0, counters: 3 };
    state.players[0].tableau.push(survTeam);
  });

  const legality = () =>
    evaluateTableauCardLegality(survTeam, state.players[0].currentForm, {
      gameState: state,
      playerId: 'p1',
    });

  it('Surveillance Team is unusable when no scheme has threat', () => {
    getActiveMainScheme(state).threat = 0;
    const result = legality();
    expect(result.isUsable).toBe(false);
    expect(result.reason).toMatch(/threat/i);
  });

  it('Surveillance Team is usable when the main scheme has threat', () => {
    getActiveMainScheme(state).threat = 3;
    expect(legality().isUsable).toBe(true);
  });

  it('Surveillance Team is usable when only a side scheme has threat', () => {
    getActiveMainScheme(state).threat = 0;
    state.sideSchemes = [
      { instanceId: 'side-1', card: cardCatalog.getCard('01108') as SideSchemeCard, threat: 2 },
    ];
    expect(legality().isUsable).toBe(true);
  });

  it('Surveillance Team is usable on another player turn via Call for Action (RR v1.8 p. 5, Issue #314) but unusable in Villain Phase', () => {
    getActiveMainScheme(state).threat = 3;
    state.activePlayerIndex = 1;
    state.players.push({ ...state.players[0], id: 'p2', name: 'Other' });
    // Usable during other player's turn in player phase via Call for Action
    expect(legality().isUsable).toBe(true);

    // Unusable outside player phase
    state.phase = GamePhase.VILLAIN_PHASE;
    expect(legality().isUsable).toBe(false);
  });

  it('Surveillance Team is unusable when exhausted', () => {
    getActiveMainScheme(state).threat = 3;
    survTeam.exhausted = true;
    expect(legality().isUsable).toBe(false);
  });

  it('Without game context the helper keeps form-only behavior', () => {
    getActiveMainScheme(state).threat = 0;
    expect(evaluateTableauCardLegality(survTeam, 'hero').isUsable).toBe(true);
  });

  it('HeroZone grays Surveillance Team and does not open the action modal with no threat', () => {
    getActiveMainScheme(state).threat = 0;
    const { container } = render(
      <TestSession state={state}>
        <HeroZone player={state.players[0]} seatNumber={1} isFocused={true} isMultiHero={false} />
      </TestSession>,
    );

    const tableau = screen.getByTestId('tableau-section');
    expect(tableau.querySelector('.filter.grayscale')).not.toBeNull();

    const cardEl = tableau.querySelector('.filter.grayscale') as HTMLElement;
    fireEvent.click(cardEl);
    expect(screen.queryByText(/Select an ability to activate/i)).toBeNull();
    expect(container).toBeDefined();
  });

  it('HeroZone keeps Surveillance Team in color and opens the modal when threat exists', () => {
    getActiveMainScheme(state).threat = 3;
    render(
      <TestSession state={state}>
        <HeroZone player={state.players[0]} seatNumber={1} isFocused={true} isMultiHero={false} />
      </TestSession>,
    );

    const tableau = screen.getByTestId('tableau-section');
    expect(tableau.querySelector('.filter.grayscale')).toBeNull();

    const cardEl = tableau.querySelector('.group') as HTMLElement;
    fireEvent.click(cardEl);
    expect(screen.queryByText(/Select an ability to activate/i)).not.toBeNull();
  });

  describe('Alpha Flight Station (01015) discard cost (Issue #179)', () => {
    let afs: CardInstance;

    beforeEach(() => {
      state.players[0].tableau = [];
      afs = createCardInstance(cardCatalog.getCard('01015')!);
      state.players[0].tableau.push(afs);
    });

    it('is unusable when the hand is empty', () => {
      state.players[0].hand = [];
      const result = evaluateTableauCardLegality(afs, 'hero', {
        gameState: state,
        playerId: 'p1',
      });
      expect(result.isUsable).toBe(false);
    });

    it('is usable when the hand has a card to discard', () => {
      state.players[0].hand = [createCardInstance(cardCatalog.getCard('01005')!)];
      const result = evaluateTableauCardLegality(afs, 'hero', {
        gameState: state,
        playerId: 'p1',
      });
      expect(result.isUsable).toBe(true);
    });

    it('HeroZone grays the card when the hand is empty', () => {
      state.players[0].hand = [];
      render(
        <TestSession state={state}>
          <HeroZone player={state.players[0]} seatNumber={1} isFocused={true} isMultiHero={false} />
        </TestSession>,
      );
      expect(
        screen.getByTestId('tableau-section').querySelector('.filter.grayscale'),
      ).not.toBeNull();
    });
  });
});
