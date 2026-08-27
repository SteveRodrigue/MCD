import { CardType, FactionCode } from './enums';

/**
 * Raw upstream card structure matching data/upstream/schema/card_schema.json
 */
export interface RawUpstreamCard {
  code: string;
  name: string;
  subname?: string;
  type_code: string;
  faction_code: string;
  pack_code: string;
  position: number;
  quantity: number;
  deck_limit?: number;
  is_unique?: boolean;
  stage?: string;
  cost?: number;
  cost_per_hero?: boolean;
  cost_star?: boolean;
  text?: string;
  flavor?: string;
  traits?: string;
  hand_size?: number;
  health?: number;
  health_per_hero?: boolean;
  health_star?: boolean;
  thwart?: number | null;
  thwart_cost?: number;
  thwart_star?: boolean;
  attack?: number | null;
  attack_cost?: number;
  attack_star?: boolean;
  defense?: number;
  defense_star?: boolean;
  recover?: number;
  recover_star?: boolean;
  scheme?: number;
  scheme_star?: boolean;
  base_threat?: number | null;
  base_threat_fixed?: boolean;
  escalation_threat?: number | null;
  escalation_threat_fixed?: boolean;
  threat?: number | null;
  boost?: number;
  boost_star?: boolean;
  back_link?: string;
  set_code?: string;
  set_position?: number;
  resource_physical?: number;
  resource_energy?: number;
  resource_mental?: number;
  resource_wild?: number;
  scheme_acceleration?: number;
  scheme_crisis?: number;
  scheme_hazard?: number;
  scheme_amplify?: number;
  permanent?: boolean;
  double_sided?: boolean;
  illustrator?: string;
  octgn_id?: string | null;
  meta?: Record<string, unknown>;
  duplicate_of?: string;
  errata?: string;
}

/**
 * Clean, normalized resource yields provided when paying or discarding
 */
export interface CardResources {
  physical: number;
  energy: number;
  mental: number;
  wild: number;
  total: number;
}

/**
 * Base normalized card model used across engine and UI
 */
export interface NormalizedCard {
  code: string;
  name: string;
  subname?: string;
  type: CardType;
  faction: FactionCode;
  packCode: string;
  position: number;
  quantity: number;
  deckLimit: number;
  isUnique: boolean;
  cost?: number;
  costPerHero?: boolean;
  text: string;
  flavor?: string;
  traits: string[];
  resources: CardResources;
  setCode?: string;
  setPosition?: number;
  backLink?: string;
  boostIcons?: number;
  boostStar?: boolean;
  errata?: string;
  enrichment?: import('./abilities').CardEnrichment;
  raw: RawUpstreamCard;
}

/**
 * Hero Form Identity Card
 */
export interface HeroCard extends NormalizedCard {
  type: CardType.HERO;
  handSize: number;
  health: number;
  thwart: number;
  thwartStar?: boolean;
  attack: number;
  attackStar?: boolean;
  defense: number;
  defenseStar?: boolean;
  alterEgoCode: string;
}

/**
 * Alter-Ego Form Identity Card
 */
export interface AlterEgoCard extends NormalizedCard {
  type: CardType.ALTER_EGO;
  handSize: number;
  health: number;
  recover: number;
  recoverStar?: boolean;
  heroCode?: string;
}

/**
 * Ally Card
 */
export interface AllyCard extends NormalizedCard {
  type: CardType.ALLY;
  cost: number;
  health: number;
  thwart: number;
  thwartCost?: number;
  attack: number;
  attackCost?: number;
}

/**
 * Villain Card (e.g. Rhino I, Rhino II)
 */
export interface VillainCard extends NormalizedCard {
  type: CardType.VILLAIN;
  stage: string;
  health: number;
  healthPerHero: boolean;
  scheme: number;
  schemeStar?: boolean;
  attack: number;
  attackStar?: boolean;
}

/**
 * Main Scheme Card (e.g. The Break-In!)
 */
export interface MainSchemeCard extends NormalizedCard {
  type: CardType.MAIN_SCHEME;
  stage: string;
  baseThreat: number;
  baseThreatFixed?: boolean;
  escalationThreat: number;
  escalationThreatFixed?: boolean;
  targetThreat: number; // Target threat per hero before advancing/losing
}

/**
 * Side Scheme Card (e.g. Bomb Scare, Crowd Control)
 */
export interface SideSchemeCard extends NormalizedCard {
  type: CardType.SIDE_SCHEME;
  baseThreat: number;
  baseThreatFixed?: boolean;
  hasCrisis: boolean;
  hasHazard: boolean;
  hasAcceleration: boolean;
  hasAmplify: boolean;
}

/**
 * Minion Card (e.g. Hydra Soldier, Armored Rhino)
 */
export interface MinionCard extends NormalizedCard {
  type: CardType.MINION;
  scheme: number;
  attack: number;
  health: number;
  boostIcons?: number;
  boostStar?: boolean;
}
