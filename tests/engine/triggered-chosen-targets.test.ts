import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '@data/importer/card-loader';
import {
  GameState,
  HeroCard,
  AlterEgoCard,
  MinionCard,
  CardInstance,
  StatusCard,
  getActiveVillain,
} from '@engine/models';
import { setupGame, createCardInstance, resetInstanceCounter } from '@engine/state/game-setup';
import { dispatchAction, peekDecisionPrompt } from '@engine/index';

// #234: an ability whose effect targets "an enemy" / "a scheme" (CHOSEN_*) lets the player choose
// among the valid targets when it resolves. Optional abilities keep their "Do you want to use" prompt
// first (RR v1.8 Initiating Abilities); the target list is built when the target prompt opens.
describe('Triggered abilities with a CHOSEN_* target let the player choose (#234)', () => {
  let state: GameState;

  const setup = (hero = '01001a', alterEgo = '01001b') => {
    resetInstanceCounter();
    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'P1',
          hero: cardCatalog.getCard(hero) as HeroCard,
          alterEgo: cardCatalog.getCard(alterEgo) as AlterEgoCard,
          deckCards: Array(20).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
      shuffleFn: (arr) => arr,
    });
    const p = state.players[0];
    p.currentForm = 'hero';
    p.activeFormCard = p.hero;
    p.hand = [];
  };

  const p1 = () => state.players[0];
  const card = (code: string) => createCardInstance(cardCatalog.getCard(code)!);
  const engageMinion = (): CardInstance => {
    const m = createCardInstance(cardCatalog.getCard('01101') as MinionCard); // Hydra Mercenary, 3 HP
    p1().engagedMinions.push(m);
    return m;
  };
  const minion = (id: string) => p1().engagedMinions.find((m) => m.instanceId === id);
  const minionDamage = (id: string) => minion(id)?.tokens?.damage ?? 0;
  const resolve = (optionId: string) => {
    const res = dispatchAction(state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: optionId,
    });
    state = res.state;
    return res;
  };
  const answerYes = () => {
    const prompt = peekDecisionPrompt(state)!;
    expect(prompt.isVoluntary).toBe(true);
    resolve(prompt.options.find((o) => o.label === 'Yes')!.id);
  };
  const targetOptionFor = (instanceId: string) =>
    peekDecisionPrompt(state)!.options.find(
      (o) => o.id === instanceId || o.params?.targetInstanceId === instanceId,
    );
  const playWithPayment = (inst: CardInstance, cost: number) => {
    const payment = Array.from({ length: cost }, () => card('01005'));
    p1().hand = [inst, ...payment];
    const res = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardInstanceId: inst.instanceId,
      paymentCardInstanceIds: payment.map((c) => c.instanceId),
    });
    expect(res.result.success).toBe(true);
    state = res.state;
  };
  const daredevilThwarts = () => {
    const dd = card('01058');
    p1().allies = [dd];
    state.mainScheme.threat = 5;
    const res = dispatchAction(state, {
      type: 'ALLY_THWART',
      playerId: 'p1',
      allyInstanceId: dd.instanceId,
      targetType: 'main_scheme',
    });
    expect(res.result.success).toBe(true);
    state = res.state;
  };

  beforeEach(() => setup());

  it('Daredevil (01058): after Yes, a prompt lists Rhino and the minion; the chosen minion takes the damage', () => {
    const m = engageMinion();
    const villainHp = getActiveVillain(state).health;
    daredevilThwarts();
    answerYes();

    const option = targetOptionFor(m.instanceId);
    expect(option).toBeDefined();
    expect(targetOptionFor(getActiveVillain(state).instanceId!)).toBeDefined();
    resolve(option!.id);

    expect(minionDamage(m.instanceId)).toBe(1);
    expect(getActiveVillain(state).health).toBe(villainHp);
  });

  it('Daredevil with only Rhino in play: no target prompt, Rhino takes the damage', () => {
    const villainHp = getActiveVillain(state).health;
    daredevilThwarts();
    answerYes();
    expect(peekDecisionPrompt(state)).toBeUndefined();
    expect(getActiveVillain(state).health).toBe(villainHp - 1);
  });

  it('answering No does nothing and opens no target prompt', () => {
    engageMinion();
    const villainHp = getActiveVillain(state).health;
    daredevilThwarts();
    resolve('pass');
    expect(peekDecisionPrompt(state)).toBeUndefined();
    expect(getActiveVillain(state).health).toBe(villainHp);
  });

  it('the target list is built when the target prompt opens, not when Yes is offered', () => {
    const m = engageMinion();
    const villainHp = getActiveVillain(state).health;
    daredevilThwarts();
    // The board changes before the player answers (e.g. another effect defeats the minion).
    p1().engagedMinions = p1().engagedMinions.filter((x) => x.instanceId !== m.instanceId);
    answerYes();
    expect(peekDecisionPrompt(state)).toBeUndefined();
    expect(getActiveVillain(state).health).toBe(villainHp - 1);
  });

  it('Mockingbird (01083): the chosen enemy is stunned', () => {
    const m = engageMinion();
    playWithPayment(card('01083'), 3);
    answerYes();
    resolve(targetOptionFor(m.instanceId)!.id);
    expect(minion(m.instanceId)!.statusCards).toContain(StatusCard.STUNNED);
    expect(getActiveVillain(state).statusCards).not.toContain(StatusCard.STUNNED);
  });

  it('Mockingbird: an already stunned enemy is not a valid target, so the only valid one is used', () => {
    const m = engageMinion();
    getActiveVillain(state).statusCards = [StatusCard.STUNNED];
    playWithPayment(card('01083'), 3);
    answerYes();
    expect(peekDecisionPrompt(state)).toBeUndefined();
    expect(minion(m.instanceId)!.statusCards).toContain(StatusCard.STUNNED);
  });

  it('Mockingbird: with every enemy already stunned, the Response is not offered', () => {
    getActiveVillain(state).statusCards = [StatusCard.STUNNED];
    playWithPayment(card('01083'), 3);
    expect(peekDecisionPrompt(state)).toBeUndefined();
  });

  describe('Interrogation Room (01063)', () => {
    let room: CardInstance;
    let sideScheme: any;

    const defeatMinion = () => {
      const m = engageMinion();
      m.tokens = { ...(m.tokens ?? {}), damage: 2 }; // 3 HP: the hero's attack defeats it
      const res = dispatchAction(state, {
        type: 'BASIC_ATTACK',
        playerId: 'p1',
        targetType: 'minion',
        targetInstanceId: m.instanceId,
      });
      expect(res.result.success).toBe(true);
      state = res.state;
      expect(minion(m.instanceId)).toBeUndefined();
    };

    beforeEach(() => {
      room = card('01063');
      p1().tableau = [room];
      sideScheme = createCardInstance(cardCatalog.getCard('01107')!) as any;
      sideScheme.threat = 3;
      state.sideSchemes.push(sideScheme);
      state.mainScheme.threat = 4;
    });

    it('after Yes, the scheme prompt opens and the chosen side scheme loses 1 threat', () => {
      defeatMinion();
      answerYes();
      resolve(targetOptionFor(sideScheme.instanceId)!.id);
      expect(state.sideSchemes[0].threat).toBe(2);
      expect(state.mainScheme.threat).toBe(4);
    });

    it('a target that disappears before Yes aborts the ability and the cost is not paid', () => {
      state.sideSchemes = [];
      defeatMinion();
      state.mainScheme.threat = 0; // no scheme with removable threat remains
      answerYes();
      expect(peekDecisionPrompt(state)).toBeUndefined();
      expect(p1().tableau.find((c) => c.instanceId === room.instanceId)!.exhausted).toBeFalsy();
    });
  });

  it('She-Hulk (01019a): after changing to hero form, the chosen enemy takes 2 damage', () => {
    setup('01019a', '01019b');
    p1().currentForm = 'alter_ego';
    p1().activeFormCard = p1().alterEgo;
    const m = engageMinion();
    const villainHp = getActiveVillain(state).health;
    const res = dispatchAction(state, { type: 'CHANGE_FORM', playerId: 'p1' });
    expect(res.result.success).toBe(true);
    state = res.state;
    answerYes();
    resolve(targetOptionFor(m.instanceId)!.id);
    expect(minionDamage(m.instanceId)).toBe(2);
    expect(getActiveVillain(state).health).toBe(villainHp);
  });

  it('Superhuman Strength (01028): "stun the attacked enemy" stuns the attacked minion, not Rhino', () => {
    setup('01019a', '01019b');
    p1().tableau = [card('01028')];
    const sturdy = createCardInstance({
      ...(cardCatalog.getCard('01101') as MinionCard),
      health: 12,
    } as MinionCard);
    p1().engagedMinions.push(sturdy);
    const res = dispatchAction(state, {
      type: 'BASIC_ATTACK',
      playerId: 'p1',
      targetType: 'minion',
      targetInstanceId: sturdy.instanceId,
    });
    expect(res.result.success).toBe(true);
    state = res.state;
    expect(minion(sturdy.instanceId)!.statusCards).toContain(StatusCard.STUNNED);
    expect(getActiveVillain(state).statusCards).not.toContain(StatusCard.STUNNED);
  });

  it('Nick Fury (01084): the "deal 4 damage" option prompts for the enemy and hits the chosen one', () => {
    const m = engageMinion();
    const villainHp = getActiveVillain(state).health;
    playWithPayment(card('01084'), 4);
    resolve('deal_4_damage');
    resolve(targetOptionFor(m.instanceId)!.id);
    expect(minion(m.instanceId)).toBeUndefined(); // 4 damage defeats the 3 HP minion
    expect(getActiveVillain(state).health).toBe(villainHp);
  });
});
