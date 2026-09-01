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
import { CardEnrichment, Keyword } from '@engine/models';

/**
 * Parses printed and supplemental keywords for a card.
 */
export function parseKeywords(raw: RawUpstreamCard, enrichment?: CardEnrichment): Keyword[] {
  const keywords = new Set<Keyword>();
  const text = (raw.text || '').toLowerCase();

  if (text.includes('restricted.') || text.includes('<b>restricted</b>') || (raw as any).restricted) {
    keywords.add(Keyword.RESTRICTED);
  }
  if (text.includes('permanent.') || text.includes('<b>permanent</b>') || raw.permanent) {
    keywords.add(Keyword.PERMANENT);
  }
  if (text.includes('guard.') || text.includes('<b>guard</b>') || text.includes('guard <i>')) {
    keywords.add(Keyword.GUARD);
  }
  if (text.includes('patrol.') || text.includes('<b>patrol</b>') || text.includes('patrol <i>')) {
    keywords.add(Keyword.PATROL);
  }
  if (text.includes('crisis.') || text.includes('<b>crisis</b>') || text.includes('crisis <i>') || raw.scheme_crisis) {
    keywords.add(Keyword.CRISIS);
  }
  if (text.includes('hazard.') || text.includes('<b>hazard</b>') || text.includes('hazard <i>') || raw.scheme_hazard) {
    keywords.add(Keyword.HAZARD);
  }
  if (text.includes('overkill.') || text.includes('<b>overkill</b>') || text.includes('overkill <i>')) {
    keywords.add(Keyword.OVERKILL);
  }
  if (text.includes('piercing.') || text.includes('<b>piercing</b>') || text.includes('piercing <i>')) {
    keywords.add(Keyword.PIERCING);
  }
  if (text.includes('quickstrike.') || text.includes('<b>quickstrike</b>') || text.includes('quickstrike <i>')) {
    keywords.add(Keyword.QUICKSTRIKE);
  }
  if (text.includes('ranged.') || text.includes('<b>ranged</b>') || text.includes('ranged <i>')) {
    keywords.add(Keyword.RANGED);
  }
  if (text.includes('retaliate') || text.includes('<b>retaliate</b>')) {
    keywords.add(Keyword.RETALIATE);
  }
  if (text.includes('surge.') || text.includes('<b>surge</b>') || text.includes('surge <i>')) {
    keywords.add(Keyword.SURGE);
  }
  if (text.includes('toughness.') || text.includes('<b>toughness</b>') || text.includes('toughness <i>')) {
    keywords.add(Keyword.TOUGH);
  }

  if ((enrichment as any)?.keywords) {
    for (const kw of (enrichment as any).keywords) {
      keywords.add(kw as Keyword);
    }
  }

  return Array.from(keywords);
}

/**
 * Converts a raw upstream MarvelsDB card into a normalized, strongly-typed card,
 * enriching it with supplemental abilities and trigger definitions.
 */
export function normalizeRawCard(
  raw: RawUpstreamCard,
  supplementalEffects: Record<string, CardEnrichment> = supplementalRegistry,
): NormalizedCard {
  const enrichment = supplementalEffects[raw.code];

  const isLandscape =
    enrichment?.isLandscape !== undefined
      ? enrichment.isLandscape
      : raw.type_code === CardType.MAIN_SCHEME ||
        raw.type_code === CardType.SIDE_SCHEME ||
        raw.type_code === 'main_scheme' ||
        raw.type_code === 'side_scheme' ||
        raw.type_code === 'player_side_scheme';

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
    keywords: parseKeywords(raw, enrichment),
    resources: parseResources(raw),
    setCode: raw.set_code,
    setPosition: raw.set_position,
    backLink: raw.back_link,
    boostIcons: raw.boost,
    boostStar: !!raw.boost_star,
    errata: raw.errata,
    isLandscape,
    orientation: isLandscape ? 'landscape' : 'portrait',
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
      const enrichmentAttackCost = enrichment?.attackCost;
      const enrichmentThwartCost = enrichment?.thwartCost;
      return {
        ...base,
        type: CardType.ALLY,
        health: raw.health || 2,
        thwart: raw.thwart ?? 1,
        thwartCost: enrichmentThwartCost !== undefined ? enrichmentThwartCost : (raw.thwart_cost !== undefined ? raw.thwart_cost : 1),
        attack: raw.attack ?? 1,
        attackCost:
          enrichmentAttackCost !== undefined
            ? enrichmentAttackCost
            : raw.attack_cost !== undefined
              ? raw.attack_cost
              : (raw.text || '').toLowerCase().includes('does not take consequential damage after attacking')
                ? 0
                : 1,
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

  public getNemesisCardsForHero(heroSetCode: string): NormalizedCard[] {
    const nemesisSetCode = `${heroSetCode}_nemesis`;
    const setCards = this.getCardsBySet(nemesisSetCode);
    const result: NormalizedCard[] = [];
    for (const card of setCards) {
      for (let q = 0; q < (card.quantity || 1); q++) {
        result.push(card);
      }
    }
    return result;
  }

  /**
   * Resolves a Main Scheme card for a specific encounter stage (e.g., '1B', '2B', '3B')
   * by filtering the scenario encounter set on canonical card.stage.
   */
  public getMainSchemeByStage(scenarioSetCode: string, stage: string): MainSchemeCard | undefined {
    const setCards = this.getCardsBySet(scenarioSetCode);
    return setCards.find(
      (c) =>
        (c.type === CardType.MAIN_SCHEME || (c as any).type_code === 'main_scheme') &&
        (c as MainSchemeCard).stage?.toUpperCase() === stage.toUpperCase(),
    ) as MainSchemeCard | undefined;
  }

  /**
   * Resolves a Villain card for a specific villain stage (e.g., 'I', 'II', 'III')
   * by filtering the scenario encounter set on canonical card.stage.
   */
  public getVillainByStage(scenarioSetCode: string, stage: string): VillainCard | undefined {
    const setCards = this.getCardsBySet(scenarioSetCode);
    return setCards.find(
      (c) =>
        (c.type === CardType.VILLAIN || (c as any).type_code === 'villain') &&
        (c as VillainCard).stage?.toUpperCase() === stage.toUpperCase(),
    ) as VillainCard | undefined;
  }
}

import coreCards from '../../../data/upstream/pack/core.json';
import coreEncounterCards from '../../../data/upstream/pack/core_encounter.json';

export const cardCatalog = new CardCatalog([...coreCards, ...coreEncounterCards] as any);


