/**
 * Schema member coverage (#276).
 *
 * Every member of the supplemental schema (object field or enum member) must have a reader in
 * the engine or the UI. The inventory is read from the Zod schemas themselves, so a new member
 * cannot escape the guard. This is a textual check: it proves a name is read somewhere, not that
 * the logic is right (the fake-pack runtime proof is #279).
 *
 * Readers are searched in `src/engine` (without `src/engine/models/abilities.ts`, which only holds the
 * TypeScript copy of the schema enums) and in `src/ui` (without `src/ui/components/editor`, which
 * writes data and never reads it at play time).
 */
import fs from 'fs';
import path from 'path';
import type { ZodType } from 'zod';
import { SupplementalPackSchema } from '../../src/data/supplemental/schema';

export type MemberKind = 'field' | 'enum';

export interface SchemaMember {
  /** Stable id: `owner.path.field` or `owner.path=VALUE` (path of the first place the schema is used). */
  id: string;
  kind: MemberKind;
  /** Property name or enum value searched in source files. */
  name: string;
}

/**
 * Authoring metadata (owner decision, 2026-10-06): written and read by the Card Editor and the
 * dev tooling, never at play time. These subtrees are searched in `src/tools` and in the editor
 * instead of the engine.
 */
export const AUTHORING_METADATA_PREFIXES = ['cards.audit.', 'cards.noSupplementalNeeded'];

/**
 * Members the owner approved as temporarily unread, each tied to an issue. The guard test
 * fails when an entry gets a reader, so an entry cannot outlive its reason.
 */
export const KNOWN_GAPS: Record<string, string> = {
  'cards.errata': '#281 deferred authoring data (official errata, not consumed yet)',
  'cards.abilities.errata': '#281 deferred authoring data (official errata, not consumed yet)',
  'cards.victoryPoints': '#281 deferred authoring data (campaign scoring)',
  'cards.abilities.triggerFilter.attackerCardFilter.hasKeyword=Toughness':
    '#280 keyword spelling does not match the engine (Tough)',
  'cards.abilities.triggerFilter.defeatedByAttackOf=THIS_CARD':
    'read by the else-branch in trigger-dispatcher.ts (not a literal); a shipped card uses it',
};

/** Fields that only exist to recurse into the same filter or step shapes. */
const RECURSIVE_FIELDS = new Set(['all', 'any', 'none', 'steps', 'options']);

/** Editor metadata, not an engine member. */
const NON_ENGINE_FIELDS = new Set(['$schema']);

interface ZodDef {
  type: string;
  innerType?: ZodType;
  element?: ZodType;
  getter?: () => ZodType;
  valueType?: ZodType;
  options?: ZodType[];
  left?: ZodType;
  right?: ZodType;
  in?: ZodType;
  entries?: Record<string, string>;
  shape?: Record<string, ZodType> | (() => Record<string, ZodType>);
}

const defOf = (schema: ZodType): ZodDef | undefined =>
  (schema as unknown as { _zod?: { def?: ZodDef } })._zod?.def;

/**
 * Walks a Zod schema and lists every object field and enum member once. Objects and enums
 * shared by several fields (same schema instance) are reported once, under the first path.
 */
export function inventorySchemaMembers(root: ZodType = SupplementalPackSchema): SchemaMember[] {
  const members = new Map<string, SchemaMember>();
  const seenShapes = new Set<unknown>();
  const seenEnums = new Set<unknown>();

  const walk = (schema: ZodType | undefined, owner: string, depth: number): void => {
    const def = schema ? defOf(schema) : undefined;
    if (!def || depth > 14) return;
    switch (def.type) {
      case 'optional':
      case 'nullable':
      case 'default':
      case 'prefault':
      case 'readonly':
      case 'catch':
      case 'nonoptional':
        return walk(def.innerType, owner, depth + 1);
      case 'array':
        return walk(def.element, owner, depth + 1);
      case 'lazy':
        return walk(def.getter?.(), owner, depth + 1);
      case 'record':
        return walk(def.valueType, owner, depth + 1);
      case 'union':
        def.options?.forEach((option) => walk(option, owner, depth + 1));
        return;
      case 'intersection':
        walk(def.left, owner, depth + 1);
        walk(def.right, owner, depth + 1);
        return;
      case 'pipe':
        return walk(def.in, owner, depth + 1);
      case 'enum': {
        if (!def.entries || seenEnums.has(def.entries)) return;
        seenEnums.add(def.entries);
        for (const value of Object.values(def.entries)) {
          const id = `${owner}=${value}`;
          members.set(id, { id, kind: 'enum', name: value });
        }
        return;
      }
      case 'object': {
        const shape = typeof def.shape === 'function' ? def.shape() : def.shape;
        if (!shape || seenShapes.has(shape)) return;
        seenShapes.add(shape);
        for (const [key, child] of Object.entries(shape)) {
          if (NON_ENGINE_FIELDS.has(key)) continue;
          const id = owner ? `${owner}.${key}` : key;
          members.set(id, { id, kind: 'field', name: key });
          if (RECURSIVE_FIELDS.has(key) && owner.split('.').includes(key)) continue;
          walk(child, id, depth + 1);
        }
        return;
      }
      default:
        return;
    }
  };

  walk(root, '', 0);
  return [...members.values()];
}

function readTree(dir: string, skip: (file: string) => boolean): string {
  const out: string[] = [];
  const visit = (current: string): void => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (skip(full.split(path.sep).join('/'))) continue;
      if (entry.isDirectory()) visit(full);
      else if (/\.tsx?$/.test(entry.name)) out.push(fs.readFileSync(full, 'utf8'));
    }
  };
  visit(dir);
  return out.join('\n');
}

/** Source text in which a reader of a schema member may live. */
export function readReaderSources(root: string): string {
  const skipModels = (file: string) => file.endsWith('src/engine/models/abilities.ts');
  const skipEditor = (file: string) => file.includes('src/ui/components/editor');
  return (
    readTree(path.join(root, 'src/engine'), skipModels) +
    '\n' +
    readTree(path.join(root, 'src/ui'), skipEditor)
  );
}

/** Source text of the editor and dev tooling, where authoring metadata is read. */
export function readAuthoringSources(root: string): string {
  return [
    readTree(path.join(root, 'src/tools'), () => false),
    readTree(path.join(root, 'src/ui/components/editor'), () => false),
  ].join('\n');
}

export const isAuthoringMember = (member: SchemaMember): boolean =>
  AUTHORING_METADATA_PREFIXES.some((prefix) => member.id.startsWith(prefix));

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** True when the member name is read in `source` (property access, bracket access, destructuring or enum literal). */
export function isMemberRead(member: SchemaMember, source: string): boolean {
  const name = escapeRegExp(member.name);
  const pattern =
    member.kind === 'field'
      ? new RegExp(String.raw`(\.|\?\.|\[['"]|[{,]\s*)${name}\b`)
      : new RegExp(String.raw`['"]${name}['"]`);
  return pattern.test(source);
}

/** Members of the inventory with no reader in `source`. */
export function findUnreadMembers(
  members: SchemaMember[],
  source: string,
  authoringSource: string = source,
): SchemaMember[] {
  return members.filter(
    (member) => !isMemberRead(member, isAuthoringMember(member) ? authoringSource : source),
  );
}

export function formatUnreadMember(member: SchemaMember): string {
  return `Schema member ${member.id}: no reader in src/engine (without models/abilities.ts) or src/ui (without the editor)`;
}
