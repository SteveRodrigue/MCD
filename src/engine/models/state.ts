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
  PLAYER_PHASE = 'PLAYER_PHASE',
  VILLAIN_PHASE = 'VILLAIN_PHASE',
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
  key: string;
  params?: Record<string, string | number>;
  onomatopoeia?: string; // e.g. "POW!", "BAM!", "THWIP!"
}

export interface GameState {
  id: string;
  roundNumber: number;
  phase: GamePhase;
  villainPhaseStep?: VillainPhaseStep;
  firstPlayerIndex: number;
  activePlayerIndex: number;
  players: PlayerState[];
  villain: VillainState;
  mainScheme: MainSchemeState;
  sideSchemes: SideSchemeState[];
  encounterDeck: CardInstance[];
  encounterDiscard: CardInstance[];
  accelerationTokens: number;
  activeBoostCard?: CardInstance;
  winner: 'HEROES' | 'VILLAIN' | null;
  log: GameLogEntry[];
}
