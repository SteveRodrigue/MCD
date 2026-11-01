import {
  CardType,
  GameState,
  MainSchemeCard,
  MainSchemeState,
  NormalizedCard,
  VillainCard,
  VillainState,
  getActiveMainScheme,
  getCatalog,
  getActiveVillain,
  getPerPlayerCount,
  getVillainById,
  replaceActiveMainScheme,
  setActiveVillain,
} from '@engine/models';
import { createCardInstance } from '../state/card-instance';
import { appendLog } from '../state/game-log';
import { endGame } from '../state/victory';
import { nextEngineId, shuffleArray } from '../state/rng';
import { kernel } from '../kernel';
import { advanceVillainStage, revealVillainStage } from './advance-villain-stage';
import { villainStageHitPoints } from '../pipeline/stat-calculator';
import type {
  ScenarioDefinition,
  ScenarioGameSetupOptions,
  ScenarioHooks,
  ScenarioPlugin,
} from './types';

/**
 * A scenario driven by its `definition.json` (AUD-20261017-232534 F011-A): villain stages per
 * difficulty, main scheme stages, mandatory and modular encounter sets. The Setup and When
 * Revealed abilities printed on its main scheme cards are supplemental data, resolved here at
 * setup and when the main scheme advances (RR v1.8 Appendix II step 12, main scheme). What cannot
 * be data yet comes from the pack's `ScenarioHooks`.
 */
export class DeclarativeScenarioPlugin implements ScenarioPlugin {
  constructor(
    readonly definition: ScenarioDefinition,
    private readonly hooks?: ScenarioHooks,
  ) {}

  /** The A and B sides of each main scheme stage, in order. */
  private mainSchemeStagePairs(state: GameState): { a?: NormalizedCard; b: MainSchemeCard }[] {
    const pairs = new Map<string, { a?: NormalizedCard; b?: MainSchemeCard }>();
    for (const code of this.definition.mainSchemeSetup.stages) {
      const card = getCatalog(state).getCard(code);
      const stage = (card as MainSchemeCard | undefined)?.stage?.toUpperCase();
      if (card?.type !== CardType.MAIN_SCHEME || !stage) continue;
      const key = stage.slice(0, -1);
      const entry = pairs.get(key) ?? {};
      if (stage.endsWith('A')) entry.a = card;
      else if (stage.endsWith('B')) entry.b = card as MainSchemeCard;
      pairs.set(key, entry);
    }
    return [...pairs.values()].filter(
      (entry): entry is { a?: NormalizedCard; b: MainSchemeCard } => entry.b !== undefined,
    );
  }

  /**
   * Resolves the abilities a main scheme card declares for a timing, through the effect engine a
   * villain's When Revealed uses. A card without such abilities (Rhino's) does nothing.
   */
  private resolveMainSchemeAbilities(
    state: GameState,
    card: NormalizedCard | undefined,
    timing: 'SETUP' | 'WHEN_REVEALED',
  ): void {
    if (!card) return;
    const playerId = state.players[state.firstPlayerIndex ?? 0]?.id ?? state.players[0]?.id ?? '';
    for (const ability of card.enrichment?.abilities ?? []) {
      if (ability.timing === timing || ability.trigger === timing) {
        kernel.executeEffect(state, ability, { playerId, sourceCardId: card.code });
      }
    }
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
    const excludedTypes = new Set<string>(['villain', 'main_scheme']);
    const deckCards = setCodes
      .flatMap((code) => getCatalog(state).getExpandedCardsBySet(code))
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
    const villainCard = getCatalog(state).getCard(startingStageCode) as VillainCard | undefined;
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
    const [firstStage] = this.mainSchemeStagePairs(state);
    const firstScheme = firstStage?.b;
    if (!firstScheme) {
      throw new Error(`Main scheme stage '1B' not found for scenario '${this.definition.id}'.`);
    }
    const mainScheme = this.toMainScheme(
      state,
      firstScheme,
      this.definition.mainSchemeSetup.startingThreat,
    );
    replaceActiveMainScheme(state, mainScheme);

    // 3. Encounter deck, then Appendix II step 12: (a) the Setup abilities of main scheme 1A,
    // (b) 1B's When Revealed abilities, (c) the starting villain stage is revealed
    this.buildEncounterDeck(state, options);
    this.resolveMainSchemeAbilities(state, firstStage.a, 'SETUP');
    this.resolveMainSchemeAbilities(state, firstScheme, 'WHEN_REVEALED');
    // (b') what the pack's script adds at stage 1B (the hook mutates the state in place)
    this.hooks?.resolveStage1BReveal?.(state, options);
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
      onomatopoeia: this.definition.setupOnomatopoeia,
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

    endGame(state, 'HEROES');
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
    const stages = this.mainSchemeStagePairs(state);
    const currentIndex = stages.findIndex((stage) => stage.b.code === current.card.code);
    const next = currentIndex >= 0 ? stages[currentIndex + 1] : undefined;

    // The next main scheme stage, or the players lose with the last one. RR v1.8 main scheme:
    // resolve When Revealed on the new top card's A side, flip it to B with its starting threat,
    // then resolve When Revealed on the B side.
    if (next) {
      this.resolveMainSchemeAbilities(state, next.a, 'WHEN_REVEALED');
      const nextScheme = this.toMainScheme(state, next.b, 0);
      replaceActiveMainScheme(state, nextScheme);
      appendLog(state, {
        category: 'scheme',
        key: 'scenario.mainSchemeAdvance',
        params: {
          stage: nextScheme.stage,
          card: next.b.name,
          targetThreat: nextScheme.targetThreat,
        },
        onomatopoeia: `SCHEME ADVANCES TO ${next.b.name.toUpperCase()}!`,
      });
      this.resolveMainSchemeAbilities(state, next.b, 'WHEN_REVEALED');
      return { state, advancedStage: true };
    }

    endGame(state, 'VILLAIN');
    appendLog(state, {
      category: 'scheme',
      key: 'scenario.defeat',
      params: { card: current.card.name },
      onomatopoeia: `${current.card.name.toUpperCase()} COMPLETED! HEROES DEFEATED!`,
    });
    return { state, defeat: true };
  }
}
