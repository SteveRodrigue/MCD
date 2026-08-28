import { ScenarioPlugin } from './types';

/**
 * Universal Scenario Registry.
 * Discovers, registers, and resolves both Built-In and Fan-Made Custom Scenario Plugins.
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
      throw new Error(`ScenarioPlugin not found in ScenarioRegistry for identifier: '${scenarioIdOrCode}'`);
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
   * Returns all registered scenario plugins.
   */
  static getAll(): ScenarioPlugin[] {
    const unique = new Set(this.plugins.values());
    return Array.from(unique);
  }

  /**
   * Clears all registered plugins (primarily for unit test isolation).
   */
  static clear(): void {
    this.plugins.clear();
  }
}
