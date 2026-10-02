import { describe, it, expect, beforeEach } from 'vitest';
import {
  GameState,
  GamePhase,
  CardInstance,
  PlayerState,
  NormalizedCard,
} from '../../src/engine/models';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { dispatchAction } from '../../src/engine/pipeline/action-dispatcher';
import { peekDecisionPrompt } from '../../src/engine/pipeline/prompt-queue';
import { canPlayCard, evaluateCardPlayability } from '../../src/engine/pipeline/legality-checker';

describe('Make the Call Payment & Legality Checks (Issue #173)', () => {
  let state: GameState;
  let player1: PlayerState;
  let player2: PlayerState;

  const mtcCard = cardCatalog.getCard('01071')!; // Make the Call
  const mariaHillCard = cardCatalog.getCard('01067')!; // Maria Hill (cost 2)
  const nickFuryCard = cardCatalog.getCard('01084')!; // Nick Fury (cost 4)
  const energyCard = cardCatalog.getCard('01088')!; // Energy (2 resources)
  const webShooterCard = cardCatalog.getCard('01008')!; // Web-Shooter

  function createInstance(
    card: NormalizedCard,
    instanceId: string,
    ownerId: string = 'player_1',
  ): CardInstance {
    return {
      instanceId,
      card,
      ownerId,
      exhausted: false,
      tokens: {},
      counters: {},
      statusCards: [],
      activeStatModifiers: [],
      attachments: [],
      cardsUnderneath: [],
    };
  }

  beforeEach(() => {
    player1 = {
      id: 'player_1',
      name: 'Spider-Man',
      hero: { code: '01001a', name: 'Spider-Man', type: 'hero' } as any,
      alterEgo: { code: '01001b', name: 'Peter Parker', type: 'alter_ego' } as any,
      availableForms: [],
      activeFormCard: { code: '01001a', name: 'Spider-Man', type: 'hero' } as any,
      currentForm: 'hero',
      health: 10,
      maxHealth: 10,
      exhausted: false,
      statusCards: [],
      hand: [],
      deck: [],
      discard: [],
      tableau: [],
      allies: [],
      engagedMinions: [],
      recoveryUsedThisRound: false,
      dealtEncounterCards: [],
      setAsideCards: [],
      basicChangeFormUsedThisRound: false,
      formChangedThisRound: false,
    } as unknown as PlayerState;

    player2 = {
      id: 'player_2',
      name: 'Captain Marvel',
      hero: { code: '01010a', name: 'Captain Marvel', type: 'hero' } as any,
      alterEgo: { code: '01010b', name: 'Carol Danvers', type: 'alter_ego' } as any,
      availableForms: [],
      activeFormCard: { code: '01010a', name: 'Captain Marvel', type: 'hero' } as any,
      currentForm: 'hero',
      health: 12,
      maxHealth: 12,
      exhausted: false,
      statusCards: [],
      hand: [],
      deck: [],
      discard: [],
      tableau: [],
      allies: [],
      engagedMinions: [],
      recoveryUsedThisRound: false,
      dealtEncounterCards: [],
      setAsideCards: [],
      basicChangeFormUsedThisRound: false,
      formChangedThisRound: false,
    } as unknown as PlayerState;

    state = {
      id: 'test_game',
      roundNumber: 1,
      phase: GamePhase.PLAYER_PHASE,
      firstPlayerIndex: 0,
      activePlayerIndex: 0,
      players: [player1, player2],
      villain: {
        code: '01094',
        name: 'Rhino',
        stage: 'I',
        health: 14,
        maxHealth: 14,
        scheme: 1,
        attack: 2,
        statusCards: [],
        attachments: [],
        tough: false,
        card: { code: '01094', name: 'Rhino', isUnique: true } as any,
      } as any,
      mainScheme: {
        code: '01097',
        name: 'The Break-In!',
        stage: '1A',
        threat: 0,
        targetThreat: 7,
        accelerationTokens: 0,
        crisisTokens: 0,
      } as any,
      sideSchemes: [],
      encounterDeck: [],
      encounterDiscard: [],
      log: [],
    } as unknown as GameState;
  });

  // Test 1: Make the Call is NOT playable if no Allies are in any player discard pile(s)
  it('Test 1: Make the Call is NOT playable if no Allies are in any player discard pile(s)', () => {
    const mtcInst = createInstance(mtcCard, 'mtc_1', 'player_1');
    const resInst = createInstance(energyCard, 'res_1', 'player_1');
    player1.hand = [mtcInst, resInst];

    // Ensure no allies in any player discard pile
    player1.discard = [];
    player2.discard = [];

    const playability = evaluateCardPlayability(state, 'player_1', mtcInst);
    expect(playability.isPlayable).toBe(false);
    expect(
      playability.reasons.some((r) => r.includes('No eligible allies in any discard pile')),
    ).toBe(true);

    const legality = canPlayCard(state, 'player_1', mtcInst.instanceId);
    expect(legality.allowed).toBe(false);
    expect(legality.reason).toContain('No eligible allies in any discard pile');
  });

  // Test 2: Make the Call is NOT playable if the player does not have enough resources to pay for at least one of the Allies
  it('Test 2: Make the Call is NOT playable if the player does not have enough resources to pay for at least one of the Allies in the discard pile(s)', () => {
    const mtcInst = createInstance(mtcCard, 'mtc_1', 'player_1');
    // Maria Hill costs 2
    const mariaInst = createInstance(mariaHillCard, 'maria_1', 'player_1');
    player1.discard = [mariaInst];

    // Player hand has only Make the Call and 1 card with 1 resource
    // mtcInst has 1 printed resource, but cannot pay for itself.
    // otherCard has 1 resource. Effective available = 1, Maria Hill needs 2.
    const otherCard: CardInstance = {
      ...createInstance(mtcCard, 'other_1', 'player_1'),
      card: { ...mtcCard, resources: { physical: 1, energy: 0, mental: 0, wild: 0, total: 1 } },
    };
    player1.hand = [mtcInst, otherCard];

    const playability = evaluateCardPlayability(state, 'player_1', mtcInst);
    expect(playability.isPlayable).toBe(false);
    expect(
      playability.reasons.some((r) =>
        r.includes('Not enough resources to pay for any ally in discard'),
      ),
    ).toBe(true);

    const legality = canPlayCard(state, 'player_1', mtcInst.instanceId);
    expect(legality.allowed).toBe(false);
    expect(legality.reason).toContain('Not enough resources to pay for any ally in discard');
  });

  // Test 3: Make the Call lets the player select from a list of affordable allies only
  it('Test 3: Make the Call lets the player select from a list of affordable allies only', () => {
    const mtcInst = createInstance(mtcCard, 'mtc_1', 'player_1');
    const mariaInst = createInstance(mariaHillCard, 'maria_1', 'player_1'); // Cost 2
    const furyInst = createInstance(nickFuryCard, 'fury_1', 'player_1'); // Cost 4

    player1.discard = [mariaInst, furyInst];

    // Player 1 has 3 resources in hand to pay for the ally (e.g. 3 single-resource cards)
    const res1 = createInstance(mtcCard, 'res_1', 'player_1');
    const res2 = createInstance(mtcCard, 'res_2', 'player_1');
    const res3 = createInstance(mtcCard, 'res_3', 'player_1');
    player1.hand = [mtcInst, res1, res2, res3];

    // Play Make the Call
    const { state: stateAfterPlay, result } = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: 'player_1',
      cardInstanceId: 'mtc_1',
      paymentCardInstanceIds: [],
    });

    expect(result.success).toBe(true);
    const prompt = peekDecisionPrompt(stateAfterPlay);
    expect(prompt).toBeDefined();

    const optionIds = prompt!.options.map((o) => o.id);
    // Maria Hill (cost 2 <= 3) should be present
    expect(optionIds).toContain('maria_1');
    // Nick Fury (cost 4 > 3) must NOT be present
    expect(optionIds).not.toContain('fury_1');
    // Pass/Cancel must be present
    expect(optionIds).toContain('pass_play_from_zone');
  });

  // Test 4: Decision prompt resolution with paymentCardInstanceIds and generatorInstanceIds
  it('Test 4: Decision prompt resolution with paymentCardInstanceIds and generatorInstanceIds discards only selected cards and exhausts generator', () => {
    const mtcInst = createInstance(mtcCard, 'mtc_1', 'player_1');
    const mariaInst = createInstance(mariaHillCard, 'maria_1', 'player_2'); // in player 2's discard, cost 2
    player2.discard = [mariaInst];

    // Player 1 has Web-Shooter generator in tableau with counters
    const webShooter = createInstance(webShooterCard, 'web_shooter_1', 'player_1');
    webShooter.counters = { web: 3 };
    webShooter.tokens = { counters: 3 };
    webShooter.exhausted = false;
    player1.tableau = [webShooter];

    // Player 1 has 1 payment card and 1 other card that should remain in hand
    const paymentCard = createInstance(energyCard, 'payment_res_1', 'player_1');
    const keptCard = createInstance(mtcCard, 'keep_me_1', 'player_1');
    player1.hand = [mtcInst, paymentCard, keptCard];

    // Play Make the Call
    const { state: stateAfterPlay } = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: 'player_1',
      cardInstanceId: 'mtc_1',
      paymentCardInstanceIds: [],
    });

    const prompt = peekDecisionPrompt(stateAfterPlay);
    expect(prompt).toBeDefined();

    // Resolve prompt by choosing Maria Hill, paying with paymentCard and Web-Shooter generator
    const { state: stateAfterResolve, result: resolveResult } = dispatchAction(stateAfterPlay, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'player_1',
      selectedOptionId: 'maria_1',
      paymentCardInstanceIds: ['payment_res_1'],
      generatorInstanceIds: ['web_shooter_1'],
    });

    expect(resolveResult.success).toBe(true);

    const p1 = stateAfterResolve.players[0];
    // Maria Hill should be in player 1 allies
    expect(p1.allies.some((a) => a.instanceId === 'maria_1')).toBe(true);

    // Generator Web-Shooter should be exhausted
    const genInPlay = p1.tableau.find((t) => t.instanceId === 'web_shooter_1');
    expect(genInPlay?.exhausted).toBe(true);

    // Selected payment card should be in discard
    expect(p1.discard.some((c) => c.instanceId === 'payment_res_1')).toBe(true);

    // Kept card should still be in player 1 hand
    expect(p1.hand.some((c) => c.instanceId === 'keep_me_1')).toBe(true);
    expect(p1.hand.some((c) => c.instanceId === 'payment_res_1')).toBe(false);
  });

  // Test 5: Make the Call is cancelable: choosing 'pass_play_from_zone' returns Make the Call to hand
  it("Test 5: Make the Call is cancelable: choosing 'pass_play_from_zone' returns Make the Call from discard to player's hand", () => {
    const mtcInst = createInstance(mtcCard, 'mtc_1', 'player_1');
    const mariaInst = createInstance(mariaHillCard, 'maria_1', 'player_2');
    player2.discard = [mariaInst];

    const res1 = createInstance(energyCard, 'res_1', 'player_1');
    player1.hand = [mtcInst, res1];

    // Play Make the Call
    const { state: stateAfterPlay } = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: 'player_1',
      cardInstanceId: 'mtc_1',
      paymentCardInstanceIds: [],
    });

    // Make the Call should now be in discard during prompt
    expect(stateAfterPlay.players[0].discard.some((c) => c.instanceId === 'mtc_1')).toBe(true);
    expect(stateAfterPlay.players[0].hand.some((c) => c.instanceId === 'mtc_1')).toBe(false);

    // Choose 'pass_play_from_zone'
    const { state: stateAfterPass, result: passResult } = dispatchAction(stateAfterPlay, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'player_1',
      selectedOptionId: 'pass_play_from_zone',
    });

    expect(passResult.success).toBe(true);

    // Make the Call should be refunded back to player 1's hand
    const p1 = stateAfterPass.players[0];
    expect(p1.hand.some((c) => c.instanceId === 'mtc_1')).toBe(true);
    expect(p1.discard.some((c) => c.instanceId === 'mtc_1')).toBe(false);
    // Ally was not put into play
    expect(p1.allies.some((a) => a.instanceId === 'maria_1')).toBe(false);
  });
});
