import { describe, it, expect, beforeEach } from 'vitest';
import { recordDispatchedTriggers } from '../helpers/kernel-spy';
import { cardCatalog } from '../../src/data/importer/card-loader';
import {
  GameState,
  HeroCard,
  AlterEgoCard,
  StatusCard,
  SideSchemeCard,
  getActiveMainScheme,
} from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { dispatchAction } from '@engine/pipeline/action-dispatcher';
import { canPlayCard } from '@engine/pipeline/legality-checker';

const dispatched = recordDispatchedTriggers();

describe('THWART Labeled Ability Resolution (#270)', () => {
  let state: GameState;

  const makePlayer = (id: string, hero: string, alterEgo: string) => ({
    id,
    name: id,
    hero: cardCatalog.getCard(hero) as HeroCard,
    alterEgo: cardCatalog.getCard(alterEgo) as AlterEgoCard,
    deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
  });

  beforeEach(() => {
    dispatched.length = 0;
    state = setupGame({
      catalog: cardCatalog,
      scenarioId: 'rhino',
      players: [makePlayer('p1', '01001a', '01001b')],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = state.players[0].hero;
    state.players[0].hand = [];
    state.players[0].discard = [];
    dispatched.length = 0;
  });

  const give = (code: string) => {
    const inst = createCardInstance(cardCatalog.getCard(code)!, 'p1');
    state.players[0].hand.push(inst);
    return inst;
  };

  const thwarted = () => dispatched.filter((d) => d.trigger === 'THWART_RESOLVED');

  it('For Justice! (01060) removes threat and dispatches THWART_RESOLVED once as a thwart by the identity', () => {
    getActiveMainScheme(state).threat = 5;
    const fj = give('01060');
    // Pay with 01003 (Backflip, physical resource) so no mental bonus applies (removes base 3 threat)
    const pay1 = give('01003');
    const pay2 = give('01003');

    const res = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardInstanceId: fj.instanceId,
      paymentCardInstanceIds: [pay1.instanceId, pay2.instanceId],
      targetInstanceId: getActiveMainScheme(state).instanceId,
    });

    expect(res.result.success).toBe(true);
    expect(getActiveMainScheme(res.state).threat).toBe(2); // 5 - 3 = 2
    expect(thwarted()).toHaveLength(1);
    expect(thwarted()[0].context).toMatchObject({
      targetPlayerId: 'p1',
      threatAmount: 3,
      sourceInstanceId: 'p1',
      sourceCardCode: '01001a',
    });
  });

  it('Crisis Interdiction (01012) with Aerial removes threat from two schemes and dispatches THWART_RESOLVED once, not twice', () => {
    // Give hero Aerial trait
    const cmHero = {
      ...(cardCatalog.getCard('01010a') as HeroCard),
      traits: ['Avenger', 'Aerial'],
    };
    state.players[0].hero = cmHero;
    state.players[0].activeFormCard = cmHero;

    getActiveMainScheme(state).threat = 4;
    const sideSchemeCard = cardCatalog.getCard('01107') as SideSchemeCard; // The Break-In side scheme
    const sideSchemeInst = createCardInstance(sideSchemeCard);
    state.sideSchemes.push({
      instanceId: sideSchemeInst.instanceId,
      card: sideSchemeCard,
      threat: 3,
    });

    const ci = give('01012');
    const pay1 = give('01003');
    const pay2 = give('01003');

    const res = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardInstanceId: ci.instanceId,
      paymentCardInstanceIds: [pay1.instanceId, pay2.instanceId],
      targetInstanceId: getActiveMainScheme(state).instanceId,
    });

    expect(res.result.success).toBe(true);
    expect(getActiveMainScheme(res.state).threat).toBe(2); // 4 - 2
    expect(res.state.sideSchemes[0].threat).toBe(1); // 3 - 2
    expect(thwarted()).toHaveLength(1);
  });

  it('Confused hero playing For Justice!: pays 2 resources, discards card, clears Confused status, removes 0 threat, dispatches no THWART_RESOLVED', () => {
    getActiveMainScheme(state).threat = 5;
    state.players[0].statusCards.push(StatusCard.CONFUSED);

    const fj = give('01060');
    const pay1 = give('01003');
    const pay2 = give('01003');

    const res = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardInstanceId: fj.instanceId,
      paymentCardInstanceIds: [pay1.instanceId, pay2.instanceId],
      targetInstanceId: getActiveMainScheme(state).instanceId,
    });

    expect(res.result.success).toBe(true);
    expect(res.state.players[0].statusCards).not.toContain(StatusCard.CONFUSED);
    expect(getActiveMainScheme(res.state).threat).toBe(5); // 0 removed
    expect(res.state.players[0].discard.some((c) => c.instanceId === fj.instanceId)).toBe(true);
    expect(thwarted()).toHaveLength(0);
  });

  it('Confused hero using Mark V Helmet (01037): exhausts helmet, clears Confused status, removes 0 threat', () => {
    getActiveMainScheme(state).threat = 5;
    state.players[0].statusCards.push(StatusCard.CONFUSED);

    const helmet = createCardInstance(cardCatalog.getCard('01037')!, 'p1');
    state.players[0].tableau.push(helmet);

    const res = dispatchAction(state, {
      type: 'USE_CARD_ABILITY',
      playerId: 'p1',
      cardInstanceId: helmet.instanceId,
      abilityId: 'mark_v_helmet',
    });

    expect(res.result.success).toBe(true);
    expect(res.state.players[0].tableau[0].exhausted).toBe(true);
    expect(res.state.players[0].statusCards).not.toContain(StatusCard.CONFUSED);
    expect(getActiveMainScheme(res.state).threat).toBe(5);
    expect(thwarted()).toHaveLength(0);
  });

  it('Confused hero playing For Justice! when all schemes have 0 threat is legally allowed to play it to clear Confused', () => {
    getActiveMainScheme(state).threat = 0;
    state.players[0].statusCards.push(StatusCard.CONFUSED);

    const fj = give('01060');
    const pay1 = give('01003');
    const pay2 = give('01003');

    const check = canPlayCard(state, 'p1', fj.instanceId, [pay1.instanceId, pay2.instanceId]);
    expect(check.allowed).toBe(true);

    const res = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardInstanceId: fj.instanceId,
      paymentCardInstanceIds: [pay1.instanceId, pay2.instanceId],
    });

    expect(res.result.success).toBe(true);
    expect(res.state.players[0].statusCards).not.toContain(StatusCard.CONFUSED);
    expect(getActiveMainScheme(res.state).threat).toBe(0);
  });
});
