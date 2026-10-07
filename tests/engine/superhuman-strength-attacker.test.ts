import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '@data/importer/card-loader';
import {
  GameState,
  HeroCard,
  AlterEgoCard,
  MinionCard,
  CardInstance,
  StatusCard,
} from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { dispatchAction } from '@engine/index';
import { executeEffect } from '@engine/effects';
import { executeEnemyAttackSynchronously } from '@engine/pipeline';
import { matchesTriggerFilter } from '@engine/triggers/trigger-dispatcher';

// #257: "After She-Hulk attacks, discard Superhuman Strength -> stun the attacked enemy".
// Only an attack made by the hero of the upgrade's controller triggers it.
describe('Superhuman Strength (01028) reacts only to an attack by your hero (#257)', () => {
  let state: GameState;

  const makePlayer = (id: string, hero: string, alterEgo: string) => ({
    id,
    name: id,
    hero: cardCatalog.getCard(hero) as HeroCard,
    alterEgo: cardCatalog.getCard(alterEgo) as AlterEgoCard,
    deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
  });
  const p = (i = 0) => state.players[i];
  const stack = (hp = 12): CardInstance => {
    const m = createCardInstance({
      ...(cardCatalog.getCard('01101') as MinionCard),
      health: hp,
    } as MinionCard);
    p().engagedMinions.push(m);
    return m;
  };
  const upgradeInPlay = () => p().tableau.some((c) => c.card.code === '01028');
  const stunned = (m: CardInstance) =>
    p()
      .engagedMinions.find((x) => x.instanceId === m.instanceId)
      ?.statusCards?.includes(StatusCard.STUNNED);

  beforeEach(() => {
    state = setupGame({
      scenarioId: 'rhino',
      players: [makePlayer('p1', '01019a', '01019b'), makePlayer('p2', '01001a', '01001b')],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
      shuffleFn: (a) => a,
    });
    for (const pl of state.players) {
      pl.currentForm = 'hero';
      pl.activeFormCard = pl.hero;
      pl.hand = [];
    }
    p().tableau = [createCardInstance(cardCatalog.getCard('01028')!, 'p1')];
  });

  it('She-Hulk basic attack: the attacked minion is stunned and the upgrade discarded', () => {
    const m = stack();
    state = dispatchAction(state, {
      type: 'BASIC_ATTACK',
      playerId: 'p1',
      targetType: 'minion',
      targetInstanceId: m.instanceId,
    }).state;
    expect(stunned(m)).toBe(true);
    expect(upgradeInPlay()).toBe(false);
  });

  describe('no valid target: the forced ability does not initiate and the cost is not paid (RR v1.8 Forced, Target)', () => {
    const basicAttack = (m: CardInstance) => {
      state = dispatchAction(state, {
        type: 'BASIC_ATTACK',
        playerId: 'p1',
        targetType: 'minion',
        targetInstanceId: m.instanceId,
      }).state;
    };

    it('the attack defeats the minion: the upgrade stays in play', () => {
      const m = stack(1);
      basicAttack(m);
      expect(p().engagedMinions.find((x) => x.instanceId === m.instanceId)).toBeUndefined();
      expect(upgradeInPlay()).toBe(true);
    });

    it('the minion is already stunned: no second stun card, the upgrade stays', () => {
      const m = stack();
      m.statusCards = [StatusCard.STUNNED];
      // A stunned enemy that is attacked is not stunned again; the attack still resolves.
      basicAttack(m);
      expect(m.statusCards?.filter((c) => c === StatusCard.STUNNED)).toHaveLength(1);
      expect(upgradeInPlay()).toBe(true);
    });

    it('the minion is Stalwart: the upgrade stays', () => {
      const m = createCardInstance({
        ...(cardCatalog.getCard('01101') as MinionCard),
        health: 12,
        keywords: ['Stalwart'],
      } as MinionCard);
      p().engagedMinions.push(m);
      basicAttack(m);
      expect(stunned(m)).toBeFalsy();
      expect(upgradeInPlay()).toBe(true);
    });

    it('a labelled attack event that defeats the minion keeps the upgrade too', () => {
      const m = stack(1);
      executeEffect(state, cardCatalog.getCard('01054')!.enrichment!.abilities![0], {
        playerId: 'p1',
        sourceCardInstance: createCardInstance(cardCatalog.getCard('01054')!, 'p1'),
        chosenTargetType: 'minion',
        chosenTargetInstanceId: m.instanceId,
      } as any);
      expect(p().engagedMinions).toHaveLength(0);
      expect(upgradeInPlay()).toBe(true);
    });
  });

  it('an ally attack does not trigger it', () => {
    const tigra = createCardInstance(cardCatalog.getCard('01051')!, 'p1');
    p().allies = [tigra];
    const m = stack();
    state = dispatchAction(state, {
      type: 'ALLY_ATTACK',
      playerId: 'p1',
      allyInstanceId: tigra.instanceId,
      targetType: 'minion',
      targetInstanceId: m.instanceId,
    }).state;
    expect(stunned(m)).toBeFalsy();
    expect(upgradeInPlay()).toBe(true);
  });

  it('an enemy attacking She-Hulk does not trigger it', () => {
    const m = stack();
    executeEnemyAttackSynchronously(state, { type: 'MINION', card: m }, 'p1', 'TAKE_UNDEFENDED');
    expect(stunned(m)).toBeFalsy();
    expect(upgradeInPlay()).toBe(true);
  });

  it('a labelled attack event (Uppercut 01054) by She-Hulk triggers it once', () => {
    const m = stack();
    executeEffect(state, cardCatalog.getCard('01054')!.enrichment!.abilities![0], {
      playerId: 'p1',
      sourceCardInstance: createCardInstance(cardCatalog.getCard('01054')!, 'p1'),
      chosenTargetType: 'minion',
      chosenTargetInstanceId: m.instanceId,
    } as any);
    expect(stunned(m)).toBe(true);
    expect(upgradeInPlay()).toBe(false);
  });

  it("another player's hero attacking does not trigger it", () => {
    const m = stack();
    p(1).engagedMinions.push(m);
    p().engagedMinions = [];
    state = dispatchAction(state, {
      type: 'BASIC_ATTACK',
      playerId: 'p2',
      targetType: 'minion',
      targetInstanceId: m.instanceId,
    }).state;
    expect(upgradeInPlay()).toBe(true);
  });
});

describe('triggerFilter.attackedBy', () => {
  const player = { id: 'p1' } as any;
  const card = { instanceId: 'c1' } as any;
  const ctx = (attackSource?: any) => ({ targetPlayerId: 'p1', attackSource }) as any;
  const run = (filter: any, attackSource?: any) =>
    matchesTriggerFilter(filter, ctx(attackSource), player, card, 'ATTACK_RESOLVED');

  it('YOUR_HERO: hero of the controller only', () => {
    const f = { attackedBy: 'YOUR_HERO' };
    expect(run(f, { kind: 'HERO', playerId: 'p1' })).toBe(true);
    expect(run(f, { kind: 'HERO', playerId: 'p2' })).toBe(false);
    expect(run(f, { kind: 'ALLY', playerId: 'p1', instanceId: 'c1' })).toBe(false);
    expect(run(f, { kind: 'ENEMY' })).toBe(false);
  });
  it('THIS_CARD: the card itself only', () => {
    const f = { attackedBy: 'THIS_CARD' };
    expect(run(f, { kind: 'ALLY', playerId: 'p1', instanceId: 'c1' })).toBe(true);
    expect(run(f, { kind: 'ALLY', playerId: 'p1', instanceId: 'c2' })).toBe(false);
  });
  it('a missing attack source never matches', () => {
    expect(run({ attackedBy: 'YOUR_HERO' })).toBe(false);
    expect(run({ attackedBy: 'THIS_CARD' })).toBe(false);
  });
});
