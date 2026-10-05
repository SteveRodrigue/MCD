import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '@data/importer/card-loader';
import {
  GameState,
  HeroCard,
  AlterEgoCard,
  MinionCard,
  CardInstance,
  getActiveVillain,
} from '@engine/models';
import { setupGame, createCardInstance, resetInstanceCounter } from '@engine/state/game-setup';
import { dispatchAction, peekDecisionPrompt } from '@engine/index';

/**
 * Hulk 01050 (Ally) Forced Response:
 * After Hulk attacks, discard the top card of your deck. If that card's printed resource has:
 * [physical] - Deal 2 damage to an enemy.
 * [energy] - Deal 1 damage to each character.
 * [mental] - Discard Hulk.
 * [wild] - All of the above.
 *
 * When step 2 (physical) opens a target decision prompt (with 2+ enemies in play),
 * the sequence must pause: steps 3 and 4 must NOT resolve until the player answers (#248).
 */
describe('Hulk 01050 pausable sequence prompt ordering (#248)', () => {
  let state: GameState;

  const setup = () => {
    resetInstanceCounter();
    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'P1',
          hero: cardCatalog.getCard('01001a') as HeroCard,
          alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
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

  beforeEach(() => {
    setup();
  });

  const p1 = () => state.players[0];
  const card = (code: string) => createCardInstance(cardCatalog.getCard(code)!);

  const engageBomber = (): CardInstance => {
    const m = createCardInstance(cardCatalog.getCard('01110') as MinionCard); // Hydra Bomber, 2 HP (no Guard)
    p1().engagedMinions.push(m);
    return m;
  };

  it('pauses when choosing an enemy for step 2 (wild resource): steps 3 and 4 wait for the answer', () => {
    const hulk = card('01050'); // Hulk ally
    p1().allies.push(hulk);
    const minion = engageBomber();

    // Top card of deck has wild printed resource (01044 Vibranium)
    const wildCard = card('01044');
    p1().deck = [wildCard, card('01005'), card('01005')];

    const initialHeroHp = p1().health;
    const initialVillainHp = getActiveVillain(state).health;

    // Hulk attacks Rhino
    const attackRes = dispatchAction(state, {
      type: 'ALLY_ATTACK',
      playerId: 'p1',
      allyInstanceId: hulk.instanceId,
      targetType: 'villain',
      targetInstanceId: getActiveVillain(state).instanceId,
    });
    state = attackRes.state;

    // Hulk dealt 3 base attack damage to Rhino
    expect(getActiveVillain(state).health).toBe(initialVillainHp - 3);

    // Hulk's Forced Response triggered and discarded the wild card
    expect(p1().discard.some((c) => c.instanceId === wildCard.instanceId)).toBe(true);

    // Prompt for step 2 (Deal 2 damage to an enemy) MUST be open
    const prompt = peekDecisionPrompt(state);
    expect(prompt).toBeDefined();
    expect(prompt?.title).toContain('Choose an Enemy');

    // CRITICAL: Step 3 (1 damage to all characters) and Step 4 (discard Hulk) must NOT have run yet!
    // Minion must have 0 damage (not damaged by step 3)
    expect(minion.tokens?.damage ?? 0).toBe(0);
    // Hero must not have taken damage from step 3
    expect(p1().health).toBe(initialHeroHp);
    // Hulk must STILL be in play in allies (not discarded by step 4)
    expect(p1().allies.some((a) => a.instanceId === hulk.instanceId)).toBe(true);

    // Player resolves the prompt: choose the minion for the 2 damage
    const resolveRes = dispatchAction(state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: minion.instanceId,
    });
    state = resolveRes.state;

    // Now:
    // Step 2 dealt 2 damage to minion (defeated!).
    // Step 3 dealt 1 damage to all characters: Rhino took 1, Hero took 1.
    // Step 4 discarded Hulk.
    expect(p1().engagedMinions.some((m) => m.instanceId === minion.instanceId)).toBe(false);
    expect(
      state.encounterDiscard.some(
        (c) => c.instanceId === minion.instanceId || c.card.code === '01110',
      ),
    ).toBe(true);
    expect(p1().health).toBe(initialHeroHp - 1);
    expect(getActiveVillain(state).health).toBe(initialVillainHp - 3 - 1);
    expect(p1().allies.some((a) => a.instanceId === hulk.instanceId)).toBe(false);

    // No prompts or pending sequences remain
    expect(peekDecisionPrompt(state)).toBeUndefined();
    expect(state.pendingSequences?.length ?? 0).toBe(0);
  });

  it('physical resource only: deals 2 damage to chosen enemy, steps 3 and 4 are skipped, Hulk stays in play', () => {
    const hulk = card('01050');
    p1().allies.push(hulk);
    const minion = engageBomber();

    // Top card is a physical-only resource card (01090 Strength)
    const physicalCard = card('01090');
    p1().deck = [physicalCard];

    const initialHeroHp = p1().health;

    const attackRes = dispatchAction(state, {
      type: 'ALLY_ATTACK',
      playerId: 'p1',
      allyInstanceId: hulk.instanceId,
      targetType: 'villain',
      targetInstanceId: getActiveVillain(state).instanceId,
    });
    state = attackRes.state;

    // Prompt for step 2 (physical) opens
    const prompt = peekDecisionPrompt(state);
    expect(prompt).toBeDefined();

    // Minion chosen for 2 damage
    const resolveRes = dispatchAction(state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: minion.instanceId,
    });
    state = resolveRes.state;

    // Minion took 2 damage (defeated, 2 HP)
    expect(p1().engagedMinions.some((m) => m.instanceId === minion.instanceId)).toBe(false);
    // Hero took no damage (step 3 skipped)
    expect(p1().health).toBe(initialHeroHp);
    // Hulk took 1 consequential damage from attacking, but is NOT discarded (step 4 skipped)
    expect(p1().allies.some((a) => a.instanceId === hulk.instanceId)).toBe(true);
  });

  it('single enemy in play: resolves all steps immediately without prompt or pause', () => {
    const hulk = card('01050');
    p1().allies.push(hulk);

    const wildCard = card('01044');
    p1().deck = [wildCard];

    const initialHeroHp = p1().health;
    const initialVillainHp = getActiveVillain(state).health;

    const attackRes = dispatchAction(state, {
      type: 'ALLY_ATTACK',
      playerId: 'p1',
      allyInstanceId: hulk.instanceId,
      targetType: 'villain',
      targetInstanceId: getActiveVillain(state).instanceId,
    });
    state = attackRes.state;

    // No prompt should open because Rhino is the only enemy
    expect(peekDecisionPrompt(state)).toBeUndefined();
    // Rhino took 3 (attack) + 2 (step 2) + 1 (step 3) = 6 damage
    expect(getActiveVillain(state).health).toBe(initialVillainHp - 6);
    // Hero took 1 damage from step 3
    expect(p1().health).toBe(initialHeroHp - 1);
    // Hulk was discarded by step 4
    expect(p1().allies.some((a) => a.instanceId === hulk.instanceId)).toBe(false);
  });
});
