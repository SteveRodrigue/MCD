import {
  CardType,
  GameState,
  Keyword,
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
  hasKeyword,
  replaceActiveMainScheme,
  setActiveVillain,
} from '@engine/models';
import { createCardInstance } from '../state/card-instance';
import { putEnvironmentIntoPlay } from '../state/environment';
import { placeSideScheme } from '../state/side-scheme';
import { appendLog } from '../state/game-log';
import { endGame } from '../state/victory';
import { nextEngineId, shuffleArray } from '../state/rng';
import { kernel } from '../kernel';
import { advanceVillainStage, revealVillainStage } from './advance-villain-stage';
import { villainStageHitPoints } from '../pipeline/stat-calculator';
import { listEncounterDeckCards } from './encounter-sets';
import { getVillainStages, resolveScenarioSetup } from './resolve-scenario-setup';
import type { ScenarioDefinition, ScenarioGameSetupOptions, ScenarioPlugin } from './types';

/**
 * A scenario driven by its `definition.json` (AUD-20261017-232534 F011-A): villain stages per
 * difficulty, main scheme stages, mandatory and modular encounter sets. The Setup and When
 * Revealed abilities printed on its main scheme cards are supplemental data, resolved here at
 * setup and when the main scheme advances (RR v1.8 Appendix II step 12, main scheme).
 */
export class DeclarativeScenarioPlugin implements ScenarioPlugin {
  constructor(readonly definition: ScenarioDefinition) {}

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
    timing: 'SETUP' | 'WHEN_REVEALED' | 'WHEN_COMPLETED',
  ): void {
    if (!card) return;
    const playerId = state.players[state.firstPlayerIndex ?? 0]?.id ?? state.players[0]?.id ?? '';
    for (const ability of card.enrichment?.abilities ?? []) {
      if (ability.timing === timing || ability.trigger === timing) {
        kernel.executeEffect(state, ability, { playerId, sourceCardId: card.code });
      }
    }
  }

  private toMainScheme(state: GameState, card: MainSchemeCard): MainSchemeState {
    const players = getPerPlayerCount(state) || 1;
    const baseThreat = (card.baseThreat ?? 0) * (card.baseThreatFixed ? 1 : players);
    return {
      instanceId: `main_scheme_${nextEngineId(state, 'id')}_${card.code}`,
      card,
      threat: baseThreat,
      targetThreat: card.targetThreat * players,
      stage: card.stage?.toUpperCase() || '1B',
    };
  }

  /**
   * RR v1.8 Double-Sided Card: a card with "Standard Mode Only" and "Expert Mode Only" sides is in
   * play with its Expert side faceup in expert mode, otherwise its Standard side.
   */
  private sideForMode(state: GameState, card: NormalizedCard): NormalizedCard {
    if (card.enrichment?.modeOnly !== 'STANDARD' || !state.expertMode || !card.backLink)
      return card;
    return getCatalog(state).getCard(card.backLink) ?? card;
  }

  /** Appendix II step 11: cards with the Setup keyword begin the game in play, not in the deck. */
  private putSetupCardsIntoPlay(state: GameState): void {
    const setupCards = state.encounterDeck.filter((c) => hasKeyword(c, Keyword.SETUP));
    if (setupCards.length === 0) return;
    state.encounterDeck = state.encounterDeck.filter((c) => !hasKeyword(c, Keyword.SETUP));
    for (const instance of setupCards) {
      if (instance.card.type === CardType.ENVIRONMENT) putEnvironmentIntoPlay(state, instance);
      else if (instance.card.type === CardType.SIDE_SCHEME) placeSideScheme(state, instance);
      else {
        throw new Error(
          `Setup card '${instance.card.code}' has type '${instance.card.type}', which setup cannot place.`,
        );
      }
    }
  }

  private buildEncounterDeck(state: GameState, options: ScenarioGameSetupOptions): void {
    const sets = this.definition.modularEncounterSets;
    const setCodes = [
      ...sets.mandatory,
      ...[state.encounterSets.standard, state.encounterSets.expert].filter(
        (code): code is string => code !== null,
      ),
      ...(options.modularSetCodes ?? sets.recommendedModularSets ?? []),
    ];

    // Villain and main scheme stages never go into the encounter deck
    const stageCodes = new Set([
      ...Object.values(this.definition.villainSetup.stages).flatMap((stages) => stages ?? []),
      ...this.definition.mainSchemeSetup.stages,
    ]);
    const excludedTypes = new Set<string>(['villain', 'main_scheme']);
    const deckCards = setCodes
      .flatMap((code) => listEncounterDeckCards(getCatalog(state), code))
      .filter((c: NormalizedCard) => !excludedTypes.has(c.type) && !stageCodes.has(c.code))
      .map((c: NormalizedCard) => this.sideForMode(state, c));

    state.encounterDeck = shuffleArray(state, deckCards).map((c) => createCardInstance(c));
    state.encounterDiscard = [];
    state.sideSchemes = [];
    state.environments = [];
  }

  onGameSetup(state: GameState, options: ScenarioGameSetupOptions): GameState {
    const { difficulty, expertMode, encounterSets, villainStages } = resolveScenarioSetup(
      this.definition,
      options,
    );
    state.difficulty = difficulty;
    state.expertMode = expertMode;
    state.encounterSets = encounterSets;
    state.heroicLevel = options.heroicLevel || 0;
    state.scenarioId = this.definition.id;
    state.scenarioCardCode = this.definition.scenarioCardCode;

    // 1. The first villain stage of the game
    const [startingStageCode] = villainStages;
    const villainCard = getCatalog(state).getCard(startingStageCode) as VillainCard | undefined;
    if (!villainCard) {
      throw new Error(
        `Villain card '${startingStageCode}' not found in catalog for scenario '${this.definition.id}'.`,
      );
    }
    const maxHealth = villainStageHitPoints(villainCard, getPerPlayerCount(state));
    const isDoubleSided = Boolean(villainCard.backLink);
    const altCode =
      villainCard.backLink ??
      (startingStageCode.endsWith('a')
        ? startingStageCode.replace(/a$/, 'b')
        : startingStageCode.replace(/b$/, 'a'));
    const alternateCard = isDoubleSided
      ? (getCatalog(state).getCard(altCode) as VillainCard | undefined)
      : undefined;
    const villain: VillainState = {
      instanceId: `villain_${nextEngineId(state, 'id')}_${startingStageCode}`,
      card: villainCard,
      health: maxHealth,
      maxHealth,
      exhausted: false,
      statusCards: [],
      attachments: [],
      ...(isDoubleSided
        ? {
            activeSide: startingStageCode.endsWith('b') ? ('b' as const) : ('a' as const),
            alternateCard,
          }
        : {}),
    };
    state.villains = [villain];
    setActiveVillain(state, villain.instanceId!);

    // 2. The first main scheme stage (1B)
    const [firstStage] = this.mainSchemeStagePairs(state);
    const firstScheme = firstStage?.b;
    if (!firstScheme) {
      throw new Error(`Main scheme stage '1B' not found for scenario '${this.definition.id}'.`);
    }
    const mainScheme = this.toMainScheme(state, firstScheme);
    replaceActiveMainScheme(state, mainScheme);

    // 3. Encounter deck, Appendix II step 11 (Setup cards), then step 12: (a) the Setup abilities of
    // main scheme 1A, (b) 1B's When Revealed abilities, (c) the starting villain stage is revealed
    this.buildEncounterDeck(state, options);
    this.putSetupCardsIntoPlay(state);
    this.resolveMainSchemeAbilities(state, firstStage.a, 'SETUP');
    this.resolveMainSchemeAbilities(state, firstScheme, 'WHEN_REVEALED');
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

    // The next stage of this difficulty enters play; the last stage defeated wins the game. In
    // Skirmish the villain in play is the one version of the game, so it is the last stage.
    const stages = getVillainStages(this.definition, difficulty, villain.card.code);
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
    this.resolveMainSchemeAbilities(state, current.card, 'WHEN_COMPLETED');
    const stages = this.mainSchemeStagePairs(state);
    const currentIndex = stages.findIndex((stage) => stage.b.code === current.card.code);
    const next = currentIndex >= 0 ? stages[currentIndex + 1] : undefined;

    // The next main scheme stage, or the players lose with the last one. RR v1.8 main scheme:
    // resolve When Revealed on the new top card's A side, flip it to B with its starting threat,
    // then resolve When Revealed on the B side.
    if (next) {
      this.resolveMainSchemeAbilities(state, next.a, 'WHEN_REVEALED');
      const nextScheme = this.toMainScheme(state, next.b);
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
