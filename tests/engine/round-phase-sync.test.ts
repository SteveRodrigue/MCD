import { describe, it, expect } from 'vitest';
import { setupGame } from '../../src/engine/state/game-setup';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { HeroCard, AlterEgoCard, GamePhase, VillainPhaseStep } from '../../src/engine/models';
import { startPlayerPhase } from '../../src/engine/pipeline/player-phase';
import { advanceVillainPhaseStep } from '../../src/engine/pipeline/villain-phase';

describe('Round & Phase Synchronization (Issue #169)', () => {
  const spidermanHero = cardCatalog.getCard('01001a') as HeroCard;
  const spidermanAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;
  const ironManHero = cardCatalog.getCard('01029a') as HeroCard;
  const ironManAlterEgo = cardCatalog.getCard('01029b') as AlterEgoCard;

  function createTwoPlayerGame() {
    return setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spidermanHero,
          alterEgo: spidermanAlterEgo,
          deckCards: Array(15).fill(cardCatalog.getCard('01005')!),
        },
        {
          id: 'p2',
          name: 'Iron Man',
          hero: ironManHero,
          alterEgo: ironManAlterEgo,
          deckCards: Array(15).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
  }

  it('resets activePlayerIndex to firstPlayerIndex on startPlayerPhase', () => {
    const state = createTwoPlayerGame();
    state.firstPlayerIndex = 1; // Player 2 is First Player
    state.activePlayerIndex = 0; // Desynced or previous player pointer

    const nextState = startPlayerPhase(state);
    expect(nextState.activePlayerIndex).toBe(1);
    expect(nextState.phase).toBe(GamePhase.PLAYER_PHASE);
  });

  it('advances to new round and sets activePlayerIndex to new firstPlayerIndex on round upkeep', () => {
    const state = createTwoPlayerGame();
    state.phase = GamePhase.VILLAIN_PHASE;
    state.villainPhaseStep = VillainPhaseStep.PASS_FIRST_PLAYER;
    state.firstPlayerIndex = 0;

    const nextState = advanceVillainPhaseStep(state);

    expect(nextState.phase).toBe(GamePhase.PLAYER_PHASE);
    expect(nextState.roundNumber).toBe(2);
    expect(nextState.firstPlayerIndex).toBe(1);
    expect(nextState.activePlayerIndex).toBe(1);
    expect(nextState.villainPhaseStep).toBeUndefined();
    expect(nextState.villainPhaseStepEvent?.type).toBe('PASS_FIRST_PLAYER');
  });
});
