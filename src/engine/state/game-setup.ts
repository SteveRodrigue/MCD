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
} from '@engine/models';
import { cardCatalog } from '../../data/importer/card-loader';
import { ScenarioRegistry } from '../scenarios/registry';

let instanceCounter = 0;

export function resetInstanceCounter(): void {
  instanceCounter = 0;
}

export function createCardInstance(card: NormalizedCard): CardInstance {
  if (!card.enrichment && card.code.startsWith('unscanned_')) {
    throw new Error(`Supplemental data is missing for card ${card.code} (${card.name})`);
  }
  instanceCounter += 1;
  return {
    instanceId: `inst_${instanceCounter}_${card.code}`,
    card: {
      ...card,
      enrichment: card.enrichment || { abilities: [] },
    },
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

export interface PlayerSetupConfig {
  id: string;
  name: string;
  hero: HeroCard;
  alterEgo: AlterEgoCard;
  deckCards: NormalizedCard[];
  obligation?: NormalizedCard;
  obligations?: NormalizedCard[];
  nemesisCards?: NormalizedCard[];
  chosenSetupCardCode?: string;
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
 * 13. Players draw starting hand equal to Alter-Ego hand size.
 * 14. Sets setupState to MULLIGAN_PHASE (unless skipMulligan is true).
 * 15. Start Round 1 (Player Phase begins).
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
        permanentCards.push(createCardInstance(card));
      } else {
        drawDeckCards.push(card);
      }
    }

    const handSize = pConfig.alterEgo.handSize;
    const shuffledDeck = shuffle(drawDeckCards.map(createCardInstance));
    const hand = shuffledDeck.splice(0, handSize);

    const defaultNemesisCards = pConfig.hero.setCode
      ? cardCatalog.getNemesisCardsForHero(pConfig.hero.setCode)
      : [];
    const setAsideCards = (
      pConfig.nemesisCards && pConfig.nemesisCards.length > 0
        ? pConfig.nemesisCards
        : defaultNemesisCards
    ).map(createCardInstance);

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
      hand,
      deck: shuffledDeck,
      discard: [],
      tableau: permanentCards,
      allies: [],
      engagedMinions: [],
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
    options.encounterCards || cardCatalog.getCardsBySet(options.scenarioId || 'rhino');
  const allEncounterCards = [...rawEncounterCards, ...playerObligations];
  const encounterInstances = allEncounterCards.map(createCardInstance);
  const shuffledEncounterDeck = shuffle(encounterInstances);

  // 5. Setup State
  const initialPhase = skipMulligan ? GamePhase.PLAYER_PHASE : GamePhase.SETUP_PHASE;
  const setupState = skipMulligan
    ? undefined
    : {
        stage: 'MULLIGAN_PHASE' as const,
        mulliganCompleted: {},
      };

  // 6. Initialize Base GameState
  let state: GameState = {
    id: options.id || `game_${Date.now()}`,
    roundNumber: 1,
    phase: initialPhase,
    setupState,
    scenarioId: options.scenarioId || 'rhino',
    difficulty,
    heroicLevel: options.heroicLevel || 0,
    firstPlayerIndex: 0,
    activePlayerIndex: 0,
    pendingDecisionQueue: [],
    executionStack: [],
    players,
    villains: [villain],
    activeVillainIndex: 0,
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

  // 8. Step 14: Resolve Character Setup Abilities (RR v1.8 p. 27)
  state = step14_resolveCharacterSetupAbilities(state, options);

  return state;
}

/**
 * Step 14: Resolve Character Setup Abilities (RR v1.8 p. 27).
 * In player order, each player resolves any "Setup" instructions on their identity card and obligations.
 */
export function step14_resolveCharacterSetupAbilities(
  state: GameState,
  options: GameSetupOptions,
): GameState {
  const shuffle = options.shuffleFn || defaultShuffle;

  for (let i = 0; i < state.players.length; i++) {
    const player = state.players[i];
    const pConfig = options.players[i];

    // Check alterEgo and hero cards for printed SETUP abilities
    const cardsToCheck = [
      player.alterEgo,
      player.hero,
      ...(player.tableau || []).map((t) => t.card),
    ];
    for (const card of cardsToCheck) {
      const abilities = card.enrichment?.abilities || [];
      const setupAbilities = abilities.filter((a) => a.timing === 'SETUP');

      for (const ability of setupAbilities) {
        for (const step of ability.steps || []) {
          if (step.effect === 'SEARCH_AND_SELECT') {
            const filter = (step.params?.filter || {}) as Record<string, any>;
            const selectedDestination = (step.params?.selectedDestination as string) || 'HAND';
            const shuffleAfter = step.params?.shuffleAfter !== false;

            // Find matching candidate cards in player.deck
            let candidateIndices: number[] = [];
            for (let cIdx = 0; cIdx < player.deck.length; cIdx++) {
              const deckCard = player.deck[cIdx];
              const traitMatch = !filter.trait || deckCard.card.traits?.includes(filter.trait);
              const typeMatch = !filter.type || deckCard.card.type === filter.type;
              const codeMatch =
                !pConfig?.chosenSetupCardCode || deckCard.card.code === pConfig.chosenSetupCardCode;

              if (traitMatch && typeMatch && codeMatch) {
                candidateIndices.push(cIdx);
              }
            }

            // If no match with chosenSetupCardCode, fallback to any matching filter
            if (candidateIndices.length === 0 && pConfig?.chosenSetupCardCode) {
              for (let cIdx = 0; cIdx < player.deck.length; cIdx++) {
                const deckCard = player.deck[cIdx];
                const traitMatch = !filter.trait || deckCard.card.traits?.includes(filter.trait);
                const typeMatch = !filter.type || deckCard.card.type === filter.type;
                if (traitMatch && typeMatch) {
                  candidateIndices.push(cIdx);
                }
              }
            }

            if (candidateIndices.length > 0) {
              const chosenIdx = candidateIndices[0];
              const [selectedCard] = player.deck.splice(chosenIdx, 1);

              if (selectedDestination === 'TABLEAU') {
                player.tableau.push(selectedCard);
              } else {
                player.hand.push(selectedCard);
              }

              if (shuffleAfter) {
                player.deck = shuffle(player.deck);
              }

              state.log.push({
                id: `log_${Date.now()}_setup_${selectedCard.instanceId}`,
                timestamp: Date.now(),
                round: 1,
                phase: state.phase,
                category: 'ability',
                actor: { name: player.name, type: player.currentForm },
                key: 'character.setup.resolved',
                params: {
                  player: player.name,
                  card: selectedCard.card.name,
                  destination: selectedDestination,
                },
                onomatopoeia: `SETUP: ${selectedCard.card.name.toUpperCase()} READY!`,
              });
            }
          }
        }
      }
    }
  }

  return state;
}
