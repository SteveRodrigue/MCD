import type { EffectType } from './schema';

/**
 * Allowed `effectParams` keys per effect primitive (Issue #230).
 *
 * Single source of truth for the guard test in tests/data/effect-params-keys.test.ts.
 * The Card Editor registry (src/ui/components/editor/effect-parameter-registry.ts)
 * must expose exactly these keys per effect; tests/ui/effect-parameter-registry.test.ts enforces it.
 * `AbilityStepSchema.effectParams` stays a free-form record; this table is validated by a data test only.
 */
export const EFFECT_PARAM_KEYS: Record<EffectType, readonly string[]> = {
  ADD_ACCELERATION: ['amount'],
  ADD_COUNTERS: ['amount', 'counterType', 'target'],
  ADD_STATUS: ['status', 'target'],
  ADD_THREAT: ['amount', 'cardCode', 'condition', 'perPlayer', 'target'],
  ADD_TRAIT: ['duration', 'target', 'trait'],
  ATTACHMENT_DAMAGE_SHIELD: ['maxAbsorb'],
  ATTACH_FACEDOWN_CARDS_FROM_HAND: [],
  ATTACH_TO_HOST: ['maxPerHost', 'target'],
  CANCEL_ATTACK: [],
  CANCEL_WHEN_REVEALED: [],
  CANCEL_WHEN_REVEALED_AND_REVEAL_ANOTHER: [],
  CANNOT_TAKE_DAMAGE: ['sourceCardType', 'sourceTrait', 'target'],
  CHANGE_FORM: ['form', 'optional'],
  DEAL_DAMAGE: ['amount', 'dynamicBonus', 'finisherBonus', 'target', 'targetPlayer'],
  DECLARE_DEFENDER: [],
  DISCARD: ['count', 'fallback', 'filter', 'matchingDestination', 'mode', 'source', 'target', 'untilFilter'],
  DISTRIBUTE_AMOUNT: ['allocationDomain', 'budget', 'targetScope'],
  DOUBLE_RESOURCE_FOR_ASPECT: ['aspect'],
  DRAW: ['count', 'dynamicBonus', 'limit', 'target', 'targetPlayerId'],
  ENEMY_ATTACKS: ['enemy', 'target'],
  EXECUTE_SPECIAL: ['sequenceOrder', 'specialId'],
  EXHAUST: ['filter', 'target'],
  FLIP_FORM: [],
  GENERATE_RESOURCE: ['amount', 'count', 'fromCard', 'resource'],
  GIVE_ADDITIONAL_BOOST_CARD: [],
  GRANT_ATTACK_KEYWORD: ['keyword'],
  GRANT_KEYWORD: ['amount', 'duration', 'keyword', 'target'],
  HEAL_DAMAGE: ['amount', 'target'],
  MODIFY_ALLY_LIMIT: ['amount', 'target'],
  MODIFY_HAND_SIZE: ['amount'],
  MODIFY_MAX_HEALTH: ['amount', 'target'],
  MODIFY_STAT: ['amount', 'atkBonus', 'duration', 'stat', 'target', 'targetPlayer', 'thwBonus'],
  PLACE_CARD_UNDER_HOST: [],
  PLAYER_CHOICE: ['description', 'isVoluntary', 'options', 'title'],
  PLAY_FROM_ZONE: ['control', 'costMode', 'costReduction', 'destination', 'filter', 'promptTitle', 'source'],
  PREVENT_DAMAGE: ['amount'],
  PREVENT_THREAT: ['amount', 'target'],
  PUT_INTO_PLAY: ['filter', 'from', 'reveal', 'target', 'to'],
  READY: ['filter', 'target'],
  REDUCE_NEXT_CARD_COST: ['amount', 'cardFilter', 'duration', 'target'],
  REMOVE_COUNTERS: ['amount', 'counterType', 'target'],
  REMOVE_COUNTERS_MATCHING_FILTER: ['amount', 'counterType', 'targetZone', 'traitFilter'],
  REMOVE_FROM_GAME: ['target'],
  REMOVE_STATUS: ['status', 'target'],
  REMOVE_THREAT: ['amount', 'distinctFrom', 'dynamicBonus', 'finisherBonus', 'target'],
  MODIFY_RESTRICTED_LIMIT: ['amount'],
  RETURN_TO_HAND: [],
  REVEAL_ENCOUNTER_CARD: [],
  SEARCH: ['autoSelectIfUnambiguous', 'distinctBy', 'filter', 'fromTop', 'lookCount', 'minimumTake', 'promptTitle', 'selectedDestination', 'shuffleAfter', 'source', 'takeCount', 'target', 'unselectedDestination'],
  SHUFFLE_INTO_DECK: ['count', 'filter', 'from', 'toDeck'],
  SPEND_COUNTERS: ['amount', 'counterType', 'target'],
  SURGE: [],
  TRANSFER_DAMAGE: ['amount', 'dynamicBonus', 'finisherBonus'],
  VILLAIN_AND_ENGAGED_MINIONS_ATTACK: [],
  VILLAIN_ATTACKS: [],
  VILLAIN_SCHEMES: ['target'],
};

export function getAllowedEffectParamKeys(effect: EffectType): readonly string[] {
  return EFFECT_PARAM_KEYS[effect];
}
