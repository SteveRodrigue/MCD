import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { cardCatalog } from '../../src/data/importer/card-loader';
import {
  GameState,
  HeroCard,
  AlterEgoCard,
  CardInstance,
  MinionCard,
  getActiveVillain,
} from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { executeEffect } from '@engine/effects';
import { peekDecisionPrompt, resolveDecisionPrompt } from '@engine/pipeline/prompt-queue';

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

// Issue #247, part 2: an ability labelled "(attack)" is an attack made by the player's identity.
describe('The (attack) label (#247 part 2)', () => {
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
      players: [makePlayer('p1', '01001a', '01001b')],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = state.players[0].hero;
    dispatched.length = 0;
  });

  const abilityOf = (code: string) => cardCatalog.getCard(code)!.enrichment!.abilities![0];

  // Whiplash: Retaliate 1, 4 HP. A larger health is set on the instance so a 5 damage attack
  // (Uppercut) leaves it alive.
  const whiplash = (health?: number): CardInstance => {
    const m = createCardInstance(cardCatalog.getCard('01172')!);
    if (health) m.card = { ...m.card, health } as MinionCard;
    state.players[0].engagedMinions.push(m);
    return m;
  };

  const play = (code: string, ability: any, ctx: Record<string, unknown> = {}) => {
    const res = executeEffect(state, ability, {
      playerId: 'p1',
      sourceCardInstance: createCardInstance(cardCatalog.getCard(code)!, 'p1'),
      ...ctx,
    } as any);
    state = res.state ?? state;
    return res;
  };

  const plainDamage = (amount: number, target: string) => ({
    id: 'plain_damage',
    timing: 'ACTION',
    steps: [{ effect: 'DEAL_DAMAGE', effectParams: { amount, target } }],
  });

  const resolved = () => dispatched.filter((d) => d.trigger === 'ATTACK_RESOLVED');

  describe('6. Retaliate follows attacks only', () => {
    it('Uppercut (01054) on a surviving Retaliate minion: the hero takes the Retaliate damage', () => {
      const m = whiplash(8);
      const before = state.players[0].health;

      play('01054', abilityOf('01054'), {
        chosenTargetType: 'minion',
        chosenTargetInstanceId: m.instanceId,
      });

      expect(m.tokens?.damage).toBe(5);
      expect(state.players[0].health).toBe(before - 1);
    });

    it('Haymaker (01087) on the real Whiplash: Retaliate hits the hero', () => {
      const m = whiplash();
      const before = state.players[0].health;

      play('01087', abilityOf('01087'), {
        chosenTargetType: 'minion',
        chosenTargetInstanceId: m.instanceId,
      });

      expect(m.tokens?.damage).toBe(3);
      expect(state.players[0].health).toBe(before - 1);
    });

    it('a damage effect that is not an attack provokes no Retaliate', () => {
      const m = whiplash(8);
      const before = state.players[0].health;

      play('01054', plainDamage(3, 'CHOSEN_MINION'), {
        chosenTargetType: 'minion',
        chosenTargetInstanceId: m.instanceId,
      });

      expect(m.tokens?.damage).toBe(3);
      expect(state.players[0].health).toBe(before);
    });

    it('a defeat by a labelled attack carries defeatSource HERO, byAttack, the resolving player', () => {
      const m = whiplash(); // 4 HP, Uppercut deals 5
      play('01054', abilityOf('01054'), {
        chosenTargetType: 'minion',
        chosenTargetInstanceId: m.instanceId,
      });

      const defeat = dispatched.find(
        (d) => d.trigger === 'DEFEATED' && d.context.targetInstanceId === m.instanceId,
      );
      expect(defeat?.context.defeatSource).toMatchObject({
        kind: 'HERO',
        playerId: 'p1',
        byAttack: true,
      });
    });

    it('a defeat by an unlabelled effect stays EFFECT, not byAttack', () => {
      const m = whiplash();
      play('01054', plainDamage(9, 'CHOSEN_MINION'), {
        chosenTargetType: 'minion',
        chosenTargetInstanceId: m.instanceId,
      });

      const defeat = dispatched.find(
        (d) => d.trigger === 'DEFEATED' && d.context.targetInstanceId === m.instanceId,
      );
      expect(defeat?.context.defeatSource).toMatchObject({ kind: 'EFFECT', byAttack: false });
    });
  });

  describe('7. One attack, one ATTACK_RESOLVED', () => {
    it('Repulsor Blast (01031) fires ATTACK_RESOLVED once for the villain', () => {
      play('01031', abilityOf('01031'));

      expect(resolved()).toHaveLength(1);
      expect(resolved()[0].context).toMatchObject({ targetPlayerId: 'p1', targetType: 'villain' });
    });

    it('a labelled ability with two damage steps is still one attack', () => {
      const ability = {
        id: 'double',
        timing: 'HERO_ACTION',
        labels: ['ATTACK'],
        steps: [
          { id: 'a', effect: 'DEAL_DAMAGE', effectParams: { amount: 1, target: 'VILLAIN' } },
          { id: 'b', effect: 'DEAL_DAMAGE', effectParams: { amount: 1, target: 'VILLAIN' } },
        ],
      };
      const before = getActiveVillain(state).health;
      play('01054', ability);

      expect(getActiveVillain(state).health).toBe(before - 2);
      expect(resolved()).toHaveLength(1);
    });

    it('names the attacked minion and its controller', () => {
      const m = whiplash(8);
      play('01054', abilityOf('01054'), {
        chosenTargetType: 'minion',
        chosenTargetInstanceId: m.instanceId,
      });

      expect(resolved()).toHaveLength(1);
      expect(resolved()[0].context).toMatchObject({
        targetPlayerId: 'p1',
        targetType: 'minion',
        targetInstanceId: m.instanceId,
      });
    });

    it('an unlabelled damage effect fires no ATTACK_RESOLVED', () => {
      play('01054', plainDamage(1, 'VILLAIN'));
      expect(resolved()).toHaveLength(0);
    });

    it('a target the player picks from a prompt is still one labelled attack', () => {
      const m = whiplash(8);
      const before = state.players[0].health;
      play('01054', abilityOf('01054'));
      expect(peekDecisionPrompt(state)).toBeDefined();
      expect(resolved()).toHaveLength(0);

      state = resolveDecisionPrompt(state, 'p1', m.instanceId).state;

      expect(m.tokens?.damage).toBe(5);
      expect(state.players[0].health).toBe(before - 1);
      expect(resolved()).toHaveLength(1);
      expect(resolved()[0].context).toMatchObject({
        targetType: 'minion',
        targetInstanceId: m.instanceId,
      });
    });
  });

  describe('7b. Every label survives a target prompt', () => {
    it('an ability labelled ATTACK and THWART keeps both labels after the target is picked', () => {
      const m = whiplash(8);
      whiplash(8); // a second minion, so the target prompt opens
      const before = state.players[0].health;
      play('01054', {
        id: 'attack_thwart',
        timing: 'HERO_ACTION',
        labels: ['ATTACK', 'THWART'],
        steps: [{ effect: 'DEAL_DAMAGE', effectParams: { amount: 3, target: 'CHOSEN_MINION' } }],
      });

      const prompt = peekDecisionPrompt(state);
      expect(prompt).toBeDefined();
      expect(prompt!.options.map((o) => (o.params as any)?.labels)).toEqual([
        ['ATTACK', 'THWART'],
        ['ATTACK', 'THWART'],
      ]);
      expect(resolved()).toHaveLength(0);

      state = resolveDecisionPrompt(state, 'p1', m.instanceId).state;

      expect(m.tokens?.damage).toBe(3);
      expect(state.players[0].health).toBe(before - 1); // Retaliate: it was an attack
      expect(resolved()).toHaveLength(1);
    });
  });

  describe('8. Data: the 13 core cards that print (attack)', () => {
    const expected: Record<string, string> = {
      '01005': 'swinging_web_kick',
      '01013': 'photonic_blast',
      '01018': 'energy_channel_blast',
      '01021': 'gamma_slam_action',
      '01031': 'repulsor_blast',
      '01032': 'supersonic_punch',
      '01038': 'powered_gauntlets',
      '01047': 'panther_claws_special',
      '01049': 'vibranium_suit_special',
      '01053': 'relentless_assault',
      '01054': 'uppercut',
      '01077': 'counter_punch_response',
      '01087': 'haymaker',
    };

    const pack = JSON.parse(
      fs.readFileSync(
        path.resolve(__dirname, '../../src/data/supplemental/pack/core.json'),
        'utf8',
      ),
    ).cards as Record<
      string,
      { abilities?: Array<{ id: string; labels?: string[] }>; audit?: any }
    >;

    for (const [code, abilityId] of Object.entries(expected)) {
      it(`${code}: ${abilityId} declares labels ["ATTACK"] and the card prints (attack)`, () => {
        const card = pack[code];
        expect(card.audit?.originalText).toContain('<i>(attack)</i>');
        const labelled = (card.abilities ?? []).filter((a) => a.labels?.includes('ATTACK'));
        expect(labelled.map((a) => a.id)).toEqual([abilityId]);
        expect(labelled[0].labels).toEqual(['ATTACK']);
      });
    }

    it('no other core card declares ATTACK', () => {
      const others = Object.entries(pack)
        .filter(([code]) => !(code in expected))
        .filter(([, card]) => (card.abilities ?? []).some((a) => a.labels?.includes('ATTACK')))
        .map(([code]) => code);
      expect(others).toEqual([]);
    });

    it('the schema accepts labels and rejects unknown ones', async () => {
      const { CardAbilitySchema } = await import('../../src/data/supplemental/schema');
      const base = {
        id: 'x',
        timing: 'HERO_ACTION',
        steps: [{ effect: 'DEAL_DAMAGE', effectParams: { amount: 1 } }],
      };
      expect(
        CardAbilitySchema.safeParse({ ...base, labels: ['ATTACK', 'THWART', 'DEFENSE'] }).success,
      ).toBe(true);
      expect(CardAbilitySchema.safeParse({ ...base, labels: ['SCHEME'] }).success).toBe(false);
    });
  });
});
