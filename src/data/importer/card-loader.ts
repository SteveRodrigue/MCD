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
  PlayerSideSchemeCard,
  MinionCard,
  AllyCard,
  AbilityTiming,
  CharacterPower,
} from '@engine/models';

/**
 * Splits raw MarvelsDB traits string (e.g., "Avenger. Genius.", "S.H.I.E.L.D. Soldier.") into clean array.
 * Preserves acronyms with internal periods (e.g., "S.H.I.E.L.D.", "A.I.M.") without decomposing them into single letters.
 */
export function parseTraits(traitsStr?: string): string[] {
  if (!traitsStr || typeof traitsStr !== 'string') return [];
  const trimmed = traitsStr.trim();
  if (!trimmed) return [];

  // Split tokens by delimiter ('.' or '!') followed by whitespace, or at end-of-string.
  // In Marvel Champions cards, individual traits are separated by a delimiter and whitespace.
  // Acronyms (e.g. S.H.I.E.L.D., A.I.M.) have periods directly between letters without whitespace.
  const chunks = trimmed.split(/(?<=[.!?])\s+/);

  return chunks
    .map((chunk) => {
      let t = chunk.trim();
      // If the token matches an acronym with periods after each letter (e.g. "S.H.I.E.L.D." or "A.I.M.")
      if (/^(?:[A-Za-z]\.)+$/.test(t)) {
        return t;
      }
      // If the acronym is missing its trailing period (e.g. "S.H.I.E.L.D"), add it back
      if (/^(?:[A-Za-z]\.)+[A-Za-z]$/.test(t)) {
        return `${t}.`;
      }
      // Otherwise, strip any trailing period if not part of an acronym
      if (t.endsWith('.')) {
        t = t.slice(0, -1).trim();
      }
      return t;
    })
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

/**
 * Parses the "Max [X] per player" board limit for a card (RR v1.8 p. 17).
 * Filters out parenthesized Restricted reminder text: "(Max 2 restricted cards per player.)".
 */
export function parseMaxPerPlayer(raw: RawUpstreamCard): number | undefined {
  const rawText = raw.text || '';
  if (!rawText) return undefined;

  // Remove parenthesized reminder text (e.g. "(Max 2 restricted cards per player.)")
  const textWithoutParentheses = rawText.replace(/\([^)]*\)/g, '');

  // Match "Max X per player" or "Max X [Trait] card per player"
  const match = textWithoutParentheses.match(/\bmax\s+(\d+)(?:\s+\[\[?[^\]]+\]\]?)?\s*(?:card)?\s+per\s+player\b/i);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }

  return undefined;
}

import { supplementalRegistry } from '../supplemental';
import { CardEnrichment, Keyword } from '@engine/models';

/**
 * The sentences of a card text that stand on their own: split by line and `<hr />`, italic reminder
 * text and bold tags removed, then split at periods. A keyword is printed when it is one of them.
 */
function* printedSentences(text: string | undefined): Generator<string> {
  if (!text) return;
  for (const line of text.split(/\r?\n|<hr\s*\/?>/i)) {
    const stripped = line.replace(/<i>[\s\S]*?<\/i>/gi, '').replace(/<\/?b>/gi, '');
    for (const sentence of stripped.split('.')) {
      yield sentence.trim().toLowerCase();
    }
  }
}

function printedKeywordPattern(keyword: string): RegExp {
  return new RegExp(`^${keyword.toLowerCase().replace(/[^a-z]/g, '')}(\\s+(-?\\d+))?$`);
}

/**
 * True when the card prints `keyword` as its own sentence of a text line (`Surge.`,
 * `Surge <i>(reminder)</i>`, `Surge .`, a bare `Surge`, `Toughness.` on a second line), ignoring
 * italic reminder text and bold tags. A card that merely mentions the word to grant it ("this card
 * gains surge.") does not print the keyword. Optional trailing number (`Retaliate 2`).
 */
export function hasPrintedKeyword(text: string | undefined, keyword: string): boolean {
  const pattern = printedKeywordPattern(keyword);
  for (const sentence of printedSentences(text)) {
    if (pattern.test(sentence)) return true;
  }
  return false;
}

/**
 * The number of a printed parameterized keyword (`Retaliate 2.` gives 2), or undefined when the
 * keyword is not printed or is printed without a number.
 */
export function getPrintedKeywordValue(text: string | undefined, keyword: string): number | undefined {
  const pattern = printedKeywordPattern(keyword);
  for (const sentence of printedSentences(text)) {
    const match = pattern.exec(sentence);
    if (match?.[2] !== undefined) return parseInt(match[2], 10);
  }
  return undefined;
}

/**
 * Parses printed and supplemental keywords for a card. A keyword counts only when the card prints it
 * (#243). The Crisis icon is not a keyword: it is counted from `scheme_crisis` (`getCrisisIconCount`).
 */
export function parseKeywords(raw: RawUpstreamCard): Keyword[] {
  const keywords = new Set<Keyword>();
  const printed = (keyword: string) => hasPrintedKeyword(raw.text, keyword);

  if (printed('restricted') || (raw as any).restricted) keywords.add(Keyword.RESTRICTED);
  if (printed('permanent') || raw.permanent) keywords.add(Keyword.PERMANENT);
  if (printed('guard')) keywords.add(Keyword.GUARD);
  if (printed('patrol')) keywords.add(Keyword.PATROL);
  if (printed('hazard') || raw.scheme_hazard) keywords.add(Keyword.HAZARD);
  if (printed('overkill')) keywords.add(Keyword.OVERKILL);
  if (printed('piercing')) keywords.add(Keyword.PIERCING);
  if (printed('quickstrike')) keywords.add(Keyword.QUICKSTRIKE);
  if (printed('ranged')) keywords.add(Keyword.RANGED);
  const retaliate = getPrintedKeywordValue(raw.text, 'retaliate');
  if (retaliate !== undefined) {
    keywords.add(`Retaliate ${retaliate}` as any);
  } else if (printed('retaliate')) {
    keywords.add(Keyword.RETALIATE);
  }
  if (printed('surge')) keywords.add(Keyword.SURGE);
  if (printed('toughness')) keywords.add(Keyword.TOUGHNESS);
  if (printed('stalwart')) keywords.add(Keyword.STALWART);
  if (printed('steady')) keywords.add(Keyword.STEADY);
  const incite = getPrintedKeywordValue(raw.text, 'incite');
  if (incite !== undefined) {
    keywords.add(`Incite ${incite}` as any);
    keywords.add(Keyword.INCITE);
  }
  // Victory X is signed: `Victory 0` and `Victory -1` are printed (RR v1.8 Victory X).
  const victory = getPrintedKeywordValue(raw.text, 'victory');
  if (victory !== undefined) {
    keywords.add(`Victory ${victory}` as any);
    keywords.add(Keyword.VICTORY);
  }

  return Array.from(keywords);
}

const TIMING_MAP: Record<string, AbilityTiming> = {
  'hero action': 'HERO_ACTION',
  'alter-ego action': 'ALTER_EGO_ACTION',
  'action': 'ACTION',
  'hero interrupt': 'HERO_INTERRUPT',
  'alter-ego interrupt': 'ALTER_EGO_INTERRUPT',
  'interrupt': 'INTERRUPT',
  'forced interrupt': 'FORCED_INTERRUPT',
  'hero response': 'HERO_RESPONSE',
  'alter-ego response': 'ALTER_EGO_RESPONSE',
  'response': 'RESPONSE',
  'forced response': 'FORCED_RESPONSE',
  'special': 'SPECIAL',
};

/**
 * Derives printed ability labels (attack, thwart, defense) directly from raw card text (RR v1.8 p. 17).
 */
export function parseAbilityLabelsFromText(
  text?: string,
): { timing?: AbilityTiming; labels: ('ATTACK' | 'THWART' | 'DEFENSE')[] }[] {
  if (!text) return [];
  const regex = /<b>([^<]+)<\/b>\s*<i>\s*\(([^)]+)\)\s*<\/i>\s*:?/gi;
  const results: { timing?: AbilityTiming; labels: ('ATTACK' | 'THWART' | 'DEFENSE')[] }[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const rawTiming = match[1].trim().toLowerCase();
    const rawLabel = match[2].trim().toLowerCase();
    const timing = TIMING_MAP[rawTiming];
    const labelParts = rawLabel
      .split('/')
      .map((l) => l.trim().toUpperCase())
      .filter((l): l is 'ATTACK' | 'THWART' | 'DEFENSE' =>
        l === 'ATTACK' || l === 'THWART' || l === 'DEFENSE',
      );
    if (labelParts.length > 0) {
      results.push({ timing, labels: labelParts });
    }
  }
  return results;
}

/**
 * Powers upstream prints as a dash (–), which MarvelCDB encodes as `null`. An omitted (`undefined`)
 * field is not a dash (RR v1.8 "Dash (Value)").
 */
export function collectDashPowers(raw: RawUpstreamCard, powers: CharacterPower[]): CharacterPower[] {
  const values = raw as unknown as Record<string, unknown>;
  return powers.filter((power) => values[power] === null);
}

function dashPowersField(
  raw: RawUpstreamCard,
  powers: CharacterPower[],
): { dashPowers?: CharacterPower[] } {
  const dashPowers = collectDashPowers(raw, powers);
  return dashPowers.length > 0 ? { dashPowers } : {};
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

  let enriched = enrichment;
  if (enrichment?.abilities && enrichment.abilities.length > 0) {
    const parsedLabels = parseAbilityLabelsFromText(raw.text);
    if (parsedLabels.length > 0) {
      const usedParsedIndices = new Set<number>();
      const newAbilities = enrichment.abilities.map((ab) => {
        if (enrichment.abilities!.length === 1 && parsedLabels.length === 1) {
          usedParsedIndices.add(0);
          return { ...ab, labels: [...parsedLabels[0].labels] };
        }
        const matchIdx = parsedLabels.findIndex(
          (p, idx) => !usedParsedIndices.has(idx) && p.timing === ab.timing,
        );
        if (matchIdx !== -1) {
          usedParsedIndices.add(matchIdx);
          return { ...ab, labels: [...parsedLabels[matchIdx].labels] };
        }
        return ab;
      });
      enriched = { ...enrichment, abilities: newAbilities };
    }
  }

  const isLandscape =
    raw.type_code === CardType.MAIN_SCHEME ||
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
    maxPerPlayer: parseMaxPerPlayer(raw),
    cost: raw.cost,
    costPerHero: !!raw.cost_per_hero,
    restrictedSlots:
      (raw.text || '').toLowerCase().includes('counts as 2 restricted') ||
      (raw.text || '').toLowerCase().includes('counts as two restricted')
        ? 2
        : undefined,
    text: raw.text || '',
    flavor: raw.flavor,
    traits: parseTraits(raw.traits),
    printedTraits: raw.traits,
    keywords: parseKeywords(raw),
    scheme_crisis: raw.scheme_crisis ?? undefined,
    resources: parseResources(raw),
    setCode: raw.set_code,
    setPosition: raw.set_position,
    backLink: raw.back_link,
    boostIcons: raw.boost,
    boostStar: !!raw.boost_star,
    errata: raw.errata,
    isLandscape,
    orientation: isLandscape ? 'landscape' : 'portrait',
    enrichment: enriched,
    meta: raw.meta,
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
        ...dashPowersField(raw, ['thwart', 'attack', 'defense']),
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
        ...dashPowersField(raw, ['recover']),
      } as AlterEgoCard;
    }
    case CardType.VILLAIN: {
      const villainText = (raw.text || '').toLowerCase();
      const additionalBoostCards =
        villainText.includes('give him 1 additional boost card') ||
        villainText.includes('additional boost card')
          ? 1
          : undefined;
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
        additionalBoostCards,
        ...dashPowersField(raw, ['attack', 'scheme']),
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
        hasHazard: (raw.scheme_hazard || 0) > 0,
        hasAcceleration: (raw.scheme_acceleration || 0) > 0,
        hasAmplify: (raw.scheme_amplify || 0) > 0,
      } as SideSchemeCard;
    }
    case CardType.PLAYER_SIDE_SCHEME: {
      return {
        ...base,
        type: CardType.PLAYER_SIDE_SCHEME,
        baseThreat: raw.base_threat ?? 0,
        baseThreatFixed: !!raw.base_threat_fixed,
      } as PlayerSideSchemeCard;
    }
    case CardType.ALLY: {
      return {
        ...base,
        type: CardType.ALLY,
        health: raw.health || 2,
        thwart: raw.thwart === null ? 0 : (raw.thwart ?? 1),
        thwartCost: raw.thwart_cost ?? 0,
        attack: raw.attack === null ? 0 : (raw.attack ?? 1),
        attackCost: raw.attack_cost ?? 0,
        ...dashPowersField(raw, ['thwart', 'attack']),
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
        ...dashPowersField(raw, ['attack', 'scheme']),
      } as MinionCard;
    }
    default:
      return base;
  }
}

/**
 * Overlays localized display fields (name, subname, text, flavor, printedTraits)
 * onto a canonical NormalizedCard without mutating its core engine rules, stats, or traits.
 */
export function applyTranslationOverlay<T extends NormalizedCard = NormalizedCard>(
  card: T,
  translationRaw?: Partial<RawUpstreamCard>,
): T {
  if (!translationRaw) return card;

  return {
    ...card,
    name: translationRaw.name || card.name,
    subname: translationRaw.subname !== undefined ? translationRaw.subname : card.subname,
    text: translationRaw.text !== undefined ? translationRaw.text : card.text,
    flavor: translationRaw.flavor !== undefined ? translationRaw.flavor : card.flavor,
    printedTraits: translationRaw.traits !== undefined ? translationRaw.traits : card.printedTraits,
  };
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
    this.markHeroSetMembership();
  }

  /**
   * Derives `belongsToHeroSet` from set data (not card text, ADR-0019): a card belongs to a
   * hero set when a hero or alter-ego card in this catalog carries the same setCode (Issue #158).
   */
  private markHeroSetMembership(): void {
    const heroSetCodes = new Set<string>();
    for (const card of this.cards.values()) {
      if ((card.type === CardType.HERO || card.type === CardType.ALTER_EGO) && card.setCode) {
        heroSetCodes.add(card.setCode);
      }
    }
    for (const [code, card] of this.cards) {
      this.cards.set(code, {
        ...card,
        belongsToHeroSet: Boolean(card.setCode && heroSetCodes.has(card.setCode)),
      });
    }
  }

  public applyTranslations(translationCards: Partial<RawUpstreamCard>[]): void {
    for (const trans of translationCards) {
      if (!trans.code) continue;
      const existing = this.cards.get(trans.code);
      if (existing) {
        this.cards.set(trans.code, applyTranslationOverlay(existing, trans));
      }
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

  /**
   * Retrieves all cards belonging to a set, expanded by their printed card quantity.
   */
  public getExpandedCardsBySet(setCode: string): NormalizedCard[] {
    const setCards = this.getCardsBySet(setCode);
    const result: NormalizedCard[] = [];
    for (const card of setCards) {
      const qty = typeof card.quantity === 'number' && card.quantity > 0 ? card.quantity : 1;
      for (let q = 0; q < qty; q++) {
        result.push(card);
      }
    }
    return result;
  }

  public getNemesisCardsForHero(heroSetCode: string): NormalizedCard[] {
    const nemesisSetCode = `${heroSetCode}_nemesis`;
    return this.getExpandedCardsBySet(nemesisSetCode);
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


