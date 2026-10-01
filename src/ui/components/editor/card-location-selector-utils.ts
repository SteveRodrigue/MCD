import type { CardLocationSelector } from '../../../data/supplemental/schema';

export function sanitizeCardLocation(
  loc?: Partial<CardLocationSelector>,
): CardLocationSelector | undefined {
  if (!loc) return undefined;
  const cleaned: Partial<CardLocationSelector> = {};

  if (loc.zone) cleaned.zone = loc.zone;
  if (loc.position) cleaned.position = loc.position;
  if (loc.cardCode && loc.cardCode.trim() !== '') {
    cleaned.cardCode = loc.cardCode.trim();
  }
  if (loc.target) cleaned.target = loc.target;
  if (loc.filter && Object.keys(loc.filter).length > 0) {
    cleaned.filter = loc.filter;
  }

  return Object.keys(cleaned).length > 0 ? (cleaned as CardLocationSelector) : undefined;
}
