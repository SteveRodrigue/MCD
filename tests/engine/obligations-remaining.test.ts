import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { step5_revealEncounterCards } from '@engine/pipeline/villain-phase';
import { resolveDecisionPrompt, peekDecisionPrompt } from '@engine/pipeline/prompt-queue';
import { executeEffect, resolveTargets } from '@engine/effects';
import { assertCardConservation } from '@engine/state/state-validator';

describe('Core obligations: Legal Work, Business Problems and shared Option A (Issue #158)', () => {
  let state: GameState;

  function game(): GameState {
    return setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Tony Stark',
          hero: cardCatalog.getCard('01029a') as HeroCard,
          alterEgo: cardCatalog.getCard('01029b') as AlterEgoCard,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
        {
          id: 'p2',
          name: 'Jennifer Walters',
          hero: cardCatalog.getCard('01019a') as HeroCard,
          alterEgo: cardCatalog.getCard('01019b') as AlterEgoCard,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
        {
          id: 'p3',
          name: 'Spider-Man',
          hero: cardCatalog.getCard('01001a') as HeroCard,
          alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
        {
          id: 'p4',
          name: 'Captain Marvel',
          hero: cardCatalog.getCard('01010a') as HeroCard,
          alterEgo: cardCatalog.getCard('01010b') as AlterEgoCard,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
        {
          id: 'p5',
          name: "T'Challa",
          hero: cardCatalog.getCard('01040a') as HeroCard,
          alterEgo: cardCatalog.getCard('01040b') as AlterEgoCard,
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
    state = game();
  });

  const p = (s: GameState, id: string) => s.players.find((x) => x.id === id)!;
  const inst = (code: string) => createCardInstance(cardCatalog.getCard(code)!);

  function reveal(code: string, dealtTo = 'p1'): GameState {
    p(state, dealtTo).dealtEncounterCards.push(inst(code));
    return step5_revealEncounterCards(state);
  }
  const choose = (s: GameState, playerId: string, optionId: string) =>
    resolveDecisionPrompt(s, playerId, optionId);

  // [obligation, owner seat, hero code, alter-ego code]
  const FIVE: Array<[string, string, string]> = [
    ['01155', 'p5', '01040a'],
    ['01160', 'p2', '01019a'],
    ['01165', 'p3', '01001a'],
    ['01170', 'p1', '01029a'],
    ['01175', 'p4', '01010a'],
  ];

  describe.each(FIVE)('%s Option A (alter-ego required)', (code, owner, heroCode) => {
    it('is disabled in hero form, enabled after the flip, then removes the obligation from the game', () => {
      const pl = p(state, owner);
      pl.currentForm = 'hero';
      pl.activeFormCard = cardCatalog.getCard(heroCode) as HeroCard;

      const next = reveal(code, 'p1');
      expect(peekDecisionPrompt(next)!.playerId).toBe(owner);
      const { state: declined } = choose(next, owner, 'pass');
      const optionA = peekDecisionPrompt(declined)!.options.find(
        (o) => o.id === 'exhaust_identity',
      )!;
      expect(optionA.disabled).toBe(true);
      expect(optionA.disabledReason).toMatch(/alter-ego/i);
      expect(choose(declined, owner, 'exhaust_identity').result.success).toBe(false);

      // accept the flip instead: Option A becomes available and resolves
      state = game();
      const pl2 = p(state, owner);
      pl2.currentForm = 'hero';
      pl2.activeFormCard = cardCatalog.getCard(heroCode) as HeroCard;
      const again = reveal(code, 'p1');
      const { state: flipped } = choose(again, owner, 'flip');
      expect(p(flipped, owner).currentForm).toBe('alter_ego');
      const { state: done, result } = choose(flipped, owner, 'exhaust_identity');
      expect(result.success).toBe(true);
      expect(p(done, owner).exhausted).toBe(true);
      expect(done.removedFromGame.map((c) => c.card.code)).toContain(code);
      expect(done.encounterDiscard.map((c) => c.card.code)).not.toContain(code);
      assertCardConservation(done);
    });
  });

  describe('01160 Legal Work', () => {
    it('Option B puts 1 acceleration token on the main scheme and discards the obligation', () => {
      const next = reveal('01160');
      const before = next.accelerationTokens;
      const { state: after } = choose(next, 'p2', 'take_effect');
      expect(after.accelerationTokens).toBe(before + 1);
      expect(after.encounterDiscard.map((c) => c.card.code)).toContain('01160');
      expect(p(after, 'p2').obligations).toEqual([]);
      assertCardConservation(after);
    });
  });

  describe('01170 Business Problems', () => {
    it('Option B exhausts every upgrade the owner controls, but not supports, allies or other tableaus', () => {
      const upgradeA = inst('01046'); // Energy Daggers (upgrade)
      const upgradeB = inst('01028'); // Superhuman Strength (upgrade)
      const support = inst('01064'); // Surveillance Team (support)
      const ally = inst('01041'); // Shuri (ally)
      p(state, 'p1').tableau = [upgradeA, upgradeB, support];
      p(state, 'p1').allies = [ally];
      const othersUpgrade = inst('01047');
      p(state, 'p3').tableau = [othersUpgrade];

      const next = reveal('01170', 'p3');
      expect(peekDecisionPrompt(next)!.playerId).toBe('p1');
      const { state: after } = choose(next, 'p1', 'take_effect');

      expect(upgradeA.exhausted).toBe(true);
      expect(upgradeB.exhausted).toBe(true);
      expect(support.exhausted).toBeFalsy();
      expect(ally.exhausted).toBeFalsy();
      expect(othersUpgrade.exhausted).toBeFalsy();
      expect(p(after, 'p1').exhausted).toBe(false);
      expect(after.encounterDiscard.map((c) => c.card.code)).toContain('01170');
      assertCardConservation(after);
    });

    it('with no upgrades the effect resolves with nothing (identity untouched) and the obligation is discarded', () => {
      p(state, 'p1').tableau = [inst('01064')];
      const next = reveal('01170');
      const { state: after } = choose(next, 'p1', 'take_effect');
      expect(p(after, 'p1').exhausted).toBe(false);
      expect(p(after, 'p1').tableau[0].exhausted).toBeFalsy();
      expect(after.encounterDiscard.map((c) => c.card.code)).toContain('01170');
    });
  });

  describe('Generic primitives', () => {
    const run = (effect: string, effectParams: Record<string, unknown>, extra: any = {}) =>
      executeEffect(
        state,
        { id: 't', timing: 'ACTION', steps: [{ effect, effectParams } as any] },
        { playerId: 'p1', ...extra },
      );

    it('ALL_CONTROLLED_TABLEAU resolves every tableau card of the acting player only', () => {
      p(state, 'p1').tableau = [inst('01046'), inst('01064')];
      p(state, 'p2').tableau = [inst('01047')];
      const targets = resolveTargets(state, 'ALL_CONTROLLED_TABLEAU', { playerId: 'p1' });
      expect(targets.map((t) => (t.kind === 'card' ? t.entity.card.code : '?')).sort()).toEqual([
        '01046',
        '01064',
      ]);
    });

    it('EXHAUST honors filter; a filter matching nothing is a no-op, never an identity fallback', () => {
      const up = inst('01046');
      const sup = inst('01064');
      p(state, 'p1').tableau = [up, sup];
      run('EXHAUST', { target: 'ALL_CONTROLLED_TABLEAU', filter: { types: ['support'] } });
      expect(sup.exhausted).toBe(true);
      expect(up.exhausted).toBeFalsy();

      run('EXHAUST', { target: 'ALL_CONTROLLED_TABLEAU', filter: { types: ['ally'] } });
      expect(p(state, 'p1').exhausted).toBe(false);
    });

    it('READY honors filter and unfiltered READY behavior is unchanged', () => {
      const up = inst('01046');
      const sup = inst('01064');
      up.exhausted = true;
      sup.exhausted = true;
      p(state, 'p1').tableau = [up, sup];
      run('READY', { target: 'ALL_CONTROLLED_TABLEAU', filter: { types: ['upgrade'] } });
      expect(up.exhausted).toBe(false);
      expect(sup.exhausted).toBe(true);

      p(state, 'p1').exhausted = true;
      run('READY', {});
      expect(p(state, 'p1').exhausted).toBe(false);
    });

    it('ADD_ACCELERATION adds the declared amount and defaults to 1', () => {
      const before = state.accelerationTokens;
      run('ADD_ACCELERATION', { amount: 2 });
      expect(state.accelerationTokens).toBe(before + 2);
      run('ADD_ACCELERATION', {});
      expect(state.accelerationTokens).toBe(before + 3);
    });
  });
});
