import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import {
  GameState,
  HeroCard,
  AlterEgoCard,
  VillainCard,
  MainSchemeCard,
  StatusCard,
} from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { executeEffect } from '@engine/effects';
import { dispatchAction } from '@engine/pipeline/action-dispatcher';
import { getEffectiveHeroStats } from '@engine/pipeline/stat-calculator';

describe('Sub-Milestone 2D-3: Core Set Hero Cards Promotion Pass (Part 1)', () => {
  let state: GameState;
  let peterParkerAlterEgo: AlterEgoCard;
  let captainMarvelHero: HeroCard;
  let rhinoVillain: VillainCard;
  let mainScheme: MainSchemeCard;

  beforeEach(() => {
    peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;
    captainMarvelHero = cardCatalog.getCard('01010a') as HeroCard;
    rhinoVillain = cardCatalog.getCard('01094') as VillainCard;
    mainScheme = cardCatalog.getCard('01097b') as MainSchemeCard;

    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Hero Player',
          hero: captainMarvelHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: rhinoVillain,
      mainScheme,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = captainMarvelHero;
  });

  describe('Captain Marvel: Helmet (01016), Energy Channel (01018), Hellcat (01020)', () => {
    it("Captain Marvel's Helmet grants +1 DEF (+2 DEF when Aerial)", () => {
      const player = state.players[0];
      const helmet = createCardInstance(cardCatalog.getCard('01016')!);
      player.tableau.push(helmet);

      // Base DEF 1 + Helmet 1 = 2 DEF
      let stats = getEffectiveHeroStats(state, player);
      expect(stats.defense).toBe(2);

      // Add Cosmic Flight (01017) to grant Aerial trait
      const cosmicFlight = createCardInstance(cardCatalog.getCard('01017')!);
      player.tableau.push(cosmicFlight);

      // Now Aerial is active: Base DEF 1 + Helmet 2 = 3 DEF
      stats = getEffectiveHeroStats(state, player);
      expect(stats.defense).toBe(3);
    });

    it('Energy Channel accumulates energy counters and deals 2 damage per counter (up to 10)', () => {
      const player = state.players[0];
      const channel = createCardInstance(cardCatalog.getCard('01018')!);
      player.tableau.push(channel);

      // Add 3 energy counters
      executeEffect(
        state,
        { effect: 'ADD_COUNTER', params: { amount: 3 } },
        { playerId: 'p1', sourceCardInstance: channel },
      );
      expect(channel.tokens?.counters).toBe(3);

      const initialHp = state.villain.health;

      // Discard channel and blast villain: 3 counters * 2 damage = 6 damage
      state.villain.health = Math.max(
        0,
        state.villain.health - (channel.tokens?.counters || 0) * 2,
      );
      expect(state.villain.health).toBe(initialHp - 6);
    });

    it('Hellcat returns from allies to hand', () => {
      const player = state.players[0];
      const hellcat = createCardInstance(cardCatalog.getCard('01020')!);
      player.allies.push(hellcat);
      player.hand = [];

      const result = executeEffect(
        state,
        { effect: 'RETURN_TO_HAND' },
        { playerId: 'p1', sourceCardInstance: hellcat },
      );
      expect(result.success).toBe(true);
      expect(player.allies.length).toBe(0);
      expect(player.hand.length).toBe(1);
      expect(player.hand[0].card.code).toBe('01020');
    });
  });

  describe('She-Hulk: Superhuman Strength (01028)', () => {
    it('Superhuman Strength gives +2 ATK and stuns enemy after attack', () => {
      const player = state.players[0];
      const strCard = createCardInstance(cardCatalog.getCard('01028')!);
      player.tableau.push(strCard);

      const stats = getEffectiveHeroStats(state, player);
      // Base ATK 2 + Superhuman Strength 2 = 4 ATK
      expect(stats.attack).toBe(4);

      // Stun trigger
      state.villain.statusCards = [];
      executeEffect(
        state,
        { effect: 'ADD_STATUS', params: { status: 'STUNNED', target: 'ATTACK_TARGET' } },
        { playerId: 'p1', targetType: 'villain' },
      );
      expect(state.villain.statusCards).toContain(StatusCard.STUNNED);
    });
  });

  describe('Iron Man: Repulsor Blast (01031), Pepper Potts (01033), Stark Tower (01034)', () => {
    it('Repulsor Blast discards 5 cards and deals 1 base + 2 damage per energy resource', () => {
      const player = state.players[0];
      // Stack deck with 3 energy cards and 2 mental cards
      const energyCard = createCardInstance(cardCatalog.getCard('01014')!); // Energy Absorption (3 energy icons)
      const nonEnergy = createCardInstance(cardCatalog.getCard('01005')!);

      player.deck = [energyCard, nonEnergy, nonEnergy, nonEnergy, nonEnergy];
      const initialHp = state.villain.health;

      const result = executeEffect(
        state,
        { effect: 'REPULSOR_BLAST', params: { discardCount: 5 } },
        { playerId: 'p1' },
      );

      expect(result.success).toBe(true);
      expect(result.value).toBe(1 + 3 * 2); // 1 base + 6 from energy = 7 damage
      expect(state.villain.health).toBe(initialHp - 7);
    });

    it('Pepper Potts generates resources of top discard card', () => {
      const player = state.players[0];
      const energyCard = createCardInstance(cardCatalog.getCard('01014')!); // Energy Absorption (3 resources)
      player.discard = [energyCard];

      const result = executeEffect(
        state,
        { effect: 'GENERATE_TOP_DISCARD_RESOURCES' },
        { playerId: 'p1' },
      );
      expect(result.success).toBe(true);
      expect(result.value).toBe(3);
    });

    it('Stark Tower retrieves topmost Tech upgrade from discard pile to hand', () => {
      const player = state.players[0];
      const techUpgrade = createCardInstance(cardCatalog.getCard('01036')!); // Mark V Armor (Tech Upgrade)
      const eventCard = createCardInstance(cardCatalog.getCard('01005')!); // Non-tech

      player.discard = [techUpgrade, eventCard];
      player.hand = [];

      const result = executeEffect(
        state,
        { effect: 'RETRIEVE_TECH_UPGRADE_FROM_DISCARD', params: { trait: 'Tech' } },
        { playerId: 'p1' },
      );
      expect(result.success).toBe(true);
      expect(player.hand.length).toBe(1);
      expect(player.hand[0].card.code).toBe('01036');
      expect(player.discard.length).toBe(1);
    });
  });

  describe("Black Panther: T'Challa (01040b), Shuri (01041), Ancestral Knowledge (01042), Wakanda Forever! (01043a-d)", () => {
    it("T'Challa and Shuri search deck for an upgrade and add to hand via canonical SEARCH_AND_SELECT", () => {
      const player = state.players[0];
      const bpUpgrade = createCardInstance(cardCatalog.getCard('01046')!); // Energy Daggers
      const fillerCard = createCardInstance(cardCatalog.getCard('01005')!);

      player.deck = [fillerCard, bpUpgrade, fillerCard];
      player.hand = [];

      const result = executeEffect(
        state,
        {
          effect: 'SEARCH_AND_SELECT',
          params: {
            source: 'PLAYER_DECK',
            trait: 'Black Panther',
            type: 'upgrade',
            takeCount: 1,
            selectedDestination: 'HAND',
            shuffleAfter: true,
          },
        },
        { playerId: 'p1' },
      );

      expect(result.success).toBe(true);

      let finalState = result.state;
      if (finalState.pendingDecisionPrompt) {
        const resolveRes = dispatchAction(finalState, {
          type: 'RESOLVE_DECISION_PROMPT',
          playerId: 'p1',
          selectedOptionId: bpUpgrade.instanceId,
        });
        finalState = resolveRes.state;
      }

      expect(finalState.players[0].hand.length).toBe(1);
      expect(finalState.players[0].hand[0].card.code).toBe('01046');
      expect(finalState.players[0].deck.length).toBe(2);
    });

    it('Ancestral Knowledge shuffles cards from discard into deck', () => {
      const player = state.players[0];
      const card1 = createCardInstance(cardCatalog.getCard('01005')!);
      const card2 = createCardInstance(cardCatalog.getCard('01006')!);
      const card3 = createCardInstance(cardCatalog.getCard('01007')!);

      player.discard = [card1, card2, card3];
      player.deck = [];

      const result = executeEffect(
        state,
        { effect: 'SHUFFLE_DISCARD_INTO_DECK', params: { count: 3 } },
        { playerId: 'p1' },
      );
      expect(result.success).toBe(true);
      expect(player.discard.length).toBe(0);
      expect(player.deck.length).toBe(3);
    });

    it('Wakanda Forever! resolves all in-play Black Panther upgrades with finisher bonus on final step', () => {
      const player = state.players[0];
      const daggers = createCardInstance(cardCatalog.getCard('01046')!); // Energy Daggers
      const suit = createCardInstance(cardCatalog.getCard('01049')!); // Vibranium Suit
      const claws = createCardInstance(cardCatalog.getCard('01047')!); // Panther Claws

      player.tableau.push(daggers, suit, claws);
      player.health = 5; // damaged hero

      const initialVillainHp = state.villain.health;

      // Execute Wakanda Forever:
      // 1. Energy Daggers: 1 damage to villain
      // 2. Vibranium Suit: Heal 1, 1 damage to villain
      // 3. Panther Claws (Final Step): 4 damage to villain (2 base + 2 finisher)
      // Total villain damage = 1 + 1 + 4 = 6 damage. Hero healed +1 (5 -> 6).
      const result = executeEffect(
        state,
        {
          effect: 'EXECUTE_WAKANDA_FOREVER',
          params: { sequenceOrder: [daggers.instanceId, suit.instanceId, claws.instanceId] },
        },
        { playerId: 'p1' },
      );

      expect(result.success).toBe(true);
      expect(result.value).toBe(3); // 3 upgrades executed
      expect(player.health).toBe(6);
      expect(state.villain.health).toBe(initialVillainHp - 6);
    });
  });
});
