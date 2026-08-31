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
} from '@engine/models';
import { cardCatalog } from '../../data/importer/card-loader';

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
}

export interface GameSetupOptions {
  id?: string;
  scenarioId?: string;
  difficulty?: DifficultyMode;
  heroicLevel?: number;
  players: PlayerSetupConfig[];
  villain: VillainCard;
  mainScheme: MainSchemeCard;
  encounterCards: NormalizedCard[];
  shuffleFn?: <T>(array: T[]) => T[];
  skipMulligan?: boolean;
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
      const isPermanent =
        ((card as any).keywords || []).includes(Keyword.PERMANENT) ||
        (card as any).permanent === true ||
        (card.text || '').toLowerCase().includes('permanent.');

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
      pConfig.nemesisCards && pConfig.nemesisCards.length > 0 ? pConfig.nemesisCards : defaultNemesisCards
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

  // 2. Setup Villain
  const villainHealth = options.villain.healthPerHero
    ? options.villain.health * playerCount
    : options.villain.health;

  const villain: VillainState = {
    instanceId: `villain_${Date.now()}_${options.villain.code}`,
    card: options.villain,
    health: villainHealth,
    maxHealth: villainHealth,
    exhausted: false,
    statusCards: [],
    attachments: [],
  };

  // 3. Setup Main Scheme
  const mainScheme: MainSchemeState = {
    instanceId: `main_scheme_${Date.now()}_${options.mainScheme.code}`,
    card: options.mainScheme,
    threat: options.mainScheme.baseThreat * (options.mainScheme.baseThreatFixed ? 1 : playerCount),
    targetThreat: options.mainScheme.targetThreat * playerCount,
    stage: options.mainScheme.stage,
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

  const allEncounterCards = [...options.encounterCards, ...playerObligations];
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

  // 6. Initialize Complete GameState
  return {
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
    removedFromGame: [],
    accelerationTokens: 0,
    winner: null,
    log: [
      {
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        key: 'game.setup.complete',
        params: {
          villain: options.villain.name,
          scheme: options.mainScheme.name,
          playerCount,
          difficulty,
        },
      },
    ],
  };
}
