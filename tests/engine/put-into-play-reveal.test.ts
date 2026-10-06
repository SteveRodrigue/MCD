import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard, CardInstance } from '@engine/models';
import { setupGame, createCardInstance, resetInstanceCounter } from '@engine/state/game-setup';
import { assertCardConservation } from '@engine/state/state-validator';
import { executeEffect, defeatSideScheme } from '@engine/effects';

// RR v1.8 glossary R (Reveal) and W (When Revealed Abilities): a card that is revealed and put into
// play resolves its When Revealed abilities (and Surge); a card merely put into play does not.
describe('PUT_INTO_PLAY: reveal versus put into play', () => {
  let state: GameState;

  const player = (id: string, hero: string, alterEgo: string) => ({
    id,
    name: id,
    hero: cardCatalog.getCard(hero) as HeroCard,
    alterEgo: cardCatalog.getCard(alterEgo) as AlterEgoCard,
    deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
  });

  const handCard = (name: string): CardInstance =>
    createCardInstance({
      code: `filler-${name}`,
      name,
      type: 'event',
      faction: 'justice',
    } as any);

  beforeEach(() => {
    resetInstanceCounter();
    state = setupGame({
      scenarioId: 'rhino',
      players: [player('p1', '01001a', '01001b'), player('p2', '01010a', '01010b')],
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

  describe('Shadow of the Past (01190) reveals Highway Robbery (01166)', () => {
    const robbery = () => state.sideSchemes.find((s) => s.card.code === '01166')!;

    const revealShadowOfThePast = () => {
      // Alter-ego form: the nemesis minion's Quickstrike does not open a defender prompt.
      state.players[0].currentForm = 'alter_ego';
      state.players[0].activeFormCard = state.players[0].alterEgo;
      const card = cardCatalog.getCard('01190')!;
      const inst = createCardInstance(card);
      const res = executeEffect(state, card.enrichment!.abilities![0], {
        playerId: 'p1',
        sourceCardInstance: inst,
      });
      state = res.state;
    };

    it('each player loses one card from hand and it is under the real scheme, owner set', () => {
      state.players[0].hand = [handCard('p1-only')];
      state.players[1].hand = [handCard('p2-only')];

      revealShadowOfThePast();

      expect(state.players[0].hand).toHaveLength(0);
      expect(state.players[1].hand).toHaveLength(0);
      const under = robbery().cardsUnderneath ?? [];
      expect(under.map((c) => [c.card.name, c.ownerId]).sort()).toEqual([
        ['p1-only', 'p1'],
        ['p2-only', 'p2'],
      ]);
      assertCardConservation(state);
    });

    it('When Defeated does not run on entry; defeating the scheme afterwards returns the cards', () => {
      const p1Card = handCard('p1-only');
      const p2Card = handCard('p2-only');
      state.players[0].hand = [p1Card];
      state.players[1].hand = [p2Card];

      revealShadowOfThePast();

      // Entry must not have run the When Defeated return: the cards are still underneath.
      expect((robbery().cardsUnderneath ?? []).map((c) => c.instanceId).sort()).toEqual(
        [p1Card.instanceId, p2Card.instanceId].sort(),
      );
      expect(state.players[0].hand).toHaveLength(0);
      expect(state.players[1].hand).toHaveLength(0);

      defeatSideScheme(state, robbery().instanceId, 'p1');

      expect(state.players[0].hand.map((c) => c.instanceId)).toEqual([p1Card.instanceId]);
      expect(state.players[1].hand.map((c) => c.instanceId)).toEqual([p2Card.instanceId]);
      assertCardConservation(state);
    });
  });

  describe('Surge on a card put into play', () => {
    const putWeaponsRunnerIntoPlay = (reveal: boolean) => {
      const wr = createCardInstance(cardCatalog.getCard('01121')!);
      state.players[0].setAsideCards = [wr];
      const effectParams: Record<string, unknown> = {
        from: 'SET_ASIDE',
        to: 'ENGAGED_WITH_PLAYER',
        filter: { types: ['minion'] },
      };
      if (reveal) effectParams.reveal = true;
      executeEffect(
        state,
        {
          id: 'test_put_into_play',
          timing: 'WHEN_REVEALED',
          trigger: 'WHEN_REVEALED',
          steps: [{ id: 'put', effect: 'PUT_INTO_PLAY', effectParams }],
        } as any,
        { playerId: 'p1' },
      );
      return wr;
    };

    it('with reveal: true, a minion that prints Surge deals one surge card', () => {
      const wr = putWeaponsRunnerIntoPlay(true);

      expect(state.players[0].engagedMinions.map((m) => m.instanceId)).toEqual([wr.instanceId]);
      expect(state.players[0].dealtEncounterCards).toHaveLength(1);
    });

    it('without reveal, no surge card is dealt', () => {
      const wr = putWeaponsRunnerIntoPlay(false);

      expect(state.players[0].engagedMinions.map((m) => m.instanceId)).toEqual([wr.instanceId]);
      expect(state.players[0].dealtEncounterCards).toHaveLength(0);
    });
  });
});
