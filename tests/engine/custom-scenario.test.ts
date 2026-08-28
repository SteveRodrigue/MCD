import { describe, it, expect } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard } from '@engine/models';
import { setupGame } from '@engine/state/game-setup';
import { ScenarioPlugin, ScenarioDefinition, ScenarioRegistry } from '@engine/scenarios';

describe('Fan-Made Custom Scenario Extensibility (Universal Scenario Package Format)', () => {
  const customDefinition: ScenarioDefinition = {
    id: 'fan_made_hydra_base',
    name: 'Infiltration of Hydra Base',
    scenarioCardCode: 'fan_001',
    author: 'Community Member',
    version: '1.0.0',
    description: 'A fan-made scenario with multiple active villains.',
    supportedDifficulties: ['STANDARD'],
    villainSetup: {
      villainName: 'Hydra Commander',
      stages: {
        SKIRMISH: ['01094'],
        STANDARD: ['01094', '01095'],
        EXPERT: ['01095', '01096'],
      },
      healthPerPlayer: {
        '01094': 10,
        '01095': 12,
      },
    },
    mainSchemeSetup: {
      stages: ['01097a'],
      startingThreat: 1,
      targetThreatPerPlayer: 5,
      escalationThreatPerPlayer: 1,
    },
    modularEncounterSets: {
      mandatory: ['rhino'],
      defaults: {
        SKIRMISH: ['standard'],
        STANDARD: ['standard'],
        EXPERT: ['standard', 'expert'],
      },
    },
  };

  class FanMadeHydraScenarioPlugin implements ScenarioPlugin {
    definition = customDefinition;

    onGameSetup(state: GameState): GameState {
      state.scenarioId = this.definition.id;
      // Setup custom multi-villain state (2 villains in play!)
      state.villains = [
        {
          instanceId: 'hydra_commander_1',
          card: cardCatalog.getCard('01094') as any,
          health: 10,
          maxHealth: 10,
          exhausted: false,
          statusCards: [],
          attachments: [],
        },
        {
          instanceId: 'hydra_lieutenant_2',
          card: cardCatalog.getCard('01095') as any,
          health: 12,
          maxHealth: 12,
          exhausted: false,
          statusCards: [],
          attachments: [],
        },
      ];
      state.activeVillainIndex = 0;
      state.villain = state.villains[0];
      return state;
    }

    onVillainDefeated(state: GameState, defeatedVillainInstanceId: string) {
      // Custom logic: If commander 1 is defeated, shift active villain to lieutenant 2!
      if (defeatedVillainInstanceId === 'hydra_commander_1') {
        state.activeVillainIndex = 1;
        state.villain = state.villains[1];
        return { state, advancedStage: true };
      }

      // If lieutenant 2 is also defeated -> Victory!
      state.winner = 'HEROES';
      return { state, victory: true };
    }

    onMainSchemeCompleted(state: GameState) {
      state.winner = 'VILLAIN';
      return { state, defeat: true };
    }
  }

  it('Registers fan-made scenario and executes custom multi-villain turn loops and stage rotations', () => {
    const customPlugin = new FanMadeHydraScenarioPlugin();
    ScenarioRegistry.register(customPlugin);

    expect(ScenarioRegistry.has('fan_made_hydra_base')).toBe(true);

    const baseState = setupGame({
      scenarioId: 'fan_made_hydra_base',
      players: [
        {
          id: 'p1',
          name: 'Hero Player',
          hero: cardCatalog.getCard('01001a') as HeroCard,
          alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
          deckCards: [cardCatalog.getCard('01005')!],
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097a') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    const state = customPlugin.onGameSetup(baseState);

    // Verify 2 villains in play
    expect(state.villains.length).toBe(2);
    expect(state.activeVillainIndex).toBe(0);
    expect(state.villain.instanceId).toBe('hydra_commander_1');

    // Defeat villain 1 -> Shifts active villain to villain 2
    const { state: shiftedState } = customPlugin.onVillainDefeated(state, 'hydra_commander_1');
    expect(shiftedState.activeVillainIndex).toBe(1);
    expect(shiftedState.villain.instanceId).toBe('hydra_lieutenant_2');
    expect(shiftedState.winner).toBeNull();

    // Defeat villain 2 -> Victory!
    const { state: winState, victory } = customPlugin.onVillainDefeated(shiftedState, 'hydra_lieutenant_2');
    expect(victory).toBe(true);
    expect(winState.winner).toBe('HEROES');
  });
});
