import { Keyword } from './enums';

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
  | 'VILLAIN_INITIATES_ATTACK'
  | 'TAKE_ATTACK_DAMAGE'
  | 'TAKE_DAMAGE'
  | 'CARD_PLAYED'
  | 'MINION_DEFEATED'
  | 'MINION_DEFEATED_BY_ATTACK'
  | 'ENEMY_DEFEATED_BY_HERO_ATTACK'
  | 'MINION_ENTERS_PLAY'
  | 'TREACHERY_REVEALED'
  | 'ATTACHED_MINION_DEFEATED'
  | 'ATTACHED_ENEMY_ATTACKS'
  | 'THREAT_WOULD_BE_PLACED'
  | 'MAIN_SCHEME_ADVANCED'
  | 'FORM_CHANGED_TO_HERO'
  | 'FORM_CHANGED_TO_ALTER_EGO'
  | 'BASIC_ATTACK_PERFORMED'
  | 'HERO_DEFENDED_ATTACK'
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
  | 'ROUND_END'; // backward-compatible alias

export type EffectType =
  | 'DRAW_CARDS'
  | 'DEAL_DAMAGE'
  | 'PREVENT_DAMAGE'
  | 'HEAL_DAMAGE'
  | 'GENERATE_RESOURCE'
  | 'REMOVE_THREAT'
  | 'ADD_STATUS'
  | 'DISCARD_TOP_DECK_FILTER'
  | 'CANCEL_WHEN_REVEALED'
  | 'CANCEL_ATTACK_AND_STUN'
  | 'HEAL_DAMAGE_WITH_SURGE'
  | 'ADD_STATUS_WITH_SURGE'
  | 'FORM_BRANCH_VILLAIN_ATTACK_OR_SURGE'
  | 'VILLAIN_SCHEMES_IMMEDIATELY'
  | 'VILLAIN_ATTACKS_IMMEDIATELY'
  | 'EXPLOSION_EFFECT'
  | 'CHOICE_DAMAGE_OR_THREAT'
  | 'REDUCE_NEXT_CARD_COST'
  | 'CONVERT_THREAT_TO_DAMAGE'
  | 'SEARCH_AND_REVEAL_SIDE_SCHEME'
  | 'CHANGE_FORM_DRAW_TO_HAND_SIZE'
  | 'THW_BONUS_PER_SIDE_SCHEME'
  | 'NICK_FURY_CHOICE'
  | 'DISCARD_SELF'
  | 'DISCARD_UPGRADE_OR_SUPPORT_OR_SURGE'
  | string;

export interface AbilityCost {
  exhaustSelf?: boolean;
  exhaustCard?: string;
  discardSelf?: boolean;
  removeCounter?: number;
  spendCounter?: number;
  spendTokens?: { type: string; count: number };
  spendCounters?: {
    counterType?: string;
    amount: number;
    target?: 'SELF' | 'IDENTITY';
  };
  resourceCost?: number | Record<string, number>;
  resources?: string[];
  discardCard?: { count?: number; maxCount?: number; from: 'HAND' | 'DECK' | 'PLAY' };
  discardFromHand?: number;
  damageHero?: number;
  damageSelf?: number;
  takeDamage?: number;
  selfDamage?: number;
  costCheck?: string;
}

export type ConditionGate =
  | 'ALWAYS'
  | 'THEN'
  | 'IF_PREVIOUS_SUCCESS'
  | 'IF_AMOUNT_ZERO'
  | 'IF_ZERO_HEALED'
  | 'IF_FAILED'
  | 'IF_ALREADY_HAS_STATUS'
  | 'IF_RESOURCE_MATCH';

export interface StepResolutionResult {
  success: boolean;
  mutatedState: boolean;
  value?: number;
  selectedCardInstanceIds?: string[];
  targetId?: string;
  conditionMet?: boolean;
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
  params?: Record<string, unknown>;
  gate?: ConditionGate;
  filter?: Record<string, unknown>;
}

export interface CardAbility {
  id: string;
  timing: AbilityTiming;
  trigger?: TriggerType;
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
  reconstructedText?: string;
  ambiguityFile?: string;
}

export interface CardEnrichment {
  noSupplementalNeeded?: boolean;
  cardName?: string;
  comment?: string;
  audit?: CardAuditMetadata;
  mechanicSteps?: string[];
  isLandscape?: boolean;
  attackCost?: number;
  thwartCost?: number;
  maxPerPlayer?: number;
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
