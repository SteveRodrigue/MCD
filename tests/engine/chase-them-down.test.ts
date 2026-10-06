import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard, CardInstance, CardResources } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { dispatchAction } from '@engine/pipeline';
import { executeEffect } from '@engine/effects';

// Chase Them Down (01052), #247:
// "Response (thwart): After your hero attacks and defeats an enemy, remove 2 threat from a scheme."
// Tigra (01051): "Response: After Tigra attacks and defeats a minion, heal 1 damage from her."
describe('Responses to a defeat by an attack (#247): Chase Them Down and Tigra', () => {
  let state: GameState;

  const resources = (physical: number): CardResources => ({
    physical,
    energy: 0,
    mental: 0,
    wild: 0,
    total: physical,
  });

  const player = (id: string, hero: string, alterEgo: string) => ({
    id,
    name: id,
    hero: cardCatalog.getCard(hero) as HeroCard,
    alterEgo: cardCatalog.getCard(alterEgo) as AlterEgoCard,
    deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
  });

  beforeEach(() => {
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
    state.mainScheme.threat = 5;
  });

  const chaseThemDown = (owner = 'p1'): CardInstance =>
    createCardInstance(cardCatalog.getCard('01052')!, owner);

  const minion = (code = '01110'): CardInstance => createCardInstance(cardCatalog.getCard(code)!); // 01110: 1 HP

  const prompts = () => state.pendingDecisionQueue ?? [];
  const chasePrompts = () => prompts().filter((p) => p.sourceCardCode === '01052');

  const basicAttack = (playerId: string, targetType: 'minion' | 'villain', id?: string) => {
    const res = dispatchAction(state, {
      type: 'BASIC_ATTACK',
      playerId,
      targetType,
      targetInstanceId: id ?? state.villain.instanceId,
    });
    state = res.state;
    return res;
  };

  const answer = (playerId: string, optionId: string) => {
    const res = dispatchAction(state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId,
      selectedOptionId: optionId,
    });
    state = res.state;
    return res;
  };

  describe('9. Your hero basic attack defeats a minion', () => {
    it('offers Chase Them Down from hand; Yes removes 2 threat from the scheme', () => {
      const card = chaseThemDown();
      state.players[0].hand = [card];
      const m = minion();
      state.players[0].engagedMinions = [m];

      basicAttack('p1', 'minion', m.instanceId);

      expect(state.players[0].engagedMinions).toHaveLength(0);
      expect(chasePrompts()).toHaveLength(1);
      expect(chasePrompts()[0].playerId).toBe('p1');

      answer('p1', 'trigger_chase_them_down');

      expect(state.mainScheme.threat).toBe(3);
      expect(state.players[0].hand.map((c) => c.instanceId)).not.toContain(card.instanceId);
      expect(state.players[0].discard.map((c) => c.instanceId)).toContain(card.instanceId);
    });

    it('No leaves the card in hand and the threat unchanged', () => {
      const card = chaseThemDown();
      state.players[0].hand = [card];
      const m = minion();
      state.players[0].engagedMinions = [m];

      basicAttack('p1', 'minion', m.instanceId);
      answer('p1', 'pass');

      expect(state.mainScheme.threat).toBe(5);
      expect(state.players[0].hand.map((c) => c.instanceId)).toContain(card.instanceId);
    });

    it('is not offered when the minion survives', () => {
      state.players[0].hand = [chaseThemDown()];
      const m = minion('01101'); // 3 HP, Spider-Man deals 2
      state.players[0].engagedMinions = [m];

      basicAttack('p1', 'minion', m.instanceId);

      expect(chasePrompts()).toHaveLength(0);
    });
  });

  describe('10. A labelled attack event defeats a minion', () => {
    it('Uppercut (01054) defeats a minion: Chase Them Down is offered', () => {
      state.players[0].hand = [chaseThemDown()];
      const m = minion('01101'); // 3 HP, Uppercut deals 5
      state.players[0].engagedMinions = [m];

      const uppercut = createCardInstance(cardCatalog.getCard('01054')!, 'p1');
      const physical = cardCatalog.getCard('01005')!;
      const pay = [1, 2, 3].map(() =>
        createCardInstance({ ...physical, resources: resources(1) }, 'p1'),
      );
      state.players[0].hand.push(uppercut, ...pay);

      const res = dispatchAction(state, {
        type: 'PLAY_CARD',
        playerId: 'p1',
        cardInstanceId: uppercut.instanceId,
        targetInstanceId: m.instanceId,
        paymentCardInstanceIds: pay.map((c) => c.instanceId),
      });
      state = res.state;

      expect(res.result.success).toBe(true);
      expect(state.players[0].engagedMinions).toHaveLength(0);
      expect(chasePrompts()).toHaveLength(1);

      answer('p1', 'trigger_chase_them_down');
      expect(state.mainScheme.threat).toBe(3);
    });
  });

  describe('11. Your hero attack defeats the villain', () => {
    it('offers Chase Them Down for the defeated villain (stage I, standard)', () => {
      state.players[0].hand = [chaseThemDown()];
      state.villain.health = 1;

      basicAttack('p1', 'villain');

      expect(chasePrompts()).toHaveLength(1);
    });
  });

  describe('12. An ally attack is not an attack by your hero', () => {
    it('Hellcat (01020) defeats a minion: not offered', () => {
      state.players[0].hand = [chaseThemDown()];
      const ally = createCardInstance(cardCatalog.getCard('01020')!, 'p1');
      state.players[0].allies = [ally];
      const m = minion('01101'); // 3 HP, already hit twice so any ally attack defeats it
      m.tokens = { ...m.tokens, damage: 2 };
      state.players[0].engagedMinions = [m];

      const res = dispatchAction(state, {
        type: 'ALLY_ATTACK',
        playerId: 'p1',
        allyInstanceId: ally.instanceId,
        targetType: 'minion',
        targetInstanceId: m.instanceId,
      });
      state = res.state;

      expect(state.players[0].engagedMinions).toHaveLength(0);
      expect(chasePrompts()).toHaveLength(0);
      expect(state.mainScheme.threat).toBe(5);
    });
  });

  describe('13. An effect that is not an attack', () => {
    it('a damage effect that defeats a minion does not offer Chase Them Down', () => {
      state.players[0].hand = [chaseThemDown()];
      const m = minion();
      state.players[0].engagedMinions = [m];

      const res = executeEffect(
        state,
        {
          id: 'plain_damage',
          timing: 'ACTION',
          steps: [
            {
              effect: 'DEAL_DAMAGE',
              effectParams: { amount: 3, target: 'CHOSEN_MINION' },
            },
          ],
        } as any,
        { playerId: 'p1', chosenTargetType: 'minion', chosenTargetInstanceId: m.instanceId },
      );
      state = res.state ?? state;

      expect(state.players[0].engagedMinions).toHaveLength(0);
      expect(chasePrompts()).toHaveLength(0);
    });
  });

  describe('14. Whose hero it was, and every copy', () => {
    it("another player's hero defeats a minion: not offered to you, offered to them", () => {
      state.players[0].hand = [chaseThemDown('p1')];
      state.players[1].hand = [chaseThemDown('p2')];
      const m = minion();
      state.players[1].engagedMinions = [m];
      state.activePlayerIndex = 1;

      basicAttack('p2', 'minion', m.instanceId);

      expect(chasePrompts().map((p) => p.playerId)).toEqual(['p2']);
    });

    it('two players each holding Chase Them Down are each offered their own', () => {
      state.players[0].hand = [chaseThemDown('p1')];
      state.players[1].hand = [chaseThemDown('p2')];
      const m1 = minion();
      const m2 = minion();
      state.players[0].engagedMinions = [m1];
      state.players[1].engagedMinions = [m2];

      basicAttack('p1', 'minion', m1.instanceId);
      expect(chasePrompts().map((p) => p.playerId)).toEqual(['p1']);
      answer('p1', 'pass');
      expect(chasePrompts()).toHaveLength(0);

      state.activePlayerIndex = 1;
      basicAttack('p2', 'minion', m2.instanceId);
      expect(chasePrompts().map((p) => p.playerId)).toEqual(['p2']);
    });

    it('every copy in hand is offered once for one defeat', () => {
      state.players[0].hand = [chaseThemDown(), chaseThemDown()];
      const m = minion();
      state.players[0].engagedMinions = [m];

      basicAttack('p1', 'minion', m.instanceId);

      // DEFEATED and CHARACTER_DEFEATED both fire for the defeat; each copy is offered once.
      expect(chasePrompts()).toHaveLength(2);
    });
  });

  describe('15. Tigra (01051)', () => {
    const tigraInPlay = () => {
      const tigra = createCardInstance(cardCatalog.getCard('01051')!, 'p1');
      state.players[0].allies = [tigra];
      return tigra;
    };
    // dispatchAction returns a new state: always read Tigra from the current one
    const damageOn = (instanceId: string) =>
      state.players[0].allies.find((a) => a.instanceId === instanceId)?.tokens?.damage ?? 0;
    const tigraPrompts = () => prompts().filter((p) => p.sourceCardCode === '01051');

    it('Tigra attacks and defeats a minion: she heals 1', () => {
      const tigra = tigraInPlay();
      tigra.tokens = { ...tigra.tokens, damage: 1 };
      const m = minion('01101'); // 3 HP, already hit twice so any ally attack defeats it
      m.tokens = { ...m.tokens, damage: 2 };
      state.players[0].engagedMinions = [m];

      const res = dispatchAction(state, {
        type: 'ALLY_ATTACK',
        playerId: 'p1',
        allyInstanceId: tigra.instanceId,
        targetType: 'minion',
        targetInstanceId: m.instanceId,
      });
      state = res.state;

      expect(tigraPrompts()).toHaveLength(1);
      // Attacking costs Tigra 1 damage (2 now); healing 1 leaves 1.
      expect(damageOn(tigra.instanceId)).toBe(2);
      answer('p1', 'trigger_tigra_defeat_heal');
      expect(damageOn(tigra.instanceId)).toBe(1);
    });

    it('your hero defeats a minion: Tigra does not heal', () => {
      const tigra = tigraInPlay();
      tigra.tokens = { ...tigra.tokens, damage: 1 };
      const m = minion();
      state.players[0].engagedMinions = [m];

      basicAttack('p1', 'minion', m.instanceId);

      expect(state.players[0].engagedMinions).toHaveLength(0);
      expect(tigraPrompts()).toHaveLength(0);
      expect(damageOn(tigra.instanceId)).toBe(1);
    });

    it('another ally defeats a minion: Tigra does not heal', () => {
      const tigra = tigraInPlay();
      const hellcat = createCardInstance(cardCatalog.getCard('01020')!, 'p1');
      state.players[0].allies.push(hellcat);
      const m = minion('01101'); // 3 HP, already hit twice so any ally attack defeats it
      m.tokens = { ...m.tokens, damage: 2 };
      state.players[0].engagedMinions = [m];

      const res = dispatchAction(state, {
        type: 'ALLY_ATTACK',
        playerId: 'p1',
        allyInstanceId: hellcat.instanceId,
        targetType: 'minion',
        targetInstanceId: m.instanceId,
      });
      state = res.state;

      expect(state.players[0].engagedMinions).toHaveLength(0);
      expect(tigraPrompts()).toHaveLength(0);
      expect(damageOn(tigra.instanceId)).toBe(0);
    });
  });
});
