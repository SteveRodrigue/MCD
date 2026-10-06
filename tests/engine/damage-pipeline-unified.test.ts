import { describe, it, expect, beforeEach, vi } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import {
  GameState,
  HeroCard,
  AlterEgoCard,
  CardInstance,
  MinionCard,
  StatusCard,
  getActiveVillain,
} from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { executeEffect } from '@engine/effects';
import { applyDamageToTarget, dispatchDefeat } from '@engine/pipeline/damage-pipeline';
import { peekDecisionPrompt } from '@engine/pipeline/prompt-queue';

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

// Issue #247, part 1: every DEAL_DAMAGE branch goes through the one damage pipeline
// (applyDamageToTarget), so Tough, damage shields, defeat triggers, Overkill, excess damage and
// player defeat behave the same whatever the target.
describe('One damage pipeline for ability damage (#247 part 1)', () => {
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
    dispatched.length = 0;
  });

  const eventCard = () => createCardInstance(cardCatalog.getCard('01087')!, 'p1'); // Haymaker
  const minion = (): CardInstance => createCardInstance(cardCatalog.getCard('01101')!); // 3 HP
  const ally = (): CardInstance => createCardInstance(cardCatalog.getCard('01002')!, 'p1'); // 2 HP
  const shield = (): CardInstance => createCardInstance(cardCatalog.getCard('01098')!);

  const ability = (params: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
    ({
      id: 'test_damage',
      timing: 'HERO_ACTION',
      steps: [{ id: 'dmg', effect: 'DEAL_DAMAGE', effectParams: params, ...extra }],
    }) as any;

  const run = (params: Record<string, unknown>, ctx: Record<string, unknown> = {}) => {
    const res = executeEffect(state, ability(params), {
      playerId: 'p1',
      sourceCardInstance: eventCard(),
      ...ctx,
    } as any);
    state = res.state ?? state;
    return res;
  };

  const defeats = (trigger: 'DEFEATED' | 'CHARACTER_DEFEATED') =>
    dispatched.filter((d) => d.trigger === trigger);

  // A damage site: a character the branch hits, with what protects it and how to see damage on it.
  interface Site {
    name: string;
    statusCards: StatusCard[];
    attachments: CardInstance[];
    damage: () => number;
  }

  const villainSite = (): Site => {
    const v = getActiveVillain(state);
    const start = v.health;
    return {
      name: 'villain',
      statusCards: v.statusCards,
      attachments: v.attachments ?? (v.attachments = []),
      damage: () => start - v.health,
    };
  };
  const minionSite = (owner: 0 | 1 = 0): Site => {
    const m = minion();
    m.statusCards = [];
    state.players[owner].engagedMinions.push(m);
    return {
      name: `minion of p${owner + 1}`,
      statusCards: m.statusCards!,
      attachments: m.attachments!,
      damage: () => m.tokens?.damage ?? 0,
    };
  };
  const heroSite = (index: 0 | 1 = 0): Site => {
    const p = state.players[index];
    const start = p.health;
    p.attachments = p.attachments ?? [];
    return {
      name: `hero p${index + 1}`,
      statusCards: p.statusCards,
      attachments: p.attachments as CardInstance[],
      damage: () => start - p.health,
    };
  };
  const allySite = (): Site & { id: string } => {
    const a = ally();
    a.statusCards = [];
    state.players[0].allies.push(a);
    return {
      id: a.instanceId,
      name: 'ally',
      statusCards: a.statusCards!,
      attachments: a.attachments!,
      damage: () => a.tokens?.damage ?? 0,
    };
  };

  interface Branch {
    name: string;
    params: Record<string, unknown>;
    sites: () => { sites: Site[]; ctx?: Record<string, unknown> };
  }

  const branches: Branch[] = [
    {
      name: 'chosen minion',
      params: { amount: 2, target: 'CHOSEN_MINION' },
      sites: () => {
        const m = minionSite();
        return {
          sites: [m],
          ctx: { chosenTargetInstanceId: state.players[0].engagedMinions[0].instanceId },
        };
      },
    },
    {
      name: 'villain (default)',
      params: { amount: 2, target: 'VILLAIN' },
      sites: () => ({ sites: [villainSite()] }),
    },
    {
      name: 'engaged enemies',
      params: { amount: 2, target: 'ENGAGED_ENEMIES' },
      sites: () => ({ sites: [villainSite(), minionSite()], ctx: { targetPlayerId: 'p1' } }),
    },
    {
      name: 'all enemies',
      params: { amount: 2, target: 'ALL_ENEMIES' },
      sites: () => ({ sites: [villainSite(), minionSite(0), minionSite(1)] }),
    },
    {
      name: 'all characters',
      params: { amount: 2, target: 'ALL_CHARACTERS' },
      sites: () => ({
        sites: [villainSite(), minionSite(0), minionSite(1), heroSite(0), heroSite(1), allySite()],
      }),
    },
    {
      name: 'identity',
      params: { amount: 2, target: 'SELF_IDENTITY' },
      sites: () => ({ sites: [heroSite(0)] }),
    },
    {
      name: 'all heroes',
      params: { amount: 2, target: 'ALL_HEROES' },
      sites: () => ({ sites: [heroSite(0), heroSite(1)] }),
    },
    {
      name: 'explosion assignment',
      params: { amount: 3, target: 'ALL_HEROES_AND_ALLIES' },
      sites: () => {
        const a = allySite();
        return {
          sites: [a, heroSite(1)],
          ctx: { assignments: { [a.id]: 1, p2: 1 } },
        };
      },
    },
  ];

  describe('1. Tough, damage shields and defeat go through the pipeline for every target kind', () => {
    for (const branch of branches) {
      it(`${branch.name}: Tough absorbs the damage`, () => {
        const { sites, ctx } = branch.sites();
        for (const s of sites) s.statusCards.push(StatusCard.TOUGH);

        run(branch.params, ctx);

        for (const s of sites) {
          expect(s.damage(), `${s.name} took damage`).toBe(0);
          expect(s.statusCards, `${s.name} kept Tough`).not.toContain(StatusCard.TOUGH);
        }
      });

      it(`${branch.name}: a damage shield takes the damage instead`, () => {
        const { sites, ctx } = branch.sites();
        const shields = sites.map((s) => {
          const sh = shield();
          s.attachments.push(sh);
          return sh;
        });

        run(branch.params, ctx);

        sites.forEach((s, i) => {
          expect(s.damage(), `${s.name} took damage`).toBe(0);
          expect(shields[i].tokens?.damage, `${s.name} shield`).toBeGreaterThan(0);
        });
      });
    }

    const defeatBranches: Array<{
      name: string;
      params: Record<string, unknown>;
      setup: () => { ctx?: Record<string, unknown>; defeated: number };
    }> = [
      {
        name: 'chosen minion',
        params: { amount: 9, target: 'CHOSEN_MINION' },
        setup: () => {
          minionSite();
          return {
            ctx: { chosenTargetInstanceId: state.players[0].engagedMinions[0].instanceId },
            defeated: 1,
          };
        },
      },
      {
        name: 'engaged enemies',
        params: { amount: 9, target: 'ENGAGED_ENEMIES' },
        setup: () => {
          minionSite();
          return { ctx: { targetPlayerId: 'p1' }, defeated: 1 };
        },
      },
      {
        name: 'all enemies',
        params: { amount: 9, target: 'ALL_ENEMIES' },
        setup: () => {
          minionSite(0);
          minionSite(1);
          return { defeated: 2 };
        },
      },
      {
        name: 'all characters (minion and ally)',
        params: { amount: 9, target: 'ALL_CHARACTERS' },
        setup: () => {
          minionSite(0);
          allySite();
          state.players.forEach((p) => (p.health = 99));
          return { defeated: 2 };
        },
      },
      {
        name: 'explosion assignment (ally)',
        params: { amount: 5, target: 'ALL_HEROES_AND_ALLIES' },
        setup: () => {
          const a = allySite();
          return { ctx: { assignments: { [a.id]: 5 } }, defeated: 1 };
        },
      },
    ];

    for (const branch of defeatBranches) {
      it(`${branch.name}: a defeat fires DEFEATED and CHARACTER_DEFEATED once each, with defeatSource`, () => {
        const { ctx, defeated } = branch.setup();
        const source = eventCard();

        run(branch.params, { ...ctx, sourceCardInstance: source });

        expect(defeats('DEFEATED')).toHaveLength(defeated);
        expect(defeats('CHARACTER_DEFEATED')).toHaveLength(defeated);
        for (const d of [...defeats('DEFEATED'), ...defeats('CHARACTER_DEFEATED')]) {
          expect(d.context.defeatSource).toEqual({
            kind: 'EFFECT',
            playerId: 'p1',
            instanceId: source.instanceId,
            byAttack: false,
          });
        }
      });
    }

    it('all enemies: a defeated villain fires the defeat triggers once', () => {
      getActiveVillain(state).health = 1;
      run({ amount: 2, target: 'ALL_ENEMIES' });
      const villainDefeats = defeats('DEFEATED').filter((d) => d.context.targetType === 'VILLAIN');
      expect(villainDefeats).toHaveLength(1);
      expect(
        defeats('CHARACTER_DEFEATED').filter((d) => d.context.targetType === 'VILLAIN'),
      ).toHaveLength(1);
    });

    it('identity and all heroes still open the DAMAGE_TAKEN window once per hero hit', () => {
      run({ amount: 1, target: 'SELF_IDENTITY' });
      expect(dispatched.filter((d) => d.trigger === 'DAMAGE_TAKEN')).toHaveLength(1);

      dispatched.length = 0;
      run({ amount: 1, target: 'ALL_HEROES' });
      expect(dispatched.filter((d) => d.trigger === 'DAMAGE_TAKEN')).toHaveLength(2);
    });

    it('Tough absorbing the hit skips the DAMAGE_TAKEN window', () => {
      state.players[0].statusCards.push(StatusCard.TOUGH);
      run({ amount: 1, target: 'SELF_IDENTITY' });
      expect(dispatched.filter((d) => d.trigger === 'DAMAGE_TAKEN')).toHaveLength(0);
    });

    it('keeps the "choose a player" prompt for engaged enemies in multiplayer', () => {
      minionSite(1);
      const before = getActiveVillain(state).health;
      run({ amount: 2, target: 'ENGAGED_ENEMIES', targetPlayer: 'CHOSEN_PLAYER' });
      const prompt = peekDecisionPrompt(state);
      expect(prompt?.title).toBe('Choose a Player');
      expect(getActiveVillain(state).health).toBe(before);
    });

    it('keeps the explosion distribution prompt when no assignment is given', () => {
      allySite();
      run({ amount: 3, target: 'ALL_HEROES_AND_ALLIES' }, { interactivePrompt: true });
      expect(peekDecisionPrompt(state)?.kind).toBe('DISTRIBUTE_POINTS');
    });

    it('maps DamageRequest.sourceType to defeatSource.kind', () => {
      const cases: Array<[string, string]> = [
        ['HERO', 'HERO'],
        ['ALLY', 'ALLY'],
        ['VILLAIN', 'ENEMY'],
        ['MINION', 'ENEMY'],
        ['CARD_EFFECT', 'EFFECT'],
        ['RETALIATE', 'EFFECT'],
        ['OVERKILL', 'EFFECT'],
      ];
      for (const [sourceType, kind] of cases) {
        dispatched.length = 0;
        const m = minionSite();
        void m;
        const target = state.players[0].engagedMinions[state.players[0].engagedMinions.length - 1];
        applyDamageToTarget(state, {
          target: {
            type: 'minion',
            entity: target,
            instanceId: target.instanceId,
            name: target.card.name,
            targetPlayerId: 'p1',
            attachments: target.attachments,
            statusCards: target.statusCards,
          },
          amount: 9,
          sourceType: sourceType as any,
          sourcePlayerId: 'p1',
          isAttack: sourceType === 'HERO',
        });
        const d = defeats('DEFEATED')[0];
        expect(d.context.defeatSource, sourceType).toMatchObject({
          kind,
          playerId: 'p1',
          byAttack: sourceType === 'HERO',
        });
      }
    });

    it('dispatchDefeat fires both character triggers with the defeat source', () => {
      dispatchDefeat(state, {
        targetPlayerId: 'p1',
        targetInstanceId: 'x1',
        targetType: 'MINION',
        defeatSource: { kind: 'HERO', playerId: 'p1', byAttack: true },
      });
      expect(dispatched.map((d) => d.trigger)).toEqual(['DEFEATED', 'CHARACTER_DEFEATED']);
      for (const d of dispatched) {
        expect(d.context).toMatchObject({
          targetPlayerId: 'p1',
          targetInstanceId: 'x1',
          entityType: 'CHARACTER',
          targetType: 'MINION',
          defeatSource: { kind: 'HERO', playerId: 'p1', byAttack: true },
        });
      }
    });
  });

  describe('2. An event that defeats a minion fires the defeat trigger', () => {
    it('Haymaker (01087) on a minion: DEFEATED and CHARACTER_DEFEATED fire for the minion', () => {
      const m = minion();
      state.players[0].engagedMinions.push(m);
      const haymaker = cardCatalog.getCard('01087')!;

      const res = executeEffect(state, haymaker.enrichment!.abilities![0], {
        playerId: 'p1',
        sourceCardInstance: createCardInstance(haymaker, 'p1'),
        chosenTargetType: 'minion',
        chosenTargetInstanceId: m.instanceId,
        resourcesSpent: ['physical', 'physical'],
      } as any);
      state = res.state ?? state;

      expect(state.players[0].engagedMinions).toHaveLength(0);
      const defeated = defeats('DEFEATED').filter(
        (d) => d.context.targetInstanceId === m.instanceId,
      );
      expect(defeated).toHaveLength(1);
      expect(defeated[0].context.targetType).toBe('MINION');
      expect(
        defeats('CHARACTER_DEFEATED').filter((d) => d.context.targetInstanceId === m.instanceId),
      ).toHaveLength(1);
    });
  });

  describe('3. Overkill', () => {
    const relentlessAssault = () => cardCatalog.getCard('01053')!.enrichment!.abilities![0];

    const play = (spent: string[]) => {
      const m = minion();
      state.players[0].engagedMinions.push(m);
      const res = executeEffect(state, relentlessAssault(), {
        playerId: 'p1',
        sourceCardInstance: createCardInstance(cardCatalog.getCard('01053')!, 'p1'),
        chosenTargetType: 'minion',
        chosenTargetInstanceId: m.instanceId,
        resourcesSpent: spent,
      } as any);
      state = res.state ?? state;
      return m;
    };

    it('excess damage on a defeated minion goes to the villain', () => {
      const before = getActiveVillain(state).health;
      play(['physical']);
      expect(state.players[0].engagedMinions).toHaveLength(0);
      expect(getActiveVillain(state).health).toBe(before - 2); // 5 damage, 3 HP minion
    });

    it('the villain Tough absorbs the Overkill damage', () => {
      getActiveVillain(state).statusCards.push(StatusCard.TOUGH);
      const before = getActiveVillain(state).health;
      play(['physical']);
      expect(getActiveVillain(state).health).toBe(before);
      expect(getActiveVillain(state).statusCards).not.toContain(StatusCard.TOUGH);
    });

    it('a villain damage shield takes the Overkill damage', () => {
      const sh = shield();
      getActiveVillain(state).attachments = [sh];
      const before = getActiveVillain(state).health;
      play(['physical']);
      expect(getActiveVillain(state).health).toBe(before);
      expect(sh.tokens?.damage).toBe(2);
    });

    it('without the physical resource there is no Overkill', () => {
      const before = getActiveVillain(state).health;
      play(['energy']);
      expect(state.players[0].engagedMinions).toHaveLength(0);
      expect(getActiveVillain(state).health).toBe(before);
    });

    it('the pipeline honours hasOverkill for a request', () => {
      const m = minion();
      state.players[0].engagedMinions.push(m);
      const before = getActiveVillain(state).health;
      const { result } = applyDamageToTarget(state, {
        target: {
          type: 'minion',
          entity: m,
          instanceId: m.instanceId,
          name: m.card.name,
          targetPlayerId: 'p1',
          attachments: m.attachments,
          statusCards: m.statusCards,
        },
        amount: 7,
        sourceType: 'HERO',
        sourcePlayerId: 'p1',
        isAttack: true,
        hasOverkill: true,
      });
      expect(result.targetDefeated).toBe(true);
      expect(result.excessDamage).toBe(4);
      expect(getActiveVillain(state).health).toBe(before - 4);
    });
  });

  describe('4. EXCESS_DAMAGE_DEALT and TARGET_DEFEATED read the pipeline result', () => {
    const conditional = (condition: string) =>
      ({
        id: 'cond',
        timing: 'HERO_ACTION',
        steps: [
          {
            id: 'deal_dmg',
            effect: 'DEAL_DAMAGE',
            condition,
            effectParams: { amount: 0, target: 'MINION' },
          },
          {
            id: 'then_draw',
            effect: 'DRAW',
            gate: 'IF_CONDITION_MET',
            gateParams: { targetStepId: 'deal_dmg' },
            effectParams: { count: 1 },
          },
        ],
      }) as any;

    const attack = (condition: string, amount: number) => {
      const m = minion(); // 3 HP
      state.players[0].engagedMinions.push(m);
      const ab = conditional(condition);
      ab.steps[0].effectParams.amount = amount;
      const handBefore = state.players[0].hand.length;
      const res = executeEffect(state, ab, {
        playerId: 'p1',
        chosenTargetType: 'minion',
        chosenTargetInstanceId: m.instanceId,
      } as any);
      state = res.state ?? state;
      return { drew: state.players[0].hand.length - handBefore, m };
    };

    it('EXCESS_DAMAGE_DEALT: met when damage exceeds the minion hit points', () => {
      expect(attack('EXCESS_DAMAGE_DEALT', 5).drew).toBe(1);
    });

    it('EXCESS_DAMAGE_DEALT: not met when damage exactly defeats the minion', () => {
      const r = attack('EXCESS_DAMAGE_DEALT', 3);
      expect(state.players[0].engagedMinions).toHaveLength(0);
      expect(r.drew).toBe(0);
    });

    it('EXCESS_DAMAGE_DEALT: not met when the minion survives', () => {
      const r = attack('EXCESS_DAMAGE_DEALT', 1);
      expect(state.players[0].engagedMinions).toHaveLength(1);
      expect(r.drew).toBe(0);
    });

    it('TARGET_DEFEATED: met when the minion is defeated', () => {
      expect(attack('TARGET_DEFEATED', 3).drew).toBe(1);
    });

    it('TARGET_DEFEATED: not met when the minion survives', () => {
      expect(attack('TARGET_DEFEATED', 2).drew).toBe(0);
    });

    it('the pipeline result carries excessDamage and targetDefeated', () => {
      const m = createCardInstance(cardCatalog.getCard('01101')!) as CardInstance;
      state.players[0].engagedMinions.push(m);
      const hp = (m.card as MinionCard).health;
      const { result } = applyDamageToTarget(state, {
        target: {
          type: 'minion',
          entity: m,
          instanceId: m.instanceId,
          name: m.card.name,
          targetPlayerId: 'p1',
          attachments: m.attachments,
          statusCards: m.statusCards,
        },
        amount: hp + 2,
        sourceType: 'CARD_EFFECT',
        sourcePlayerId: 'p1',
      });
      expect(result.targetDefeated).toBe(true);
      expect(result.excessDamage).toBe(2);
    });
  });

  describe('5. A hero reduced to 0 by ability damage is eliminated; the game is lost with the last hero (#246)', () => {
    it('identity: only that player is eliminated, the game goes on', () => {
      run({ amount: 99, target: 'SELF_IDENTITY' });
      expect(state.winner).toBeNull();
      expect(state.players.map((p) => p.id)).toEqual(['p2']);
      expect(defeats('DEFEATED').some((d) => d.context.targetType === 'PLAYER')).toBe(true);
    });

    for (const target of ['ALL_HEROES', 'ALL_CHARACTERS']) {
      it(`${target}: every hero eliminated, winner is VILLAIN`, () => {
        run({ amount: 99, target });
        expect(state.winner).toBe('VILLAIN');
        expect(state.players).toHaveLength(0);
        expect(defeats('DEFEATED').some((d) => d.context.targetType === 'PLAYER')).toBe(true);
      });
    }

    it('explosion assignment: the hero that took the damage is eliminated, the other plays on', () => {
      run({ amount: 99, target: 'ALL_HEROES_AND_ALLIES' }, { assignments: { p2: 99 } });
      expect(state.winner).toBeNull();
      expect(state.players.map((p) => p.id)).toEqual(['p1']);
    });

    it('the pipeline eliminates the player itself for a player target', () => {
      const p = state.players[0];
      applyDamageToTarget(state, {
        target: {
          type: 'player',
          entity: p,
          name: p.name,
          attachments: p.attachments,
          statusCards: p.statusCards,
        },
        amount: 99,
        sourceType: 'CARD_EFFECT',
        sourcePlayerId: 'p1',
      });
      expect(p.health).toBe(0);
      expect(state.players.map((pl) => pl.id)).toEqual(['p2']);
      expect(state.winner).toBeNull();
    });

    it('a hero that survives does not end the game', () => {
      run({ amount: 1, target: 'SELF_IDENTITY' });
      expect(state.winner).toBeNull();
    });
  });
});
