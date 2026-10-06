import type { EffectType } from './schema';

/**
 * Allowed `effectParams` keys per effect primitive (Issue #230).
 *
 * Single source of truth for the guard test in tests/data/effect-params-keys.test.ts.
 * The Card Editor registry (src/ui/components/editor/effect-parameter-registry.ts)
 * must expose exactly these keys per effect; tests/ui/effect-parameter-registry.test.ts enforces it.
 * `AbilityStepSchema.effectParams` stays a free-form record; this table is validated by a data test only.
 *
 * Pseudo-primitive keys (ATTACHMENT_DAMAGE_SHIELD.mode, TRANSFER_DAMAGE.from/to, and `target`
 * on a few effects) are allowed for now and are tracked for removal in #232.
 */
export const EFFECT_PARAM_KEYS: Record<EffectType, readonly string[]> = {
  ADD_ACCELERATION: ['amount'],
  ADD_COUNTERS: ['amount', 'counterType', 'target'],
  ADD_STATUS: ['status', 'target'],
  ADD_THREAT: ['amount', 'cardCode', 'condition', 'perPlayer', 'target'],
  ADD_TRAIT: ['duration', 'target', 'trait'],
  ALLY_LIMIT_BONUS: ['amount'],
  ATTACHMENT_DAMAGE_SHIELD: ['maxAbsorb', 'mode', 'target'], // includes pseudo-primitive keys (#231 / #232)
  ATTACH_FACEDOWN_CARDS_FROM_HAND: [],
  ATTACH_TO_HOST: ['maxPerHost', 'target'],
  CANCEL_ATTACK: [],
  CANCEL_TREACHERY_AND_VILLAIN_ATTACKS: [],
  CANCEL_WHEN_REVEALED: [],
  CANCEL_WHEN_REVEALED_AND_ATTACK: [],
  CANCEL_WHEN_REVEALED_AND_REVEAL_ANOTHER: [],
  CHANGE_FORM: ['form', 'optional'],
  COST_REDUCER: ['amount'],
  DEAL_ADDITIONAL_BOOST_CARD: [],
  DEAL_DAMAGE: ['amount', 'dynamicBonus', 'finisherBonus', 'kickerResource', 'overkill', 'overkillOnCondition', 'overkillOnPhysical', 'target', 'targetPlayer'],
  DECLARE_DEFENDER: [],
  DISCARD: ['count', 'fallback', 'filter', 'matchingDestination', 'mode', 'source', 'target', 'untilFilter'],
  DISTRIBUTE_AMOUNT: ['allocationDomain', 'allowPartialIfCapacityLow', 'budget', 'capRule', 'targetScope'],
  DOUBLE_RESOURCE_FOR_ASPECT: ['aspect'],
  DRAW: ['count', 'dynamicBonus', 'limit', 'target', 'targetPlayerId'],
  ENEMY_ATTACKS: ['enemy', 'target'],
  EXECUTE_SPECIAL: [],
  EXECUTE_WAKANDA_FOREVER: [],
  EXHAUST: ['filter', 'target'],
  FLIP_FORM: [],
  GENERATE_RESOURCE: ['amount', 'count', 'fromCard', 'resource', 'sourceMode'],
  GIVE_ADDITIONAL_BOOST_CARD: [],
  GRANT_KEYWORD: ['amount', 'duration', 'keyword', 'target'],
  HEAL_DAMAGE: ['amount', 'target'],
  MODIFY_ALLY_LIMIT: ['amount', 'target'],
  MODIFY_COUNTER: ['amount'],
  MODIFY_HAND_SIZE: ['amount', 'applicableForm', 'maxHandSize'],
  MODIFY_MAX_HEALTH: ['amount', 'target'],
  MODIFY_RESTRICTED_LIMIT: ['amount'],
  MODIFY_STAT: ['amount', 'atkBonus', 'duration', 'stat', 'target', 'targetPlayer', 'thwBonus'],
  PLACE_CARD_UNDER_HOST: [],
  PLAYER_CHOICE: ['description', 'isVoluntary', 'options', 'title'],
  PLAY_FROM_ZONE: ['control', 'costMode', 'costReduction', 'destination', 'filter', 'promptTitle', 'source'],
  PREVENT_DAMAGE: ['amount', 'target'],
  PREVENT_THREAT: ['amount', 'target'],
  PUT_INTO_PLAY: ['filter', 'from', 'reveal', 'target', 'to'],
  READY: ['filter', 'target'],
  REDUCE_NEXT_CARD_COST: ['amount', 'cardFilter', 'duration', 'target'],
  REMOVE_COUNTERS: ['amount', 'counterType', 'target'],
  REMOVE_COUNTERS_MATCHING_FILTER: ['amount', 'counterType', 'targetZone', 'traitFilter'],
  REMOVE_FROM_GAME: ['target'],
  REMOVE_STATUS: ['status', 'target'],
  REMOVE_THREAT: ['amount', 'distinctFrom', 'dynamicBonus', 'finisherBonus', 'target'],
  RESTRICTED_LIMIT_BONUS: ['amount'],
  RETURN_TO_HAND: ['target'],
  REVEAL_ENCOUNTER_CARD: [],
  SEARCH: ['autoSelectIfUnambiguous', 'filter', 'fromTop', 'isVoluntary', 'lookCount', 'promptTitle', 'selectedDestination', 'shuffleAfter', 'source', 'takeCount', 'target', 'unselectedDestination'],
  SEARCH_AND_PLAY_UPGRADE: [],
  SHUFFLE_INTO_DECK: ['count', 'filter', 'from', 'toDeck'],
  SPEND_COUNTERS: ['amount', 'counterType', 'discardWhenEmpty', 'target'],
  SURGE: [],
  TRANSFER_DAMAGE: ['amount', 'dynamicBonus', 'finisherBonus', 'from', 'to'], // includes pseudo-primitive keys (#231 / #232)
  TRIGGER_WAKANDA_UPGRADES: [],
  VILLAIN_AND_ENGAGED_MINIONS_ATTACK: [],
  VILLAIN_ATTACKS: ['target'],
  VILLAIN_SCHEMES: ['target'],
};

export function getAllowedEffectParamKeys(effect: EffectType): readonly string[] {
  return EFFECT_PARAM_KEYS[effect];
}
