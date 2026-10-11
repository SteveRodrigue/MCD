import {
  GameState,
  VillainState,
  MainSchemeState,
  VillainCard,
  NormalizedCard,
  getActiveVillain,
  getVillainById,
  setActiveVillain,
  replaceActiveMainScheme,
} from '@engine/models';
import { cardCatalog } from '../../../../data/importer/card-loader';
import { createCardInstance } from '../../../state/card-instance';
import { ScenarioPlugin, ScenarioDefinition, ScenarioGameSetupOptions } from '../../types';
import {
  advanceVillainStage,
  revealVillainStage,
  villainStageHitPoints,
} from '../../advance-villain-stage';
import definitionData from './definition.json';

export const rhinoDefinition: ScenarioDefinition = definitionData as ScenarioDefinition;

/**
 * Rhino Scenario Plugin implementation.
 * Encapsulates setup, difficulty-based stage progression (I -> II -> III),
 * When Revealed triggers (Breakin' & Takin' search & hero stuns), and victory/defeat evaluation.
 */
export class RhinoScenarioPlugin implements ScenarioPlugin {
  definition = rhinoDefinition;

  onGameSetup(state: GameState, options: ScenarioGameSetupOptions): GameState {
    const difficulty = options.difficulty || 'STANDARD';
    state.difficulty = difficulty;
    state.heroicLevel = options.heroicLevel || 0;
    state.scenarioId = this.definition.id;
    state.scenarioCardCode = this.definition.scenarioCardCode;

    const numPlayers = state.players.length || 1;

    // 1. Determine Starting Villain Stage based on Difficulty
    const startingStageCode = this.definition.villainSetup.stages[difficulty][0];
    const villainCard = cardCatalog.getCard(startingStageCode) as VillainCard;
    if (!villainCard) {
      throw new Error(
        `Villain card '${startingStageCode}' not found in catalog for scenario '${this.definition.id}'.`,
      );
    }

    const maxHealth = villainStageHitPoints(villainCard, numPlayers);

    const initialVillain: VillainState = {
      instanceId: `villain_${Date.now()}_${startingStageCode}`,
      card: villainCard,
      health: maxHealth,
      maxHealth,
      exhausted: false,
      statusCards: [],
      attachments: [],
    };

    state.villains = [initialVillain];
    setActiveVillain(state, initialVillain.instanceId!);

    // 2. Setup Main Scheme (The Break-In! Stage 1B)
    const mainSchemeCard = cardCatalog.getMainSchemeByStage('rhino', '1B');
    if (!mainSchemeCard) {
      throw new Error(`Main scheme stage '1B' not found in catalog for scenario 'rhino'.`);
    }

    const targetThreat =
      (mainSchemeCard.targetThreat || this.definition.mainSchemeSetup.targetThreatPerPlayer) *
      numPlayers;
    const initialMainScheme: MainSchemeState = {
      instanceId: `main_scheme_${Date.now()}_${mainSchemeCard.code}`,
      card: mainSchemeCard,
      threat: mainSchemeCard.baseThreat || this.definition.mainSchemeSetup.startingThreat,
      targetThreat,
      stage: '1B',
    };

    replaceActiveMainScheme(state, initialMainScheme);

    // 3. Build Encounter Deck based on Difficulty
    const modularSetCodes =
      options.modularSetCodes || this.definition.modularEncounterSets.defaults[difficulty];
    const allEncounterCards: NormalizedCard[] = [];

    // Add scenario cards (Rhino set)
    allEncounterCards.push(...cardCatalog.getExpandedCardsBySet('rhino'));

    // Add Standard set
    allEncounterCards.push(...cardCatalog.getExpandedCardsBySet('standard'));

    // Add Expert set if difficulty is EXPERT
    if (difficulty === 'EXPERT') {
      allEncounterCards.push(...cardCatalog.getExpandedCardsBySet('expert'));
    }

    // Add modular sets
    for (const setCode of modularSetCodes) {
      if (setCode !== 'standard' && setCode !== 'expert') {
        allEncounterCards.push(...cardCatalog.getExpandedCardsBySet(setCode));
      }
    }

    // Filter out villain cards and main scheme cards from encounter deck
    const deckCards = allEncounterCards.filter(
      (c: NormalizedCard) =>
        c.type !== 'villain' &&
        c.type !== 'main_scheme' &&
        c.code !== '01094' &&
        c.code !== '01095' &&
        c.code !== '01096' &&
        c.code !== '01097a' &&
        c.code !== '01097b',
    );

    // Shuffle and create instances
    const shuffled = [...deckCards].sort(() => Math.random() - 0.5);
    state.encounterDeck = shuffled.map((c) => createCardInstance(c));
    state.encounterDiscard = [];
    state.sideSchemes = [];

    // The starting stage is revealed: its When Revealed (Expert starts on Stage II) comes from supplemental data
    revealVillainStage(state, initialVillain);

    state.log.push({
      id: `log_${Date.now()}`,
      timestamp: Date.now(),
      category: 'phase',
      key: 'scenario.setup',
      params: {
        scenario: this.definition.name,
        difficulty,
        villain: villainCard.name,
        health: maxHealth,
        threatTarget: targetThreat,
      },
      onomatopoeia: 'THE BREAK-IN BEGINS!',
    });

    return state;
  }

  onVillainDefeated(
    state: GameState,
    defeatedVillainInstanceId: string,
  ): {
    state: GameState;
    advancedStage?: boolean;
    victory?: boolean;
  } {
    const villain = getVillainById(state, defeatedVillainInstanceId) || getActiveVillain(state);
    const currentCode = villain.card.code;
    const difficulty = state.difficulty || 'STANDARD';

    // Skirmish Mode: Stage I defeated -> Immediate Victory
    if (difficulty === 'SKIRMISH') {
      state.winner = 'HEROES';
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        category: 'combat',
        key: 'scenario.victory',
        params: { mode: 'SKIRMISH', villain: villain.card.name },
        onomatopoeia: 'RHINO DEFEATED! HERO VICTORY!',
      });
      return { state, victory: true };
    }

    // Standard Mode: Stage I -> Stage II, Stage II -> Victory
    if (difficulty === 'STANDARD') {
      if (currentCode === '01094') {
        return advanceVillainStage(state, villain.instanceId!, '01095');
      } else {
        // Stage II defeated -> Victory
        state.winner = 'HEROES';
        state.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          category: 'combat',
          key: 'scenario.victory',
          params: { mode: 'STANDARD', villain: villain.card.name },
          onomatopoeia: 'RHINO STAGE II DEFEATED! HERO VICTORY!',
        });
        return { state, victory: true };
      }
    }

    // Expert Mode: Stage II -> Stage III, Stage III -> Victory
    if (difficulty === 'EXPERT') {
      if (currentCode === '01095') {
        return advanceVillainStage(state, villain.instanceId!, '01096');
      } else {
        // Stage III defeated -> Victory
        state.winner = 'HEROES';
        state.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          category: 'combat',
          key: 'scenario.victory',
          params: { mode: 'EXPERT', villain: villain.card.name },
          onomatopoeia: 'RHINO STAGE III DEFEATED! HERO VICTORY!',
        });
        return { state, victory: true };
      }
    }

    return { state };
  }

  onMainSchemeCompleted(
    state: GameState,
    _completedSchemeInstanceId: string,
  ): {
    state: GameState;
    advancedStage?: boolean;
    defeat?: boolean;
  } {
    // The Break-In! 1B: If completed, the players lose the game.
    state.winner = 'VILLAIN';
    state.log.push({
      id: `log_${Date.now()}`,
      timestamp: Date.now(),
      category: 'scheme',
      key: 'scenario.defeat',
      params: { scheme: 'The Break-In!' },
      onomatopoeia: 'RHINO BREACHED THE FACILITY! DEFEAT!',
    });
    return { state, defeat: true };
  }

  evaluateWinLossConditions(state: GameState): {
    winner?: 'HEROES' | 'VILLAIN';
    reason?: string;
  } | null {
    if (state.winner) {
      return { winner: state.winner };
    }
    // Main Scheme threat check
    for (const ms of state.mainSchemes) {
      if (ms.threat >= ms.targetThreat) {
        return {
          winner: 'VILLAIN',
          reason: `Main Scheme '${ms.card.name}' reached target threat (${ms.targetThreat}).`,
        };
      }
    }
    // Hero survival check: a defeated hero leaves state.players (#246), the group loses with the last one
    if (state.players.length === 0) {
      return { winner: 'VILLAIN', reason: 'All heroes have been defeated.' };
    }
    return null;
  }
}

export const rhinoPlugin = new RhinoScenarioPlugin();
