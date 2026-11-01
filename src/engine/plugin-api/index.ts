/**
 * Pack hook contract: what the engine lets a pack provide beyond JSON data.
 * Types only; it formalizes the two extension points that already exist and adds no registry.
 * Official packs bundle hooks at build time. User packs are JSON-only until a sandbox ADR exists.
 */
import type { ScenarioPlugin } from '../scenarios/types';
import type { SpecialAbilityHandler } from '../specials/special-registry';

export { PACK_API_VERSION } from '../../data/packs/pack-manifest';
export type { ScenarioPlugin, SpecialAbilityHandler };

export interface PackHooks {
  scenarioPlugins?: ScenarioPlugin[];
  specialHandlers?: SpecialAbilityHandler[];
}
