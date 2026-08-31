import {
  GameState,
  VillainState,
  MainSchemeState,
  VillainCard,
  MainSchemeCard,
  NormalizedCard,
  CardInstance,
  CardType,
  MinionCard,
} from '@engine/models';
import { cardCatalog } from '../../../../data/importer/card-loader';
import { createCardInstance } from '../../../state/game-setup';
import { ScenarioPlugin, ScenarioDefinition, ScenarioGameSetupOptions } from '../../types';
import definitionData from './definition.json';

export const ultronDefinition: ScenarioDefinition = definitionData as ScenarioDefinition;

/**
 * Creates a standard Ultron Drone minion instance (RR v1.8 / Ultron Drones Environment).
 * Drones have 1 HP, 1 ATK, 1 SCH and represent facedown player/encounter cards.
 */
export function createDroneMinionInstance(sourceCard: CardInstance): CardInstance {
  const droneCardData: MinionCard = {
    code: `drone_${sourceCard.card.code}`,
    name: 'Ultron Drone',
    type: CardType.MINION,
    faction: sourceCard.card.faction,
    packCode: sourceCard.card.packCode,
    position: sourceCard.card.position,
    quantity: 1,
    deckLimit: 1,
    isUnique: false,
    costPerHero: false,
    text: 'Ultron Drone minion (1 HP, 1 ATK, 1 SCH).',
    traits: ['Drone'],
    keywords: [],
    resources: { physical: 0, energy: 0, mental: 0, wild: 0, total: 0 },
    isLandscape: false,
    orientation: 'portrait',
    health: 1,
    attack: 1,
    scheme: 1,
    enrichment: {
      abilities: [],
    },
    raw: sourceCard.card.raw,
  };

  return {
    instanceId: `drone_${sourceCard.instanceId}`,
    card: droneCardData,
    exhausted: false,
    tokens: {
      damage: 0,
      threat: 0,
      counters: 0,
    },
    statusCards: [],
    attachments: [],
  };
}

/**
 * Ultron Scenario Plugin implementation.
 * Encapsulates setup, multi-stage villain transitions (I -> II -> III),
 * Ultron Drones environment card handling, Drone minion spawning,
 * 3-stage main scheme progression (1B -> 2B -> 3B), and victory/defeat evaluation.
 */
export class UltronScenarioPlugin implements ScenarioPlugin {
  definition = ultronDefinition;

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
      throw new Error(`Villain card '${startingStageCode}' not found in catalog for scenario '${this.definition.id}'.`);
    }

    const hpPerPlayer = this.definition.villainSetup.healthPerPlayer[startingStageCode] || 17;
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

    // 2. Setup Main Scheme (The Crimson Cowl 1A/1B)
    const mainSchemeCode = '01137b';
    const mainSchemeCard = cardCatalog.getCard(mainSchemeCode) as MainSchemeCard;
    if (!mainSchemeCard) {
      throw new Error(`Main scheme card '${mainSchemeCode}' not found in catalog.`);
    }

    const targetThreat = this.definition.mainSchemeSetup.targetThreatPerPlayer * numPlayers;
    const initialMainScheme: MainSchemeState = {
      instanceId: `main_scheme_${Date.now()}_${mainSchemeCode}`,
      card: mainSchemeCard,
      threat: this.definition.mainSchemeSetup.startingThreat,
      targetThreat,
      stage: '1B',
    };

    state.mainSchemes = [initialMainScheme];
    state.activeMainSchemeIndex = 0;
    state.mainScheme = initialMainScheme;

    // 3. Build Encounter Deck based on Difficulty
    const modularSetCodes = options.modularSetCodes || this.definition.modularEncounterSets.defaults[difficulty];
    const allEncounterCards: NormalizedCard[] = [];

    // Add scenario cards (Ultron set)
    allEncounterCards.push(...cardCatalog.getCardsBySet('ultron'));

    // Add Standard set
    allEncounterCards.push(...cardCatalog.getCardsBySet('standard'));

    // Add Expert set if difficulty is EXPERT
    if (difficulty === 'EXPERT') {
      allEncounterCards.push(...cardCatalog.getCardsBySet('expert'));
    }

    // Add modular sets
    for (const setCode of modularSetCodes) {
      if (setCode !== 'standard' && setCode !== 'expert') {
        allEncounterCards.push(...cardCatalog.getCardsBySet(setCode));
      }
    }

    // Filter out villain cards, main schemes, and environment cards from encounter deck
    const deckCards = allEncounterCards.filter(
      (c: NormalizedCard) =>
        c.type !== 'villain' &&
        c.type !== 'main_scheme' &&
        c.type !== 'environment' &&
        c.code !== '01134' &&
        c.code !== '01135' &&
        c.code !== '01136' &&
        c.code !== '01137a' &&
        c.code !== '01137b' &&
        c.code !== '01138a' &&
        c.code !== '01138b' &&
        c.code !== '01139a' &&
        c.code !== '01139b' &&
        c.code !== '01140', // Ultron Drones environment
    );

    // Shuffle and create instances
    const shuffled = [...deckCards].sort(() => Math.random() - 0.5);
    state.encounterDeck = shuffled.map((c) => createCardInstance(c));
    state.encounterDiscard = [];
    state.sideSchemes = [];
    state.environments = [];

    // 4. Resolve Stage 1A Declarative Setup Hook
    this.resolveStage1ASetup(state, options);

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
      onomatopoeia: 'ULTRON ONLINE! DRONES INITIALIZED!',
    });

    return state;
  }

  resolveStage1ASetup(state: GameState, _options?: ScenarioGameSetupOptions): GameState {
    // 1A Setup: Put Ultron Drones (01140) environment into play
    const ultronDronesCard = cardCatalog.getCard('01140');
    if (ultronDronesCard) {
      const envInstance = createCardInstance(ultronDronesCard);
      state.environments.push(envInstance);
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        category: 'phase',
        key: 'scenario.setup.environment',
        params: { environment: ultronDronesCard.name },
        onomatopoeia: 'ULTRON DRONES ENVIRONMENT ONLINE!',
      });
    }

    // 1B When Revealed: Each player puts the top card of their deck into play facedown engaged as a Drone minion
    for (const player of state.players) {
      if (player.deck.length > 0) {
        const topDeckCard = player.deck.shift()!;
        const droneMinion = createDroneMinionInstance(topDeckCard);
        player.engagedMinions.push(droneMinion);

        state.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          category: 'combat',
          key: 'scenario.setup.drone',
          params: { player: player.name },
          onomatopoeia: 'DRONE DEPLOYED!',
        });
      }
    }

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
    const villain = state.villains.find((v) => v.instanceId === defeatedVillainInstanceId) || state.villain;
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
        onomatopoeia: 'ULTRON DEFEATED! HERO VICTORY!',
      });
      return { state, victory: true };
    }

    // Standard Mode: Stage I -> Stage II, Stage II -> Victory
    if (difficulty === 'STANDARD') {
      if (currentCode === '01134') {
        return this.advanceToStage(state, '01135', numPlayers * 22);
      } else {
        state.winner = 'HEROES';
        state.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          category: 'combat',
          key: 'scenario.victory',
          params: { mode: 'STANDARD', villain: villain.card.name },
          onomatopoeia: 'ULTRON STAGE II DEFEATED! HERO VICTORY!',
        });
        return { state, victory: true };
      }
    }

    // Expert Mode: Stage II -> Stage III, Stage III -> Victory
    if (difficulty === 'EXPERT') {
      if (currentCode === '01135') {
        return this.advanceToStage(state, '01136', numPlayers * 27);
      } else {
        state.winner = 'HEROES';
        state.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          category: 'combat',
          key: 'scenario.victory',
          params: { mode: 'EXPERT', villain: villain.card.name },
          onomatopoeia: 'ULTRON STAGE III DEFEATED! HERO VICTORY!',
        });
        return { state, victory: true };
      }
    }

    return { state };
  }

  private advanceToStage(
    state: GameState,
    nextStageCode: string,
    nextStageMaxHealth: number,
  ): { state: GameState; advancedStage: boolean } {
    const nextCard = cardCatalog.getCard(nextStageCode) as VillainCard;
    if (!nextCard) {
      throw new Error(`Villain stage card '${nextStageCode}' not found in catalog.`);
    }

    const newVillain: VillainState = {
      instanceId: `villain_${Date.now()}_${nextStageCode}`,
      card: nextCard,
      health: nextStageMaxHealth,
      maxHealth: nextStageMaxHealth,
      exhausted: false,
      statusCards: [],
      attachments: [],
    };

    state.villains = [newVillain];
    state.activeVillainIndex = 0;
    state.villain = newVillain;

    state.log.push({
      id: `log_${Date.now()}`,
      timestamp: Date.now(),
      category: 'phase',
      key: 'scenario.stageAdvance',
      params: {
        stage: nextCard.stage,
        villain: nextCard.name,
        health: nextStageMaxHealth,
      },
      onomatopoeia: `ULTRON ADVANCES TO STAGE ${nextCard.stage}!`,
    });

    return { state, advancedStage: true };
  }

  onMainSchemeCompleted(
    state: GameState,
    _completedSchemeInstanceId: string,
  ): {
    state: GameState;
    advancedStage?: boolean;
    defeat?: boolean;
  } {
    const numPlayers = state.players.length || 1;
    const currentStage = state.mainScheme.stage;

    if (currentStage === '1B') {
      // Advance to Stage 2B (Assault on NORAD 01138b)
      const nextSchemeCard = cardCatalog.getCard('01138b') as MainSchemeCard;
      const targetThreat = 10 * numPlayers;

      const nextMainScheme: MainSchemeState = {
        instanceId: `main_scheme_${Date.now()}_01138b`,
        card: nextSchemeCard,
        threat: 0,
        targetThreat,
        stage: '2B',
      };

      state.mainSchemes = [nextMainScheme];
      state.activeMainSchemeIndex = 0;
      state.mainScheme = nextMainScheme;

      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        category: 'scheme',
        key: 'scenario.mainSchemeAdvance',
        params: { stage: '2B', scheme: 'Assault on NORAD', targetThreat },
        onomatopoeia: 'SCHEME ADVANCES TO ASSAULT ON NORAD!',
      });

      return { state, advancedStage: true };
    }

    if (currentStage === '2B') {
      // Advance to Stage 3B (Countdown to Oblivion 01139b)
      const nextSchemeCard = cardCatalog.getCard('01139b') as MainSchemeCard;
      const targetThreat = 5 * numPlayers;

      const nextMainScheme: MainSchemeState = {
        instanceId: `main_scheme_${Date.now()}_01139b`,
        card: nextSchemeCard,
        threat: 0,
        targetThreat,
        stage: '3B',
      };

      state.mainSchemes = [nextMainScheme];
      state.activeMainSchemeIndex = 0;
      state.mainScheme = nextMainScheme;

      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        category: 'scheme',
        key: 'scenario.mainSchemeAdvance',
        params: { stage: '3B', scheme: 'Countdown to Oblivion', targetThreat },
        onomatopoeia: 'SCHEME ADVANCES TO COUNTDOWN TO OBLIVION!',
      });

      return { state, advancedStage: true };
    }

    // Stage 3B completed -> Defeat
    state.winner = 'VILLAIN';
    state.log.push({
      id: `log_${Date.now()}`,
      timestamp: Date.now(),
      category: 'scheme',
      key: 'scenario.defeat',
      params: { scheme: 'Countdown to Oblivion' },
      onomatopoeia: 'COUNTDOWN REACHED ZERO! HEROES DEFEATED!',
    });

    return { state, defeat: true };
  }
}

export const ultronPlugin = new UltronScenarioPlugin();
