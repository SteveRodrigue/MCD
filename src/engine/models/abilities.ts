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
  | 'CONSTANT';

export type TriggerType =
  | 'WHEN_REVEALED'
  | 'BOOST_STAR_RESOLVED'
  | 'VILLAIN_INITIATES_ATTACK'
  | 'TAKE_ATTACK_DAMAGE'
  | 'CARD_PLAYED'
  | 'MINION_DEFEATED'
  | 'TREACHERY_REVEALED'
  | 'ATTACHED_MINION_DEFEATED'
  | 'ATTACHED_ENEMY_ATTACKS'
  | 'THREAT_WOULD_BE_PLACED'
  | 'MAIN_SCHEME_ADVANCED';

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
  | 'THW_BONUS_PER_SIDE_SCHEME';

export interface AbilityCost {
  exhaustSelf?: boolean;
  discardSelf?: boolean;
  removeCounter?: number;
  resourceCost?: number;
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
  params?: Record<string, unknown>;
}

export interface CardUsesDefinition {
  type: string;
  count: number;
  discardOnEmpty?: boolean;
}

export interface CardEnrichment {
  uses?: CardUsesDefinition;
  abilities?: CardAbility[];
}
