import { describe, it, expect, beforeEach } from 'vitest';
import {
  GameState,
  GamePhase,
  CardInstance,
  PlayerState,
  NormalizedCard,
  CardType,
  FactionCode,
} from '../../src/engine/models';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { dispatchAction } from '../../src/engine/pipeline/action-dispatcher';
import { peekDecisionPrompt } from '../../src/engine/pipeline/prompt-queue';

describe('Prompt Cancellation & Card Refund (Issue #172)', () => {
  let state: GameState;
  let player1: PlayerState;
  let player2: PlayerState;

  const mtcCard = cardCatalog.getCard('01071')!; // Make the Call
  const mariaHillCard = cardCatalog.getCard('01019') || cardCatalog.getCard('01067')!; // Maria Hill
  const energyCard = cardCatalog.getCard('01088')!; // Energy
  const firstAidCard = cardCatalog.getCard('01086')!; // First Aid

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

  it('Test 1: Playing "Make the Call" (01071) from hand with ally candidates in discard, resolving prompt with pass_play_from_zone -> card is removed from discard and returned to hand', () => {
    const mtcInst = createInstance(mtcCard, 'mtc_1', 'player_1');
    const mariaInst = createInstance(mariaHillCard, 'maria_1', 'player_1');
    const res1 = createInstance(energyCard, 'res_1', 'player_1');
    const res2 = createInstance(energyCard, 'res_2', 'player_1');
    player1.hand = [mtcInst, res1, res2];
    player1.discard = [mariaInst];

    // Play Make the Call without targetInstanceId -> enqueues PLAY_CARD_FROM_ZONE decision prompt
    const { state: promptState, result: playResult } = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: 'player_1',
      cardInstanceId: 'mtc_1',
      paymentCardInstanceIds: [],
    });

    expect(playResult.success).toBe(true);
    const activePrompt = peekDecisionPrompt(promptState);
    expect(activePrompt).toBeDefined();
    expect(activePrompt?.options.some((o) => o.id === 'pass_play_from_zone')).toBe(true);

    // Make the Call event is temporarily in player1's discard pile during prompt
    expect(promptState.players[0].discard.some((c) => c.instanceId === 'mtc_1')).toBe(true);

    // Cancel / pass the prompt with 'pass_play_from_zone'
    const { state: resolvedState, result: resolveResult } = dispatchAction(promptState, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'player_1',
      selectedOptionId: 'pass_play_from_zone',
    });

    expect(resolveResult.success).toBe(true);
    expect(resolveResult.onomatopoeia).toBe('PASSED');

    const p1 = resolvedState.players[0];
    // Make the Call must be removed from discard and returned to hand
    expect(p1.discard.some((c) => c.instanceId === 'mtc_1')).toBe(false);
    expect(p1.hand.some((c) => c.instanceId === 'mtc_1')).toBe(true);
    // Ally remains in discard and did not enter play
    expect(p1.discard.some((c) => c.instanceId === 'maria_1')).toBe(true);
    expect(p1.allies.length).toBe(0);
  });

  it('Test 2: Playing "Make the Call" (01071), selecting option pass -> card is returned to hand', () => {
    const mtcInst = createInstance(mtcCard, 'mtc_1', 'player_1');
    const mariaInst = createInstance(mariaHillCard, 'maria_1', 'player_1');
    const res1 = createInstance(energyCard, 'res_1', 'player_1');
    const res2 = createInstance(energyCard, 'res_2', 'player_1');
    player1.hand = [mtcInst, res1, res2];
    player1.discard = [mariaInst];

    const { state: promptState, result: playResult } = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: 'player_1',
      cardInstanceId: 'mtc_1',
      paymentCardInstanceIds: [],
    });

    expect(playResult.success).toBe(true);
    expect(peekDecisionPrompt(promptState)).toBeDefined();

    // Resolve with selectedOptionId: 'pass'
    const { state: resolvedState, result: resolveResult } = dispatchAction(promptState, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'player_1',
      selectedOptionId: 'pass',
    });

    expect(resolveResult.success).toBe(true);
    expect(resolveResult.onomatopoeia).toBe('PASSED');

    const p1 = resolvedState.players[0];
    expect(p1.discard.some((c) => c.instanceId === 'mtc_1')).toBe(false);
    expect(p1.hand.some((c) => c.instanceId === 'mtc_1')).toBe(true);
    expect(p1.allies.length).toBe(0);
  });

  it('Test 3: Playing an event with multiple targets (e.g. First Aid / Haymaker), cancelling target choice -> event card is returned to hand from discard, no effect executed', () => {
    const firstAidInst = createInstance(firstAidCard, 'fa_1', 'player_1');
    const resInst = createInstance(energyCard, 'res_1', 'player_1');
    player1.hand = [firstAidInst, resInst];

    // Both players damaged -> multiple targets eligible
    player1.health = 7;
    player2.health = 8;

    // Play First Aid without targetInstanceId
    const { state: promptState, result: playResult } = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: 'player_1',
      cardInstanceId: 'fa_1',
      paymentCardInstanceIds: ['res_1'],
    });

    expect(playResult.success).toBe(true);
    const activePrompt = peekDecisionPrompt(promptState);
    expect(activePrompt).toBeDefined();
    expect(activePrompt?.isVoluntary).toBe(true);
    expect(activePrompt?.options.some((o) => o.id === 'cancel_target')).toBe(true);

    // Cancel target selection
    const { state: resolvedState, result: cancelResult } = dispatchAction(promptState, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'player_1',
      selectedOptionId: 'cancel_target',
    });

    expect(cancelResult.success).toBe(true);
    expect(cancelResult.onomatopoeia).toBe('CANCELLED');

    const p1 = resolvedState.players[0];
    const p2 = resolvedState.players[1];

    // First Aid returned to hand
    expect(p1.hand.some((c) => c.instanceId === 'fa_1')).toBe(true);
    expect(p1.discard.some((c) => c.instanceId === 'fa_1')).toBe(false);

    // No effect executed: health values unchanged
    expect(p1.health).toBe(7);
    expect(p2.health).toBe(8);
  });

  it('Test 4: Voluntary attachment target prompt cancelled -> attachment card returned to hand', () => {
    const attachmentCard: NormalizedCard = {
      code: 'custom_attachment',
      name: 'Custom Attachment',
      type: CardType.UPGRADE,
      faction: FactionCode.BASIC,
      packCode: 'core',
      position: 1,
      quantity: 1,
      deckLimit: 3,
      isUnique: false,
      cost: 0,
      text: 'Attach to a minion.',
      traits: [],
      keywords: [],
      resources: { physical: 0, energy: 0, mental: 0, wild: 0, total: 0 },
      isLandscape: false,
      orientation: 'portrait',
      raw: {} as any,
    };

    const attInst = createInstance(attachmentCard, 'att_1', 'player_1');
    player1.hand = [];

    const minion1Card = cardCatalog.getCard('01100') || {
      code: 'minion_1',
      name: 'Armored Minion',
      type: CardType.MINION,
      health: 3,
    };
    const min1 = createInstance(minion1Card as NormalizedCard, 'min_1', 'player_1');
    player1.engagedMinions = [min1];

    const prompt = {
      promptId: `prompt_attach_minion_${Date.now()}`,
      playerId: 'player_1',
      title: 'Choose Minion Host',
      description: 'Choose which minion to attach to:',
      sourceCardName: 'Custom Attachment',
      options: [
        {
          id: 'min_1',
          label: 'Minion 1',
          description: 'Attach to minion 1',
          effect: 'ATTACH_TO_HOST',
          params: {
            isAttachmentMinionChoice: true,
            attachmentCard: attInst,
            ownerId: 'player_1',
          },
        },
        {
          id: 'cancel',
          label: 'Cancel',
          description: 'Cancel and return to hand',
          effect: 'ATTACH_TO_HOST',
          params: {
            isAttachmentMinionChoice: true,
            attachmentCard: attInst,
            ownerId: 'player_1',
          },
        },
      ],
      isVoluntary: true,
    };

    const stateWithPrompt = {
      ...state,
      pendingDecisionQueue: [prompt],
    };

    expect(peekDecisionPrompt(stateWithPrompt)).toBeDefined();
    expect(peekDecisionPrompt(stateWithPrompt)?.isVoluntary).toBe(true);

    // Cancel the attachment prompt
    const { state: resolvedState, result: cancelResult } = dispatchAction(stateWithPrompt, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'player_1',
      selectedOptionId: 'cancel',
    });

    expect(cancelResult.success).toBe(true);
    expect(cancelResult.onomatopoeia).toBe('CANCELLED');

    const p1 = resolvedState.players[0];
    // Attachment returned to hand
    expect(p1.hand.some((c) => c.instanceId === 'att_1')).toBe(true);
    // Minion has no attachments
    expect(p1.engagedMinions[0].attachments?.length || 0).toBe(0);
  });
});
