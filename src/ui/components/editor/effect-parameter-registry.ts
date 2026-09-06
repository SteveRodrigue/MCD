import {
  type EffectType,
  TargetSelectorSchema,
  ResourceTypeSchema,
  AmountFormulaSchema,
} from '../../../data/supplemental/schema';

export interface ParameterDescriptor {
  key: string;
  label: string;
  type: 'number' | 'text' | 'select' | 'boolean' | 'card-filter' | 'json';
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
export const AMOUNT_FORMULA_OPTIONS = AmountFormulaSchema.options;
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
export const DURATION_OPTIONS = ['UNTIL_END_OF_PHASE', 'UNTIL_END_OF_ROUND'] as const;
export const SEARCH_SOURCE_OPTIONS = [
  'PLAYER_DECK',
  'ENCOUNTER_DECK',
  'PLAYER_DISCARD',
  'ENCOUNTER_DISCARD',
  'PLAYER_HAND',
] as const;
export const SELECTED_DESTINATION_OPTIONS = [
  'HAND',
  'TABLEAU',
  'DECK_TOP',
  'DISCARD',
  'ATTACH_TO_TARGET',
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
  DRAW_CARDS: {
    effect: 'DRAW_CARDS',
    description: 'Draw specified number of cards from deck into hand.',
    parameters: [
      {
        key: 'count',
        label: 'Card Count',
        type: 'number',
        defaultValue: 1,
        placeholder: '1',
        description: 'Number of cards to draw (RR v1.8 p. 12)',
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
  DRAW_UP_TO_HAND_SIZE: {
    effect: 'DRAW_UP_TO_HAND_SIZE',
    description: 'Draw cards until player reaches their maximum hand size.',
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
  CHANGE_FORM_DRAW_TO_HAND_SIZE: {
    effect: 'CHANGE_FORM_DRAW_TO_HAND_SIZE',
    description: 'Change identity form and draw up to hand size.',
    parameters: [],
  },

  // 2. Damage & Combat Primitives
  DEAL_DAMAGE: {
    effect: 'DEAL_DAMAGE',
    description: 'Deal damage to a target character or enemy.',
    parameters: [
      {
        key: 'amount',
        label: 'Damage Amount',
        type: 'number',
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
        key: 'amountFormula',
        label: 'Dynamic Formula',
        type: 'select',
        options: AMOUNT_FORMULA_OPTIONS,
        description: 'Dynamic damage calculation (RR v1.8 p. 11, 31)',
      },
      {
        key: 'max',
        label: 'Max Ceiling Cap',
        type: 'number',
        placeholder: 'e.g. 15',
        description: 'Optional upper ceiling limit for dynamic damage',
      },
      {
        key: 'overkill',
        label: 'Overkill',
        type: 'boolean',
        defaultValue: false,
        description: 'Excess damage routes to Villain (RR v1.8 p. 22)',
      },
      {
        key: 'aerialBonus',
        label: 'Aerial Bonus Damage',
        type: 'number',
        placeholder: 'e.g. 1',
      },
      {
        key: 'finisherBonus',
        label: 'Finisher Bonus Damage',
        type: 'number',
        placeholder: 'e.g. 2',
      },
    ],
  },
  DEAL_DAMAGE_ALL_ENEMIES: {
    effect: 'DEAL_DAMAGE_ALL_ENEMIES',
    description: 'Deal damage simultaneously to the Villain and all engaged Minions.',
    parameters: [
      {
        key: 'baseAmount',
        label: 'Base Damage Amount',
        type: 'number',
        defaultValue: 1,
        placeholder: '1',
      },
      {
        key: 'finisherBonus',
        label: 'Finisher Bonus',
        type: 'number',
        placeholder: 'e.g. 1',
      },
    ],
  },
  PREVENT_DAMAGE: {
    effect: 'PREVENT_DAMAGE',
    description: 'Prevent incoming attack or effect damage.',
    parameters: [
      {
        key: 'amount',
        label: 'Damage Prevented',
        type: 'number',
        placeholder: 'e.g. 3 or blank for all',
      },
      {
        key: 'target',
        label: 'Protected Target',
        type: 'select',
        options: TARGET_OPTIONS,
        defaultValue: 'SELF',
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
  HEAL_DAMAGE_WITH_SURGE: {
    effect: 'HEAL_DAMAGE_WITH_SURGE',
    description: 'Heal damage from target and trigger Surge keyword.',
    parameters: [
      {
        key: 'amount',
        label: 'Heal Amount',
        type: 'number',
        defaultValue: 1,
      },
      {
        key: 'target',
        label: 'Target',
        type: 'select',
        options: TARGET_OPTIONS,
        defaultValue: 'VILLAIN',
      },
    ],
  },
  TRANSFER_DAMAGE: {
    effect: 'TRANSFER_DAMAGE',
    description: 'Move damage from one character to another.',
    parameters: [
      {
        key: 'baseAmount',
        label: 'Amount',
        type: 'number',
        defaultValue: 1,
      },
      {
        key: 'from',
        label: 'Source Target',
        type: 'select',
        options: TARGET_OPTIONS,
      },
      {
        key: 'to',
        label: 'Destination Target',
        type: 'select',
        options: TARGET_OPTIONS,
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
        key: 'aerialAllSchemes',
        label: 'Aerial (Remove from all schemes)',
        type: 'boolean',
        defaultValue: false,
      },
      {
        key: 'bonusWithMental',
        label: 'Bonus Threat if Mental Resource Spent',
        type: 'number',
        placeholder: 'e.g. 1',
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
        key: 'target',
        label: 'Target Scheme',
        type: 'select',
        options: TARGET_OPTIONS,
        defaultValue: 'MAIN_SCHEME',
      },
    ],
  },
  ADD_THREAT_PER_PLAYER: {
    effect: 'ADD_THREAT_PER_PLAYER',
    description: 'Place threat scaled by total active player count.',
    parameters: [
      {
        key: 'amountPerPlayer',
        label: 'Threat Per Player',
        type: 'number',
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
    ],
  },
  PLACE_THREAT_PER_SIDE_SCHEME: {
    effect: 'PLACE_THREAT_PER_SIDE_SCHEME',
    description: 'Place threat scaled by number of active side schemes in play.',
    parameters: [
      {
        key: 'amount',
        label: 'Threat Per Side Scheme',
        type: 'number',
        defaultValue: 1,
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
  ADD_STATUS_WITH_SURGE: {
    effect: 'ADD_STATUS_WITH_SURGE',
    description: 'Apply status card and trigger Surge keyword.',
    parameters: [
      {
        key: 'status',
        label: 'Status Card',
        type: 'select',
        options: STATUS_OPTIONS,
        defaultValue: 'TOUGH',
      },
      {
        key: 'target',
        label: 'Target',
        type: 'select',
        options: TARGET_OPTIONS,
        defaultValue: 'VILLAIN',
      },
    ],
  },

  // 5. Counters & Resource Primitives
  GENERATE_RESOURCE: {
    effect: 'GENERATE_RESOURCE',
    description: 'Generate resource for cost payment or resource pool.',
    parameters: [
      {
        key: 'resource',
        label: 'Resource Type',
        type: 'select',
        options: RESOURCE_OPTIONS,
        defaultValue: 'wild',
      },
      {
        key: 'amount',
        label: 'Resource Amount',
        type: 'number',
        defaultValue: 1,
        placeholder: '1',
      },
    ],
  },
  GENERATE_TOP_DISCARD_RESOURCES: {
    effect: 'GENERATE_TOP_DISCARD_RESOURCES',
    description: 'Generate resources based on top card of discard pile (Pepper Potts).',
    parameters: [],
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
  ADD_COUNTER: {
    effect: 'ADD_COUNTER',
    description: 'Add a counter token to target card.',
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
  REMOVE_COUNTER: {
    effect: 'REMOVE_COUNTER',
    description: 'Remove counter token from target card.',
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
  MODIFY_COUNTER: {
    effect: 'MODIFY_COUNTER',
    description: 'Modify counter token quantity on host card.',
    parameters: [
      {
        key: 'amount',
        label: 'Amount (positive or negative)',
        type: 'number',
        placeholder: '1',
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
        defaultValue: 1,
        placeholder: 'e.g. 1 or -1',
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
  BOOST_STAT_CHOICE: {
    effect: 'BOOST_STAT_CHOICE',
    description: 'Prompt player to choose which stat to temporarily boost.',
    parameters: [
      {
        key: 'amount',
        label: 'Boost Amount',
        type: 'number',
        defaultValue: 1,
      },
    ],
  },
  BUFF_ALL_FRIENDLY_CHARACTERS: {
    effect: 'BUFF_ALL_FRIENDLY_CHARACTERS',
    description: 'Buff ATK/THW across all friendly characters in play (Lead from the Front).',
    parameters: [
      {
        key: 'atkBonus',
        label: 'ATK Bonus',
        type: 'number',
        placeholder: '1',
      },
      {
        key: 'thwBonus',
        label: 'THW Bonus',
        type: 'number',
        placeholder: '1',
      },
      {
        key: 'duration',
        label: 'Duration',
        type: 'select',
        options: DURATION_OPTIONS,
        defaultValue: 'UNTIL_END_OF_PHASE',
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
    description: 'Modify effective hand size (e.g. Iron Man Tech hand size scaling).',
    parameters: [
      {
        key: 'amount',
        label: 'Hand Size Delta',
        type: 'number',
        placeholder: '1',
      },
      {
        key: 'scaling',
        label: 'Scaling Mode',
        type: 'select',
        options: ['PER_MATCHING_CARD'],
        description: 'Scale hand size dynamically per matching card in tableau',
      },
      {
        key: 'multiplier',
        label: 'Scaling Multiplier',
        type: 'number',
        placeholder: '1',
        defaultValue: 1,
      },
      {
        key: 'filter',
        label: 'Matching Card Filter',
        type: 'card-filter',
        description: 'Universal card filter to match cards for hand size bonus',
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
  ALLY_LIMIT_BONUS: {
    effect: 'ALLY_LIMIT_BONUS',
    description: 'Grant bonus ally limit slots to player tableau.',
    parameters: [
      {
        key: 'amount',
        label: 'Bonus Ally Slots',
        type: 'number',
        defaultValue: 1,
      },
    ],
  },
  RESTRICTED_LIMIT_BONUS: {
    effect: 'RESTRICTED_LIMIT_BONUS',
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
  SEARCH_AND_SELECT: {
    effect: 'SEARCH_AND_SELECT',
    description: 'Search zone, look at Top-N or find cards, and route selected/unselected piles.',
    parameters: [
      {
        key: 'source',
        label: 'Search Source Zone',
        type: 'select',
        options: SEARCH_SOURCE_OPTIONS,
        defaultValue: 'PLAYER_DECK',
        description: 'Source zone to search (PLAYER_DECK, ENCOUNTER_DECK, PLAYER_DISCARD, etc.).',
      },
      {
        key: 'lookCount',
        label: 'Look Count (Top N Cards)',
        type: 'number',
        placeholder: 'e.g. 3 (leave blank for entire deck search)',
        description: 'Number of top cards to look at. Leave blank to search entire zone.',
      },
      {
        key: 'takeCount',
        label: 'Take Count (Cards to choose)',
        type: 'number',
        defaultValue: 1,
        placeholder: '1',
        description: 'Number of cards the player may select.',
      },
      {
        key: 'filter',
        label: 'Candidate Card Filter',
        type: 'card-filter',
        description: 'Universal card filter defining eligible cards player can select',
      },
      {
        key: 'selectedDestination',
        label: 'Selected Destination',
        type: 'select',
        options: SELECTED_DESTINATION_OPTIONS,
        defaultValue: 'HAND',
        description: 'Destination zone for selected cards (HAND, TABLEAU, DECK_TOP, etc.).',
      },
      {
        key: 'unselectedDestination',
        label: 'Unselected Destination',
        type: 'select',
        options: UNSELECTED_DESTINATION_OPTIONS,
        defaultValue: 'DISCARD',
        description: 'Destination zone for remaining looked cards (DISCARD, DECK_BOTTOM, etc.).',
      },
      {
        key: 'shuffleAfter',
        label: 'Shuffle Deck After Search',
        type: 'boolean',
        defaultValue: false,
        description: 'Whether to shuffle the deck after resolving the search.',
      },
      {
        key: 'isVoluntary',
        label: 'Voluntary Choice (May choose 0)',
        type: 'boolean',
        defaultValue: false,
        description: 'Whether player can decline or choose fewer than takeCount cards.',
      },
      {
        key: 'promptTitle',
        label: 'Prompt Title (Optional)',
        type: 'text',
        placeholder: 'e.g. Choose 1 card to add to hand',
        description: 'User-facing prompt title displayed during selection dialog.',
      },
    ],
  },
  SEARCH_AND_PLAY_UPGRADE: {
    effect: 'SEARCH_AND_PLAY_UPGRADE',
    description: 'Search deck or discard for an upgrade and put into play.',
    parameters: [],
  },
  SEARCH_AND_REVEAL_SIDE_SCHEME: {
    effect: 'SEARCH_AND_REVEAL_SIDE_SCHEME',
    description: 'Search encounter deck for side scheme and reveal it.',
    parameters: [
      {
        key: 'targetCardCode',
        label: 'Side Scheme Card Code',
        type: 'text',
        placeholder: 'e.g. 01107',
      },
    ],
  },

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
        options: ['HAND', 'PLAY', 'DISCARD'],
        defaultValue: 'DISCARD',
        description: 'Destination for discarded cards matching filter (e.g. HAND for Black Cat)',
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
  PLACE_CARD_UNDER_HOST: {
    effect: 'PLACE_CARD_UNDER_HOST',
    description: 'Place card underneath host card.',
    parameters: [],
  },
  RETURN_FACEDOWN_CARDS_TO_OWNERS: {
    effect: 'RETURN_FACEDOWN_CARDS_TO_OWNERS',
    description: 'Return facedown cards under host back to owner hands.',
    parameters: [],
  },
  RETURN_TO_HAND: {
    effect: 'RETURN_TO_HAND',
    description: 'Return target card in play back to its owner hand.',
    parameters: [
      {
        key: 'target',
        label: 'Target Card',
        type: 'select',
        options: TARGET_OPTIONS,
      },
    ],
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
      {
        key: 'target',
        label: 'Host Target',
        type: 'select',
        options: TARGET_OPTIONS,
        defaultValue: 'VILLAIN',
      },
    ],
  },
  WHEN_ATTACHED_HOST_DEFEATED: {
    effect: 'WHEN_ATTACHED_HOST_DEFEATED',
    description: 'Trigger child effect when attached host card is defeated.',
    parameters: [],
  },

  // 11. Form & Player Progression Primitives
  CHANGE_FORM: {
    effect: 'CHANGE_FORM',
    description: 'Flip between Hero and Alter-Ego identity forms (RR v1.8 p. 8).',
    parameters: [],
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
        key: 'target',
        label: 'Target Player',
        type: 'select',
        options: TARGET_OPTIONS,
        defaultValue: 'SELF',
      },
    ],
  },
  COST_REDUCER: {
    effect: 'COST_REDUCER',
    description: 'Reduce cost of played cards meeting specific criteria.',
    parameters: [
      {
        key: 'amount',
        label: 'Reduction Amount',
        type: 'number',
        defaultValue: 1,
      },
    ],
  },
  PLAY_ALLY_FROM_DISCARD: {
    effect: 'PLAY_ALLY_FROM_DISCARD',
    description: 'Play an ally card from discard pile (Make the Call).',
    parameters: [
      {
        key: 'target',
        label: 'Target',
        type: 'select',
        options: TARGET_OPTIONS,
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
        key: 'filter',
        label: 'Target Card Filter',
        type: 'card-filter',
        description: 'Universal card filter to match eligible card to put into play',
      },
    ],
  },
  PUT_INTO_PLAY_ENGAGED: {
    effect: 'PUT_INTO_PLAY_ENGAGED',
    description: 'Put minion into play engaged with target player.',
    parameters: [],
  },
  RETRIEVE_CARD_FROM_DISCARD: {
    effect: 'RETRIEVE_CARD_FROM_DISCARD',
    description: 'Retrieve card from player discard pile.',
    parameters: [],
  },
  RETRIEVE_TECH_UPGRADE_FROM_DISCARD: {
    effect: 'RETRIEVE_TECH_UPGRADE_FROM_DISCARD',
    description: 'Retrieve Tech upgrade from discard pile (Stark Tower).',
    parameters: [],
  },
  SHUFFLE_DISCARD_INTO_DECK: {
    effect: 'SHUFFLE_DISCARD_INTO_DECK',
    description: 'Shuffle cards from discard pile back into draw deck.',
    parameters: [
      {
        key: 'count',
        label: 'Card Count',
        type: 'number',
        placeholder: 'e.g. 3',
      },
    ],
  },
  SHUFFLE_INTO_DECK: {
    effect: 'SHUFFLE_INTO_DECK',
    description: 'Shuffle card into deck.',
    parameters: [],
  },

  // 12. Villain & Encounter Deck Actions
  VILLAIN_ATTACKS: {
    effect: 'VILLAIN_ATTACKS',
    description: 'Induce the Villain to immediately initiate an attack against player.',
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
  TRIGGER_SURGE: {
    effect: 'TRIGGER_SURGE',
    description: 'Trigger Surge keyword conditionally.',
    parameters: [],
  },
  REVEAL_ENCOUNTER_CARD: {
    effect: 'REVEAL_ENCOUNTER_CARD',
    description: 'Reveal top card of encounter deck.',
    parameters: [],
  },
  REVEAL_ENCOUNTER_CARD_WITH_SURGE: {
    effect: 'REVEAL_ENCOUNTER_CARD_WITH_SURGE',
    description: 'Reveal encounter card and trigger Surge.',
    parameters: [],
  },
  DEAL_ADDITIONAL_BOOST_CARD: {
    effect: 'DEAL_ADDITIONAL_BOOST_CARD',
    description: 'Deal an additional boost card to villain activation.',
    parameters: [],
  },
  GIVE_ADDITIONAL_BOOST_CARD: {
    effect: 'GIVE_ADDITIONAL_BOOST_CARD',
    description: 'Deal additional facedown boost card to activating enemy.',
    parameters: [],
  },
  SPAWN_MINION_ENGAGED: {
    effect: 'SPAWN_MINION_ENGAGED',
    description: 'Spawn minion engaged with target player.',
    parameters: [],
  },
  SPAWN_NEMESIS: {
    effect: 'SPAWN_NEMESIS',
    description: 'Spawn Nemesis minion and side scheme (Shadow of the Past).',
    parameters: [],
  },

  // 13. Cancellation & Interrupts
  CANCEL_TREACHERY_AND_VILLAIN_ATTACKS: {
    effect: 'CANCEL_TREACHERY_AND_VILLAIN_ATTACKS',
    description: 'Cancel treachery effect and villain attack initiation.',
    parameters: [],
  },
  CANCEL_WHEN_REVEALED: {
    effect: 'CANCEL_WHEN_REVEALED',
    description: 'Cancel the "When Revealed" effect of an encounter card.',
    parameters: [],
  },
  CANCEL_WHEN_REVEALED_AND_ATTACK: {
    effect: 'CANCEL_WHEN_REVEALED_AND_ATTACK',
    description: 'Cancel When Revealed effect, but villain initiates attack instead.',
    parameters: [],
  },
  CANCEL_WHEN_REVEALED_AND_REVEAL_ANOTHER: {
    effect: 'CANCEL_WHEN_REVEALED_AND_REVEAL_ANOTHER',
    description: 'Cancel When Revealed effect and reveal another encounter card.',
    parameters: [],
  },
  DECLARE_DEFENDER: {
    effect: 'DECLARE_DEFENDER',
    description: 'Prompt player to declare a defender against an incoming enemy attack.',
    parameters: [],
  },
  INTERCEPT_ATTACK: {
    effect: 'INTERCEPT_ATTACK',
    description: 'Intercept incoming attack directed at another friendly character.',
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
  TRIGGER_WAKANDA_UPGRADES: {
    effect: 'TRIGGER_WAKANDA_UPGRADES',
    description: 'Trigger Black Panther suit upgrades in player-selected sequence.',
    parameters: [],
  },
  REPULSOR_BLAST: {
    effect: 'REPULSOR_BLAST',
    description: 'Discard cards and deal damage based on energy icons (Iron Man).',
    parameters: [
      {
        key: 'discardCount',
        label: 'Cards to Discard',
        type: 'number',
        defaultValue: 5,
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
  REPULSOR_BLAST_DAMAGE: {
    effect: 'REPULSOR_BLAST_DAMAGE',
    description: 'Deal calculated Repulsor Blast energy damage.',
    parameters: [],
  },
  HULK_DISCARD_RESOLUTION: {
    effect: 'HULK_DISCARD_RESOLUTION',
    description: 'Resolve Hulk ally mandatory turn-end card discard and effect.',
    parameters: [],
  },
  EXPLOSION: {
    effect: 'EXPLOSION',
    description: 'Bomb Scare: Deal 1 damage to each hero in play.',
    parameters: [],
  },
  FORM_BRANCH_VILLAIN_ATTACK_OR_SURGE: {
    effect: 'FORM_BRANCH_VILLAIN_ATTACK_OR_SURGE',
    description: 'Branch based on form: Hero = Villain attacks, Alter-Ego = Surge.',
    parameters: [],
  },
  HERO_FORM_BRANCH: {
    effect: 'HERO_FORM_BRANCH',
    description: 'Branch based on hero form state.',
    parameters: [],
  },
  NICK_FURY_CHOICE: {
    effect: 'NICK_FURY_CHOICE',
    description: 'Nick Fury enter-play choice: draw 3, remove 2 threat, or 4 damage.',
    parameters: [],
  },
  PLAYER_CHOICE: {
    effect: 'PLAYER_CHOICE',
    description: 'Prompt player to choose between multiple options.',
    parameters: [],
  },
  TAKE_THREAT_AS_DAMAGE: {
    effect: 'TAKE_THREAT_AS_DAMAGE',
    description: 'Take threat on identity as direct damage.',
    parameters: [],
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
