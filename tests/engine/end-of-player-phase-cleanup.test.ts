import { describe, it, expect, beforeEach } from 'vitest';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { dispatchAction } from '@engine/pipeline/action-dispatcher';
import { executePlayerCleanup } from '@engine/pipeline/player-phase-cleanup';

describe('End of Player Phase Clean-Up & Voluntary Hand Discard (Issue #41, RR v1.8 p. 23)', () => {
  let spiderManHero: any;
  let peterParkerAlterEgo: any;
  let captainMarvelHero: any;
  let carolDanversAlterEgo: any;
  let rhinoVillain: any;
  let mainScheme: any;

  beforeEach(() => {
    spiderManHero = cardCatalog.getCard('01001a')!;
    peterParkerAlterEgo = cardCatalog.getCard('01001b')!;
    captainMarvelHero = cardCatalog.getCard('01010a')!;
    carolDanversAlterEgo = cardCatalog.getCard('01010b')!;
    rhinoVillain = cardCatalog.getCard('01094')!;
    mainScheme = cardCatalog.getCard('01097')!;
  });

  it('enqueues voluntary discard prompt when player has cards in hand at end of player phase', () => {
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: [
            cardCatalog.getCard('01005')!,
            cardCatalog.getCard('01005')!,
            cardCatalog.getCard('01005')!,
            cardCatalog.getCard('01005')!,
            cardCatalog.getCard('01005')!,
            cardCatalog.getCard('01005')!,
          ],
        },
      ],
      villain: rhinoVillain,
      mainScheme,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    const player = state.players[0];
    player.currentForm = 'hero';
    player.activeFormCard = spiderManHero;
    player.exhausted = true;

    // Set hand to 2 cards
    const cardA = createCardInstance(cardCatalog.getCard('01005')!);
    const cardB = createCardInstance(cardCatalog.getCard('01005')!);
    player.hand = [cardA, cardB];

    // Ending the last player turn triggers clean-up
    const res = dispatchAction(state, {
      type: 'END_PLAYER_TURN',
      playerId: 'p1',
    });

    expect(res.result.success).toBe(true);
    expect(res.state.pendingDecisionPrompt).toBeDefined();
    expect(res.state.pendingDecisionPrompt?.title).toContain(
      'End of Player Phase: Voluntary Discard',
    );
    expect(res.state.pendingDecisionPrompt?.options.length).toBe(3); // Discard cardA, Discard cardB, Keep All (Done)
  });

  it('discards selected cards, draws up to printed hand size, and readies player cards', () => {
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Captain Marvel',
          hero: captainMarvelHero,
          alterEgo: carolDanversAlterEgo,
          deckCards: [
            cardCatalog.getCard('01013')!,
            cardCatalog.getCard('01013')!,
            cardCatalog.getCard('01013')!,
            cardCatalog.getCard('01013')!,
            cardCatalog.getCard('01013')!,
            cardCatalog.getCard('01013')!,
          ],
        },
      ],
      villain: rhinoVillain,
      mainScheme,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    const player = state.players[0];
    player.currentForm = 'hero';
    player.activeFormCard = captainMarvelHero; // Hero Hand Size = 5
    player.exhausted = true;

    const cardToDiscard = createCardInstance(cardCatalog.getCard('01013')!);
    const cardToKeep = createCardInstance(cardCatalog.getCard('01013')!);
    player.hand = [cardToDiscard, cardToKeep];
    player.deck = [
      createCardInstance(cardCatalog.getCard('01013')!),
      createCardInstance(cardCatalog.getCard('01013')!),
      createCardInstance(cardCatalog.getCard('01013')!),
      createCardInstance(cardCatalog.getCard('01013')!),
      createCardInstance(cardCatalog.getCard('01013')!),
    ];
    player.discard = [];

    // Directly execute player cleanup with 1 discarded card
    const afterCleanup = executePlayerCleanup(state, 'p1', [cardToDiscard.instanceId]);

    const updatedPlayer = afterCleanup.players[0];
    // 1 card discarded to discard pile
    expect(updatedPlayer.discard.some((c) => c.instanceId === cardToDiscard.instanceId)).toBe(true);
    // Kept card remains in hand
    expect(updatedPlayer.hand.some((c) => c.instanceId === cardToKeep.instanceId)).toBe(true);
    // Hand refilled to printed hand size 5 (1 kept + 4 drawn = 5)
    expect(updatedPlayer.hand.length).toBe(5);
    // Player is readied
    expect(updatedPlayer.exhausted).toBe(false);
  });

  it('draws remaining deficit up to printed hand size when keeping all cards (0 discarded)', () => {
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Captain Marvel',
          hero: captainMarvelHero,
          alterEgo: carolDanversAlterEgo,
          deckCards: [
            cardCatalog.getCard('01013')!,
            cardCatalog.getCard('01013')!,
            cardCatalog.getCard('01013')!,
            cardCatalog.getCard('01013')!,
            cardCatalog.getCard('01013')!,
            cardCatalog.getCard('01013')!,
          ],
        },
      ],
      villain: rhinoVillain,
      mainScheme,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    const player = state.players[0];
    player.currentForm = 'hero';
    player.activeFormCard = captainMarvelHero; // Hand Size = 5
    player.exhausted = true;

    const cardA = createCardInstance(cardCatalog.getCard('01013')!);
    const cardB = createCardInstance(cardCatalog.getCard('01013')!);
    player.hand = [cardA, cardB];
    player.deck = [
      createCardInstance(cardCatalog.getCard('01013')!),
      createCardInstance(cardCatalog.getCard('01013')!),
      createCardInstance(cardCatalog.getCard('01013')!),
      createCardInstance(cardCatalog.getCard('01013')!),
      createCardInstance(cardCatalog.getCard('01013')!),
    ];

    // Keep all cards (0 discarded)
    const afterCleanup = executePlayerCleanup(state, 'p1', []);

    const updatedPlayer = afterCleanup.players[0];
    expect(updatedPlayer.hand.length).toBe(5); // 2 kept + 3 drawn = 5
    expect(updatedPlayer.exhausted).toBe(false);
  });
});
