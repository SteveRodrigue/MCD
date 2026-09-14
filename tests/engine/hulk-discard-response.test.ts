import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { dispatchAction } from '@engine/pipeline/action-dispatcher';

describe('Hulk (01050) Forced Response Contract Tests — RR v1.8 & Issue #113', () => {
  let state: GameState;
  let sheHulkHero: HeroCard;
  let jenniferWaltersAlterEgo: AlterEgoCard;

  const createResourceCard = (type: 'physical' | 'energy' | 'mental' | 'wild') => {
    return createCardInstance({
      code: `mock_${type}`,
      name: `Mock ${type} Card`,
      type: 'event',
      faction: 'aggression',
      packCode: 'core',
      position: 801,
      quantity: 1,
      deckLimit: 3,
      isUnique: false,
      text: '',
      traits: [],
      keywords: [],
      resources: {
        physical: type === 'physical' ? 1 : 0,
        energy: type === 'energy' ? 1 : 0,
        mental: type === 'mental' ? 1 : 0,
        wild: type === 'wild' ? 1 : 0,
        total: 1,
      },
      isLandscape: false,
      orientation: 'portrait',
      raw: {
        code: `mock_${type}`,
        name: `Mock ${type} Card`,
        type_code: 'event',
        faction_code: 'aggression',
        pack_code: 'core',
        position: 801,
        quantity: 1,
        [`resource_${type}`]: 1,
      },
    } as any);
  };

  beforeEach(() => {
    sheHulkHero = cardCatalog.getCard('01019a') as HeroCard;
    jenniferWaltersAlterEgo = cardCatalog.getCard('01019b') as AlterEgoCard;

    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'She-Hulk',
          hero: sheHulkHero,
          alterEgo: jenniferWaltersAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01022')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = sheHulkHero;
  });

  it('physical icon: deals 2 damage to enemy', () => {
    const hulkCard = cardCatalog.getCard('01050')!;
    const hulkInst = createCardInstance(hulkCard);
    state.players[0].allies.push(hulkInst);

    // Top card of deck has physical resource
    const physCard = createResourceCard('physical');
    state.players[0].deck = [physCard];

    const initialVillainHp = state.villain.health;

    // Hulk attacks villain: 3 base attack + forced response 2 damage = 5 total damage
    const { state: nextState, result } = dispatchAction(state, {
      type: 'ALLY_ATTACK',
      playerId: 'p1',
      allyInstanceId: hulkInst.instanceId,
      targetType: 'villain',
      targetInstanceId: state.villain.instanceId,
    });

    expect(result.success).toBe(true);
    // 3 from attack + 2 from physical response = 5 damage
    expect(nextState.villain.health).toBe(initialVillainHp - 5);
    // Hulk takes 1 consequential damage and remains in play
    const hulkInNext = nextState.players[0].allies.find(
      (a) => a.instanceId === hulkInst.instanceId,
    );
    expect(hulkInNext).toBeDefined();
    expect(hulkInNext!.tokens?.damage).toBe(1);
    expect(nextState.players[0].discard.some((c) => c.instanceId === physCard.instanceId)).toBe(
      true,
    );
  });

  it('energy icon: deals 1 damage to each character', () => {
    const hulkCard = cardCatalog.getCard('01050')!;
    const hulkInst = createCardInstance(hulkCard);
    state.players[0].allies.push(hulkInst);

    // Add another ally and an engaged minion
    const secondAlly = createCardInstance(cardCatalog.getCard('01051')!); // Tigra
    state.players[0].allies.push(secondAlly);

    const minion = createCardInstance(cardCatalog.getCard('01096')!); // Armored Guard (hp 6)
    state.players[0].engagedMinions.push(minion);

    const energyCard = createResourceCard('energy');
    state.players[0].deck = [energyCard];

    const initialHeroHp = state.players[0].health;
    const initialVillainHp = state.villain.health;

    const { state: nextState } = dispatchAction(state, {
      type: 'ALLY_ATTACK',
      playerId: 'p1',
      allyInstanceId: hulkInst.instanceId,
      targetType: 'villain',
      targetInstanceId: state.villain.instanceId,
    });

    // Villain took 3 (attack) + 1 (energy character damage) = 4
    expect(nextState.villain.health).toBe(initialVillainHp - 4);
    // Hero took 1 damage
    expect(nextState.players[0].health).toBe(initialHeroHp - 1);
    // Hulk took 1 consequential + 1 energy damage = 2
    const hulkInNext = nextState.players[0].allies.find(
      (a) => a.instanceId === hulkInst.instanceId,
    );
    expect(hulkInNext?.tokens?.damage).toBe(2);
    // Tigra took 1 damage
    const tigraInNext = nextState.players[0].allies.find(
      (a) => a.instanceId === secondAlly.instanceId,
    );
    expect(tigraInNext?.tokens?.damage).toBe(1);
    // Minion took 1 damage
    const minionInNext = nextState.players[0].engagedMinions.find(
      (m) => m.instanceId === minion.instanceId,
    );
    expect(minionInNext?.tokens?.damage).toBe(1);
  });

  it('mental icon: discards Hulk', () => {
    const hulkCard = cardCatalog.getCard('01050')!;
    const hulkInst = createCardInstance(hulkCard);
    state.players[0].allies.push(hulkInst);

    const mentalCard = createResourceCard('mental');
    state.players[0].deck = [mentalCard];

    const { state: nextState } = dispatchAction(state, {
      type: 'ALLY_ATTACK',
      playerId: 'p1',
      allyInstanceId: hulkInst.instanceId,
      targetType: 'villain',
      targetInstanceId: state.villain.instanceId,
    });

    // Hulk was discarded
    expect(
      nextState.players[0].allies.find((a) => a.instanceId === hulkInst.instanceId),
    ).toBeUndefined();
    expect(nextState.players[0].discard.some((c) => c.instanceId === hulkInst.instanceId)).toBe(
      true,
    );
    expect(nextState.players[0].discard.some((c) => c.instanceId === mentalCard.instanceId)).toBe(
      true,
    );
  });

  it('wild icon: resolves all three effects (deals 2 to enemy, 1 to all characters, discards Hulk)', () => {
    const hulkCard = cardCatalog.getCard('01050')!;
    const hulkInst = createCardInstance(hulkCard);
    state.players[0].allies.push(hulkInst);

    const wildCard = createResourceCard('wild');
    state.players[0].deck = [wildCard];

    const initialHeroHp = state.players[0].health;
    const initialVillainHp = state.villain.health;

    const { state: nextState } = dispatchAction(state, {
      type: 'ALLY_ATTACK',
      playerId: 'p1',
      allyInstanceId: hulkInst.instanceId,
      targetType: 'villain',
      targetInstanceId: state.villain.instanceId,
    });

    // Villain took: 3 (base attack) + 2 (physical) + 1 (energy) = 6 damage
    expect(nextState.villain.health).toBe(initialVillainHp - 6);
    // Hero took 1 damage (energy)
    expect(nextState.players[0].health).toBe(initialHeroHp - 1);
    // Hulk was discarded (mental)
    expect(
      nextState.players[0].allies.find((a) => a.instanceId === hulkInst.instanceId),
    ).toBeUndefined();
    expect(nextState.players[0].discard.some((c) => c.instanceId === hulkInst.instanceId)).toBe(
      true,
    );
  });
});
