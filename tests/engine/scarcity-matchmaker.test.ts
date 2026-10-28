import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { setupGame, resetInstanceCounter } from '@engine/state/game-setup';
import { runMatch } from '@engine/simulation/match-simulator';
import {
  DECK_SIZE,
  chooseAspect,
  draftDeck,
  rankHeroSets,
} from '@engine/simulation/scarcity-matchmaker';
import { abilityKey, cardKey, type ScarcityLedger } from '@engine/simulation/ability-coverage';
import { CardType, FactionCode } from '@engine/models';

const allCards = cardCatalog.getAllCards();
const heroSets = ['spider_man', 'captain_marvel', 'she_hulk', 'iron_man', 'black_panther'];
const draft = (heroSetCode: string, ledger: ScarcityLedger = {}, seed = 'seed') =>
  draftDeck({ catalog: cardCatalog, allCards, heroSetCode, ledger, seed });
const counts = (cards: { code: string }[]) =>
  cards.reduce<Record<string, number>>((n, c) => ({ ...n, [c.code]: (n[c.code] ?? 0) + 1 }), {});

describe('scarcity matchmaker (#431)', () => {
  beforeEach(() => resetInstanceCounter());

  it.each(heroSets)('drafts a legal %s deck', (heroSetCode) => {
    const deck = draft(heroSetCode);
    expect(deck.deckCards).toHaveLength(DECK_SIZE);
    for (const [code, n] of Object.entries(counts(deck.deckCards))) {
      expect(n, code).toBeLessThanOrEqual(cardCatalog.getCard(code)!.deckLimit);
    }
    const factions = new Set(deck.deckCards.map((c) => c.faction));
    for (const faction of factions) {
      expect([FactionCode.HERO, FactionCode.BASIC, deck.aspect]).toContain(faction);
    }
    expect(deck.deckCards.every((c) => c.type !== CardType.OBLIGATION)).toBe(true);
  });

  it('always includes every signature card of the hero set', () => {
    const deck = draft('black_panther');
    const signature = cardCatalog
      .getCardsBySet('black_panther')
      .filter((c) => c.faction === FactionCode.HERO && c.type !== CardType.HERO);
    for (const card of signature.filter(
      (c) => c.type !== CardType.ALTER_EGO && c.type !== CardType.OBLIGATION,
    )) {
      expect(
        deck.deckCards.some((c) => c.code === card.code),
        card.code,
      ).toBe(true);
    }
  });

  it('drafts the same deck from the same seed', () => {
    const codes = (seed: string) => draft('iron_man', {}, seed).deckCards.map((c) => c.code);
    expect(codes('replay')).toEqual(codes('replay'));
  });

  it('leans toward untested cards and away from heavily tested ones', () => {
    const aspect = draft('spider_man').aspect;
    const tested = allCards
      .filter((c) => c.faction === aspect && c.packCode === 'core')
      .slice(0, 6);
    const ledger: ScarcityLedger = {};
    for (const card of tested) {
      ledger[cardKey(card.code)] = 99;
      for (const a of card.enrichment?.abilities ?? []) ledger[abilityKey(card.code, a.id)] = 99;
    }
    const before = counts(draft('spider_man', {}, 'lean').deckCards);
    const after = counts(draft('spider_man', ledger, 'lean').deckCards);
    const copies = (c: Record<string, number>) =>
      tested.reduce((n, card) => n + (c[card.code] ?? 0), 0);
    expect(copies(after)).toBeLessThan(copies(before));
  });

  it('picks the aspect and hero set with the most left to test', () => {
    expect(chooseAspect(allCards, {})).toBeDefined();
    const ranked = rankHeroSets(cardCatalog, allCards, {});
    expect(new Set(ranked)).toEqual(new Set(heroSets));
    const spiderMan = cardCatalog.getCardsBySet('spider_man');
    const worn: ScarcityLedger = {};
    for (const card of spiderMan) {
      for (const a of card.enrichment?.abilities ?? []) worn[abilityKey(card.code, a.id)] = 99;
    }
    expect(rankHeroSets(cardCatalog, allCards, worn).at(-1)).toBe('spider_man');
  });

  it('gives a payoff its setup piece', () => {
    // Wakanda Forever! needs a Black Panther upgrade in play. Make it the one card left to test, so
    // the draft takes it first, and its setup piece has to come with it.
    const wakanda = cardCatalog.getCard('01043a')!;
    const ledger: ScarcityLedger = {};
    for (const card of allCards.filter((c) => c.faction === wakanda.faction)) {
      if (card.code === wakanda.code) continue;
      ledger[cardKey(card.code)] = 99;
      for (const a of card.enrichment?.abilities ?? []) ledger[abilityKey(card.code, a.id)] = 99;
    }
    const deck = draftDeck({
      catalog: cardCatalog,
      allCards,
      heroSetCode: 'black_panther',
      ledger,
      seed: 'payoff',
      aspect: wakanda.faction,
    });
    const codes = deck.deckCards.map((c) => c.code);
    expect(codes).toContain('01043a');
    expect(codes.some((c) => ['01046', '01047', '01048', '01049'].includes(c))).toBe(true);
  });

  it('drafts a deck that plays a whole match without an error', () => {
    const deck = draft('captain_marvel', {}, 'play');
    const state = setupGame({
      catalog: cardCatalog,
      scenarioId: 'rhino',
      seed: 'drafted-match',
      players: [
        {
          id: 'p1',
          name: deck.hero.name,
          hero: deck.hero,
          alterEgo: deck.alterEgo,
          deckCards: deck.deckCards,
          obligation: deck.obligation,
          nemesisCards: deck.nemesisCards,
        },
      ],
    });
    const result = runMatch(state, { maxRounds: 10, seed: 'drafted-match', scarcity: {} });
    expect(result.roundsPlayed).toBeGreaterThan(0);
  });
});
