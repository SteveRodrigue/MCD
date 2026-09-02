import { describe, it, expect, beforeEach } from 'vitest';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { CardType, Keyword, NormalizedCard } from '@engine/models';
import {
  canPlayCard,
  getPlayerRestrictedLimit,
  getPlayerRestrictedCount,
  getCardRestrictedWeight,
} from '@engine/pipeline/legality-checker';
import { dispatchAction } from '@engine/pipeline/action-dispatcher';

describe('Restricted Keyword Limit & Replacement Prompt Engine (RR v1.8 p. 25, ADR-0018, ADR-0032)', () => {
  let spiderManHero: any;
  let peterParkerAlterEgo: any;
  let rhinoVillain: any;
  let mainScheme: any;
  let restrictedCard: NormalizedCard;

  beforeEach(() => {
    spiderManHero = cardCatalog.getCard('01001a')!;
    peterParkerAlterEgo = cardCatalog.getCard('01001b')!;
    rhinoVillain = cardCatalog.getCard('01094')!;
    mainScheme = cardCatalog.getCard('01097')!;
    restrictedCard = {
      ...cardCatalog.getCard('01005')!,
      code: 'plasma_gun_01',
      name: 'Plasma Gun',
      type: CardType.UPGRADE,
      keywords: [Keyword.RESTRICTED],
      text: 'Restricted.',
      cost: 1,
    };
  });

  it('allows playing up to base limit of 2 restricted cards directly into tableau', () => {
    const paymentCard = cardCatalog.getCard('01005')!;

    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: [restrictedCard, restrictedCard, paymentCard, paymentCard, paymentCard],
        },
      ],
      villain: rhinoVillain,
      mainScheme,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    state.players[0].currentForm = 'hero';

    // 1. Play 1st Restricted Card
    const r1 = createCardInstance(restrictedCard);
    const pay1 = createCardInstance(paymentCard);
    state.players[0].hand = [r1, pay1];

    const res1 = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardInstanceId: r1.instanceId,
      paymentCardInstanceIds: [pay1.instanceId],
    });

    expect(res1.result.success).toBe(true);
    expect(res1.state.players[0].tableau.length).toBe(1);
    expect(getPlayerRestrictedCount(res1.state.players[0])).toBe(1);

    // 2. Play 2nd Restricted Card
    const r2 = createCardInstance(restrictedCard);
    const pay2 = createCardInstance(paymentCard);
    res1.state.players[0].hand = [r2, pay2];

    const res2 = dispatchAction(res1.state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardInstanceId: r2.instanceId,
      paymentCardInstanceIds: [pay2.instanceId],
    });

    expect(res2.result.success).toBe(true);
    expect(res2.state.players[0].tableau.length).toBe(2);
    expect(getPlayerRestrictedCount(res2.state.players[0])).toBe(2);
    expect(res2.state.pendingDecisionPrompt).toBeUndefined();
  });

  it('enqueues an interactive DISCARD_RESTRICTED decision prompt when playing a 3rd restricted card at limit 2', () => {
    const paymentCard = cardCatalog.getCard('01005')!;

    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: [restrictedCard, paymentCard, paymentCard],
        },
      ],
      villain: rhinoVillain,
      mainScheme,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    state.players[0].currentForm = 'hero';

    // Player already has 2 Restricted cards in play
    const existingR1 = createCardInstance(restrictedCard);
    const existingR2 = createCardInstance(restrictedCard);
    state.players[0].tableau.push(existingR1, existingR2);

    // Player attempts to play a 3rd Restricted Card
    const incomingR3 = createCardInstance(restrictedCard);
    const payCard = createCardInstance(paymentCard);
    state.players[0].hand = [incomingR3, payCard];

    // canPlayCard should be allowed because player can discard to make room
    const legality = canPlayCard(state, 'p1', incomingR3.instanceId, [payCard.instanceId]);
    expect(legality.allowed).toBe(true);

    const playRes = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardInstanceId: incomingR3.instanceId,
      paymentCardInstanceIds: [payCard.instanceId],
    });

    expect(playRes.result.success).toBe(true);
    expect(playRes.state.pendingDecisionPrompt).toBeDefined();
    expect(playRes.state.pendingDecisionPrompt?.sourceCardName).toBe('Plasma Gun');
    expect(playRes.state.pendingDecisionPrompt?.options.length).toBe(3); // 2 in-play cards + 1 Cancel

    const optionIds = playRes.state.pendingDecisionPrompt!.options.map((o) => o.id);
    expect(optionIds).toContain(existingR1.instanceId);
    expect(optionIds).toContain(existingR2.instanceId);
    expect(optionIds).toContain('cancel_play');
  });

  it('discards the selected restricted card and puts incoming card into play upon prompt resolution', () => {
    const paymentCard = cardCatalog.getCard('01005')!;

    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: [restrictedCard, paymentCard, paymentCard],
        },
      ],
      villain: rhinoVillain,
      mainScheme,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    state.players[0].currentForm = 'hero';

    const existingR1 = createCardInstance(restrictedCard);
    const existingR2 = createCardInstance(restrictedCard);
    state.players[0].tableau.push(existingR1, existingR2);

    const incomingR3 = createCardInstance(restrictedCard);
    const payCard = createCardInstance(paymentCard);
    state.players[0].hand = [incomingR3, payCard];

    // Trigger play
    const playRes = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardInstanceId: incomingR3.instanceId,
      paymentCardInstanceIds: [payCard.instanceId],
    });

    // Player chooses to discard existingR1
    const resolveRes = dispatchAction(playRes.state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: existingR1.instanceId,
    });

    expect(resolveRes.result.success).toBe(true);
    expect(resolveRes.state.pendingDecisionPrompt).toBeUndefined();

    // existingR1 should be in discard pile
    expect(
      resolveRes.state.players[0].discard.some((c) => c.instanceId === existingR1.instanceId),
    ).toBe(true);

    // Tableau should contain existingR2 and incomingR3
    const tableauIds = resolveRes.state.players[0].tableau.map((c) => c.instanceId);
    expect(tableauIds).not.toContain(existingR1.instanceId);
    expect(tableauIds).toContain(existingR2.instanceId);
    expect(tableauIds).toContain(incomingR3.instanceId);
    expect(getPlayerRestrictedCount(resolveRes.state.players[0])).toBe(2);
  });

  it('cancels the play action cleanly when player selects Cancel, returning cards to hand', () => {
    const paymentCard = cardCatalog.getCard('01005')!;

    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: [restrictedCard, paymentCard, paymentCard],
        },
      ],
      villain: rhinoVillain,
      mainScheme,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    state.players[0].currentForm = 'hero';

    const existingR1 = createCardInstance(restrictedCard);
    const existingR2 = createCardInstance(restrictedCard);
    state.players[0].tableau.push(existingR1, existingR2);

    const incomingR3 = createCardInstance(restrictedCard);
    const payCard = createCardInstance(paymentCard);
    state.players[0].hand = [incomingR3, payCard];

    // Trigger play
    const playRes = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardInstanceId: incomingR3.instanceId,
      paymentCardInstanceIds: [payCard.instanceId],
    });

    // Player chooses Cancel
    const cancelRes = dispatchAction(playRes.state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: 'cancel_play',
    });

    expect(cancelRes.result.success).toBe(true);
    expect(cancelRes.state.pendingDecisionPrompt).toBeUndefined();

    // Both cards should remain in hand
    expect(
      cancelRes.state.players[0].hand.some((c) => c.instanceId === incomingR3.instanceId),
    ).toBe(true);
    expect(cancelRes.state.players[0].hand.some((c) => c.instanceId === payCard.instanceId)).toBe(
      true,
    );

    // Tableau should remain unchanged with 2 Restricted cards
    expect(cancelRes.state.players[0].tableau.length).toBe(2);
    expect(getPlayerRestrictedCount(cancelRes.state.players[0])).toBe(2);
  });

  it('supports dynamic limit bonuses (e.g. Side Holster granting +1 restricted slot)', () => {
    const sideHolsterCard: NormalizedCard = {
      ...cardCatalog.getCard('01005')!,
      code: 'side_holster_custom',
      name: 'Side Holster',
      type: CardType.UPGRADE,
      isUnique: false,
      text: 'You get +1 restricted slot.',
      enrichment: {
        abilities: [
          {
            id: 'side_holster_limit',
            timing: 'CONSTANT',
            steps: [
              {
                effect: 'RESTRICTED_LIMIT_BONUS',
                params: { amount: 1 },
              },
            ],
          },
        ],
      },
    };

    const paymentCard = cardCatalog.getCard('01005')!;

    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: [restrictedCard, paymentCard, paymentCard],
        },
      ],
      villain: rhinoVillain,
      mainScheme,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    state.players[0].currentForm = 'hero';

    // Player controls Side Holster (+1 slot -> limit is 3) and 2 Restricted cards
    state.players[0].tableau.push(
      createCardInstance(sideHolsterCard),
      createCardInstance(restrictedCard),
      createCardInstance(restrictedCard),
    );

    expect(getPlayerRestrictedLimit(state, 'p1')).toBe(3);
    expect(getPlayerRestrictedCount(state.players[0])).toBe(2);

    // Player can play a 3rd Restricted card without triggering a prompt
    const incomingR3 = createCardInstance(restrictedCard);
    const payCard = createCardInstance(paymentCard);
    state.players[0].hand = [incomingR3, payCard];

    const playRes = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardInstanceId: incomingR3.instanceId,
      paymentCardInstanceIds: [payCard.instanceId],
    });

    expect(playRes.result.success).toBe(true);
    expect(playRes.state.pendingDecisionPrompt).toBeUndefined();
    expect(getPlayerRestrictedCount(playRes.state.players[0])).toBe(3);
  });

  it('correctly calculates heavy item slot weight (counts as 2 restricted cards)', () => {
    const heavyWeapon: NormalizedCard = {
      ...cardCatalog.getCard('01005')!,
      code: 'heavy_bazooka',
      name: 'Heavy Bazooka',
      type: CardType.UPGRADE,
      keywords: [Keyword.RESTRICTED],
      text: 'Restricted. Counts as 2 restricted cards.',
    };

    expect(getCardRestrictedWeight(heavyWeapon)).toBe(2);
  });
});
