import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { HeroCard, AlterEgoCard, StatusCard } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { executeEffect } from '@engine/effects';
import {
  resolveTargets,
  resolveCharacterTargets,
  resolveSchemeTargets,
  resolvePlayerTargets,
  resolveCardTargets,
  resolveEntityByInstanceId,
} from '@engine/effects/target-resolver';

describe('Target Resolution Engine Contract Tests (Issue #68 & RR v1.8)', () => {
  let spiderManHero: HeroCard;
  let peterParkerAlterEgo: AlterEgoCard;
  let ironManHero: HeroCard;
  let tonyStarkAlterEgo: AlterEgoCard;

  beforeEach(() => {
    spiderManHero = cardCatalog.getCard('01001a') as HeroCard;
    peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;
    ironManHero = cardCatalog.getCard('01029a') as HeroCard;
    tonyStarkAlterEgo = cardCatalog.getCard('01029b') as AlterEgoCard;
  });

  const createTwoPlayerState = () => {
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
        {
          id: 'p2',
          name: 'Iron Man',
          hero: ironManHero,
          alterEgo: tonyStarkAlterEgo,
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
    state.players[1].currentForm = 'alter_ego';
    state.players[1].activeFormCard = tonyStarkAlterEgo;
    return state;
  };

  describe('Scenario 1: Identity & Player Selectors', () => {
    it('resolves SELF to host card instance and resolveCardTargets', () => {
      const state = createTwoPlayerState();
      const webShooter = createCardInstance(cardCatalog.getCard('01008')!);
      state.players[0].tableau.push(webShooter);

      const targets = resolveTargets(state, 'SELF', {
        playerId: 'p1',
        sourceCardInstance: webShooter,
      });

      expect(targets).toHaveLength(1);
      expect(targets[0].kind).toBe('card');
      expect(targets[0].id).toBe(webShooter.instanceId);
      expect(targets[0].entity).toBe(webShooter);

      const cardTargets = resolveCardTargets(state, 'SELF', {
        playerId: 'p1',
        sourceCardInstance: webShooter,
      });
      expect(cardTargets).toHaveLength(1);
      expect(cardTargets[0].instanceId).toBe(webShooter.instanceId);
    });

    it('resolves SELF_IDENTITY to active player identity', () => {
      const state = createTwoPlayerState();
      const targets = resolveTargets(state, 'SELF_IDENTITY', { playerId: 'p1' });

      expect(targets).toHaveLength(1);
      expect(targets[0].id).toBe('p1');
      const playerTargets = resolvePlayerTargets(state, 'SELF_IDENTITY', { playerId: 'p1' });
      expect(playerTargets).toHaveLength(1);
      expect(playerTargets[0].id).toBe('p1');
    });

    it('resolves ACTIVE_PLAYER to current active turn player', () => {
      const state = createTwoPlayerState();
      state.activePlayerIndex = 1;

      const targets = resolvePlayerTargets(state, 'ACTIVE_PLAYER');
      expect(targets).toHaveLength(1);
      expect(targets[0].id).toBe('p2');
    });

    it('resolves CHOSEN_PLAYER to targetPlayerId', () => {
      const state = createTwoPlayerState();
      const targets = resolvePlayerTargets(state, 'CHOSEN_PLAYER', {
        playerId: 'p1',
        targetPlayerId: 'p2',
      });
      expect(targets).toHaveLength(1);
      expect(targets[0].id).toBe('p2');
    });

    it('resolves ALL_PLAYERS to all table players regardless of form', () => {
      const state = createTwoPlayerState();
      const targets = resolvePlayerTargets(state, 'ALL_PLAYERS');
      expect(targets).toHaveLength(2);
      expect(targets.map((p) => p.id)).toEqual(['p1', 'p2']);
    });
  });

  describe('Scenario 2: Controlled vs Friendly Characters', () => {
    it('resolves CHOSEN_CONTROLLED_ALLY and ALL_CONTROLLED_ALLIES strictly to resolving player allies', () => {
      const state = createTwoPlayerState();
      const blackCat = createCardInstance(cardCatalog.getCard('01011')!);
      const warMachine = createCardInstance(cardCatalog.getCard('01030')!);
      state.players[0].allies.push(blackCat);
      state.players[1].allies.push(warMachine);

      // CHOSEN_CONTROLLED_ALLY for p1
      const chosen = resolveCharacterTargets(state, 'CHOSEN_CONTROLLED_ALLY', {
        playerId: 'p1',
        targetInstanceId: blackCat.instanceId,
      });
      expect(chosen).toHaveLength(1);
      expect(chosen[0].id).toBe(blackCat.instanceId);

      // Attempting to choose p2's ally as p1's controlled ally falls back or rejects
      const allControlled = resolveCharacterTargets(state, 'ALL_CONTROLLED_ALLIES', {
        playerId: 'p1',
      });
      expect(allControlled).toHaveLength(1);
      expect(allControlled[0].id).toBe(blackCat.instanceId);
    });

    it('resolves CHOSEN_CONTROLLED_CHARACTER and ALL_CONTROLLED_CHARACTERS', () => {
      const state = createTwoPlayerState();
      const blackCat = createCardInstance(cardCatalog.getCard('01011')!);
      state.players[0].allies.push(blackCat);

      const allControlled = resolveCharacterTargets(state, 'ALL_CONTROLLED_CHARACTERS', {
        playerId: 'p1',
      });
      expect(allControlled).toHaveLength(2);
      expect(allControlled.map((c) => c.id)).toContain('p1');
      expect(allControlled.map((c) => c.id)).toContain(blackCat.instanceId);
    });

    it('resolves CHOSEN_FRIENDLY_CHARACTER and ALL_FRIENDLY_CHARACTERS across table', () => {
      const state = createTwoPlayerState();
      const blackCat = createCardInstance(cardCatalog.getCard('01011')!);
      const warMachine = createCardInstance(cardCatalog.getCard('01030')!);
      state.players[0].allies.push(blackCat);
      state.players[1].allies.push(warMachine);

      const chosen = resolveCharacterTargets(state, 'CHOSEN_FRIENDLY_CHARACTER', {
        playerId: 'p1',
        targetInstanceId: warMachine.instanceId,
      });
      expect(chosen).toHaveLength(1);
      expect(chosen[0].id).toBe(warMachine.instanceId);

      const allFriendly = resolveCharacterTargets(state, 'ALL_FRIENDLY_CHARACTERS');
      // 2 players + 2 allies = 4 friendly characters
      expect(allFriendly).toHaveLength(4);
      expect(allFriendly.map((c) => c.id)).toEqual(
        expect.arrayContaining(['p1', 'p2', blackCat.instanceId, warMachine.instanceId]),
      );
    });
  });

  describe('Scenario 3: Form-Restricted Scopes (RR v1.8 & ADR-0064)', () => {
    it('ALL_HEROES excludes Alter-Ego players', () => {
      const state = createTwoPlayerState(); // P1 Hero, P2 Alter-Ego
      const targets = resolveCharacterTargets(state, 'ALL_HEROES');
      expect(targets).toHaveLength(1);
      expect(targets[0].id).toBe('p1');
      expect(targets[0].entityType).toBe('hero');
    });

    it('ALL_HEROES_AND_ALLIES includes heroes and all allies, excluding Alter-Egos', () => {
      const state = createTwoPlayerState(); // P1 Hero, P2 Alter-Ego
      const blackCat = createCardInstance(cardCatalog.getCard('01011')!);
      const warMachine = createCardInstance(cardCatalog.getCard('01030')!);
      state.players[0].allies.push(blackCat);
      state.players[1].allies.push(warMachine);

      const targets = resolveCharacterTargets(state, 'ALL_HEROES_AND_ALLIES');
      expect(targets).toHaveLength(3);
      expect(targets.map((c) => c.id)).toEqual(
        expect.arrayContaining(['p1', blackCat.instanceId, warMachine.instanceId]),
      );
      expect(targets.map((c) => c.id)).not.toContain('p2');
    });
  });

  describe('Scenario 4: Enemy & Minion Scopes', () => {
    it('resolves VILLAIN to state.villain', () => {
      const state = createTwoPlayerState();
      const targets = resolveCharacterTargets(state, 'VILLAIN');
      expect(targets).toHaveLength(1);
      expect(targets[0].entityType).toBe('villain');
      expect(targets[0].id).toBe(state.villain.instanceId || 'villain');
    });

    it('resolves CHOSEN_ENEMY to villain or targeted minion', () => {
      const state = createTwoPlayerState();
      const shockerMinion = createCardInstance(cardCatalog.getCard('01103')!);
      state.players[0].engagedMinions.push(shockerMinion);

      // Targeting villain
      const villainTarget = resolveCharacterTargets(state, 'CHOSEN_ENEMY', {
        targetType: 'villain',
      });
      expect(villainTarget).toHaveLength(1);
      expect(villainTarget[0].entityType).toBe('villain');

      // Targeting minion
      const minionTarget = resolveCharacterTargets(state, 'CHOSEN_ENEMY', {
        targetInstanceId: shockerMinion.instanceId,
      });
      expect(minionTarget).toHaveLength(1);
      expect(minionTarget[0].id).toBe(shockerMinion.instanceId);
      expect(minionTarget[0].entityType).toBe('minion');
    });

    it('resolves ALL_ENEMIES and ENGAGED_ENEMIES', () => {
      const state = createTwoPlayerState();
      const shocker1 = createCardInstance(cardCatalog.getCard('01103')!);
      const shocker2 = createCardInstance(cardCatalog.getCard('01103')!);
      state.players[0].engagedMinions.push(shocker1);
      state.players[1].engagedMinions.push(shocker2);

      const allEnemies = resolveCharacterTargets(state, 'ALL_ENEMIES');
      expect(allEnemies).toHaveLength(3); // Villain + 2 minions

      const engagedEnemies = resolveCharacterTargets(state, 'ENGAGED_ENEMIES', { playerId: 'p1' });
      expect(engagedEnemies).toHaveLength(2); // Villain + P1's engaged minion
      expect(engagedEnemies.map((e) => e.id)).toContain(shocker1.instanceId);
      expect(engagedEnemies.map((e) => e.id)).not.toContain(shocker2.instanceId);
    });

    it('resolves CHOSEN_MINION, ALL_MINIONS, and ENGAGED_MINIONS', () => {
      const state = createTwoPlayerState();
      const shocker1 = createCardInstance(cardCatalog.getCard('01103')!);
      const shocker2 = createCardInstance(cardCatalog.getCard('01103')!);
      state.players[0].engagedMinions.push(shocker1);
      state.players[1].engagedMinions.push(shocker2);

      const allMinions = resolveCharacterTargets(state, 'ALL_MINIONS');
      expect(allMinions).toHaveLength(2);

      const engagedMinions = resolveCharacterTargets(state, 'ENGAGED_MINIONS', { playerId: 'p1' });
      expect(engagedMinions).toHaveLength(1);
      expect(engagedMinions[0].id).toBe(shocker1.instanceId);

      const chosenMinion = resolveCharacterTargets(state, 'CHOSEN_MINION', {
        targetInstanceId: shocker2.instanceId,
      });
      expect(chosenMinion).toHaveLength(1);
      expect(chosenMinion[0].id).toBe(shocker2.instanceId);
    });
  });

  describe('Scenario 5: Universal Characters (Friend & Foe)', () => {
    it('resolves CHOSEN_CHARACTER to any valid character', () => {
      const state = createTwoPlayerState();
      const blackCat = createCardInstance(cardCatalog.getCard('01011')!);
      state.players[0].allies.push(blackCat);

      const charTarget = resolveCharacterTargets(state, 'CHOSEN_CHARACTER', {
        targetInstanceId: blackCat.instanceId,
      });
      expect(charTarget).toHaveLength(1);
      expect(charTarget[0].id).toBe(blackCat.instanceId);
    });

    it('resolves ALL_CHARACTERS across all seats, allies, villain, and minions', () => {
      const state = createTwoPlayerState();
      const blackCat = createCardInstance(cardCatalog.getCard('01011')!);
      const shocker = createCardInstance(cardCatalog.getCard('01103')!);
      state.players[0].allies.push(blackCat);
      state.players[0].engagedMinions.push(shocker);

      const allChars = resolveCharacterTargets(state, 'ALL_CHARACTERS');
      // Villain + P1 + P2 + Black Cat + Shocker = 5 characters
      expect(allChars).toHaveLength(5);
      expect(allChars.map((c) => c.id)).toEqual(
        expect.arrayContaining([
          state.villain.instanceId || 'villain',
          'p1',
          'p2',
          blackCat.instanceId,
          shocker.instanceId,
        ]),
      );
    });
  });

  describe('Scenario 6: Scheme Scopes', () => {
    it('resolves MAIN_SCHEME, CHOSEN_SIDE_SCHEME, ALL_SIDE_SCHEMES, ALL_SCHEMES', () => {
      const state = createTwoPlayerState();
      const bombScare = {
        instanceId: 'bomb-scare-1',
        card: cardCatalog.getCard('01109') as any,
        threat: 3,
      };
      state.sideSchemes = [bombScare];

      const main = resolveSchemeTargets(state, 'MAIN_SCHEME');
      expect(main).toHaveLength(1);
      expect(main[0].entityType).toBe('main_scheme');

      const side = resolveSchemeTargets(state, 'CHOSEN_SIDE_SCHEME', {
        targetInstanceId: 'bomb-scare-1',
      });
      expect(side).toHaveLength(1);
      expect(side[0].id).toBe('bomb-scare-1');

      const allSides = resolveSchemeTargets(state, 'ALL_SIDE_SCHEMES');
      expect(allSides).toHaveLength(1);
      expect(allSides[0].id).toBe('bomb-scare-1');

      const allSchemes = resolveSchemeTargets(state, 'ALL_SCHEMES');
      expect(allSchemes).toHaveLength(2); // Main + 1 side scheme
    });
  });

  describe('Scenario 7: Context Continuity & Primitives Integration', () => {
    it('resolves PREVIOUS_TARGET from context targetInstanceId or previousResult', () => {
      const state = createTwoPlayerState();
      const shocker = createCardInstance(cardCatalog.getCard('01103')!);
      state.players[0].engagedMinions.push(shocker);

      const targets = resolveTargets(state, 'PREVIOUS_TARGET', {
        playerId: 'p1',
        targetInstanceId: shocker.instanceId,
      });
      expect(targets).toHaveLength(1);
      expect(targets[0].id).toBe(shocker.instanceId);
    });

    it('integrates with ADD_STATUS and REMOVE_STATUS uniformly', () => {
      const state = createTwoPlayerState();
      const shocker = createCardInstance(cardCatalog.getCard('01103')!);
      state.players[0].engagedMinions.push(shocker);

      // ADD_STATUS to minion via canonical CHOSEN_MINION
      const addStep = {
        effect: 'ADD_STATUS',
        effectParams: { status: 'STUNNED', target: 'CHOSEN_MINION' },
      };
      const addRes = executeEffect(state, { steps: [addStep] } as any, {
        playerId: 'p1',
        targetInstanceId: shocker.instanceId,
      });
      expect(addRes.success).toBe(true);
      expect(shocker.statusCards).toContain(StatusCard.STUNNED);

      // REMOVE_STATUS from minion via canonical CHOSEN_ENEMY
      const removeStep = {
        effect: 'REMOVE_STATUS',
        effectParams: { status: 'STUNNED', target: 'CHOSEN_ENEMY' },
      };
      const removeRes = executeEffect(state, { steps: [removeStep] } as any, {
        playerId: 'p1',
        targetInstanceId: shocker.instanceId,
      });
      expect(removeRes.success).toBe(true);
      expect(shocker.statusCards).not.toContain(StatusCard.STUNNED);
    });
  });

  describe('Scenario 8: Orphan & Liveness Contract Tests', () => {
    it('does not resolve defeated minions or discarded allies', () => {
      const state = createTwoPlayerState();
      const shocker = createCardInstance(cardCatalog.getCard('01103')!);
      // Move minion to encounter discard (defeated)
      state.encounterDiscard.push(shocker);

      const target = resolveEntityByInstanceId(state, shocker.instanceId);
      expect(target).toBeUndefined();

      const targets = resolveTargets(state, 'CHOSEN_MINION', {
        targetInstanceId: shocker.instanceId,
      });
      // Should not find the discarded minion
      expect(targets.find((t) => t.id === shocker.instanceId)).toBeUndefined();
    });

    it('does not resolve cleared side schemes in discard', () => {
      const state = createTwoPlayerState();
      const bombScareCard = cardCatalog.getCard('01109')!;
      const bombScareInst = createCardInstance(bombScareCard);
      state.encounterDiscard.push(bombScareInst);

      const target = resolveEntityByInstanceId(state, bombScareInst.instanceId);
      expect(target).toBeUndefined();
    });
  });
});
