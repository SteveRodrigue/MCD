import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

type Json = Record<string, any>;

const PACK_DIR = path.resolve(__dirname, '../../src/data/supplemental/pack');
const UPSTREAM_DIR = path.resolve(__dirname, '../../data/upstream/pack');

const packs: { file: string; cards: Record<string, Json> }[] = fs
  .readdirSync(PACK_DIR)
  .filter((f) => f.endsWith('.json'))
  .map((file) => ({
    file,
    cards: JSON.parse(fs.readFileSync(path.join(PACK_DIR, file), 'utf-8')).cards,
  }));

const upstream: Record<string, Json> = {};
for (const file of fs.readdirSync(UPSTREAM_DIR).filter((f) => f.endsWith('.json'))) {
  for (const card of JSON.parse(fs.readFileSync(path.join(UPSTREAM_DIR, file), 'utf-8'))) {
    upstream[card.code] = card;
  }
}

const entries = packs.flatMap(({ file, cards }) =>
  Object.entries(cards).map(([code, entry]) => ({ file, code, entry })),
);
const abilities = entries.flatMap(({ file, code, entry }) =>
  ((entry.abilities ?? []) as Json[]).map((ability) => ({ file, code, ability })),
);
const steps = abilities.flatMap(({ file, code, ability }) =>
  ((ability.steps ?? []) as Json[]).map((step) => ({ file, code, abilityId: ability.id, step })),
);

const REMOVED_CARD_FIELDS = [
  'traits',
  'keywords',
  'maxPerPlayer',
  'isLandscape',
  'restrictedSlots',
  'additionalBoostCards',
  'attackCost',
  'thwartCost',
  'victoryPoints',
];

describe('Supplemental pack guards: every entry belongs to a card', () => {
  it('no supplemental entry names a code the upstream card data does not have', () => {
    const orphans = entries.filter(({ code }) => !(code in upstream)).map(({ file, code }) => `${file}:${code}`);
    expect(orphans).toEqual([]);
  });
});

describe('Supplemental pack guards: removed fields stay removed (data-level regression guard)', () => {
  it('scans every supplemental pack', () => {
    expect(packs.length).toBeGreaterThanOrEqual(5);
    expect(entries.length).toBeGreaterThan(150);
  });

  it.each(REMOVED_CARD_FIELDS)('no card declares the upstream-derived field %s', (field) => {
    const users = entries.filter(({ entry }) => field in entry).map(({ file, code }) => `${file}:${code}`);
    expect(users).toEqual([]);
  });

  it('no ability declares manual labels', () => {
    const users = abilities.filter(({ ability }) => 'labels' in ability).map(({ file, code }) => `${file}:${code}`);
    expect(users).toEqual([]);
  });

  it.each(['target', 'filter', 'distinctFrom'])('no step declares the step-level field %s', (field) => {
    const users = steps.filter(({ step }) => field in step).map(({ file, code, abilityId }) => `${file}:${code}:${abilityId}`);
    expect(users).toEqual([]);
  });

  it('no ability cost declares cost.resources', () => {
    const users = abilities.filter(({ ability }) => ability.cost && 'resources' in ability.cost).map(({ file, code }) => `${file}:${code}`);
    expect(users).toEqual([]);
  });

  it('every ability resourceCost is a typed map', () => {
    const users = abilities
      .filter(({ ability }) => ability.cost && 'resourceCost' in ability.cost)
      .filter(({ ability }) => typeof ability.cost.resourceCost !== 'object' || ability.cost.resourceCost === null)
      .map(({ file, code }) => `${file}:${code}`);
    expect(users).toEqual([]);
  });

  it('no ADD_THREAT step declares effectParams.condition', () => {
    const users = steps
      .filter(({ step }) => step.effect === 'ADD_THREAT' && step.effectParams && 'condition' in step.effectParams)
      .map(({ file, code }) => `${file}:${code}`);
    expect(users).toEqual([]);
  });
});

describe('Supplemental pack guards: hand-event costs', () => {
  const PRINTS_RESOURCE_COST = /\bspend\b[^.]*\[(physical|energy|mental|wild)\]/i;

  it('no HAND-zone event ability declares cost.resourceCost unless the card prints an extra resource cost', () => {
    const offenders = abilities
      .filter(({ code, ability }) => ability.zone === 'HAND' && upstream[code]?.type_code === 'event')
      .filter(({ ability }) => ability.cost && ability.cost.resourceCost !== undefined)
      .filter(({ code }) => !PRINTS_RESOURCE_COST.test(upstream[code]?.text ?? ''))
      .map(({ file, code, ability }) => `${file}:${code}:${ability.id}`);
    expect(offenders).toEqual([]);
  });
});
