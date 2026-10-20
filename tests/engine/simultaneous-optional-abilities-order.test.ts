import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard, CardInstance } from '../../src/engine/models';
import { setupGame, createCardInstance } from '../../src/engine/state/game-setup';
import { dispatchAction } from '../../src/engine/pipeline';
import { dispatchTrigger } from '../../src/engine/triggers/trigger-dispatcher';
import { peekDecisionPrompt } from '../../src/engine/pipeline/prompt-queue';
import { step4_revealEncounterCards } from '../../src/engine/pipeline/villain-phase';

describe('Issue #287: Simultaneous Optional Abilities Resolution Order & Reveal Trigger Refactoring', () => {
  let state: GameState;

  const player = (id: string, hero: string, alterEgo: string) => ({
    id,
    name: id,
    hero: cardCatalog.getCard(hero) as HeroCard,
    alterEgo: cardCatalog.getCard(alterEgo) as AlterEgoCard,
    deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
  });

  const card = (code: string, owner = 'p1'): CardInstance =>
    createCardInstance(cardCatalog.getCard(code)!, owner);

  beforeEach(() => {
    state = setupGame({
      catalog: cardCatalog,
      scenarioId: 'rhino',
      players: [player('p1', '01001a', '01001b'), player('p2', '01010a', '01010b')],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
      skipScenarioPlugin: true,
    });
    for (const p of state.players) {
      p.currentForm = 'hero';
      p.activeFormCard = p.hero;
      p.hand = [];
    }
    state.firstPlayerIndex = 0;
  });

  it('1. Three-Card Reveal Window: groups Black Widow (tableau), Enhanced Spider-Sense (hand), and Get Behind Me! (P2 hand) into ORDER_SIMULTANEOUS_ABILITIES for First Player', () => {
    // P1: Black Widow in allies tableau, Enhanced Spider-Sense in hand + Genius (mental resource) to pay costs
    const blackWidow = card('01075', 'p1');
    state.players[0].allies = [blackWidow];
    const spiderSense = card('01004', 'p1');
    const genius1 = card('01089', 'p1');
    state.players[0].hand = [spiderSense, genius1];

    // P2: Get Behind Me! in hand + resource card
    const getBehindMe = card('01078', 'p2');
    const resource2 = card('01088', 'p2');
    state.players[1].hand = [getBehindMe, resource2];

    // Reveal Treachery: False Alarm (01112)
    const falseAlarm = card('01112');
    state.players[0].dealtEncounterCards = [falseAlarm];

    state = step4_revealEncounterCards(state);

    const activePrompt = peekDecisionPrompt(state);
    expect(activePrompt).toBeDefined();
    expect(activePrompt?.kind).toBe('ORDER_SIMULTANEOUS_ABILITIES');
    expect(activePrompt?.playerId).toBe('p1');
    expect(activePrompt?.title).toBe('Simultaneous Optional Abilities: Choose Resolution Order');

    // All 3 candidates are present in simultaneousPrompts and options
    expect(activePrompt?.simultaneousPrompts).toHaveLength(3);
    const candidateCodes = activePrompt?.simultaneousPrompts?.map((c) => c.sourceCardCode);
    expect(candidateCodes).toContain('01075');
    expect(candidateCodes).toContain('01004');
    expect(candidateCodes).toContain('01078');
  });

  it('2. Reordering Execution: First Player orders Get Behind Me! first, P2 cancels treachery and other cancels are pruned', () => {
    const blackWidow = card('01075', 'p1');
    state.players[0].allies = [blackWidow];
    const spiderSense = card('01004', 'p1');
    const genius1 = card('01089', 'p1');
    state.players[0].hand = [spiderSense, genius1];

    const getBehindMe = card('01078', 'p2');
    const resource2 = card('01088', 'p2');
    state.players[1].hand = [getBehindMe, resource2];

    const falseAlarm = card('01112');
    state.players[0].dealtEncounterCards = [falseAlarm];

    state = step4_revealEncounterCards(state);

    // First player sets sequence order: Get Behind Me! (01078) -> Black Widow (01075) -> Enhanced Spider-Sense (01004)
    const orderRes = dispatchAction(state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: 'confirm_order',
      sequenceOrder: ['01078', '01075', '01004'],
    });
    expect(orderRes.result.success).toBe(true);
    expect(orderRes.result.onomatopoeia).toBe('ORDER SET!');
    state = orderRes.state;

    // Head of queue is now Get Behind Me! for P2
    const headPrompt = peekDecisionPrompt(state);
    expect(headPrompt).toBeDefined();
    expect(headPrompt?.playerId).toBe('p2');
    expect(headPrompt?.sourceCardCode).toBe('01078');

    // P2 accepts Get Behind Me!
    const gbmAccept = dispatchAction(state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p2',
      selectedOptionId: 'trigger_get_behind_me_interrupt',
      paymentCardInstanceIds: [resource2.instanceId],
    });
    expect(gbmAccept.result.success).toBe(true);
    state = gbmAccept.state;

    // Treachery was discarded without applying its When Revealed (P1 is not confused)
    expect(state.encounterDiscard.map((c) => c.card.code)).toContain('01112');
    // Get Behind Me! was discarded
    expect(state.players[1].discard.map((c) => c.card.code)).toContain('01078');

    // Black Widow and Enhanced Spider-Sense were pruned because the reveal is already cancelled
    const remainingCancelPrompts = (state.pendingDecisionQueue || []).filter(
      (p) => p.sourceCardCode === '01075' || p.sourceCardCode === '01004',
    );
    expect(remainingCancelPrompts).toHaveLength(0);
  });

  it('3. Alternate Order Execution: First Player orders Black Widow first, P1 cancels and discards treachery, new card is revealed', () => {
    const blackWidow = card('01075', 'p1');
    state.players[0].allies = [blackWidow];
    const spiderSense = card('01004', 'p1');
    const genius1 = card('01089', 'p1');
    state.players[0].hand = [spiderSense, genius1];

    const getBehindMe = card('01078', 'p2');
    const resource2 = card('01088', 'p2');
    state.players[1].hand = [getBehindMe, resource2];

    const falseAlarm = card('01112');
    state.players[0].dealtEncounterCards = [falseAlarm];

    // Stack encounter deck so the replacement card is Shocker (01103)
    const shocker = card('01103');
    state.encounterDeck = [shocker, ...state.encounterDeck];

    state = step4_revealEncounterCards(state);

    // First player sets sequence order: Black Widow (01075) first
    state = dispatchAction(state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: 'confirm_order',
      sequenceOrder: ['01075', '01078', '01004'],
    }).state;

    // Head prompt is now Black Widow for P1
    expect(peekDecisionPrompt(state)?.playerId).toBe('p1');
    expect(peekDecisionPrompt(state)?.sourceCardCode).toBe('01075');

    // P1 accepts Black Widow (exhausts Black Widow + spends mental resource)
    state = dispatchAction(state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: 'trigger_black_widow_cancel',
      paymentCardInstanceIds: [genius1.instanceId],
    }).state;

    // Black Widow is exhausted
    expect(state.players[0].allies.find((a) => a.card.code === '01075')?.exhausted).toBe(true);

    // False Alarm was discarded
    expect(state.encounterDiscard.map((c) => c.card.code)).toContain('01112');

    // Other cancel prompts for the initial card are pruned
    const oldCancels = (state.pendingDecisionQueue || []).filter(
      (p) => p.sourceCardCode === '01078' || p.sourceCardCode === '01004',
    );
    expect(oldCancels).toHaveLength(0);
  });

  it('4. First Player Rights in 2-Player Game: when P2 is First Player, P2 receives ordering prompt even if abilities belong to P1', () => {
    state.firstPlayerIndex = 1; // P2 is First Player

    const blackWidow = card('01075', 'p1');
    state.players[0].allies = [blackWidow];
    const spiderSense = card('01004', 'p1');
    const genius1 = card('01089', 'p1');
    state.players[0].hand = [spiderSense, genius1];

    const falseAlarm = card('01112');
    state.players[0].dealtEncounterCards = [falseAlarm];

    state = step4_revealEncounterCards(state);

    // Ordering prompt is issued to P2 (First Player)
    const prompt = peekDecisionPrompt(state);
    expect(prompt).toBeDefined();
    expect(prompt?.kind).toBe('ORDER_SIMULTANEOUS_ABILITIES');
    expect(prompt?.playerId).toBe('p2');
    expect(prompt?.simultaneousPrompts).toHaveLength(2);
  });

  it('5. Identical Duplicates in Single Hand: 2x Emergency suppress ORDER_SIMULTANEOUS_ABILITIES and resolve successively', () => {
    const emergency1 = card('01085', 'p1');
    const emergency2 = card('01085', 'p1');
    state.players[0].hand = [emergency1, emergency2];

    const triggerRes = dispatchTrigger(state, 'THREAT_WOULD_BE_PLACED', {
      targetPlayerId: 'p1',
      threatAmount: 2,
      threatSource: 'VILLAIN_SCHEME',
    });

    // ORDER_SIMULTANEOUS_ABILITIES is SUPPRESSED
    expect(peekDecisionPrompt(triggerRes.state)?.kind).not.toBe('ORDER_SIMULTANEOUS_ABILITIES');
    // Both prompts exist directly in queue
    expect(triggerRes.state.pendingDecisionQueue).toHaveLength(2);
    expect(triggerRes.state.pendingDecisionQueue![0].sourceCardCode).toBe('01085');
    expect(triggerRes.state.pendingDecisionQueue![1].sourceCardCode).toBe('01085');
  });

  it('6. Distinct Cards in Single Hand: Emergency + Great Responsibility trigger ORDER_SIMULTANEOUS_ABILITIES', () => {
    const emergency = card('01085', 'p1');
    const greatResp = card('01061', 'p1');
    state.players[0].hand = [emergency, greatResp];

    const triggerRes = dispatchTrigger(state, 'THREAT_WOULD_BE_PLACED', {
      targetPlayerId: 'p1',
      threatAmount: 3,
      threatSource: 'VILLAIN_SCHEME',
    });

    const prompt = peekDecisionPrompt(triggerRes.state);
    expect(prompt?.kind).toBe('ORDER_SIMULTANEOUS_ABILITIES');
    expect(prompt?.playerId).toBe('p1');
    expect(prompt?.simultaneousPrompts).toHaveLength(2);
  });

  it('7. Non-Treachery Reveal: revealing a Minion offers only Black Widow; treachery-filtered cards are excluded', () => {
    const blackWidow = card('01075', 'p1');
    state.players[0].allies = [blackWidow];
    const spiderSense = card('01004', 'p1');
    const genius1 = card('01089', 'p1');
    state.players[0].hand = [spiderSense, genius1];

    const getBehindMe = card('01078', 'p2');
    const resource2 = card('01088', 'p2');
    state.players[1].hand = [getBehindMe, resource2];

    // Reveal Shocker (01103) - Minion
    const shocker = card('01103');
    state.players[0].dealtEncounterCards = [shocker];

    state = step4_revealEncounterCards(state);

    // Only Black Widow matches because Enhanced Spider-Sense and Get Behind Me! have cardFilter: { types: ['treachery'] }
    const prompt = peekDecisionPrompt(state);
    expect(prompt).toBeDefined();
    // Only 1 candidate matches -> directly queued without ordering prompt
    expect(prompt?.kind).not.toBe('ORDER_SIMULTANEOUS_ABILITIES');
    expect(prompt?.sourceCardCode).toBe('01075');
  });
});
