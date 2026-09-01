/**
 * Marvel Champions Digital - Core Enums
 * Aligned 1-to-1 with data/upstream schemas (types.json, factions.json, card_schema.json).
 */

export enum CardType {
  HERO = 'hero',
  ALTER_EGO = 'alter_ego',
  ALLY = 'ally',
  EVENT = 'event',
  RESOURCE = 'resource',
  UPGRADE = 'upgrade',
  SUPPORT = 'support',
  VILLAIN = 'villain',
  MAIN_SCHEME = 'main_scheme',
  SIDE_SCHEME = 'side_scheme',
  PLAYER_SIDE_SCHEME = 'player_side_scheme',
  MINION = 'minion',
  ATTACHMENT = 'attachment',
  TREACHERY = 'treachery',
  OBLIGATION = 'obligation',
  ENVIRONMENT = 'environment',
}

export enum FactionCode {
  HERO = 'hero',
  BASIC = 'basic',
  AGGRESSION = 'aggression',
  JUSTICE = 'justice',
  LEADERSHIP = 'leadership',
  PROTECTION = 'protection',
  ENCOUNTER = 'encounter',
  CAMPAIGN = 'campaign',
  POOL = 'pool',
}

export enum ResourceType {
  PHYSICAL = 'physical',
  ENERGY = 'energy',
  MENTAL = 'mental',
  WILD = 'wild',
}

export enum Keyword {
  GUARD = 'Guard',
  PATROL = 'Patrol',
  CRISIS = 'Crisis',
  HAZARD = 'Hazard',
  AMPLIFY = 'Amplify',
  ACCELERATION = 'Acceleration',
  TOUGH = 'Tough',
  OVERKILL = 'Overkill',
  PIERCING = 'Piercing',
  QUICKSTRIKE = 'Quickstrike',
  RANGED = 'Ranged',
  RETALIATE = 'Retaliate',
  SURGE = 'Surge',
  PERMANENT = 'Permanent',
  RESTRICTED = 'Restricted',
  USES = 'Uses',
  VICTORY = 'Victory',
  SETUP = 'Setup',
  TEAMWORK = 'Teamwork',
  STALWART = 'Stalwart',
  STEADY = 'Steady',
  VILLAINOUS = 'Villainous',
  INCITE = 'Incite',
  HINDER = 'Hinder',
}

export enum StatusCard {
  TOUGH = 'Tough',
  STUNNED = 'Stunned',
  CONFUSED = 'Confused',
}
