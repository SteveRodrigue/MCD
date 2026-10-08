import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import {
  AlterEgoCard,
  CardInstance,
  GameState,
  HeroCard,
  StatusCard,
  getActiveMainScheme,
} from '@engine/models';
import type { AbilityStep, CardAbility } from '@engine/models';
import { setupGame, createCardInstance, resetInstanceCounter } from '@engine/state/game-setup';
import { dispatchAction } from '@engine/pipeline/action-dispatcher';
import { startPlayerPhase } from '@engine/pipeline/player-phase';
import { evaluateStepGate } from '@engine/pipeline/step-gate-evaluator';
import { evaluatePlayRequirements } from '@engine/pipeline/legality-checker';
import { resolveTargets } from '@engine/effects/target-resolver';
import { executeEffect } from '@engine/effects';
import { registerSpecialHandler } from '@engine/specials/special-registry';

/**
 * #276, batch 3: ability gating (zone, once-per-phase limit), hero damage as a cost, special
 * handlers, counters, target selectors, gates and play requirements that no test exercised.
 */
describe('ability members (#276, batch 3)', () => {
  let state: GameState;

  const player = () => state.players[0];

  const supportWith = (ability: CardAbility, code = '01016'): CardInstance => {
    const card = cardCatalog.getCard(code)!;
    const instance = createCardInstance({ ...card, enrichment: { abilities: [ability] } } as never);
    player().tableau.push(instance);
    return instance;
  };

  const use = (instance: CardInstance, abilityId: string) => {
    const outcome = dispatchAction(state, {
      type: 'USE_CARD_ABILITY',
      playerId: 'p1',
      cardInstanceId: instance.instanceId,
      abilityId,
    });
    state = outcome.state;
    return outcome;
  };

  const counter = (instance: CardInstance) =>
    player().tableau.find((c) => c.instanceId === instance.instanceId)?.counters?.fired ?? 0;

  const fireStep: AbilityStep = {
    effect: 'ADD_COUNTERS',
    effectParams: { counterType: 'fired', amount: 1, target: 'SELF' },
  } as AbilityStep;

  beforeEach(() => {
    resetInstanceCounter();
    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
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
    player().currentForm = 'hero';
    player().activeFormCard = player().hero;
  });

  describe('ability zone and limit', () => {
    it('zone PLAY with ONCE_PER_PHASE allows a single use per phase, reset by the next phase', () => {
      const card = supportWith({
        id: 'once_phase',
        timing: 'HERO_ACTION',
        zone: 'PLAY',
        limit: 'ONCE_PER_PHASE',
        steps: [fireStep],
      } as CardAbility);

      expect(use(card, 'once_phase').result.success).toBe(true);
      expect(counter(card)).toBe(1);

      const second = use(card, 'once_phase');
      expect(second.result.success).toBe(false);
      expect(counter(card)).toBe(1);

      startPlayerPhase(state);
      expect(use(card, 'once_phase').result.success).toBe(true);
      expect(counter(card)).toBe(2);
    });
  });

  describe('cost.damageHero', () => {
    const ability = {
      id: 'pain',
      timing: 'HERO_ACTION',
      cost: { damageHero: 2 },
      steps: [fireStep],
    } as CardAbility;

    it('deals the damage to the hero as the cost of the ability', () => {
      const card = supportWith(ability);
      const before = player().health;
      expect(use(card, 'pain').result.success).toBe(true);
      expect(player().health).toBe(before - 2);
      expect(counter(card)).toBe(1);
    });

    it('cannot be paid when it would defeat the hero', () => {
      const card = supportWith(ability);
      player().health = 2;
      expect(use(card, 'pain').result.success).toBe(false);
      expect(player().health).toBe(2);
      expect(counter(card)).toBe(0);
    });
  });

  describe('effects', () => {
    it('EXECUTE_SPECIAL runs the registered special handler by id', () => {
      let executed = 0;
      registerSpecialHandler({
        id: 'TEST_SPECIAL_276',
        validatePlayCondition: () => true,
        execute: (s) => {
          executed += 1;
          return { state: s, success: true, mutatedState: false };
        },
      });
      const result = executeEffect(
        state,
        { effect: 'EXECUTE_SPECIAL', effectParams: { specialId: 'TEST_SPECIAL_276' } } as never,
        { playerId: 'p1' },
      );
      expect(result.success).toBe(true);
      expect(executed).toBe(1);
    });

    it('EXECUTE_SPECIAL fails with an error for an unknown special id', () => {
      const result = executeEffect(
        state,
        { effect: 'EXECUTE_SPECIAL', effectParams: { specialId: 'NO_SUCH_SPECIAL' } } as never,
        { playerId: 'p1' },
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('NO_SUCH_SPECIAL');
    });

    it('REMOVE_COUNTERS removes counters of a type from the source card, never below zero', () => {
      const card = supportWith({ id: 'x', timing: 'HERO_ACTION', steps: [] } as CardAbility);
      card.counters = { energy: 3 };
      const step = {
        effect: 'REMOVE_COUNTERS',
        effectParams: { counterType: 'energy', amount: 2, target: 'SELF' },
      } as never;

      executeEffect(state, step, { playerId: 'p1', sourceCardInstance: card });
      expect(card.counters?.energy).toBe(1);

      executeEffect(state, step, { playerId: 'p1', sourceCardInstance: card });
      expect(card.counters?.energy).toBe(0);
    });
  });

  describe('target selectors', () => {
    const ids = (selector: string, context: Record<string, unknown> = {}) =>
      resolveTargets(state, selector, { playerId: 'p1', ...context } as never).map((t) => t.id);

    it('TRIGGERING_HERO resolves to the hero only while in hero form', () => {
      expect(ids('TRIGGERING_HERO')).toEqual(['p1']);
      player().currentForm = 'alter_ego';
      expect(ids('TRIGGERING_HERO')).toEqual([]);
    });

    it('CHOSEN_CONTROLLED_CHARACTER resolves to the chosen identity or ally', () => {
      expect(ids('CHOSEN_CONTROLLED_CHARACTER', { chosenTargetInstanceId: 'p1' })).toEqual(['p1']);
    });

    it('TRIGGERING_SCHEME falls back to the active main scheme without an event target', () => {
      const main = getActiveMainScheme(state);
      expect(ids('TRIGGERING_SCHEME')).toEqual([main.instanceId || 'main_scheme']);
    });

    it('PREVIOUS_SELECTED_CARD resolves the card selected by the previous step', () => {
      const card = supportWith({ id: 'x', timing: 'HERO_ACTION', steps: [] } as CardAbility);
      expect(
        ids('PREVIOUS_SELECTED_CARD', { collectedCardInstanceIds: [card.instanceId] }),
      ).toEqual([card.instanceId]);
      expect(ids('PREVIOUS_SELECTED_CARD')).toEqual([]);
    });
  });

  describe('gates and conditions', () => {
    const step = {
      effect: 'DRAW',
      gate: 'IF_RESULT',
      gateParams: { fact: 'amountZero' },
    } as AbilityStep;
    const ctx = { playerId: 'p1' } as never;

    it('IF_RESULT with amountZero opens only when the previous step had amountZero', () => {
      const healedNothing = {
        success: true,
        mutatedState: false,
        value: 0,
        facts: { amountZero: true },
      };
      const healedTwo = {
        success: true,
        mutatedState: true,
        value: 2,
        facts: { amountZero: false },
      };
      expect(evaluateStepGate(step, healedNothing, state, ctx)).toBe(true);
      expect(evaluateStepGate(step, healedTwo, state, ctx)).toBe(false);
    });

    it('ADD_STATUS facts report statusAdded only when newly applied', () => {
      const addStun = {
        effect: 'ADD_STATUS',
        effectParams: { status: 'STUNNED', target: 'SELF_IDENTITY' },
      } as never;

      const first = executeEffect(state, addStun, { playerId: 'p1' });
      expect(first.facts?.statusAdded).toBe(true);
      expect(player().statusCards).toContain(StatusCard.STUNNED);

      const second = executeEffect(state, addStun, { playerId: 'p1' });
      expect(second.facts?.statusAdded).toBe(false);
    });
  });

  describe('play requirements', () => {
    const cardWith = (playRequirements: Record<string, unknown>) =>
      ({
        ...cardCatalog.getCard('01005')!,
        enrichment: { abilities: [], playRequirements },
      }) as never;

    it('formTrait requires the active form card to carry the trait', () => {
      const trait = (player().activeFormCard.traits || [])[0];
      expect(
        evaluatePlayRequirements(state, player(), cardWith({ formTrait: trait })).allowed,
      ).toBe(true);
      expect(
        evaluatePlayRequirements(state, player(), cardWith({ formTrait: 'NoSuchForm' })).allowed,
      ).toBe(false);
    });

    it('identityNames restricts the card to the listed hero or alter-ego names', () => {
      expect(
        evaluatePlayRequirements(state, player(), cardWith({ identityNames: ['Spider-Man'] }))
          .allowed,
      ).toBe(true);
      expect(
        evaluatePlayRequirements(state, player(), cardWith({ identityNames: ['Peter Parker'] }))
          .allowed,
      ).toBe(true);
      expect(
        evaluatePlayRequirements(state, player(), cardWith({ identityNames: ['Iron Man'] }))
          .allowed,
      ).toBe(false);
    });

    it('controlFilter searches only the controlZones (tableau, allies)', () => {
      const upgrade = supportWith({ id: 'x', timing: 'HERO_ACTION', steps: [] } as CardAbility);
      const filter = { codes: [upgrade.card.code] };

      const tableauOnly = cardWith({ controlFilter: filter, controlZones: ['tableau'] });
      expect(evaluatePlayRequirements(state, player(), tableauOnly).allowed).toBe(true);

      const alliesOnly = cardWith({ controlFilter: filter, controlZones: ['allies'] });
      expect(evaluatePlayRequirements(state, player(), alliesOnly).allowed).toBe(false);
    });
  });
});
