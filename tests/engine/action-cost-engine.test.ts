import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard } from '../../src/engine/models';
import { setupGame } from '../../src/engine/state/game-setup';
import { dispatchAction } from '../../src/engine/pipeline';

describe('Milestone 2A.1: Declarative Action Cost & Pre-Check Engine', () => {
  let state: GameState;
  let captainMarvelHero: HeroCard;
  let carolDanversAlterEgo: AlterEgoCard;
  let sheHulkHero: HeroCard;
  let jenniferWaltersAlterEgo: AlterEgoCard;

  beforeEach(() => {
    captainMarvelHero = cardCatalog.getCard('01010b') as HeroCard; // Captain Marvel Hero
    carolDanversAlterEgo = cardCatalog.getCard('01010a') as AlterEgoCard; // Carol Danvers Alter-Ego
    sheHulkHero = cardCatalog.getCard('01019a') as HeroCard;
    jenniferWaltersAlterEgo = cardCatalog.getCard('01019b') as AlterEgoCard;

    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Carol Danvers',
          hero: captainMarvelHero,
          alterEgo: carolDanversAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
        {
          id: 'p2',
          name: 'Jennifer Walters',
          hero: sheHulkHero,
          alterEgo: jenniferWaltersAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    state.players[0].currentForm = 'alter_ego';
    state.players[0].activeFormCard = carolDanversAlterEgo;
    state.players[1].currentForm = 'alter_ego';
    state.players[1].activeFormCard = jenniferWaltersAlterEgo;
  });

  describe('01010a Carol Danvers (Rechannel & Cost Pre-Check)', () => {
    it('Rejects Rechannel when Carol Danvers is already at maximum health', () => {
      const p1 = state.players[0];
      const maxHp = (p1.activeFormCard as AlterEgoCard).health || 12;
      p1.health = maxHp;
      p1.exhausted = false;

      const res = dispatchAction(state, {
        type: 'USE_CARD_ABILITY',
        playerId: p1.id,
        cardInstanceId: '01010a',
        abilityId: 'rechannel',
      });

      expect(res.result.success).toBe(false);
      expect(res.result.error).toContain('maximum health');
      expect(res.state.players[0].exhausted).toBe(false);
    });

    it('Allows Rechannel and exhausts Carol Danvers when damaged', () => {
      const p1 = state.players[0];
      const maxHp = (p1.activeFormCard as AlterEgoCard).health || 12;
      p1.health = maxHp - 3;
      p1.exhausted = false;

      const res = dispatchAction(state, {
        type: 'USE_CARD_ABILITY',
        playerId: p1.id,
        cardInstanceId: '01010a',
        abilityId: 'rechannel',
      });

      expect(res.result.success).toBe(true);
      expect(res.state.players[0].health).toBe(maxHp - 2);
      expect(res.state.players[0].exhausted).toBe(true);
    });
  });

  describe('01023 Legal Practice (Hand Discard Scaling Cost)', () => {
    it('Discards up to 5 cards from hand and removes 1 threat per discarded card', () => {
      const p2 = state.players[1];
      state.activePlayerIndex = 1;
      state.mainScheme.threat = 5;

      // Populate hand with 3 cards
      p2.hand = [
        { instanceId: 'h1', card: { name: 'Card A' } as any, exhausted: false },
        { instanceId: 'h2', card: { name: 'Card B' } as any, exhausted: false },
        { instanceId: 'h3', card: { name: 'Card C' } as any, exhausted: false },
      ];
      p2.discard = [];

      // Put Legal Practice card into tableau/action reference
      p2.tableau.push({
        instanceId: 'legal_practice_inst',
        card: cardCatalog.getCard('01023')!,
        exhausted: false,
      });

      const res = dispatchAction(state, {
        type: 'USE_CARD_ABILITY',
        playerId: p2.id,
        cardInstanceId: 'legal_practice_inst',
        abilityId: 'legal_practice_action',
        discardCardInstanceIds: ['h1', 'h2'],
      } as any);

      expect(res.result.success).toBe(true);
      expect(res.state.players[1].hand.length).toBe(1);
      expect(res.state.players[1].discard.length).toBe(2);
      expect(res.state.mainScheme.threat).toBe(3); // 5 - 2 = 3
    });
  });

  describe('01030 War Machine (Direct Damage Cost to Ally)', () => {
    it('Exhausts War Machine, inflicts 2 damage cost, and deals 2 damage to all enemies', () => {
      const p1 = state.players[0];
      p1.currentForm = 'hero';
      p1.activeFormCard = captainMarvelHero;
      state.activePlayerIndex = 0;

      // Put War Machine into allies
      const warMachineCard = cardCatalog.getCard('01030')!;
      p1.allies.push({
        instanceId: 'war_machine_inst',
        card: warMachineCard,
        tokens: { damage: 0 },
        exhausted: false,
      });

      // Put War Machine into tableau to use ability
      p1.tableau.push({
        instanceId: 'war_machine_inst',
        card: warMachineCard,
        tokens: { damage: 0 },
        exhausted: false,
      });

      const initialVillainHealth = state.villain.health;

      const res = dispatchAction(state, {
        type: 'USE_CARD_ABILITY',
        playerId: p1.id,
        cardInstanceId: 'war_machine_inst',
        abilityId: 'war_machine_action',
      });

      expect(res.result.success).toBe(true);
      expect(res.state.players[0].tableau[0].exhausted).toBe(true);
      expect(res.state.villain.health).toBe(initialVillainHealth - 1);
    });
  });

  describe('01018 Energy Channel (Variable Resource Cost, Overpayment & Blast Invariants)', () => {
    it('Test 1A: Rejects counter placement when hand lacks Energy or Wild resources', () => {
      const p1 = state.players[0];
      p1.currentForm = 'hero';
      p1.activeFormCard = captainMarvelHero;
      state.activePlayerIndex = 0;

      // Hand has only mental card (01004)
      p1.hand = [
        { instanceId: 'mental_card', card: cardCatalog.getCard('01004')!, exhausted: false },
      ];
      p1.tableau = [
        {
          instanceId: 'ec_inst',
          card: cardCatalog.getCard('01018')!,
          tokens: { counters: 0 },
          counters: { energy: 0 },
          exhausted: false,
        },
      ];

      const res = dispatchAction(state, {
        type: 'USE_CARD_ABILITY',
        playerId: p1.id,
        cardInstanceId: 'ec_inst',
        abilityId: 'energy_channel_add',
      });

      expect(res.result.success).toBe(false);
      expect(res.result.error).toMatch(/insufficient|resource/i);
      expect(res.state.players[0].hand.length).toBe(1);
      expect(res.state.players[0].tableau[0].tokens?.counters || 0).toBe(0);
    });

    it('Test 1B: Spend 1 Energy resource card to place 1 counter', () => {
      const p1 = state.players[0];
      p1.currentForm = 'hero';
      p1.activeFormCard = captainMarvelHero;
      state.activePlayerIndex = 0;

      // Hand has 1-energy card (01002 Black Cat)
      p1.hand = [
        { instanceId: 'energy_card', card: cardCatalog.getCard('01002')!, exhausted: false },
      ];
      p1.discard = [];
      p1.tableau = [
        {
          instanceId: 'ec_inst',
          card: cardCatalog.getCard('01018')!,
          tokens: { counters: 0 },
          counters: { energy: 0 },
          exhausted: false,
        },
      ];

      const res = dispatchAction(state, {
        type: 'USE_CARD_ABILITY',
        playerId: p1.id,
        cardInstanceId: 'ec_inst',
        abilityId: 'energy_channel_add',
      });

      expect(res.result.success).toBe(true);
      expect(res.state.players[0].hand.length).toBe(0);
      expect(res.state.players[0].discard.length).toBe(1);
      expect(res.state.players[0].tableau[0].counters?.energy).toBe(1);
    });

    it('Test 1C: Spend 1 Wild resource card to place 1 counter (Wild Substitution)', () => {
      const p1 = state.players[0];
      p1.currentForm = 'hero';
      p1.activeFormCard = captainMarvelHero;
      state.activePlayerIndex = 0;

      // Hand has 1-wild card (01011 Spider-Woman)
      p1.hand = [
        { instanceId: 'wild_card', card: cardCatalog.getCard('01011')!, exhausted: false },
      ];
      p1.discard = [];
      p1.tableau = [
        {
          instanceId: 'ec_inst',
          card: cardCatalog.getCard('01018')!,
          tokens: { counters: 0 },
          counters: { energy: 0 },
          exhausted: false,
        },
      ];

      const res = dispatchAction(state, {
        type: 'USE_CARD_ABILITY',
        playerId: p1.id,
        cardInstanceId: 'ec_inst',
        abilityId: 'energy_channel_add',
      });

      expect(res.result.success).toBe(true);
      expect(res.state.players[0].hand.length).toBe(0);
      expect(res.state.players[0].discard.length).toBe(1);
      expect(res.state.players[0].tableau[0].counters?.energy).toBe(1);
    });

    it('Test 1D: Spend 2 Energy resources (Energy 01088 yielding 2 energy) to place 2 counters', () => {
      const p1 = state.players[0];
      p1.currentForm = 'hero';
      p1.activeFormCard = captainMarvelHero;
      state.activePlayerIndex = 0;

      // Hand has Energy (01088, provides 2 energy)
      p1.hand = [
        { instanceId: 'double_energy', card: cardCatalog.getCard('01088')!, exhausted: false },
      ];
      p1.discard = [];
      p1.tableau = [
        {
          instanceId: 'ec_inst',
          card: cardCatalog.getCard('01018')!,
          tokens: { counters: 0 },
          counters: { energy: 0 },
          exhausted: false,
        },
      ];

      const res = dispatchAction(state, {
        type: 'USE_CARD_ABILITY',
        playerId: p1.id,
        cardInstanceId: 'ec_inst',
        abilityId: 'energy_channel_add',
        paymentCardInstanceIds: ['double_energy'],
      } as any);

      expect(res.result.success).toBe(true);
      expect(res.state.players[0].hand.length).toBe(0);
      expect(res.state.players[0].discard.length).toBe(1);
      expect(res.state.players[0].tableau[0].counters?.energy).toBe(2);
    });

    it('Test 1E: Allow placing counters beyond 5 (Overpayment Invariant)', () => {
      const p1 = state.players[0];
      p1.currentForm = 'hero';
      p1.activeFormCard = captainMarvelHero;
      state.activePlayerIndex = 0;

      p1.hand = [
        { instanceId: 'energy_card', card: cardCatalog.getCard('01002')!, exhausted: false },
      ];
      p1.discard = [];
      p1.tableau = [
        {
          instanceId: 'ec_inst',
          card: cardCatalog.getCard('01018')!,
          tokens: { counters: 5 },
          counters: { energy: 5 },
          exhausted: false,
        },
      ];

      const res = dispatchAction(state, {
        type: 'USE_CARD_ABILITY',
        playerId: p1.id,
        cardInstanceId: 'ec_inst',
        abilityId: 'energy_channel_add',
      });

      expect(res.result.success).toBe(true);
      expect(res.state.players[0].tableau[0].counters?.energy).toBe(6);
    });

    it('Test 2A: Rejects Blast when Energy Channel has 0 counters (RR v1.8 p. 3)', () => {
      const p1 = state.players[0];
      p1.currentForm = 'hero';
      p1.activeFormCard = captainMarvelHero;
      state.activePlayerIndex = 0;

      p1.tableau = [
        {
          instanceId: 'ec_inst',
          card: cardCatalog.getCard('01018')!,
          tokens: { counters: 0 },
          counters: { energy: 0 },
          exhausted: false,
        },
      ];

      const res = dispatchAction(state, {
        type: 'USE_CARD_ABILITY',
        playerId: p1.id,
        cardInstanceId: 'ec_inst',
        abilityId: 'energy_channel_blast',
        targetInstanceId: state.villain.instanceId,
      });

      expect(res.result.success).toBe(false);
      expect(res.result.error).toMatch(/0 counters/i);
      expect(res.state.players[0].tableau.length).toBe(1);
    });

    it('Test 2B: Executes Blast when Energy Channel has 3 counters (Deals 6 damage)', () => {
      const p1 = state.players[0];
      p1.currentForm = 'hero';
      p1.activeFormCard = captainMarvelHero;
      state.activePlayerIndex = 0;

      p1.tableau = [
        {
          instanceId: 'ec_inst',
          card: cardCatalog.getCard('01018')!,
          tokens: { counters: 3 },
          counters: { energy: 3 },
          exhausted: false,
        },
      ];

      const initialVillainHealth = state.villain.health;

      const res = dispatchAction(state, {
        type: 'USE_CARD_ABILITY',
        playerId: p1.id,
        cardInstanceId: 'ec_inst',
        abilityId: 'energy_channel_blast',
        targetInstanceId: state.villain.instanceId,
      });

      expect(res.result.success).toBe(true);
      expect(res.state.players[0].tableau.length).toBe(0);
      expect(res.state.players[0].discard.some((c) => c.instanceId === 'ec_inst')).toBe(true);
      expect(res.state.villain.health).toBe(initialVillainHealth - 6);
    });

    it('Test 2C: Executes Blast with 6 counters, clamping damage to exactly 10', () => {
      const p1 = state.players[0];
      p1.currentForm = 'hero';
      p1.activeFormCard = captainMarvelHero;
      state.activePlayerIndex = 0;

      p1.tableau = [
        {
          instanceId: 'ec_inst',
          card: cardCatalog.getCard('01018')!,
          tokens: { counters: 6 },
          counters: { energy: 6 },
          exhausted: false,
        },
      ];

      const initialVillainHealth = state.villain.health;

      const res = dispatchAction(state, {
        type: 'USE_CARD_ABILITY',
        playerId: p1.id,
        cardInstanceId: 'ec_inst',
        abilityId: 'energy_channel_blast',
        targetInstanceId: state.villain.instanceId,
      });

      expect(res.result.success).toBe(true);
      expect(res.state.players[0].tableau.length).toBe(0);
      expect(res.state.villain.health).toBe(initialVillainHealth - 10);
    });
  });
});
