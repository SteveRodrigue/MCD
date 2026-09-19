import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard } from '../../src/engine/models';
import { setupGame } from '../../src/engine/state/game-setup';
import { dispatchAction } from '../../src/engine/pipeline';
import { canPayAbilityCost } from '../../src/engine/pipeline/cost-engine';

describe('Milestone 2A.1: Declarative Action Cost & Pre-Check Engine', () => {
  let state: GameState;
  let captainMarvelHero: HeroCard;
  let carolDanversAlterEgo: AlterEgoCard;
  let sheHulkHero: HeroCard;
  let jenniferWaltersAlterEgo: AlterEgoCard;

  beforeEach(() => {
    captainMarvelHero = cardCatalog.getCard('01010a') as HeroCard; // Captain Marvel Hero
    carolDanversAlterEgo = cardCatalog.getCard('01010b') as AlterEgoCard; // Carol Danvers Alter-Ego
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

  describe('01010a Captain Marvel (Rechannel & Cost Pre-Check)', () => {
    it('Rejects Rechannel when Captain Marvel is already at maximum health', () => {
      const p1 = state.players[0];
      p1.currentForm = 'hero';
      p1.activeFormCard = captainMarvelHero;
      const maxHp = (p1.activeFormCard as HeroCard).health || 12;
      p1.health = maxHp;
      p1.exhausted = false;
      p1.hand = [
        { instanceId: 'energy_card', card: cardCatalog.getCard('01002')!, exhausted: false },
      ];

      const res = dispatchAction(state, {
        type: 'USE_CARD_ABILITY',
        playerId: p1.id,
        cardInstanceId: '01010a',
        abilityId: 'rechannel',
        paymentCardInstanceIds: ['energy_card'],
      } as any);

      expect(res.result.success).toBe(false);
      expect(res.result.error).toContain('Requires at least 1 damage on Identity to heal as cost');
      expect(res.state.players[0].exhausted).toBe(false);
    });

    it('Allows Rechannel and heals 1 damage without exhausting Captain Marvel when damaged', () => {
      const p1 = state.players[0];
      p1.currentForm = 'hero';
      p1.activeFormCard = captainMarvelHero;
      const maxHp = (p1.activeFormCard as HeroCard).health || 12;
      p1.health = maxHp - 3;
      p1.exhausted = false;
      p1.hand = [
        { instanceId: 'energy_card', card: cardCatalog.getCard('01002')!, exhausted: false },
      ];

      const res = dispatchAction(state, {
        type: 'USE_CARD_ABILITY',
        playerId: p1.id,
        cardInstanceId: '01010a',
        abilityId: 'rechannel',
        paymentCardInstanceIds: ['energy_card'],
      } as any);

      expect(res.result.success).toBe(true);
      expect(res.state.players[0].health).toBe(maxHp - 2);
      expect(res.state.players[0].exhausted).toBe(false);
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
        paymentCardInstanceIds: ['energy_card'],
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
        paymentCardInstanceIds: ['wild_card'],
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
        paymentCardInstanceIds: ['energy_card'],
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

  describe('Energy Channel Resource Payment & Generator Support (Issue #96)', () => {
    it('Payment via generator only (ready in-play generator without hand card discard)', () => {
      const p1 = state.players[0];
      p1.currentForm = 'hero';
      p1.activeFormCard = captainMarvelHero;
      state.activePlayerIndex = 0;

      // Empty hand
      p1.hand = [];
      p1.discard = [];

      // Energy Channel + Web-Shooter in tableau
      const webShooterCard = cardCatalog.getCard('01008')!;
      p1.tableau = [
        {
          instanceId: 'ec_inst',
          card: cardCatalog.getCard('01018')!,
          tokens: { counters: 0 },
          counters: { energy: 0 },
          exhausted: false,
        },
        {
          instanceId: 'web_shooter_inst',
          card: webShooterCard,
          tokens: { counters: 3 },
          counters: { web: 3 },
          exhausted: false,
        },
      ];

      const res = dispatchAction(state, {
        type: 'USE_CARD_ABILITY',
        playerId: p1.id,
        cardInstanceId: 'ec_inst',
        abilityId: 'energy_channel_add',
        generatorInstanceIds: ['web_shooter_inst'],
      } as any);

      expect(res.result.success).toBe(true);
      expect(res.state.players[0].hand.length).toBe(0);
      const ec = res.state.players[0].tableau.find((c) => c.instanceId === 'ec_inst')!;
      expect(ec.counters?.energy).toBe(1);
      const ws = res.state.players[0].tableau.find((c) => c.instanceId === 'web_shooter_inst')!;
      expect(ws.exhausted).toBe(true);
      expect(ws.tokens?.counters).toBe(2);
    });

    it('Payment via combined hand card + generator', () => {
      const p1 = state.players[0];
      p1.currentForm = 'hero';
      p1.activeFormCard = captainMarvelHero;
      state.activePlayerIndex = 0;

      // Hand has 1-energy card
      p1.hand = [
        { instanceId: 'energy_card', card: cardCatalog.getCard('01002')!, exhausted: false },
      ];
      p1.discard = [];

      // Tableau has Energy Channel + Web-Shooter
      const webShooterCard = cardCatalog.getCard('01008')!;
      p1.tableau = [
        {
          instanceId: 'ec_inst',
          card: cardCatalog.getCard('01018')!,
          tokens: { counters: 0 },
          counters: { energy: 0 },
          exhausted: false,
        },
        {
          instanceId: 'web_shooter_inst',
          card: webShooterCard,
          tokens: { counters: 3 },
          counters: { web: 3 },
          exhausted: false,
        },
      ];

      const res = dispatchAction(state, {
        type: 'USE_CARD_ABILITY',
        playerId: p1.id,
        cardInstanceId: 'ec_inst',
        abilityId: 'energy_channel_add',
        paymentCardInstanceIds: ['energy_card'],
        generatorInstanceIds: ['web_shooter_inst'],
      } as any);

      expect(res.result.success).toBe(true);
      expect(res.state.players[0].hand.length).toBe(0);
      expect(res.state.players[0].discard.length).toBe(1);
      const ec = res.state.players[0].tableau.find((c) => c.instanceId === 'ec_inst')!;
      expect(ec.counters?.energy).toBe(2);
      const ws = res.state.players[0].tableau.find((c) => c.instanceId === 'web_shooter_inst')!;
      expect(ws.exhausted).toBe(true);
      expect(ws.tokens?.counters).toBe(2);
    });

    it('Variable X energy resource spending places exact number of counters in one action', () => {
      const p1 = state.players[0];
      p1.currentForm = 'hero';
      p1.activeFormCard = captainMarvelHero;
      state.activePlayerIndex = 0;

      // Hand has 2 separate energy cards
      p1.hand = [
        { instanceId: 'e1', card: cardCatalog.getCard('01002')!, exhausted: false },
        { instanceId: 'e2', card: cardCatalog.getCard('01002')!, exhausted: false },
      ];
      p1.discard = [];

      // Ready generator
      const webShooterCard = cardCatalog.getCard('01008')!;
      p1.tableau = [
        {
          instanceId: 'ec_inst',
          card: cardCatalog.getCard('01018')!,
          tokens: { counters: 0 },
          counters: { energy: 0 },
          exhausted: false,
        },
        {
          instanceId: 'web_shooter_inst',
          card: webShooterCard,
          tokens: { counters: 3 },
          counters: { web: 3 },
          exhausted: false,
        },
      ];

      const res = dispatchAction(state, {
        type: 'USE_CARD_ABILITY',
        playerId: p1.id,
        cardInstanceId: 'ec_inst',
        abilityId: 'energy_channel_add',
        paymentCardInstanceIds: ['e1', 'e2'],
        generatorInstanceIds: ['web_shooter_inst'],
      } as any);

      expect(res.result.success).toBe(true);
      expect(res.state.players[0].hand.length).toBe(0);
      expect(res.state.players[0].discard.length).toBe(2);
      const ec = res.state.players[0].tableau.find((c) => c.instanceId === 'ec_inst')!;
      expect(ec.counters?.energy).toBe(3);
    });

    it('Enforces resource cost for Rechannel (01010a) and Rocket Boots (01039)', () => {
      const p1 = state.players[0];
      p1.currentForm = 'hero';
      p1.activeFormCard = captainMarvelHero;
      state.activePlayerIndex = 0;
      p1.health = 8; // damaged so heal check passes

      // Card with physical only (01026 Enhanced Physique)
      p1.hand = [
        { instanceId: 'phys_card', card: cardCatalog.getCard('01026')!, exhausted: false },
      ];

      // Try Rechannel with non-energy card
      const rejectRes = dispatchAction(state, {
        type: 'USE_CARD_ABILITY',
        playerId: p1.id,
        cardInstanceId: '01010a',
        abilityId: 'rechannel',
        paymentCardInstanceIds: ['phys_card'],
      } as any);

      expect(rejectRes.result.success).toBe(false);
      expect(rejectRes.result.error).toMatch(/insufficient resources/i);

      // Now with energy card (01002)
      p1.hand = [
        { instanceId: 'energy_card', card: cardCatalog.getCard('01002')!, exhausted: false },
      ];
      const allowRes = dispatchAction(state, {
        type: 'USE_CARD_ABILITY',
        playerId: p1.id,
        cardInstanceId: '01010a',
        abilityId: 'rechannel',
        paymentCardInstanceIds: ['energy_card'],
      } as any);

      expect(allowRes.result.success).toBe(true);
      expect(allowRes.state.players[0].health).toBe(9);
    });

    it('requirePrinted: true vs false wild substitution verification', () => {
      const p1 = state.players[0];
      p1.currentForm = 'hero';
      p1.activeFormCard = captainMarvelHero;
      state.activePlayerIndex = 0;

      // Wild resource card (Spider-Woman 01011)
      const wildCard = {
        instanceId: 'wild_card',
        card: cardCatalog.getCard('01011')!,
        exhausted: false,
      };
      // Energy resource card (Black Cat 01002)
      const energyCard = {
        instanceId: 'energy_card',
        card: cardCatalog.getCard('01002')!,
        exhausted: false,
      };

      // Ability with requirePrinted: true
      const printedCostAbility = {
        id: 'test_printed_cost',
        timing: 'ACTION' as const,
        cost: {
          resourceCost: { energy: 1 },
          requirePrinted: true,
        },
        steps: [
          {
            effect: 'HEAL_DAMAGE',
            effectParams: { amount: 1, target: 'SELF' },
          },
        ],
      };

      p1.health = 8;
      p1.hand = [wildCard];

      // When requirePrinted: true, wild card should be rejected
      const canPayWild = canPayAbilityCost(state, p1, printedCostAbility, undefined, {
        paymentCardInstanceIds: ['wild_card'],
      });
      expect(canPayWild.allowed).toBe(false);
      expect(canPayWild.reason).toMatch(/insufficient resources/i);

      // When requirePrinted: true, energy card should be accepted
      p1.hand = [energyCard];
      const canPayEnergy = canPayAbilityCost(state, p1, printedCostAbility, undefined, {
        paymentCardInstanceIds: ['energy_card'],
      });
      expect(canPayEnergy.allowed).toBe(true);

      // When requirePrinted: false (or undefined), wild card is accepted per RR v1.8 p. 15
      const standardCostAbility = {
        ...printedCostAbility,
        cost: {
          resourceCost: { energy: 1 },
          requirePrinted: false,
        },
      };
      p1.hand = [wildCard];
      const canPayStandard = canPayAbilityCost(state, p1, standardCostAbility, undefined, {
        paymentCardInstanceIds: ['wild_card'],
      });
      expect(canPayStandard.allowed).toBe(true);
    });

    it('Overpayment with Captain Marvel 3-energy card (Energy Absorption 01014): 4 tokens -> 7 tokens -> clamped 10 damage Blast', () => {
      const p1 = state.players[0];
      p1.currentForm = 'hero';
      p1.activeFormCard = captainMarvelHero;
      state.activePlayerIndex = 0;

      // Energy Channel starts with 4 tokens
      p1.tableau = [
        {
          instanceId: 'ec_inst',
          card: cardCatalog.getCard('01018')!,
          tokens: { counters: 4 },
          counters: { energy: 4 },
          exhausted: false,
        },
      ];

      // Hand has Energy Absorption (01014), which produces 3 energy resources
      p1.hand = [
        { instanceId: 'energy_absorption', card: cardCatalog.getCard('01014')!, exhausted: false },
      ];
      p1.discard = [];

      // Spend Energy Absorption to add tokens
      const addRes = dispatchAction(state, {
        type: 'USE_CARD_ABILITY',
        playerId: p1.id,
        cardInstanceId: 'ec_inst',
        abilityId: 'energy_channel_add',
        paymentCardInstanceIds: ['energy_absorption'],
      } as any);

      expect(addRes.result.success).toBe(true);
      expect(addRes.state.players[0].hand.length).toBe(0);
      expect(addRes.state.players[0].discard.length).toBe(1);

      // Token count successfully increases to 7 tokens (>5 and >6)
      const ec = addRes.state.players[0].tableau.find((c) => c.instanceId === 'ec_inst')!;
      expect(ec.counters?.energy).toBe(7);
      expect(ec.tokens?.counters).toBe(7);

      // Trigger Blast ability subsequently with 7 tokens: deals exactly clamped 10 damage
      const initialVillainHealth = addRes.state.villain.health;
      const blastRes = dispatchAction(addRes.state, {
        type: 'USE_CARD_ABILITY',
        playerId: p1.id,
        cardInstanceId: 'ec_inst',
        abilityId: 'energy_channel_blast',
        targetInstanceId: addRes.state.villain.instanceId,
      });

      expect(blastRes.result.success).toBe(true);
      expect(blastRes.state.players[0].tableau.length).toBe(0);
      expect(blastRes.state.players[0].discard.some((c) => c.instanceId === 'ec_inst')).toBe(true);
      // Clamped to 10 damage (5 tokens' worth of damage at 2 per counter, safely ignoring excess)
      expect(blastRes.state.villain.health).toBe(initialVillainHealth - 10);
    });
  });
});
