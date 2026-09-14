import type { UniversalCardFilter } from '../../../data/supplemental/schema';

/**
 * Strips empty arrays, blank strings, and undefined keys to strictly conform
 * to UniversalCardFilterSchema.strict().
 */
export function sanitizeCardFilter(
  filter: UniversalCardFilter | undefined,
): UniversalCardFilter | undefined {
  if (!filter || typeof filter !== 'object') return undefined;

  const result: Record<string, any> = {};

  if (Array.isArray(filter.codes) && filter.codes.length > 0) {
    const cleaned = filter.codes.map((s) => s.trim()).filter(Boolean);
    if (cleaned.length > 0) result.codes = cleaned;
  }
  if (Array.isArray(filter.names) && filter.names.length > 0) {
    const cleaned = filter.names.map((s) => s.trim()).filter(Boolean);
    if (cleaned.length > 0) result.names = cleaned;
  }
  if (Array.isArray(filter.types) && filter.types.length > 0) {
    result.types = [...filter.types];
  }
  if (Array.isArray(filter.traits) && filter.traits.length > 0) {
    const cleaned = filter.traits.map((s) => s.trim()).filter(Boolean);
    if (cleaned.length > 0) result.traits = cleaned;
  }
  if (Array.isArray(filter.aspects) && filter.aspects.length > 0) {
    result.aspects = [...filter.aspects];
  }
  if (Array.isArray(filter.sets) && filter.sets.length > 0) {
    const cleaned = filter.sets.map((s) => s.trim()).filter(Boolean);
    if (cleaned.length > 0) result.sets = cleaned;
  }
  if (typeof filter.isUnique === 'boolean') {
    result.isUnique = filter.isUnique;
  }
  if (typeof filter.isIdentitySpecific === 'boolean') {
    result.isIdentitySpecific = filter.isIdentitySpecific;
  }
  if (typeof filter.isExhausted === 'boolean') {
    result.isExhausted = filter.isExhausted;
  }
  if (filter.cost) {
    const costClean: Record<string, number> = {};
    if (typeof filter.cost.min === 'number' && !isNaN(filter.cost.min))
      costClean.min = filter.cost.min;
    if (typeof filter.cost.max === 'number' && !isNaN(filter.cost.max))
      costClean.max = filter.cost.max;
    if (typeof filter.cost.equals === 'number' && !isNaN(filter.cost.equals))
      costClean.equals = filter.cost.equals;
    if (Object.keys(costClean).length > 0) result.cost = costClean;
  }
  if (Array.isArray(filter.resourceIcons) && filter.resourceIcons.length > 0) {
    result.resourceIcons = [...filter.resourceIcons];
  }
  if (filter.hasKeyword) {
    result.hasKeyword = filter.hasKeyword;
  }
  if (Array.isArray(filter.hasStatus) && filter.hasStatus.length > 0) {
    result.hasStatus = [...filter.hasStatus];
  }

  // Boolean combinators (Level 1)
  for (const comb of ['all', 'any', 'none'] as const) {
    if (Array.isArray(filter[comb]) && filter[comb]!.length > 0) {
      const sanitizedBranches = filter[comb]!.map((sub) => sanitizeCardFilter(sub)).filter(
        (sub): sub is UniversalCardFilter => sub !== undefined,
      );
      if (sanitizedBranches.length > 0) {
        result[comb] = sanitizedBranches;
      }
    }
  }

  return Object.keys(result).length > 0 ? (result as UniversalCardFilter) : undefined;
}
