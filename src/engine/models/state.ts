import {
  NormalizedCard,
  HeroCard,
  AlterEgoCard,
  VillainCard,
  MainSchemeCard,
  SideSchemeCard,
} from './card';
import { StatusCard } from './enums';

/**
 * Runtime card instance in a zone (hand, deck, discard, or play)
 */
export interface CardInstance {
  instanceId: string;
  card: NormalizedCard;
  exhausted?: boolean;
  tokens?: {
    damage?: number;
    threat?: number;
    counters?: number; // e.g. web-counter, all-purpose counter
  };
  statusCards?: StatusCard[];
  attachments?: CardInstance[];
}

export type IdentityFormType = 'hero' | 'alter_ego';

export interface PlayerState {
  id: string;
  name: string;
  /** Primary hero card definition (for 2-form or primary identity) */
  hero: HeroCard;
  /** Primary alter-ego card definition */
  alterEgo: AlterEgoCard;
  /** All available form cards for this identity (e.g. 2 for Spider-Man, 3 for Ant-Man/Wasp/Angel) */
  availableForms: NormalizedCard[];
  /** Currently active form card definition */
  activeFormCard: NormalizedCard;
  /** Whether the current active form is considered 'hero' or 'alter_ego' */
  currentForm: IdentityFormType;
  health: number;
  maxHealth: number;
  exhausted: boolean;
  statusCards: StatusCard[];
  hand: CardInstance[];
  deck: CardInstance[];
  discard: CardInstance[];
  tableau: CardInstance[]; // Supports & Upgrades in play
  allies: CardInstance[]; // Allies in play
  engagedMinions: CardInstance[]; // Minions engaged with this player
  formChangedThisRound: boolean;
  recoveryUsedThisRound: boolean;
  /** Tracks ability IDs used during the current round (e.g. limit: ONCE_PER_ROUND) */
  usedAbilitiesThisRound?: Record<string, number>;
  /** Tracks ability IDs used during the current phase (e.g. limit: ONCE_PER_PHASE) */
  usedAbilitiesThisPhase?: Record<string, number>;
  dealtEncounterCards: CardInstance[]; // Face-down cards dealt in Step 4
  setAsideCards: CardInstance[]; // Set-aside nemesis cards
}

export type DifficultyMode = 'SKIRMISH' | 'STANDARD' | 'EXPERT';

export interface VillainState {
  instanceId?: string;
  card: VillainCard;
  health: number;
  maxHealth: number;
  exhausted: boolean;
  statusCards: StatusCard[];
  attachments: CardInstance[];
}

export interface MainSchemeState {
  instanceId?: string;
  card: MainSchemeCard;
  threat: number;
  targetThreat: number;
  stage: string;
}

export interface SideSchemeState {
  instanceId: string;
  card: SideSchemeCard;
  threat: number;
}

export enum GamePhase {
  SETUP_PHASE = 'SETUP_PHASE',
  PLAYER_PHASE = 'PLAYER_PHASE',
  VILLAIN_PHASE = 'VILLAIN_PHASE',
}

export interface SetupState {
  stage: 'SCENARIO_SETUP' | 'MULLIGAN_PHASE' | 'GAME_READY';
  mulliganCompleted: Record<string, boolean>; // playerId -> boolean
}

export enum VillainPhaseStep {
  MAIN_SCHEME_THREAT = 'MAIN_SCHEME_THREAT',
  VILLAIN_ACTIVATIONS = 'VILLAIN_ACTIVATIONS',
  MINION_ACTIVATIONS = 'MINION_ACTIVATIONS',
  DEAL_ENCOUNTER_CARDS = 'DEAL_ENCOUNTER_CARDS',
  REVEAL_ENCOUNTER_CARDS = 'REVEAL_ENCOUNTER_CARDS',
  PASS_FIRST_PLAYER = 'PASS_FIRST_PLAYER',
}

export interface GameLogEntry {
  id: string;
  timestamp: number;
  round?: number;
  phase?: GamePhase;
  category?: 'combat' | 'scheme' | 'card_play' | 'status' | 'phase' | 'ability';
  actor?: {
    name: string;
    type: 'hero' | 'alter_ego' | 'villain' | 'minion' | 'ally' | 'environment';
  };
  key: string;
  params?: Record<string, string | number | boolean>;
  onomatopoeia?: string; // e.g. "POW!", "BAM!", "THWIP!", "CLANG!"
  text?: string;
}

export interface DecisionPromptOption {
  id: string;
  label: string;
  description?: string;
  effect: string;
  params?: Record<string, unknown>;
}

export interface PendingDecisionPrompt {
  promptId: string;
  playerId: string;
  title: string;
  description: string;
  sourceCardName: string;
  options: DecisionPromptOption[];
}

export interface GameState {
  id: string;
  roundNumber: number;
  phase: GamePhase;
  setupState?: SetupState;
  villainPhaseStep?: VillainPhaseStep;
  pendingDecisionPrompt?: PendingDecisionPrompt;
  scenarioId?: string;
  scenarioCardCode?: string;
  difficulty?: DifficultyMode;
  firstPlayerIndex: number;
  activePlayerIndex: number;
  players: PlayerState[];

  /** Multi-Villain Collection & Active Pointer */
  villains: VillainState[];
  activeVillainIndex: number;

  /** Multi-Main Scheme Collection & Active Pointer */
  mainSchemes: MainSchemeState[];
  activeMainSchemeIndex: number;

  /** Legacy / direct reference to active villain for backwards-compatibility */
  villain: VillainState;
  /** Legacy / direct reference to active main scheme for backwards-compatibility */
  mainScheme: MainSchemeState;

  sideSchemes: SideSchemeState[];
  environments: CardInstance[];
  encounterDeck: CardInstance[];
  encounterDiscard: CardInstance[];
  victoryDisplay: CardInstance[];
  removedFromGame: CardInstance[];
  accelerationTokens: number;
  activeBoostCard?: CardInstance;
  winner: 'HEROES' | 'VILLAIN' | null;
  log: GameLogEntry[];
}

/**
 * Accessor returning the currently active player from GameState (RR v1.8 p. 4).
 */
export function getActivePlayer(state: GameState): PlayerState {
  if (state.players && state.players.length > 0) {
    const idx = state.activePlayerIndex ?? 0;
    return state.players[idx] || state.players[0];
  }
  throw new Error('GameState has no players initialized');
}

/**
 * Accessor returning the first player from GameState (RR v1.8 p. 13).
 */
export function getFirstPlayer(state: GameState): PlayerState {
  if (state.players && state.players.length > 0) {
    const idx = state.firstPlayerIndex ?? 0;
    return state.players[idx] || state.players[0];
  }
  throw new Error('GameState has no players initialized');
}

/**
 * Accessor returning the currently active villain from GameState.
 */
export function getActiveVillain(state: GameState): VillainState {
  if (state.villains && state.villains.length > 0) {
    const idx = state.activeVillainIndex ?? 0;
    return state.villains[idx] || state.villains[0];
  }
  return state.villain;
}

/**
 * Accessor returning the currently active main scheme from GameState.
 */
export function getActiveMainScheme(state: GameState): MainSchemeState {
  if (state.mainSchemes && state.mainSchemes.length > 0) {
    const idx = state.activeMainSchemeIndex ?? 0;
    return state.mainSchemes[idx] || state.mainSchemes[0];
  }
  return state.mainScheme;
}

/**
 * Finds a villain by card code or instanceId across state.villains.
 */
export function getVillainById(state: GameState, idOrCode: string): VillainState | undefined {
  return (
    (state.villains || []).find((v) => v.card.code === idOrCode || v.instanceId === idOrCode) ||
    (state.villain?.card.code === idOrCode ? state.villain : undefined)
  );
}

/**
 * Finds a main scheme by card code or instanceId across state.mainSchemes.
 */
export function getMainSchemeById(state: GameState, idOrCode: string): MainSchemeState | undefined {
  return (
    (state.mainSchemes || []).find((m) => m.card.code === idOrCode || m.instanceId === idOrCode) ||
    (state.mainScheme?.card.code === idOrCode ? state.mainScheme : undefined)
  );
}
