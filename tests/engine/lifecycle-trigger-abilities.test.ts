import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { AlterEgoCard, CardInstance, GameState, HeroCard, StatusCard } from '@engine/models';
import type { CardAbility } from '@engine/models';
import { setupGame, createCardInstance, resetInstanceCounter } from '@engine/state/game-setup';
import { startPlayerPhase, endPlayerPhase } from '@engine/pipeline/player-phase';
import { executeVillainPhase } from '@engine/pipeline/villain-phase';
import { dispatchTrigger } from '@engine/triggers/trigger-dispatcher';
import { executeEffect } from '@engine/effects';
import { getGeneratorProvidedResources } from '@engine/pipeline/cost-engine';

/**
 * #276: schema members that no test exercised. Each ability below is attached to a support in
 * the tableau and counts how many times the engine fires it, so the trigger and the timing are
 * proven by behaviour (RR v1.8 p. 22, "Player Phase", "Villain Phase", "Round").
 */
const counterAbility = (id: string, timing: string, trigger: string): CardAbility =>
  ({
    id,
    timing,
    trigger,
    steps: [
      {
        effect: 'ADD_COUNTERS',
        effectParams: { counterType: 'fired', amount: 1, target: 'SELF' },
      },
    ],
  }) as CardAbility;

describe('lifecycle triggers, hero/alter-ego timings and STATUS_REMOVED (#276)', () => {
  let state: GameState;
  let support: CardInstance;

  const withAbility = (ability: CardAbility): CardInstance => {
    const card = cardCatalog.getCard('01016')!;
    const instance = createCardInstance({ ...card, enrichment: { abilities: [ability] } } as never);
    state.players[0].tableau = [instance];
    return instance;
  };

  const fired = (instance: CardInstance): number => instance.counters?.fired ?? 0;

  beforeEach(() => {
    resetInstanceCounter();
    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Peter Parker',
          hero: cardCatalog.getCard('01001a') as HeroCard,
          alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
          deckCards: Array(15).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as never,
      mainScheme: cardCatalog.getCard('01097b') as never,
      encounterCards: Array(10).fill(cardCatalog.getCard('01108')!),
      shuffleFn: (arr) => arr,
      skipMulligan: true,
      skipScenarioPlugin: true,
    });
  });

  describe('phase and round triggers', () => {
    it('PLAYER_PHASE_BEGAN fires once per player when the Player Phase starts', () => {
      support = withAbility(counterAbility('began', 'FORCED_RESPONSE', 'PLAYER_PHASE_BEGAN'));
      startPlayerPhase(state);
      expect(fired(support)).toBe(1);
    });

    it('PLAYER_PHASE_ENDED fires when the Player Phase ends', () => {
      support = withAbility(counterAbility('ended', 'FORCED_RESPONSE', 'PLAYER_PHASE_ENDED'));
      endPlayerPhase(state);
      expect(fired(support)).toBe(1);
    });

    it('VILLAIN_PHASE_BEGAN and ROUND_BEGAN fire during the villain phase and the next round', () => {
      support = withAbility(counterAbility('villain', 'FORCED_RESPONSE', 'VILLAIN_PHASE_BEGAN'));
      const round = createCardInstance(cardCatalog.getCard('01016')!);
      round.card = {
        ...round.card,
        enrichment: {
          abilities: [counterAbility('round', 'FORCED_RESPONSE', 'ROUND_BEGAN')],
        },
      } as never;
      state.players[0].tableau.push(round);

      endPlayerPhase(state);
      const next = executeVillainPhase(state, { synchronousPolicy: 'TAKE_UNDEFENDED' });
      const find = (id: string) => next.players[0].tableau.find((c) => c.instanceId === id)!;

      expect(fired(find(support.instanceId))).toBe(1);
      expect(fired(find(round.instanceId))).toBe(1);
      expect(next.roundNumber).toBe(2);
    });
  });

  describe('hero and alter-ego response timings', () => {
    it('HERO_RESPONSE only resolves while the player is in hero form', () => {
      support = withAbility(counterAbility('hero', 'HERO_RESPONSE', 'PLAYER_PHASE_BEGAN'));
      state.players[0].currentForm = 'alter_ego';
      dispatchTrigger(state, 'PLAYER_PHASE_BEGAN', {
        targetPlayerId: 'p1',
        acceptOptionalTriggers: true,
      });
      expect(fired(support)).toBe(0);

      state.players[0].currentForm = 'hero';
      dispatchTrigger(state, 'PLAYER_PHASE_BEGAN', {
        targetPlayerId: 'p1',
        acceptOptionalTriggers: true,
      });
      expect(fired(support)).toBe(1);
    });

    it('ALTER_EGO_RESPONSE only resolves while the player is in alter-ego form', () => {
      support = withAbility(counterAbility('ego', 'ALTER_EGO_RESPONSE', 'PLAYER_PHASE_BEGAN'));
      state.players[0].currentForm = 'hero';
      dispatchTrigger(state, 'PLAYER_PHASE_BEGAN', {
        targetPlayerId: 'p1',
        acceptOptionalTriggers: true,
      });
      expect(fired(support)).toBe(0);

      state.players[0].currentForm = 'alter_ego';
      dispatchTrigger(state, 'PLAYER_PHASE_BEGAN', {
        targetPlayerId: 'p1',
        acceptOptionalTriggers: true,
      });
      expect(fired(support)).toBe(1);
    });

    it('ALTER_EGO_RESOURCE identity ability only generates a resource in alter-ego form', () => {
      const player = state.players[0];
      const alterEgo = player.alterEgo;
      alterEgo.enrichment = {
        abilities: [
          {
            id: 'ego_resource',
            timing: 'ALTER_EGO_RESOURCE',
            steps: [{ effect: 'GENERATE_RESOURCE', effectParams: { resource: 'wild', amount: 1 } }],
          },
        ],
      } as never;
      player.activeFormCard = alterEgo;

      player.currentForm = 'alter_ego';
      expect(getGeneratorProvidedResources(state, player, 'identity_ability')).toBe(1);

      player.currentForm = 'hero';
      expect(getGeneratorProvidedResources(state, player, 'identity_ability')).toBe(0);
    });
  });

  describe('STATUS_REMOVED', () => {
    it('fires when a status card is removed from a character', () => {
      support = withAbility(counterAbility('removed', 'FORCED_RESPONSE', 'STATUS_REMOVED'));
      const player = state.players[0];
      player.statusCards = [StatusCard.STUNNED];

      executeEffect(
        state,
        {
          effect: 'REMOVE_STATUS',
          effectParams: { status: 'STUNNED', target: 'SELF_IDENTITY' },
        } as never,
        { playerId: 'p1', targetPlayerId: 'p1', sourceCardInstance: support },
      );

      expect(player.statusCards).toHaveLength(0);
      expect(fired(support)).toBe(1);
    });
  });
});
