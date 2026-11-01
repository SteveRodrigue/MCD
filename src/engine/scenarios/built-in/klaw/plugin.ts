import { DeclarativeScenarioPlugin } from '../../declarative-plugin';
import type { ScenarioDefinition } from '../../types';
import definitionData from '../../../../../content/packs/core/scenarios/klaw/definition.json';

/**
 * Klaw (Underground Distribution): everything comes from `definition.json` and supplemental data.
 * The Defense Network search (Setup) and the first minion (When Revealed) are abilities of the main
 * scheme cards, and Klaw II's reveal is a villain ability.
 */
export const klawPlugin = new DeclarativeScenarioPlugin(
  definitionData as ScenarioDefinition,
  'UNDERGROUND DISTRIBUTION COMMENCES!',
);
