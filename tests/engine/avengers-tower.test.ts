import { describe, it, expect } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import {
  AlterEgoCard,
  CardInstance,
  CardType,
  GamePhase,
  GameState,
  HeroCard,
  MainSchemeCard,
  NormalizedCard,
  VillainCard,
} from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { dispatchAction } from '@engine/pipeline/action-dispatcher';
import { getEffectiveCardCost } from '@engine/pipeline/cost-engine';
import { getEffectiveAllyLimit } from '@engine/pipeline/stat-calculator';
import { thaw } from '../support/thaw-state';
import { bootPacks } from '../helpers/content';

await bootPacks('core', 'cap');

/**
 * Avengers Tower (03024), RR v1.8 Ally Limit and Cost. Owner ruling (2026-11-03): "the next
 * [Avenger] ally played" is not "you play", so any player's next Avenger ally this phase uses the
 * discount up.
 */
const card = (code: string) => cardCatalog.getCard(code)!;
const HAWKEYE = '01066'; // Avenger, cost 3
const HULK = '01050'; // Avenger, cost 2
const SPIDER_WOMAN = '01011'; // Avenger
const HELLCAT = '01020'; // Avenger
const TIGRA = '01051'; // Avenger
const MOCKINGBIRD = '01083'; // S.H.I.E.L.D., cost 3, Response after she enters play

const oneWild: NormalizedCard = {
  ...card('01088'),
  code: 'res_one_wild',
  name: 'One Wild',
  type: CardType.RESOURCE,
  cost: 0,
  resources: { physical: 0, energy: 0, mental: 0, wild: 1, total: 1 },
};

function newGame(playerCount: 1 | 2): GameState {
  const heroes = [
    ['p1', 'Spider-Man', '01001a', '01001b'],
    ['p2', 'Captain Marvel', '01010a', '01010b'],
  ].slice(0, playerCount);
  const state = setupGame({
    catalog: cardCatalog,
    players: heroes.map(([id, name, hero, alterEgo]) => ({
      id,
      name,
      hero: card(hero) as HeroCard,
      alterEgo: card(alterEgo) as AlterEgoCard,
      deckCards: [],
    })),
    villain: card('01094') as VillainCard,
    mainScheme: card('01097b') as MainSchemeCard,
    skipMulligan: true,
  });
  state.phase = GamePhase.PLAYER_PHASE;
  state.activePlayerIndex = 0;
  return thaw(state);
}

function towerFor(state: GameState, playerIndex: number): CardInstance {
  const tower = createCardInstance(card('03024'));
  state.players[playerIndex].tableau.push(tower);
  return tower;
}

function exhaustTower(state: GameState, playerId: string, tower: CardInstance): GameState {
  const res = dispatchAction(state, {
    type: 'USE_CARD_ABILITY',
    playerId,
    cardInstanceId: tower.instanceId,
    abilityId: 'avengers_tower_action',
  });
  expect(res.result.success).toBe(true);
  return thaw(res.state);
}

/** Puts the ally and exactly `pay` one-resource cards in hand, then plays the ally with them. */
function playAlly(state: GameState, playerId: string, code: string, pay: number): GameState {
  const player = state.players.find((p) => p.id === playerId)!;
  const ally = createCardInstance(card(code));
  const payment = Array.from({ length: pay }, () => createCardInstance(oneWild));
  player.hand.push(ally, ...payment);
  const res = dispatchAction(state, {
    type: 'PLAY_CARD',
    playerId,
    cardInstanceId: ally.instanceId,
    paymentCardInstanceIds: payment.map((c) => c.instanceId),
  });
  expect(res.result.success, res.result.error).toBe(true);
  return thaw(res.state);
}

function costFor(state: GameState, playerIndex: number, code: string): number {
  const player = state.players[playerIndex];
  return getEffectiveCardCost(state, player, createCardInstance(card(code))).effectiveCost;
}

function endTurn(state: GameState, playerId: string): GameState {
  const res = dispatchAction(state, { type: 'END_PLAYER_TURN', playerId });
  expect(res.result.success).toBe(true);
  return thaw(res.state);
}

function putAlliesInPlay(state: GameState, playerIndex: number, codes: string[]): void {
  for (const code of codes) state.players[playerIndex].allies.push(createCardInstance(card(code)));
}

describe('Avengers Tower (03024): next Avenger ally discount', () => {
  it('A. a non-Avenger ally pays full and leaves the discount; the next Avenger ally costs 1 less', () => {
    let state = newGame(1);
    const tower = towerFor(state, 0);

    state = exhaustTower(state, 'p1', tower);
    expect(costFor(state, 0, MOCKINGBIRD)).toBe(3);

    state = playAlly(state, 'p1', MOCKINGBIRD, 3);
    expect(state.activeCostReductions).toHaveLength(1);
    expect(costFor(state, 0, HAWKEYE)).toBe(2);

    state = playAlly(state, 'p1', HAWKEYE, 2);
    expect(state.activeCostReductions).toEqual([]);
    expect(state.players[0].allies.map((a) => a.card.code)).toEqual([MOCKINGBIRD, HAWKEYE]);
  });

  it("A2. seat 1 exhausts the Tower and ends the turn; seat 2's Hulk costs 1, then Hawkeye costs 3", () => {
    let state = newGame(2);
    const tower = towerFor(state, 0);

    state = exhaustTower(state, 'p1', tower);
    state = endTurn(state, 'p1');
    expect(state.activePlayerIndex).toBe(1);
    expect(costFor(state, 1, HULK)).toBe(1);

    state = playAlly(state, 'p2', HULK, 1);
    expect(state.activeCostReductions).toEqual([]);
    expect(costFor(state, 1, HAWKEYE)).toBe(3);
  });

  it("A3. seat 1 exhausts the Tower and plays Hawkeye for 2; seat 2's Hulk then costs 2", () => {
    let state = newGame(2);
    const tower = towerFor(state, 0);

    state = exhaustTower(state, 'p1', tower);
    state = playAlly(state, 'p1', HAWKEYE, 2);
    state = endTurn(state, 'p1');

    expect(state.activeCostReductions).toEqual([]);
    expect(costFor(state, 1, HULK)).toBe(2);
  });

  it('A4. an unused discount survives the end of the turn and ends with the player phase', () => {
    let state = newGame(2);
    const tower = towerFor(state, 0);

    state = exhaustTower(state, 'p1', tower);
    state = endTurn(state, 'p1');
    expect(state.activeCostReductions).toHaveLength(1);

    const round = state.roundNumber;
    state = endTurn(state, 'p2');
    // End of player phase clean-up: each player keeps their hand
    while (state.phase === GamePhase.PLAYER_PHASE && state.pendingDecisionQueue.length > 0) {
      const prompt = state.pendingDecisionQueue[0];
      const res = dispatchAction(state, {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId: prompt.playerId,
        selectedOptionId: '',
        selectedOptionIds: [],
      });
      expect(res.result.success, res.result.error).toBe(true);
      state = thaw(res.state);
    }

    // The player phase is over: the villain phase runs, or already ran into the next round
    expect(state.phase !== GamePhase.PLAYER_PHASE || state.roundNumber > round).toBe(true);
    expect(state.activeCostReductions).toEqual([]);
    expect(state.log.some((e) => e.key === 'cost.reduction.expired')).toBe(true);
    expect(costFor(state, 1, HULK)).toBe(2);
  });
});

describe('Avengers Tower (03024): ally limit', () => {
  it('B. raises the limit to 4 while every ally is an Avenger', () => {
    let state = newGame(1);
    towerFor(state, 0);
    putAlliesInPlay(state, 0, [HAWKEYE, SPIDER_WOMAN, HELLCAT]);
    expect(getEffectiveAllyLimit(state.players[0], state)).toBe(4);

    state = playAlly(state, 'p1', TIGRA, 3);
    expect(state.players[0].allies).toHaveLength(4);
    expect(state.pendingDecisionQueue).toEqual([]);
  });

  it('B. counts as 4 with no allies in play ("each of your allies")', () => {
    const state = newGame(1);
    towerFor(state, 0);
    expect(getEffectiveAllyLimit(state.players[0], state)).toBe(4);
  });

  it("B. raises only its controller's limit", () => {
    const state = newGame(2);
    towerFor(state, 0);
    expect(getEffectiveAllyLimit(state.players[1], state)).toBe(3);
  });

  it('C. a non-Avenger ally can be played; its controller then discards down to 3 before her Response', () => {
    let state = newGame(1);
    towerFor(state, 0);
    putAlliesInPlay(state, 0, [HAWKEYE, SPIDER_WOMAN, HELLCAT, TIGRA]);
    // Mockingbird's Response needs a target to be offered
    state.players[0].engagedMinions.push(createCardInstance(card('01099')));

    state = playAlly(state, 'p1', MOCKINGBIRD, 3);
    expect(state.players[0].allies).toHaveLength(5);
    expect(getEffectiveAllyLimit(state.players[0], state)).toBe(3);

    const first = state.pendingDecisionQueue[0];
    expect(first.title).toBe('Ally Limit Exceeded');
    expect(first.options.map((o) => o.cardCode)).toContain(MOCKINGBIRD);
    expect(state.pendingDecisionQueue.length).toBeGreaterThan(1);

    for (const code of [HAWKEYE, SPIDER_WOMAN]) {
      const prompt = state.pendingDecisionQueue[0];
      expect(prompt.title).toBe('Ally Limit Exceeded');
      const res = dispatchAction(state, {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId: 'p1',
        selectedOptionId: prompt.options.find((o) => o.cardCode === code)!.id,
      });
      expect(res.result.success, res.result.error).toBe(true);
      state = thaw(res.state);
    }

    expect(state.players[0].allies.map((a) => a.card.code)).toEqual([HELLCAT, TIGRA, MOCKINGBIRD]);
    expect(state.players[0].discard.map((c) => c.card.code)).toEqual(
      expect.arrayContaining([HAWKEYE, SPIDER_WOMAN]),
    );
    expect(state.pendingDecisionQueue.some((p) => p.title === 'Ally Limit Exceeded')).toBe(false);
  });

  it('D. the Tower leaving play drops the limit to 3 and asks for one ally to discard', () => {
    let state = newGame(1);
    const tower = towerFor(state, 0);
    putAlliesInPlay(state, 0, [HAWKEYE, SPIDER_WOMAN, HELLCAT, TIGRA]);
    // A support whose Action discards the Tower stands in for an encounter card that does
    const demolition = createCardInstance({
      ...card('01092'),
      code: 'test_demolition',
      name: 'Test Demolition',
      enrichment: {
        abilities: [
          {
            id: 'test_demolition_action',
            timing: 'ACTION',
            steps: [
              {
                effect: 'DISCARD',
                effectParams: { source: 'TABLEAU', targetInstanceId: tower.instanceId },
              },
            ],
          },
        ],
      },
    });
    state.players[0].tableau.push(demolition);

    const res = dispatchAction(state, {
      type: 'USE_CARD_ABILITY',
      playerId: 'p1',
      cardInstanceId: demolition.instanceId,
      abilityId: 'test_demolition_action',
    });
    expect(res.result.success, res.result.error).toBe(true);
    state = thaw(res.state);

    expect(state.players[0].tableau.some((c) => c.instanceId === tower.instanceId)).toBe(false);
    const prompt = state.pendingDecisionQueue[0];
    expect(prompt.title).toBe('Ally Limit Exceeded');
    expect(prompt.description).toContain('ally limit is 3');
  });
});
