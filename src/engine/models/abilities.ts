export type AbilityTiming =
  | 'FORCED_INTERRUPT'
  | 'INTERRUPT'
  | 'HERO_INTERRUPT'
  | 'HERO_ACTION'
  | 'ALTER_EGO_ACTION'
  | 'ACTION'
  | 'RESOURCE'
  | 'FORCED_RESPONSE'
  | 'RESPONSE'
  | 'CONSTANT'
  | 'SPECIAL'
  | 'SETUP';

export type TriggerType =
  | 'WHEN_REVEALED'
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
  | 'ROUND_END';

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
  | 'THW_BONUS_PER_SIDE_SCHEME'
  | 'NICK_FURY_CHOICE'
  | 'DISCARD_SELF'
  | 'DISCARD_UPGRADE_OR_SUPPORT_OR_SURGE'
  | string;

export interface AbilityCost {
  exhaustSelf?: boolean;
  discardSelf?: boolean;
  removeCounter?: number;
  resourceCost?: number | Record<string, number>;
  discardFromHand?: number;
  takeDamage?: number;
  selfDamage?: number;
}

export interface CardAbility {
  id: string;
  timing: AbilityTiming;
  trigger?: TriggerType;
  zone?: 'HAND' | 'PLAY' | 'DISCARD';
  limit?: 'ONCE_PER_ROUND' | 'ONCE_PER_PHASE';
  tags?: string[];
  cost?: AbilityCost;
  effect: EffectType;
  filter?: Record<string, unknown>;
  params?: Record<string, unknown>;
}

export interface CardUsesDefinition {
  type: string;
  count: number;
  max?: number;
  discardOnEmpty?: boolean;
}

export interface CardEnrichment {
  cardName?: string;
  comment?: string;
  isLandscape?: boolean;
  uses?: CardUsesDefinition;
  abilities?: CardAbility[];
}
