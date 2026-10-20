import {
  CardType,
  GameState,
  MainSchemeCard,
  MainSchemeState,
  NormalizedCard,
  VillainCard,
  VillainState,
  getActiveMainScheme,
  getActiveVillain,
  getPerPlayerCount,
  getVillainById,
  replaceActiveMainScheme,
  setActiveVillain,
} from '@engine/models';
import { cardCatalog } from '../../data/importer/card-loader';
import { createCardInstance } from '../state/card-instance';
import { appendLog } from '../state/game-log';
import { nextEngineId, shuffleArray } from '../state/rng';
import { advanceVillainStage, revealVillainStage } from './advance-villain-stage';
import { villainStageHitPoints } from '../pipeline/stat-calculator';
import type { ScenarioDefinition, ScenarioGameSetupOptions, ScenarioPlugin } from './types';

/**
 * A scenario driven by its `definition.json` (AUD-20261017-232534 F011-A): villain stages per
 * difficulty, main scheme stages, mandatory and modular encounter sets. A scenario subclass adds
 * only what its cards do that is not supplemental data yet (stage 1A setup, stage reveals).
 */
export class DeclarativeScenarioPlugin implements ScenarioPlugin {
  /** Card types kept out of the encounter deck besides villains and main schemes. */
  protected excludedEncounterTypes: string[] = [];

  constructor(
    readonly definition: ScenarioDefinition,
    private readonly setupOnomatopoeia: string,
  ) {}

  /** Stage 1A setup: side schemes, environments or minions the scenario puts into play. */
  resolveStage1ASetup(state: GameState, _options?: ScenarioGameSetupOptions): GameState {
    return state;
  }

  /** The B sides of the main scheme stages, in order. */
  private mainSchemeStages(): MainSchemeCard[] {
    return this.definition.mainSchemeSetup.stages
      .map((code) => cardCatalog.getCard(code))
      .filter(
        (card): card is MainSchemeCard =>
          card?.type === CardType.MAIN_SCHEME &&
          Boolean((card as MainSchemeCard).stage?.toUpperCase().endsWith('B')),
      );
  }

  private toMainScheme(
    state: GameState,
    card: MainSchemeCard,
    startingThreat: number,
  ): MainSchemeState {
    const players = getPerPlayerCount(state) || 1;
    return {
      instanceId: `main_scheme_${nextEngineId(state, 'id')}_${card.code}`,
      card,
      threat: card.baseThreat || startingThreat,
      targetThreat:
        (card.targetThreat || this.definition.mainSchemeSetup.targetThreatPerPlayer) * players,
      stage: card.stage?.toUpperCase() || '1B',
    };
  }

  private buildEncounterDeck(state: GameState, options: ScenarioGameSetupOptions): void {
    const difficulty = state.difficulty || 'STANDARD';
    const sets = this.definition.modularEncounterSets;
    const modularSetCodes = (options.modularSetCodes || sets.defaults[difficulty]).filter(
      (code) => code !== 'standard' && code !== 'expert',
    );
    const setCodes = [
      ...sets.mandatory,
      'standard',
      ...(difficulty === 'EXPERT' ? ['expert'] : []),
      ...modularSetCodes,
    ];

    // Villain and main scheme stages never go into the encounter deck
    const stageCodes = new Set([
      ...Object.values(this.definition.villainSetup.stages).flat(),
      ...this.definition.mainSchemeSetup.stages,
    ]);
    const excludedTypes = new Set<string>([
      'villain',
      'main_scheme',
      ...this.excludedEncounterTypes,
    ]);
    const deckCards = setCodes
      .flatMap((code) => cardCatalog.getExpandedCardsBySet(code))
      .filter((c: NormalizedCard) => !excludedTypes.has(c.type) && !stageCodes.has(c.code));

    state.encounterDeck = shuffleArray(state, deckCards).map((c) => createCardInstance(c));
    state.encounterDiscard = [];
    state.sideSchemes = [];
    state.environments = [];
  }

  onGameSetup(state: GameState, options: ScenarioGameSetupOptions): GameState {
    const difficulty = options.difficulty || 'STANDARD';
    state.difficulty = difficulty;
    state.heroicLevel = options.heroicLevel || 0;
    state.scenarioId = this.definition.id;
    state.scenarioCardCode = this.definition.scenarioCardCode;

    // 1. The first villain stage of the difficulty
    const startingStageCode = this.definition.villainSetup.stages[difficulty][0];
    const villainCard = cardCatalog.getCard(startingStageCode) as VillainCard | undefined;
    if (!villainCard) {
      throw new Error(
        `Villain card '${startingStageCode}' not found in catalog for scenario '${this.definition.id}'.`,
      );
    }
    const maxHealth = villainStageHitPoints(villainCard, getPerPlayerCount(state));
    const villain: VillainState = {
      instanceId: `villain_${nextEngineId(state, 'id')}_${startingStageCode}`,
      card: villainCard,
      health: maxHealth,
      maxHealth,
      exhausted: false,
      statusCards: [],
      attachments: [],
    };
    state.villains = [villain];
    setActiveVillain(state, villain.instanceId!);

    // 2. The first main scheme stage (1B)
    const [firstScheme] = this.mainSchemeStages();
    if (!firstScheme) {
      throw new Error(`Main scheme stage '1B' not found for scenario '${this.definition.id}'.`);
    }
    const mainScheme = this.toMainScheme(
      state,
      firstScheme,
      this.definition.mainSchemeSetup.startingThreat,
    );
    replaceActiveMainScheme(state, mainScheme);

    // 3. Encounter deck, 4. stage 1A setup, 5. the starting villain stage is revealed
    this.buildEncounterDeck(state, options);
    this.resolveStage1ASetup(state, options);
    revealVillainStage(state, villain);

    appendLog(state, {
      category: 'phase',
      key: 'scenario.setup',
      params: {
        scenario: this.definition.name,
        difficulty,
        actor: villainCard.name,
        health: villain.health,
        threatTarget: mainScheme.targetThreat,
      },
      onomatopoeia: this.setupOnomatopoeia,
    });
    return state;
  }

  onVillainDefeated(
    state: GameState,
    defeatedVillainInstanceId: string,
  ): { state: GameState; advancedStage?: boolean; victory?: boolean } {
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
      params: { mode: difficulty, actor: villain.card.name },
      onomatopoeia: `${villain.card.name.toUpperCase()} DEFEATED! HERO VICTORY!`,
    });
    return { state, victory: true };
  }

  onMainSchemeCompleted(
    state: GameState,
    _completedSchemeInstanceId: string,
  ): { state: GameState; advancedStage?: boolean; defeat?: boolean } {
    const current = getActiveMainScheme(state);
    const stages = this.mainSchemeStages();
    const next = stages[stages.findIndex((card) => card.code === current.card.code) + 1];

    // The next main scheme stage, or the players lose with the last one
    if (next && stages.some((card) => card.code === current.card.code)) {
      const nextScheme = this.toMainScheme(state, next, 0);
      replaceActiveMainScheme(state, nextScheme);
      appendLog(state, {
        category: 'scheme',
        key: 'scenario.mainSchemeAdvance',
        params: {
          stage: nextScheme.stage,
          card: next.name,
          targetThreat: nextScheme.targetThreat,
        },
        onomatopoeia: `SCHEME ADVANCES TO ${next.name.toUpperCase()}!`,
      });
      return { state, advancedStage: true };
    }

    state.winner = 'VILLAIN';
    appendLog(state, {
      category: 'scheme',
      key: 'scenario.defeat',
      params: { card: current.card.name },
      onomatopoeia: `${current.card.name.toUpperCase()} COMPLETED! HEROES DEFEATED!`,
    });
    return { state, defeat: true };
  }
}
