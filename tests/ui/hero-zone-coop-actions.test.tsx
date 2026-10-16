import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { cardCatalog } from '../../src/data/importer/card-loader';
import {
  GamePhase,
  GameState,
  HeroCard,
  AlterEgoCard,
  CardInstance,
} from '../../src/engine/models';
import { setupGame, createCardInstance } from '../../src/engine/state/game-setup';
import { HeroZone } from '../../src/ui/components/board/HeroZone';

vi.mock('../../src/ui/hooks/useCardArt', () => ({
  useCardArt: vi.fn().mockReturnValue({
    artUrl: 'https://cdn.example.com/test.jpg',
    loading: false,
    error: null,
  }),
}));

describe('HeroZone Cooperative Tableau Actions (Issue #314)', () => {
  let state: GameState;
  let spiderManHero: HeroCard;
  let peterParkerAlterEgo: AlterEgoCard;
  let ironManHero: HeroCard;
  let tonyStarkAlterEgo: AlterEgoCard;
  let avengersMansion: CardInstance;

  beforeEach(() => {
    spiderManHero = cardCatalog.getCard('01001a') as HeroCard;
    peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;
    ironManHero = cardCatalog.getCard('01029a') as HeroCard;
    tonyStarkAlterEgo = cardCatalog.getCard('01029b') as AlterEgoCard;

    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Peter Parker',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(15).fill(cardCatalog.getCard('01005')!),
        },
        {
          id: 'p2',
          name: 'Tony Stark',
          hero: ironManHero,
          alterEgo: tonyStarkAlterEgo,
          deckCards: Array(15).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    state.phase = GamePhase.PLAYER_PHASE;
    state.activePlayerIndex = 0; // p1's active turn

    // p2 has Avengers Mansion in tableau
    avengersMansion = createCardInstance(cardCatalog.getCard('01091')!);
    state.players[1].tableau.push(avengersMansion);
  });

  it('teammate tableau card ability button is enabled and clickable during active player turn in PLAYER_PHASE', () => {
    const onDispatchAction = vi.fn();
    const onInitiateAction = vi.fn();

    // Render HeroZone for player 2 (Tony Stark), while active player is player 1 (Peter Parker)
    render(
      <HeroZone
        player={state.players[1]}
        gameState={state}
        seatNumber={2}
        isFocused={false}
        isMultiHero={true}
        onDispatchAction={onDispatchAction}
        onInitiateAction={onInitiateAction}
      />,
    );

    // Ability button on Avengers Mansion should be enabled and show cooperative badge or USE
    const triggerBtn = screen.getByRole('button', { name: /CALL \/ USE|USE/i });
    expect(triggerBtn).toBeDefined();
    expect((triggerBtn as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(triggerBtn);

    // Must dispatch action for player 2
    expect(onDispatchAction).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'USE_CARD_ABILITY',
        playerId: 'p2',
        cardInstanceId: avengersMansion.instanceId,
      }),
    );
  });
});
