import { describe, it, expect, beforeEach } from 'vitest';
import { recordDispatchedTriggers } from '../helpers/kernel-spy';
import { overrideCard } from '../support/card-overrides';
import { cardCatalog } from '../../src/data/importer/card-loader';
import {
  GameState,
  HeroCard,
  AlterEgoCard,
  StatusCard,
  Keyword,
  CardInstance,
  MinionCard,
  getActiveMainScheme,
  getActiveVillain,
} from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { dispatchAction } from '@engine/pipeline/action-dispatcher';
import { executeEffect } from '@engine/effects';

const dispatched = recordDispatchedTriggers();

describe('Status Cancellation for Labeled Abilities (#270)', () => {
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

  const whiplash = (health = 8): CardInstance => {
    const m = createCardInstance(cardCatalog.getCard('01172')!); // Whiplash: Retaliate 1
    m.card = { ...m.card, health } as MinionCard;
    state.players[0].engagedMinions.push(m);
    return m;
  };

  it('Stunned hero playing Uppercut (01054): pays 3 resources, discards card, clears Stunned, deals 0 damage, provokes no Retaliate, dispatches no ATTACK_RESOLVED', () => {
    const m = whiplash();
    const heroHealthBefore = state.players[0].health;
    state.players[0].statusCards.push(StatusCard.STUNNED);

    const uppercut = give('01054');
    const pay1 = give('01005');
    const pay2 = give('01005');
    const pay3 = give('01005');

    const res = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardInstanceId: uppercut.instanceId,
      paymentCardInstanceIds: [pay1.instanceId, pay2.instanceId, pay3.instanceId],
      targetInstanceId: m.instanceId,
    });

    expect(res.result.success).toBe(true);
    expect(res.state.players[0].statusCards).not.toContain(StatusCard.STUNNED);
    expect(res.state.players[0].discard.some((c) => c.instanceId === uppercut.instanceId)).toBe(
      true,
    );
    // 0 damage dealt to Whiplash
    expect(m.tokens?.damage || 0).toBe(0);
    // Hero took no retaliate damage
    expect(res.state.players[0].health).toBe(heroHealthBefore);
    // No ATTACK_RESOLVED dispatched
    expect(dispatched.some((d) => d.trigger === 'ATTACK_RESOLVED')).toBe(false);
  });

  describe('Synthetic dual-label ability [ATTACK, THWART]', () => {
    const dualAbility = {
      id: 'dual_strike_thwart',
      timing: 'HERO_ACTION' as const,
      labels: ['ATTACK', 'THWART'] as ('ATTACK' | 'THWART')[],
      steps: [
        { effect: 'DEAL_DAMAGE', effectParams: { amount: 3, target: 'VILLAIN' } },
        { effect: 'REMOVE_THREAT', effectParams: { amount: 2, target: 'MAIN_SCHEME' } },
      ],
    };

    it('clears both statuses and cancels ability when hero has both Stunned and Confused', () => {
      state.players[0].statusCards = [StatusCard.STUNNED, StatusCard.CONFUSED];
      getActiveMainScheme(state).threat = 5;
      const villainHp = getActiveVillain(state).health;

      const res = executeEffect(
        state,
        dualAbility as any,
        {
          playerId: 'p1',
        } as any,
      );

      expect(res.success).toBe(true);
      expect(res.state.players[0].statusCards).not.toContain(StatusCard.STUNNED);
      expect(res.state.players[0].statusCards).not.toContain(StatusCard.CONFUSED);
      expect(getActiveVillain(res.state).health).toBe(villainHp);
      expect(getActiveMainScheme(res.state).threat).toBe(5);
    });

    it('clears Stunned and cancels ability when hero has only Stunned', () => {
      state.players[0].statusCards = [StatusCard.STUNNED];
      getActiveMainScheme(state).threat = 5;
      const villainHp = getActiveVillain(state).health;

      const res = executeEffect(
        state,
        dualAbility as any,
        {
          playerId: 'p1',
        } as any,
      );

      expect(res.success).toBe(true);
      expect(res.state.players[0].statusCards).not.toContain(StatusCard.STUNNED);
      expect(getActiveVillain(res.state).health).toBe(villainHp);
      expect(getActiveMainScheme(res.state).threat).toBe(5);
    });

    it('clears Confused and cancels ability when hero has only Confused', () => {
      state.players[0].statusCards = [StatusCard.CONFUSED];
      getActiveMainScheme(state).threat = 5;
      const villainHp = getActiveVillain(state).health;

      const res = executeEffect(
        state,
        dualAbility as any,
        {
          playerId: 'p1',
        } as any,
      );

      expect(res.success).toBe(true);
      expect(res.state.players[0].statusCards).not.toContain(StatusCard.CONFUSED);
      expect(getActiveVillain(res.state).health).toBe(villainHp);
      expect(getActiveMainScheme(res.state).threat).toBe(5);
    });
  });

  it('Steady hero with 1 Stunned playing Uppercut: not incapacitated, resolves attack normally without clearing the 1 Stunned', () => {
    overrideCard(state, state.players[0].hero, { keywords: [Keyword.STEADY] });
    state.players[0].statusCards = [StatusCard.STUNNED];
    const initialVillainHp = getActiveVillain(state).health;

    const uppercut = give('01054');
    const pay1 = give('01005');
    const pay2 = give('01005');
    const pay3 = give('01005');

    const res = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardInstanceId: uppercut.instanceId,
      paymentCardInstanceIds: [pay1.instanceId, pay2.instanceId, pay3.instanceId],
      targetInstanceId: getActiveVillain(state).instanceId || 'rhino',
    });

    expect(res.result.success).toBe(true);
    // Attack resolved normally: dealt 5 damage to Rhino
    expect(getActiveVillain(res.state).health).toBe(initialVillainHp - 5);
    // Stunned status was NOT consumed
    expect(res.state.players[0].statusCards).toContain(StatusCard.STUNNED);
    expect(dispatched.some((d) => d.trigger === 'ATTACK_RESOLVED')).toBe(true);
  });
});
