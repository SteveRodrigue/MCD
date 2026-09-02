import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { HeroCard, AlterEgoCard } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { dispatchAction } from '@engine/pipeline/action-dispatcher';
import { executeEffect } from '@engine/effects';
import { executeVillainPhase } from '@engine/pipeline/villain-phase';

describe('Turn-Gated Form Changes (RR v1.8 p. 8)', () => {
  let sheHulkHero: HeroCard;
  let jenniferWaltersAlterEgo: AlterEgoCard;

  beforeEach(() => {
    sheHulkHero = cardCatalog.getCard('01019a') as HeroCard;
    jenniferWaltersAlterEgo = cardCatalog.getCard('01019b') as AlterEgoCard;
  });

  it('allows basic change form once per round and rejects a second basic attempt in the same round', () => {
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'She-Hulk',
          hero: sheHulkHero,
          alterEgo: jenniferWaltersAlterEgo,
          deckCards: [],
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: [cardCatalog.getCard('01108')!],
      skipMulligan: true,
    });

    const player = state.players[0];
    expect(player.currentForm).toBe('alter_ego');
    expect(player.basicChangeFormUsedThisRound).toBe(false);

    // 1. First basic change form: Alter-Ego -> Hero
    const res1 = dispatchAction(state, { type: 'CHANGE_FORM', playerId: 'p1' });
    expect(res1.result.success).toBe(true);
    expect(res1.state.players[0].currentForm).toBe('hero');
    expect(res1.state.players[0].basicChangeFormUsedThisRound).toBe(true);

    // 2. Second basic change form in same round: rejected!
    const res2 = dispatchAction(res1.state, { type: 'CHANGE_FORM', playerId: 'p1' });
    expect(res2.result.success).toBe(false);
    expect(res2.result.error).toContain('Limit once per round');
    expect(res2.state.players[0].currentForm).toBe('hero');
  });

  it('allows card abilities (Split Personality 01025) to flip form independently without consuming basic flip', () => {
    const splitPersonalityCard = cardCatalog.getCard('01025')!;
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'She-Hulk',
          hero: sheHulkHero,
          alterEgo: jenniferWaltersAlterEgo,
          deckCards: [
            cardCatalog.getCard('01021')!,
            cardCatalog.getCard('01024')!,
            cardCatalog.getCard('01026')!,
          ],
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: [cardCatalog.getCard('01108')!],
      skipMulligan: true,
    });

    const player = state.players[0];
    player.hand = [];
    player.deck = [
      createCardInstance(cardCatalog.getCard('01021')!),
      createCardInstance(cardCatalog.getCard('01024')!),
      createCardInstance(cardCatalog.getCard('01026')!),
    ];

    // 1. Play Split Personality while basicChangeFormUsedThisRound is FALSE
    const splitAbility = splitPersonalityCard.enrichment!.abilities![0];
    const effectRes1 = executeEffect(state, splitAbility, { playerId: 'p1' });
    expect(effectRes1.success).toBe(true);
    // Alter-Ego -> Hero: hand drawn up to 4 (She-Hulk hero hand size is 4)
    expect(state.players[0].currentForm).toBe('hero');
    expect(state.players[0].basicChangeFormUsedThisRound).toBe(false); // Basic flip NOT consumed!
    expect(state.players[0].hand.length).toBe(3); // drew all available cards in deck (up to printed hand size)

    // 2. Now use the basic change form to flip back to Alter-Ego
    const res2 = dispatchAction(state, { type: 'CHANGE_FORM', playerId: 'p1' });
    expect(res2.result.success).toBe(true);
    expect(res2.state.players[0].currentForm).toBe('alter_ego');
    expect(res2.state.players[0].basicChangeFormUsedThisRound).toBe(true);
  });

  it('allows card abilities (Split Personality 01025) even after basic change form has already been used', () => {
    const splitPersonalityCard = cardCatalog.getCard('01025')!;
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'She-Hulk',
          hero: sheHulkHero,
          alterEgo: jenniferWaltersAlterEgo,
          deckCards: [cardCatalog.getCard('01021')!, cardCatalog.getCard('01024')!],
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: [cardCatalog.getCard('01108')!],
      skipMulligan: true,
    });

    // 1. Use basic change form: Alter-Ego -> Hero
    const res1 = dispatchAction(state, { type: 'CHANGE_FORM', playerId: 'p1' });
    expect(res1.result.success).toBe(true);
    expect(res1.state.players[0].currentForm).toBe('hero');
    expect(res1.state.players[0].basicChangeFormUsedThisRound).toBe(true);

    // 2. Execute Split Personality: Hero -> Alter-Ego
    const splitAbility = splitPersonalityCard.enrichment!.abilities![0];
    const effectRes = executeEffect(res1.state, splitAbility, { playerId: 'p1' });
    expect(effectRes.success).toBe(true);
    expect(res1.state.players[0].currentForm).toBe('alter_ego');
    expect(res1.state.players[0].basicChangeFormUsedThisRound).toBe(true); // Remains true
  });

  it('resets basicChangeFormUsedThisRound when the round advances', () => {
    const state = setupGame({
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
      encounterCards: Array(10).fill(cardCatalog.getCard('01108')!),
      skipMulligan: true,
    });

    // Flip to Hero
    const res1 = dispatchAction(state, { type: 'CHANGE_FORM', playerId: 'p1' });
    expect(res1.state.players[0].basicChangeFormUsedThisRound).toBe(true);
    res1.state.players[0].health = 50;

    // Run Villain Phase -> Upkeep -> New Round
    const nextState = executeVillainPhase(res1.state, { synchronousPolicy: 'TAKE_UNDEFENDED' });
    expect(nextState.roundNumber).toBe(2);
    expect(nextState.players[0].basicChangeFormUsedThisRound).toBe(false);
  });
});
