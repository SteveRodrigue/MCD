import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { initiateEnemyAttack } from '@engine/pipeline/combat-pipeline';

describe('Universal Trigger Filter Contract Tests (Spider-Sense 01001a & Scope Matching) — ADR-0046, Issue #115', () => {
  let state: GameState;
  let spiderManHero: HeroCard;
  let peterParkerAlterEgo: AlterEgoCard;
  let ironManHero: HeroCard;
  let tonyStarkAlterEgo: AlterEgoCard;

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
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
        {
          id: 'p2',
          name: 'Iron Man',
          hero: ironManHero,
          alterEgo: tonyStarkAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01030')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = spiderManHero;
    state.players[1].currentForm = 'hero';
    state.players[1].activeFormCard = ironManHero;
  });

  it('Spider-Sense triggers and draws a card when Villain initiates attack against Spider-Man (SELF)', () => {
    const initialHandSize = state.players[0].hand.length;

    // Villain initiates attack against p1 (Spider-Man)
    const nextState = initiateEnemyAttack(state, { type: 'VILLAIN' }, 'p1', {
      acceptOptionalTriggers: true,
    });

    // Spider-Sense triggers on villain attack targeting self -> draws 1 card
    expect(nextState.players[0].hand.length).toBe(initialHandSize + 1);
  });

  it('Spider-Sense does NOT trigger when Minion initiates attack against Spider-Man', () => {
    const minionCard = cardCatalog.getCard('01096')!; // Armored Guard minion
    const minionInst = createCardInstance(minionCard);
    state.players[0].engagedMinions.push(minionInst);

    const initialHandSize = state.players[0].hand.length;

    // Minion initiates attack against p1
    const nextState = initiateEnemyAttack(state, { type: 'MINION', card: minionInst }, 'p1', {
      acceptOptionalTriggers: true,
    });

    // Spider-Sense requires attackerKind: 'VILLAIN' -> does NOT draw a card
    expect(nextState.players[0].hand.length).toBe(initialHandSize);
  });

  it('Spider-Sense does NOT trigger when Villain initiates attack against another player (targetPlayerScope: OTHER)', () => {
    const initialHandSizeP1 = state.players[0].hand.length;
    const initialHandSizeP2 = state.players[1].hand.length;

    // Villain initiates attack against p2 (Iron Man)
    const nextState = initiateEnemyAttack(state, { type: 'VILLAIN' }, 'p2', {
      acceptOptionalTriggers: true,
    });

    // Spider-Sense is on p1 and requires targetPlayerScope: 'SELF' -> p1 does NOT draw
    expect(nextState.players[0].hand.length).toBe(initialHandSizeP1);
    expect(nextState.players[1].hand.length).toBe(initialHandSizeP2);
  });
});
