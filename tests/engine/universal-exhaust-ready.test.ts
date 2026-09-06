import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard, VillainCard, MainSchemeCard } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { executeEffect } from '@engine/effects';

describe('Universal EXHAUST and READY Primitives (#65)', () => {
  let state: GameState;
  let spiderManHero: HeroCard;
  let peterParkerAlterEgo: AlterEgoCard;
  let rhinoVillain: VillainCard;
  let mainScheme: MainSchemeCard;

  beforeEach(() => {
    spiderManHero = cardCatalog.getCard('01001a') as HeroCard;
    peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;
    rhinoVillain = cardCatalog.getCard('01094') as VillainCard;
    mainScheme = cardCatalog.getCard('01097b') as MainSchemeCard;

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
      villain: rhinoVillain,
      mainScheme,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = spiderManHero;
    state.players[0].exhausted = false;
    state.villain.exhausted = false;
  });

  describe('EXHAUST Primitive', () => {
    it('exhausts player identity when targeting SELF_IDENTITY', () => {
      const player = state.players[0];
      expect(player.exhausted).toBe(false);

      const result = executeEffect(
        state,
        { effect: 'EXHAUST', params: { target: 'SELF_IDENTITY' } },
        { playerId: 'p1' },
      );

      expect(result.success).toBe(true);
      expect(player.exhausted).toBe(true);
      expect(result.onomatopoeia).toBe('EXHAUSTED!');
    });

    it('exhausts a chosen ally when targeting CHOSEN_ALLY', () => {
      const player = state.players[0];
      const ally = createCardInstance(cardCatalog.getCard('01002')!); // Black Cat
      ally.exhausted = false;
      player.allies.push(ally);

      const result = executeEffect(
        state,
        { effect: 'EXHAUST', params: { target: 'CHOSEN_ALLY' } },
        { playerId: 'p1', targetType: 'ally', targetInstanceId: ally.instanceId },
      );

      expect(result.success).toBe(true);
      expect(ally.exhausted).toBe(true);
    });

    it('exhausts all allies when targeting ALL_ALLIES', () => {
      const player = state.players[0];
      const ally1 = createCardInstance(cardCatalog.getCard('01002')!);
      const ally2 = createCardInstance(cardCatalog.getCard('01068')!);
      ally1.exhausted = false;
      ally2.exhausted = false;
      player.allies.push(ally1, ally2);

      const result = executeEffect(
        state,
        { effect: 'EXHAUST', params: { target: 'ALL_ALLIES' } },
        { playerId: 'p1' },
      );

      expect(result.success).toBe(true);
      expect(ally1.exhausted).toBe(true);
      expect(ally2.exhausted).toBe(true);
    });

    it('exhausts the villain when targeting VILLAIN', () => {
      expect(state.villain.exhausted).toBe(false);

      const result = executeEffect(
        state,
        { effect: 'EXHAUST', params: { target: 'VILLAIN' } },
        { playerId: 'p1' },
      );

      expect(result.success).toBe(true);
      expect(state.villain.exhausted).toBe(true);
    });

    it('exhausts all minions across play areas when targeting ALL_MINIONS', () => {
      const player = state.players[0];
      const minion = createCardInstance(cardCatalog.getCard('01108')!); // Armored Rhino Suit / Minion
      minion.exhausted = false;
      player.engagedMinions.push(minion);

      const result = executeEffect(
        state,
        { effect: 'EXHAUST', params: { target: 'ALL_MINIONS' } },
        { playerId: 'p1' },
      );

      expect(result.success).toBe(true);
      expect(minion.exhausted).toBe(true);
    });

    it('exhausts a host tableau card when targeting SELF', () => {
      const player = state.players[0];
      const upgrade = createCardInstance(cardCatalog.getCard('01008')!); // Web-Shooter
      upgrade.exhausted = false;
      player.tableau.push(upgrade);

      const result = executeEffect(
        state,
        { effect: 'EXHAUST', params: { target: 'SELF' } },
        { playerId: 'p1', sourceCardId: upgrade.instanceId },
      );

      expect(result.success).toBe(true);
      expect(upgrade.exhausted).toBe(true);
      expect(player.exhausted).toBe(false); // Player remains ready
    });
  });

  describe('READY Primitive', () => {
    it('readies player identity when targeting SELF_IDENTITY', () => {
      const player = state.players[0];
      player.exhausted = true;

      const result = executeEffect(
        state,
        { effect: 'READY', params: { target: 'SELF_IDENTITY' } },
        { playerId: 'p1' },
      );

      expect(result.success).toBe(true);
      expect(player.exhausted).toBe(false);
      expect(result.onomatopoeia).toBe('READY!');
    });

    it('readies a chosen ally when targeting CHOSEN_ALLY', () => {
      const player = state.players[0];
      const ally = createCardInstance(cardCatalog.getCard('01002')!);
      ally.exhausted = true;
      player.allies.push(ally);

      const result = executeEffect(
        state,
        { effect: 'READY', params: { target: 'CHOSEN_ALLY' } },
        { playerId: 'p1', targetType: 'ally', targetInstanceId: ally.instanceId },
      );

      expect(result.success).toBe(true);
      expect(ally.exhausted).toBe(false);
    });

    it('readies all allies when targeting ALL_ALLIES', () => {
      const player = state.players[0];
      const ally1 = createCardInstance(cardCatalog.getCard('01002')!);
      const ally2 = createCardInstance(cardCatalog.getCard('01068')!);
      ally1.exhausted = true;
      ally2.exhausted = true;
      player.allies.push(ally1, ally2);

      const result = executeEffect(
        state,
        { effect: 'READY', params: { target: 'ALL_ALLIES' } },
        { playerId: 'p1' },
      );

      expect(result.success).toBe(true);
      expect(ally1.exhausted).toBe(false);
      expect(ally2.exhausted).toBe(false);
    });

    it('readies all characters (identity and allies) when targeting ALL_CHARACTERS', () => {
      const player = state.players[0];
      player.exhausted = true;
      const ally = createCardInstance(cardCatalog.getCard('01002')!);
      ally.exhausted = true;
      player.allies.push(ally);

      const result = executeEffect(
        state,
        { effect: 'READY', params: { target: 'ALL_CHARACTERS' } },
        { playerId: 'p1' },
      );

      expect(result.success).toBe(true);
      expect(player.exhausted).toBe(false);
      expect(ally.exhausted).toBe(false);
    });

    it('readies a host tableau card when targeting SELF', () => {
      const player = state.players[0];
      player.exhausted = true;
      const upgrade = createCardInstance(cardCatalog.getCard('01008')!);
      upgrade.exhausted = true;
      player.tableau.push(upgrade);

      const result = executeEffect(
        state,
        { effect: 'READY', params: { target: 'SELF' } },
        { playerId: 'p1', sourceCardId: upgrade.instanceId },
      );

      expect(result.success).toBe(true);
      expect(upgrade.exhausted).toBe(false);
      expect(player.exhausted).toBe(true); // Player identity was untouched
    });

    it('readies identity when targeting SELF without tableau source card', () => {
      const player = state.players[0];
      player.exhausted = true;

      const result = executeEffect(
        state,
        { effect: 'READY', params: { target: 'SELF' } },
        { playerId: 'p1' },
      );

      expect(result.success).toBe(true);
      expect(player.exhausted).toBe(false);
    });
  });
});
