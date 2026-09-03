import { describe, it, expect } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import {
  GameState,
  GamePhase,
  MainSchemeCard,
  getActiveVillain,
  getActiveMainScheme,
  getVillainById,
  getMainSchemeById,
} from '@engine/models';
import { ScenarioRegistry } from '@engine/scenarios';

describe('Scenario Plugin Registry & Multi-Entity Accessors', () => {
  it('ScenarioRegistry registers and resolves built-in Rhino plugin', () => {
    expect(ScenarioRegistry.has('rhino')).toBe(true);
    expect(ScenarioRegistry.has('01094')).toBe(true);

    const plugin = ScenarioRegistry.get('rhino');
    expect(plugin).toBeDefined();
    expect(plugin.definition.name).toBe('Rhino');
  });

  it('Multi-Entity Accessors resolve correctly for active and specific entities', () => {
    const mockState: Partial<GameState> = {
      activeVillainIndex: 1,
      activeMainSchemeIndex: 0,
      villains: [
        {
          instanceId: 'v1',
          card: cardCatalog.getCard('01094') as any,
          health: 14,
          maxHealth: 14,
          exhausted: false,
          statusCards: [],
          attachments: [],
        },
        {
          instanceId: 'v2',
          card: cardCatalog.getCard('01095') as any,
          health: 15,
          maxHealth: 15,
          exhausted: false,
          statusCards: [],
          attachments: [],
        },
      ],
      mainSchemes: [
        {
          instanceId: 'ms1',
          card: cardCatalog.getCard('01097a') as any,
          threat: 0,
          targetThreat: 7,
          stage: '1B',
        },
      ],
    };

    const activeVillain = getActiveVillain(mockState as GameState);
    expect(activeVillain.instanceId).toBe('v2');
    expect(activeVillain.card.code).toBe('01095');

    const activeScheme = getActiveMainScheme(mockState as GameState);
    expect(activeScheme.instanceId).toBe('ms1');

    const foundV1 = getVillainById(mockState as GameState, '01094');
    expect(foundV1?.instanceId).toBe('v1');

    const foundScheme = getMainSchemeById(mockState as GameState, '01097a');
    expect(foundScheme?.instanceId).toBe('ms1');
  });

  it('initializes Main Scheme to Stage 1B with canonical card via plugin setup', () => {
    const createBaseState = (): GameState => ({
      id: 'test_game',
      roundNumber: 1,
      firstPlayerIndex: 0,
      activePlayerIndex: 0,
      phase: GamePhase.PLAYER_PHASE,
      scenarioId: 'rhino',
      scenarioCardCode: '01094',
      players: [
        {
          id: 'p1',
          name: 'Player 1',
          hero: cardCatalog.getCard('01001a') as any,
          alterEgo: cardCatalog.getCard('01001b') as any,
          availableForms: [],
          activeFormCard: cardCatalog.getCard('01001a') as any,
          currentForm: 'hero',
          health: 10,
          maxHealth: 10,
          hand: [],
          deck: [],
          discard: [],
          tableau: [],
          allies: [],
          engagedMinions: [],
          dealtEncounterCards: [],
          setAsideCards: [],
          basicChangeFormUsedThisRound: false,
          formChangedThisRound: false,
          recoveryUsedThisRound: false,
          exhausted: false,
          statusCards: [],
        },
      ],
      villains: [],
      villain: {} as any,
      activeVillainIndex: 0,
      mainSchemes: [],
      mainScheme: {} as any,
      activeMainSchemeIndex: 0,
      sideSchemes: [],
      encounterDeck: [],
      encounterDiscard: [],
      environments: [],
      victoryDisplay: [],
      auxiliaryDecks: {},
      auxiliaryDiscards: {},
      removedFromGame: [],
      accelerationTokens: 0,
      winner: null,
      log: [],
      difficulty: 'STANDARD',
      heroicLevel: 0,
    });

    const rhinoPlugin = ScenarioRegistry.get('rhino');
    const rhinoSetupState = rhinoPlugin.onGameSetup(createBaseState(), {
      scenarioId: 'rhino',
      difficulty: 'STANDARD',
    });
    expect(rhinoSetupState.mainScheme.stage).toBe('1B');
    expect(rhinoSetupState.mainScheme.card.code).toBe('01097b');
    expect((rhinoSetupState.mainScheme.card as MainSchemeCard).stage).toBe('1B');

    const klawPlugin = ScenarioRegistry.get('klaw');
    const klawSetupState = klawPlugin.onGameSetup(createBaseState(), {
      scenarioId: 'klaw',
      difficulty: 'STANDARD',
    });
    expect(klawSetupState.mainScheme.stage).toBe('1B');
    expect(klawSetupState.mainScheme.card.code).toBe('01116b');

    const ultronPlugin = ScenarioRegistry.get('ultron');
    const ultronSetupState = ultronPlugin.onGameSetup(createBaseState(), {
      scenarioId: 'ultron',
      difficulty: 'STANDARD',
    });
    expect(ultronSetupState.mainScheme.stage).toBe('1B');
    expect(ultronSetupState.mainScheme.card.code).toBe('01137b');
  });
});
