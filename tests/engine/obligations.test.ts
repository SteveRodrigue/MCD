import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard, StatusCard, NormalizedCard } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { step5_revealEncounterCards } from '@engine/pipeline/villain-phase';
import { resolveDecisionPrompt, peekDecisionPrompt } from '@engine/pipeline/prompt-queue';
import { assertCardConservation } from '@engine/state/state-validator';

describe('Core obligations: resolution flow (Issue #158, RR v1.8 Obligation)', () => {
  let state: GameState;

  function game(
    seats: Array<[string, string, string, string]> = [
      ['p1', 'Spider-Man', '01001a', '01001b'],
      ['p2', 'Captain Marvel', '01010a', '01010b'],
    ],
  ): GameState {
    return setupGame({
      scenarioId: 'rhino',
      players: seats.map(([id, name, hero, alterEgo]) => ({
        id,
        name,
        hero: cardCatalog.getCard(hero) as HeroCard,
        alterEgo: cardCatalog.getCard(alterEgo) as AlterEgoCard,
        deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
      })),
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
  }

  beforeEach(() => {
    state = game();
  });

  const p = (s: GameState, id: string) => s.players.find((x) => x.id === id)!;
  const setHeroForm = (id: string, hero: string) => {
    const pl = p(state, id);
    pl.currentForm = 'hero';
    pl.activeFormCard = cardCatalog.getCard(hero) as HeroCard;
  };

  function reveal(code: string, dealtTo = 'p1'): GameState {
    p(state, dealtTo).dealtEncounterCards.push(createCardInstance(cardCatalog.getCard(code)!));
    return step5_revealEncounterCards(state);
  }

  const choose = (s: GameState, playerId: string, optionId: string) =>
    resolveDecisionPrompt(s, playerId, optionId);

  describe('01175 Family Emergency (Carol Danvers)', () => {
    it('given to Carol in alter-ego form: the owner is prompted with both options enabled, no flip prompt', () => {
      const next = reveal('01175');
      const prompt = peekDecisionPrompt(next)!;
      expect(prompt.playerId).toBe('p2');
      expect(prompt.sourceCardName).toBe('Family Emergency');
      expect(prompt.options.map((o) => o.id)).toEqual(['exhaust_identity', 'take_effect']);
      expect(prompt.options.every((o) => !o.disabled)).toBe(true);
      expect(p(next, 'p2').obligations.map((c) => c.card.code)).toEqual(['01175']);
      assertCardConservation(next);
    });

    it('in hero form: a voluntary flip is offered first; declining leaves Option A disabled (alter-ego required)', () => {
      setHeroForm('p2', '01010a');
      const next = reveal('01175');
      const flip = peekDecisionPrompt(next)!;
      expect(flip.isVoluntary).toBe(true);
      expect(flip.options[0].id).toBe('flip');

      const { state: afterPass } = choose(next, 'p2', 'pass');
      const choice = peekDecisionPrompt(afterPass)!;
      const optionA = choice.options.find((o) => o.id === 'exhaust_identity')!;
      expect(optionA.disabled).toBe(true);
      expect(optionA.disabledReason).toMatch(/alter-ego/i);
      expect(choice.options.find((o) => o.id === 'take_effect')!.disabled).toBeFalsy();

      const refused = choose(afterPass, 'p2', 'exhaust_identity');
      expect(refused.result.success).toBe(false);
      expect(p(refused.state, 'p2').exhausted).toBe(false);
    });

    it('flipping by the obligation enables Option A and does not use the voluntary form change', () => {
      setHeroForm('p2', '01010a');
      const next = reveal('01175');
      const { state: afterFlip } = choose(next, 'p2', 'flip');
      expect(p(afterFlip, 'p2').currentForm).toBe('alter_ego');
      expect(p(afterFlip, 'p2').basicChangeFormUsedThisRound).toBe(false);
      const choice = peekDecisionPrompt(afterFlip)!;
      expect(choice.options.find((o) => o.id === 'exhaust_identity')!.disabled).toBeFalsy();
    });

    it('Option A: exhausts the alter-ego and removes the obligation from the game (no surge, no discard)', () => {
      const next = reveal('01175');
      const dealtBefore = p(next, 'p2').dealtEncounterCards.length;
      const { state: after, result } = choose(next, 'p2', 'exhaust_identity');
      expect(result.success).toBe(true);
      expect(p(after, 'p2').exhausted).toBe(true);
      expect(after.removedFromGame.map((c) => c.card.code)).toContain('01175');
      expect(p(after, 'p2').obligations).toEqual([]);
      expect(after.encounterDiscard.some((c) => c.card.code === '01175')).toBe(false);
      expect(p(after, 'p2').dealtEncounterCards.length).toBe(dealtBefore);
      assertCardConservation(after);
    });

    it('Option A is disabled when the alter-ego is already exhausted', () => {
      p(state, 'p2').exhausted = true;
      const next = reveal('01175');
      const optionA = peekDecisionPrompt(next)!.options.find((o) => o.id === 'exhaust_identity')!;
      expect(optionA.disabled).toBe(true);
      expect(choose(next, 'p2', 'exhaust_identity').result.success).toBe(false);
    });

    it('Option B: stunned, surge reveals another encounter card, obligation discarded', () => {
      const next = reveal('01175');
      const deckBefore = next.encounterDeck.length;
      const { state: after } = choose(next, 'p2', 'take_effect');
      expect(p(after, 'p2').statusCards).toContain(StatusCard.STUNNED);
      expect(after.encounterDeck.length).toBe(deckBefore - 1);
      expect(p(after, 'p2').dealtEncounterCards.length).toBeGreaterThanOrEqual(1);
      expect(after.encounterDiscard.map((c) => c.card.code)).toContain('01175');
      expect(p(after, 'p2').obligations).toEqual([]);
      assertCardConservation(after);
    });
  });

  describe('01165 Eviction Notice (Peter Parker)', () => {
    it('is given to Peter Parker even when dealt to another seat; only Peter is prompted', () => {
      const next = reveal('01165', 'p2');
      expect(p(next, 'p1').obligations.map((c) => c.card.code)).toEqual(['01165']);
      expect(p(next, 'p2').obligations).toEqual([]);
      expect(peekDecisionPrompt(next)!.playerId).toBe('p1');
    });

    it('Option B: discards one random card from hand and surges; empty hand still surges and discards the obligation', () => {
      const next = reveal('01165');
      const handBefore = p(next, 'p1').hand.length;
      const discardBefore = p(next, 'p1').discard.length;
      const deckBefore = next.encounterDeck.length;
      const { state: after } = choose(next, 'p1', 'take_effect');
      expect(p(after, 'p1').hand.length).toBe(handBefore - 1);
      expect(p(after, 'p1').discard.length).toBe(discardBefore + 1);
      expect(after.encounterDeck.length).toBe(deckBefore - 1);
      expect(after.encounterDiscard.map((c) => c.card.code)).toContain('01165');

      const empty = game();
      p(empty, 'p1').hand = [];
      p(empty, 'p1').dealtEncounterCards.push(createCardInstance(cardCatalog.getCard('01165')!));
      const emptyReveal = step5_revealEncounterCards(empty);
      const deckBeforeEmpty = emptyReveal.encounterDeck.length;
      const { state: emptyAfter } = choose(emptyReveal, 'p1', 'take_effect');
      expect(p(emptyAfter, 'p1').hand).toEqual([]);
      expect(emptyAfter.encounterDeck.length).toBe(deckBeforeEmpty - 1);
      expect(emptyAfter.encounterDiscard.map((c) => c.card.code)).toContain('01165');
    });

    it('Option A requires Peter Parker (alter-ego) and removes the card from the game', () => {
      const next = reveal('01165');
      const { state: after } = choose(next, 'p1', 'exhaust_identity');
      expect(p(after, 'p1').exhausted).toBe(true);
      expect(after.removedFromGame.map((c) => c.card.code)).toContain('01165');
    });
  });

  describe("01155 Affairs of State (T'Challa)", () => {
    beforeEach(() => {
      state = game([
        ['p1', "T'Challa", '01040a', '01040b'],
        ['p2', 'Captain Marvel', '01010a', '01010b'],
      ]);
    });

    const tableau = (...codes: string[]) => {
      p(state, 'p1').tableau = codes.map((c) => createCardInstance(cardCatalog.getCard(c)!));
    };

    it('Option B with several Black Panther upgrades: prompts among them only, then discards the chosen one', () => {
      tableau('01046', '01047', '01028'); // Energy Daggers, Panther Claws, Superhuman Strength
      const next = reveal('01155', 'p2');
      expect(peekDecisionPrompt(next)!.playerId).toBe('p1');
      const { state: afterChoice } = choose(next, 'p1', 'take_effect');
      const pick = peekDecisionPrompt(afterChoice)!;
      const offered = pick.options.map((o) => o.cardCode);
      expect(offered.sort()).toEqual(['01046', '01047']);

      const target = pick.options.find((o) => o.cardCode === '01047')!;
      const { state: done } = choose(afterChoice, 'p1', target.id);
      expect(
        p(done, 'p1')
          .tableau.map((c) => c.card.code)
          .sort(),
      ).toEqual(['01028', '01046']);
      expect(done.encounterDiscard.map((c) => c.card.code)).toContain('01155');
    });

    it('Option B with no Black Panther upgrade: resolves with nothing and the obligation is discarded', () => {
      tableau('01028');
      const next = reveal('01155', 'p2');
      const { state: after } = choose(next, 'p1', 'take_effect');
      expect(peekDecisionPrompt(after)).toBeUndefined();
      expect(p(after, 'p1').tableau.map((c) => c.card.code)).toEqual(['01028']);
      expect(after.encounterDiscard.map((c) => c.card.code)).toContain('01155');
      expect(p(after, 'p1').obligations).toEqual([]);
    });

    it("Option A exhausts T'Challa and removes the obligation from the game", () => {
      const next = reveal('01155', 'p2');
      const { state: after } = choose(next, 'p1', 'exhaust_identity');
      expect(p(after, 'p1').exhausted).toBe(true);
      expect(after.removedFromGame.map((c) => c.card.code)).toContain('01155');
      assertCardConservation(after);
    });
  });

  describe('Shared card data is never mutated by prompt availability', () => {
    it('the declared option objects keep no per-game disabled flags', () => {
      p(state, 'p2').exhausted = true;
      reveal('01175');
      const card = cardCatalog.getCard('01175') as NormalizedCard;
      const options = (card.enrichment!.abilities![0].steps![1].effectParams as any).options;
      expect(options[0].disabled).toBeUndefined();
    });
  });
});
