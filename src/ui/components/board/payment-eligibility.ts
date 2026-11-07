import { CardInstance } from '../../../engine/models/state';
import { readCardResources } from '../../../engine/queries/card-inspector';
import type { ResourceCost } from '../../../data/supplemental/schema';

/** No required types (or a required `wild`, which any resource fills) accepts everything. */
const acceptsAnyResource = (required: ResourceCost | undefined) => !required || !!required.wild;

/**
 * A hand card is ineligible for payment when the cost requires specific resource types and the card
 * has no icon that can pay any of them. A Wild icon pays any type unless the cost requires printed
 * icons (RR v1.8 p. 15).
 */
export function isHandCardIneligibleForCost(
  hCard: CardInstance,
  required: ResourceCost | undefined,
  requirePrinted: boolean,
): boolean {
  if (acceptsAnyResource(required)) return false;
  return !(readCardResources(hCard) as string[]).some(
    (r) => r in required! || (!requirePrinted && r === 'wild'),
  );
}

const CONCRETE_TYPES = ['physical', 'energy', 'mental'];

/**
 * A resource generator is ineligible when the cost requires specific types and every concrete type
 * it produces differs from them. Wild or unspecified generators stay eligible unless the cost
 * requires printed icons (RR v1.8 p. 15).
 */
export function isGeneratorIneligibleForCost(
  generator: { resourceType?: string; resources?: string[] },
  required: ResourceCost | undefined,
  requirePrinted: boolean,
): boolean {
  if (acceptsAnyResource(required)) return false;
  const produced =
    generator.resources && generator.resources.length > 0
      ? generator.resources
      : generator.resourceType
        ? [generator.resourceType]
        : [];
  if (requirePrinted) return !produced.some((r) => r in required!);
  return !produced.some((r) => r in required! || r === 'wild' || !CONCRETE_TYPES.includes(r));
}
