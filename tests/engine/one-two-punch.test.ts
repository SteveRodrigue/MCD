import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard, MinionCard, StatusCard } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { dispatchAction, peekDecisionPrompt } from '@engine/pipeline';

const ONE_TWO_PUNCH = '01024';
const RESOURCE_CARD = '01005';

describe('One-Two Punch (01024): Response after you make a basic attack, ready She-Hulk (#302)', () => {
  let state: GameState;

  const give = (playerIndex: number, code: string) => {
    const inst = createCardInstance(cardCatalog.getCard(code)!);
    state.players[playerIndex].hand.push(inst);
    return inst;
  };
  const attackVillain = (playerId = 'p1') =>
    dispatchAction(state, { type: 'BASIC_ATTACK', playerId, targetType: 'villain' });
  const answer = (selectedOptionId: string, playerId = 'p1') =>
    dispatchAction(state, { type: 'RESOLVE_DECISION_PROMPT', playerId, selectedOptionId });

  beforeEach(() => {
    const sheHulk = cardCatalog.getCard('01019a') as HeroCard;
    const jennifer = cardCatalog.getCard('01019b') as AlterEgoCard;
    const ironMan = cardCatalog.getCard('01029a') as HeroCard;
    const tony = cardCatalog.getCard('01029b') as AlterEgoCard;

    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'She-Hulk',
          hero: sheHulk,
          alterEgo: jennifer,
          deckCards: Array(10).fill(cardCatalog.getCard(RESOURCE_CARD)!),
        },
        {
          id: 'p2',
          name: 'Iron Man',
          hero: ironMan,
          alterEgo: tony,
          deckCards: Array(10).fill(cardCatalog.getCard(RESOURCE_CARD)!),
        },
      ],
      skipMulligan: true,
    });
    for (const [i, hero] of [sheHulk, ironMan].entries()) {
      state.players[i].currentForm = 'hero';
      state.players[i].activeFormCard = hero;
      state.players[i].hand = [];
      state.players[i].discard = [];
    }
  });

  it('offers the Response after a basic attack on the villain', () => {
    give(0, ONE_TWO_PUNCH);
    give(0, RESOURCE_CARD);

    const res = attackVillain();
    expect(res.result.success).toBe(true);
    state = res.state;

    const prompt = peekDecisionPrompt(state)!;
    expect(prompt).toBeDefined();
    expect(prompt.sourceCardCode).toBe(ONE_TWO_PUNCH);
    expect(state.players[0].exhausted).toBe(true);
  });

  it('readies She-Hulk and puts the event in the discard pile when accepted', () => {
    const punch = give(0, ONE_TWO_PUNCH);
    give(0, RESOURCE_CARD);

    state = attackVillain().state;
    const yes = peekDecisionPrompt(state)!.options.find(
      (o) => o.id === 'trigger_one_two_punch_response',
    )!;
    state = answer(yes.id).state;

    // Paying the 1 resource may open a payment prompt; settle it if so.
    let guard = 0;
    while (peekDecisionPrompt(state) && guard++ < 5) {
      const next = peekDecisionPrompt(state)!;
      state = answer(next.options[0].id).state;
    }

    expect(state.players[0].exhausted).toBe(false);
    expect(state.players[0].hand.map((c) => c.instanceId)).not.toContain(punch.instanceId);
    expect(state.players[0].discard.map((c) => c.instanceId)).toContain(punch.instanceId);
  });

  it('leaves She-Hulk exhausted and the card in hand when declined', () => {
    const punch = give(0, ONE_TWO_PUNCH);
    give(0, RESOURCE_CARD);

    state = attackVillain().state;
    state = answer('pass').state;

    expect(state.players[0].exhausted).toBe(true);
    expect(state.players[0].hand.map((c) => c.instanceId)).toContain(punch.instanceId);
  });

  it('is not offered when the cost cannot be paid', () => {
    give(0, ONE_TWO_PUNCH);

    state = attackVillain().state;

    expect(peekDecisionPrompt(state)).toBeUndefined();
  });

  it("is not offered to another player's hand (the text says you)", () => {
    give(1, ONE_TWO_PUNCH);
    give(1, RESOURCE_CARD);

    state = attackVillain().state;

    expect(peekDecisionPrompt(state)).toBeUndefined();
    expect(state.players[1].hand).toHaveLength(2);
  });

  it('is offered after a basic attack on an engaged minion', () => {
    give(0, ONE_TWO_PUNCH);
    give(0, RESOURCE_CARD);
    const minion = createCardInstance(cardCatalog.getCard('01101') as MinionCard);
    state.players[0].engagedMinions.push(minion);

    state = dispatchAction(state, {
      type: 'BASIC_ATTACK',
      playerId: 'p1',
      targetType: 'minion',
      targetInstanceId: minion.instanceId,
    }).state;

    expect(peekDecisionPrompt(state)?.sourceCardCode).toBe(ONE_TWO_PUNCH);
  });

  it('is not offered when a Stunned hero loses the attack', () => {
    give(0, ONE_TWO_PUNCH);
    give(0, RESOURCE_CARD);
    state.players[0].statusCards = [StatusCard.STUNNED];
    const villainHp = state.villain.health;

    state = attackVillain().state;

    expect(state.villain.health).toBe(villainHp);
    expect(peekDecisionPrompt(state)).toBeUndefined();
  });
});
