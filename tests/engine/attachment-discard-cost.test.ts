import { describe, it, expect, beforeEach } from 'vitest';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { dispatchAction } from '../../src/engine/pipeline/action-dispatcher';
import { getLegalActionsForPlayer } from '../../src/engine/pipeline/legal-actions-generator';
import { getEffectiveVillainStats } from '../../src/engine/pipeline/stat-calculator';
import { CardInstance, GameState } from '../../src/engine/models';

describe('Attachment Discard Cost & Form Validation (Issue #108 / ADR-0055)', () => {
  let state: GameState;
  let spiderManHero: any;
  let peterParkerAlterEgo: any;
  let rhinoVillain: any;
  let mainScheme: any;

  beforeEach(() => {
    spiderManHero = cardCatalog.getCard('01001a')!;
    peterParkerAlterEgo = cardCatalog.getCard('01001b')!;
    rhinoVillain = cardCatalog.getCard('01094')!;
    mainScheme = cardCatalog.getCard('01097')!;

    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: [cardCatalog.getCard('01005')!, cardCatalog.getCard('01005')!],
        },
      ],
      villain: rhinoVillain,
      mainScheme,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
  });

  it('1. Free discard rejection: rejects USE_CARD_ABILITY if paymentCardInstanceIds is omitted or empty', () => {
    const player = state.players[0];
    player.currentForm = 'hero';
    player.activeFormCard = spiderManHero;
    player.hand = [];

    const hornCard = cardCatalog.getCard('01100')!;
    const hornInstance: CardInstance = createCardInstance(hornCard);
    state.villain.attachments = [hornInstance];

    const res = dispatchAction(state, {
      type: 'USE_CARD_ABILITY',
      playerId: 'p1',
      cardInstanceId: hornInstance.instanceId,
      abilityId: 'ivory_horn_discard_action',
    });

    expect(res.result.success).toBe(false);
    expect(res.result.error).toMatch(/payment cards|insufficient resources/i);
    expect(res.state.villain.attachments.length).toBe(1);
    expect(res.state.villain.attachments[0].instanceId).toBe(hornInstance.instanceId);
  });

  it('2. Wrong resource type rejection: rejects when energy resources are provided instead of physical', () => {
    const player = state.players[0];
    player.currentForm = 'hero';
    player.activeFormCard = spiderManHero;

    // Energy Absorption (01014) provides 3 energy icons
    const energyCard = createCardInstance(cardCatalog.getCard('01014')!);
    player.hand = [energyCard];

    const hornCard = cardCatalog.getCard('01100')!;
    const hornInstance: CardInstance = createCardInstance(hornCard);
    state.villain.attachments = [hornInstance];

    const res = dispatchAction(state, {
      type: 'USE_CARD_ABILITY',
      playerId: 'p1',
      cardInstanceId: hornInstance.instanceId,
      abilityId: 'ivory_horn_discard_action',
      paymentCardInstanceIds: [energyCard.instanceId],
    });

    expect(res.result.success).toBe(false);
    expect(res.result.error).toMatch(/insufficient.*physical/i);
    expect(res.state.villain.attachments.length).toBe(1);
  });

  it('3. Form restriction rejection: rejects Hero Action when in Alter-Ego form', () => {
    const player = state.players[0];
    player.currentForm = 'alter_ego';
    player.activeFormCard = peterParkerAlterEgo;

    // 3 physical resource cards
    const phys1 = createCardInstance(cardCatalog.getCard('01003')!); // Backflip (1 physical)
    const phys2 = createCardInstance(cardCatalog.getCard('01003')!);
    const phys3 = createCardInstance(cardCatalog.getCard('01003')!);
    player.hand = [phys1, phys2, phys3];

    const hornCard = cardCatalog.getCard('01100')!;
    const hornInstance: CardInstance = createCardInstance(hornCard);
    state.villain.attachments = [hornInstance];

    const res = dispatchAction(state, {
      type: 'USE_CARD_ABILITY',
      playerId: 'p1',
      cardInstanceId: hornInstance.instanceId,
      abilityId: 'ivory_horn_discard_action',
      paymentCardInstanceIds: [phys1.instanceId, phys2.instanceId, phys3.instanceId],
    });

    expect(res.result.success).toBe(false);
    expect(res.result.error).toMatch(/hero form/i);
    expect(res.state.villain.attachments.length).toBe(1);
  });

  it('4. Successful discard via USE_CARD_ABILITY with selected physical resources: removes horn and reduces ATK', () => {
    const player = state.players[0];
    player.currentForm = 'hero';
    player.activeFormCard = spiderManHero;

    const phys1 = createCardInstance(cardCatalog.getCard('01003')!);
    const phys2 = createCardInstance(cardCatalog.getCard('01003')!);
    const phys3 = createCardInstance(cardCatalog.getCard('01003')!);
    player.hand = [phys1, phys2, phys3];

    const hornCard = cardCatalog.getCard('01100')!;
    const hornInstance: CardInstance = createCardInstance(hornCard);
    state.villain.attachments = [hornInstance];

    // Base 2 + 1 horn = 3 ATK
    expect(getEffectiveVillainStats(state, state.villain).attack).toBe(3);

    const res = dispatchAction(state, {
      type: 'USE_CARD_ABILITY',
      playerId: 'p1',
      cardInstanceId: hornInstance.instanceId,
      abilityId: 'ivory_horn_discard_action',
      paymentCardInstanceIds: [phys1.instanceId, phys2.instanceId, phys3.instanceId],
    });

    expect(res.result.success).toBe(true);
    expect(res.state.villain.attachments.length).toBe(0);
    expect(res.state.encounterDiscard.some((c) => c.card.code === '01100')).toBe(true);
    // Paid cards should be in player's discard
    expect(res.state.players[0].hand.length).toBe(0);
    expect(res.state.players[0].discard.length).toBe(3);
    // Effective ATK should return to base 2
    expect(getEffectiveVillainStats(res.state, res.state.villain).attack).toBe(2);
  });

  it('5. Wild resource satisfaction: wild resources cover physical requirement', () => {
    const player = state.players[0];
    player.currentForm = 'hero';
    player.activeFormCard = spiderManHero;

    const physCard = createCardInstance(cardCatalog.getCard('01003')!); // Backflip (1 physical)
    const wildCard1 = createCardInstance({
      ...cardCatalog.getCard('01003')!,
      code: 'test_wild_1',
      resources: { physical: 0, energy: 0, mental: 0, wild: 1, total: 1 },
    });
    const wildCard2 = createCardInstance({
      ...cardCatalog.getCard('01003')!,
      code: 'test_wild_2',
      resources: { physical: 0, energy: 0, mental: 0, wild: 1, total: 1 },
    });
    player.hand = [physCard, wildCard1, wildCard2];

    const hornCard = cardCatalog.getCard('01100')!;
    const hornInstance: CardInstance = createCardInstance(hornCard);
    state.villain.attachments = [hornInstance];

    const res = dispatchAction(state, {
      type: 'USE_CARD_ABILITY',
      playerId: 'p1',
      cardInstanceId: hornInstance.instanceId,
      abilityId: 'ivory_horn_discard_action',
      paymentCardInstanceIds: [physCard.instanceId, wildCard1.instanceId, wildCard2.instanceId],
    });

    expect(res.result.success).toBe(true);
    expect(res.state.villain.attachments.length).toBe(0);
    expect(res.state.players[0].hand.length).toBe(0);
    expect(res.state.players[0].discard.length).toBe(3);
  });

  it('5b. Multi-resource card satisfaction: Strength (01090) provides 2 physical resources', () => {
    const player = state.players[0];
    player.currentForm = 'hero';
    player.activeFormCard = spiderManHero;

    const strengthCard = createCardInstance(cardCatalog.getCard('01090')!); // Strength (2 physical)
    const physCard = createCardInstance(cardCatalog.getCard('01003')!); // Backflip (1 physical)
    player.hand = [strengthCard, physCard];

    const hornCard = cardCatalog.getCard('01100')!;
    const hornInstance: CardInstance = createCardInstance(hornCard);
    state.villain.attachments = [hornInstance];

    const res = dispatchAction(state, {
      type: 'USE_CARD_ABILITY',
      playerId: 'p1',
      cardInstanceId: hornInstance.instanceId,
      abilityId: 'ivory_horn_discard_action',
      paymentCardInstanceIds: [strengthCard.instanceId, physCard.instanceId],
    });

    expect(res.result.success).toBe(true);
    expect(res.state.villain.attachments.length).toBe(0);
    expect(res.state.players[0].hand.length).toBe(0);
    expect(res.state.players[0].discard.length).toBe(2);
  });

  it('6. Legal actions generator: surfaces USE_CARD_ABILITY with requiresModal: payment only when affordable in Hero form', () => {
    const player = state.players[0];
    player.currentForm = 'hero';
    player.activeFormCard = spiderManHero;

    const hornCard = cardCatalog.getCard('01100')!;
    const hornInstance: CardInstance = createCardInstance(hornCard);
    state.villain.attachments = [hornInstance];

    // Case A: Insufficient resources -> action should NOT be surfaced
    player.hand = [createCardInstance(cardCatalog.getCard('01003')!)]; // Only 1 physical resource
    let legalReport = getLegalActionsForPlayer(state, 'p1');
    let hornAction = legalReport.allActions.find(
      (a) =>
        a.action.type === 'USE_CARD_ABILITY' &&
        (a.action as any).cardInstanceId === hornInstance.instanceId,
    );
    expect(hornAction).toBeUndefined();

    // Case B: In Alter-Ego form with sufficient resources -> action should NOT be surfaced
    player.currentForm = 'alter_ego';
    player.activeFormCard = peterParkerAlterEgo;
    player.hand = [
      createCardInstance(cardCatalog.getCard('01003')!),
      createCardInstance(cardCatalog.getCard('01003')!),
      createCardInstance(cardCatalog.getCard('01003')!),
    ];
    legalReport = getLegalActionsForPlayer(state, 'p1');
    hornAction = legalReport.allActions.find(
      (a) =>
        a.action.type === 'USE_CARD_ABILITY' &&
        (a.action as any).cardInstanceId === hornInstance.instanceId,
    );
    expect(hornAction).toBeUndefined();

    // Case C: In Hero form with sufficient resources -> action SHOULD be surfaced with requiresModal: 'payment'
    player.currentForm = 'hero';
    player.activeFormCard = spiderManHero;
    legalReport = getLegalActionsForPlayer(state, 'p1');
    hornAction = legalReport.allActions.find(
      (a) =>
        a.action.type === 'USE_CARD_ABILITY' &&
        (a.action as any).cardInstanceId === hornInstance.instanceId,
    );
    expect(hornAction).toBeDefined();
    expect(hornAction?.requiresModal).toBe('payment');
  });
});
