import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard, CardInstance } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { dispatchAction } from '@engine/pipeline';
import { dispatchTrigger } from '@engine/triggers/trigger-dispatcher';
import { StatusCard } from '@engine/models';

describe('Event Intrinsic Discard Lifecycle (Issue #271 / RR v1.8 Event)', () => {
  let state: GameState;

  const player = (id: string, hero: string, alterEgo: string) => ({
    id,
    name: id,
    hero: cardCatalog.getCard(hero) as HeroCard,
    alterEgo: cardCatalog.getCard(alterEgo) as AlterEgoCard,
    deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
  });

  beforeEach(() => {
    state = setupGame({
      catalog: cardCatalog,
      scenarioId: 'rhino',
      players: [player('p1', '01001a', '01001b'), player('p2', '01010a', '01010b')],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
    for (const p of state.players) {
      p.currentForm = 'hero';
      p.activeFormCard = p.hero;
    }
    state.mainScheme.threat = 5;
  });

  const card = (code: string, owner = 'p1'): CardInstance =>
    createCardInstance(cardCatalog.getCard(code)!, owner);

  const minion = (code = '01110'): CardInstance => createCardInstance(cardCatalog.getCard(code)!); // 01110: 1 HP

  const prompts = () => state.pendingDecisionQueue ?? [];

  const answer = (playerId: string, optionId: string, options?: any) => {
    const res = dispatchAction(state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId,
      selectedOptionId: optionId,
      paymentCardInstanceIds: options?.paymentCardInstanceIds,
      generatorInstanceIds: options?.generatorInstanceIds,
    });
    state = res.state;
    return res;
  };

  it('1. Backflip (01003): prevents damage via prompt and ends in discard without cost.discardSelf', () => {
    const backflip = card('01003');
    state.players[0].hand = [backflip];
    state.players[0].health = 10;

    const res = dispatchTrigger(state, 'DAMAGE_WOULD_BE_TAKEN', {
      targetPlayerId: 'p1',
      damageAmount: 3,
      damageSource: 'ATTACK',
    });

    expect(res.hasPendingPrompt).toBe(true);
    const p = prompts().find((pr) => pr.sourceCardCode === '01003');
    expect(p).toBeDefined();

    answer('p1', 'trigger_backflip');

    expect(state.players[0].hand.map((c) => c.instanceId)).not.toContain(backflip.instanceId);
    expect(state.players[0].discard.map((c) => c.instanceId)).toContain(backflip.instanceId);
  });

  it('2. Enhanced Spider-Sense (01004): cancels When Revealed via prompt with payment and discards', () => {
    const spiderSense = card('01004');
    const payCard = card('01005');
    const falseAlarm = card('01112');
    state.players[0].hand = [spiderSense, payCard];

    state.activeEncounterContext = {
      encounterInstanceId: falseAlarm.instanceId,
      encounterCard: falseAlarm,
      targetPlayerId: 'p1',
    };

    const res = dispatchTrigger(state, 'ENCOUNTER_CARD_REVEALED', {
      targetPlayerId: 'p1',
      encounterCardInstance: falseAlarm,
    });

    expect(res.hasPendingPrompt).toBe(true);
    const p = prompts().find((pr) => pr.sourceCardCode === '01004');
    expect(p).toBeDefined();

    answer('p1', 'trigger_enhanced_spider_sense', {
      paymentCardInstanceIds: [payCard.instanceId],
    });

    expect(state.players[0].statusCards).not.toContain(StatusCard.CONFUSED);
    expect(state.encounterDiscard.map((c) => c.instanceId)).toContain(falseAlarm.instanceId);
    expect(state.players[0].hand.map((c) => c.instanceId)).not.toContain(spiderSense.instanceId);
    expect(state.players[0].discard.map((c) => c.instanceId)).toContain(spiderSense.instanceId);
  });

  it('3. One-Two Punch (01024): readies She-Hulk via prompt with payment and discards', () => {
    // She-Hulk is p2 (01010a)
    const punch = card('01024', 'p2');
    const payCard = card('01005', 'p2');
    state.players[1].hand = [punch, payCard];
    state.players[1].exhausted = true;

    const res = dispatchTrigger(state, 'BASIC_ATTACK_PERFORMED', {
      targetPlayerId: 'p2',
    });

    expect(res.hasPendingPrompt).toBe(true);
    const p = prompts().find((pr) => pr.sourceCardCode === '01024');
    expect(p).toBeDefined();

    answer('p2', 'trigger_one_two_punch_response', {
      paymentCardInstanceIds: [payCard.instanceId],
    });

    expect(state.players[1].exhausted).toBe(false);
    expect(state.players[1].hand.map((c) => c.instanceId)).not.toContain(punch.instanceId);
    expect(state.players[1].discard.map((c) => c.instanceId)).toContain(punch.instanceId);
  });

  it('4. Chase Them Down (01052): single scheme removes threat and discards', () => {
    const chase = card('01052');
    state.players[0].hand = [chase];
    const m = minion();
    state.players[0].engagedMinions = [m];

    state = dispatchAction(state, {
      type: 'BASIC_ATTACK',
      playerId: 'p1',
      targetType: 'minion',
      targetInstanceId: m.instanceId,
    }).state;

    const p = prompts().find((pr) => pr.sourceCardCode === '01052');
    expect(p).toBeDefined();

    answer('p1', 'trigger_chase_them_down');

    expect(state.mainScheme.threat).toBe(3);
    expect(state.players[0].hand.map((c) => c.instanceId)).not.toContain(chase.instanceId);
    expect(state.players[0].discard.map((c) => c.instanceId)).toContain(chase.instanceId);
  });

  it('5. Chase Them Down (01052): multi-scheme pauses on target choice without leaving card in hand, then discards', () => {
    const chase = card('01052');
    state.players[0].hand = [chase];

    // Add a side scheme so there are 2 schemes in play
    const sideSchemeCard = cardCatalog.getCard('01109') as any; // The Crowd Groans
    state.sideSchemes = [
      {
        instanceId: 'side_1',
        card: sideSchemeCard,
        threat: 3,
      },
    ];

    const m = minion();
    state.players[0].engagedMinions = [m];

    // Defeat minion via basic attack
    state = dispatchAction(state, {
      type: 'BASIC_ATTACK',
      playerId: 'p1',
      targetType: 'minion',
      targetInstanceId: m.instanceId,
    }).state;

    // Accept Chase Them Down optional prompt
    const chasePrompt = prompts().find((pr) => pr.sourceCardCode === '01052');
    expect(chasePrompt).toBeDefined();

    answer('p1', 'trigger_chase_them_down');

    // RR v1.8 Event: While choosing target scheme, Chase Them Down MUST NOT remain in hand!
    expect(state.players[0].hand.map((c) => c.instanceId)).not.toContain(chase.instanceId);

    // Verify scheme choice prompt is enqueued
    const schemePrompt = prompts().find((pr) => pr.title.includes('Choose a Scheme'));
    expect(schemePrompt).toBeDefined();

    // Select the side scheme
    answer('p1', 'side_1');

    // Threat removed from chosen side scheme
    expect(state.sideSchemes[0].threat).toBe(1);
    // Chase Them Down is now in discard pile
    expect(state.players[0].discard.map((c) => c.instanceId)).toContain(chase.instanceId);
  });

  it('6. Great Responsibility (01061): converts threat to damage via prompt and discards', () => {
    const greatResp = card('01061');
    state.players[0].hand = [greatResp];
    state.players[0].health = 10;
    const initialThreat = state.mainScheme.threat;

    const res = dispatchTrigger(state, 'THREAT_WOULD_BE_PLACED', {
      targetPlayerId: 'p1',
      threatAmount: 2,
    });

    expect(res.hasPendingPrompt).toBe(true);
    const p = prompts().find((pr) => pr.sourceCardCode === '01061');
    expect(p).toBeDefined();

    answer('p1', 'trigger_great_responsibility_interrupt');

    expect(state.mainScheme.threat).toBe(initialThreat);
    expect(state.players[0].health).toBe(8);
    expect(state.players[0].hand.map((c) => c.instanceId)).not.toContain(greatResp.instanceId);
    expect(state.players[0].discard.map((c) => c.instanceId)).toContain(greatResp.instanceId);
  });

  it('7. Counter-Punch (01077): damages enemy after defending and discards', () => {
    const counterPunch = card('01077');
    state.players[0].hand = [counterPunch];
    const m = minion('01101'); // 3 HP
    state.players[0].engagedMinions = [m];

    const res = dispatchTrigger(state, 'ATTACK_DEFENDED', {
      targetPlayerId: 'p1',
      defenderType: 'HERO',
      targetInstanceId: m.instanceId,
    });

    expect(res.hasPendingPrompt).toBe(true);
    const p = prompts().find((pr) => pr.sourceCardCode === '01077');
    expect(p).toBeDefined();

    answer('p1', 'trigger_counter_punch_response');

    expect(state.players[0].engagedMinions[0].tokens?.damage).toBe(state.players[0].hero.attack);
    expect(state.players[0].hand.map((c) => c.instanceId)).not.toContain(counterPunch.instanceId);
    expect(state.players[0].discard.map((c) => c.instanceId)).toContain(counterPunch.instanceId);
  });

  it('8. Get Behind Me! (01078): cancels treachery, triggers villain attack, and discards', () => {
    const getBehindMe = card('01078');
    const payCard = card('01005');
    const falseAlarm = card('01112');
    state.players[0].hand = [getBehindMe, payCard];

    state.activeEncounterContext = {
      encounterInstanceId: falseAlarm.instanceId,
      encounterCard: falseAlarm,
      targetPlayerId: 'p1',
    };

    const res = dispatchTrigger(state, 'ENCOUNTER_CARD_REVEALED', {
      targetPlayerId: 'p1',
      encounterCardInstance: falseAlarm,
    });

    expect(res.hasPendingPrompt).toBe(true);
    const p = prompts().find((pr) => pr.sourceCardCode === '01078');
    expect(p).toBeDefined();

    answer('p1', 'trigger_get_behind_me_interrupt', {
      paymentCardInstanceIds: [payCard.instanceId],
    });

    expect(state.players[0].statusCards).not.toContain(StatusCard.CONFUSED);
    expect(state.encounterDiscard.map((c) => c.instanceId)).toContain(falseAlarm.instanceId);
    expect(state.players[0].hand.map((c) => c.instanceId)).not.toContain(getBehindMe.instanceId);
    expect(state.players[0].discard.map((c) => c.instanceId)).toContain(getBehindMe.instanceId);
  });

  it('9. Emergency (01085): reduces threat via prompt and discards', () => {
    const emergency = card('01085');
    state.players[0].hand = [emergency];

    const res = dispatchTrigger(state, 'THREAT_WOULD_BE_PLACED', {
      targetPlayerId: 'p1',
      threatAmount: 2,
      threatSource: 'VILLAIN_SCHEME',
    });

    expect(res.hasPendingPrompt).toBe(true);
    const p = prompts().find((pr) => pr.sourceCardCode === '01085');
    expect(p).toBeDefined();

    answer('p1', 'trigger_emergency_interrupt');

    expect(state.players[0].hand.map((c) => c.instanceId)).not.toContain(emergency.instanceId);
    expect(state.players[0].discard.map((c) => c.instanceId)).toContain(emergency.instanceId);
  });

  it('10. Canceled effects still discard the event card per RR v1.8 Event (Confused cancels Chase Them Down)', () => {
    const chase = card('01052');
    state.players[0].hand = [chase];
    state.players[0].statusCards = [StatusCard.CONFUSED];

    const m = minion();
    state.players[0].engagedMinions = [m];

    state = dispatchAction(state, {
      type: 'BASIC_ATTACK',
      playerId: 'p1',
      targetType: 'minion',
      targetInstanceId: m.instanceId,
    }).state;

    const p = prompts().find((pr) => pr.sourceCardCode === '01052');
    expect(p).toBeDefined();

    answer('p1', 'trigger_chase_them_down');

    // Confused was consumed
    expect(state.players[0].statusCards).not.toContain(StatusCard.CONFUSED);
    // Main scheme threat was NOT reduced
    expect(state.mainScheme.threat).toBe(5);
    // Even though effect was canceled, event card was played and is in discard!
    expect(state.players[0].hand.map((c) => c.instanceId)).not.toContain(chase.instanceId);
    expect(state.players[0].discard.map((c) => c.instanceId)).toContain(chase.instanceId);
  });

  it('11. Non-events with cost.discardSelf (Cosmic Flight 01017) still discard as cost from tableau', () => {
    const cosmicFlight = card('01017', 'p2');
    state.players[1].tableau = [cosmicFlight];
    state.players[1].health = 10;

    const res = dispatchTrigger(state, 'DAMAGE_WOULD_BE_TAKEN', {
      targetPlayerId: 'p2',
      damageAmount: 5,
    });

    expect(res.hasPendingPrompt).toBe(true);
    const p = prompts().find((pr) => pr.sourceCardCode === '01017');
    expect(p).toBeDefined();

    answer('p2', 'trigger_cosmic_flight_prevent');

    // Upgraded was discarded from tableau
    expect(state.players[1].tableau.map((c) => c.instanceId)).not.toContain(
      cosmicFlight.instanceId,
    );
    expect(state.players[1].discard.map((c) => c.instanceId)).toContain(cosmicFlight.instanceId);
  });
});
