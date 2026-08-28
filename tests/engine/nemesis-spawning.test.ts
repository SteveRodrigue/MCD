import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { executeEffect } from '@engine/effects';

describe('Nemesis Spawning Pipeline (Rules Reference v1.8 p. 19)', () => {
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
          name: 'Player 1',
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

  it('01190 Shadow of the Past: Spawns Vulture, Highway Robbery, and shuffles remaining cards into encounter deck', () => {
    // Add an unrelated set-aside card to ensure set-aside isolation
    const unrelatedSetAsideCard = createCardInstance(cardCatalog.getCard('01008')!);
    unrelatedSetAsideCard.card.setCode = 'custom_quest';
    state.players[0].setAsideCards.push(unrelatedSetAsideCard);

    const initialEncounterDeckSize = state.encounterDeck.length;

    const shadowCard = cardCatalog.getCard('01190')!;
    const shadowInst = createCardInstance(shadowCard);
    const ability = shadowCard.enrichment!.abilities![0];

    const res = executeEffect(state, ability, { playerId: 'p1', sourceCardInstance: shadowInst });
    expect(res.success).toBe(true);

    // 1. Nemesis minion (Vulture 01167) enters play engaged with Player 1
    const vulture = res.state.players[0].engagedMinions.find((m) => m.card.code === '01167');
    expect(vulture).toBeDefined();

    // 2. Nemesis side scheme (Highway Robbery 01166) enters play
    const vultureScheme = res.state.sideSchemes.find((s) => s.card.code === '01166');
    expect(vultureScheme).toBeDefined();
    expect(vultureScheme!.threat).toBeGreaterThanOrEqual(1);

    // 3. Remaining nemesis cards (Sweeping Swoop 01168 x2, The Vulture's Plans 01169) shuffled into encounter deck
    expect(res.state.encounterDeck.some((c) => c.card.code === '01168')).toBe(true);
    expect(res.state.encounterDeck.some((c) => c.card.code === '01169')).toBe(true);
    expect(res.state.encounterDeck.length).toBe(initialEncounterDeckSize + 3);

    // 4. Only nemesis set was removed from setAsideCards; unrelated custom card remains!
    expect(res.state.players[0].setAsideCards.some((c) => c.card.code === '01167')).toBe(false);
    expect(res.state.players[0].setAsideCards.some((c) => c.card.code === '01166')).toBe(false);
    expect(res.state.players[0].setAsideCards.some((c) => c.instanceId === unrelatedSetAsideCard.instanceId)).toBe(true);
  });

  it('01190 Shadow of the Past: Gains Surge if nemesis minion is not in set-aside pool', () => {
    // Empty setAsideCards (Vulture already spawned / defeated)
    state.players[0].setAsideCards = [];

    const initialDealtCount = state.players[0].dealtEncounterCards.length;
    const shadowCard = cardCatalog.getCard('01190')!;
    const shadowInst = createCardInstance(shadowCard);
    const ability = shadowCard.enrichment!.abilities![0];

    const res = executeEffect(state, ability, { playerId: 'p1', sourceCardInstance: shadowInst });
    expect(res.success).toBe(true);

    // No minion or side scheme spawned
    expect(res.state.players[0].engagedMinions.length).toBe(0);
    expect(res.state.sideSchemes.length).toBe(0);

    // Gains Surge -> 1 extra encounter card dealt to player
    expect(res.state.players[0].dealtEncounterCards.length).toBe(initialDealtCount + 1);
  });

  it('Supports heroes with multiple Nemesis Minions entering play simultaneously', () => {
    const minion1 = createCardInstance(cardCatalog.getCard('01167')!); // Vulture clone 1
    const minion2 = createCardInstance(cardCatalog.getCard('01167')!); // Vulture clone 2
    minion1.card.setCode = 'spider_man_nemesis';
    minion2.card.setCode = 'spider_man_nemesis';

    state.players[0].setAsideCards = [minion1, minion2];

    const shadowCard = cardCatalog.getCard('01190')!;
    const shadowInst = createCardInstance(shadowCard);
    const ability = shadowCard.enrichment!.abilities![0];

    const res = executeEffect(state, ability, { playerId: 'p1', sourceCardInstance: shadowInst });
    expect(res.success).toBe(true);

    // Both minions enter play engaged with the hero
    expect(res.state.players[0].engagedMinions.length).toBe(2);
  });
});
