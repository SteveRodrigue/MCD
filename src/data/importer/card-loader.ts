import {
  CardType,
  FactionCode,
  RawUpstreamCard,
  NormalizedCard,
  HeroCard,
  AlterEgoCard,
  VillainCard,
  MainSchemeCard,
  SideSchemeCard,
  MinionCard,
  AllyCard,
} from '@engine/models';

/**
 * Splits raw MarvelsDB traits string (e.g., "Avenger. Genius.") into clean array.
 */
export function parseTraits(traitsStr?: string): string[] {
  if (!traitsStr || typeof traitsStr !== 'string') return [];
  return traitsStr
    .split('.')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/**
 * Normalizes resource yield counts for a card.
 */
export function parseResources(raw: RawUpstreamCard) {
  const physical = raw.resource_physical || 0;
  const energy = raw.resource_energy || 0;
  const mental = raw.resource_mental || 0;
  const wild = raw.resource_wild || 0;
  return {
    physical,
    energy,
    mental,
    wild,
    total: physical + energy + mental + wild,
  };
}

import { supplementalRegistry } from '../supplemental';
import { CardEnrichment } from '@engine/models';

/**
 * Converts a raw upstream MarvelsDB card into a normalized, strongly-typed card,
 * enriching it with supplemental abilities and trigger definitions.
 */
export function normalizeRawCard(
  raw: RawUpstreamCard,
  supplementalEffects: Record<string, CardEnrichment> = supplementalRegistry,
): NormalizedCard {
  const enrichment = supplementalEffects[raw.code];

  const base: NormalizedCard = {
    code: raw.code,
    name: raw.name,
    subname: raw.subname,
    type: raw.type_code as CardType,
    faction: raw.faction_code as FactionCode,
    packCode: raw.pack_code,
    position: raw.position,
    quantity: raw.quantity || 1,
    deckLimit: raw.deck_limit || 1,
    isUnique: !!raw.is_unique,
    cost: raw.cost,
    costPerHero: !!raw.cost_per_hero,
    text: raw.text || '',
    flavor: raw.flavor,
    traits: parseTraits(raw.traits),
    resources: parseResources(raw),
    setCode: raw.set_code,
    setPosition: raw.set_position,
    backLink: raw.back_link,
    boostIcons: raw.boost,
    boostStar: !!raw.boost_star,
    errata: raw.errata,
    enrichment,
    raw,
  };

  switch (base.type) {
    case CardType.HERO: {
      return {
        ...base,
        type: CardType.HERO,
        handSize: raw.hand_size || 5,
        health: raw.health || 10,
        thwart: raw.thwart ?? 0,
        thwartStar: !!raw.thwart_star,
        attack: raw.attack ?? 0,
        attackStar: !!raw.attack_star,
        defense: raw.defense ?? 0,
        defenseStar: !!raw.defense_star,
        alterEgoCode: raw.back_link || '',
      } as HeroCard;
    }
    case CardType.ALTER_EGO: {
      return {
        ...base,
        type: CardType.ALTER_EGO,
        handSize: raw.hand_size || 6,
        health: raw.health || 10,
        recover: raw.recover ?? 0,
        recoverStar: !!raw.recover_star,
        heroCode: raw.back_link,
      } as AlterEgoCard;
    }
    case CardType.VILLAIN: {
      return {
        ...base,
        type: CardType.VILLAIN,
        stage: raw.stage || 'I',
        health: raw.health || 0,
        healthPerHero: !!raw.health_per_hero,
        scheme: raw.scheme ?? 0,
        schemeStar: !!raw.scheme_star,
        attack: raw.attack ?? 0,
        attackStar: !!raw.attack_star,
      } as VillainCard;
    }
    case CardType.MAIN_SCHEME: {
      return {
        ...base,
        type: CardType.MAIN_SCHEME,
        stage: raw.stage || '1A',
        baseThreat: raw.base_threat ?? 0,
        baseThreatFixed: !!raw.base_threat_fixed,
        escalationThreat: raw.escalation_threat ?? 1,
        escalationThreatFixed: !!raw.escalation_threat_fixed,
        targetThreat: raw.threat ?? 0,
      } as MainSchemeCard;
    }
    case CardType.SIDE_SCHEME: {
      return {
        ...base,
        type: CardType.SIDE_SCHEME,
        baseThreat: raw.base_threat ?? 0,
        baseThreatFixed: !!raw.base_threat_fixed,
        hasCrisis: (raw.scheme_crisis || 0) > 0,
        hasHazard: (raw.scheme_hazard || 0) > 0,
        hasAcceleration: (raw.scheme_acceleration || 0) > 0,
        hasAmplify: (raw.scheme_amplify || 0) > 0,
      } as SideSchemeCard;
    }
    case CardType.ALLY: {
      return {
        ...base,
        type: CardType.ALLY,
        health: raw.health || 2,
        thwart: raw.thwart ?? 1,
        thwartCost: raw.thwart_cost !== undefined ? raw.thwart_cost : 1,
        attack: raw.attack ?? 1,
        attackCost: raw.attack_cost !== undefined ? raw.attack_cost : (raw.code === '01002' ? 0 : 1),
      } as AllyCard;
    }
    case CardType.MINION: {
      return {
        ...base,
        type: CardType.MINION,
        scheme: raw.scheme ?? 0,
        attack: raw.attack ?? 0,
        health: raw.health ?? 1,
        boostIcons: raw.boost,
        boostStar: !!raw.boost_star,
      } as MinionCard;
    }
    default:
      return base;
  }
}

/**
 * Card Catalog Repository
 */
export class CardCatalog {
  private cards: Map<string, NormalizedCard> = new Map();

  constructor(initialCards: RawUpstreamCard[] = []) {
    this.registerCards(initialCards);
  }

  public registerCards(rawCards: RawUpstreamCard[]): void {
    for (const raw of rawCards) {
      const normalized = normalizeRawCard(raw);
      this.cards.set(normalized.code, normalized);
    }
  }

  public getCard(code: string): NormalizedCard | undefined {
    return this.cards.get(code);
  }

  public getAllCards(): NormalizedCard[] {
    return Array.from(this.cards.values());
  }

  public getCardsBySet(setCode: string): NormalizedCard[] {
    return this.getAllCards().filter((c) => c.setCode === setCode);
  }

  public getCardsByFaction(faction: FactionCode): NormalizedCard[] {
    return this.getAllCards().filter((c) => c.faction === faction);
  }

  public getCardsByType(type: CardType): NormalizedCard[] {
    return this.getAllCards().filter((c) => c.type === type);
  }

  public getHeroIdentity(heroSetCode: string): { hero: HeroCard; alterEgo: AlterEgoCard } | undefined {
    const setCards = this.getCardsBySet(heroSetCode);
    const hero = setCards.find((c) => c.type === CardType.HERO) as HeroCard | undefined;
    const alterEgo = setCards.find((c) => c.type === CardType.ALTER_EGO) as AlterEgoCard | undefined;

    if (hero && alterEgo) {
      return { hero, alterEgo };
    }
    return undefined;
  }
}
