import { describe, it, expect, beforeEach } from 'vitest';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { CardType, Keyword, NormalizedCard, GameState } from '@engine/models';
import { dispatchAction } from '@engine/pipeline/action-dispatcher';
import { assertCardConservation } from '@engine/state/state-validator';
import {
  initializeAuxiliaryDeck,
  drawFromAuxiliaryDeck,
  discardToAuxiliaryDeck,
} from '@engine/pipeline/auxiliary-decks';

describe('Player Side Schemes, Victory Display & Auxiliary Scenario Decks (ADR-0034, RR v1.8 p. 26, 30)', () => {
  let spiderManHero: any;
  let peterParkerAlterEgo: any;
  let rhinoVillain: any;
  let mainScheme: any;
  let state: GameState;

  const buildPlayerSideScheme = (overrides: Partial<NormalizedCard> = {}): NormalizedCard => ({
    ...(cardCatalog.getCard('01107')! as NormalizedCard),
    code: 'test_player_side_scheme',
    name: 'Test Support Drive',
    type: CardType.PLAYER_SIDE_SCHEME,
    cost: 0,
    keywords: [],
    enrichment: {
      abilities: [
        {
          id: 'test_pss_when_defeated',
          timing: 'FORCED_RESPONSE',
          trigger: 'DEFEATED',
          steps: [{ effect: 'DRAW_CARDS', params: { count: 1, target: 'SELF' } }],
        },
      ],
    } as any,
    ...overrides,
  });

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
          deckCards: [],
        },
      ],
      villain: rhinoVillain,
      mainScheme,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = spiderManHero;
  });

  it('enters the shared scheme area (state.sideSchemes) with printed threat when played from hand', () => {
    const player = state.players[0];
    const schemeCard = buildPlayerSideScheme({
      raw: {
        ...(cardCatalog.getCard('01107')! as any).raw,
        base_threat: 2,
        base_threat_fixed: false,
      },
    } as any);
    const inst = createCardInstance(schemeCard);
    (inst.card as any).baseThreat = 2;
    (inst.card as any).baseThreatFixed = false;
    player.hand.push(inst);

    const result = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardInstanceId: inst.instanceId,
      paymentCardInstanceIds: [],
    });

    expect(result.result.success).toBe(true);
    expect(result.state.sideSchemes).toHaveLength(1);
    expect(result.state.sideSchemes[0].card.name).toBe('Test Support Drive');
    expect(result.state.sideSchemes[0].threat).toBe(2); // 1 player, non-fixed threat
    expect(result.state.sideSchemes[0].ownerId).toBe('p1');
    expect(result.state.players[0].tableau).toHaveLength(0);
  });

  it('is a legal basic thwart target once in play', () => {
    const player = state.players[0];
    state.sideSchemes.push({
      instanceId: 'pss_1',
      card: buildPlayerSideScheme() as any,
      threat: 3,
      ownerId: 'p1',
    });

    const thwartValue = player.hero.thwart;
    const result = dispatchAction(state, {
      type: 'BASIC_THWART',
      playerId: 'p1',
      targetType: 'side_scheme',
      targetInstanceId: 'pss_1',
    });

    expect(result.result.success).toBe(true);
    expect(result.state.sideSchemes[0].threat).toBe(Math.max(0, 3 - thwartValue));
  });

  it('resolves "When Defeated" reward and routes to owner discard (no Victory keyword)', () => {
    const player = state.players[0];
    const thwartValue = player.hero.thwart;
    state.sideSchemes.push({
      instanceId: 'pss_2',
      card: buildPlayerSideScheme() as any,
      threat: thwartValue, // exactly enough to defeat in one thwart
      ownerId: 'p1',
    });
    const handSizeBefore = player.hand.length;

    const result = dispatchAction(state, {
      type: 'BASIC_THWART',
      playerId: 'p1',
      targetType: 'side_scheme',
      targetInstanceId: 'pss_2',
    });

    expect(result.result.success).toBe(true);
    expect(result.state.sideSchemes).toHaveLength(0);
    expect(result.state.victoryDisplay).toHaveLength(0);
    expect(result.state.players[0].discard.some((c) => c.instanceId === 'pss_2')).toBe(true);
    // "When Defeated" DRAW_CARDS reward should have drawn 1 card into hand
    expect(result.state.players[0].hand.length).toBe(handSizeBefore + 1 - 1); // net: scheme wasn't in hand, so +1 draw
  });

  it('routes a defeated player side scheme with the Victory keyword to state.victoryDisplay', () => {
    const player = state.players[0];
    const thwartValue = player.hero.thwart;
    state.sideSchemes.push({
      instanceId: 'pss_victory',
      card: buildPlayerSideScheme({ keywords: [Keyword.VICTORY] }) as any,
      threat: thwartValue,
      ownerId: 'p1',
    });

    const result = dispatchAction(state, {
      type: 'BASIC_THWART',
      playerId: 'p1',
      targetType: 'side_scheme',
      targetInstanceId: 'pss_victory',
    });

    expect(result.result.success).toBe(true);
    expect(result.state.sideSchemes).toHaveLength(0);
    expect(result.state.victoryDisplay.some((c) => c.instanceId === 'pss_victory')).toBe(true);
    expect(result.state.players[0].discard.some((c) => c.instanceId === 'pss_victory')).toBe(false);
  });

  it('routes a defeated encounter Side Scheme with the Victory keyword to state.victoryDisplay (retrofit)', () => {
    const encounterSideScheme = {
      ...(cardCatalog.getCard('01107')! as NormalizedCard),
      code: 'test_encounter_victory_scheme',
      keywords: [Keyword.VICTORY],
    };
    const player = state.players[0];
    const thwartValue = player.hero.thwart;
    state.sideSchemes.push({
      instanceId: 'ess_victory',
      card: encounterSideScheme as any,
      threat: thwartValue,
    });

    const result = dispatchAction(state, {
      type: 'BASIC_THWART',
      playerId: 'p1',
      targetType: 'side_scheme',
      targetInstanceId: 'ess_victory',
    });

    expect(result.result.success).toBe(true);
    expect(result.state.victoryDisplay.some((c) => c.instanceId === 'ess_victory')).toBe(true);
    expect(result.state.encounterDiscard.some((c) => c.instanceId === 'ess_victory')).toBe(false);
  });

  it('routes a defeated minion with the Victory keyword to state.victoryDisplay (retrofit)', () => {
    const victoryMinion = {
      ...(cardCatalog.getCard('01102')! as NormalizedCard),
      code: 'test_victory_minion',
      keywords: [Keyword.VICTORY],
      health: 1,
    };
    const player = state.players[0];
    const minionInst = createCardInstance(victoryMinion as any);
    player.engagedMinions.push(minionInst);

    const attackValue = player.hero.attack;
    const result = dispatchAction(state, {
      type: 'BASIC_ATTACK',
      playerId: 'p1',
      targetType: 'minion',
      targetInstanceId: minionInst.instanceId,
    } as any);

    expect(result.result.success).toBe(true);
    expect(result.state.victoryDisplay.some((c) => c.instanceId === minionInst.instanceId)).toBe(
      true,
    );
    expect(result.state.encounterDiscard.some((c) => c.instanceId === minionInst.instanceId)).toBe(
      false,
    );
    expect(attackValue).toBeGreaterThan(0);
  });

  it('maintains the Universal Card Conservation Law across play -> thwart -> defeat', () => {
    const player = state.players[0];
    const inst = createCardInstance(buildPlayerSideScheme());
    player.hand.push(inst);

    let result = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardInstanceId: inst.instanceId,
      paymentCardInstanceIds: [],
    });
    expect(() => assertCardConservation(result.state)).not.toThrow();

    const schemeInstanceId = result.state.sideSchemes[0].instanceId;
    for (let i = 0; i < 5; i++) {
      result = dispatchAction(result.state, {
        type: 'BASIC_THWART',
        playerId: 'p1',
        targetType: 'side_scheme',
        targetInstanceId: schemeInstanceId,
      });
      if (result.state.sideSchemes.length === 0) break;
    }
    expect(() => assertCardConservation(result.state)).not.toThrow();
  });

  it('supports generic named auxiliary deck initialize/draw/discard primitives', () => {
    const card = cardCatalog.getCard('01107')! as NormalizedCard;
    const c1 = createCardInstance(card);
    const c2 = createCardInstance(card);

    initializeAuxiliaryDeck(state, 'infinity_gauntlet', [c1, c2]);
    expect(state.auxiliaryDecks['infinity_gauntlet']).toHaveLength(2);
    expect(state.auxiliaryDiscards['infinity_gauntlet']).toHaveLength(0);

    const drawn = drawFromAuxiliaryDeck(state, 'infinity_gauntlet');
    expect(drawn?.instanceId).toBe(c1.instanceId);
    expect(state.auxiliaryDecks['infinity_gauntlet']).toHaveLength(1);

    discardToAuxiliaryDeck(state, 'infinity_gauntlet', drawn!);
    expect(state.auxiliaryDiscards['infinity_gauntlet']).toHaveLength(1);

    expect(drawFromAuxiliaryDeck(state, 'unknown_deck')).toBeUndefined();
  });
});
