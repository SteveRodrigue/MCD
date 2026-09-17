import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard, StatusCard } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { executeEffect } from '@engine/effects';

describe('Explosion (01111) Contract Tests — RR v1.8 & Issue #114', () => {
  let state: GameState;
  let spiderManHero: HeroCard;
  let peterParkerAlterEgo: AlterEgoCard;

  beforeEach(() => {
    spiderManHero = cardCatalog.getCard('01001a') as HeroCard;
    peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;

    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = spiderManHero;
  });

  it('when Bomb Scare is in play: deals damage equal to threat on Bomb Scare, does not surge', () => {
    const explosionCard = cardCatalog.getCard('01111')!;
    const explosionInst = createCardInstance(explosionCard);
    const ability = explosionCard.enrichment!.abilities![0];

    // Put Bomb Scare into play with 3 threat
    const bombScareCard = cardCatalog.getCard('01109')!;
    state.sideSchemes = [
      {
        instanceId: 'bomb-scare-inst',
        card: bombScareCard as any,
        threat: 3,
      },
    ];

    const initialHeroHp = state.players[0].health;
    const initialDealtCards = state.players[0].dealtEncounterCards.length;

    const result = executeEffect(state, ability, {
      playerId: 'p1',
      sourceCardInstance: explosionInst,
    });

    expect(result.success).toBe(true);
    // 3 threat on Bomb Scare dealt as damage to hero
    expect(state.players[0].health).toBe(initialHeroHp - 3);
    // Did NOT surge
    expect(state.players[0].dealtEncounterCards.length).toBe(initialDealtCards);
  });

  it('when Bomb Scare is NOT in play: gains surge and deals 0 damage', () => {
    const explosionCard = cardCatalog.getCard('01111')!;
    const explosionInst = createCardInstance(explosionCard);
    const ability = explosionCard.enrichment!.abilities![0];

    // Ensure no side schemes in play
    state.sideSchemes = [];

    const initialHeroHp = state.players[0].health;
    const initialDealtCards = state.players[0].dealtEncounterCards.length;

    const result = executeEffect(state, ability, {
      playerId: 'p1',
      sourceCardInstance: explosionInst,
    });

    expect(result.success).toBe(true);
    // No damage dealt
    expect(state.players[0].health).toBe(initialHeroHp);
    // Gained surge: dealt 1 additional encounter card
    expect(state.players[0].dealtEncounterCards.length).toBe(initialDealtCards + 1);
  });

  it('assigns damage to ally when targetInstanceId is specified', () => {
    const explosionCard = cardCatalog.getCard('01111')!;
    const explosionInst = createCardInstance(explosionCard);
    const ability = explosionCard.enrichment!.abilities![0];

    const bombScareCard = cardCatalog.getCard('01109')!;
    state.sideSchemes = [
      {
        instanceId: 'bomb-scare-inst',
        card: bombScareCard as any,
        threat: 2,
      },
    ];

    const allyCard = cardCatalog.getCard('01011')!; // Black Cat (hp 2)
    const allyInst = createCardInstance(allyCard);
    state.players[0].allies.push(allyInst);

    const initialHeroHp = state.players[0].health;

    const result = executeEffect(state, ability, {
      playerId: 'p1',
      sourceCardInstance: explosionInst,
      targetInstanceId: allyInst.instanceId,
    });

    expect(result.success).toBe(true);
    // Hero undamaged
    expect(state.players[0].health).toBe(initialHeroHp);
    // Ally took 2 damage and was defeated
    expect(state.players[0].allies).not.toContain(allyInst);
    expect(state.players[0].discard).toContain(allyInst);
  });

  describe('Multiplayer Hero & Ally Damage Assignments', () => {
    function createTwoPlayerState(): GameState {
      const p1Hero = cardCatalog.getCard('01001a') as HeroCard;
      const p1AlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;
      const p2Hero = cardCatalog.getCard('01029a') as HeroCard;
      const p2AlterEgo = cardCatalog.getCard('01029b') as AlterEgoCard;

      const state2 = setupGame({
        scenarioId: 'rhino',
        players: [
          {
            id: 'p1',
            name: 'Spider-Man',
            hero: p1Hero,
            alterEgo: p1AlterEgo,
            deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
          },
          {
            id: 'p2',
            name: 'Iron Man',
            hero: p2Hero,
            alterEgo: p2AlterEgo,
            deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
          },
        ],
        villain: cardCatalog.getCard('01094') as any,
        mainScheme: cardCatalog.getCard('01097b') as any,
        encounterCards: cardCatalog.getCardsBySet('rhino'),
        skipMulligan: true,
      });

      state2.players[0].currentForm = 'hero';
      state2.players[0].activeFormCard = p1Hero;
      state2.players[1].currentForm = 'hero';
      state2.players[1].activeFormCard = p2Hero;

      return state2;
    }

    it('Case 1: 2 heroes and no allies: each hero is damaged', () => {
      const state2 = createTwoPlayerState();
      const explosionCard = cardCatalog.getCard('01111')!;
      const explosionInst = createCardInstance(explosionCard);
      const ability = explosionCard.enrichment!.abilities![0];

      const bombScareCard = cardCatalog.getCard('01109')!;
      state2.sideSchemes = [
        {
          instanceId: 'bomb-scare-inst',
          card: bombScareCard as any,
          threat: 4,
        },
      ];

      const p1InitialHp = state2.players[0].health;
      const p2InitialHp = state2.players[1].health;

      const result = executeEffect(state2, ability, {
        playerId: 'p1',
        sourceCardInstance: explosionInst,
        assignments: {
          p1: 2,
          p2: 2,
        },
      });

      expect(result.success).toBe(true);
      expect(state2.players[0].health).toBe(p1InitialHp - 2);
      expect(state2.players[1].health).toBe(p2InitialHp - 2);
    });

    it('Case 2: 2 heroes: active hero has 1 ally, inactive hero has no ally: all 3 characters get damaged', () => {
      const state2 = createTwoPlayerState();
      const explosionCard = cardCatalog.getCard('01111')!;
      const explosionInst = createCardInstance(explosionCard);
      const ability = explosionCard.enrichment!.abilities![0];

      const bombScareCard = cardCatalog.getCard('01109')!;
      state2.sideSchemes = [
        {
          instanceId: 'bomb-scare-inst',
          card: bombScareCard as any,
          threat: 3,
        },
      ];

      const blackCatCard = cardCatalog.getCard('01011')!; // 2 HP
      const blackCatInst = createCardInstance(blackCatCard);
      state2.players[0].allies.push(blackCatInst);

      const p1InitialHp = state2.players[0].health;
      const p2InitialHp = state2.players[1].health;

      const result = executeEffect(state2, ability, {
        playerId: 'p1',
        sourceCardInstance: explosionInst,
        assignments: {
          p1: 1,
          [blackCatInst.instanceId]: 1,
          p2: 1,
        },
      });

      expect(result.success).toBe(true);
      expect(state2.players[0].health).toBe(p1InitialHp - 1);
      expect(blackCatInst.tokens?.damage).toBe(1);
      expect(state2.players[0].allies).toContain(blackCatInst);
      expect(state2.players[1].health).toBe(p2InitialHp - 1);
    });

    it('Case 3: 2 heroes: active hero has no ally, inactive hero has 2 allies: all 4 characters get damaged', () => {
      const state2 = createTwoPlayerState();
      const explosionCard = cardCatalog.getCard('01111')!;
      const explosionInst = createCardInstance(explosionCard);
      const ability = explosionCard.enrichment!.abilities![0];

      const bombScareCard = cardCatalog.getCard('01109')!;
      state2.sideSchemes = [
        {
          instanceId: 'bomb-scare-inst',
          card: bombScareCard as any,
          threat: 4,
        },
      ];

      const warMachineCard = cardCatalog.getCard('01030')!; // 4 HP
      const warMachineInst = createCardInstance(warMachineCard);
      const mariaHillCard = cardCatalog.getCard('01067')!; // 2 HP
      const mariaHillInst = createCardInstance(mariaHillCard);
      state2.players[1].allies.push(warMachineInst, mariaHillInst);

      const p1InitialHp = state2.players[0].health;
      const p2InitialHp = state2.players[1].health;

      const result = executeEffect(state2, ability, {
        playerId: 'p1',
        sourceCardInstance: explosionInst,
        assignments: {
          p1: 1,
          p2: 1,
          [warMachineInst.instanceId]: 1,
          [mariaHillInst.instanceId]: 1,
        },
      });

      expect(result.success).toBe(true);
      expect(state2.players[0].health).toBe(p1InitialHp - 1);
      expect(state2.players[1].health).toBe(p2InitialHp - 1);
      expect(warMachineInst.tokens?.damage).toBe(1);
      expect(mariaHillInst.tokens?.damage).toBe(1);
      expect(state2.players[1].allies).toContain(warMachineInst);
      expect(state2.players[1].allies).toContain(mariaHillInst);
    });

    it('Case 4: Multiplayer defeat & Tough card prevention on inactive hero ally', () => {
      const state2 = createTwoPlayerState();
      const explosionCard = cardCatalog.getCard('01111')!;
      const explosionInst = createCardInstance(explosionCard);
      const ability = explosionCard.enrichment!.abilities![0];

      const bombScareCard = cardCatalog.getCard('01109')!;
      state2.sideSchemes = [
        {
          instanceId: 'bomb-scare-inst',
          card: bombScareCard as any,
          threat: 6,
        },
      ];

      const mariaHillCard = cardCatalog.getCard('01067')!; // 2 HP
      const mariaHillInst = createCardInstance(mariaHillCard);
      mariaHillInst.statusCards = [StatusCard.TOUGH];

      const warMachineCard = cardCatalog.getCard('01030')!; // 4 HP
      const warMachineInst = createCardInstance(warMachineCard);

      state2.players[1].allies.push(mariaHillInst, warMachineInst);

      // Add a listener on P2 to verify CHARACTER_DEFEATED trigger dispatch
      state2.players[1].activeFormCard!.enrichment = {
        abilities: [
          {
            id: 'p2_character_defeat_listener',
            timing: 'FORCED_RESPONSE',
            trigger: 'CHARACTER_DEFEATED',
            steps: [{ effect: 'ADD_COUNTERS', effectParams: { target: 'IDENTITY', amount: 1 } }],
          },
        ],
      };

      const result = executeEffect(state2, ability, {
        playerId: 'p1',
        sourceCardInstance: explosionInst,
        assignments: {
          [mariaHillInst.instanceId]: 2,
          [warMachineInst.instanceId]: 4,
        },
      });

      expect(result.success).toBe(true);
      // Maria Hill: Tough card prevented all damage and was removed
      expect(mariaHillInst.statusCards).not.toContain(StatusCard.TOUGH);
      expect(mariaHillInst.tokens?.damage || 0).toBe(0);
      expect(state2.players[1].allies).toContain(mariaHillInst);

      // War Machine: lethal damage defeated him, moved to P2's discard, and fired CHARACTER_DEFEATED
      expect(state2.players[1].allies).not.toContain(warMachineInst);
      expect(state2.players[1].discard).toContain(warMachineInst);
      expect(state2.players[1].counters?.all_purpose).toBe(1);
    });

    it('assigns damage to inactive player ally via targetInstanceId', () => {
      const state2 = createTwoPlayerState();
      const explosionCard = cardCatalog.getCard('01111')!;
      const explosionInst = createCardInstance(explosionCard);
      const ability = explosionCard.enrichment!.abilities![0];

      const bombScareCard = cardCatalog.getCard('01109')!;
      state2.sideSchemes = [
        {
          instanceId: 'bomb-scare-inst',
          card: bombScareCard as any,
          threat: 2,
        },
      ];

      const mariaHillCard = cardCatalog.getCard('01067')!; // 2 HP
      const mariaHillInst = createCardInstance(mariaHillCard);
      state2.players[1].allies.push(mariaHillInst);

      const result = executeEffect(state2, ability, {
        playerId: 'p1',
        sourceCardInstance: explosionInst,
        targetInstanceId: mariaHillInst.instanceId,
      });

      expect(result.success).toBe(true);
      expect(state2.players[1].allies).not.toContain(mariaHillInst);
      expect(state2.players[1].discard).toContain(mariaHillInst);
    });
  });
});
