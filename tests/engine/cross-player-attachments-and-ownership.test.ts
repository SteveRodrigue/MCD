import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { HeroCard, AlterEgoCard, GameState, GamePhase } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { canPlayCard } from '@engine/pipeline/legality-checker';
import { dispatchAction } from '@engine/pipeline/action-dispatcher';
import { discardCardInstance } from '@engine/effects';
import { assertCardConservation } from '@engine/state/state-validator';
import { getEffectiveHeroStats, getEffectiveAllyStats } from '@engine/pipeline/stat-calculator';

describe('Cross-Player Attachments & Card Ownership Invariants (RR v1.8 p. 23, ADR-0068, Issue #23)', () => {
  const smHero = cardCatalog.getCard('01001a') as HeroCard;
  const peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;
  const cmHero = cardCatalog.getCard('01010a') as HeroCard;
  const carolDanversAlterEgo = cardCatalog.getCard('01010b') as AlterEgoCard;
  const ctCard = cardCatalog.getCard('01057')!; // Combat Training
  const inspiredCard = cardCatalog.getCard('01074')!; // Inspired
  const daredevilCard = cardCatalog.getCard('01058')!; // Daredevil ally

  let state: GameState;

  beforeEach(() => {
    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Player 1',
          hero: smHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
        {
          id: 'p2',
          name: 'Player 2',
          hero: cmHero,
          alterEgo: carolDanversAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01014')!),
        },
      ],
      skipMulligan: true,
    });

    // Set active player to p1 in hero form and player phase
    state.phase = GamePhase.PLAYER_PHASE;
    state.activePlayerIndex = 0;
    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = smHero;
    state.players[1].currentForm = 'hero';
    state.players[1].activeFormCard = cmHero;
  });

  it('1. Multiplayer Modal Option Evaluation & Grayed-Out Display when maxPerPlayer is reached', () => {
    // Player 2 already has a copy of Combat Training in tableau
    const p2CT = createCardInstance(ctCard, 'p2');
    state.players[1].tableau.push(p2CT);

    // Player 1 has Combat Training in hand and 2 resources to pay
    const p1CT = createCardInstance(ctCard, 'p1');
    const pay1 = createCardInstance(cardCatalog.getCard('01005')!, 'p1');
    const pay2 = createCardInstance(cardCatalog.getCard('01005')!, 'p1');
    state.players[0].hand.push(p1CT, pay1, pay2);

    assertCardConservation(state);

    // Player 1 plays Combat Training
    const res = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardInstanceId: p1CT.instanceId,
      paymentCardInstanceIds: [pay1.instanceId, pay2.instanceId],
    });

    expect(res.result.success).toBe(true);
    expect(res.state.pendingDecisionPrompt).toBeDefined();

    const prompt = res.state.pendingDecisionPrompt!;
    expect(prompt.title).toBe('Choose Player Control');
    expect(prompt.options).toHaveLength(2);

    // Option for Player 1: eligible and enabled
    const p1Opt = prompt.options.find((o) => o.id === 'p1');
    expect(p1Opt).toBeDefined();
    expect(p1Opt!.disabled).toBeFalsy();

    // Option for Player 2: already at max 1 per player -> disabled with reason
    const p2Opt = prompt.options.find((o) => o.id === 'p2');
    expect(p2Opt).toBeDefined();
    expect(p2Opt!.disabled).toBe(true);
    expect(p2Opt!.disabledReason).toContain('Max 1 per player limit reached for Player 2');

    // Attempting to select the disabled option fails
    const invalidRes = dispatchAction(res.state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: 'p2',
    });
    expect(invalidRes.result.success).toBe(false);
    expect(invalidRes.result.error).toContain('Max 1 per player limit reached');

    // Player 1 selects Player 1
    const validRes = dispatchAction(res.state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: 'p1',
    });

    expect(validRes.result.success).toBe(true);
    expect(validRes.state.players[0].tableau.some((c) => c.instanceId === p1CT.instanceId)).toBe(
      true,
    );
    expect(
      validRes.state.players[0].tableau.find((c) => c.instanceId === p1CT.instanceId)!.ownerId,
    ).toBe('p1');

    assertCardConservation(validRes.state);
  });

  it('2. Global Max Per Player Upfront Check: rejects when all players have reached the limit', () => {
    // Both Player 1 and Player 2 have Combat Training in tableau
    const p1CT = createCardInstance(ctCard, 'p1');
    const p2CT = createCardInstance(ctCard, 'p2');
    state.players[0].tableau.push(p1CT);
    state.players[1].tableau.push(p2CT);

    // Player 1 attempts to play a 3rd Combat Training from hand
    const ct3 = createCardInstance(ctCard, 'p1');
    const pay1 = createCardInstance(cardCatalog.getCard('01005')!, 'p1');
    const pay2 = createCardInstance(cardCatalog.getCard('01005')!, 'p1');
    state.players[0].hand.push(ct3, pay1, pay2);

    assertCardConservation(state);

    // Upfront legality check rejects without prompting or spending resources
    const check = canPlayCard(state, 'p1', ct3.instanceId, [pay1.instanceId, pay2.instanceId]);
    expect(check.allowed).toBe(false);
    expect(check.reason).toBe('All players have reached max per player limit for this card.');

    const res = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardInstanceId: ct3.instanceId,
      paymentCardInstanceIds: [pay1.instanceId, pay2.instanceId],
    });

    expect(res.result.success).toBe(false);
    expect(res.result.error).toBe('All players have reached max per player limit for this card.');
    expect(res.state.pendingDecisionPrompt).toBeUndefined();
    // Payment cards and card to play remain in hand
    expect(res.state.players[0].hand.some((c) => c.instanceId === ct3.instanceId)).toBe(true);
    expect(res.state.players[0].hand.some((c) => c.instanceId === pay1.instanceId)).toBe(true);

    assertCardConservation(res.state);
  });

  it("3. Play Under Another Player's Control: grants stat bonus to target and retains ownerId", () => {
    const baseAtk1 = getEffectiveHeroStats(state, state.players[0]).attack;
    const baseAtk2 = getEffectiveHeroStats(state, state.players[1]).attack;

    const ct = createCardInstance(ctCard, 'p1');
    const pay1 = createCardInstance(cardCatalog.getCard('01005')!, 'p1');
    const pay2 = createCardInstance(cardCatalog.getCard('01005')!, 'p1');
    state.players[0].hand.push(ct, pay1, pay2);

    assertCardConservation(state);

    // Player 1 plays Combat Training
    const res1 = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardInstanceId: ct.instanceId,
      paymentCardInstanceIds: [pay1.instanceId, pay2.instanceId],
    });

    expect(res1.result.success).toBe(true);
    expect(res1.state.pendingDecisionPrompt).toBeDefined();

    // Player 1 assigns control to Player 2
    const res2 = dispatchAction(res1.state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: 'p2',
    });

    expect(res2.result.success).toBe(true);

    // Card is in Player 2's tableau, NOT Player 1's tableau
    expect(res2.state.players[1].tableau.some((c) => c.instanceId === ct.instanceId)).toBe(true);
    expect(res2.state.players[0].tableau.some((c) => c.instanceId === ct.instanceId)).toBe(false);

    // Card retains persistent ownerId === 'p1'
    const placed = res2.state.players[1].tableau.find((c) => c.instanceId === ct.instanceId)!;
    expect(placed.ownerId).toBe('p1');

    // Player 2 gets +1 ATK, Player 1 ATK is unchanged
    expect(getEffectiveHeroStats(res2.state, res2.state.players[1]).attack).toBe(baseAtk2 + 1);
    expect(getEffectiveHeroStats(res2.state, res2.state.players[0]).attack).toBe(baseAtk1);

    assertCardConservation(res2.state);
  });

  it('4. Persistent Ownership Discard Invariant: card returns strictly to original owner discard pile', () => {
    // Combat Training placed under Player 2's control, owned by Player 1
    const ct = createCardInstance(ctCard, 'p1');
    state.players[1].tableau.push(ct);

    const initialP1DiscardLen = state.players[0].discard.length;
    const initialP2DiscardLen = state.players[1].discard.length;

    assertCardConservation(state);

    // Discard Combat Training from Player 2's tableau
    discardCardInstance(state, ct, 'p2');

    // Card is removed from Player 2's tableau
    expect(state.players[1].tableau.some((c) => c.instanceId === ct.instanceId)).toBe(false);

    // Card MUST be in Player 1's discard pile (the OWNER), NOT Player 2's discard pile
    expect(state.players[0].discard.some((c) => c.instanceId === ct.instanceId)).toBe(true);
    expect(state.players[1].discard.some((c) => c.instanceId === ct.instanceId)).toBe(false);
    expect(state.players[0].discard.length).toBe(initialP1DiscardLen + 1);
    expect(state.players[1].discard.length).toBe(initialP2DiscardLen);

    assertCardConservation(state);
  });

  it('5. Cross-Player Host Attachment Discard Invariant (Inspired 01074 on Daredevil): both return to respective owners', () => {
    // Player 2 controls Daredevil
    const daredevil = createCardInstance(daredevilCard, 'p2');
    state.players[1].allies.push(daredevil);

    // Player 1 has Inspired in hand + payment cards
    const inspired = createCardInstance(inspiredCard, 'p1');
    const pay1 = createCardInstance(cardCatalog.getCard('01005')!, 'p1');
    const pay2 = createCardInstance(cardCatalog.getCard('01005')!, 'p1');
    state.players[0].hand.push(inspired, pay1, pay2);

    assertCardConservation(state);

    // Player 1 plays Inspired directly attaching to Daredevil
    const res = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardInstanceId: inspired.instanceId,
      paymentCardInstanceIds: [pay1.instanceId, pay2.instanceId],
      targetInstanceId: daredevil.instanceId,
    });

    expect(res.result.success).toBe(true);

    const ddInPlay = res.state.players[1].allies.find(
      (a) => a.instanceId === daredevil.instanceId,
    )!;
    expect(ddInPlay.attachments).toBeDefined();
    expect(ddInPlay.attachments!.some((att) => att.card.code === '01074')).toBe(true);

    const attachedInspired = ddInPlay.attachments!.find((att) => att.card.code === '01074')!;
    expect(attachedInspired.ownerId).toBe('p1');

    // Daredevil has +1 THW and +1 ATK from Inspired (base 2/2 -> 3/3)
    const allyStats = getEffectiveAllyStats(res.state, ddInPlay);
    expect(allyStats.thwart).toBe(3);
    expect(allyStats.attack).toBe(3);

    assertCardConservation(res.state);

    // Daredevil is discarded / defeated
    discardCardInstance(res.state, ddInPlay, 'p2');

    // Daredevil is no longer in play
    expect(res.state.players[1].allies.some((a) => a.instanceId === daredevil.instanceId)).toBe(
      false,
    );

    // Daredevil goes to Player 2's discard pile (owner of Daredevil)
    expect(res.state.players[1].discard.some((c) => c.instanceId === daredevil.instanceId)).toBe(
      true,
    );

    // Inspired goes to Player 1's discard pile (owner of Inspired)
    expect(res.state.players[0].discard.some((c) => c.instanceId === inspired.instanceId)).toBe(
      true,
    );
    expect(res.state.players[1].discard.some((c) => c.instanceId === inspired.instanceId)).toBe(
      false,
    );

    assertCardConservation(res.state);
  });

  it('6. Solo Play: automatically places card under sole player control without decision prompt', () => {
    // Solo game setup
    const soloState = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Player 1',
          hero: smHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      skipMulligan: true,
    });

    soloState.phase = GamePhase.PLAYER_PHASE;
    soloState.activePlayerIndex = 0;
    soloState.players[0].currentForm = 'hero';
    soloState.players[0].activeFormCard = smHero;

    const ct = createCardInstance(ctCard, 'p1');
    const pay1 = createCardInstance(cardCatalog.getCard('01005')!, 'p1');
    const pay2 = createCardInstance(cardCatalog.getCard('01005')!, 'p1');
    soloState.players[0].hand.push(ct, pay1, pay2);

    assertCardConservation(soloState);

    const res = dispatchAction(soloState, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardInstanceId: ct.instanceId,
      paymentCardInstanceIds: [pay1.instanceId, pay2.instanceId],
    });

    expect(res.result.success).toBe(true);
    // In solo play, no prompt should be enqueued
    expect(res.state.pendingDecisionPrompt).toBeUndefined();
    // Card placed directly in p1's tableau
    expect(res.state.players[0].tableau.some((c) => c.instanceId === ct.instanceId)).toBe(true);
    expect(res.state.players[0].tableau.find((c) => c.instanceId === ct.instanceId)!.ownerId).toBe(
      'p1',
    );

    assertCardConservation(res.state);
  });
});
