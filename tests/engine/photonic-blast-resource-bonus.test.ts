import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import {
  GameState,
  HeroCard,
  AlterEgoCard,
  CardType,
  CardResources,
} from '../../src/engine/models';
import { setupGame } from '../../src/engine/state/game-setup';
import { dispatchAction } from '../../src/engine/pipeline';
import { createCardInstance } from '../../src/engine/state/card-instance';

function makeResources(type: 'physical' | 'energy' | 'mental' | 'wild', count = 1): CardResources {
  return {
    physical: type === 'physical' ? count : 0,
    energy: type === 'energy' ? count : 0,
    mental: type === 'mental' ? count : 0,
    wild: type === 'wild' ? count : 0,
    total: count,
  };
}

describe('Photonic Blast (01013) Resource Bonus Acceptance Test Suite (Issue #204)', () => {
  let state: GameState;
  let captainMarvelHero: HeroCard;
  let carolDanversAlterEgo: AlterEgoCard;

  beforeEach(() => {
    captainMarvelHero = cardCatalog.getCard('01010b') as HeroCard;
    carolDanversAlterEgo = cardCatalog.getCard('01010a') as AlterEgoCard;

    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Carol Danvers',
          hero: captainMarvelHero,
          alterEgo: carolDanversAlterEgo,
          deckCards: Array(15).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = captainMarvelHero;
  });

  it('Pays 2 Physical + 1 Energy: deals 5 damage and draws 1 card', () => {
    const p1 = state.players[0];
    const initialDeckCount = p1.deck.length;
    const initialVillainHp = state.villain.health;

    const pbCard = cardCatalog.getCard('01013')!;
    const pbInstance = createCardInstance(pbCard);

    const physicalCard = cardCatalog.getCard('01005')!;
    const pay1 = createCardInstance({ ...physicalCard, resources: makeResources('physical', 1) });
    const pay2 = createCardInstance({ ...physicalCard, resources: makeResources('physical', 1) });
    const energyCard = cardCatalog.getCard('01014') || cardCatalog.getCard('01005')!;
    const pay3 = createCardInstance({ ...energyCard, resources: makeResources('energy', 1) });

    p1.hand = [pbInstance, pay1, pay2, pay3];

    const res = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: p1.id,
      cardInstanceId: pbInstance.instanceId,
      targetInstanceId: state.villain.instanceId,
      paymentCardInstanceIds: [pay1.instanceId, pay2.instanceId, pay3.instanceId],
    });

    expect(res.result.success).toBe(true);
    expect(res.state.villain.health).toBe(initialVillainHp - 5);
    expect(res.state.players[0].hand.length).toBe(1);
    expect(res.state.players[0].deck.length).toBe(initialDeckCount - 1);
    const drawLog = res.state.log.find((l) => l.key === 'card.effect.drawCards');
    expect(drawLog?.params?.source).toBe('Photonic Blast');
  });

  it('Pays 3 Physical: deals 5 damage and draws 0 cards', () => {
    const p1 = state.players[0];
    const initialDeckCount = p1.deck.length;
    const initialVillainHp = state.villain.health;

    const pbCard = cardCatalog.getCard('01013')!;
    const pbInstance = createCardInstance(pbCard);

    const physicalCard = cardCatalog.getCard('01005')!;
    const pay1 = createCardInstance({ ...physicalCard, resources: makeResources('physical', 1) });
    const pay2 = createCardInstance({ ...physicalCard, resources: makeResources('physical', 1) });
    const pay3 = createCardInstance({ ...physicalCard, resources: makeResources('physical', 1) });

    p1.hand = [pbInstance, pay1, pay2, pay3];

    const res = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: p1.id,
      cardInstanceId: pbInstance.instanceId,
      targetInstanceId: state.villain.instanceId,
      paymentCardInstanceIds: [pay1.instanceId, pay2.instanceId, pay3.instanceId],
    });

    expect(res.result.success).toBe(true);
    expect(res.state.villain.health).toBe(initialVillainHp - 5);
    expect(res.state.players[0].hand.length).toBe(0);
    expect(res.state.players[0].deck.length).toBe(initialDeckCount);
  });

  it('Pays with Energy Absorption (01014) providing 3 Energy: deals 5 damage and draws 1 card', () => {
    const p1 = state.players[0];
    const initialDeckCount = p1.deck.length;
    const initialVillainHp = state.villain.health;

    const pbCard = cardCatalog.getCard('01013')!;
    const pbInstance = createCardInstance(pbCard);

    const eaCard = cardCatalog.getCard('01014')!;
    const eaInstance = createCardInstance(eaCard);

    p1.hand = [pbInstance, eaInstance];

    const res = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: p1.id,
      cardInstanceId: pbInstance.instanceId,
      targetInstanceId: state.villain.instanceId,
      paymentCardInstanceIds: [eaInstance.instanceId],
    });

    expect(res.result.success).toBe(true);
    expect(res.state.villain.health).toBe(initialVillainHp - 5);
    expect(res.state.players[0].hand.length).toBe(1);
    expect(res.state.players[0].deck.length).toBe(initialDeckCount - 1);
    const drawLog = res.state.log.find((l) => l.key === 'card.effect.drawCards');
    expect(drawLog?.params?.source).toBe('Photonic Blast');
  });

  it('Pays with Wild resource: substitutes for Energy, deals 5 damage and draws 1 card', () => {
    const p1 = state.players[0];
    const initialDeckCount = p1.deck.length;
    const initialVillainHp = state.villain.health;

    const pbCard = cardCatalog.getCard('01013')!;
    const pbInstance = createCardInstance(pbCard);

    const card = cardCatalog.getCard('01005')!;
    const pay1 = createCardInstance({ ...card, resources: makeResources('physical', 1) });
    const pay2 = createCardInstance({ ...card, resources: makeResources('physical', 1) });
    const pay3 = createCardInstance({ ...card, resources: makeResources('wild', 1) });

    p1.hand = [pbInstance, pay1, pay2, pay3];

    const res = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: p1.id,
      cardInstanceId: pbInstance.instanceId,
      targetInstanceId: state.villain.instanceId,
      paymentCardInstanceIds: [pay1.instanceId, pay2.instanceId, pay3.instanceId],
    });

    expect(res.result.success).toBe(true);
    expect(res.state.villain.health).toBe(initialVillainHp - 5);
    expect(res.state.players[0].hand.length).toBe(1);
    expect(res.state.players[0].deck.length).toBe(initialDeckCount - 1);
    const drawLogWild = res.state.log.find((l) => l.key === 'card.effect.drawCards');
    expect(drawLogWild?.params?.source).toBe('Photonic Blast');
  });

  it('Preserves resourcesSpent across enemy target selection decision prompt', () => {
    const p1 = state.players[0];
    const initialDeckCount = p1.deck.length;
    const initialVillainHp = state.villain.health;

    // Add a minion to create multiple enemies so a decision prompt is opened
    const minionCard = cardCatalog.getCard('01095')!;
    const minionInstance = createCardInstance(minionCard);
    p1.engagedMinions.push(minionInstance);

    const pbCard = cardCatalog.getCard('01013')!;
    const pbInstance = createCardInstance(pbCard);

    const physicalCard = cardCatalog.getCard('01005')!;
    const pay1 = createCardInstance({ ...physicalCard, resources: makeResources('physical', 1) });
    const pay2 = createCardInstance({ ...physicalCard, resources: makeResources('physical', 1) });
    const energyCard = cardCatalog.getCard('01014') || cardCatalog.getCard('01005')!;
    const pay3 = createCardInstance({ ...energyCard, resources: makeResources('energy', 1) });

    p1.hand = [pbInstance, pay1, pay2, pay3];

    // Play card without targetInstanceId -> opens decision prompt
    const playRes = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: p1.id,
      cardInstanceId: pbInstance.instanceId,
      paymentCardInstanceIds: [pay1.instanceId, pay2.instanceId, pay3.instanceId],
    });

    expect(playRes.result.success).toBe(true);
    expect(playRes.state.pendingDecisionQueue?.length).toBeGreaterThan(0);

    // Resolve decision prompt choosing the villain
    const resolveRes = dispatchAction(playRes.state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: p1.id,
      selectedOptionId: state.villain.instanceId!,
    });

    expect(resolveRes.result.success).toBe(true);
    expect(resolveRes.state.villain.health).toBe(initialVillainHp - 5);
    expect(resolveRes.state.players[0].hand.length).toBe(1);
    expect(resolveRes.state.players[0].deck.length).toBe(initialDeckCount - 1);
    const drawLogPrompt = resolveRes.state.log.find((l) => l.key === 'card.effect.drawCards');
    expect(drawLogPrompt?.params?.source).toBe('Photonic Blast');
  });

  it('Pays with 2 Physical hand cards + 1 Tableau Energy generator: deals 5 damage and draws 1 card', () => {
    const p1 = state.players[0];
    const initialDeckCount = p1.deck.length;
    const initialVillainHp = state.villain.health;

    // Create a tableau energy generator
    const generatorCard = {
      ...cardCatalog.getCard('01005')!,
      code: 'gen_energy_test',
      name: 'Energy Generator',
      type: CardType.UPGRADE,
      enrichment: {
        abilities: [
          {
            id: 'gen_energy_ab',
            timing: 'RESOURCE',
            steps: [
              {
                effect: 'GENERATE_RESOURCE',
                effectParams: {
                  resource: 'energy',
                  amount: 1,
                },
              },
            ],
          },
        ],
      },
    };
    const genInstance = createCardInstance(generatorCard as any);
    p1.tableau.push(genInstance);

    const pbCard = cardCatalog.getCard('01013')!;
    const pbInstance = createCardInstance(pbCard);

    const physicalCard = cardCatalog.getCard('01005')!;
    const pay1 = createCardInstance({ ...physicalCard, resources: makeResources('physical', 1) });
    const pay2 = createCardInstance({ ...physicalCard, resources: makeResources('physical', 1) });

    p1.hand = [pbInstance, pay1, pay2];

    const res = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: p1.id,
      cardInstanceId: pbInstance.instanceId,
      targetInstanceId: state.villain.instanceId,
      paymentCardInstanceIds: [pay1.instanceId, pay2.instanceId],
      generatorInstanceIds: [genInstance.instanceId],
    });

    expect(res.result.success).toBe(true);
    expect(res.state.villain.health).toBe(initialVillainHp - 5);
    expect(res.state.players[0].hand.length).toBe(1);
    expect(res.state.players[0].deck.length).toBe(initialDeckCount - 1);
    const drawLogGen = res.state.log.find((l) => l.key === 'card.effect.drawCards');
    expect(drawLogGen?.params?.source).toBe('Photonic Blast');
    expect(
      res.state.players[0].tableau.find((c) => c.instanceId === genInstance.instanceId)?.exhausted,
    ).toBe(true);
  });
});
