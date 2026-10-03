import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { step5_revealEncounterCards } from '@engine/pipeline/villain-phase';
import { peekDecisionPrompt } from '@engine/pipeline/prompt-queue';

describe('Encounter attachments attach unconditionally (Issue #175, RR v1.8 Attachment)', () => {
  let state: GameState;

  beforeEach(() => {
    const hero = cardCatalog.getCard('01001a') as HeroCard;
    const alterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;
    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero,
          alterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = hero;
    state.villain.attachments = [];
  });

  describe.each([
    ['01098', 'Armored Rhino Suit'],
    ['01099', 'Charge'],
    ['01100', 'Enhanced Ivory Horn'],
  ])('%s %s', (code) => {
    it('declares no When Revealed ability (nothing for a cancel effect to cancel)', () => {
      const card = cardCatalog.getCard(code)!;
      const whenRevealed = (card.enrichment?.abilities || []).filter(
        (a) => a.trigger === 'WHEN_REVEALED' || a.timing === 'WHEN_REVEALED',
      );
      expect(whenRevealed).toEqual([]);
    });

    it('attaches to the villain exactly once when revealed', () => {
      state.players[0].dealtEncounterCards.push(createCardInstance(cardCatalog.getCard(code)!));
      const next = step5_revealEncounterCards(state);
      expect(next.villain.attachments.filter((a) => a.card.code === code)).toHaveLength(1);
    });

    it('still attaches and offers no cancel prompt when a Cancel When Revealed card is in hand', () => {
      state.players[0].hand.push(createCardInstance(cardCatalog.getCard('01004')!));
      state.players[0].dealtEncounterCards.push(createCardInstance(cardCatalog.getCard(code)!));
      const next = step5_revealEncounterCards(state, { acceptOptionalTriggers: true });
      expect(peekDecisionPrompt(next)).toBeUndefined();
      expect(next.villain.attachments.filter((a) => a.card.code === code)).toHaveLength(1);
      expect(next.players[0].hand.some((c) => c.card.code === '01004')).toBe(true);
    });
  });

  it('Charge keeps its constant ATK bonus and OVERKILL declarations', () => {
    const ids = (cardCatalog.getCard('01099')!.enrichment?.abilities || []).map((a) => a.id);
    expect(ids).toContain('charge_atk_bonus');
    expect(ids).toContain('charge_overkill');
  });
});
