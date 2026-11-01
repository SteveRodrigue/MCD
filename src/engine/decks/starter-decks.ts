import {
  HeroCard,
  AlterEgoCard,
  NormalizedCard,
  MarvelCDBDeck,
  parseMarvelCDBDeckMeta,
  CardType,
  CardRepository,
} from '../models';

export interface StarterDeckDefinition {
  id: string;
  heroId: string;
  heroName: string;
  aspect: string;
  name: string;
  description: string;
  rawDeck: MarvelCDBDeck;
  loadDeck: (catalog: CardRepository) => {
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
function loadDeckFromMarvelCDB(deck: MarvelCDBDeck, catalog: CardRepository) {
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
function createStarterDeckFromMarvelCDB(deck: MarvelCDBDeck): StarterDeckDefinition {
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
    loadDeck: (catalog: CardRepository) => loadDeckFromMarvelCDB(deck, catalog),
  };
}

/**
 * Registry of all prebuilt starter decks. Filled by the content loader from each pack's
 * `decks/` folder.
 */
export const starterDeckCatalog: Record<string, StarterDeckDefinition> = {};

export function registerStarterDecks(decks: MarvelCDBDeck[]): void {
  for (const deck of decks) {
    const definition = createStarterDeckFromMarvelCDB(deck);
    starterDeckCatalog[definition.id] = definition;
  }
}

export function clearStarterDecks(): void {
  for (const id of Object.keys(starterDeckCatalog)) delete starterDeckCatalog[id];
}

export function getStarterDeck(id: string): StarterDeckDefinition | undefined {
  return starterDeckCatalog[id];
}

export function listStarterDecks(): StarterDeckDefinition[] {
  return Object.values(starterDeckCatalog);
}
