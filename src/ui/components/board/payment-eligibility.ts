import { CardInstance } from '../../../engine/models/state';
import { readCardResources } from '../../../engine/queries/card-inspector';

/**
 * Returns how many printed icons on a hand card can pay a typed resource cost.
 * A required type of `wild` (or none) accepts any card. A Wild icon pays any type unless the cost requires printed icons of that exact type
 * (RR v1.8 p. 15). Returns `undefined` when the cost has no required type.
 */
export function countPayingIcons(
  hCard: CardInstance,
  requiredType: string | undefined,
  requirePrinted: boolean,
): number | undefined {
  if (!requiredType || requiredType === 'wild') return undefined;
  const icons = readCardResources(hCard) as string[];
  return icons.filter((r) => r === requiredType || (!requirePrinted && r === 'wild')).length;
}

/**
 * A hand card is ineligible for payment when the cost requires a specific resource type
 * and the card has no icon that can pay it.
 */
export function isHandCardIneligibleForCost(
  hCard: CardInstance,
  requiredType: string | undefined,
  requirePrinted: boolean,
): boolean {
  const count = countPayingIcons(hCard, requiredType, requirePrinted);
  return count !== undefined && count === 0;
}

const CONCRETE_TYPES = ['physical', 'energy', 'mental'];

/**
 * A resource generator is ineligible when the cost requires a specific type and every
 * concrete type it produces differs from it. Wild or unspecified generators stay eligible
 * unless the cost requires printed icons (RR v1.8 p. 15).
 */
export function isGeneratorIneligibleForCost(
  generator: { resourceType?: string; resources?: string[] },
  requiredType: string | undefined,
  requirePrinted: boolean,
): boolean {
  if (!requiredType || requiredType === 'wild') return false;
  const produced =
    generator.resources && generator.resources.length > 0
      ? generator.resources
      : generator.resourceType
        ? [generator.resourceType]
        : [];
  if (requirePrinted) return !produced.includes(requiredType);
  return !produced.some((r) => r === requiredType || r === 'wild' || !CONCRETE_TYPES.includes(r));
}
