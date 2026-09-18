import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard, StatusCard } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { executeEffect } from '@engine/effects';

describe('Repulsor Blast (01031) Contract Tests — RR v1.8 & Issue #112', () => {
  let state: GameState;
  let ironManHero: HeroCard;
  let tonyStarkAlterEgo: AlterEgoCard;

  beforeEach(() => {
    ironManHero = cardCatalog.getCard('01029a') as HeroCard;
    tonyStarkAlterEgo = cardCatalog.getCard('01029b') as AlterEgoCard;

    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Iron Man',
          hero: ironManHero,
          alterEgo: tonyStarkAlterEgo,
          deckCards: Array(15).fill(cardCatalog.getCard('01030')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = ironManHero;
  });

  it('deals 1 base damage when 0 energy resource icons are discarded from top 5 cards', () => {
    const repulsorCard = cardCatalog.getCard('01031')!;
    const ability = repulsorCard.enrichment!.abilities![0];

    // Prepare top 5 cards of deck with non-energy resources (e.g. physical or mental)
    const nonEnergyCard = createCardInstance({
      code: 'mock_mental',
      name: 'Mock Mental Card',
      type: 'event',
      faction: 'basic',
      packCode: 'core',
      position: 999,
      quantity: 1,
      deckLimit: 3,
      isUnique: false,
      text: '',
      traits: [],
      keywords: [],
      resources: { physical: 0, energy: 0, mental: 1, wild: 0, total: 1 },
      isLandscape: false,
      orientation: 'portrait',
      raw: {
        code: 'mock_mental',
        name: 'Mock Mental Card',
        type_code: 'event',
        faction_code: 'basic',
        pack_code: 'core',
        position: 999,
        quantity: 1,
        resource_mental: 1,
      },
    } as any);

    state.players[0].deck = [
      nonEnergyCard,
      nonEnergyCard,
      nonEnergyCard,
      nonEnergyCard,
      nonEnergyCard,
    ];

    const initialHealth = state.villain.health;
    const result = executeEffect(state, ability, {
      playerId: 'p1',
      sourceCardInstance: createCardInstance(repulsorCard),
      targetType: 'villain',
    });

    expect(result.success).toBe(true);
    // 1 base + 0 bonus = 1 damage
    expect(state.villain.health).toBe(initialHealth - 1);
    expect(state.players[0].discard.length).toBe(5);
    expect(state.players[0].deck.length).toBe(0);
  });

  it('deals 1 base + 2 per energy icon (including double energy cards) to enemy', () => {
    const repulsorCard = cardCatalog.getCard('01031')!;
    const ability = repulsorCard.enrichment!.abilities![0];

    const singleEnergyCard = createCardInstance({
      code: 'mock_energy_1',
      name: 'Single Energy',
      type: 'event',
      faction: 'basic',
      packCode: 'core',
      position: 991,
      quantity: 1,
      deckLimit: 3,
      isUnique: false,
      text: '',
      traits: [],
      keywords: [],
      resources: { physical: 0, energy: 1, mental: 0, wild: 0, total: 1 },
      isLandscape: false,
      orientation: 'portrait',
      raw: {
        code: 'mock_energy_1',
        name: 'Single Energy',
        type_code: 'event',
        faction_code: 'basic',
        pack_code: 'core',
        position: 991,
        quantity: 1,
        resource_energy: 1,
      },
    } as any);

    const doubleEnergyCard = createCardInstance({
      code: 'mock_energy_2',
      name: 'Double Energy',
      type: 'resource',
      faction: 'basic',
      packCode: 'core',
      position: 992,
      quantity: 1,
      deckLimit: 1,
      isUnique: false,
      text: '',
      traits: [],
      keywords: [],
      resources: { physical: 0, energy: 2, mental: 0, wild: 0, total: 2 },
      isLandscape: false,
      orientation: 'portrait',
      raw: {
        code: 'mock_energy_2',
        name: 'Double Energy',
        type_code: 'resource',
        faction_code: 'basic',
        pack_code: 'core',
        position: 992,
        quantity: 1,
        resource_energy: 2,
      },
    } as any);

    const nonEnergyCard = createCardInstance({
      code: 'mock_phys',
      name: 'Physical Card',
      type: 'event',
      faction: 'basic',
      packCode: 'core',
      position: 993,
      quantity: 1,
      deckLimit: 3,
      isUnique: false,
      text: '',
      traits: [],
      keywords: [],
      resources: { physical: 1, energy: 0, mental: 0, wild: 0, total: 1 },
      isLandscape: false,
      orientation: 'portrait',
      raw: {
        code: 'mock_phys',
        name: 'Physical Card',
        type_code: 'event',
        faction_code: 'basic',
        pack_code: 'core',
        position: 993,
        quantity: 1,
        resource_physical: 1,
      },
    } as any);

    // 5 cards discarded: doubleEnergy (2) + singleEnergy (1) + singleEnergy (1) + nonEnergy (0) + nonEnergy (0)
    // Total energy icons = 4 -> bonus = 4 * 2 = 8 -> total damage = 1 + 8 = 9
    state.players[0].deck = [
      doubleEnergyCard,
      singleEnergyCard,
      singleEnergyCard,
      nonEnergyCard,
      nonEnergyCard,
    ];

    const initialHealth = state.villain.health;
    const result = executeEffect(state, ability, {
      playerId: 'p1',
      sourceCardInstance: createCardInstance(repulsorCard),
      targetType: 'villain',
    });

    expect(result.success).toBe(true);
    expect(state.villain.health).toBe(initialHealth - 9);
    expect(state.players[0].discard.length).toBe(5);
  });

  it('wild resource icons do not count towards printed energy bonus', () => {
    const repulsorCard = cardCatalog.getCard('01031')!;
    const ability = repulsorCard.enrichment!.abilities![0];

    const wildCard = createCardInstance({
      code: 'mock_wild',
      name: 'Wild Resource Card',
      type: 'resource',
      faction: 'basic',
      packCode: 'core',
      position: 994,
      quantity: 1,
      deckLimit: 1,
      isUnique: false,
      text: '',
      traits: [],
      keywords: [],
      resources: { physical: 0, energy: 0, mental: 0, wild: 1, total: 1 },
      isLandscape: false,
      orientation: 'portrait',
      raw: {
        code: 'mock_wild',
        name: 'Wild Resource Card',
        type_code: 'resource',
        faction_code: 'basic',
        pack_code: 'core',
        position: 994,
        quantity: 1,
        resource_wild: 1,
      },
    } as any);

    state.players[0].deck = [wildCard, wildCard, wildCard, wildCard, wildCard];

    const initialHealth = state.villain.health;
    const result = executeEffect(state, ability, {
      playerId: 'p1',
      sourceCardInstance: createCardInstance(repulsorCard),
      targetType: 'villain',
    });

    expect(result.success).toBe(true);
    // Wild is not printed [energy] -> 1 base + 0 bonus = 1 damage
    expect(state.villain.health).toBe(initialHealth - 1);
  });

  it('deals damage as a single simultaneous instance (Tough absorbs entire damage including energy bonus per Official FAQ)', () => {
    const repulsorCard = cardCatalog.getCard('01031')!;
    const ability = repulsorCard.enrichment!.abilities![0];

    // Discard 2 energy resources (bonus = 4, total = 5 damage)
    const singleEnergyCard = createCardInstance({
      code: 'mock_energy',
      name: 'Energy Card',
      type: 'event',
      faction: 'basic',
      packCode: 'core',
      position: 995,
      quantity: 1,
      deckLimit: 3,
      isUnique: false,
      text: '',
      traits: [],
      keywords: [],
      resources: { physical: 0, energy: 1, mental: 0, wild: 0, total: 1 },
      isLandscape: false,
      orientation: 'portrait',
      raw: {
        code: 'mock_energy',
        name: 'Energy Card',
        type_code: 'event',
        faction_code: 'basic',
        pack_code: 'core',
        position: 995,
        quantity: 1,
        resource_energy: 1,
      },
    } as any);

    const nonEnergyCard = createCardInstance({
      code: 'mock_mental',
      name: 'Mental Card',
      type: 'event',
      faction: 'basic',
      packCode: 'core',
      position: 996,
      quantity: 1,
      deckLimit: 3,
      isUnique: false,
      text: '',
      traits: [],
      keywords: [],
      resources: { physical: 0, energy: 0, mental: 1, wild: 0, total: 1 },
      isLandscape: false,
      orientation: 'portrait',
      raw: {
        code: 'mock_mental',
        name: 'Mental Card',
        type_code: 'event',
        faction_code: 'basic',
        pack_code: 'core',
        position: 996,
        quantity: 1,
        resource_mental: 1,
      },
    } as any);

    state.players[0].deck = [
      singleEnergyCard,
      singleEnergyCard,
      nonEnergyCard,
      nonEnergyCard,
      nonEnergyCard,
    ];

    // Give villain Tough status
    state.villain.statusCards = [StatusCard.TOUGH];
    const initialHealth = state.villain.health;

    const result = executeEffect(state, ability, {
      playerId: 'p1',
      sourceCardInstance: createCardInstance(repulsorCard),
      targetType: 'villain',
    });

    expect(result.success).toBe(true);
    // Official FAQ: 5 damage dealt all at once. Tough absorbs the entire instance.
    // Villain health must NOT be reduced by the remaining 4 damage.
    expect(state.villain.health).toBe(initialHealth);
    expect(state.villain.statusCards).not.toContain(StatusCard.TOUGH);
    expect(state.players[0].discard.length).toBe(5);
  });
});
