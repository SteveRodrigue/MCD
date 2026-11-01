import { describe, it, expect } from 'vitest';
import {
  OFFICIAL_CARD_CODE_PATTERN,
  PACK_API_VERSION,
  PackManifestSchema,
  isReservedPackId,
  userCardCodePattern,
} from '../../src/data/packs/pack-manifest';

const valid = {
  id: 'my-hero-pack',
  name: 'My Hero Pack',
  kind: 'hero',
  origin: 'user',
  apiVersion: PACK_API_VERSION,
  version: '1.0.0',
  dependsOn: ['core'],
};

describe('PackManifestSchema', () => {
  it('accepts a valid manifest and defaults dependsOn', () => {
    expect(PackManifestSchema.safeParse(valid).success).toBe(true);
    const { dependsOn: _omit, ...withoutDeps } = valid;
    expect(PackManifestSchema.parse(withoutDeps).dependsOn).toEqual([]);
  });

  it.each([
    ['id with uppercase', { id: 'MyPack' }],
    ['id too short', { id: 'a' }],
    ['id starting with a digit', { id: '1pack' }],
    ['unknown origin', { origin: 'official-sync-ish' }],
    ['unknown kind', { kind: 'expansion' }],
    ['non-integer apiVersion', { apiVersion: 1.5 }],
    ['unknown property', { extra: true }],
  ])('rejects %s', (_label, patch) => {
    expect(PackManifestSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
  });

  it('accepts the official pack codes that contain underscores or two letters', () => {
    for (const id of ['cw', 'bp', 'mut_gen', 'wonder_man']) {
      expect(PackManifestSchema.safeParse({ ...valid, id }).success).toBe(true);
    }
  });

  it('accepts all three origins', () => {
    for (const origin of ['official-bundled', 'official-sync', 'user']) {
      expect(PackManifestSchema.safeParse({ ...valid, origin }).success).toBe(true);
    }
  });
});

describe('reserved identifiers', () => {
  const official = ['core', 'gob', 'cap'];

  it('reserves official pack codes, the _encounter suffix and leading digits', () => {
    expect(isReservedPackId('core', official)).toBe(true);
    expect(isReservedPackId('my_encounter', official)).toBe(true);
    expect(isReservedPackId('01pack', official)).toBe(true);
    expect(isReservedPackId('my-hero-pack', official)).toBe(false);
  });

  it('matches official card codes and rejects user-style codes', () => {
    expect(OFFICIAL_CARD_CODE_PATTERN.test('01001a')).toBe(true);
    expect(OFFICIAL_CARD_CODE_PATTERN.test('21001')).toBe(true);
    expect(OFFICIAL_CARD_CODE_PATTERN.test('my-hero-pack-0001')).toBe(false);
  });

  it('builds the user card code pattern from the pack id', () => {
    const pattern = userCardCodePattern('my-hero-pack');
    expect(pattern.test('my-hero-pack-0001')).toBe(true);
    expect(pattern.test('my-hero-pack-0001b')).toBe(true);
    expect(pattern.test('other-pack-0001')).toBe(false);
    expect(pattern.test('01001')).toBe(false);
  });
});
