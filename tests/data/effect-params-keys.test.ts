import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { EffectTypeSchema } from '../../src/data/supplemental/schema';
import { EFFECT_PARAM_KEYS } from '../../src/data/supplemental/effect-params';

const PACK_DIR = path.resolve(__dirname, '../../src/data/supplemental/pack');
const PACK_FILES = ['aoa_encounter.json', 'core.json', 'core_encounter.json', 'cw_encounter.json', 'mts.json'];

interface Violation {
  card: string;
  effect: string;
  key: string;
}

/**
 * Walks every object in a card (abilities, boost/reaction abilities, forEachPlayer,
 * nested PLAYER_CHOICE option steps, ...) and reports unknown effectParams keys.
 */
function findUnknownEffectParamKeys(card: unknown, cardCode: string): Violation[] {
  const violations: Violation[] = [];
  const effects = new Set<string>(EffectTypeSchema.options);
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (node === null || typeof node !== 'object') return;
    const obj = node as Record<string, unknown>;
    if (
      typeof obj.effect === 'string' &&
      effects.has(obj.effect) &&
      obj.effectParams &&
      typeof obj.effectParams === 'object'
    ) {
      const allowed = EFFECT_PARAM_KEYS[obj.effect as keyof typeof EFFECT_PARAM_KEYS];
      for (const key of Object.keys(obj.effectParams as object)) {
        if (!allowed.includes(key)) violations.push({ card: cardCode, effect: obj.effect, key });
      }
    }
    Object.values(obj).forEach(walk);
  };
  walk(card);
  return violations;
}

const format = (v: Violation[]) =>
  v.map((x) => `card ${x.card}: effect ${x.effect} has unknown effectParams key "${x.key}"`).join('\n');

function loadPack(file: string): Record<string, unknown>[] {
  const raw = JSON.parse(fs.readFileSync(path.join(PACK_DIR, file), 'utf8'));
  return Object.entries(raw.cards as Record<string, object>).map(([code, card]) => ({
    ...card,
    code,
  }));
}

describe('effectParams key guard (#230)', () => {
  for (const file of PACK_FILES) {
    it(`${file} uses only documented effectParams keys`, () => {
      const cards = loadPack(file);
      expect(cards.length).toBeGreaterThan(0);
      const violations = cards.flatMap((c) =>
        findUnknownEffectParamKeys(c, String((c as { code?: string }).code ?? '?')),
      );
      expect(violations, format(violations)).toEqual([]);
    });
  }

  it('table covers every EffectType', () => {
    for (const effect of EffectTypeSchema.options) {
      expect(Array.isArray(EFFECT_PARAM_KEYS[effect]), `Missing table entry: ${effect}`).toBe(true);
    }
    expect(Object.keys(EFFECT_PARAM_KEYS).sort()).toEqual([...EffectTypeSchema.options].sort());
  });

  it('rejects an unknown key and names card, effect and key', () => {
    const card = {
      code: '99999',
      abilities: [{ steps: [{ effect: 'DRAW', effectParams: { count: 1, bogusKey: 2 } }] }],
    };
    const v = findUnknownEffectParamKeys(card, '99999');
    expect(v).toEqual([{ card: '99999', effect: 'DRAW', key: 'bogusKey' }]);
    expect(format(v)).toContain('99999');
    expect(format(v)).toContain('DRAW');
    expect(format(v)).toContain('bogusKey');
  });

  it('checks nested PLAYER_CHOICE option steps', () => {
    const card = {
      code: '99998',
      abilities: [
        {
          steps: [
            {
              effect: 'PLAYER_CHOICE',
              effectParams: {
                options: [{ label: 'a', steps: [{ effect: 'DRAW', effectParams: { nope: 1 } }] }],
              },
            },
          ],
        },
      ],
    };
    const v = findUnknownEffectParamKeys(card, '99998');
    expect(v.map((x) => `${x.effect}.${x.key}`)).toEqual(['DRAW.nope']);
  });

  it('rejects the retired pseudo-primitive keys scaling, multiplier and maxBonus (#231)', () => {
    const card = {
      code: '99997',
      abilities: [
        {
          steps: [
            { effect: 'MODIFY_STAT', effectParams: { stat: 'THWART', scaling: 'X', maxBonus: 1 } },
            { effect: 'REMOVE_THREAT', effectParams: { multiplier: 1 } },
            { effect: 'ADD_COUNTERS', effectParams: { scaling: 'X' } },
          ],
        },
      ],
    };
    const v = findUnknownEffectParamKeys(card, '99997');
    expect(v.map((x) => `${x.effect}.${x.key}`).sort()).toEqual([
      'ADD_COUNTERS.scaling',
      'MODIFY_STAT.maxBonus',
      'MODIFY_STAT.scaling',
      'REMOVE_THREAT.multiplier',
    ]);
  });

  it('rejects the decorative keys retired in #232', () => {
    const card = {
      code: '99996',
      abilities: [
        {
          steps: [
            { effect: 'ATTACHMENT_DAMAGE_SHIELD', effectParams: { maxAbsorb: 5, mode: 'X', target: 'SELF' } },
            { effect: 'TRANSFER_DAMAGE', effectParams: { amount: 1, from: 'SELF', to: 'CHOSEN_ENEMY' } },
            { effect: 'PREVENT_DAMAGE', effectParams: { target: 'SELF' } },
            { effect: 'RETURN_TO_HAND', effectParams: { target: 'SELF' } },
            { effect: 'VILLAIN_ATTACKS', effectParams: { target: 'SELF_IDENTITY' } },
          ],
        },
      ],
    };
    const v = findUnknownEffectParamKeys(card, '99996');
    expect(v.map((x) => `${x.effect}.${x.key}`).sort()).toEqual([
      'ATTACHMENT_DAMAGE_SHIELD.mode',
      'ATTACHMENT_DAMAGE_SHIELD.target',
      'PREVENT_DAMAGE.target',
      'RETURN_TO_HAND.target',
      'TRANSFER_DAMAGE.from',
      'TRANSFER_DAMAGE.to',
      'VILLAIN_ATTACKS.target',
    ]);
  });

  it('rejects capRule on DISTRIBUTE_AMOUNT: the cap comes from allocationDomain (#296)', () => {
    const card = {
      code: '99995',
      abilities: [
        {
          steps: [
            {
              effect: 'DISTRIBUTE_AMOUNT',
              effectParams: { allocationDomain: 'DAMAGE', budget: 3, capRule: 'REMAINING_HP' },
            },
          ],
        },
      ],
    };
    const v = findUnknownEffectParamKeys(card, '99995');
    expect(v).toEqual([{ card: '99995', effect: 'DISTRIBUTE_AMOUNT', key: 'capRule' }]);
  });

  it('every ATTACHMENT_DAMAGE_SHIELD step in the packs declares a numeric maxAbsorb (#232)', () => {
    const missing: string[] = [];
    const walk = (node: unknown, code: string): void => {
      if (Array.isArray(node)) return node.forEach((n) => walk(n, code));
      if (node === null || typeof node !== 'object') return;
      const obj = node as Record<string, unknown>;
      if (obj.effect === 'ATTACHMENT_DAMAGE_SHIELD') {
        const max = (obj.effectParams as Record<string, unknown> | undefined)?.maxAbsorb;
        if (typeof max !== 'number') missing.push(code);
      }
      Object.values(obj).forEach((v) => walk(v, code));
    };
    for (const file of PACK_FILES) {
      for (const c of loadPack(file)) walk(c, String((c as { code?: string }).code));
    }
    expect(missing).toEqual([]);
  });
});
