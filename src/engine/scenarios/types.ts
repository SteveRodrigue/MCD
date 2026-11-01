import { GameState, DifficultyMode } from '@engine/models';
import type { ScenarioDefinition } from '../../data/packs/scenario-definition';

export interface ScenarioGameSetupOptions {
  scenarioId: string;
  difficulty?: DifficultyMode;
  heroicLevel?: number;
  heroIds?: string[];
  deckOverrides?: Record<string, string[]>;
  modularSetCodes?: string[];
  skipMulligan?: boolean;
}

export type { ScenarioDefinition } from '../../data/packs/scenario-definition';

/**
 * Public Lifecycle Contract for Scenario Plugins.
 * Used identically for built-in and fan-made community scenarios.
 */
export interface ScenarioPlugin {
  definition: ScenarioDefinition;

  // --- LIFECYCLE HOOKS ---

  /**
   * Scenario Setup (Steps 1-15 of Rules Reference v1.8):
   * Sets up villains, main schemes, target threat, and builds the encounter deck.
   */
  onGameSetup(state: GameState, options: ScenarioGameSetupOptions): GameState;

  /**
   * Stage 1A Declarative Setup Hook (Step 10 of Rules Reference v1.8):
   * Places starting side schemes, environments, and attachments into play.
   */
  resolveStage1ASetup?(state: GameState, options: ScenarioGameSetupOptions): GameState;

  /**
   * Invoked when a villain reaches 0 HP.
   * Handles stage transitions (Stage I -> II -> III), HP reset, When Revealed effects,
   * active villain rotation, or declaring 'HEROES' victory.
   */
  onVillainDefeated(
    state: GameState,
    defeatedVillainInstanceId: string,
  ): {
    state: GameState;
    advancedStage?: boolean;
    victory?: boolean;
  };

  /**
   * Invoked when a main scheme reaches its target threat limit.
   * Handles advancing to subsequent main scheme stages or declaring 'VILLAIN' victory.
   */
  onMainSchemeCompleted(
    state: GameState,
    completedSchemeInstanceId: string,
  ): {
    state: GameState;
    advancedStage?: boolean;
    defeat?: boolean;
  };
}
