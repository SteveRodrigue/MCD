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
import { AbilityStep, AbilityCost, StepGate, CardAbility } from './abilities';

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
  ownerId?: string; // Player ID of card owner for cross-player control / attachments (RR v1.8 p. 11)
  activeStatModifiers?: ActiveStatModifier[]; // Temporary stat modifiers (e.g. Vision 01068)
  /**
   * Facedown boost cards this enemy holds for its next activation (#263, #291). They resolve first,
   * in the order they were dealt, and go to the encounter discard if the enemy leaves play.
   */
  facedownBoostCards?: CardInstance[];
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
  obligations: CardInstance[]; // Obligations given to this player, displayed in the Threat Zone (Issue #158)
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
  activeCostReductions?: ActiveCostReduction[];
  /** Active temporary stat modifier auras (e.g. Lead from the Front 01070) */
  activeStatModifiers?: ActiveStatModifier[];
  activeTraitModifiers?: ActiveTraitModifier[];
  dealtEncounterCards: CardInstance[]; // Face-down cards dealt in Step 4
  setAsideCards: CardInstance[]; // Set-aside nemesis cards
}

export type Duration = 'PHASE' | 'ROUND' | 'TURN';

export interface ActiveStatModifier {
  id?: string;
  stat: 'ATTACK' | 'THWART' | 'DEFENSE' | 'RECOVERY';
  amount: number;
  duration: Duration;
  sourceCardName?: string;
  sourceCardCode?: string;
}

/**
 * A trait granted by an effect step (not a CONSTANT ability). With a `duration` it expires like a
 * stat modifier; without one it lasts while the source card stays in play (#131).
 */
export interface ActiveTraitModifier {
  trait: string;
  duration?: Duration;
  sourceInstanceId?: string;
  sourceCardName?: string;
  sourceCardCode?: string;
}

export interface ActiveCostReduction {
  id: string;
  sourceCardName: string;
  sourceCardCode?: string;
  amount: number;
  cardFilter?: any;
  duration: Duration;
  appliesTo: 'NEXT_CARD';
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
  /** Facedown boost cards held for the villain's next activation (see `CardInstance.facedownBoostCards`). */
  facedownBoostCards?: CardInstance[];
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

/** A player Setup ability (RR v1.8 Appendix II step 16) that has not been resolved yet. */
export interface PendingSetupAbility {
  playerId: string;
  abilityId: string;
  sourceCardCode: string;
  /** Set when the source is a tableau card; absent for the identity card. */
  sourceInstanceId?: string;
}

export interface SetupState {
  stage: 'SCENARIO_SETUP' | 'MULLIGAN_PHASE' | 'PLAYER_SETUP' | 'GAME_READY';
  mulliganCompleted: Record<string, boolean>; // playerId -> boolean
  /** Step 16 queue, in player order; resolved one ability at a time (decisions pause it). */
  pendingSetupAbilities?: PendingSetupAbility[];
}

export enum VillainPhaseStep {
  MAIN_SCHEME_THREAT = 'MAIN_SCHEME_THREAT',
  VILLAIN_ACTIVATIONS = 'VILLAIN_ACTIVATIONS',
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
  params?: Record<string, string | number | boolean | string[]>;
  onomatopoeia?: string; // e.g. "POW!", "BAM!", "THWIP!", "CLANG!"
  text?: string;
}

export interface DecisionPromptOption {
  id: string;
  label: string;
  description?: string;
  cardCode?: string;
  cardName?: string;
  statusBadges?: {
    isTough?: boolean;
    retaliate?: number;
    hasOverkill?: boolean;
    hasPiercing?: boolean;
  };
  icon?: 'punch' | 'shield' | 'attack' | 'zap';
  effect: string;
  params?: Record<string, unknown>;
  requiresPayment?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  /** Optional multi-step effect list run when this option is chosen (PLAYER_CHOICE) */
  steps?: AbilityStep[];
  /** Availability gate re-evaluated whenever the prompt becomes the active head (e.g. IF_FORM) */
  gate?: StepGate;
  gateParams?: Record<string, unknown>;
  /** Cost checked for availability and paid on selection (e.g. exhaustCard: SELF_IDENTITY) */
  cost?: AbilityCost;
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
  | 'INITIATION'
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

/** The friendly character an enemy attack damaged (JSON-safe; resolved live by DAMAGED_CHARACTER). */
export interface DamagedCharacter {
  type: 'HERO' | 'ALLY';
  playerId: string;
  allyInstanceId?: string;
}

/** A boost ability waiting for the activation's damage (step 6) before it can resolve. */
export interface DeferredBoostAbility {
  ability: CardAbility;
  sourceCardInstance: CardInstance;
}

/**
 * The boost cards of the running activation (attack or scheme), waiting to be turned up one at a
 * time (RR v1.8 Boost). Lives on `GameState` so an effect that adds a boost card to the activation
 * (`GIVE_ADDITIONAL_BOOST_CARD`) reaches the same queue in an attack and in a scheme.
 */
export interface BoostResolution {
  queue: CardInstance[];
  /** Instance id of the activating enemy ("the villain", "the activating enemy"). */
  activatorInstanceId: string;
  targetPlayerId: string;
}

export interface AttackExecutionContext {
  attackId: string;
  attackerType: 'VILLAIN' | 'MINION';
  attackerCard?: CardInstance;
  /** Instance id of the attacking villain, fixed at initiation so a mid-activation active counter move does not change the attacker (MC03 rules insert p.6). */
  attackerVillainId?: string;
  targetPlayerId: string;
  phase: CombatPhase;
  baseAttack: number;
  revealedBoostCards?: CardInstance[];
  totalBoostIcons: number;
  defender?: DefenderDeclaration;
  heroDefended?: boolean;
  defenseValue?: number;
  hasOverkill?: boolean;
  hasPiercing?: boolean;
  damagePreventionAmount?: number;
  pendingDamage?: number;
  acceptOptionalTriggers?: boolean;
  synchronousPolicy?: 'HERO_IF_READY' | 'ALLY_CHUMP_BLOCK' | 'AUTO_OPTIMAL' | 'TAKE_UNDEFENDED';
  finalDamage?: number;
  /** Boost abilities gated on the activation's damage; resolved after step 6 (#221). */
  deferredBoostAbilities?: DeferredBoostAbility[];
  /** Who took the activation's damage, recorded in step 6 for DAMAGED_CHARACTER. */
  damagedCharacter?: DamagedCharacter;
  cancelled?: boolean;
  cancellationReason?: string;
}

export interface CombatResolutionSummary {
  id?: string;
  attackerName: string;
  attackerCode?: string;
  attackerType: 'VILLAIN' | 'MINION';
  targetPlayerId: string;
  targetHeroName?: string;
  defenderType?: 'HERO' | 'ALLY' | 'UNDEFENDED';
  defenderName?: string;
  baseAttack: number;
  boostCards: CardInstance[];
  totalBoostIcons: number;
  defenseValue: number;
  finalDamage: number;
  /** The friendly character that took the damage, for later steps of the ability that started the attack (#295). */
  damagedCharacter?: DamagedCharacter;
  hasOverkill?: boolean;
  hasPiercing?: boolean;
}

export type VillainPhaseStepEventType =
  | 'THREAT_PLACED'
  | 'VILLAIN_ATTACK'
  | 'VILLAIN_SCHEME'
  | 'MINION_ATTACK'
  | 'MINION_SCHEME'
  | 'DEAL_ENCOUNTER_CARD'
  | 'REVEAL_ENCOUNTER_CARD'
  | 'PASS_FIRST_PLAYER';

export interface VillainPhaseStepEvent {
  type: VillainPhaseStepEventType;
  step: VillainPhaseStep;
  sourceName?: string;
  targetPlayerId?: string;
  targetName?: string;
  amount?: number;
  description: string;
  onomatopoeia?: string;
  combatOutcome?: CombatResolutionSummary;
  card?: CardInstance;
}

export type DecisionPromptKind = 'SINGLE_CHOICE' | 'DISTRIBUTE_POINTS' | 'MULTI_SELECT_TARGETS';

export interface TargetAllocationItem {
  instanceId: string;
  name: string;
  cardCode?: string;
  cardType: 'hero' | 'alter_ego' | 'ally' | 'villain' | 'minion' | 'main_scheme' | 'side_scheme';
  controllerPlayerId?: string;
  controllerName?: string;
  currentValue?: number;
  maxValue?: number;
  allocationCap?: number;
  hasTough?: boolean;
  statusCards?: StatusCard[];
  isEligible?: boolean;
  ineligibilityReason?: string;
  imageUrl?: string;
}

export interface DistributionPromptConfig {
  totalBudget: number;
  effectiveBudget: number;
  budgetLabel: string;
  unitSingular: string;
  unitPlural: string;
  exactMatchRequired: boolean;
  canCancel: boolean;
  shortfallNotice?: string;
  allocationDomain: 'DAMAGE' | 'THREAT_REMOVAL' | 'HEAL' | 'COUNTERS' | 'EXHAUST';
  targets: TargetAllocationItem[];
}

export interface PendingDecisionPrompt {
  promptId: string;
  playerId: string;
  title: string;
  description: string;
  sourceCardName: string;
  sourceCardCode?: string;
  sourceCardInstanceId?: string;
  triggerSourceName?: string;
  triggerSourceCode?: string;
  triggerSourceCard?: NormalizedCard;
  triggerType?: string;
  options: DecisionPromptOption[];
  /** When set, the source obligation is discarded once the chosen option has resolved (Issue #158) */
  completion?: 'DISCARD_SOURCE_OBLIGATION';
  /**
   * Cards discarded by the steps that ran before this choice in the same ability. Handed back to the
   * chosen option so its amounts can read them ("X is 1 more than the boost icons on the discarded
   * card").
   */
  discardedCards?: CardInstance[];
  /**
   * Set when the step that opened this prompt was the final step of a sequence (e.g. a Wakanda
   * Forever! finisher). Handed back to the chosen option so its finisher bonus still applies.
   */
  isFinalStep?: boolean;
  revealedCards?: RevealedCardDisplay[];
  isVoluntary?: boolean;
  /**
   * Multi-select prompt: the player confirms between `min` and `max` options (`SEARCH` with
   * `takeCount` / `minimumTake`). `distinctBy: 'NAME'` forbids two options with the same card name.
   */
  selection?: { min: number; max: number; distinctBy?: 'NAME' };
  parentFrameId?: string;
  queuePosition?: number;
  totalQueued?: number;
  kind?: DecisionPromptKind;
  distributionConfig?: DistributionPromptConfig;
  incomingDamage?: number;
  attackerCardCode?: string;
  attackerName?: string;
  hasOverkill?: boolean;
  hasPiercing?: boolean;
  defenderCardCode?: string;
  defenderName?: string;
  defenderType?: 'HERO' | 'ALLY' | 'UNDEFENDED';
  targetCardCode?: string;
  targetName?: string;
  targetPlayerName?: string;
  targetHeroName?: string;
  targetCurrentHp?: number;
  targetMaxHp?: number;
  targetHasTough?: boolean;
  targetRetaliate?: number;
  preventAmount?: number | 'ALL';
}

export interface EncounterExecutionContext {
  encounterInstanceId: string;
  encounterCard: CardInstance;
  targetPlayerId: string;
  cancelled?: boolean;
  cancellationReason?: string;
  /** The cancel also discards the card: it does not enter play ("cancel its effects and discard it"). */
  discardCard?: boolean;
  /** The card already surged during this reveal (keyword or effect): it cannot surge twice. */
  surged?: boolean;
}

/**
 * A multi-step ability sequence that paused because one of its steps opened a decision prompt.
 * The remaining steps resume once the prompt queue is empty (#248).
 */
/**
 * A threat placement paused while its interrupt prompts are answered (#266). `amount` is the live
 * amount left after the interrupts resolved so far.
 */
export interface PendingThreatPlacement {
  id: string;
  request: {
    targetType: 'main_scheme' | 'side_scheme';
    targetInstanceId?: string;
    amount: number;
    sourceType:
      | 'VILLAIN_PHASE_STEP_1'
      | 'VILLAIN_SCHEME'
      | 'MINION_SCHEME'
      | 'CARD_EFFECT'
      | 'INCITE'
      | 'HAZARD';
    sourceEntityName?: string;
    sourcePlayerId?: string;
    boostIcons?: number;
  };
  amount: number;
}

export interface PendingSequence {
  sequenceId?: string;
  remainingSteps: AbilityStep[];
  context: Record<string, any>;
  previousResult?: Record<string, any>;
  stepResultsMap?: Record<string, any>;
  onomatopoeias?: string[];
  anyStepMutated?: boolean;
  /** The last step started an enemy attack that was still open: its damage facts join the previous result on resume (#295). */
  awaitsAttackOutcome?: boolean;
}

export interface PendingActivation {
  /**
   * ENGAGED_MINIONS stands for step 2b of one player: it yields the minions engaged with that
   * player at the moment it is reached, so a minion engaged earlier in step 2 still activates.
   */
  type: 'VILLAIN' | 'MINION' | 'ENGAGED_MINIONS';
  playerId: string;
  minionInstanceId?: string;
  /** ENGAGED_MINIONS only: instance ids that already activated in this step 2b. */
  activatedMinionIds?: string[];
}

export interface GameOptions {
  /**
   * When true (default), abilities and actions with only 1 legal choice resolve automatically
   * without opening a decision prompt. When false, prompts always open for inspection.
   */
  autoResolveUnambiguous?: boolean;
  villainPhaseStepping?: boolean;
}

export interface GameState {
  id: string;
  roundNumber: number;
  phase: GamePhase;
  setupState?: SetupState;
  villainPhaseStep?: VillainPhaseStep;
  options?: GameOptions;

  /** Structured FIFO Prompt Queue (ADR-0032) */
  pendingDecisionQueue?: PendingDecisionPrompt[];
  /** Execution Frame Stack (ADR-0032) */
  executionStack?: ExecutionFrame[];

  /**
   * @deprecated Use `state.pendingDecisionQueue` and `peekDecisionPrompt(state)` per ADR-0032.
   */
  pendingDecisionPrompt?: PendingDecisionPrompt;
  /** Ordered enemy activation queue for Villain Phase (ADR-0068) */
  pendingActivations?: PendingActivation[];
  /** Ordered multi-step ability sequences paused on a decision prompt (#248) */
  pendingSequences?: PendingSequence[];
  /** Threat placements waiting for their interrupt prompts to be answered (#266) */
  pendingThreatPlacements?: PendingThreatPlacement[];
  /** Ordered player queue for End of Player Phase voluntary cleanup (RR v1.8 p. 23) */
  pendingCleanUpPlayerIds?: string[];
  scenarioId?: string;
  scenarioCardCode?: string;
  difficulty?: DifficultyMode;
  heroicLevel?: number;
  firstPlayerIndex: number;
  activePlayerIndex: number;
  players: PlayerState[];
  /** Players removed from the game by elimination (#246, RR v1.8 Player Elimination); `players` holds only who is still playing. */
  eliminatedPlayers?: PlayerState[];

  /**
   * Multi-Villain Collection & Active Counter (#194, ADR-0076). `villains` is canonical.
   * `activeVillainId` is the instanceId of the villain holding the active counter (MC03 rules
   * insert p.6): "the villain" in card text means this villain. When unset, the first villain
   * is active. Read via `getActiveVillain`; write via `setActiveVillain` / `replaceVillain` /
   * `removeVillain`.
   */
  villains: VillainState[];
  activeVillainId?: string;

  /** Multi-Main Scheme Collection & Active Pointer */
  mainSchemes: MainSchemeState[];
  activeMainSchemeIndex: number;

  /**
   * Legacy / direct reference to active villain for backwards-compatibility. Diverges from
   * `villains[]` after the JSON clone in `dispatchAction`; use `getActiveVillain` (#194, #215).
   *
   * @deprecated Use `getActiveVillain(state)` / `getVillainsInPlay(state)` (ADR-0076). Removal: #215.
   */
  villain: VillainState;
  /**
   * Legacy / direct reference to active main scheme for backwards-compatibility. Use
   * `getActiveMainScheme` (#194, #215).
   *
   * @deprecated Use `getActiveMainScheme(state)` / `getMainSchemesInPlay(state)` (ADR-0076). Removal: #215.
   */
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
  /** Set while an activation turns up its boost cards; cleared when the last one resolved. */
  activeBoostResolution?: BoostResolution;
  activeAttackContext?: AttackExecutionContext;
  activeEncounterContext?: EncounterExecutionContext;
  lastCombatOutcome?: CombatResolutionSummary;
  villainPhaseStepEvent?: VillainPhaseStepEvent;
  winner: 'HEROES' | 'VILLAIN' | null;
  log: GameLogEntry[];
  /** Last engine diagnostic error recorded (e.g. infinite trigger loop, invariant violation) */
  lastError?: {
    type: 'INFINITE_LOOP' | 'INVARIANT_VIOLATION' | string;
    message: string;
    formattedDetails?: string;
  };
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
 * The number the per-player icon multiplies by: the players who started the scenario. An
 * eliminated player still counts (RR v1.8 Per Player Icon, #246).
 */
export function getPerPlayerCount(state: GameState): number {
  return state.players.length + (state.eliminatedPlayers?.length ?? 0);
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
 * Accessor returning the active villain (the one holding the active counter) from GameState.
 * "The villain" in card text and the villain phase activation resolve to this entity.
 * Falls back to the first villain when no active id is recorded, and to the legacy pointer only
 * when the collection is empty.
 */
export function getActiveVillain(state: GameState): VillainState {
  if (state.villains && state.villains.length > 0) {
    const active = state.activeVillainId
      ? state.villains.find((v) => v.instanceId === state.activeVillainId)
      : undefined;
    return active || state.villains[0];
  }
  return state.villain;
}

/**
 * Every villain in play, active or not. Players may attack any villain (MC03 rules insert p.6).
 */
export function getVillainsInPlay(state: GameState): VillainState[] {
  return state.villains || [];
}

/**
 * Moves the active counter to the villain with the given instance id and re-syncs the legacy
 * `state.villain` pointer (by reference) until it is removed (#215).
 */
export function setActiveVillain(state: GameState, villainInstanceId: string): void {
  const villain = (state.villains || []).find((v) => v.instanceId === villainInstanceId);
  if (!villain) {
    throw new Error(`Cannot activate villain '${villainInstanceId}': not in play.`);
  }
  state.activeVillainId = villainInstanceId;
  state.villain = villain;
}

/**
 * Replaces a villain in place (e.g. a stage advance). The active counter follows the
 * replacement when the replaced villain held it.
 */
export function replaceVillain(
  state: GameState,
  villainInstanceId: string,
  next: VillainState,
): void {
  const villains = state.villains || [];
  const index = villains.findIndex((v) => v.instanceId === villainInstanceId);
  if (index < 0) {
    throw new Error(`Cannot replace villain '${villainInstanceId}': not in play.`);
  }
  const wasActive = getActiveVillain(state) === villains[index];
  villains[index] = next;
  state.villains = villains;
  if (wasActive && next.instanceId) {
    state.activeVillainId = next.instanceId;
  }
  state.villain = getActiveVillain(state);
}

/**
 * Removes a villain from play (final-stage defeat). When it held the active counter, the
 * scenario-supplied `pickSuccessor` chooses the next active villain (e.g. MC03: the villain whose
 * side scheme has the most threat); the first remaining villain is the default.
 */
export function removeVillain(
  state: GameState,
  villainInstanceId: string,
  pickSuccessor?: (remaining: VillainState[]) => VillainState | undefined,
): void {
  const villains = state.villains || [];
  const index = villains.findIndex((v) => v.instanceId === villainInstanceId);
  if (index < 0) {
    throw new Error(`Cannot remove villain '${villainInstanceId}': not in play.`);
  }
  const wasActive = getActiveVillain(state) === villains[index];
  const remaining = villains.filter((_, i) => i !== index);
  state.villains = remaining;
  if (wasActive) {
    const successor = pickSuccessor?.(remaining) ?? remaining[0];
    state.activeVillainId = successor?.instanceId;
  }
  if (remaining.length > 0) {
    state.villain = getActiveVillain(state);
  }
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
 * Every main scheme in play.
 */
export function getMainSchemesInPlay(state: GameState): MainSchemeState[] {
  return state.mainSchemes || [];
}

/**
 * Makes `next` the active main scheme: replaces the active entry (a stage advance) or installs it
 * as the sole main scheme during setup, and re-syncs the legacy `state.mainScheme` pointer.
 */
export function replaceActiveMainScheme(state: GameState, next: MainSchemeState): void {
  const schemes = state.mainSchemes || [];
  if (schemes.length === 0) {
    state.mainSchemes = [next];
    state.activeMainSchemeIndex = 0;
  } else {
    const index = state.activeMainSchemeIndex ?? 0;
    schemes[schemes[index] ? index : 0] = next;
    state.mainSchemes = schemes;
  }
  state.mainScheme = getActiveMainScheme(state);
}

/**
 * Deep-clones a GameState. The JSON round trip splits the legacy `villain` / `mainScheme`
 * pointers from their collection entries, so they are re-linked to the active entities of the
 * clone (#194; removed with the legacy fields in #215).
 */
export function cloneGameState(state: GameState): GameState {
  const clone: GameState = JSON.parse(JSON.stringify(state));
  if (clone.villains && clone.villains.length > 0) clone.villain = getActiveVillain(clone);
  if (clone.mainSchemes && clone.mainSchemes.length > 0) {
    clone.mainScheme = getActiveMainScheme(clone);
  }
  return clone;
}

/**
 * Finds a villain by card code or instanceId across state.villains.
 */
export function getVillainById(state: GameState, idOrCode: string): VillainState | undefined {
  return (
    (state.villains || []).find((v) => v.card?.code === idOrCode || v.instanceId === idOrCode) ||
    (state.villain?.card?.code === idOrCode ? state.villain : undefined)
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
