export type AbilityTiming =
  | 'FORCED_INTERRUPT'
  | 'INTERRUPT'
  | 'HERO_INTERRUPT'
  | 'HERO_ACTION'
  | 'ALTER_EGO_ACTION'
  | 'ACTION'
  | 'RESOURCE'
  | 'FORCED_RESPONSE'
  | 'RESPONSE';

export type TriggerType =
  | 'VILLAIN_INITIATES_ATTACK'
  | 'TAKE_ATTACK_DAMAGE'
  | 'CARD_PLAYED'
  | 'MINION_DEFEATED'
  | 'TREACHERY_REVEALED'
  | 'MAIN_SCHEME_ADVANCED';

export type EffectType =
  | 'DRAW_CARDS'
  | 'DEAL_DAMAGE'
  | 'PREVENT_DAMAGE'
  | 'HEAL_DAMAGE'
  | 'GENERATE_RESOURCE'
  | 'REMOVE_THREAT';

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
