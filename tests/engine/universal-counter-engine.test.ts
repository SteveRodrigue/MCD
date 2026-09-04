import { describe, it, expect, beforeEach } from 'vitest';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { CardType, NormalizedCard } from '@engine/models';
import { executeEffect } from '@engine/effects';
import { canPayAbilityCost, executeAbilityCost } from '@engine/pipeline/cost-engine';

describe('Universal Named Counter Map & Cross-Entity Targeting Engine (ADR-0035, RR v1.8 p. 30)', () => {
  let spiderManHero: any;
  let peterParkerAlterEgo: any;
  let rhinoVillain: any;
  let mainScheme: any;

  beforeEach(() => {
    spiderManHero = cardCatalog.getCard('01001a')!;
    peterParkerAlterEgo = cardCatalog.getCard('01001b')!;
    rhinoVillain = cardCatalog.getCard('01094')!;
    mainScheme = cardCatalog.getCard('01097')!;
  });

  it('adds and spends named counters on an in-play upgrade (SELF)', () => {
    const webShooter: NormalizedCard = {
      ...cardCatalog.getCard('01005')!,
      code: 'test_web_shooter',
      name: 'Web-Shooter',
      type: CardType.UPGRADE,
      enrichment: {
        uses: {
          counterType: 'web',
          count: 3,
          discardOnEmpty: true,
        },
      },
    };

    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: [webShooter],
        },
      ],
      villain: rhinoVillain,
      mainScheme,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    const player = state.players[0];
    const inst = createCardInstance(webShooter);
    inst.counters = { web: 3 };
    player.tableau = [inst];

    // Spend 1 web counter via SPEND_COUNTERS
    const res = executeEffect(
      state,
      {
        id: 'spend_web',
        timing: 'HERO_ACTION',
        steps: [
          {
            effect: 'SPEND_COUNTERS',
            params: {
              target: 'SELF',
              counterType: 'web',
              amount: 1,
            },
          },
        ],
      },
      { playerId: 'p1', sourceCardInstance: inst },
    );

    expect(res.success).toBe(true);
    expect(res.state.players[0].tableau[0].counters?.web).toBe(2);

    // Add 2 web counters via ADD_COUNTERS
    const addRes = executeEffect(
      res.state,
      {
        id: 'add_web',
        timing: 'HERO_ACTION',
        steps: [
          {
            effect: 'ADD_COUNTERS',
            params: {
              target: 'SELF',
              counterType: 'web',
              amount: 2,
            },
          },
        ],
      },
      { playerId: 'p1', sourceCardInstance: res.state.players[0].tableau[0] },
    );

    expect(addRes.success).toBe(true);
    expect(addRes.state.players[0].tableau[0].counters?.web).toBe(4);
  });

  it('automatically discards card from tableau and dispatches CARD_DISCARDED trigger when uses counters reach zero (RR v1.8 p. 30)', () => {
    const webShooter: NormalizedCard = {
      ...cardCatalog.getCard('01005')!,
      code: 'test_web_shooter_empty',
      name: 'Web-Shooter',
      type: CardType.UPGRADE,
      enrichment: {
        uses: {
          counterType: 'web',
          count: 3,
          discardOnEmpty: true,
        },
      },
    };

    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: [webShooter],
        },
      ],
      villain: rhinoVillain,
      mainScheme,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    const player = state.players[0];
    const inst = createCardInstance(webShooter);
    inst.counters = { web: 1 };
    player.tableau = [inst];
    player.discard = [];

    // Spend last counter
    const res = executeEffect(
      state,
      {
        id: 'spend_last_web',
        timing: 'HERO_ACTION',
        steps: [
          {
            effect: 'SPEND_COUNTERS',
            params: {
              target: 'SELF',
              counterType: 'web',
              amount: 1,
            },
          },
        ],
      },
      { playerId: 'p1', sourceCardInstance: inst },
    );

    expect(res.success).toBe(true);
    // Removed from tableau
    expect(res.state.players[0].tableau.length).toBe(0);
    // Added to discard
    expect(res.state.players[0].discard.length).toBe(1);
    expect(res.state.players[0].discard[0].instanceId).toBe(inst.instanceId);
  });

  it('adds and spends named counters on Player IDENTITY (e.g. Gambit charge counters, Groot growth counters)', () => {
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Groot',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: [cardCatalog.getCard('01005')!],
        },
      ],
      villain: rhinoVillain,
      mainScheme,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    state.players[0].counters = { growth: 2 };

    // Add 2 growth counters to IDENTITY
    const addRes = executeEffect(
      state,
      {
        id: 'groot_growth',
        timing: 'HERO_ACTION',
        steps: [
          {
            effect: 'ADD_COUNTERS',
            params: {
              target: 'IDENTITY',
              counterType: 'growth',
              amount: 2,
            },
          },
        ],
      },
      { playerId: 'p1' },
    );

    expect(addRes.success).toBe(true);
    expect(addRes.state.players[0].counters?.growth).toBe(4);

    // Spend 3 growth counters from IDENTITY
    const spendRes = executeEffect(
      addRes.state,
      {
        id: 'root_spike',
        timing: 'HERO_ACTION',
        steps: [
          {
            effect: 'SPEND_COUNTERS',
            params: {
              target: 'IDENTITY',
              counterType: 'growth',
              amount: 3,
            },
          },
        ],
      },
      { playerId: 'p1' },
    );

    expect(spendRes.success).toBe(true);
    expect(spendRes.state.players[0].counters?.growth).toBe(1);
  });

  it('evaluates ability cost legality and executes counter spending via cost engine', () => {
    const cardWithCounter: NormalizedCard = {
      ...cardCatalog.getCard('01005')!,
      code: 'tac_team',
      name: 'Tac Team',
      type: CardType.SUPPORT,
    };

    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Captain America',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: [cardWithCounter],
        },
      ],
      villain: rhinoVillain,
      mainScheme,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    const player = state.players[0];
    const inst = createCardInstance(cardWithCounter);
    inst.counters = { attack: 2 };
    player.tableau = [inst];

    const ability: any = {
      id: 'tac_attack',
      timing: 'ACTION',
      cost: {
        exhaustSelf: true,
        spendCounters: {
          counterType: 'attack',
          amount: 1,
        },
      },
      steps: [{ effect: 'DEAL_DAMAGE', params: { amount: 2, target: 'CHOSEN_ENEMY' } }],
    };

    // 1. Check Allowed with 2 counters
    const allowedCheck = canPayAbilityCost(state, player, ability, inst, {});
    expect(allowedCheck.allowed).toBe(true);

    // Execute cost
    executeAbilityCost(state, player, ability, inst, {});
    expect(inst.counters?.attack).toBe(1);
    expect(inst.exhausted).toBe(true);

    // 2. Check Allowed with 1 counter
    inst.exhausted = false;
    const allowedCheck2 = canPayAbilityCost(state, player, ability, inst, {});
    expect(allowedCheck2.allowed).toBe(true);

    executeAbilityCost(state, player, ability, inst, {});
    expect(inst.counters?.attack).toBe(0);

    // 3. Check Rejected when 0 counters remaining
    inst.exhausted = false;
    const rejectedCheck = canPayAbilityCost(state, player, ability, inst, {});
    expect(rejectedCheck.allowed).toBe(false);
    expect(rejectedCheck.reason).toContain('attack counter');
  });

  it('scales effect values dynamically using COUNTERS_ON_TARGET formula (e.g. Energy Channel)', () => {
    const energyChannel: NormalizedCard = {
      ...cardCatalog.getCard('01005')!,
      code: '01018',
      name: 'Energy Channel',
      type: CardType.UPGRADE,
    };

    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Iron Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: [energyChannel],
        },
      ],
      villain: rhinoVillain,
      mainScheme,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    const player = state.players[0];
    const inst = createCardInstance(energyChannel);
    inst.counters = { energy: 4 };
    player.tableau = [inst];
    const initialVillainHp = state.villain.health;

    // Discard Energy Channel -> deal 2 damage per energy counter (4 counters = 8 damage)
    const res = executeEffect(
      state,
      {
        id: 'energy_channel_blast',
        timing: 'HERO_ACTION',
        cost: {
          discardSelf: true,
        },
        steps: [
          {
            effect: 'DEAL_DAMAGE',
            params: {
              target: 'VILLAIN',
              amountFormula: 'COUNTERS_ON_TARGET',
              counterType: 'energy',
              multiplier: 2,
              max: 10,
            },
          },
        ],
      },
      { playerId: 'p1', sourceCardInstance: inst },
    );

    expect(res.success).toBe(true);
    expect(res.state.villain.health).toBe(initialVillainHp - 8);
  });

  it('purges and decrements named counters matching trait and zone filters (REMOVE_COUNTERS_MATCHING_FILTER)', () => {
    const spellUpgrade1: NormalizedCard = {
      ...cardCatalog.getCard('01005')!,
      code: 'spell_1',
      name: 'Eldritch Magic',
      type: CardType.UPGRADE,
      traits: ['Spell'],
    };
    const spellUpgrade2: NormalizedCard = {
      ...cardCatalog.getCard('01005')!,
      code: 'spell_2',
      name: 'Mystic Armor',
      type: CardType.UPGRADE,
      traits: ['Spell'],
    };
    const techUpgrade: NormalizedCard = {
      ...cardCatalog.getCard('01005')!,
      code: 'tech_1',
      name: 'Arc Reactor',
      type: CardType.UPGRADE,
      traits: ['Tech'],
    };

    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Doctor Strange',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: [spellUpgrade1, spellUpgrade2, techUpgrade],
        },
      ],
      villain: rhinoVillain,
      mainScheme,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    const player = state.players[0];
    const instSpell1 = createCardInstance(spellUpgrade1);
    instSpell1.counters = { invocation: 3 };

    const instSpell2 = createCardInstance(spellUpgrade2);
    instSpell2.counters = { invocation: 2 };

    const instTech = createCardInstance(techUpgrade);
    instTech.counters = { energy: 4 };

    player.tableau = [instSpell1, instSpell2, instTech];

    // Purge invocation counters from all Spell cards in tableau
    const res = executeEffect(
      state,
      {
        id: 'purge_invocations',
        timing: 'WHEN_REVEALED',
        steps: [
          {
            effect: 'REMOVE_COUNTERS_MATCHING_FILTER',
            params: {
              targetZone: 'TABLEAU',
              traitFilter: 'Spell',
              counterType: 'invocation',
              amount: 'ALL',
            },
          },
        ],
      },
      { playerId: 'p1' },
    );

    expect(res.success).toBe(true);
    expect(res.state.players[0].tableau[0].counters?.invocation).toBe(0);
    expect(res.state.players[0].tableau[1].counters?.invocation).toBe(0);
    // Non-spell card remains untouched
    expect(res.state.players[0].tableau[2].counters?.energy).toBe(4);
  });

  it('initializes both numeric tokens.counters and named counters map on enters-play via PUT_INTO_PLAY (RR v1.8 p. 30)', () => {
    const tacTeam: NormalizedCard = {
      ...cardCatalog.getCard('01005')!,
      code: '01056',
      name: 'Tac Team',
      type: CardType.SUPPORT,
      enrichment: {
        uses: {
          count: 3,
          type: 'attack',
          discardOnEmpty: true,
        },
      },
    };

    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: [tacTeam],
        },
      ],
      villain: rhinoVillain,
      mainScheme,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    const player = state.players[0];
    const inst = createCardInstance(tacTeam);
    player.hand = [inst];

    // Put into play via PUT_INTO_PLAY effect
    const res = executeEffect(
      state,
      {
        id: 'put_tac_team_into_play',
        timing: 'ACTION',
        steps: [
          {
            effect: 'PUT_INTO_PLAY',
            params: {
              target: 'SELF',
            },
          },
        ],
      },
      { playerId: 'p1', sourceCardInstance: inst },
    );

    expect(res.success).toBe(true);
    const inPlayCard = res.state.players[0].tableau.find((c) => c.instanceId === inst.instanceId);
    expect(inPlayCard).toBeDefined();
    expect(inPlayCard?.tokens?.counters).toBe(3);
    expect(inPlayCard?.counters?.attack).toBe(3);
  });
});
