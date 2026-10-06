import { describe, it, expect, beforeEach, vi } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import {
  GameState,
  HeroCard,
  AlterEgoCard,
  CardInstance,
  StatusCard,
  getActiveVillain,
} from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { executeEffect } from '@engine/effects';

const dispatched = vi.hoisted(
  () => [] as Array<{ trigger: string; context: Record<string, unknown> }>,
);

vi.mock('../../src/engine/triggers/trigger-dispatcher', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../src/engine/triggers/trigger-dispatcher')>();
  return {
    ...actual,
    dispatchTrigger: ((state: any, trigger: any, context: any) => {
      dispatched.push({ trigger, context: { ...context } });
      return actual.dispatchTrigger(state, trigger, context);
    }) as typeof actual.dispatchTrigger,
  };
});

// #247 (plan section 4, item 4): TRANSFER_DAMAGE damages the enemy through the damage pipeline.
// Vibranium Suit (01049): "Special (attack): Move 1 damage from your hero to an enemy."
describe('TRANSFER_DAMAGE goes through the damage pipeline (#247)', () => {
  let state: GameState;

  beforeEach(() => {
    dispatched.length = 0;
    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'p1',
          hero: cardCatalog.getCard('01001a') as HeroCard,
          alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = state.players[0].hero;
    state.players[0].health = state.players[0].maxHealth - 3;
    dispatched.length = 0;
  });

  const suit = () => cardCatalog.getCard('01049')!;

  const play = (target: string) => {
    const res = executeEffect(state, suit().enrichment!.abilities![0], {
      playerId: 'p1',
      sourceCardInstance: createCardInstance(suit(), 'p1'),
      chosenTargetInstanceId: target,
    } as any);
    state = res.state ?? state;
  };

  const engage = (code: string, health?: number): CardInstance => {
    const m = createCardInstance(cardCatalog.getCard(code)!);
    if (health) m.card = { ...m.card, health } as any;
    state.players[0].engagedMinions.push(m);
    return m;
  };

  it('Vibranium Suit on a Retaliate minion provokes Retaliate', () => {
    const whiplash = engage('01172', 8);
    play(whiplash.instanceId);

    expect(whiplash.tokens?.damage).toBe(1);
    expect(state.log.some((l) => l.key === 'retaliate.hit')).toBe(true);
  });

  it('on a minion it defeats, the defeat trigger carries defeatSource HERO / byAttack', () => {
    const m = engage('01101'); // 3 HP
    m.tokens = { ...m.tokens, damage: 2 };
    play(m.instanceId);

    expect(state.players[0].engagedMinions).toHaveLength(0);
    const defeat = dispatched.find(
      (d) => d.trigger === 'DEFEATED' && d.context.targetInstanceId === m.instanceId,
    );
    expect(defeat?.context.defeatSource).toMatchObject({
      kind: 'HERO',
      playerId: 'p1',
      byAttack: true,
    });
    expect(dispatched.filter((d) => d.trigger === 'ATTACK_RESOLVED')).toHaveLength(1);
  });

  it('Tough absorbs the transferred damage', () => {
    const m = engage('01101');
    m.statusCards = [StatusCard.TOUGH];
    play(m.instanceId);

    expect(m.tokens?.damage ?? 0).toBe(0);
    expect(m.statusCards).not.toContain(StatusCard.TOUGH);
  });

  it('a villain reduced to 0 is defeated', () => {
    getActiveVillain(state).health = 1;
    play('villain');

    expect(
      dispatched.filter((d) => d.trigger === 'DEFEATED' && d.context.targetType === 'VILLAIN'),
    ).toHaveLength(1);
  });

  it('a villain damage shield takes the transferred damage', () => {
    const shield = createCardInstance(cardCatalog.getCard('01098')!);
    getActiveVillain(state).attachments = [shield];
    const before = getActiveVillain(state).health;
    play('villain');

    expect(getActiveVillain(state).health).toBe(before);
    expect(shield.tokens?.damage).toBe(1);
  });
});
