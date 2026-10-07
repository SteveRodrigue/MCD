import {
  GameState,
  PlayerState,
  VillainState,
  MainSchemeState,
  GamePhase,
  CardInstance,
  HeroCard,
  AlterEgoCard,
  VillainCard,
  MainSchemeCard,
  NormalizedCard,
  DifficultyMode,
  Keyword,
  hasKeyword,
  PendingSetupAbility,
} from '@engine/models';
import { cardCatalog } from '../../data/importer/card-loader';
import { ScenarioRegistry } from '../scenarios';
import { executeEffect, hasPendingSequence } from '../effects';
import { peekDecisionPrompt } from '../pipeline/prompt-queue';
import { createCardInstance, resetInstanceCounter } from './card-instance';

export { createCardInstance, resetInstanceCounter };

export interface PlayerSetupConfig {
  id: string;
  name: string;
  hero: HeroCard;
  alterEgo: AlterEgoCard;
  deckCards: NormalizedCard[];
  obligation?: NormalizedCard;
  obligations?: NormalizedCard[];
  nemesisCards?: NormalizedCard[];
}

export interface GameSetupOptions {
  id?: string;
  scenarioId?: string;
  difficulty?: DifficultyMode;
  heroicLevel?: number;
  players: PlayerSetupConfig[];
  villain?: VillainCard;
  mainScheme?: MainSchemeCard;
  encounterCards?: NormalizedCard[];
  modularSetCodes?: string[];
  shuffleFn?: <T>(array: T[]) => T[];
  skipMulligan?: boolean;
  skipScenarioPlugin?: boolean;
}

/**
 * Standard Fisher-Yates array shuffle.
 */
export function defaultShuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Executes official Marvel Champions Setup Sequence (Learn to Play / RR v1.8 p. 27–28):
 * 1. Players begin in Alter-Ego form. (Permanent keyword cards put directly into play).
 * 2. Set Hit Points for Hero and Villain (scaled by player count).
 * 3. Determine first player (Player 1).
 * 4. Set aside player obligations (0 to many per player).
 * 5. Set aside each player's Nemesis Set (5 cards) out of play.
 * 6. Shuffle player decks (40–50 cards).
 * 7. Initialize status cards and token pools.
 * 8. Select Villain Stage Cards.
 * 9. Set Scaled Villain HP.
 * 10. Main scheme initialized.
 * 11. Shuffle all player obligations into the encounter deck.
 * 12. Shuffle encounter deck.
 * 13. Run the scenario plugin setup (villain, main scheme, encounter deck, When Revealed).
 * 14. Players draw starting hand equal to Alter-Ego hand size.
 * 15. Mulligan: sets setupState to MULLIGAN_PHASE (interactive, unless skipMulligan is true).
 * 16. Resolve player Setup abilities (after the mulligans, `beginPlayerSetup`).
 *
 * Steps 1 to 14 run in SETUP_PHASE with setupState.stage SCENARIO_SETUP, so no
 * player-controlled ability can trigger. Afterwards the phase is SETUP_PHASE
 * (MULLIGAN_PHASE) or, with skipMulligan, step 16 runs at once: PLAYER_PHASE (Round 1 begins),
 * or SETUP_PHASE (PLAYER_SETUP) while a Setup ability waits for a decision.
 */
export function setupGame(options: GameSetupOptions): GameState {
  const shuffle = options.shuffleFn || defaultShuffle;
  const playerCount = options.players.length;
  const skipMulligan = options.skipMulligan ?? false;
  const difficulty = options.difficulty || 'STANDARD';

  // Unicity Constraint (RR v1.8): No two players can share the same hero identity
  const seenHeroNames = new Set<string>();
  for (const p of options.players) {
    const heroKey = p.hero.name.toLowerCase();
    if (seenHeroNames.has(heroKey)) {
      throw new Error(
        `Unicity constraint violation (RR v1.8): Duplicate hero identity '${p.hero.name}' selected. Each hero in a game must be unique.`,
      );
    }
    seenHeroNames.add(heroKey);
  }

  // 1. Setup Players & Permanent Keyword Invariant (RR v1.8 p. 21, 27)
  const players: PlayerState[] = options.players.map((pConfig) => {
    const permanentCards: CardInstance[] = [];
    const drawDeckCards: NormalizedCard[] = [];

    for (const card of pConfig.deckCards) {
      const isPermanent = hasKeyword(card, Keyword.PERMANENT) || (card as any).permanent === true;

      if (isPermanent) {
        permanentCards.push(createCardInstance(card, pConfig.id));
      } else {
        drawDeckCards.push(card);
      }
    }

    // Step 6: shuffle the deck. The opening hand is drawn at step 14, after the scenario setup.
    const shuffledDeck = shuffle(drawDeckCards.map((c) => createCardInstance(c, pConfig.id)));

    const defaultNemesisCards = pConfig.hero.setCode
      ? cardCatalog.getNemesisCardsForHero(pConfig.hero.setCode)
      : [];
    const setAsideCards = (
      pConfig.nemesisCards && pConfig.nemesisCards.length > 0
        ? pConfig.nemesisCards
        : defaultNemesisCards
    ).map((c) => createCardInstance(c, pConfig.id));

    return {
      id: pConfig.id,
      name: pConfig.name,
      hero: pConfig.hero,
      alterEgo: pConfig.alterEgo,
      availableForms: [pConfig.hero, pConfig.alterEgo],
      activeFormCard: pConfig.alterEgo,
      currentForm: 'alter_ego',
      health: pConfig.alterEgo.health,
      maxHealth: pConfig.alterEgo.health,
      exhausted: false,
      statusCards: [],
      hand: [],
      deck: shuffledDeck,
      discard: [],
      tableau: permanentCards,
      allies: [],
      engagedMinions: [],
      obligations: [],
      basicChangeFormUsedThisRound: false,
      formChangedThisRound: false,
      recoveryUsedThisRound: false,
      dealtEncounterCards: [],
      setAsideCards,
    };
  });

  // 2. Setup Default / Fallback Villain
  const rawVillain =
    options.villain ||
    (cardCatalog.getVillainByStage(options.scenarioId || 'rhino', 'I') as VillainCard) ||
    (cardCatalog.getCard('01094') as VillainCard);
  const villainHealth = rawVillain.healthPerHero
    ? rawVillain.health * playerCount
    : rawVillain.health;

  const villain: VillainState = {
    instanceId: `villain_${Date.now()}_${rawVillain.code}`,
    card: rawVillain,
    health: villainHealth,
    maxHealth: villainHealth,
    exhausted: false,
    statusCards: [],
    attachments: [],
  };

  // 3. Setup Default / Fallback Main Scheme
  const rawMainScheme =
    options.mainScheme ||
    (cardCatalog.getMainSchemeByStage(options.scenarioId || 'rhino', '1B') as MainSchemeCard) ||
    (cardCatalog.getCard('01097b') as MainSchemeCard);

  const mainScheme: MainSchemeState = {
    instanceId: `main_scheme_${Date.now()}_${rawMainScheme.code}`,
    card: rawMainScheme,
    threat: rawMainScheme.baseThreat * (rawMainScheme.baseThreatFixed ? 1 : playerCount),
    targetThreat: (rawMainScheme.targetThreat || 7) * playerCount,
    stage: rawMainScheme.stage || '1B',
  };

  // 4. Setup Encounter Deck (Step 11: Shuffle all player obligations into encounter deck)
  const playerObligations: NormalizedCard[] = [];
  for (const p of options.players) {
    if (p.obligations && Array.isArray(p.obligations)) {
      playerObligations.push(...p.obligations);
    } else if (p.obligation) {
      playerObligations.push(p.obligation);
    }
  }

  const rawEncounterCards =
    options.encounterCards ||
    cardCatalog
      .getExpandedCardsBySet(options.scenarioId || 'rhino')
      .filter((c: NormalizedCard) => c.type !== 'villain' && c.type !== 'main_scheme');
  const allEncounterCards = [...rawEncounterCards, ...playerObligations];
  const encounterInstances = allEncounterCards.map((c) => createCardInstance(c));
  const shuffledEncounterDeck = shuffle(encounterInstances);

  // 5. Setup State: the whole setup (Appendix II steps 1 to 16) runs in SETUP_PHASE, with
  // the SCENARIO_SETUP stage suppressing player-controlled abilities.
  // 6. Initialize Base GameState
  let state: GameState = {
    id: options.id || `game_${Date.now()}`,
    roundNumber: 1,
    phase: GamePhase.SETUP_PHASE,
    setupState: { stage: 'SCENARIO_SETUP', mulliganCompleted: {} },
    scenarioId: options.scenarioId || 'rhino',
    difficulty,
    heroicLevel: options.heroicLevel || 0,
    firstPlayerIndex: 0,
    activePlayerIndex: 0,
    pendingDecisionQueue: [],
    executionStack: [],
    players,
    villains: [villain],
    activeVillainId: villain.instanceId,
    mainSchemes: [mainScheme],
    activeMainSchemeIndex: 0,
    villain,
    mainScheme,
    sideSchemes: [],
    environments: [],
    encounterDeck: shuffledEncounterDeck,
    encounterDiscard: [],
    victoryDisplay: [],
    auxiliaryDecks: {},
    auxiliaryDiscards: {},
    removedFromGame: [],
    accelerationTokens: 0,
    winner: null,
    log: [
      {
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        key: 'game.setup.complete',
        params: {
          villain: rawVillain.name,
          scheme: rawMainScheme.name,
          playerCount,
          difficulty,
        },
      },
    ],
  };

  // 7. Invoke Scenario Plugin Lifecycle Setup if registered (Enforces official 15-step scenario setup)
  if (
    !options.skipScenarioPlugin &&
    options.scenarioId &&
    ScenarioRegistry.has(options.scenarioId)
  ) {
    const plugin = ScenarioRegistry.get(options.scenarioId);
    state = plugin.onGameSetup(state, {
      scenarioId: options.scenarioId,
      difficulty,
      heroicLevel: options.heroicLevel,
      modularSetCodes: options.modularSetCodes,
    });

    // Ensure player obligations remain included in encounter deck if plugin constructed the deck
    if (playerObligations.length > 0) {
      for (const ob of playerObligations) {
        if (!state.encounterDeck.some((c) => c.card.code === ob.code)) {
          state.encounterDeck.push(createCardInstance(ob));
        }
      }
      state.encounterDeck = shuffle(state.encounterDeck);
    }
  }

  // 8. Step 14: players draw their opening hands (hand size of the alter-ego).
  for (let i = 0; i < state.players.length; i++) {
    const player = state.players[i];
    player.hand.push(...player.deck.splice(0, options.players[i].alterEgo.handSize));
  }

  // 9. Step 15 (mulligans, interactive) comes first; step 16 (player Setup abilities) follows it.
  if (skipMulligan) {
    state.setupState = { stage: 'PLAYER_SETUP', mulliganCompleted: {} };
    return beginPlayerSetup(state);
  }
  state.setupState = { stage: 'MULLIGAN_PHASE', mulliganCompleted: {} };

  return state;
}

/**
 * Step 16: Resolve Player Setup Abilities (RR v1.8 Appendix II), after the mulligans of step 15.
 * Lists, in player order starting with the first player, every SETUP ability of the cards a
 * player has in play at the start of the game: the identity in its starting form and the tableau.
 */
export function collectPlayerSetupAbilities(state: GameState): PendingSetupAbility[] {
  const first = Math.max(0, Math.min(state.firstPlayerIndex ?? 0, state.players.length - 1));
  const inOrder = [...state.players.slice(first), ...state.players.slice(0, first)];
  const pending: PendingSetupAbility[] = [];

  for (const player of inOrder) {
    const cardsInPlay: { card: NormalizedCard; instanceId?: string }[] = [
      { card: player.activeFormCard },
      ...player.tableau.map((t) => ({ card: t.card, instanceId: t.instanceId })),
    ];
    for (const { card, instanceId } of cardsInPlay) {
      for (const ability of card.enrichment?.abilities ?? []) {
        if (ability.timing !== 'SETUP') continue;
        pending.push({
          playerId: player.id,
          abilityId: ability.id,
          sourceCardCode: card.code,
          sourceInstanceId: instanceId,
        });
      }
    }
  }
  return pending;
}

/**
 * Enters the player setup stage (step 16) and resolves every Setup ability through the normal
 * effect pipeline. An ability that needs a choice (T'Challa's Foresight) stops the setup at its
 * decision prompt; `advancePlayerSetup` continues once it is answered.
 */
export function beginPlayerSetup(state: GameState): GameState {
  state.phase = GamePhase.SETUP_PHASE;
  state.setupState = {
    stage: 'PLAYER_SETUP',
    mulliganCompleted: state.setupState?.mulliganCompleted ?? {},
    pendingSetupAbilities: collectPlayerSetupAbilities(state),
  };
  return advancePlayerSetup(state);
}

/**
 * Resolves the next pending Setup abilities until one asks the player for a decision or none is
 * left; then Round 1 begins (RR v1.8 Appendix II: "The game is now ready to begin").
 */
export function advancePlayerSetup(state: GameState): GameState {
  let current = state;

  while (current.setupState?.stage === 'PLAYER_SETUP') {
    if (peekDecisionPrompt(current) || hasPendingSequence(current)) return current;

    const next = current.setupState.pendingSetupAbilities?.shift();
    if (!next) {
      const mulliganDone = current.players.every(
        (p) => current.setupState?.mulliganCompleted[p.id],
      );
      current.phase = GamePhase.PLAYER_PHASE;
      if (mulliganDone) {
        current.setupState.stage = 'GAME_READY';
        current.setupState.pendingSetupAbilities = undefined;
        current.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          round: 1,
          phase: GamePhase.PLAYER_PHASE,
          key: 'phase.player_phase.start',
          params: { round: 1 },
          onomatopoeia: 'HEROES ACT!',
        });
      } else {
        current.setupState = undefined;
      }
      return current;
    }

    const player = current.players.find((p) => p.id === next.playerId);
    if (!player) continue;
    const source = next.sourceInstanceId
      ? player.tableau.find((t) => t.instanceId === next.sourceInstanceId)
      : undefined;
    const card = source?.card ?? player.activeFormCard;
    const ability = card.enrichment?.abilities?.find((a) => a.id === next.abilityId);
    if (!ability) continue;

    const result = executeEffect(current, ability, {
      playerId: player.id,
      sourceCardInstance: source,
    });
    current = result.state;
    current.log.push({
      id: `log_${Date.now()}_setup_${next.abilityId}`,
      timestamp: Date.now(),
      round: 1,
      phase: current.phase,
      category: 'ability',
      actor: { name: player.name, type: player.currentForm },
      key: 'character.setup.resolved',
      params: { player: player.name, card: card.name },
      onomatopoeia: `SETUP: ${card.name.toUpperCase()} READY!`,
    });
  }
  return current;
}
