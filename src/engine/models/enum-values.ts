/**
 * Marvel Champions Digital - Enum string values as plain arrays.
 *
 * A leaf file with no enums, so Node-side tooling (the Vite config graph, loaded natively with type
 * stripping) can use the values without loading `enums.ts`, which declares TypeScript enums. A test
 * keeps these lists equal to the enums.
 */

export const CARD_TYPE_VALUES = [
  'hero',
  'alter_ego',
  'ally',
  'event',
  'resource',
  'upgrade',
  'support',
  'villain',
  'main_scheme',
  'side_scheme',
  'player_side_scheme',
  'minion',
  'attachment',
  'treachery',
  'obligation',
  'environment',
] as const;

export const RESOURCE_TYPE_VALUES = ['physical', 'energy', 'mental', 'wild'] as const;

export const KEYWORD_VALUES = [
  'Guard',
  'Patrol',
  'Amplify',
  'Acceleration',
  'Toughness',
  'Overkill',
  'Piercing',
  'Quickstrike',
  'Ranged',
  'Retaliate',
  'Surge',
  'Permanent',
  'Restricted',
  'Uses',
  'Victory',
  'Setup',
  'Teamwork',
  'Stalwart',
  'Steady',
  'Villainous',
  'Incite',
  'Hinder',
] as const;
