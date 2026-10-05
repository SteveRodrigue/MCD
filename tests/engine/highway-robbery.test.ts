import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '@data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard, CardInstance } from '@engine/models';
import { setupGame, createCardInstance, resetInstanceCounter } from '@engine/state/game-setup';
import { assertCardConservation } from '@engine/state/state-validator';
import { step4_revealEncounterCards } from '@engine/index';
import { applyThwart } from '@engine/pipeline';
import { defeatSideScheme } from '@engine/effects';

// Highway Robbery (01166), #238:
// "When Revealed: Each player places a random card from their hand facedown here.
//  When Defeated: Return each facedown card here to its owner's hand."
describe('Highway Robbery (01166): facedown cards stay under the scheme and return (#238)', () => {
  let state: GameState;

  const player = (id: string, hero: string, alterEgo: string) => ({
    id,
    name: id,
    hero: cardCatalog.getCard(hero) as HeroCard,
    alterEgo: cardCatalog.getCard(alterEgo) as AlterEgoCard,
    deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
  });

  const setup = () => {
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
  };

  const handCard = (name: string): CardInstance =>
    createCardInstance({
      code: `filler-${name}`,
      name,
      type: 'event',
      faction: 'justice',
    } as any);

  const revealRobbery = () => {
    state.players[0].dealtEncounterCards.push(createCardInstance(cardCatalog.getCard('01166')!));
    state = step4_revealEncounterCards(state);
  };

  const robbery = () => state.sideSchemes.find((s) => s.card.code === '01166')!;

  beforeEach(() => setup());

  it('When Revealed puts one card from each hand facedown under the real side scheme', () => {
    state.players[0].hand = [handCard('p1-only')];
    state.players[1].hand = [handCard('p2-only')];

    revealRobbery();

    expect(state.players[0].hand).toHaveLength(0);
    expect(state.players[1].hand).toHaveLength(0);
    const under = robbery().cardsUnderneath ?? [];
    expect(under.map((c) => [c.card.name, c.ownerId]).sort()).toEqual([
      ['p1-only', 'p1'],
      ['p2-only', 'p2'],
    ]);
    expect(robbery().attachments ?? []).toHaveLength(0);
    assertCardConservation(state);
  });

  it('takes exactly one card from a larger hand, chosen from that hand', () => {
    const cards = ['a', 'b', 'c'].map(handCard);
    state.players[0].hand = [...cards];
    state.players[1].hand = [];

    revealRobbery();

    const under = robbery().cardsUnderneath ?? [];
    expect(under).toHaveLength(1);
    expect(cards.map((c) => c.instanceId)).toContain(under[0].instanceId);
    expect(state.players[0].hand).toHaveLength(2);
    assertCardConservation(state);
  });

  it('a player with an empty hand loses nothing and the other player still places a card', () => {
    state.players[0].hand = [];
    state.players[1].hand = [handCard('p2-only')];

    revealRobbery();

    const under = robbery().cardsUnderneath ?? [];
    expect(under.map((c) => c.ownerId)).toEqual(['p2']);
  });

  it('When Defeated returns each facedown card to its owner and discards none', () => {
    const p1Card = handCard('p1-only');
    const p2Card = handCard('p2-only');
    state.players[0].hand = [p1Card];
    state.players[1].hand = [p2Card];
    revealRobbery();
    const discardsBefore = state.players.map((p) => p.discard.length);
    const encounterDiscardBefore = state.encounterDiscard.length;

    // Player two defeats it: cards must still go to their own owners.
    defeatSideScheme(state, robbery().instanceId, 'p2');

    expect(state.players[0].hand.map((c) => c.instanceId)).toEqual([p1Card.instanceId]);
    expect(state.players[1].hand.map((c) => c.instanceId)).toEqual([p2Card.instanceId]);
    expect(state.players.map((p) => p.discard.length)).toEqual(discardsBefore);
    // Only Highway Robbery itself reaches the encounter discard.
    expect(state.encounterDiscard.length).toBe(encounterDiscardBefore + 1);
    expect(state.sideSchemes.some((s) => s.card.code === '01166')).toBe(false);
    assertCardConservation(state);
  });

  it('returns the cards when the scheme is defeated by a thwart', () => {
    const p1Card = handCard('p1-only');
    state.players[0].hand = [p1Card];
    state.players[1].hand = [];
    revealRobbery();
    const scheme = robbery();

    const { result } = applyThwart(state, {
      thwarterType: 'CARD_EFFECT',
      playerId: 'p1',
      targetType: 'side_scheme',
      targetInstanceId: scheme.instanceId,
      thwartValue: 99,
    });

    expect(result.schemeDefeated).toBe(true);
    expect(state.players[0].hand.map((c) => c.instanceId)).toEqual([p1Card.instanceId]);
    assertCardConservation(state);
  });
});
