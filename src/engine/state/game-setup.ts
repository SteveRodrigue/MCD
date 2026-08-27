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
} from '@engine/models';

let instanceCounter = 0;

export function resetInstanceCounter(): void {
  instanceCounter = 0;
}

export function createCardInstance(card: NormalizedCard): CardInstance {
  instanceCounter += 1;
  return {
    instanceId: `inst_${instanceCounter}_${card.code}`,
    card,
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
}

export interface GameSetupOptions {
  id?: string;
  players: PlayerSetupConfig[];
  villain: VillainCard;
  mainScheme: MainSchemeCard;
  encounterCards: NormalizedCard[];
  shuffleFn?: <T>(array: T[]) => T[];
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
 * Executes official Marvel Champions Setup Sequence (Learn to Play / RR v1.8):
 * 1. Players begin in Alter-Ego form.
 * 2. Set Hit Points for Hero and Villain (scaled by player count).
 * 3. Main scheme initialized (The Break-In! starts at 0 threat).
 * 4. Encounter deck created from villain + standard + modular sets.
 * 5. Players draw starting hand equal to Alter-Ego hand size.
 */
export function setupGame(options: GameSetupOptions): GameState {
  const shuffle = options.shuffleFn || defaultShuffle;
  const playerCount = options.players.length;

  // 1. Setup Players
  const players: PlayerState[] = options.players.map((pConfig) => {
    // Instantiate all deck cards
    const deckInstances = pConfig.deckCards.map(createCardInstance);
    const shuffledDeck = shuffle(deckInstances);

    // Draw starting hand equal to Alter-Ego hand size
    const startingHandSize = pConfig.alterEgo.handSize;
    const hand = shuffledDeck.splice(0, startingHandSize);

    // Available forms for this identity
    const availableForms: NormalizedCard[] = (pConfig as any).additionalForms
      ? [pConfig.alterEgo, pConfig.hero, ...(pConfig as any).additionalForms]
      : [pConfig.alterEgo, pConfig.hero];

    return {
      id: pConfig.id,
      name: pConfig.name,
      hero: pConfig.hero,
      alterEgo: pConfig.alterEgo,
      availableForms,
      activeFormCard: pConfig.alterEgo,
      currentForm: 'alter_ego',
      health: pConfig.alterEgo.health,
      maxHealth: pConfig.alterEgo.health,
      exhausted: false,
      statusCards: [],
      hand,
      deck: shuffledDeck,
      discard: [],
      tableau: [],
      allies: [],
      engagedMinions: [],
      formChangedThisRound: false,
      recoveryUsedThisRound: false,
      dealtEncounterCards: [],
    };
  });

  // 2. Setup Villain
  const villainHealth = options.villain.healthPerHero
    ? options.villain.health * playerCount
    : options.villain.health;

  const villain: VillainState = {
    card: options.villain,
    health: villainHealth,
    maxHealth: villainHealth,
    exhausted: false,
    statusCards: [],
    attachments: [],
  };

  // 3. Setup Main Scheme
  const mainScheme: MainSchemeState = {
    card: options.mainScheme,
    threat: options.mainScheme.baseThreat * (options.mainScheme.baseThreatFixed ? 1 : playerCount),
    targetThreat: options.mainScheme.targetThreat * playerCount,
    stage: options.mainScheme.stage,
  };

  // 4. Setup Encounter Deck
  const encounterInstances = options.encounterCards.map(createCardInstance);
  const shuffledEncounterDeck = shuffle(encounterInstances);

  // 5. Initialize Complete GameState
  return {
    id: options.id || `game_${Date.now()}`,
    roundNumber: 1,
    phase: GamePhase.PLAYER_PHASE,
    firstPlayerIndex: 0,
    activePlayerIndex: 0,
    players,
    villain,
    mainScheme,
    sideSchemes: [],
    encounterDeck: shuffledEncounterDeck,
    encounterDiscard: [],
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
        },
      },
    ],
  };
}
