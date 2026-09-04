import {
  NormalizedCard,
  HeroCard,
  AlterEgoCard,
  VillainCard,
  MainSchemeCard,
  SideSchemeCard,
  PlayerSideSchemeCard,
} from './card';
import { StatusCard } from './enums';
import { AbilityStep } from './abilities';

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
  counters?: Record<string, number>; // Universal named counter map per ADR-0035
  statusCards?: StatusCard[];
  attachments?: CardInstance[];
  cardsUnderneath?: CardInstance[]; // Out-of-play cards placed/tucked under this card (RR v1.8 p. 6)
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
  attachments?: CardInstance[]; // Attachments attached directly to player identity (e.g. Caught in a Web)
  cardsUnderneath?: CardInstance[]; // Out-of-play cards placed under identity
  counters?: Record<string, number>; // Universal identity counter map per ADR-0035 (e.g. charge, growth)
  basicChangeFormUsedThisRound: boolean;
  formChangedThisRound: boolean;
  recoveryUsedThisRound: boolean;
  /** Tracks ability IDs used during the current round (e.g. limit: ONCE_PER_ROUND) */
  usedAbilitiesThisRound?: Record<string, number>;
  /** Tracks ability IDs used during the current phase (e.g. limit: ONCE_PER_PHASE) */
  usedAbilitiesThisPhase?: Record<string, number>;
  /** Tracks active cost reductions applied to the next played card (e.g. Helicarrier) */
  costReductions?: number;
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
  cardsUnderneath?: CardInstance[];
}

export interface MainSchemeState {
  instanceId?: string;
  card: MainSchemeCard;
  threat: number;
  targetThreat: number;
  stage: string;
  attachments?: CardInstance[];
  cardsUnderneath?: CardInstance[];
}

export interface SideSchemeState {
  instanceId: string;
  /** Player Side Schemes (ADR-0034) share this same zone/array, distinguished by card.type */
  card: SideSchemeCard | PlayerSideSchemeCard;
  threat: number;
  /** Set when a player-played PlayerSideSchemeCard entered play; undefined for encounter Side Schemes */
  ownerId?: string;
  attachments?: CardInstance[];
  cardsUnderneath?: CardInstance[];
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

export interface RevealedCardDisplay {
  instanceId: string;
  card: NormalizedCard;
  isSelectable: boolean;
  selectableOptionId?: string;
  dimmedReason?: string;
}

/**
 * Execution Frame for the Universal Resolution Stack (ADR-0032)
 */
export interface ExecutionFrame {
  id: string;
  type: 'ACTION' | 'ACTIVATION' | 'PHASE_STEP' | 'INTERRUPT' | 'RESPONSE';
  sourceCardCode?: string;
  playerId?: string;
  stepIndex: number;
  steps: AbilityStep[];
  context?: Record<string, any>;
}

export type CombatPhase =
  | 'PRE_ATTACK'
  | 'DECLARE_DEFENDER'
  | 'DEAL_BOOST'
  | 'REVEAL_BOOST'
  | 'CALCULATE_DAMAGE'
  | 'POST_ATTACK';

export interface DefenderDeclaration {
  type: 'HERO' | 'ALLY' | 'UNDEFENDED';
  playerId: string;
  allyInstanceId?: string;
}

export interface AttackExecutionContext {
  attackId: string;
  attackerType: 'VILLAIN' | 'MINION';
  attackerCard?: CardInstance;
  targetPlayerId: string;
  phase: CombatPhase;
  baseAttack: number;
  boostQueue: CardInstance[];
  totalBoostIcons: number;
  defender?: DefenderDeclaration;
  heroDefended?: boolean;
  defenseValue?: number;
  hasOverkill?: boolean;
  hasPiercing?: boolean;
  damagePreventionAmount?: number;
  finalDamage?: number;
  cancelled?: boolean;
  cancellationReason?: string;
}

export interface PendingDecisionPrompt {
  promptId: string;
  playerId: string;
  title: string;
  description: string;
  sourceCardName: string;
  options: DecisionPromptOption[];
  revealedCards?: RevealedCardDisplay[];
  isVoluntary?: boolean;
  parentFrameId?: string;
  queuePosition?: number;
  totalQueued?: number;
}

export interface GameState {
  id: string;
  roundNumber: number;
  phase: GamePhase;
  setupState?: SetupState;
  villainPhaseStep?: VillainPhaseStep;

  /** Structured FIFO Prompt Queue (ADR-0032) */
  pendingDecisionQueue?: PendingDecisionPrompt[];
  /** Execution Frame Stack (ADR-0032) */
  executionStack?: ExecutionFrame[];

  /** Legacy / direct pointer to head of pendingDecisionQueue for backwards-compatibility */
  pendingDecisionPrompt?: PendingDecisionPrompt;
  scenarioId?: string;
  scenarioCardCode?: string;
  difficulty?: DifficultyMode;
  heroicLevel?: number;
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
  /** Named modular scenario draw piles (ADR-0034), e.g. 'infinity_gauntlet', 'holding_cell', 'evidence' */
  auxiliaryDecks: Record<string, CardInstance[]>;
  auxiliaryDiscards: Record<string, CardInstance[]>;
  removedFromGame: CardInstance[];
  accelerationTokens: number;
  activeBoostCard?: CardInstance;
  activeAttackContext?: AttackExecutionContext;
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
