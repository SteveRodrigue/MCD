import { describe, it, expect } from 'vitest';
import { CardType, getActiveMainScheme, type SideSchemeCard } from '../../src/engine/models';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { createCardInstance } from '../../src/engine/state/game-setup';
import { getPlayTargetChoice } from '../../src/engine/effects/target-choice';
import { newRhinoGame } from '../support/game-fixtures';

describe('CardPaymentModal Targeting Invariants (Issue #94, #146, #438)', () => {
  const choiceFor = (code: string) => {
    const state = newRhinoGame();
    const card = cardCatalog.getCard(code)!;
    return {
      state,
      card,
      choice: getPlayTargetChoice(state, state.players[0], createCardInstance(card)),
    };
  };

  it.each([
    ['Support (Interrogation Room 01063)', '01063', CardType.SUPPORT],
    ['Support (Surveillance Team 01064)', '01064', CardType.SUPPORT],
    ['Support (Tac Team 01056)', '01056', CardType.SUPPORT],
    ['Upgrade (Mark V Helmet 01037)', '01037', CardType.UPGRADE],
    ['Ally (Hawkeye 01066)', '01066', CardType.ALLY],
  ])('%s asks for no target when played from hand', (_name, code, type) => {
    const { card, choice } = choiceFor(code);
    expect(card.type).toBe(type);
    expect(choice).toBeUndefined();
  });

  it.each([
    ['Thwart Event (For Justice! 01060)', 'CHOSEN_SCHEME', '01060'],
    ['Attack Event (Swinging Web Kick 01005)', 'CHOSEN_ENEMY', '01005'],
    ['Attack Event (Relentless Assault 01053)', 'CHOSEN_MINION', '01053'],
    ['Ally Event (Get Ready 01069)', 'CHOSEN_ALLY', '01069'],
  ])('%s asks for a target with %s', (_name, selector, code) => {
    const { card, choice } = choiceFor(code);
    expect(card.type).toBe(CardType.EVENT);
    expect(choice?.selector).toBe(selector);
  });

  it('Heal Event (First Aid 01086) asks for a character target', () => {
    const { choice } = choiceFor('01086');
    expect(choice?.selector).toMatch(/^CHOSEN_/);
    expect(choice?.selector).not.toMatch(/SCHEME|ENEMY/);
  });

  it('offers only the schemes with threat to a thwart event (#438)', () => {
    const state = newRhinoGame();
    const main = getActiveMainScheme(state)!;
    main.threat = 0;
    state.sideSchemes = [
      { instanceId: 'side-1', card: cardCatalog.getCard('01108') as SideSchemeCard, threat: 2 },
      { instanceId: 'side-2', card: cardCatalog.getCard('01108') as SideSchemeCard, threat: 0 },
    ];
    const forJustice = createCardInstance(cardCatalog.getCard('01060')!);

    const choice = getPlayTargetChoice(state, state.players[0], forJustice);
    expect(choice?.targets.map((t) => t.id)).toEqual(['side-1']);
  });

  describe('attachments ask for a host the engine accepts (#366)', () => {
    it('Spider-Tracer (01007) lists the minions in play', () => {
      const state = newRhinoGame();
      const minion = createCardInstance(cardCatalog.getCard('01101')!, 'p1');
      state.players[0].engagedMinions = [minion];
      const tracer = createCardInstance(cardCatalog.getCard('01007')!, 'p1');

      const choice = getPlayTargetChoice(state, state.players[0], tracer);
      expect(choice?.selector).toBe('CHOSEN_MINION');
      expect(choice?.targets.map((t) => t.id)).toEqual([minion.instanceId]);
    });

    it('Inspired (01074) leaves out an ally that already holds one', () => {
      const state = newRhinoGame();
      const full = createCardInstance(cardCatalog.getCard('01058')!, 'p1');
      const free = createCardInstance(cardCatalog.getCard('01066')!, 'p1');
      full.attachments = [createCardInstance(cardCatalog.getCard('01074')!, 'p1')];
      state.players[0].allies = [full, free];
      const inspired = createCardInstance(cardCatalog.getCard('01074')!, 'p1');

      const choice = getPlayTargetChoice(state, state.players[0], inspired);
      expect(choice?.targets.map((t) => t.id)).toEqual([free.instanceId]);
    });
  });

  describe('CardPaymentModal Cost Reduction & Caution Banner Invariants (Issue #46)', () => {
    function evaluateCostDisplayState(
      baseCost: number,
      reductions: { sourceCardName: string; amount: number }[],
    ) {
      const totalReduction = reductions.reduce((sum, r) => sum + r.amount, 0);
      const effectiveCost = Math.max(0, baseCost - totalReduction);
      const showDiscountBanner = reductions.length > 0 && baseCost > 0;
      const showCautionBanner = reductions.length > 0 && baseCost === 0;
      const showStrikethrough = reductions.length > 0 && baseCost > 0;

      return {
        effectiveCost,
        baseCost,
        totalReduction,
        showDiscountBanner,
        showCautionBanner,
        showStrikethrough,
      };
    }

    it('Card with cost > 0 displays discount banner and strikethrough cost', () => {
      const state = evaluateCostDisplayState(2, [{ sourceCardName: 'Helicarrier', amount: 1 }]);
      expect(state.effectiveCost).toBe(1);
      expect(state.showDiscountBanner).toBe(true);
      expect(state.showCautionBanner).toBe(false);
      expect(state.showStrikethrough).toBe(true);
      expect(state.totalReduction).toBe(1);
    });

    it('Card with cost 0 displays caution banner and no discount banner or strikethrough', () => {
      const state = evaluateCostDisplayState(0, [{ sourceCardName: 'Helicarrier', amount: 1 }]);
      expect(state.effectiveCost).toBe(0);
      expect(state.showDiscountBanner).toBe(false);
      expect(state.showCautionBanner).toBe(true);
      expect(state.showStrikethrough).toBe(false);
    });

    it('Card without cost reductions displays standard cost without banners or strikethrough', () => {
      const state = evaluateCostDisplayState(3, []);
      expect(state.effectiveCost).toBe(3);
      expect(state.showDiscountBanner).toBe(false);
      expect(state.showCautionBanner).toBe(false);
      expect(state.showStrikethrough).toBe(false);
    });
  });
});
