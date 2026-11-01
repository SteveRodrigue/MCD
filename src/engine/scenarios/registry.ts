import { ScenarioPlugin } from './types';

/**
 * Universal Scenario Registry.
 * Holds the scenarios of the loaded packs (filled by `applyContent`, emptied by `resetContent`).
 */
export class ScenarioRegistry {
  private static plugins: Map<string, ScenarioPlugin> = new Map();

  /**
   * Registers a scenario plugin by its unique ID and its scenario card code.
   */
  static register(plugin: ScenarioPlugin): void {
    this.plugins.set(plugin.definition.id.toLowerCase(), plugin);
    if (plugin.definition.scenarioCardCode) {
      this.plugins.set(plugin.definition.scenarioCardCode, plugin);
    }
  }

  /**
   * Resolves a scenario plugin by ID or card code.
   */
  static get(scenarioIdOrCode: string): ScenarioPlugin {
    const key = scenarioIdOrCode.toLowerCase();
    const plugin = this.plugins.get(key);
    if (!plugin) {
      throw new Error(
        `ScenarioPlugin not found in ScenarioRegistry for identifier: '${scenarioIdOrCode}'`,
      );
    }
    return plugin;
  }

  /**
   * Returns true if a plugin is registered for the given ID or card code.
   */
  static has(scenarioIdOrCode: string): boolean {
    return this.plugins.has(scenarioIdOrCode.toLowerCase());
  }

  /**
   * Returns all registered scenario plugins in ascending scenario card code order.
   */
  static getAll(): ScenarioPlugin[] {
    const unique = new Set(this.plugins.values());
    return Array.from(unique).sort((a, b) =>
      a.definition.scenarioCardCode.localeCompare(b.definition.scenarioCardCode),
    );
  }

  /**
   * Clears all registered plugins (primarily for unit test isolation).
   */
  static clear(): void {
    this.plugins.clear();
  }
}

/**
 * The scenario used when a caller names none: the registered scenario with the lowest scenario
 * card code. Throws when no pack provides a scenario.
 */
export function defaultScenarioId(): string {
  const [first] = ScenarioRegistry.getAll();
  if (!first) {
    throw new Error('No scenario is available: enable a content pack that provides one.');
  }
  return first.definition.id;
}
