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
import { shuffleArray, nextEngineId } from '../../../state/rng';
import { ScenarioPlugin, ScenarioDefinition, ScenarioGameSetupOptions } from '../../types';
import {
  advanceVillainStage,
  revealVillainStage,
  villainStageHitPoints,
} from '../../advance-villain-stage';
import definitionData from './definition.json';
import { appendLog } from '../../../state/game-log';

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
      instanceId: `villain_${nextEngineId(state, 'id')}_${startingStageCode}`,
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
      instanceId: `main_scheme_${nextEngineId(state, 'id')}_${mainSchemeCard.code}`,
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

    // Villain and main scheme stages never go into the encounter deck
    const stageCodes = new Set([
      ...Object.values(this.definition.villainSetup.stages).flat(),
      ...this.definition.mainSchemeSetup.stages,
    ]);
    const deckCards = allEncounterCards.filter(
      (c: NormalizedCard) =>
        c.type !== 'villain' && c.type !== 'main_scheme' && !stageCodes.has(c.code),
    );

    // Shuffle and create instances
    const shuffled = shuffleArray(state, deckCards);
    state.encounterDeck = shuffled.map((c) => createCardInstance(c));
    state.encounterDiscard = [];
    state.sideSchemes = [];

    // The starting stage is revealed: its When Revealed (Expert starts on Stage II) comes from supplemental data
    revealVillainStage(state, initialVillain);

    appendLog(state, {
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
    const difficulty = state.difficulty || 'STANDARD';

    // The next stage of this difficulty enters play; the last stage defeated wins the game
    const stages = this.definition.villainSetup.stages[difficulty];
    const stageIndex = stages.indexOf(villain.card.code);
    const nextStageCode = stageIndex >= 0 ? stages[stageIndex + 1] : undefined;
    if (nextStageCode) {
      return advanceVillainStage(state, villain.instanceId!, nextStageCode);
    }

    state.winner = 'HEROES';
    appendLog(state, {
      category: 'combat',
      key: 'scenario.victory',
      params: { mode: difficulty, villain: villain.card.name },
      onomatopoeia: `${villain.card.name.toUpperCase()} DEFEATED! HERO VICTORY!`,
    });
    return { state, victory: true };
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
    appendLog(state, {
      category: 'scheme',
      key: 'scenario.defeat',
      params: { scheme: 'The Break-In!' },
      onomatopoeia: 'RHINO BREACHED THE FACILITY! DEFEAT!',
    });
    return { state, defeat: true };
  }
}

export const rhinoPlugin = new RhinoScenarioPlugin();
