import { CardCatalog } from '../../data/importer/card-loader';
import {
  HeroCard,
  AlterEgoCard,
  NormalizedCard,
  MarvelCDBDeck,
  parseMarvelCDBDeckMeta,
  CardType,
} from '../models';

// 1-File-Per-Deck prebuilt imports from data/prebuilt_decks/
import spiderManDeck from '../../../data/prebuilt_decks/core_spider_man_justice.json';
import captainMarvelDeck from '../../../data/prebuilt_decks/core_captain_marvel_leadership.json';
import sheHulkDeck from '../../../data/prebuilt_decks/core_she_hulk_aggression.json';
import ironManDeck from '../../../data/prebuilt_decks/core_iron_man_aggression.json';
import blackPantherDeck from '../../../data/prebuilt_decks/core_black_panther_protection.json';

export interface StarterDeckDefinition {
  id: string;
  heroId: string;
  heroName: string;
  aspect: string;
  name: string;
  description: string;
  rawDeck: MarvelCDBDeck;
  loadDeck: (catalog: CardCatalog) => {
    hero: HeroCard;
    alterEgo: AlterEgoCard;
    deckCards: NormalizedCard[];
    obligation: NormalizedCard;
    nemesisCards: NormalizedCard[];
  };
}

/**
 * Loads a playable deck from any MarvelCDB-compliant Deck object.
 */
export function loadDeckFromMarvelCDB(deck: MarvelCDBDeck, catalog: CardCatalog) {
  const hero = catalog.getCard(deck.hero_code) as HeroCard | undefined;
  if (!hero) {
    throw new Error(`Hero card ${deck.hero_code} not found in catalog for deck ${deck.name}`);
  }

  const heroSetCode = hero.setCode || '';

  // Find matching Alter-Ego card from hero set
  const alterEgo = (
    hero.backLink
      ? catalog.getCard(hero.backLink)
      : catalog.getCardsBySet(heroSetCode).find((c) => c.type === CardType.ALTER_EGO)
  ) as AlterEgoCard | undefined;

  if (!alterEgo) {
    throw new Error(`Alter-Ego identity card not found in catalog for hero set ${heroSetCode}`);
  }

  // Expand slots into deck cards array
  const deckCards: NormalizedCard[] = [];
  for (const [code, quantity] of Object.entries(deck.slots)) {
    const card = catalog.getCard(code);
    if (!card) {
      throw new Error(`Card code ${code} not found in catalog for deck ${deck.name}`);
    }
    for (let i = 0; i < quantity; i++) {
      deckCards.push(card);
    }
  }

  // Find Obligation card for this hero
  const obligation = catalog
    .getCardsByType(CardType.OBLIGATION)
    .find((c) => Boolean(heroSetCode && c.setCode === heroSetCode));

  if (!obligation) {
    throw new Error(`Obligation card not found in catalog for hero ${hero.name}`);
  }

  // Find 5-card Nemesis Set for this hero
  const nemesisCards = catalog
    .getCardsBySet(`${heroSetCode}_nemesis`)
    .flatMap((c) => Array(c.quantity).fill(c));

  if (nemesisCards.length === 0) {
    throw new Error(
      `Nemesis set ${heroSetCode}_nemesis not found in catalog for hero ${hero.name}`,
    );
  }

  return {
    hero,
    alterEgo,
    deckCards,
    obligation,
    nemesisCards,
  };
}

/**
 * Creates a strongly typed StarterDeckDefinition from a MarvelCDBDeck object.
 */
export function createStarterDeckFromMarvelCDB(deck: MarvelCDBDeck): StarterDeckDefinition {
  const meta = parseMarvelCDBDeckMeta(deck.meta);
  const aspect =
    meta.aspect_name ||
    (meta.aspect ? meta.aspect.charAt(0).toUpperCase() + meta.aspect.slice(1) : 'Custom');
  const heroSetCode = deck.hero_name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const id = `${heroSetCode}_${aspect.toLowerCase()}`;

  return {
    id,
    heroId: heroSetCode,
    heroName: deck.hero_name,
    aspect,
    name: deck.name,
    description: deck.description_md || `Prebuilt ${aspect} deck for ${deck.hero_name}.`,
    rawDeck: deck,
    loadDeck: (catalog: CardCatalog) => loadDeckFromMarvelCDB(deck, catalog),
  };
}

/**
 * Registry of all prebuilt starter decks, populated dynamically from individual deck files.
 */
export const starterDeckCatalog: Record<string, StarterDeckDefinition> = {};

export const prebuiltDeckList: MarvelCDBDeck[] = [
  spiderManDeck,
  captainMarvelDeck,
  sheHulkDeck,
  ironManDeck,
  blackPantherDeck,
] as unknown as MarvelCDBDeck[];

prebuiltDeckList.forEach((deck) => {
  const definition = createStarterDeckFromMarvelCDB(deck);
  starterDeckCatalog[definition.id] = definition;
});

export function registerPrebuiltDeck(deck: MarvelCDBDeck): StarterDeckDefinition {
  const definition = createStarterDeckFromMarvelCDB(deck);
  starterDeckCatalog[definition.id] = definition;
  return definition;
}

export function getStarterDeck(id: string): StarterDeckDefinition | undefined {
  return starterDeckCatalog[id];
}

export function listStarterDecks(): StarterDeckDefinition[] {
  return Object.values(starterDeckCatalog);
}
