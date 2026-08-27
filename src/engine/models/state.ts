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
  dealtEncounterCards: CardInstance[]; // Face-down cards dealt in Step 4
  setAsideCards: CardInstance[]; // Set-aside nemesis cards
}

export interface VillainState {
  card: VillainCard;
  health: number;
  maxHealth: number;
  exhausted: boolean;
  statusCards: StatusCard[];
  attachments: CardInstance[];
}

export interface MainSchemeState {
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

export interface GameState {
  id: string;
  roundNumber: number;
  phase: GamePhase;
  setupState?: SetupState;
  villainPhaseStep?: VillainPhaseStep;
  firstPlayerIndex: number;
  activePlayerIndex: number;
  players: PlayerState[];
  villain: VillainState;
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
