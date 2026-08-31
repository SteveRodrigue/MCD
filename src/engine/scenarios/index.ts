import { ScenarioRegistry } from './registry';
import { rhinoPlugin } from './built-in/rhino/plugin';
import { klawPlugin } from './built-in/klaw/plugin';
import { ultronPlugin } from './built-in/ultron/plugin';

// Register built-in scenarios
ScenarioRegistry.register(rhinoPlugin);
ScenarioRegistry.register(klawPlugin);
ScenarioRegistry.register(ultronPlugin);

export * from './types';
export * from './registry';
export * from './built-in/rhino/plugin';
export * from './built-in/klaw/plugin';
export * from './built-in/ultron/plugin';
export {
  getScenario,
  listScenarios,
  scenarioCatalog,
  listModularEncounterSets,
  MODULAR_ENCOUNTER_SETS,
} from './catalog';
export type { ModularEncounterSetInfo } from './catalog';
