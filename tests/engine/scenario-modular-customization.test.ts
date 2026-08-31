import { describe, it, expect } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { HeroCard, AlterEgoCard, VillainCard, MainSchemeCard } from '@engine/models';
import { setupGame } from '@engine/state/game-setup';
import { ScenarioRegistry, listModularEncounterSets } from '@engine/scenarios';

describe('Milestone 2C: Modular Encounter Set Hot-Swapping & Customization (ADR-0033)', () => {
  const spiderManHero = cardCatalog.getCard('01001a') as HeroCard;
  const peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;

  it('lists all 5 Core Set modular encounter sets with metadata', () => {
    const modularSets = listModularEncounterSets();
    expect(modularSets.length).toBe(5);

    const codes = modularSets.map((m) => m.code);
    expect(codes).toContain('bomb_scare');
    expect(codes).toContain('masters_of_evil');
    expect(codes).toContain('under_attack');
    expect(codes).toContain('legions_of_hydra');
    expect(codes).toContain('the_doomsday_chair');
  });

  it('hot-swaps Rhino modular set from Bomb Scare to Masters of Evil', () => {
    const rhinoPlugin = ScenarioRegistry.get('rhino');
    const villainCard = cardCatalog.getCard('01094') as VillainCard;
    const mainSchemeCard = cardCatalog.getCard('01097b') as MainSchemeCard;

    const state = setupGame({
      scenarioId: 'rhino',
      difficulty: 'STANDARD',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: villainCard,
      mainScheme: mainSchemeCard,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
    });

    // Configure with custom modular set: masters_of_evil
    rhinoPlugin.onGameSetup(state, {
      scenarioId: 'rhino',
      difficulty: 'STANDARD',
      modularSetCodes: ['masters_of_evil'],
    });

    // Bomb Scare cards (01109-01112) should NOT be in the deck
    expect(state.encounterDeck.some((c) => c.card.code === '01109')).toBe(false);
    expect(state.sideSchemes.some((s) => s.card.code === '01109')).toBe(false);

    // Masters of Evil cards (e.g. Baron Zemo 01128, Whirlwind 01130) SHOULD be in the deck
    expect(state.encounterDeck.some((c) => c.card.code === '01128' || c.card.code === '01130')).toBe(true);

    // Scenario-Mandatory sets (Rhino + Standard) remain intact
    expect(state.encounterDeck.some((c) => c.card.setCode === 'rhino' || c.card.raw.set_code === 'rhino')).toBe(true);
    expect(state.encounterDeck.some((c) => c.card.setCode === 'standard' || c.card.raw.set_code === 'standard')).toBe(true);
  });

  it('hot-swaps Klaw modular set from Masters of Evil to The Doomsday Chair', () => {
    const klawPlugin = ScenarioRegistry.get('klaw');
    const villainCard = cardCatalog.getCard('01113') as VillainCard;
    const mainSchemeCard = cardCatalog.getCard('01116b') as MainSchemeCard;

    const state = setupGame({
      scenarioId: 'klaw',
      difficulty: 'STANDARD',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: villainCard,
      mainScheme: mainSchemeCard,
      encounterCards: cardCatalog.getCardsBySet('klaw'),
    });

    // Configure with custom modular set: the_doomsday_chair
    klawPlugin.onGameSetup(state, {
      scenarioId: 'klaw',
      difficulty: 'STANDARD',
      modularSetCodes: ['the_doomsday_chair'],
    });

    // Masters of Evil cards should NOT be in the deck
    expect(state.encounterDeck.some((c) => c.card.code === '01128')).toBe(false);

    // The Doomsday Chair cards (e.g. M.O.D.O.K. 01184) SHOULD be in the deck or in play
    expect(
      state.encounterDeck.some((c) => c.card.code === '01184') ||
      state.players[0].engagedMinions.some((m) => m.card.code === '01184')
    ).toBe(true);
  });
});
