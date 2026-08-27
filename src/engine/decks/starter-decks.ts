import { CardCatalog } from '../../data/importer/card-loader';
import { HeroCard, AlterEgoCard, NormalizedCard } from '../models';

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

export const starterDeckCatalog: Record<string, StarterDeckDefinition> = {
  spider_man_justice: {
    id: 'spider_man_justice',
    heroId: 'spider_man',
    heroName: 'Spider-Man',
    aspect: 'Justice',
    name: 'Spider-Man (Justice Starter)',
    description:
      'Official Core Set starter deck for Spider-Man. Balanced for threat removal with Great Responsibility, For Justice!, and Jessica Jones.',
    loadDeck: (catalog: CardCatalog) => {
      const identity = catalog.getHeroIdentity('spider_man');
      if (!identity) {
        throw new Error('Spider-Man identity not found in catalog');
      }

      // 15 Signature Cards (excluding Hero & Alter-Ego identity cards)
      const signatureCards = catalog.getCardsBySet('spider_man').flatMap((c) => {
        if (c.type === 'hero' || c.type === 'alter_ego' || c.type === 'obligation') return [];
        return Array(c.quantity).fill(c);
      });

      // Justice + Basic cards to fill 40-card deck
      const justiceCards = catalog
        .getCardsByFaction('justice' as any)
        .flatMap((c) => Array(c.quantity).fill(c));
      const basicCards = catalog
        .getCardsByFaction('basic' as any)
        .flatMap((c) => Array(c.quantity).fill(c));

      const deckCards = [...signatureCards, ...justiceCards, ...basicCards].slice(0, 40);

      // Obligation (Eviction Notice 01165)
      const obligation = catalog.getCard('01165') || catalog.getCardsByType('obligation' as any)[0];
      if (!obligation) {
        throw new Error('Spider-Man obligation (Eviction Notice 01165) not found in catalog');
      }

      // 5-card Nemesis Set (Highway Robbery 01166, Vulture 01167, Sweeping Swoop 01168 x2, The Vulture's Plans 01169)
      const nemesisCards = catalog
        .getCardsBySet('spider_man_nemesis')
        .flatMap((c) => Array(c.quantity).fill(c));

      return {
        hero: identity.hero,
        alterEgo: identity.alterEgo,
        deckCards,
        obligation,
        nemesisCards,
      };
    },
  },
};

export function getStarterDeck(id: string): StarterDeckDefinition | undefined {
  return starterDeckCatalog[id];
}

export function listStarterDecks(): StarterDeckDefinition[] {
  return Object.values(starterDeckCatalog);
}
