import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '@data/importer/card-loader';
import {
  GameState,
  HeroCard,
  AlterEgoCard,
  MinionCard,
  StatusCard,
  setupGame,
  resetInstanceCounter,
  createCardInstance,
  step4_revealEncounterCards,
} from '@engine/index';
import { executeEnemyAttackSynchronously } from '@engine/pipeline';
import { getEffectiveRetaliate } from '@engine/pipeline/stat-calculator';

const SANDMAN = '01102';
const WHIPLASH = '01172';

describe('Keyword-only minions carry no invented ability (item 14 read-through)', () => {
  let state: GameState;

  beforeEach(() => {
    resetInstanceCounter();
    state = setupGame({
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
      shuffleFn: (cards) => cards,
    });
    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = state.players[0].hero;
  });

  const reveal = (code: string) => {
    state.players[0].dealtEncounterCards.push(createCardInstance(cardCatalog.getCard(code)!));
    state = step4_revealEncounterCards(state);
    return state.players[0].engagedMinions.find((m) => m.card.code === code)!;
  };

  describe('Sandman (01102): "Toughness."', () => {
    it('enters play with a tough status card', () => {
      expect(reveal(SANDMAN).statusCards).toContain(StatusCard.TOUGH);
    });

    it('declares no ability, so an attack by him discards nothing from the encounter deck', () => {
      const sandman = reveal(SANDMAN);
      const deckBefore = state.encounterDeck.length;
      const discardBefore = state.encounterDiscard.length;
      executeEnemyAttackSynchronously(
        state,
        { type: 'MINION', card: sandman },
        'p1',
        'TAKE_UNDEFENDED',
      );
      expect(state.encounterDeck.length).toBe(deckBefore);
      expect(state.encounterDiscard.length).toBe(discardBefore);
    });
  });

  describe('Whiplash (01172): "Retaliate 1."', () => {
    it('does not enter play with a tough status card (it prints no Toughness)', () => {
      const whiplash = reveal(WHIPLASH);
      expect(whiplash.statusCards ?? []).not.toContain(StatusCard.TOUGH);
    });

    it('has Retaliate 1 from the printed keyword alone', () => {
      const whiplash = createCardInstance(cardCatalog.getCard(WHIPLASH) as MinionCard);
      expect(whiplash.card.enrichment?.abilities ?? []).toHaveLength(0);
      expect(getEffectiveRetaliate(whiplash)).toBe(1);
    });
  });
});
