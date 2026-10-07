import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog, CardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard, NormalizedCard } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { step4_revealEncounterCards } from '@engine/pipeline/villain-phase';
import { assertCardConservation } from '@engine/state/state-validator';
import { CardEnrichmentSchema } from '../../src/data/supplemental/schema';
import corePack from '../../data/upstream/pack/core.json';
import coreEncounterPack from '../../data/upstream/pack/core_encounter.json';
import cwEncounterPack from '../../data/upstream/pack/cw_encounter.json';

// Ad-hoc catalog: core + ONLY the proof card 56128b (the live loader never loads cw_encounter).
const proofRaw = (cwEncounterPack as any[]).find((c) => c.code === '56128b');
const adHocCatalog = new CardCatalog([...corePack, ...coreEncounterPack, proofRaw] as any);

describe('Obligation recipient resolution (Issue #158, RR v1.8 Obligation)', () => {
  let state: GameState;

  function twoPlayerGame(): GameState {
    return setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: cardCatalog.getCard('01001a') as HeroCard,
          alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
        {
          id: 'p2',
          name: 'Captain Marvel',
          hero: cardCatalog.getCard('01010a') as HeroCard,
          alterEgo: cardCatalog.getCard('01010b') as AlterEgoCard,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
  }

  beforeEach(() => {
    state = twoPlayerGame();
  });

  const p = (id: string) => state.players.find((x) => x.id === id)!;
  const of = (s: GameState, id: string) => s.players.find((x) => x.id === id)!;

  describe('belongsToHeroSet loader flag', () => {
    it('is true for a core hero-set obligation and false for a non-hero-set obligation', () => {
      expect(cardCatalog.getCard('01175')!.belongsToHeroSet).toBe(true);
      expect(adHocCatalog.getCard('56128b')!.belongsToHeroSet).toBe(false);
    });

    it('is false when the hero pack is absent from the catalog', () => {
      const lonely = new CardCatalog([
        (coreEncounterPack as any[]).find((c) => c.code === '01175'),
      ] as any);
      expect(lonely.getCard('01175')!.belongsToHeroSet).toBe(false);
    });
  });

  describe('Default recipient (no recipient declared)', () => {
    it('hero-set obligation goes to the owner of that hero set, not the revealing player', () => {
      // Family Emergency (Carol Danvers set) dealt to the Spider-Man seat
      p('p1').dealtEncounterCards.push(createCardInstance(cardCatalog.getCard('01175')!));
      const next = step4_revealEncounterCards(state);
      expect(of(next, 'p2').obligations.map((c) => c.card.code)).toEqual(['01175']);
      expect(of(next, 'p1').obligations).toEqual([]);
      expect(next.encounterDiscard.some((c) => c.card.code === '01175')).toBe(false);
      assertCardConservation(next);
    });

    it('the owner is found in either identity form', () => {
      p('p2').currentForm = 'hero';
      p('p2').activeFormCard = cardCatalog.getCard('01010a') as HeroCard;
      p('p1').dealtEncounterCards.push(createCardInstance(cardCatalog.getCard('01175')!));
      const next = step4_revealEncounterCards(state);
      expect(of(next, 'p2').obligations).toHaveLength(1);
    });

    it('non-hero-set obligation goes to the revealing player (rule 3)', () => {
      const synthetic = createCardInstance({
        ...cardCatalog.getCard('01175')!,
        code: 'x-enc-obl',
        setCode: 'some_encounter_set',
        belongsToHeroSet: false,
        enrichment: undefined,
      } as NormalizedCard);
      p('p1').dealtEncounterCards.push(synthetic);
      const next = step4_revealEncounterCards(state);
      expect(of(next, 'p1').obligations).toHaveLength(1);
      expect(of(next, 'p2').obligations).toHaveLength(0);
    });

    it('rule 2: hero-set obligation whose hero is not in the game is removed and another card is revealed', () => {
      const solo = setupGame({
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
      // Stack the top of the shuffled deck with an inert minion: the extra card is known (#217)
      const extra = createCardInstance(cardCatalog.getCard('01101')!);
      solo.encounterDeck.unshift(extra);
      const deckBefore = solo.encounterDeck.length;
      solo.players[0].dealtEncounterCards.push(createCardInstance(cardCatalog.getCard('01175')!));
      const next = step4_revealEncounterCards(solo);
      expect(next.removedFromGame.some((c) => c.card.code === '01175')).toBe(true);
      expect(next.players[0].obligations).toEqual([]);
      expect(next.encounterDeck).toHaveLength(deckBefore - 1);
      expect(next.players[0].engagedMinions.map((m) => m.instanceId)).toContain(extra.instanceId);
      assertCardConservation(next);
    });
  });

  describe('Override: recipient declared outside the abilities', () => {
    function proofCard() {
      return createCardInstance(adHocCatalog.getCard('56128b')!);
    }

    it('proof card 56128b declares recipient FIRST_PLAYER', () => {
      expect(adHocCatalog.getCard('56128b')!.enrichment?.recipient).toEqual({
        type: 'FIRST_PLAYER',
      });
    });

    it('FIRST_PLAYER: given to the first player even when another player revealed it', () => {
      state.firstPlayerIndex = 1; // Captain Marvel (p2) is first
      p('p1').dealtEncounterCards.push(proofCard());
      const next = step4_revealEncounterCards(state);
      expect(of(next, 'p2').obligations.map((c) => c.card.code)).toEqual(['56128b']);
      expect(of(next, 'p1').obligations).toEqual([]);
      assertCardConservation(next);
    });

    it('without recipient the same card follows the default (non-hero set -> revealing player)', () => {
      const stripped = proofCard();
      stripped.card = {
        ...stripped.card,
        enrichment: { ...(stripped.card.enrichment || {}), recipient: undefined },
      } as NormalizedCard;
      state.firstPlayerIndex = 1;
      p('p1').dealtEncounterCards.push(stripped);
      const next = step4_revealEncounterCards(state);
      expect(of(next, 'p1').obligations).toHaveLength(1);
      expect(of(next, 'p2').obligations).toHaveLength(0);
    });

    it('REVEALING_PLAYER: goes to the player who revealed it', () => {
      state.firstPlayerIndex = 1;
      const card = proofCard();
      card.card = {
        ...card.card,
        enrichment: { ...card.card.enrichment, recipient: { type: 'REVEALING_PLAYER' } },
      } as NormalizedCard;
      p('p1').dealtEncounterCards.push(card);
      const next = step4_revealEncounterCards(state);
      expect(of(next, 'p1').obligations).toHaveLength(1);
    });

    it('CARD_SET_OWNER: explicit form of the default', () => {
      const card = createCardInstance({
        ...cardCatalog.getCard('01175')!,
        enrichment: { recipient: { type: 'CARD_SET_OWNER' } },
      } as NormalizedCard);
      p('p1').dealtEncounterCards.push(card);
      const next = step4_revealEncounterCards(state);
      expect(of(next, 'p2').obligations).toHaveLength(1);
    });

    it('IDENTITY: explicit hero/alter-ego codes match either form', () => {
      const card = createCardInstance({
        ...cardCatalog.getCard('01175')!,
        enrichment: { recipient: { type: 'IDENTITY', codes: ['01001a', '01001b'] } },
      } as NormalizedCard);
      p('p2').dealtEncounterCards.push(card);
      const next = step4_revealEncounterCards(state);
      expect(of(next, 'p1').obligations).toHaveLength(1);
    });

    it('schema accepts the four recipient types and rejects an unknown one', () => {
      for (const recipient of [
        { type: 'FIRST_PLAYER' },
        { type: 'REVEALING_PLAYER' },
        { type: 'CARD_SET_OWNER' },
        { type: 'IDENTITY', codes: ['01010a'] },
      ]) {
        expect(CardEnrichmentSchema.safeParse({ recipient }).success).toBe(true);
      }
      expect(CardEnrichmentSchema.safeParse({ recipient: { type: 'NOBODY' } }).success).toBe(false);
      expect(CardEnrichmentSchema.safeParse({ recipient: { type: 'IDENTITY' } }).success).toBe(
        false,
      );
    });
  });
});
