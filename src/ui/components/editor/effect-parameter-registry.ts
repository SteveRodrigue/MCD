import {
  type EffectType,
  TargetSelectorSchema,
  ResourceTypeSchema,
} from '../../../data/supplemental/schema';

export interface ParameterDescriptor {
  key: string;
  label: string;
  type: 'number' | 'text' | 'select' | 'multi-select' | 'boolean' | 'card-filter' | 'json';
  allowDynamic?: boolean;
  allowAll?: boolean;
  options?: readonly string[];
  placeholder?: string;
  defaultValue?: any;
  description?: string;
}

export interface EffectDescriptor {
  effect: EffectType;
  description: string;
  parameters: ParameterDescriptor[];
}

// Reusable standard parameter options
export const TARGET_OPTIONS = TargetSelectorSchema.options;
export const RESOURCE_OPTIONS = ResourceTypeSchema.options;
export const STATUS_OPTIONS = ['STUNNED', 'CONFUSED', 'TOUGH'] as const;
export const STAT_OPTIONS = ['ATK', 'THW', 'DEF', 'REC', 'ATTACK', 'SCHEME'] as const;
export const KEYWORD_OPTIONS = [
  'Retaliate',
  'Overkill',
  'Ranged',
  'Quickstrike',
  'Guard',
  'Crisis',
  'Hazard',
  'Acceleration',
  'Toughness',
] as const;
export const DURATION_OPTIONS = [
  'PHASE',
  'ROUND',
  'UNTIL_END_OF_PHASE',
  'UNTIL_END_OF_ROUND',
] as const;
export const SEARCH_SOURCE_OPTIONS = [
  'PLAYER_DECK',
  'ENCOUNTER_DECK',
  'PLAYER_DISCARD',
  'ENCOUNTER_DISCARD',
  'PLAYER_HAND',
] as const;
export const CARD_ZONE_OPTIONS = [
  'PLAYER_DISCARD',
  'PLAYER_DECK',
  'ENCOUNTER_DECK',
  'ENCOUNTER_DISCARD',
  'SIDE_SCHEMES',
  'IN_PLAY',
  'TABLEAU',
  'TUCKED',
  'ATTACHED',
] as const;
export const CARD_POSITION_OPTIONS = ['TOP', 'BOTTOM', 'TOPMOST_MATCHING'] as const;
export const SELECTED_DESTINATION_OPTIONS = [
  'HAND',
  'TABLEAU',
  'DECK_TOP',
  'DECK_BOTTOM',
  'DECK_SHUFFLE',
  'DISCARD',
  'ATTACH_TO_TARGET',
  'REVEAL',
] as const;
export const UNSELECTED_DESTINATION_OPTIONS = [
  'DISCARD',
  'DECK_BOTTOM',
  'DECK_SHUFFLE',
  'DECK_TOP',
  'LEAVE_IN_PLACE',
] as const;

/**
 * Authoritative Parameter Registry mapping each engine EffectType 1:1 to its parameter UI schema.
 */
export const EFFECT_PARAMETER_REGISTRY: Record<EffectType, EffectDescriptor> = {
  // 1. Core Card Draw & Manipulation

  // 2. Damage & Combat Primitives
  DEAL_DAMAGE: {
    effect: 'DEAL_DAMAGE',
    description: 'Deal damage to a target character or enemy.',
    parameters: [
      {
        key: 'amount',
        label: 'Damage Amount',
        type: 'number',
        allowDynamic: true,
        placeholder: 'e.g. 3',
        description: 'Fixed damage value',
      },
      {
        key: 'target',
        label: 'Target',
        type: 'select',
        options: TARGET_OPTIONS,
        defaultValue: 'CHOSEN_ENEMY',
      },
      {
        key: 'targetPlayer',
        label: 'Target Player',
        type: 'select',
        options: ['SELF', 'CHOSEN_PLAYER'] as const,
        description:
          "Which player's engaged enemies are hit when Target is Engaged Enemies (prompts in multiplayer)",
      },
      {
        key: 'finisherBonus',
        label: 'Finisher Bonus Damage',
        type: 'number',
        placeholder: 'e.g. 2',
      },
      {
        key: 'dynamicBonus',
        label: 'Dynamic Bonus Damage',
        type: 'number',
        allowDynamic: true,
        description: 'Dynamic bonus calculated from game state or discarded cards',
      },
      {
        key: 'kickerResource',
        label: 'Kicker Resource',
        type: 'text',
        description: 'Resource type that triggers a kicker bonus',
      },
      {
        key: 'overkillOnCondition',
        label: 'Overkill On Condition',
        type: 'boolean',
      },
      {
        key: 'overkillOnPhysical',
        label: 'Overkill On Physical',
        type: 'boolean',
      },
    ],
  },
  DISTRIBUTE_AMOUNT: {
    effect: 'DISTRIBUTE_AMOUNT',
    description:
      'Distribute a pool of damage, threat removal, heal, or counters across multiple eligible targets (ADR-0064).',
    parameters: [
      {
        key: 'budget',
        label: 'Budget Amount',
        type: 'number',
        allowDynamic: true,
        defaultValue: 1,
        placeholder: 'e.g. 4',
        description: 'Total points to allocate across targets',
      },
      {
        key: 'allocationDomain',
        label: 'Allocation Domain',
        type: 'select',
        options: ['DAMAGE', 'THREAT_REMOVAL', 'HEAL', 'COUNTERS', 'EXHAUST'] as const,
        defaultValue: 'DAMAGE',
        description: 'Domain of effect being distributed',
      },
      {
        key: 'targetScope',
        label: 'Target Scope',
        type: 'select',
        options: TARGET_OPTIONS,
        defaultValue: 'ALL_HEROES_AND_ALLIES',
        description: 'Set of targets eligible for point allocation',
      },
      {
        key: 'capRule',
        label: 'Cap Rule',
        type: 'select',
        options: ['REMAINING_HP', 'SUFFERED_DAMAGE', 'CURRENT_THREAT', 'NONE'] as const,
        defaultValue: 'NONE',
        description: 'Maximum points assignable to a single target',
      },
    ],
  },
  PREVENT_DAMAGE: {
    effect: 'PREVENT_DAMAGE',
    description: 'Prevent incoming attack or effect damage to a character.',
    parameters: [
      {
        key: 'amount',
        label: 'Damage Prevented',
        type: 'number',
        placeholder: 'e.g. 3 or blank for all',
      },
    ],
  },
  HEAL_DAMAGE: {
    effect: 'HEAL_DAMAGE',
    description: 'Heal damage from target identity, ally, or friendly character.',
    parameters: [
      {
        key: 'amount',
        label: 'Heal Amount',
        type: 'number',
        allowDynamic: true,
        defaultValue: 1,
        placeholder: '1',
      },
      {
        key: 'target',
        label: 'Target Character',
        type: 'select',
        options: TARGET_OPTIONS,
        defaultValue: 'SELF',
      },
    ],
  },
  TRANSFER_DAMAGE: {
    effect: 'TRANSFER_DAMAGE',
    description: 'Move damage from one character to another.',
    parameters: [
      {
        key: 'amount',
        label: 'Amount',
        type: 'number',
        defaultValue: 1,
      },
      {
        key: 'finisherBonus',
        label: 'Finisher Bonus Damage',
        type: 'number',
        placeholder: 'e.g. 1',
      },
      {
        key: 'dynamicBonus',
        label: 'Dynamic Bonus Damage',
        type: 'number',
        allowDynamic: true,
        description: 'Dynamic bonus calculated from game state or discarded cards',
      },
    ],
  },

  // 3. Threat & Scheme Primitives
  REMOVE_THREAT: {
    effect: 'REMOVE_THREAT',
    description: 'Remove threat counters from target scheme.',
    parameters: [
      {
        key: 'amount',
        label: 'Threat Amount',
        type: 'number',
        allowDynamic: true,
        defaultValue: 1,
        placeholder: '1',
      },
      {
        key: 'target',
        label: 'Target Scheme',
        type: 'select',
        options: TARGET_OPTIONS,
        defaultValue: 'MAIN_SCHEME',
      },
      {
        key: 'finisherBonus',
        label: 'Finisher Bonus Threat',
        type: 'number',
        placeholder: 'e.g. 1',
      },
      {
        key: 'dynamicBonus',
        label: 'Dynamic Bonus Threat',
        type: 'number',
        allowDynamic: true,
        description: 'Dynamic bonus calculated from game state or discarded cards',
      },
      {
        key: 'distinctFrom',
        label: 'Distinct From',
        type: 'text',
        description: 'Use PREVIOUS_TARGET to pick a different scheme than the prior step',
      },
    ],
  },
  ADD_THREAT: {
    effect: 'ADD_THREAT',
    description: 'Place threat counters on target scheme.',
    parameters: [
      {
        key: 'amount',
        label: 'Threat Amount',
        type: 'number',
        defaultValue: 1,
        placeholder: '1',
      },
      {
        key: 'perPlayer',
        label: 'Scale Per Player',
        type: 'boolean',
        defaultValue: false,
      },
      {
        key: 'target',
        label: 'Target Scheme',
        type: 'select',
        options: TARGET_OPTIONS,
        defaultValue: 'MAIN_SCHEME',
      },
      {
        key: 'cardCode',
        label: 'Card Code',
        type: 'text',
      },
      {
        key: 'condition',
        label: 'Condition',
        type: 'json',
      },
    ],
  },
  PREVENT_THREAT: {
    effect: 'PREVENT_THREAT',
    description: 'Prevent or reduce impending threat that would be placed on a scheme.',
    parameters: [
      {
        key: 'amount',
        label: 'Threat Prevented',
        type: 'number',
        placeholder: 'e.g. 1 or blank for all',
        allowDynamic: true,
        allowAll: true,
      },
      {
        key: 'target',
        label: 'Target Scheme',
        type: 'select',
        options: TARGET_OPTIONS,
        defaultValue: 'MAIN_SCHEME',
      },
    ],
  },

  // 4. Status Cards & Tokens
  ADD_STATUS: {
    effect: 'ADD_STATUS',
    description: 'Apply status card (Stunned, Confused, Tough) to target.',
    parameters: [
      {
        key: 'status',
        label: 'Status Card',
        type: 'select',
        options: STATUS_OPTIONS,
        defaultValue: 'STUNNED',
      },
      {
        key: 'target',
        label: 'Target',
        type: 'select',
        options: TARGET_OPTIONS,
        defaultValue: 'CHOSEN_ENEMY',
      },
    ],
  },

  // 5. Counters & Resource Primitives
  GENERATE_RESOURCE: {
    effect: 'GENERATE_RESOURCE',
    description:
      'Generate resources statically or dynamically from a card (e.g. top card of discard pile).',
    parameters: [
      {
        key: 'resource',
        label: 'Resource Type (Static)',
        type: 'select',
        options: RESOURCE_OPTIONS,
        defaultValue: 'wild',
      },
      {
        key: 'amount',
        label: 'Resource Amount (Static)',
        type: 'number',
        defaultValue: 1,
        placeholder: '1',
      },
      {
        key: 'count',
        label: 'Resource Count',
        type: 'number',
        placeholder: '1',
        description: 'Number of resources to generate',
      },
      {
        key: 'fromCard',
        label: 'From Card',
        type: 'json',
        description: 'Card selector whose resources are generated',
      },
    ],
  },
  DOUBLE_RESOURCE_FOR_ASPECT: {
    effect: 'DOUBLE_RESOURCE_FOR_ASPECT',
    description: 'Double resource generation when paying for a matching aspect card.',
    parameters: [
      {
        key: 'aspect',
        label: 'Aspect',
        type: 'text',
        placeholder: 'e.g. aggression, leadership',
      },
    ],
  },
  ADD_ACCELERATION: {
    effect: 'ADD_ACCELERATION',
    description:
      'Place acceleration tokens on the main scheme (+1 threat per token each villain phase).',
    parameters: [
      {
        key: 'amount',
        label: 'Acceleration Tokens',
        type: 'number',
        allowDynamic: true,
        defaultValue: 1,
      },
    ],
  },
  ADD_COUNTERS: {
    effect: 'ADD_COUNTERS',
    description: 'Add multiple counter tokens to target card.',
    parameters: [
      {
        key: 'counterType',
        label: 'Counter Type',
        type: 'text',
        placeholder: 'e.g. all-purpose, charge',
        defaultValue: 'all-purpose',
      },
      {
        key: 'amount',
        label: 'Counter Amount',
        type: 'number',
        allowDynamic: true,
        defaultValue: 1,
      },
      {
        key: 'target',
        label: 'Target',
        type: 'select',
        options: TARGET_OPTIONS,
        defaultValue: 'SELF',
      },
    ],
  },
  REMOVE_COUNTERS: {
    effect: 'REMOVE_COUNTERS',
    description: 'Remove multiple counters from target card.',
    parameters: [
      {
        key: 'counterType',
        label: 'Counter Type',
        type: 'text',
        placeholder: 'e.g. all-purpose, charge',
      },
      {
        key: 'amount',
        label: 'Amount Removed',
        type: 'number',
        allowDynamic: true,
        allowAll: true,
        defaultValue: 1,
      },
      {
        key: 'target',
        label: 'Target',
        type: 'select',
        options: TARGET_OPTIONS,
        defaultValue: 'SELF',
      },
    ],
  },
  REMOVE_COUNTERS_MATCHING_FILTER: {
    effect: 'REMOVE_COUNTERS_MATCHING_FILTER',
    description: 'Remove counters across cards matching a trait or zone filter.',
    parameters: [
      {
        key: 'counterType',
        label: 'Counter Type',
        type: 'text',
        placeholder: 'e.g. all-purpose',
      },
      {
        key: 'traitFilter',
        label: 'Trait Filter',
        type: 'text',
        placeholder: 'e.g. Gamma',
      },
      {
        key: 'targetZone',
        label: 'Target Zone',
        type: 'select',
        options: ['IN_PLAY', 'PLAYER_DISCARD', 'ENCOUNTER_DECK'],
        defaultValue: 'IN_PLAY',
        description: 'Zone in which to match cards for counter removal',
      },
      {
        key: 'amount',
        label: 'Amount to Remove',
        type: 'number',
        allowDynamic: true,
        allowAll: true,
        defaultValue: 1,
        placeholder: '1',
        description: 'Number of counters to remove, ALL, or dynamic formula',
      },
    ],
  },
  SPEND_COUNTERS: {
    effect: 'SPEND_COUNTERS',
    description: 'Spend counter tokens to pay cost or resolve effect.',
    parameters: [
      {
        key: 'counterType',
        label: 'Counter Type',
        type: 'text',
        placeholder: 'e.g. all-purpose',
      },
      {
        key: 'amount',
        label: 'Amount Spent',
        type: 'number',
        allowDynamic: true,
        defaultValue: 1,
      },
      {
        key: 'target',
        label: 'Target',
        type: 'select',
        options: TARGET_OPTIONS,
        defaultValue: 'SELF',
      },
    ],
  },

  // 6. Character Stats & Trait Modifiers
  MODIFY_STAT: {
    effect: 'MODIFY_STAT',
    description: 'Modify dynamic ATK, THW, DEF, or REC stat on target character.',
    parameters: [
      {
        key: 'stat',
        label: 'Stat',
        type: 'select',
        options: STAT_OPTIONS,
        defaultValue: 'ATK',
      },
      {
        key: 'amount',
        label: 'Modifier Amount (+/-)',
        type: 'number',
        allowDynamic: true,
        defaultValue: 1,
        placeholder: 'e.g. 1 or -1',
      },
      {
        key: 'duration',
        label: 'Duration',
        type: 'select',
        options: DURATION_OPTIONS,
        defaultValue: 'PHASE',
      },
      {
        key: 'target',
        label: 'Target',
        type: 'select',
        options: TARGET_OPTIONS,
        defaultValue: 'SELF',
      },
      {
        key: 'targetPlayer',
        label: 'Target Player',
        type: 'select',
        options: ['SELF', 'CHOSEN_PLAYER'] as const,
        description:
          'With Target All Controlled Characters: whose characters get the bonus (prompts in multiplayer)',
      },
      {
        key: 'atkBonus',
        label: 'ATK Bonus',
        type: 'number',
        placeholder: 'e.g. 1',
        description: 'Shorthand: ATK bonus for every character of the target player',
      },
      {
        key: 'thwBonus',
        label: 'THW Bonus',
        type: 'number',
        placeholder: 'e.g. 1',
        description: 'Shorthand: THW bonus for every character of the target player',
      },
    ],
  },
  ADD_TRAIT: {
    effect: 'ADD_TRAIT',
    description: 'Grant a trait (e.g. Aerial, Avenger, Gamma) to target character.',
    parameters: [
      {
        key: 'trait',
        label: 'Trait Name',
        type: 'text',
        placeholder: 'e.g. Aerial, Avenger',
      },
      {
        key: 'target',
        label: 'Target',
        type: 'select',
        options: TARGET_OPTIONS,
        defaultValue: 'SELF',
      },
      {
        key: 'duration',
        label: 'Duration (empty = while the source card is in play)',
        type: 'select',
        options: DURATION_OPTIONS,
      },
    ],
  },
  GRANT_KEYWORD: {
    effect: 'GRANT_KEYWORD',
    description: 'Grant keyword (Retaliate, Overkill, Ranged, etc.) to target character.',
    parameters: [
      {
        key: 'keyword',
        label: 'Keyword',
        type: 'select',
        options: KEYWORD_OPTIONS,
        defaultValue: 'Retaliate',
      },
      {
        key: 'amount',
        label: 'Amount (e.g. for Retaliate X or Incite X)',
        type: 'number',
        placeholder: '1',
      },
      {
        key: 'duration',
        label: 'Duration',
        type: 'select',
        options: DURATION_OPTIONS,
      },
      {
        key: 'target',
        label: 'Target',
        type: 'select',
        options: TARGET_OPTIONS,
        defaultValue: 'SELF',
      },
    ],
  },
  MODIFY_MAX_HEALTH: {
    effect: 'MODIFY_MAX_HEALTH',
    description: 'Modify maximum hit points of target character.',
    parameters: [
      {
        key: 'amount',
        label: 'Max Health Delta',
        type: 'number',
        placeholder: 'e.g. 1 or 2',
      },
      {
        key: 'target',
        label: 'Target',
        type: 'select',
        options: TARGET_OPTIONS,
        defaultValue: 'SELF',
      },
    ],
  },
  MODIFY_HAND_SIZE: {
    effect: 'MODIFY_HAND_SIZE',
    description:
      'Modify effective hand size. Use a dynamic formula for scaled bonuses (e.g. Iron Man: +1 per Tech upgrade, clamp max 6).',
    parameters: [
      {
        key: 'amount',
        label: 'Hand Size Delta',
        type: 'number',
        allowDynamic: true,
        placeholder: '1',
      },
    ],
  },
  MODIFY_ALLY_LIMIT: {
    effect: 'MODIFY_ALLY_LIMIT',
    description: 'Expand or reduce maximum player ally capacity in play.',
    parameters: [
      {
        key: 'amount',
        label: 'Ally Limit Delta',
        type: 'number',
        defaultValue: 1,
      },
      {
        key: 'target',
        label: 'Target Player',
        type: 'select',
        options: TARGET_OPTIONS,
        defaultValue: 'SELF',
      },
    ],
  },
  MODIFY_RESTRICTED_LIMIT: {
    effect: 'MODIFY_RESTRICTED_LIMIT',
    description: 'Grant additional restricted item slots (Side Holster).',
    parameters: [
      {
        key: 'amount',
        label: 'Bonus Restricted Slots',
        type: 'number',
        defaultValue: 1,
      },
    ],
  },

  // 7. Search & Select Routing Primitives (RR v1.8 p. 19, 26)

  // 8. Ready & Exhaust Primitives
  EXHAUST: {
    effect: 'EXHAUST',
    description: 'Exhaust a card, identity, ally, minion, villain, or character.',
    parameters: [
      {
        key: 'target',
        label: 'Target Selector',
        type: 'select',
        options: TARGET_OPTIONS,
        defaultValue: 'SELF_IDENTITY',
        description: 'The entity to exhaust (SELF_IDENTITY, SELF, CHOSEN_ALLY, VILLAIN, etc.).',
      },
      {
        key: 'filter',
        label: 'Target Filter (Optional)',
        type: 'card-filter',
        description: 'Universal card filter applied to eligible targets.',
      },
    ],
  },
  READY: {
    effect: 'READY',
    description: 'Ready an exhausted card, identity, ally, minion, or character.',
    parameters: [
      {
        key: 'target',
        label: 'Target Selector',
        type: 'select',
        options: TARGET_OPTIONS,
        defaultValue: 'SELF_IDENTITY',
        description: 'The entity to ready (SELF_IDENTITY, SELF, CHOSEN_ALLY, etc.).',
      },
      {
        key: 'filter',
        label: 'Target Filter (Optional)',
        type: 'card-filter',
        description: 'Universal card filter applied to eligible targets.',
      },
    ],
  },

  // 9. Discard Primitives
  DISCARD: {
    effect: 'DISCARD',
    description: 'Discard cards from a specified source zone (hand, tableau, deck, host, or self).',
    parameters: [
      {
        key: 'source',
        label: 'Source Zone',
        type: 'select',
        options: ['HAND', 'DECK', 'ENCOUNTER_DECK', 'TABLEAU', 'HOST', 'SELF', 'CARDS_UNDER_HOST'],
        defaultValue: 'HAND',
        description: 'Source zone cards are discarded from (RR v1.8 p. 10)',
      },
      {
        key: 'count',
        label: 'Card Count',
        type: 'number',
        allowDynamic: true,
        allowAll: true,
        defaultValue: 1,
        placeholder: '1',
      },
      {
        key: 'mode',
        label: 'Discard Mode',
        type: 'select',
        options: ['CHOSEN', 'RANDOM', 'TOP', 'ALL', 'UNTIL_MATCH'],
        defaultValue: 'CHOSEN',
      },
      {
        key: 'target',
        label: 'Target Player / Entity',
        type: 'select',
        options: TARGET_OPTIONS,
        defaultValue: 'SELF',
      },
      {
        key: 'filter',
        label: 'Card Filter',
        type: 'card-filter',
        description: 'Universal card filter for eligible cards to discard',
      },
      {
        key: 'untilFilter',
        label: 'Until Match Filter',
        type: 'card-filter',
        description: 'Filter defining termination condition for UNTIL_MATCH discard mode',
      },
      {
        key: 'fallback',
        label: 'Fallback Action',
        type: 'select',
        options: ['SURGE', 'NONE'],
        defaultValue: 'NONE',
        description: 'Action if no cards could be discarded (e.g. Surge)',
      },
      {
        key: 'matchingDestination',
        label: 'Matching Destination',
        type: 'select',
        options: ['HAND', 'PLAY', 'DISCARD', 'REVEAL'],
        defaultValue: 'DISCARD',
        description:
          'Destination for discarded cards matching filter (e.g. HAND for Black Cat, REVEAL for the card found by an encounter deck UNTIL_MATCH)',
      },
    ],
  },

  // 10. Attachment & Card State Primitives
  ATTACH_TO_HOST: {
    effect: 'ATTACH_TO_HOST',
    description: 'Attach card to target character or scheme.',
    parameters: [
      {
        key: 'target',
        label: 'Host Target',
        type: 'select',
        options: TARGET_OPTIONS,
        defaultValue: 'VILLAIN',
      },
      {
        key: 'maxPerHost',
        label: 'Max Per Host',
        type: 'number',
        placeholder: 'e.g. 1',
      },
    ],
  },
  ATTACH_FACEDOWN_CARDS_FROM_HAND: {
    effect: 'ATTACH_FACEDOWN_CARDS_FROM_HAND',
    description: 'Tuck cards facedown under host card from hand.',
    parameters: [],
  },
  REMOVE_FROM_GAME: {
    effect: 'REMOVE_FROM_GAME',
    description:
      'Remove the source card from the game (it ends only in the removed-from-game zone).',
    parameters: [
      {
        key: 'target',
        label: 'Target',
        type: 'text',
        description: 'Pseudo-primitive key kept for existing card data (#231 / #232)',
      },
    ],
  },
  PLACE_CARD_UNDER_HOST: {
    effect: 'PLACE_CARD_UNDER_HOST',
    description: 'Place card underneath host card.',
    parameters: [],
  },
  RETURN_TO_HAND: {
    effect: 'RETURN_TO_HAND',
    description: 'Return target card in play or attached facedown cards back to owner hand.',
    parameters: [],
  },
  ATTACHMENT_DAMAGE_SHIELD: {
    effect: 'ATTACHMENT_DAMAGE_SHIELD',
    description: 'Absorb incoming damage directed at host (e.g. Armored Rhino).',
    parameters: [
      {
        key: 'maxAbsorb',
        label: 'Max Damage Absorbed',
        type: 'number',
        placeholder: 'e.g. 4',
      },
    ],
  },

  // 11. Form & Player Progression Primitives
  CHANGE_FORM: {
    effect: 'CHANGE_FORM',
    description: 'Flip between Hero and Alter-Ego identity forms (RR v1.8 p. 8).',
    parameters: [
      {
        key: 'form',
        label: 'Form',
        type: 'text',
      },
      {
        key: 'optional',
        label: 'Optional',
        type: 'boolean',
      },
    ],
  },
  FLIP_FORM: {
    effect: 'FLIP_FORM',
    description: 'Flip identity form card.',
    parameters: [],
  },
  REDUCE_NEXT_CARD_COST: {
    effect: 'REDUCE_NEXT_CARD_COST',
    description: 'Reduce resource cost of next played card (Helicarrier).',
    parameters: [
      {
        key: 'amount',
        label: 'Cost Reduction Amount',
        type: 'number',
        defaultValue: 1,
      },
      {
        key: 'duration',
        label: 'Duration',
        type: 'select',
        options: ['PHASE', 'ROUND', 'TURN'] as const,
        defaultValue: 'PHASE',
      },
      {
        key: 'target',
        label: 'Target Player',
        type: 'select',
        options: TARGET_OPTIONS,
        defaultValue: 'SELF',
      },
      {
        key: 'cardFilter',
        label: 'Eligible Card Filter',
        type: 'card-filter',
        description: 'Universal card filter for eligible cards (e.g. aspect, card type, trait)',
      },
    ],
  },
  PLAY_FROM_ZONE: {
    effect: 'PLAY_FROM_ZONE',
    description:
      'Play a card from a designated zone (e.g. discard, deck) with optional cost modes.',
    parameters: [
      {
        key: 'source',
        label: 'Source Zone',
        type: 'select',
        options: [
          'PLAYER_DISCARD',
          'ANY_PLAYER_DISCARD',
          'PLAYER_DECK',
          'SET_ASIDE',
          'ATTACHED',
          'TUCKED',
        ],
        defaultValue: 'PLAYER_DISCARD',
      },
      {
        key: 'costMode',
        label: 'Cost Mode',
        type: 'select',
        options: ['PRINTED_COST', 'FREE', 'REDUCED'],
        defaultValue: 'PRINTED_COST',
      },
      {
        key: 'costReduction',
        label: 'Cost Reduction',
        type: 'number',
        defaultValue: 0,
      },
      {
        key: 'destination',
        label: 'Destination',
        type: 'select',
        options: ['TABLEAU', 'ENGAGED_WITH_PLAYER'],
        defaultValue: 'TABLEAU',
      },
      {
        key: 'control',
        label: 'Control',
        type: 'select',
        options: ['SELF', 'OWNER'],
        defaultValue: 'SELF',
      },
      {
        key: 'filter',
        label: 'Card Filter',
        type: 'card-filter',
        description: 'Universal card filter for eligible cards to play',
      },
      {
        key: 'promptTitle',
        label: 'Prompt Title',
        type: 'text',
        placeholder: 'e.g. Choose a card to play',
        description: 'Title displayed in the player selection prompt',
      },
    ],
  },
  PUT_INTO_PLAY: {
    effect: 'PUT_INTO_PLAY',
    description: 'Put card into play without paying resource cost.',
    parameters: [
      {
        key: 'from',
        label: 'Source Zone',
        type: 'select',
        options: ['SET_ASIDE', 'DISCARD', 'HAND', 'DECK'],
        defaultValue: 'SET_ASIDE',
      },
      {
        key: 'to',
        label: 'Destination Zone',
        type: 'select',
        options: ['TABLEAU', 'ENGAGED_WITH_PLAYER', 'SIDE_SCHEMES'],
        defaultValue: 'TABLEAU',
      },
      {
        key: 'target',
        label: 'Target',
        type: 'select',
        options: ['SELF'] as const,
        description:
          'SELF puts the source card itself into play (e.g. a boost card). Empty selects cards by filter.',
      },
      {
        key: 'filter',
        label: 'Target Card Filter',
        type: 'card-filter',
        description: 'Universal card filter to match eligible card to put into play',
      },
      {
        key: 'reveal',
        label: 'Reveal',
        type: 'boolean',
        defaultValue: false,
        description:
          'Reveal the card as it enters play: its When Revealed abilities and Surge resolve (RR v1.8 glossary R, W)',
      },
    ],
  },
  SHUFFLE_INTO_DECK: {
    effect: 'SHUFFLE_INTO_DECK',
    description: 'Shuffle cards from a designated zone into a target deck.',
    parameters: [
      {
        key: 'from',
        label: 'Source Zone',
        type: 'select',
        options: ['SET_ASIDE', 'DISCARD', 'HAND'],
        defaultValue: 'SET_ASIDE',
      },
      {
        key: 'toDeck',
        label: 'Destination Deck',
        type: 'select',
        options: ['ENCOUNTER_DECK', 'PLAYER_DECK'],
        defaultValue: 'ENCOUNTER_DECK',
      },
      {
        key: 'count',
        label: 'Card Count',
        type: 'number',
        placeholder: 'e.g. 3',
      },
      {
        key: 'filter',
        label: 'Card Filter',
        type: 'json',
      },
    ],
  },

  // 12. Villain & Encounter Deck Actions
  VILLAIN_ATTACKS: {
    effect: 'VILLAIN_ATTACKS',
    description: 'Induce the Villain to immediately initiate an attack against player.',
    parameters: [],
  },
  ENEMY_ATTACKS: {
    effect: 'ENEMY_ATTACKS',
    description:
      'A specific enemy (minion, or a named villain) attacks the player. The step fails when it did not attack (not in play, stunned, cancelled, no hero), so a later step can gate on IF_FAILED.',
    parameters: [
      {
        key: 'enemy',
        label: 'Enemy Card Code',
        type: 'text',
        placeholder: 'e.g. 01162',
      },
      {
        key: 'target',
        label: 'Attacked Character',
        type: 'select',
        options: ['SELF_HERO', 'SELF_IDENTITY'],
        defaultValue: 'SELF_HERO',
      },
    ],
  },
  VILLAIN_SCHEMES: {
    effect: 'VILLAIN_SCHEMES',
    description: 'Induce the Villain to immediately scheme against player.',
    parameters: [
      {
        key: 'target',
        label: 'Target Player',
        type: 'select',
        options: TARGET_OPTIONS,
        defaultValue: 'SELF',
      },
    ],
  },
  VILLAIN_AND_ENGAGED_MINIONS_ATTACK: {
    effect: 'VILLAIN_AND_ENGAGED_MINIONS_ATTACK',
    description: 'Villain and all engaged minions initiate attacks against player.',
    parameters: [],
  },
  SURGE: {
    effect: 'SURGE',
    description: 'Resolve Surge keyword: deal and reveal an additional encounter card.',
    parameters: [],
  },
  REVEAL_ENCOUNTER_CARD: {
    effect: 'REVEAL_ENCOUNTER_CARD',
    description: 'Reveal top card of encounter deck.',
    parameters: [],
  },
  GIVE_ADDITIONAL_BOOST_CARD: {
    effect: 'GIVE_ADDITIONAL_BOOST_CARD',
    description: 'Deal additional facedown boost card to activating enemy.',
    parameters: [],
  },

  // 13. Cancellation & Interrupts
  CANCEL_WHEN_REVEALED: {
    effect: 'CANCEL_WHEN_REVEALED',
    description: 'Cancel the "When Revealed" effect of an encounter card.',
    parameters: [],
  },
  CANCEL_WHEN_REVEALED_AND_REVEAL_ANOTHER: {
    effect: 'CANCEL_WHEN_REVEALED_AND_REVEAL_ANOTHER',
    description: 'Cancel When Revealed effect and reveal another encounter card.',
    parameters: [],
  },
  CANCEL_ATTACK: {
    effect: 'CANCEL_ATTACK',
    description: 'Cancel incoming enemy attack before boost cards or damage are resolved.',
    parameters: [],
  },
  DECLARE_DEFENDER: {
    effect: 'DECLARE_DEFENDER',
    description: 'Prompt player to declare a defender against an incoming enemy attack.',
    parameters: [],
  },

  // 14. Signature Hero Specials
  EXECUTE_SPECIAL: {
    effect: 'EXECUTE_SPECIAL',
    description: 'Execute signature card-specific special logic.',
    parameters: [],
  },
  EXECUTE_WAKANDA_FOREVER: {
    effect: 'EXECUTE_WAKANDA_FOREVER',
    description: 'Resolve Black Panther Wakanda Forever multi-upgrade chain.',
    parameters: [],
  },
  PLAYER_CHOICE: {
    effect: 'PLAYER_CHOICE',
    description: 'Prompt player to choose between multiple options.',
    parameters: [
      { key: 'title', label: 'Prompt Title', type: 'text', placeholder: 'e.g. Choose an Option' },
      {
        key: 'description',
        label: 'Prompt Description',
        type: 'text',
        placeholder: 'e.g. Choose one of the following:',
      },
      { key: 'options', label: 'Choice Options', type: 'json' },
      { key: 'isVoluntary', label: 'Voluntary Choice', type: 'boolean', defaultValue: false },
    ],
  },
  DRAW: {
    effect: 'DRAW',
    description: 'Canonical alias for drawing cards.',
    parameters: [
      { key: 'count', label: 'Card Count', type: 'number', allowDynamic: true, defaultValue: 1 },
      {
        key: 'limit',
        label: 'Hand Size Limit',
        type: 'select',
        options: ['PRINTED_HAND_SIZE', 'HAND_SIZE'],
      },
      { key: 'target', label: 'Target Player', type: 'select', options: TARGET_OPTIONS },
      {
        key: 'targetPlayerId',
        label: 'Target Player ID',
        type: 'text',
        placeholder: 'e.g. player_1',
        description: 'Specific player ID to draw cards',
      },
      {
        key: 'dynamicBonus',
        label: 'Dynamic Bonus Cards',
        type: 'number',
        allowDynamic: true,
        description: 'Dynamic bonus card draw calculated from identity, traits, or game state',
      },
    ],
  },
  SEARCH: {
    effect: 'SEARCH',
    description: 'Canonical alias for searching and selecting cards.',
    parameters: [
      {
        key: 'source',
        label: 'Source Zone',
        type: 'multi-select',
        options: SEARCH_SOURCE_OPTIONS,
        defaultValue: ['PLAYER_DECK'],
      },
      {
        key: 'target',
        label: 'Target Selector',
        type: 'select',
        options: TARGET_OPTIONS,
        defaultValue: 'SELF',
        description:
          'Target player whose zones are searched (e.g. CHOSEN_PLAYER for cross-player abilities)',
      },
      {
        key: 'fromTop',
        label: 'From Top of Discard',
        type: 'boolean',
        defaultValue: false,
        description: 'Evaluate discard pile from top to bottom (retrieves topmost matching card)',
      },
      {
        key: 'lookCount',
        label: 'Look Count',
        type: 'number',
        allowDynamic: true,
        allowAll: true,
        placeholder: 'e.g. 5',
        description: 'Number of cards to look at (0 or ALL = search entire pile, 1+ = top X cards)',
      },
      {
        key: 'takeCount',
        label: 'Take Count',
        type: 'number',
        allowDynamic: true,
        allowAll: true,
        defaultValue: 1,
        description:
          'Number of matching cards to take (0 or ALL = take all matching cards, 1+ = take up to X cards)',
      },
      {
        key: 'filter',
        label: 'Card Filter',
        type: 'card-filter',
        description: 'Universal card filter for eligible cards',
      },
      {
        key: 'selectedDestination',
        label: 'Selected Destination',
        type: 'select',
        options: SELECTED_DESTINATION_OPTIONS,
      },
      {
        key: 'unselectedDestination',
        label: 'Unselected Destination',
        type: 'select',
        options: UNSELECTED_DESTINATION_OPTIONS,
      },
      {
        key: 'autoSelectIfUnambiguous',
        label: 'Auto-select Unambiguous Results',
        type: 'boolean',
        defaultValue: true,
        description:
          'Automatically resolve without a decision prompt when matching candidate count <= takeCount',
      },
      {
        key: 'shuffleAfter',
        label: 'Shuffle Deck After Search',
        type: 'boolean',
        defaultValue: false,
        description: 'Shuffle the searched deck after completing the search',
      },
      {
        key: 'isVoluntary',
        label: 'Voluntary (May Choose)',
        type: 'boolean',
        defaultValue: false,
        description: 'Player may decline to take any cards (RR v1.8 p. 19)',
      },
      {
        key: 'promptTitle',
        label: 'Search Prompt Title',
        type: 'text',
        placeholder: 'e.g. Search your deck for...',
        description: 'Title displayed in the search selection prompt',
      },
    ],
  },
  REMOVE_STATUS: {
    effect: 'REMOVE_STATUS',
    description: 'Remove a status card from a target.',
    parameters: [
      { key: 'status', label: 'Status', type: 'select', options: [...STATUS_OPTIONS, 'ALL'] },
      { key: 'target', label: 'Target', type: 'select', options: TARGET_OPTIONS },
    ],
  },
};

/**
 * Retrieve the parameter descriptor for an effect primitive, falling back to an empty descriptor.
 */
export function getEffectDescriptor(effect: EffectType | string): EffectDescriptor {
  const descriptor = EFFECT_PARAMETER_REGISTRY[effect as EffectType];
  if (descriptor) {
    return descriptor;
  }
  return {
    effect: effect as EffectType,
    description: `Operational primitive: ${effect}`,
    parameters: [],
  };
}
