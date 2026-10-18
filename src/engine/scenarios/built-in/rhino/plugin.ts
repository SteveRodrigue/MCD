import { DeclarativeScenarioPlugin } from '../../declarative-plugin';
import type { ScenarioDefinition } from '../../types';
import definitionData from './definition.json';

/**
 * Rhino (The Break-In!): everything comes from `definition.json` and supplemental data; Rhino II
 * and III reveal effects (Breakin' & Takin', stun all heroes) are their WHEN_REVEALED abilities.
 */
export const rhinoPlugin = new DeclarativeScenarioPlugin(
  definitionData as ScenarioDefinition,
  'THE BREAK-IN BEGINS!',
);
