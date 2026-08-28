import { ScenarioRegistry } from './registry';
import { rhinoPlugin } from './built-in/rhino/plugin';

// Register built-in scenarios
ScenarioRegistry.register(rhinoPlugin);

export * from './types';
export * from './registry';
export * from './built-in/rhino/plugin';
export { getScenario, listScenarios, scenarioCatalog } from './catalog';
