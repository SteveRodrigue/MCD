import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard, CardInstance } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { executeEffect, compileDistributionTargets } from '@engine/effects';
import { kernel } from '@engine/kernel';

describe('Simultaneous multi-target damage resolution (#523, #525)', () => {
  let state: GameState;

  const makePlayer = (id: string, hero: string, alterEgo: string) => ({
    id,
    name: id,
    hero: cardCatalog.getCard(hero) as HeroCard,
    alterEgo: cardCatalog.getCard(alterEgo) as AlterEgoCard,
    deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
  });

  beforeEach(() => {
    state = setupGame({
      catalog: cardCatalog,
      scenarioId: 'rhino',
      players: [makePlayer('p1', '01001a', '01001b'), makePlayer('p2', '01010a', '01010b')],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
    for (const p of state.players) {
      p.currentForm = 'hero';
      p.activeFormCard = p.hero;
    }
  });

  const eventCard = () => createCardInstance(cardCatalog.getCard('01087')!, 'p1');
  const ally1 = (): CardInstance => createCardInstance(cardCatalog.getCard('01002')!, 'p1'); // 2 HP
  const ally2 = (): CardInstance => createCardInstance(cardCatalog.getCard('01022')!, 'p1'); // 3 HP

  it('resolves damage step-by-step simultaneously across all targets (Scenario 1)', () => {
    const p1 = state.players[0];
    const a1 = ally1();
    const a2 = ally2();
    p1.allies.push(a1, a2);

    const initialHealth = p1.health;
    const checkedDamageOnTrigger: { p1Hp: number; a1Dmg: number; a2Dmg: number }[] = [];

    // Spy on kernel.dispatchTrigger for DAMAGE_TAKEN
    const originalDispatch = kernel.dispatchTrigger;
    kernel.dispatchTrigger = (st: GameState, trigger: any, ctx: any) => {
      if (trigger === 'DAMAGE_TAKEN') {
        const player = st.players.find((p) => p.id === 'p1')!;
        const allyA = player.allies.find((a) => a.instanceId === a1.instanceId);
        const allyB = player.allies.find((a) => a.instanceId === a2.instanceId);
        checkedDamageOnTrigger.push({
          p1Hp: player.health,
          a1Dmg: allyA?.tokens?.damage || 0,
          a2Dmg: allyB?.tokens?.damage || 0,
        });
      }
      return originalDispatch(st, trigger, ctx);
    };

    try {
      const ability = {
        id: 'test_multi_damage',
        timing: 'WHEN_REVEALED',
        steps: [
          {
            id: 'dmg',
            effect: 'DEAL_DAMAGE',
            effectParams: { amount: 1, target: 'ALL_FRIENDLY_CHARACTERS' },
          },
        ],
      } as any;

      state = executeEffect(state, ability, {
        playerId: 'p1',
        sourceCardInstance: eventCard(),
      } as any).state;

      expect(p1.health).toBe(initialHealth - 1);
      expect(a1.tokens?.damage).toBe(1);
      expect(a2.tokens?.damage).toBe(1);

      // Verify that when DAMAGE_TAKEN fired, all targets had ALREADY received their damage!
      expect(checkedDamageOnTrigger.length).toBeGreaterThan(0);
      for (const snapshot of checkedDamageOnTrigger) {
        expect(snapshot.p1Hp).toBe(initialHealth - 1);
        expect(snapshot.a1Dmg).toBe(1);
        expect(snapshot.a2Dmg).toBe(1);
      }
    } finally {
      kernel.dispatchTrigger = originalDispatch;
    }
  });

  it('allows a "would be defeated" interrupt on one target to protect another target (Scenario 2)', () => {
    const p1 = state.players[0];
    const a1 = ally1(); // 2 HP max
    const a2 = ally2(); // 3 HP max
    a1.tokens = { damage: 1 }; // 1 HP left (1 damage will defeat)
    a2.tokens = { damage: 2 }; // 1 HP left (1 damage will defeat)
    p1.allies.push(a1, a2);

    let interruptFired = false;

    // Simulate an interrupt on CHARACTER_WOULD_BE_DEFEATED that saves a1
    const originalDispatch = kernel.dispatchTrigger;
    kernel.dispatchTrigger = (st: GameState, trigger: any, ctx: any) => {
      if (trigger === 'CHARACTER_WOULD_BE_DEFEATED' && ctx.targetInstanceId === a1.instanceId) {
        // Crucial test: When a1 is in the "would be defeated" window, a2 MUST still be in play!
        const player = st.players.find((p) => p.id === 'p1')!;
        const a2InPlay = player.allies.some((a) => a.instanceId === a2.instanceId);
        expect(a2InPlay).toBe(true);

        // Avert a1's defeat by healing 1 damage or cancelling
        const targetAlly = player.allies.find((a) => a.instanceId === a1.instanceId);
        if (targetAlly?.tokens) {
          targetAlly.tokens.damage = 1; // prevent the fatal damage
        }
        interruptFired = true;
        return { state: st, cancelled: true };
      }
      return originalDispatch(st, trigger, ctx);
    };

    try {
      const ability = {
        id: 'test_multi_damage_defeat',
        timing: 'WHEN_REVEALED',
        steps: [
          {
            id: 'dmg',
            effect: 'DEAL_DAMAGE',
            effectParams: { amount: 1, target: 'ALL_FRIENDLY_CHARACTERS' },
          },
        ],
      } as any;

      state = executeEffect(state, ability, {
        playerId: 'p1',
        sourceCardInstance: eventCard(),
      } as any).state;

      expect(interruptFired).toBe(true);
      // a1's defeat was cancelled, so a1 survives!
      const playerAfter = state.players.find((p) => p.id === 'p1')!;
      expect(playerAfter.allies.some((a) => a.instanceId === a1.instanceId)).toBe(true);
      // a2 was not saved, so a2 was defeated and discarded
      expect(playerAfter.allies.some((a) => a.instanceId === a2.instanceId)).toBe(false);
    } finally {
      kernel.dispatchTrigger = originalDispatch;
    }
  });

  it('unifies ALL_CONTROLLED_CHARACTERS scope between damage and distribution (Scenario 3)', () => {
    const p1 = state.players[0];
    const p2 = state.players[1];
    const a1 = ally1();
    const a2 = ally2();
    a1.ownerId = 'p1';
    a2.ownerId = 'p2';
    p1.allies.push(a1);
    p2.allies.push(a2);

    const targets = compileDistributionTargets(state, 'ALL_CONTROLLED_CHARACTERS', 'DAMAGE', {
      actor: p1,
      isPlayerSource: true,
    });

    const instanceIds = targets.map((t) => t.instanceId);
    // Must include p1 identity and p1 ally
    expect(instanceIds).toContain(p1.id);
    expect(instanceIds).toContain(a1.instanceId);
    // Must NOT include p2 identity or p2 ally
    expect(instanceIds).not.toContain(p2.id);
    expect(instanceIds).not.toContain(a2.instanceId);
  });
});
