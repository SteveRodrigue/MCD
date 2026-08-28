import { describe, it, expect } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, getActiveVillain, getActiveMainScheme, getVillainById, getMainSchemeById } from '@engine/models';
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
});
