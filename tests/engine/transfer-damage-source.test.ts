import { describe, it, expect } from 'vitest';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { executeEffect, executeStep } from '@engine/effects';
import { dispatchAction, peekDecisionPrompt } from '@engine/pipeline';
import { GameState, CardInstance, getActiveVillain } from '@engine/models';
import { getEffectiveMaxHealth } from '@engine/pipeline/stat-calculator';

/**
 * Vibranium Suit `01049` (#300): "Move 1 damage from your hero to an enemy (2 damage instead if
 * this is the final step of this sequence)." Damage can only move if the hero carries it, so the
 * transfer moves min(amount, hero damage) and fails when the hero has no damage.
 */
const ENERGY_DAGGERS = '01046';
const VIBRANIUM_SUIT = '01049';

const upgrade = (code: string) => createCardInstance(cardCatalog.getCard(code)!);

function buildGame(): { state: GameState; guard: CardInstance } {
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
  const guard = createCardInstance(cardCatalog.getCard('01096')!); // Armored Guard
  player.engagedMinions = [guard];
  return { state, guard };
}

const damageOf = (state: GameState, instanceId: string): number =>
  state.players[0].engagedMinions.find((m) => m.instanceId === instanceId)?.tokens?.damage ?? 0;

/**
 * Runs one Suit step (TRANSFER_DAMAGE) as the "(attack)" Special would. The step result is read
 * directly: a sequence reports success for an outcome failure without an error (by design, #225).
 */
function runSuit(
  state: GameState,
  suit: CardInstance,
  effectParams: Record<string, unknown>,
  isFinalStep = false,
) {
  return executeStep(
    state,
    { effect: 'TRANSFER_DAMAGE', effectParams } as any,
    {
      playerId: 'p1',
      sourceCardInstance: suit,
      isFinalStep,
      labelledAttack: true,
      isAttack: true,
    } as any,
  );
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

/** Sets the hero to `damage` damage below its effective maximum. */
function setHeroDamage(state: GameState, damage: number) {
  const player = state.players[0];
  player.health = getEffectiveMaxHealth(player, state) - damage;
}

describe('Vibranium Suit 01049 moves only damage the hero carries (#300)', () => {
  it('T1. Hero at full health, Suit step on the villain: nothing moves', () => {
    const { state } = buildGame();
    const suit = upgrade(VIBRANIUM_SUIT);
    state.players[0].tableau = [suit];
    setHeroDamage(state, 0);
    const heroHp = state.players[0].health;
    const villainHp = getActiveVillain(state).health;

    const res = runSuit(state, suit, { amount: 1, targetInstanceId: 'villain' });

    expect(res.success).toBe(false);
    expect(res.error).toBeUndefined();
    expect(res.state.players[0].health).toBe(heroHp);
    expect(getActiveVillain(res.state).health).toBe(villainHp);
  });

  it('T2. Hero at full health, Suit step on an engaged minion: minion takes no damage', () => {
    const { state, guard } = buildGame();
    const suit = upgrade(VIBRANIUM_SUIT);
    state.players[0].tableau = [suit];
    setHeroDamage(state, 0);
    const heroHp = state.players[0].health;

    const res = runSuit(state, suit, { amount: 1, targetInstanceId: guard.instanceId });

    expect(res.success).toBe(false);
    expect(res.state.players[0].health).toBe(heroHp);
    expect(damageOf(res.state, guard.instanceId)).toBe(0);
  });

  it('T3. Hero has 3 damage, amount 1: hero heals 1, enemy takes 1', () => {
    const { state, guard } = buildGame();
    const suit = upgrade(VIBRANIUM_SUIT);
    state.players[0].tableau = [suit];
    setHeroDamage(state, 3);
    const heroHp = state.players[0].health;

    const res = runSuit(state, suit, { amount: 1, targetInstanceId: guard.instanceId });

    expect(res.success).toBe(true);
    expect(res.state.players[0].health).toBe(heroHp + 1);
    expect(damageOf(res.state, guard.instanceId)).toBe(1);
  });

  it('T4. Hero has 1 damage, final step (amount 2): hero heals 1, enemy takes 1', () => {
    const { state, guard } = buildGame();
    const suit = upgrade(VIBRANIUM_SUIT);
    state.players[0].tableau = [suit];
    setHeroDamage(state, 1);
    const heroHp = state.players[0].health;

    const res = runSuit(state, suit, { amount: 2, targetInstanceId: guard.instanceId }, true);

    expect(res.success).toBe(true);
    expect(res.state.players[0].health).toBe(heroHp + 1);
    expect(damageOf(res.state, guard.instanceId)).toBe(1);
  });

  it('T5. Hero has 5 damage, final step (amount 2): hero heals 2, enemy takes 2', () => {
    const { state, guard } = buildGame();
    const suit = upgrade(VIBRANIUM_SUIT);
    state.players[0].tableau = [suit];
    setHeroDamage(state, 5);
    const heroHp = state.players[0].health;

    const res = runSuit(state, suit, { amount: 2, targetInstanceId: guard.instanceId }, true);

    expect(res.success).toBe(true);
    expect(res.state.players[0].health).toBe(heroHp + 2);
    expect(damageOf(res.state, guard.instanceId)).toBe(2);
  });

  it('T6. Wakanda Forever! with Suit and Energy Daggers, undamaged hero: Daggers hit, Suit moves nothing, no crash', () => {
    const { state, guard } = buildGame();
    const suit = upgrade(VIBRANIUM_SUIT);
    const daggers = upgrade(ENERGY_DAGGERS);
    state.players[0].tableau = [daggers, suit];
    setHeroDamage(state, 0);
    const heroHp = state.players[0].health;
    const villainHp = getActiveVillain(state).health;

    const res = playWakandaForever(state, [suit.instanceId, daggers.instanceId]);
    let after = res.state;
    while (peekDecisionPrompt(after)) {
      const prompt = peekDecisionPrompt(after)!;
      const villainId = getActiveVillain(after).instanceId!;
      const pick = prompt.options.some((o) => o.id === villainId)
        ? villainId
        : prompt.options[0].id;
      after = dispatchAction(after, {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId: 'p1',
        selectedOptionId: pick,
      } as any).state;
    }

    // Daggers (final step, 2 damage) hit the villain and the guard; the Suit adds nothing.
    expect(after.players[0].health).toBe(heroHp);
    expect(getActiveVillain(after).health).toBe(villainHp - 2);
    expect(damageOf(after, guard.instanceId)).toBe(2);
  });
});
