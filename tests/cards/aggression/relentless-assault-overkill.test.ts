import { describe, it, expect, beforeEach } from 'vitest';
import { GameState, HeroCard, AlterEgoCard, StatusCard, GamePhase } from '@engine/models';
import { cardCatalog } from '../../../src/data/importer/card-loader';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { dispatchAction } from '@engine/pipeline/action-dispatcher';
import { peekDecisionPrompt } from '@engine/pipeline/prompt-queue';

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
    const initialVillainHp = state.villain.health;
    const initialSchemeThreat = state.mainScheme.threat;

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
    expect(res.state.villain.health).toBe(initialVillainHp - 3);
    // Main scheme threat MUST remain completely unchanged by Overkill!
    expect(res.state.mainScheme.threat).toBe(initialSchemeThreat);
  });

  it('Player pays with non-Physical resources (Energy/Mental): attack does NOT gain Overkill', () => {
    const p1 = state.players[0];
    const initialVillainHp = state.villain.health;

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
    expect(res.state.villain.health).toBe(initialVillainHp);
  });

  it('Overkill damage to Villain is absorbed by Tough status card per RR v1.8 p. 22', () => {
    const p1 = state.players[0];
    state.villain.statusCards = [StatusCard.TOUGH];
    const initialVillainHp = state.villain.health;

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
    expect(res.state.villain.statusCards.includes(StatusCard.TOUGH)).toBe(false);
    expect(res.state.villain.health).toBe(initialVillainHp);
  });

  it('Minion with Spider-Tracer defeated by Relentless Assault: Overkill damages Villain AND Spider-Tracer removes threat with proper prompt provenance', () => {
    const p1 = state.players[0];
    const initialVillainHp = state.villain.health;

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
    state.mainScheme.threat = 3;
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
    expect(res.state.villain.health).toBe(initialVillainHp - 3);

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

  function playAssault(paying: ReturnType<typeof payment>[], minionInstanceId: string) {
    const p1 = state.players[0];
    const assault = createCardInstance(cardCatalog.getCard('01053')!);
    p1.hand = [assault, ...paying];
    return dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: p1.id,
      cardInstanceId: assault.instanceId,
      targetInstanceId: minionInstanceId,
      paymentCardInstanceIds: paying.map((c) => c.instanceId),
    });
  }

  it('Player pays with a Wild resource: the attack gains Overkill', () => {
    const p1 = state.players[0];
    const initialVillainHp = state.villain.health;
    const minion = createCardInstance(cardCatalog.getCard('01110')!);
    p1.engagedMinions.push(minion);

    const res = playAssault([payment('wild', 2)], minion.instanceId);

    expect(res.result.success).toBe(true);
    expect(res.state.players[0].engagedMinions.length).toBe(0);
    expect(res.state.villain.health).toBe(initialVillainHp - 3);
  });

  it('The Overkill granted by a physical payment ends with the attack: a base attack and a later energy-paid Relentless Assault have none', () => {
    const p1 = state.players[0];
    const initialVillainHp = state.villain.health;
    const m1 = createCardInstance(cardCatalog.getCard('01110')!);
    const m2 = createCardInstance(cardCatalog.getCard('01110')!);
    const m3 = createCardInstance(cardCatalog.getCard('01110')!);
    p1.engagedMinions.push(m1, m2, m3);
    // Strong enough for a base attack to leave excess damage on a 2 HP minion.
    p1.activeFormCard = { ...spiderManHero, attack: 4 } as HeroCard;

    // 1. Physical payment: Overkill, 3 excess damage to the villain.
    const first = playAssault([payment('physical', 2)], m1.instanceId);
    expect(first.result.success).toBe(true);
    expect(first.state.villain.health).toBe(initialVillainHp - 3);
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
    expect(base.state.villain.health).toBe(initialVillainHp - 3);
    state = base.state;

    // 3. Relentless Assault paid with energy only: no Overkill.
    const third = playAssault([payment('energy', 2)], m3.instanceId);
    expect(third.result.success).toBe(true);
    expect(third.state.players[0].engagedMinions.length).toBe(0);
    expect(third.state.villain.health).toBe(initialVillainHp - 3);

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
});
