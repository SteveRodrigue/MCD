import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard, StatusCard } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { initiateEnemyAttack, canPlayCard, peekDecisionPrompt } from '@engine/pipeline';

describe('Feature Delivery: Webbed Up (01009) & Host Attack Interception (Issue #177)', () => {
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

  it('Test 1: Villain attack cancelled by Webbed Up, Webbed Up discarded to Spider-Man discard pile, Villain gains STUNNED', () => {
    const webbedUpCard = cardCatalog.getCard('01009')!;
    const webbedUpInst = createCardInstance(webbedUpCard, 'p1');
    state.villain.attachments = [webbedUpInst];

    const initialHp = state.players[0].health;
    const initialEncounterDiscard = state.encounterDiscard.length;

    const nextState = initiateEnemyAttack(state, { type: 'VILLAIN' }, 'p1');

    // Webbed Up discarded from villain
    expect(nextState.villain.attachments).not.toContain(webbedUpInst);
    // Discarded to Spider-Man's discard pile
    expect(nextState.players[0].discard.some((c) => c.card.code === '01009')).toBe(true);
    // Villain gains STUNNED
    expect(nextState.villain.statusCards).toContain(StatusCard.STUNNED);
    // Attack cancelled without dealing damage or boost cards
    expect(nextState.players[0].health).toBe(initialHp);
    expect(nextState.encounterDiscard.length).toBe(initialEncounterDiscard);
    expect(peekDecisionPrompt(nextState)).toBeUndefined();
  });

  it('Test 2: Follow-up villain attack cancelled by STUNNED status card', () => {
    const webbedUpCard = cardCatalog.getCard('01009')!;
    const webbedUpInst = createCardInstance(webbedUpCard, 'p1');
    state.villain.attachments = [webbedUpInst];

    // First attack: intercepted by Webbed Up, stuns Rhino
    const s1 = initiateEnemyAttack(state, { type: 'VILLAIN' }, 'p1');
    expect(s1.villain.statusCards).toContain(StatusCard.STUNNED);

    const initialHp = s1.players[0].health;
    const initialEncounterDiscard = s1.encounterDiscard.length;

    // Second attack: intercepted by STUNNED status card
    const s2 = initiateEnemyAttack(s1, { type: 'VILLAIN' }, 'p1');

    // Stun consumed
    expect(s2.villain.statusCards).not.toContain(StatusCard.STUNNED);
    // Attack cancelled
    expect(s2.players[0].health).toBe(initialHp);
    expect(s2.encounterDiscard.length).toBe(initialEncounterDiscard);
    expect(peekDecisionPrompt(s2)).toBeUndefined();
  });

  it('Test 3: Pre-existing STUNNED status card on Villain takes timing priority over Webbed Up (Stun cleared, Webbed Up remains attached)', () => {
    const webbedUpCard = cardCatalog.getCard('01009')!;
    const webbedUpInst = createCardInstance(webbedUpCard, 'p1');
    state.villain.attachments = [webbedUpInst];
    state.villain.statusCards = [StatusCard.STUNNED];

    const initialHp = state.players[0].health;

    const nextState = initiateEnemyAttack(state, { type: 'VILLAIN' }, 'p1');

    // Status card priority: Stun was cleared first
    expect(nextState.villain.statusCards).not.toContain(StatusCard.STUNNED);
    // Webbed Up was NOT triggered and remains attached to Rhino
    expect(nextState.villain.attachments).toContain(webbedUpInst);
    expect(nextState.players[0].discard.some((c) => c.card.code === '01009')).toBe(false);
    // Attack cancelled
    expect(nextState.players[0].health).toBe(initialHp);
  });

  it('Test 4: Minion attack cancelled by Webbed Up on Minion, Minion gains STUNNED, Webbed Up discarded', () => {
    const minionCard = cardCatalog.getCard('01101')!; // Hydra Mercenary
    const minionInst = createCardInstance(minionCard);
    const webbedUpCard = cardCatalog.getCard('01009')!;
    const webbedUpInst = createCardInstance(webbedUpCard, 'p1');

    minionInst.attachments = [webbedUpInst];
    state.players[0].engagedMinions = [minionInst];

    const initialHp = state.players[0].health;

    const nextState = initiateEnemyAttack(state, { type: 'MINION', card: minionInst }, 'p1');

    // Webbed Up removed from minion
    expect(minionInst.attachments).not.toContain(webbedUpInst);
    // Discarded to Spider-Man's discard pile
    expect(nextState.players[0].discard.some((c) => c.card.code === '01009')).toBe(true);
    // Minion gained STUNNED
    expect(minionInst.statusCards).toContain(StatusCard.STUNNED);
    // Attack cancelled
    expect(nextState.players[0].health).toBe(initialHp);
  });

  it('Test 5: Max 1 Webbed Up per enemy invariant enforced', () => {
    const webbedUpCard = cardCatalog.getCard('01009')!;
    const webbedUpInst = createCardInstance(webbedUpCard, 'p1');
    state.villain.attachments = [webbedUpInst];

    const newWebbedUp = createCardInstance(webbedUpCard, 'p1');
    const paymentCard1 = createCardInstance(cardCatalog.getCard('01005')!, 'p1');
    const paymentCard2 = createCardInstance(cardCatalog.getCard('01005')!, 'p1');
    const paymentCard3 = createCardInstance(cardCatalog.getCard('01005')!, 'p1');
    const paymentCard4 = createCardInstance(cardCatalog.getCard('01005')!, 'p1');
    state.players[0].hand = [newWebbedUp, paymentCard1, paymentCard2, paymentCard3, paymentCard4];

    // Case A: Only Rhino in play, already has Webbed Up -> unplayable
    const checkA = canPlayCard(state, 'p1', newWebbedUp.instanceId, [
      paymentCard1.instanceId,
      paymentCard2.instanceId,
      paymentCard3.instanceId,
      paymentCard4.instanceId,
    ]);
    expect(checkA.allowed).toBe(false);
    expect(checkA.reason?.toLowerCase()).toContain('all in-play enemies');

    // Case B: An engaged minion enters play with no Webbed Up attached -> now playable!
    const minionCard = cardCatalog.getCard('01101')!;
    const minionInst = createCardInstance(minionCard);
    state.players[0].engagedMinions = [minionInst];

    const checkB = canPlayCard(state, 'p1', newWebbedUp.instanceId, [
      paymentCard1.instanceId,
      paymentCard2.instanceId,
      paymentCard3.instanceId,
      paymentCard4.instanceId,
    ]);
    expect(checkB.allowed).toBe(true);

    // Case C: If specifically targeting Rhino who already has Webbed Up -> rejected
    const checkC = canPlayCard(
      state,
      'p1',
      newWebbedUp.instanceId,
      [
        paymentCard1.instanceId,
        paymentCard2.instanceId,
        paymentCard3.instanceId,
        paymentCard4.instanceId,
      ],
      [],
      'HAND',
      undefined,
      undefined,
      state.villain.instanceId || 'villain',
    );
    expect(checkC.allowed).toBe(false);
    expect(checkC.reason?.toLowerCase()).toContain('already has the maximum number');
  });
});
