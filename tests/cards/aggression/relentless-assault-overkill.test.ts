import { describe, it, expect, beforeEach } from 'vitest';
import {
  GameState,
  HeroCard,
  AlterEgoCard,
  StatusCard,
  GamePhase,
  getActiveMainScheme,
  getActiveVillain,
} from '@engine/models';
import { cardCatalog } from '../../../src/data/importer/card-loader';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { dispatchAction } from '@engine/pipeline/action-dispatcher';
import { peekDecisionPrompt } from '@engine/pipeline/prompt-queue';
import { thaw } from '../../support/thaw-state';
import { dispatchOk } from '../../support/game-fixtures';

function makeResources(type: 'physical' | 'energy' | 'mental' | 'wild', count: number) {
  return {
    physical: type === 'physical' ? count : 0,
    energy: type === 'energy' ? count : 0,
    mental: type === 'mental' ? count : 0,
    wild: type === 'wild' ? count : 0,
    total: count,
  };
}

describe('Issue #137 - Relentless Assault (01053) Overkill Invariants', () => {
  let state: GameState;
  let spiderManHero: HeroCard;
  let peterParkerAlterEgo: AlterEgoCard;

  beforeEach(() => {
    spiderManHero = cardCatalog.getCard('01001a') as HeroCard;
    peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;

    state = setupGame({
      catalog: cardCatalog,
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    state.phase = GamePhase.PLAYER_PHASE;
    state.activePlayerIndex = 0;
    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = spiderManHero;
    state.players[0].hand = [];
  });

  it('Player pays with Physical resource: attack gains Overkill and routes excess damage to Villain, NOT scheme threat', () => {
    const p1 = state.players[0];
    const initialVillainHp = getActiveVillain(state).health;
    const initialSchemeThreat = getActiveMainScheme(state).threat;

    // Minion with 2 HP (Hydra Bomber 01110)
    const minionCard = cardCatalog.getCard('01110')!;
    const minionInst = createCardInstance(minionCard);
    p1.engagedMinions.push(minionInst);

    // Relentless Assault (01053) - costs 2
    const relentlessCard = cardCatalog.getCard('01053')!;
    const assaultInst = createCardInstance(relentlessCard);

    // Payment cards: 1 physical resource card + 1 energy resource card
    const payPhysical = createCardInstance({
      ...cardCatalog.getCard('01005')!,
      resources: makeResources('physical', 1),
    });
    const payEnergy = createCardInstance({
      ...cardCatalog.getCard('01014')!,
      resources: makeResources('energy', 1),
    });

    p1.hand = [assaultInst, payPhysical, payEnergy];

    const res = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: p1.id,
      cardInstanceId: assaultInst.instanceId,
      targetInstanceId: minionInst.instanceId,
      paymentCardInstanceIds: [payPhysical.instanceId, payEnergy.instanceId],
    });

    expect(res.result.success).toBe(true);
    // Minion is defeated
    expect(res.state.players[0].engagedMinions.length).toBe(0);
    // Overkill excess damage: 5 damage - 2 HP = 3 excess damage dealt to Villain
    expect(getActiveVillain(res.state).health).toBe(initialVillainHp - 3);
    // Main scheme threat MUST remain completely unchanged by Overkill!
    expect(getActiveMainScheme(res.state).threat).toBe(initialSchemeThreat);
  });

  it('Player pays with non-Physical resources (Energy/Mental): attack does NOT gain Overkill', () => {
    const p1 = state.players[0];
    const initialVillainHp = getActiveVillain(state).health;

    // Minion with 2 HP (Hydra Bomber 01110)
    const minionCard = cardCatalog.getCard('01110')!;
    const minionInst = createCardInstance(minionCard);
    p1.engagedMinions.push(minionInst);

    // Relentless Assault (01053) - costs 2
    const relentlessCard = cardCatalog.getCard('01053')!;
    const assaultInst = createCardInstance(relentlessCard);

    // Payment cards: 2 energy resource cards (NO physical resource)
    const payEnergy1 = createCardInstance({
      ...cardCatalog.getCard('01014')!,
      resources: makeResources('energy', 1),
    });
    const payEnergy2 = createCardInstance({
      ...cardCatalog.getCard('01014')!,
      resources: makeResources('energy', 1),
    });

    p1.hand = [assaultInst, payEnergy1, payEnergy2];

    const res = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: p1.id,
      cardInstanceId: assaultInst.instanceId,
      targetInstanceId: minionInst.instanceId,
      paymentCardInstanceIds: [payEnergy1.instanceId, payEnergy2.instanceId],
    });

    expect(res.result.success).toBe(true);
    // Minion is defeated
    expect(res.state.players[0].engagedMinions.length).toBe(0);
    // WITHOUT physical resource kicker, NO overkill: Villain takes 0 damage!
    expect(getActiveVillain(res.state).health).toBe(initialVillainHp);
  });

  it('Overkill damage to Villain is absorbed by Tough status card per RR v1.8 p. 22', () => {
    const p1 = state.players[0];
    getActiveVillain(state).statusCards = [StatusCard.TOUGH];
    const initialVillainHp = getActiveVillain(state).health;

    const minionCard = cardCatalog.getCard('01110')!;
    const minionInst = createCardInstance(minionCard);
    p1.engagedMinions.push(minionInst);

    const relentlessCard = cardCatalog.getCard('01053')!;
    const assaultInst = createCardInstance(relentlessCard);

    const payPhysical1 = createCardInstance({
      ...cardCatalog.getCard('01005')!,
      resources: makeResources('physical', 1),
    });
    const payPhysical2 = createCardInstance({
      ...cardCatalog.getCard('01005')!,
      resources: makeResources('physical', 1),
    });

    p1.hand = [assaultInst, payPhysical1, payPhysical2];

    const res = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: p1.id,
      cardInstanceId: assaultInst.instanceId,
      targetInstanceId: minionInst.instanceId,
      paymentCardInstanceIds: [payPhysical1.instanceId, payPhysical2.instanceId],
    });

    expect(res.result.success).toBe(true);
    // Minion defeated
    expect(res.state.players[0].engagedMinions.length).toBe(0);
    // Tough card absorbed the 3 excess overkill damage!
    expect(getActiveVillain(res.state).statusCards.includes(StatusCard.TOUGH)).toBe(false);
    expect(getActiveVillain(res.state).health).toBe(initialVillainHp);
  });

  it('Minion with Spider-Tracer defeated by Relentless Assault: Overkill damages Villain AND Spider-Tracer removes threat with proper prompt provenance', () => {
    const p1 = state.players[0];
    const initialVillainHp = getActiveVillain(state).health;

    // Minion with 2 HP (Hydra Bomber 01110)
    const minionCard = cardCatalog.getCard('01110')!;
    const minionInst = createCardInstance(minionCard);

    // Attach Spider-Tracer (01007) to the minion
    const tracerCard = cardCatalog.getCard('01007')!;
    const tracerInst = createCardInstance(tracerCard);
    (tracerInst as any).ownerId = p1.id;
    minionInst.attachments = [tracerInst];

    p1.engagedMinions.push(minionInst);

    // Add a side scheme so Spider-Tracer prompts for scheme choice. Both schemes need threat to be
    // valid targets for "remove 3 threat" (RR v1.8 "Target", #234).
    getActiveMainScheme(state).threat = 3;
    const sideSchemeCard = cardCatalog.getCard('01109')!; // Bomb Scare
    const sideSchemeInst = createCardInstance(sideSchemeCard);
    (sideSchemeInst as any).threat = 3;
    state.sideSchemes.push(sideSchemeInst as any);

    const relentlessCard = cardCatalog.getCard('01053')!;
    const assaultInst = createCardInstance(relentlessCard);

    const payPhysical1 = createCardInstance({
      ...cardCatalog.getCard('01005')!,
      resources: makeResources('physical', 1),
    });
    const payPhysical2 = createCardInstance({
      ...cardCatalog.getCard('01005')!,
      resources: makeResources('physical', 1),
    });

    p1.hand = [assaultInst, payPhysical1, payPhysical2];

    const res = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: p1.id,
      cardInstanceId: assaultInst.instanceId,
      targetInstanceId: minionInst.instanceId,
      paymentCardInstanceIds: [payPhysical1.instanceId, payPhysical2.instanceId],
    });

    expect(res.result.success).toBe(true);
    // Minion is defeated
    expect(res.state.players[0].engagedMinions.length).toBe(0);
    // Overkill excess damage (5 - 2 = 3) was dealt to Villain
    expect(getActiveVillain(res.state).health).toBe(initialVillainHp - 3);

    // Spider-Tracer prompted for scheme choice with complete provenance metadata
    const activePrompt = peekDecisionPrompt(res.state);
    expect(activePrompt).toBeDefined();
    expect(activePrompt?.sourceCardName).toBe('Spider-Tracer');
    expect(activePrompt?.sourceCardCode).toBe('01007');
    expect(activePrompt?.options[0]?.cardCode).toBe('01097b');
    expect(activePrompt?.options[1]?.cardCode).toBe('01109');
  });

  function payment(type: 'physical' | 'energy' | 'mental' | 'wild', count = 1) {
    return createCardInstance({
      ...cardCatalog.getCard(type === 'energy' ? '01014' : '01005')!,
      resources: makeResources(type, count),
    });
  }

  function playAssault(paying: ReturnType<typeof payment>[], minionInstanceId?: string) {
    const armed = thaw(state);
    const assault = createCardInstance(cardCatalog.getCard('01053')!);
    armed.players[0].hand = [assault, ...paying];
    return dispatchAction(armed, {
      type: 'PLAY_CARD',
      playerId: armed.players[0].id,
      cardInstanceId: assault.instanceId,
      targetInstanceId: minionInstanceId,
      paymentCardInstanceIds: paying.map((c) => c.instanceId),
    });
  }

  it('Player pays with a Wild resource: the attack gains Overkill', () => {
    const p1 = state.players[0];
    const initialVillainHp = getActiveVillain(state).health;
    const minion = createCardInstance(cardCatalog.getCard('01110')!);
    p1.engagedMinions.push(minion);

    const res = playAssault([payment('wild', 2)], minion.instanceId);

    expect(res.result.success).toBe(true);
    expect(res.state.players[0].engagedMinions.length).toBe(0);
    expect(getActiveVillain(res.state).health).toBe(initialVillainHp - 3);
  });

  it('The Overkill granted by a physical payment ends with the attack: a base attack and a later energy-paid Relentless Assault have none', () => {
    const p1 = state.players[0];
    const initialVillainHp = getActiveVillain(state).health;
    const m1 = createCardInstance(cardCatalog.getCard('01110')!);
    const m2 = createCardInstance(cardCatalog.getCard('01110')!);
    const m3 = createCardInstance(cardCatalog.getCard('01110')!);
    p1.engagedMinions.push(m1, m2, m3);
    // Strong enough for a base attack to leave excess damage on a 2 HP minion.
    p1.activeFormCard = { ...spiderManHero, attack: 4 } as HeroCard;

    // 1. Physical payment: Overkill, 3 excess damage to the villain.
    const first = playAssault([payment('physical', 2)], m1.instanceId);
    expect(first.result.success).toBe(true);
    expect(getActiveVillain(first.state).health).toBe(initialVillainHp - 3);
    state = first.state;

    // 2. A base attack right after: 4 damage on a 2 HP minion, no Overkill.
    const base = dispatchAction(state, {
      type: 'BASIC_ATTACK',
      playerId: 'p1',
      targetType: 'minion',
      targetInstanceId: m2.instanceId,
    });
    expect(base.result.success).toBe(true);
    expect(base.state.players[0].engagedMinions.some((m) => m.instanceId === m2.instanceId)).toBe(
      false,
    );
    expect(getActiveVillain(base.state).health).toBe(initialVillainHp - 3);
    state = base.state;

    // 3. Relentless Assault paid with energy only: no Overkill.
    const third = playAssault([payment('energy', 2)], m3.instanceId);
    expect(third.result.success).toBe(true);
    expect(third.state.players[0].engagedMinions.length).toBe(0);
    expect(getActiveVillain(third.state).health).toBe(initialVillainHp - 3);

    // Nothing persists on the card, the player or the game state.
    expect(JSON.stringify(third.state)).not.toContain('grantedAttackKeywords');
  });

  it('declares the Overkill as its own gated step before the damage step', () => {
    const steps = (cardCatalog.getCard('01053') as any).enrichment.abilities[0].steps;
    expect(steps.map((st: any) => st.effect)).toEqual(['GRANT_ATTACK_KEYWORD', 'DEAL_DAMAGE']);
    expect(steps[0].gate).toBe('IF_RESOURCE_MATCH');
    expect(steps[0].gateParams).toEqual({ resource: 'physical', count: 1 });
    expect(steps[0].effectParams).toEqual({ keyword: 'Overkill' });
    expect(steps[1].effectParams).toEqual({ amount: 5, target: 'CHOSEN_MINION' });
  });

  function minionOf(hitPoints: number) {
    const card = cardCatalog.getCard('01110')!;
    return createCardInstance({ ...card, health: hitPoints } as typeof card);
  }

  function logKeys(s: GameState) {
    return s.log.map((l) => l.key);
  }

  /** Plays Relentless Assault with no pre-chosen target and answers the target prompt. */
  function playAssaultAndChoose(
    paying: ReturnType<typeof payment>[],
    chosenInstanceId: string,
    from: GameState = state,
  ) {
    const armed = thaw(from);
    const assault = createCardInstance(cardCatalog.getCard('01053')!);
    armed.players[0].hand = [assault, ...paying];
    const played = dispatchOk(armed, {
      type: 'PLAY_CARD',
      playerId: armed.players[0].id,
      cardInstanceId: assault.instanceId,
      paymentCardInstanceIds: paying.map((c) => c.instanceId),
    });
    const prompt = peekDecisionPrompt(played);
    expect(prompt?.options.map((o) => o.id)).toContain(chosenInstanceId);
    return dispatchOk(played, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: armed.players[0].id,
      selectedOptionId: chosenInstanceId,
    });
  }

  describe('A. target chosen from a prompt (#342)', () => {
    it('A1: the Overkill granted by a physical payment survives the target prompt', () => {
      const initialVillainHp = getActiveVillain(state).health;
      const chosen = minionOf(3);
      const other = minionOf(2);
      state.players[0].engagedMinions.push(chosen, other);

      const after = playAssaultAndChoose([payment('physical', 2)], chosen.instanceId);

      const remaining = after.players[0].engagedMinions.map((m) => m.instanceId);
      expect(remaining).toEqual([other.instanceId]);
      expect(getActiveVillain(after).health).toBe(initialVillainHp - 2);
    });

    it('A2: paid with energy only, the prompt path grants no Overkill', () => {
      const initialVillainHp = getActiveVillain(state).health;
      const chosen = minionOf(3);
      state.players[0].engagedMinions.push(chosen, minionOf(2));

      const after = playAssaultAndChoose([payment('energy', 2)], chosen.instanceId);

      expect(after.players[0].engagedMinions.some((m) => m.instanceId === chosen.instanceId)).toBe(
        false,
      );
      expect(getActiveVillain(after).health).toBe(initialVillainHp);
      expect(logKeys(after)).not.toContain('overkill.hit');
    });

    it('A3: the keyword granted on the prompt path ends with the attack', () => {
      const initialVillainHp = getActiveVillain(state).health;
      const chosen = minionOf(3);
      const next = minionOf(2);
      state.players[0].engagedMinions.push(chosen, next);
      state.players[0].activeFormCard = { ...spiderManHero, attack: 4 } as HeroCard;

      const first = playAssaultAndChoose([payment('physical', 2)], chosen.instanceId);
      expect(getActiveVillain(first).health).toBe(initialVillainHp - 2);

      const base = dispatchOk(first, {
        type: 'BASIC_ATTACK',
        playerId: 'p1',
        targetType: 'minion',
        targetInstanceId: next.instanceId,
      });
      expect(base.players[0].engagedMinions.length).toBe(0);
      expect(getActiveVillain(base).health).toBe(initialVillainHp - 2);
    });

    it('A4: an exact kill on the prompt path deals no Overkill', () => {
      const initialVillainHp = getActiveVillain(state).health;
      const chosen = minionOf(5);
      state.players[0].engagedMinions.push(chosen, minionOf(2));

      const after = playAssaultAndChoose([payment('physical', 2)], chosen.instanceId);

      expect(after.players[0].engagedMinions.some((m) => m.instanceId === chosen.instanceId)).toBe(
        false,
      );
      expect(getActiveVillain(after).health).toBe(initialVillainHp);
      expect(logKeys(after)).not.toContain('overkill.hit');
    });
  });

  describe('B. Tough on the minion (RR v1.8 Tough: all damage is prevented)', () => {
    function expectToughPopped(after: GameState, minionId: string, initialVillainHp: number) {
      const minion = after.players[0].engagedMinions.find((m) => m.instanceId === minionId);
      expect(minion, 'the minion stays in play').toBeDefined();
      expect(minion!.tokens?.damage ?? 0).toBe(0);
      expect(minion!.statusCards ?? []).not.toContain(StatusCard.TOUGH);
      expect(getActiveVillain(after).health).toBe(initialVillainHp);
      expect(logKeys(after)).toContain('damage.prevented.tough');
      expect(logKeys(after)).not.toContain('overkill.hit');
    }

    it('B1: Tough absorbs the whole attack: no damage, no defeat, no Overkill', () => {
      const initialVillainHp = getActiveVillain(state).health;
      const minion = minionOf(2);
      minion.statusCards = [StatusCard.TOUGH];
      state.players[0].engagedMinions.push(minion);

      const res = playAssault([payment('physical', 2)], minion.instanceId);

      expect(res.result.success).toBe(true);
      expectToughPopped(res.state, minion.instanceId, initialVillainHp);
    });

    it('B2: the same on the target prompt path', () => {
      const initialVillainHp = getActiveVillain(state).health;
      const minion = minionOf(2);
      minion.statusCards = [StatusCard.TOUGH];
      state.players[0].engagedMinions.push(minion, minionOf(2));

      const after = playAssaultAndChoose([payment('physical', 2)], minion.instanceId);

      expectToughPopped(after, minion.instanceId, initialVillainHp);
    });

    it('B3: once the Tough is gone, the next attack damages, defeats and reaches Rhino', () => {
      const initialVillainHp = getActiveVillain(state).health;
      const minion = minionOf(2);
      minion.statusCards = [StatusCard.TOUGH];
      state.players[0].engagedMinions.push(minion);

      const first = playAssault([payment('physical', 2)], minion.instanceId);
      expect(first.result.success).toBe(true);
      state = first.state;

      const second = playAssault([payment('physical', 2)], minion.instanceId);
      expect(second.result.success).toBe(true);
      expect(second.state.players[0].engagedMinions.length).toBe(0);
      expect(getActiveVillain(second.state).health).toBe(initialVillainHp - 3);
    });
  });

  describe('C. Tough on Rhino (RR v1.8 Overkill: prevented excess is not dealt)', () => {
    it('C1: the Overkill pops the Tough and Rhino keeps every hit point', () => {
      getActiveVillain(state).statusCards = [StatusCard.TOUGH];
      const initialVillainHp = getActiveVillain(state).health;
      const minion = minionOf(2);
      state.players[0].engagedMinions.push(minion);

      const res = playAssault([payment('physical', 2)], minion.instanceId);

      expect(res.result.success).toBe(true);
      expect(res.state.players[0].engagedMinions.length).toBe(0);
      expect(getActiveVillain(res.state).statusCards).not.toContain(StatusCard.TOUGH);
      expect(getActiveVillain(res.state).health).toBe(initialVillainHp);
      expect(logKeys(res.state)).toContain('damage.prevented.tough');
      expect(logKeys(res.state)).not.toContain('overkill.hit');
    });

    it('C1b: the same on the target prompt path', () => {
      getActiveVillain(state).statusCards = [StatusCard.TOUGH];
      const initialVillainHp = getActiveVillain(state).health;
      const minion = minionOf(2);
      state.players[0].engagedMinions.push(minion, minionOf(2));

      const after = playAssaultAndChoose([payment('physical', 2)], minion.instanceId);

      expect(getActiveVillain(after).statusCards).not.toContain(StatusCard.TOUGH);
      expect(getActiveVillain(after).health).toBe(initialVillainHp);
    });

    it('C2: an exact kill deals nothing to Rhino, so his Tough stays', () => {
      getActiveVillain(state).statusCards = [StatusCard.TOUGH];
      const initialVillainHp = getActiveVillain(state).health;
      const minion = minionOf(5);
      state.players[0].engagedMinions.push(minion);

      const res = playAssault([payment('physical', 2)], minion.instanceId);

      expect(res.result.success).toBe(true);
      expect(res.state.players[0].engagedMinions.length).toBe(0);
      expect(getActiveVillain(res.state).statusCards).toContain(StatusCard.TOUGH);
      expect(getActiveVillain(res.state).health).toBe(initialVillainHp);
    });
  });
});
