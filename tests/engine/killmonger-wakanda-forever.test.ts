import { describe, it, expect } from 'vitest';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { executeEffect } from '@engine/effects';
import { dispatchAction, peekDecisionPrompt } from '@engine/pipeline';
import { GameState, StatusCard, CardInstance, getActiveVillain } from '@engine/models';
import { applyDamageToTarget } from '@engine/pipeline/damage-pipeline';

/**
 * Killmonger `01157`: "Killmonger cannot take damage from Black Panther upgrades" (#297). Wakanda
 * Forever! resolves the Specials of the Black Panther upgrades, which are exactly the damage
 * sources he ignores. Black Panther cannot target him with an upgrade (RR "Targets": a character
 * that cannot take damage is not a valid target of an ability whose only effect is damage).
 */
const ENERGY_DAGGERS = '01046';
const PANTHER_CLAWS = '01047';
const TACTICAL_GENIUS = '01048';
const VIBRANIUM_SUIT = '01049';

const upgrade = (code: string) => createCardInstance(cardCatalog.getCard(code)!);

function buildGame(): { state: GameState; killmonger: CardInstance; guard: CardInstance } {
  const state = setupGame({
    scenarioId: 'rhino',
    players: [
      {
        id: 'p1',
        name: 'Black Panther',
        hero: cardCatalog.getCard('01040a')!,
        alterEgo: cardCatalog.getCard('01040b')!,
        deckCards: [cardCatalog.getCard('01044')!],
      },
    ] as any,
    villain: cardCatalog.getCard('01094')! as any,
    mainScheme: cardCatalog.getCard('01097')! as any,
    encounterCards: cardCatalog.getCardsBySet('rhino'),
    skipMulligan: true,
  });
  const player = state.players[0];
  player.currentForm = 'hero';
  player.activeFormCard = cardCatalog.getCard('01040a')!;
  const killmonger = createCardInstance(cardCatalog.getCard('01157')!);
  const guard = createCardInstance(cardCatalog.getCard('01096')!); // Armored Guard
  player.engagedMinions = [killmonger, guard];
  return { state, killmonger, guard };
}

function playWakandaForever(state: GameState, order: string[]) {
  const wf = createCardInstance(cardCatalog.getCard('01043a')!);
  return executeEffect(
    state,
    {
      id: 'wf_test',
      timing: 'HERO_ACTION',
      steps: [
        {
          effect: 'EXECUTE_SPECIAL',
          effectParams: { specialId: 'WAKANDA_FOREVER', sequenceOrder: order },
        },
      ],
    } as any,
    { playerId: 'p1', sourceCardInstance: wf },
  );
}

/** Answers the Panther Claws target prompt with the villain, asserting Killmonger is not offered. */
function chooseVillain(state: GameState): GameState {
  const villainId = getActiveVillain(state).instanceId!;
  const prompt = peekDecisionPrompt(state)!;
  expect(prompt).toBeDefined();
  const ids = prompt.options.map((o) => o.id);
  expect(ids).toContain(villainId);
  const kmId = state.players[0].engagedMinions.find((m) => m.card.code === '01157')?.instanceId;
  expect(ids).not.toContain(kmId);
  return dispatchAction(state, {
    type: 'RESOLVE_DECISION_PROMPT',
    playerId: 'p1',
    selectedOptionId: villainId,
  } as any).state;
}

const damageOf = (state: GameState, instanceId: string): number =>
  state.players[0].engagedMinions.find((m) => m.instanceId === instanceId)?.tokens?.damage ?? 0;

const minionRef = (state: GameState, instanceId: string) => {
  const m = state.players[0].engagedMinions.find((x) => x.instanceId === instanceId)!;
  return {
    type: 'minion' as const,
    entity: m,
    instanceId: m.instanceId,
    name: m.card.name,
    targetPlayerId: 'p1',
    statusCards: m.statusCards,
    attachments: m.attachments,
  };
};

describe('Killmonger 01157 vs Wakanda Forever! (#297)', () => {
  it('W1. Panther Claws alone: Killmonger is not a valid target, the villain takes the 4-damage finisher', () => {
    const { state, killmonger, guard } = buildGame();
    const claws = upgrade(PANTHER_CLAWS);
    state.players[0].tableau = [claws];
    const hp = getActiveVillain(state).health;
    // Armored Guard is a valid target too, so the player chooses; Killmonger is never offered.
    const res = playWakandaForever(state, [claws.instanceId]);
    const after = chooseVillain(res.state);

    expect(getActiveVillain(after).health).toBe(hp - 4);
    expect(damageOf(after, killmonger.instanceId)).toBe(0);
    expect(damageOf(after, guard.instanceId)).toBe(0);
  });

  it('W2. Panther Claws may still choose the other minion (control: only Killmonger is excluded)', () => {
    const { state, killmonger, guard } = buildGame();
    const claws = upgrade(PANTHER_CLAWS);
    state.players[0].tableau = [claws];
    const res = playWakandaForever(state, [claws.instanceId]);
    const ids = peekDecisionPrompt(res.state)!.options.map((o) => o.id);
    expect(ids).toContain(guard.instanceId);
    expect(ids).not.toContain(killmonger.instanceId);
  });

  it('W3. Energy Daggers alone (final, 2 damage): villain and Armored Guard take 2, Killmonger 0', () => {
    const { state, killmonger, guard } = buildGame();
    const daggers = upgrade(ENERGY_DAGGERS);
    state.players[0].tableau = [daggers];
    const hp = getActiveVillain(state).health;

    const res = playWakandaForever(state, [daggers.instanceId]);

    expect(peekDecisionPrompt(res.state)).toBeUndefined();
    expect(getActiveVillain(res.state).health).toBe(hp - 2);
    expect(damageOf(res.state, guard.instanceId)).toBe(2);
    expect(damageOf(res.state, killmonger.instanceId)).toBe(0);
  });

  it('W4. Daggers then Claws: Daggers 1 each, Claws finisher 4 on the villain, Killmonger untouched', () => {
    const { state, killmonger, guard } = buildGame();
    const daggers = upgrade(ENERGY_DAGGERS);
    const claws = upgrade(PANTHER_CLAWS);
    state.players[0].tableau = [daggers, claws];
    const hp = getActiveVillain(state).health;

    const res = playWakandaForever(state, [daggers.instanceId, claws.instanceId]);
    const after = chooseVillain(res.state);

    expect(getActiveVillain(after).health).toBe(hp - 5);
    expect(damageOf(after, guard.instanceId)).toBe(1);
    expect(damageOf(after, killmonger.instanceId)).toBe(0);
  });

  it('W5. Claws then Daggers: Claws 2 on the villain, Daggers finisher 2 each, Killmonger untouched', () => {
    const { state, killmonger, guard } = buildGame();
    const daggers = upgrade(ENERGY_DAGGERS);
    const claws = upgrade(PANTHER_CLAWS);
    state.players[0].tableau = [daggers, claws];
    const hp = getActiveVillain(state).health;

    const res = playWakandaForever(state, [claws.instanceId, daggers.instanceId]);
    const after = chooseVillain(res.state);

    expect(getActiveVillain(after).health).toBe(hp - 4);
    expect(damageOf(after, guard.instanceId)).toBe(2);
    expect(damageOf(after, killmonger.instanceId)).toBe(0);
  });

  it('W6. Vibranium Suit cannot move damage to Killmonger: the step fails and the hero keeps the damage', () => {
    const { state, killmonger } = buildGame();
    const player = state.players[0];
    player.health = 8;
    const suit = upgrade(VIBRANIUM_SUIT);
    player.tableau = [suit];

    const res = executeEffect(
      state,
      {
        id: 'suit',
        timing: 'SPECIAL',
        labels: ['ATTACK'],
        steps: [
          {
            effect: 'TRANSFER_DAMAGE',
            effectParams: { amount: 1, targetInstanceId: killmonger.instanceId },
          },
        ],
      } as any,
      { playerId: 'p1', sourceCardInstance: suit },
    );

    expect(res.success).toBe(false);
    expect(res.state.players[0].health).toBe(8);
    expect(damageOf(res.state, killmonger.instanceId)).toBe(0);
  });

  it('W7. Vibranium Suit on another enemy while Killmonger is engaged: the transfer works', () => {
    const { state, guard } = buildGame();
    const player = state.players[0];
    player.health = 8;
    const suit = upgrade(VIBRANIUM_SUIT);
    player.tableau = [suit];

    const res = executeEffect(
      state,
      {
        id: 'suit',
        timing: 'SPECIAL',
        labels: ['ATTACK'],
        steps: [
          {
            effect: 'TRANSFER_DAMAGE',
            effectParams: { amount: 1, targetInstanceId: guard.instanceId },
          },
        ],
      } as any,
      { playerId: 'p1', sourceCardInstance: suit },
    );

    expect(res.success).toBe(true);
    expect(res.state.players[0].health).toBe(9);
    expect(damageOf(res.state, guard.instanceId)).toBe(1);
  });

  const perms: string[][] = [
    ['d', 'c', 's'],
    ['d', 's', 'c'],
    ['c', 'd', 's'],
    ['c', 's', 'd'],
    ['s', 'd', 'c'],
    ['s', 'c', 'd'],
  ];
  it.each(perms)(
    'W8. Daggers, Claws and Suit in order %s %s %s: Killmonger never takes damage, the others do',
    (...order) => {
      const { state, killmonger, guard } = buildGame();
      const player = state.players[0];
      player.health = 8;
      const cards: Record<string, CardInstance> = {
        d: upgrade(ENERGY_DAGGERS),
        c: upgrade(PANTHER_CLAWS),
        s: upgrade(VIBRANIUM_SUIT),
      };
      player.tableau = Object.values(cards);

      const res = playWakandaForever(
        state,
        order.map((k) => cards[k].instanceId),
      );
      let after = res.state;
      while (peekDecisionPrompt(after)) after = chooseVillain(after);

      expect(damageOf(after, killmonger.instanceId)).toBe(0);
      expect(damageOf(after, guard.instanceId)).toBeGreaterThan(0);
      expect(
        after.players[0].engagedMinions.some((m) => m.instanceId === killmonger.instanceId),
      ).toBe(true);
    },
  );

  it('W9. Tactical Genius in the sequence: threat is removed, Killmonger is untouched', () => {
    const { state, killmonger } = buildGame();
    state.mainScheme.threat = 5;
    const claws = upgrade(PANTHER_CLAWS);
    const genius = upgrade(TACTICAL_GENIUS);
    state.players[0].tableau = [claws, genius];

    const res = playWakandaForever(state, [claws.instanceId, genius.instanceId]);
    let after = res.state;
    while (peekDecisionPrompt(after)) after = chooseVillain(after);

    expect(damageOf(after, killmonger.instanceId)).toBe(0);
    expect(after.mainScheme.threat).toBe(3);
  });

  it('W10. A Tough status card on Killmonger is not consumed by an immune Daggers hit', () => {
    const { state, killmonger } = buildGame();
    killmonger.statusCards = [StatusCard.TOUGH];
    const daggers = upgrade(ENERGY_DAGGERS);
    state.players[0].tableau = [daggers];

    const res = playWakandaForever(state, [daggers.instanceId]);

    const km = res.state.players[0].engagedMinions.find(
      (m) => m.instanceId === killmonger.instanceId,
    )!;
    expect(km.statusCards).toContain(StatusCard.TOUGH);
    expect(damageOf(res.state, killmonger.instanceId)).toBe(0);
  });

  it('W11. Killmonger stays engaged after Wakanda Forever! (nothing defeats or removes him)', () => {
    const { state, killmonger } = buildGame();
    const daggers = upgrade(ENERGY_DAGGERS);
    state.players[0].tableau = [daggers];
    const res = playWakandaForever(state, [daggers.instanceId]);
    expect(
      res.state.players[0].engagedMinions.some((m) => m.instanceId === killmonger.instanceId),
    ).toBe(true);
  });

  it('W12. A basic attack still damages Killmonger (immunity is source-specific)', () => {
    const { state, killmonger } = buildGame();
    const hitRes = applyDamageToTarget(state, {
      target: minionRef(state, killmonger.instanceId),
      amount: 2,
      sourceType: 'HERO',
      sourcePlayerId: 'p1',
      isAttack: true,
    });
    expect(damageOf(hitRes.state, killmonger.instanceId)).toBe(2);
  });

  it('W13. A Black Panther upgrade and a non-Black-Panther upgrade: only the second lands', () => {
    const { state, killmonger } = buildGame();
    let s = applyDamageToTarget(state, {
      target: minionRef(state, killmonger.instanceId),
      amount: 4,
      sourceType: 'CARD_EFFECT',
      sourcePlayerId: 'p1',
      sourceCardInstance: upgrade(PANTHER_CLAWS),
    }).state;
    expect(damageOf(s, killmonger.instanceId)).toBe(0);
    s = applyDamageToTarget(s, {
      target: minionRef(s, killmonger.instanceId),
      amount: 2,
      sourceType: 'CARD_EFFECT',
      sourcePlayerId: 'p1',
      sourceCardInstance: upgrade('01057'),
    }).state;
    expect(damageOf(s, killmonger.instanceId)).toBe(2);
  });

  it('W14. Each immune hit is logged with Killmonger as the target', () => {
    const { state } = buildGame();
    const daggers = upgrade(ENERGY_DAGGERS);
    state.players[0].tableau = [daggers];
    const res = playWakandaForever(state, [daggers.instanceId]);
    const entries = res.state.log.filter((l) => l.key === 'damage.prevented.immune');
    expect(entries.length).toBe(1);
    expect((entries[0].params as any).target).toBe('Killmonger');
  });
});
