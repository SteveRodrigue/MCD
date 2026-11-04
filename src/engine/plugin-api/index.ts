/**
 * Pack hook contract: what the engine lets a pack provide beyond JSON data.
 * Types only; it formalizes the extension points that already exist and adds no registry.
 * Official packs bundle hooks at build time. User packs are JSON-only until a sandbox ADR exists.
 */
import type { SpecialAbilityHandler } from '../specials/special-registry';

export { PACK_API_VERSION } from '../../data/packs/pack-manifest';
export type { SpecialAbilityHandler };

export interface PackHooks {
  specialHandlers?: SpecialAbilityHandler[];
}
