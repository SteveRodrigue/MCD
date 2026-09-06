import {
  GameState,
  VillainState,
  MainSchemeState,
  SideSchemeCard,
  StatusCard,
  VillainCard,
  NormalizedCard,
} from '@engine/models';
import { cardCatalog } from '../../../../data/importer/card-loader';
import { createCardInstance } from '../../../state/card-instance';
import { executeEffect } from '@engine/effects';
import { ScenarioPlugin, ScenarioDefinition, ScenarioGameSetupOptions } from '../../types';
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

    const hpPerPlayer = this.definition.villainSetup.healthPerPlayer[startingStageCode] || 14;
    const maxHealth = hpPerPlayer * numPlayers;

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
    state.activeVillainIndex = 0;
    state.villain = initialVillain;

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

    state.mainSchemes = [initialMainScheme];
    state.activeMainSchemeIndex = 0;
    state.mainScheme = initialMainScheme;

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

    // If starting on Expert (Stage II), resolve Stage II When Revealed search immediately
    if (difficulty === 'EXPERT' && startingStageCode === '01095') {
      this.resolveStageIIWhenRevealed(state);
    }

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
    const villain =
      state.villains.find((v) => v.instanceId === defeatedVillainInstanceId) || state.villain;
    const currentCode = villain.card.code;
    const difficulty = state.difficulty || 'STANDARD';
    const numPlayers = state.players.length || 1;

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
        return this.advanceToStage(state, '01095', numPlayers * 15, () => {
          this.resolveStageIIWhenRevealed(state);
        });
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
        return this.advanceToStage(state, '01096', numPlayers * 16, () => {
          this.resolveStageIIIWhenRevealed(state);
        });
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
    // Hero survival check
    const allHeroesDefeated = state.players.every((p) => p.health <= 0);
    if (allHeroesDefeated && state.players.length > 0) {
      return { winner: 'VILLAIN', reason: 'All heroes have been defeated.' };
    }
    return null;
  }

  // --- PRIVATE STAGE ADVANCEMENT & WHEN REVEALED HELPERS ---

  private advanceToStage(
    state: GameState,
    nextStageCode: string,
    nextHealth: number,
    onRevealedCallback?: () => void,
  ): { state: GameState; advancedStage: boolean } {
    const nextCard = cardCatalog.getCard(nextStageCode) as VillainCard;
    if (!nextCard) {
      throw new Error(`Next villain stage card '${nextStageCode}' not found in catalog.`);
    }

    const updatedVillain: VillainState = {
      instanceId: `villain_${Date.now()}_${nextStageCode}`,
      card: nextCard,
      health: nextHealth,
      maxHealth: nextHealth,
      exhausted: false,
      statusCards: [],
      attachments: [], // Clear attachments on stage transition
    };

    state.villains = [updatedVillain];
    state.activeVillainIndex = 0;
    state.villain = updatedVillain;

    state.log.push({
      id: `log_${Date.now()}`,
      timestamp: Date.now(),
      category: 'combat',
      key: 'villain.stageAdvance',
      params: { villain: nextCard.name, stage: nextCard.stage, health: nextHealth },
      onomatopoeia: `RHINO ADVANCES TO STAGE ${nextCard.stage}!`,
    });

    if (onRevealedCallback) {
      onRevealedCallback();
    }

    return { state, advancedStage: true };
  }

  private resolveStageIIWhenRevealed(state: GameState): void {
    // Search encounter deck and discard pile for Breakin' & Takin' (01107) and reveal it. Shuffle encounter deck.
    let foundIndex = state.encounterDeck.findIndex((c) => c.card.code === '01107');
    let foundInstance =
      foundIndex !== -1 ? state.encounterDeck.splice(foundIndex, 1)[0] : undefined;

    if (!foundInstance) {
      foundIndex = state.encounterDiscard.findIndex((c) => c.card.code === '01107');
      if (foundIndex !== -1) {
        foundInstance = state.encounterDiscard.splice(foundIndex, 1)[0];
      }
    }

    if (foundInstance) {
      const sideSchemeCard = foundInstance.card as SideSchemeCard;
      const baseThreat =
        sideSchemeCard.baseThreat * (sideSchemeCard.baseThreatFixed ? 1 : state.players.length);
      state.sideSchemes.push({
        instanceId: foundInstance.instanceId,
        card: sideSchemeCard,
        threat: baseThreat,
      });

      // Execute Breakin' & Takin' when revealed threat scaling
      const abilities = sideSchemeCard.enrichment?.abilities || [];
      for (const ab of abilities) {
        if (ab.trigger === 'WHEN_REVEALED') {
          executeEffect(state, ab, {
            playerId: state.players[0]?.id || 'p1',
            sourceCardInstance: foundInstance,
          });
        }
      }

      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        category: 'scheme',
        key: 'scenario.sideSchemeRevealed',
        params: { sideScheme: "Breakin' & Takin'" },
        onomatopoeia: "BREAKIN' & TAKIN' REVEALED!",
      });
    }

    // Shuffle Encounter Deck
    state.encounterDeck.sort(() => Math.random() - 0.5);
  }

  private resolveStageIIIWhenRevealed(state: GameState): void {
    // Rhino Stage III: Stun each hero. Rhino gains Tough status.
    const activeVillain = state.villains[0] || state.villain;
    if (!activeVillain.statusCards.includes(StatusCard.TOUGH)) {
      activeVillain.statusCards.push(StatusCard.TOUGH);
    }

    for (const player of state.players) {
      if (!player.statusCards.includes(StatusCard.STUNNED)) {
        player.statusCards.push(StatusCard.STUNNED);
      }
    }

    state.log.push({
      id: `log_${Date.now()}`,
      timestamp: Date.now(),
      category: 'status',
      key: 'scenario.stageIIIRevealed',
      params: { villain: 'Rhino', effect: 'Tough + Stun All Heroes' },
      onomatopoeia: 'RHINO GAINS TOUGH & STUNS ALL HEROES!',
    });
  }
}

export const rhinoPlugin = new RhinoScenarioPlugin();
