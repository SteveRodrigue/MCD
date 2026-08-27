import { CardCatalog } from '../../data/importer/card-loader';
import { HeroCard, AlterEgoCard, NormalizedCard } from '../models';
import starterDecksJson from '../../../data/decks/starter_decks.json';

export interface RawDeckMetadata {
  id: string;
  hero_id: string;
  hero_name: string;
  aspect: string;
  name: string;
  description: string;
  hero_code: string;
  alter_ego_code: string;
  obligation_code: string;
  nemesis_set_code: string;
  cards: Record<string, number>;
}

export interface StarterDeckDefinition {
  id: string;
  heroId: string;
  heroName: string;
  aspect: string;
  name: string;
  description: string;
  loadDeck: (catalog: CardCatalog) => {
    hero: HeroCard;
    alterEgo: AlterEgoCard;
    deckCards: NormalizedCard[];
    obligation: NormalizedCard;
    nemesisCards: NormalizedCard[];
  };
}

/**
 * Creates a strongly typed StarterDeckDefinition from raw deck JSON metadata.
 */
export function createStarterDeckFromMetadata(meta: RawDeckMetadata): StarterDeckDefinition {
  return {
    id: meta.id,
    heroId: meta.hero_id,
    heroName: meta.hero_name,
    aspect: meta.aspect,
    name: meta.name,
    description: meta.description,
    loadDeck: (catalog: CardCatalog) => {
      const hero = catalog.getCard(meta.hero_code) as HeroCard | undefined;
      const alterEgo = catalog.getCard(meta.alter_ego_code) as AlterEgoCard | undefined;

      if (!hero || !alterEgo) {
        throw new Error(
          `Hero identity not found in catalog for ${meta.hero_name} (Hero: ${meta.hero_code}, Alter-Ego: ${meta.alter_ego_code})`,
        );
      }

      // Resolve 40 deck cards from { [code]: quantity } map
      const deckCards: NormalizedCard[] = [];
      for (const [code, quantity] of Object.entries(meta.cards)) {
        const card = catalog.getCard(code);
        if (!card) {
          throw new Error(`Card code ${code} not found in catalog for deck ${meta.name}`);
        }
        for (let i = 0; i < quantity; i++) {
          deckCards.push(card);
        }
      }

      // Resolve Obligation card
      const obligation = catalog.getCard(meta.obligation_code);
      if (!obligation) {
        throw new Error(
          `Obligation card ${meta.obligation_code} not found in catalog for ${meta.hero_name}`,
        );
      }

      // Resolve 5-card Nemesis Set
      const nemesisCards = catalog
        .getCardsBySet(meta.nemesis_set_code)
        .flatMap((c) => Array(c.quantity).fill(c));

      if (nemesisCards.length === 0) {
        throw new Error(
          `Nemesis set ${meta.nemesis_set_code} not found in catalog for ${meta.hero_name}`,
        );
      }

      return {
        hero,
        alterEgo,
        deckCards,
        obligation,
        nemesisCards,
      };
    },
  };
}

/**
 * Registry of all prebuilt starter decks, dynamically populated from metadata.
 */
export const starterDeckCatalog: Record<string, StarterDeckDefinition> = {};

// Load all starter decks from data/decks/starter_decks.json
((starterDecksJson as unknown) as RawDeckMetadata[]).forEach((meta) => {
  starterDeckCatalog[meta.id] = createStarterDeckFromMetadata(meta);
});

export function getStarterDeck(id: string): StarterDeckDefinition | undefined {
  return starterDeckCatalog[id];
}

export function listStarterDecks(): StarterDeckDefinition[] {
  return Object.values(starterDeckCatalog);
}
