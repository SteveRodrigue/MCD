import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { setupGame } from '@engine/state/game-setup';
import { createCardInstance, resetInstanceCounter } from '@engine/state/card-instance';
import { GameState, HeroCard, AlterEgoCard } from '@engine/models';
import { step4_revealEncounterCards } from '@engine/pipeline/villain-phase';

const LEGIONS_OF_HYDRA = '01180';
const MADAME_HYDRA = '01181';
const HYDRA_SOLDIER = '01182';

describe('Legions of Hydra (01180) When Revealed', () => {
  let state: GameState;

  beforeEach(() => {
    resetInstanceCounter();
    state = setupGame({
      catalog: cardCatalog,
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: cardCatalog.getCard('01001a') as HeroCard,
          alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
    for (const p of state.players) {
      p.currentForm = 'hero';
      p.activeFormCard = p.hero;
    }
  });

  const p1 = () => state.players[0];

  const revealLegionsOfHydra = () => {
    p1().dealtEncounterCards.push(createCardInstance(cardCatalog.getCard(LEGIONS_OF_HYDRA)!));
    state = step4_revealEncounterCards(state);
  };

  it('searches Madame Hydra from encounter deck, engages her with player, and places threat for 1 Hydra enemy', () => {
    const madame = createCardInstance(cardCatalog.getCard(MADAME_HYDRA)!);
    state.encounterDeck = [madame];
    state.encounterDiscard = [];

    revealLegionsOfHydra();

    // Madame Hydra should be engaged with player, NOT in player.tableau
    const engaged = p1().engagedMinions.find((m) => m.card.code === MADAME_HYDRA);
    expect(engaged).toBeDefined();
    expect(p1().tableau.some((c) => c.card.code === MADAME_HYDRA)).toBe(false);

    // Legions of Hydra side scheme should be in play with base 3 + (1 * 2) = 5 threat
    const scheme = state.sideSchemes.find((s) => s.card.code === LEGIONS_OF_HYDRA);
    expect(scheme).toBeDefined();
    expect(scheme?.threat).toBe(5);
  });

  it('searches Madame Hydra from encounter discard when 1 Hydra Soldier is already engaged (2 Hydra enemies = 7 threat)', () => {
    // 1 Hydra Soldier already engaged
    const soldier = createCardInstance(cardCatalog.getCard(HYDRA_SOLDIER)!);
    p1().engagedMinions.push(soldier as any);

    const madame = createCardInstance(cardCatalog.getCard(MADAME_HYDRA)!);
    state.encounterDeck = [];
    state.encounterDiscard = [madame];

    revealLegionsOfHydra();

    // Madame Hydra should now also be engaged
    expect(p1().engagedMinions.some((m) => m.card.code === MADAME_HYDRA)).toBe(true);
    expect(state.encounterDiscard.some((c) => c.card.code === MADAME_HYDRA)).toBe(false);

    // 2 Hydra enemies in play (Madame Hydra + Hydra Soldier) -> 3 base + (2 * 2) = 7 threat
    const scheme = state.sideSchemes.find((s) => s.card.code === LEGIONS_OF_HYDRA);
    expect(scheme).toBeDefined();
    expect(scheme?.threat).toBe(7);
  });

  it('skips search when Madame Hydra is already in play, placing threat for existing Hydra enemies', () => {
    // Madame Hydra is already engaged with player
    const madame = createCardInstance(cardCatalog.getCard(MADAME_HYDRA)!);
    p1().engagedMinions.push(madame as any);

    // Another copy of Madame Hydra in deck should NOT be pulled
    const duplicateInDeck = createCardInstance(cardCatalog.getCard(MADAME_HYDRA)!);
    state.encounterDeck = [duplicateInDeck];

    revealLegionsOfHydra();

    // Only 1 Madame Hydra engaged
    expect(p1().engagedMinions.filter((m) => m.card.code === MADAME_HYDRA).length).toBe(1);
    // The one in deck remained in deck
    expect(state.encounterDeck.filter((c) => c.card.code === MADAME_HYDRA).length).toBe(1);

    // 1 Hydra enemy in play -> 3 base + (1 * 2) = 5 threat
    const scheme = state.sideSchemes.find((s) => s.card.code === LEGIONS_OF_HYDRA);
    expect(scheme).toBeDefined();
    expect(scheme?.threat).toBe(5);
  });

  it('handles 0 Hydra enemies when Madame Hydra is not in deck or discard', () => {
    state.encounterDeck = [];
    state.encounterDiscard = [];

    revealLegionsOfHydra();

    // 0 Hydra enemies in play -> 3 base + (0 * 2) = 3 threat
    const scheme = state.sideSchemes.find((s) => s.card.code === LEGIONS_OF_HYDRA);
    expect(scheme).toBeDefined();
    expect(scheme?.threat).toBe(3);
  });
});
