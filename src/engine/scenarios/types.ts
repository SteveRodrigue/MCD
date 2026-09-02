import { GameState, DifficultyMode } from '@engine/models';

export interface ScenarioGameSetupOptions {
  scenarioId: string;
  difficulty?: DifficultyMode;
  heroicLevel?: number;
  heroIds?: string[];
  deckOverrides?: Record<string, string[]>;
  modularSetCodes?: string[];
  skipMulligan?: boolean;
}

/**
 * Declarative Scenario Manifest Schema (definition.json).
 * Shared identically between Built-In and Fan-Made Custom Scenarios.
 */
export interface ScenarioDefinition {
  $schema?: string;
  id: string;
  name: string;
  scenarioCardCode: string;
  author?: string;
  version?: string;
  description?: string;
  supportedDifficulties: DifficultyMode[];

  villainSetup: {
    villainName: string;
    stages: Record<DifficultyMode, string[]>;
    healthPerPlayer: Record<string, number>;
  };

  mainSchemeSetup: {
    stages: string[];
    startingThreat: number;
    targetThreatPerPlayer: number;
    escalationThreatPerPlayer: number;
  };

  modularEncounterSets: {
    mandatory: string[];
    defaults: Record<DifficultyMode, string[]>;
    slotCount?: number;
    recommendedModularSets?: string[];
  };
}

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
   * Step 1 of Villain Phase: Place Threat on Main Scheme(s).
   * If omitted, the engine places 1 threat per player on the active main scheme.
   */
  onVillainPhaseStep1?(state: GameState): GameState;

  /**
   * Step 2 of Villain Phase: Villain Activations.
   * If omitted, the engine executes standard activations with the active villain.
   */
  onVillainPhaseStep2?(state: GameState): GameState;

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

  /**
   * Evaluates custom win or loss conditions.
   */
  evaluateWinLossConditions?(state: GameState): {
    winner?: 'HEROES' | 'VILLAIN';
    reason?: string;
  } | null;

  /**
   * Optional custom action handlers for scenario-specific buttons/triggers.
   */
  customActionHandlers?: Record<string, (state: GameState, action: any) => GameState>;
}
