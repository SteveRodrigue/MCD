import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { executeEffect } from '@engine/effects';

describe('Explosion (01111) Contract Tests — RR v1.8 & Issue #114', () => {
  let state: GameState;
  let spiderManHero: HeroCard;
  let peterParkerAlterEgo: AlterEgoCard;

  beforeEach(() => {
    spiderManHero = cardCatalog.getCard('01001a') as HeroCard;
    peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;

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
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = spiderManHero;
  });

  it('when Bomb Scare is in play: deals damage equal to threat on Bomb Scare, does not surge', () => {
    const explosionCard = cardCatalog.getCard('01111')!;
    const explosionInst = createCardInstance(explosionCard);
    const ability = explosionCard.enrichment!.abilities![0];

    // Put Bomb Scare into play with 3 threat
    const bombScareCard = cardCatalog.getCard('01109')!;
    state.sideSchemes = [
      {
        instanceId: 'bomb-scare-inst',
        card: bombScareCard as any,
        threat: 3,
      },
    ];

    const initialHeroHp = state.players[0].health;
    const initialDealtCards = state.players[0].dealtEncounterCards.length;

    const result = executeEffect(state, ability, {
      playerId: 'p1',
      sourceCardInstance: explosionInst,
    });

    expect(result.success).toBe(true);
    // 3 threat on Bomb Scare dealt as damage to hero
    expect(state.players[0].health).toBe(initialHeroHp - 3);
    // Did NOT surge
    expect(state.players[0].dealtEncounterCards.length).toBe(initialDealtCards);
  });

  it('when Bomb Scare is NOT in play: gains surge and deals 0 damage', () => {
    const explosionCard = cardCatalog.getCard('01111')!;
    const explosionInst = createCardInstance(explosionCard);
    const ability = explosionCard.enrichment!.abilities![0];

    // Ensure no side schemes in play
    state.sideSchemes = [];

    const initialHeroHp = state.players[0].health;
    const initialDealtCards = state.players[0].dealtEncounterCards.length;

    const result = executeEffect(state, ability, {
      playerId: 'p1',
      sourceCardInstance: explosionInst,
    });

    expect(result.success).toBe(true);
    // No damage dealt
    expect(state.players[0].health).toBe(initialHeroHp);
    // Gained surge: dealt 1 additional encounter card
    expect(state.players[0].dealtEncounterCards.length).toBe(initialDealtCards + 1);
  });

  it('assigns damage to ally when targetInstanceId is specified', () => {
    const explosionCard = cardCatalog.getCard('01111')!;
    const explosionInst = createCardInstance(explosionCard);
    const ability = explosionCard.enrichment!.abilities![0];

    const bombScareCard = cardCatalog.getCard('01109')!;
    state.sideSchemes = [
      {
        instanceId: 'bomb-scare-inst',
        card: bombScareCard as any,
        threat: 2,
      },
    ];

    const allyCard = cardCatalog.getCard('01011')!; // Black Cat (hp 2)
    const allyInst = createCardInstance(allyCard);
    state.players[0].allies.push(allyInst);

    const initialHeroHp = state.players[0].health;

    const result = executeEffect(state, ability, {
      playerId: 'p1',
      sourceCardInstance: explosionInst,
      targetInstanceId: allyInst.instanceId,
    });

    expect(result.success).toBe(true);
    // Hero undamaged
    expect(state.players[0].health).toBe(initialHeroHp);
    // Ally took 2 damage and was defeated
    expect(state.players[0].allies).not.toContain(allyInst);
    expect(state.players[0].discard).toContain(allyInst);
  });
});
