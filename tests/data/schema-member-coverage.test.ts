import { describe, it, expect } from 'vitest';
import path from 'path';
import { z } from 'zod';
import {
  inventorySchemaMembers,
  inventoryEffectParamMembers,
  findUnreadMembers,
  formatUnreadMember,
  readReaderSources,
  readAuthoringSources,
  KNOWN_GAPS,
} from '../../tools/audit/schema-member-coverage';

const ROOT = path.resolve(__dirname, '../..');

describe('schema member coverage (#276)', () => {
  const members = inventorySchemaMembers();
  const source = readReaderSources(ROOT);
  const authoringSource = readAuthoringSources(ROOT);

  describe('inventory', () => {
    it('finds known fields and enum members so the walker cannot silently shrink', () => {
      const ids = new Set(members.map((m) => m.id));
      expect(ids.has('cards.abilities.steps.effect=DRAW')).toBe(true);
      expect(ids.has('cards.abilities.steps.gate=IF_FORM')).toBe(true);
      expect(ids.has('cards.uses.counterType')).toBe(true);
      expect(ids.has('cards.abilities.triggerFilter.defenderType')).toBe(true);
      expect(members.length).toBeGreaterThan(300);
    });

    it('does not list editor metadata as an engine member', () => {
      expect(members.some((m) => m.name === '$schema')).toBe(false);
    });
  });

  describe('guard mechanics', () => {
    const dummy = z.object({
      alpha: z.string().optional(),
      kind: z.enum(['ONE', 'TWO']),
    });

    it('names an object field that nothing reads', () => {
      const unread = findUnreadMembers(
        inventorySchemaMembers(dummy),
        'const x = card.kind; if (x === "ONE") {}',
      );
      expect(unread.map(formatUnreadMember)).toEqual([
        'Schema member alpha: no reader in src/engine (without models/abilities.ts) or src/ui (without the editor)',
        'Schema member kind=TWO: no reader in src/engine (without models/abilities.ts) or src/ui (without the editor)',
      ]);
    });

    it('accepts property access, optional chaining, destructuring and enum literals', () => {
      const unread = findUnreadMembers(
        inventorySchemaMembers(dummy),
        "const { alpha } = a; b?.kind; if (k === 'ONE' || k === 'TWO') {}",
      );
      expect(unread).toEqual([]);
    });
  });

  it('every schema member has a reader in the engine or the UI', () => {
    const unread = findUnreadMembers(members, source, authoringSource).filter(
      (member) => !(member.id in KNOWN_GAPS),
    );
    expect(unread.map(formatUnreadMember)).toEqual([]);
  });

  it('every allowed effectParams key has a reader in the engine or the UI', () => {
    const params = inventoryEffectParamMembers();
    expect(params.length).toBeGreaterThan(100);
    expect(findUnreadMembers(params, source).map(formatUnreadMember)).toEqual([]);
  });

  it('every approved gap still exists and still has no reader', () => {
    const ids = new Set(members.map((member) => member.id));
    for (const id of Object.keys(KNOWN_GAPS)) {
      expect(ids.has(id), `${id} is no longer in the schema: remove it from KNOWN_GAPS`).toBe(true);
    }
    const stillUnread = new Set(
      findUnreadMembers(members, source, authoringSource).map((member) => member.id),
    );
    for (const id of Object.keys(KNOWN_GAPS)) {
      if (id.endsWith('=THIS_CARD')) continue; // generic read, see the entry reason
      expect(stillUnread.has(id), `${id} now has a reader: remove it from KNOWN_GAPS`).toBe(true);
    }
  });
});
