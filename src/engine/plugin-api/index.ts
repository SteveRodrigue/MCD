/**
 * Pack hook contract: what the engine lets a pack provide beyond JSON data.
 * Types only; it formalizes the extension points that already exist and adds no registry.
 * Official packs bundle hooks at build time. User packs are JSON-only until a sandbox ADR exists.
 */
import type { ScenarioHooks } from '../scenarios/types';
import type { SpecialAbilityHandler } from '../specials/special-registry';

export { PACK_API_VERSION } from '../../data/packs/pack-manifest';
export type { ScenarioHooks, SpecialAbilityHandler };

export interface PackHooks {
  /** Code a scenario needs beyond its definition.json, keyed by scenario id. */
  scenarioHooks?: Record<string, ScenarioHooks>;
  specialHandlers?: SpecialAbilityHandler[];
}
