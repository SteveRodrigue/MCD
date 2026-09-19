import { Keyword } from './enums';
import type {
  PlayRequirements,
  StepCondition,
  TriggerFilter,
  UniversalCardFilter,
} from '../../data/supplemental/schema';
export type {
  StepCondition,
  DynamicValueSource,
  DrawCardsLimit,
  DrawCardsParams,
  TriggerFilter,
} from '../../data/supplemental/schema';

export type AbilityTiming =
  | 'WHEN_REVEALED'
  | 'BOOST'
  | 'FORCED_INTERRUPT'
  | 'INTERRUPT'
  | 'HERO_INTERRUPT'
  | 'ALTER_EGO_INTERRUPT'
  | 'HERO_ACTION'
  | 'ALTER_EGO_ACTION'
  | 'ACTION'
  | 'RESOURCE'
  | 'HERO_RESOURCE'
  | 'ALTER_EGO_RESOURCE'
  | 'FORCED_RESPONSE'
  | 'RESPONSE'
  | 'HERO_RESPONSE'
  | 'ALTER_EGO_RESPONSE'
  | 'CONSTANT'
  | 'SPECIAL'
  | 'SETUP';

export type TriggerType =
  | 'WHEN_REVEALED'
  | 'WHEN_BOOST_CARD_REVEALED'
  | 'BOOST'
  | 'BOOST_STAR_RESOLVED'
  | 'ENEMY_INITIATES_ATTACK'
  | 'DAMAGE_WOULD_BE_TAKEN'
  | 'CARD_PLAYED'
  | 'ENTERS_PLAY'
  | 'MINION_ENTERS_PLAY'
  | 'TREACHERY_REVEALED'
  | 'CHARACTER_DEFEATED'
  | 'SCHEME_DEFEATED'
  | 'ATTACHED_ENEMY_ATTACKS'
  | 'THREAT_WOULD_BE_PLACED'
  | 'MAIN_SCHEME_ADVANCED'
  | 'BASIC_ATTACK_PERFORMED'
  | 'ATTACK_DEFENDED'
  | 'ATTACK_RESOLVED'
  | 'THWART_RESOLVED'
  | 'RESOURCE_SPENT'
  | 'MINION_ATTACKED'
  | 'ATTACK'
  | 'ROUND_BEGAN'
  | 'ROUND_ENDED'
  | 'PLAYER_PHASE_BEGAN'
  | 'PLAYER_PHASE_ENDED'
  | 'VILLAIN_PHASE_BEGAN'
  | 'VILLAIN_PHASE_ENDED'
  | 'CARD_DISCARDED'
  | 'CARD_LEFT_PLAY'
  | 'DEFEATED'
  | 'DAMAGE_TAKEN'
  | 'THREAT_PLACED'
  | 'FORM_CHANGED'
  | 'STATUS_REMOVED';

export type EffectType =
  | 'DRAW'
  | 'DEAL_DAMAGE'
  | 'DISTRIBUTE_AMOUNT'
  | 'PREVENT_DAMAGE'
  | 'PREVENT_THREAT'
  | 'HEAL_DAMAGE'
  | 'GENERATE_RESOURCE'
  | 'REMOVE_THREAT'
  | 'ADD_STATUS'
  | 'DISCARD_TOP_DECK_FILTER'
  | 'CANCEL_WHEN_REVEALED'
  | 'CANCEL_ATTACK_AND_STUN'
  | 'HEAL_DAMAGE_WITH_SURGE'
  | 'ADD_STATUS_WITH_SURGE'
  | 'FORM_BRANCH'
  | 'VILLAIN_SCHEMES_IMMEDIATELY'
  | 'VILLAIN_ATTACKS_IMMEDIATELY'
  | 'CHOICE_DAMAGE_OR_THREAT'
  | 'REDUCE_NEXT_CARD_COST'
  | 'CONVERT_THREAT_TO_DAMAGE'
  | 'SEARCH'
  | 'REMOVE_STATUS'
  | 'CHANGE_FORM_DRAW_TO_HAND_SIZE'
  | 'THW_BONUS_PER_SIDE_SCHEME'
  | 'DISCARD_SELF'
  | 'DISCARD_UPGRADE_OR_SUPPORT_OR_SURGE'
  | string;

export interface AbilityCost {
  exhaustSelf?: boolean;
  exhaustCard?: string;
  discardSelf?: boolean;
  spendCounters?: {
    counterType?: string;
    amount: number;
    target?: 'SELF' | 'IDENTITY';
  };
  resourceCost?: number | Record<string, number>;
  resources?: string[];
  requirePrinted?: boolean;
  discardCard?: {
    count?: number;
    maxCount?: number;
    from: 'HAND' | 'DECK' | 'PLAY';
    filter?: UniversalCardFilter;
    mode?: 'CHOSEN' | 'RANDOM';
  };
  discardFromHand?: number;
  damageHero?: number;
  damageSelf?: number;
  takeDamage?: number;
  selfDamage?: number;
  heal?: {
    amount: number;
    target?: 'SELF' | 'TARGET';
  };
}

export type ConditionGate =
  | 'ALWAYS'
  | 'THEN'
  | 'IF_PREVIOUS_SUCCESS'
  | 'IF_AMOUNT_ZERO'
  | 'IF_ZERO_HEALED'
  | 'IF_FAILED'
  | 'IF_ALREADY_HAS_STATUS'
  | 'IF_RESOURCE_MATCH'
  | 'IF_CONDITION_MET'
  | 'IF_CARD_IN_PLAY'
  | 'IF_CARD_NOT_IN_PLAY';

export interface StepResolutionResult {
  success: boolean;
  mutatedState: boolean;
  value?: number;
  selectedCardInstanceIds?: string[];
  targetId?: string;
  conditionMet?: boolean;
  discardedCards?: import('./state').CardInstance[];
}

export interface SequenceExecutionContext {
  previousResult?: StepResolutionResult;
  collectedCardInstanceIds?: string[];
  initiatingPlayerId?: string;
  sourceInstanceId?: string;
  resourcesSpent?: string[];
}

export interface AbilityStep {
  id?: string;
  effect: EffectType;
  target?: string;
  gateParams?: Record<string, unknown>;
  effectParams?: Record<string, unknown>;
  gate?: ConditionGate;
  filter?: Record<string, unknown>;
  condition?: StepCondition;
}

export interface CardAbility {
  id: string;
  timing: AbilityTiming;
  trigger?: TriggerType;
  triggerFilter?: TriggerFilter;
  zone?: 'HAND' | 'PLAY' | 'DISCARD';
  limit?: 'ONCE_PER_ROUND' | 'ONCE_PER_PHASE';
  tags?: string[];
  cost?: AbilityCost;
  steps: AbilityStep[];
}

export interface CardUsesDefinition {
  type?: string;
  counterType?: string;
  count: number;
  max?: number;
  discardOnEmpty?: boolean;
}

export interface CardAuditMetadata {
  createdAt?: string;
  updatedAt: string;
  reviewedAt: string;
  reviewedBy?: string;
  rulesVersion?: string;
  confidence?: number;
  originalText?: string;
  ambiguityFile?: string;
  comment?: string;
}

export interface CardEnrichment {
  noSupplementalNeeded?: boolean;
  cardName?: string;
  playRequirements?: PlayRequirements;
  audit?: CardAuditMetadata;
  isLandscape?: boolean;
  attackCost?: number;
  thwartCost?: number;
  maxPerPlayer?: number;
  playUnderAnyPlayerControl?: boolean;
  uses?: CardUsesDefinition;
  /** Explicit keywords on the card (overrides text loader deductions) */
  keywords?: (Keyword | string)[];
  /** Canonical English traits (overrides text loader deductions) */
  traits?: string[];
  /** Restricted slots count (e.g. 2 for heavy weapons) */
  restrictedSlots?: number;
  /** Additional boost cards for villain attacks */
  additionalBoostCards?: number;
  /** Numeric value for the printed 'Victory X' keyword (RR v1.8 p. 30) - paired with keywords: [Keyword.VICTORY] */
  victoryPoints?: number;
  abilities?: CardAbility[];
}
