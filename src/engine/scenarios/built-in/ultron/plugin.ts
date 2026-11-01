import { CardInstance, CardType, GameState, MinionCard, getCatalog } from '@engine/models';
import { createCardInstance } from '../../../state/card-instance';
import { appendLog } from '../../../state/game-log';
import { DeclarativeScenarioPlugin } from '../../declarative-plugin';
import type { ScenarioDefinition, ScenarioGameSetupOptions } from '../../types';
import definitionData from '../../../../../content/packs/core/scenarios/ultron/definition.json';

/**
 * Creates a standard Ultron Drone minion instance (RR v1.8 / Ultron Drones Environment).
 * Drones have 1 HP, 1 ATK, 1 SCH and represent facedown player/encounter cards.
 */
function createDroneMinionInstance(sourceCard: CardInstance): CardInstance {
  const droneCardData: MinionCard = {
    code: `drone_${sourceCard.card.code}`,
    name: 'Ultron Drone',
    type: CardType.MINION,
    faction: sourceCard.card.faction,
    packCode: sourceCard.card.packCode,
    position: sourceCard.card.position,
    quantity: 1,
    deckLimit: 1,
    isUnique: false,
    costPerHero: false,
    text: 'Ultron Drone minion (1 HP, 1 ATK, 1 SCH).',
    traits: ['Drone'],
    keywords: [],
    resources: { physical: 0, energy: 0, mental: 0, wild: 0, total: 0 },
    isLandscape: false,
    orientation: 'portrait',
    health: 1,
    attack: 1,
    scheme: 1,
    enrichment: {
      abilities: [],
    },
    raw: sourceCard.card.raw,
  };

  return {
    instanceId: `drone_${sourceCard.instanceId}`,
    card: droneCardData,
    exhausted: false,
    tokens: {
      damage: 0,
      threat: 0,
      counters: 0,
    },
    statusCards: [],
    attachments: [],
  };
}

/**
 * Ultron (The Crimson Cowl). The Ultron Drones environment stays out of the encounter deck; stage
 * 1A puts it into play and deals each player a drone (still code, Gate 2 card integration).
 */
export class UltronScenarioPlugin extends DeclarativeScenarioPlugin {
  protected excludedEncounterTypes = ['environment'];

  constructor() {
    super(definitionData as ScenarioDefinition, 'ULTRON ONLINE! DRONES INITIALIZED!');
  }

  resolveStage1ASetup(state: GameState, _options?: ScenarioGameSetupOptions): GameState {
    // 1A Setup: Put Ultron Drones (01140) environment into play
    const ultronDronesCard = getCatalog(state).getCard('01140');
    if (ultronDronesCard) {
      const envInstance = createCardInstance(ultronDronesCard);
      state.environments.push(envInstance);
      appendLog(state, {
        category: 'phase',
        key: 'scenario.setup.environment',
        params: { card: ultronDronesCard.name },
        onomatopoeia: 'ULTRON DRONES ENVIRONMENT ONLINE!',
      });
    }

    // 1B When Revealed: Each player puts the top card of their deck into play facedown engaged as a Drone minion
    for (const player of state.players) {
      if (player.deck.length > 0) {
        const topDeckCard = player.deck.shift()!;
        const droneMinion = createDroneMinionInstance(topDeckCard);
        player.engagedMinions.push(droneMinion);

        appendLog(state, {
          category: 'combat',
          key: 'scenario.setup.drone',
          params: { actor: player.name },
          onomatopoeia: 'DRONE DEPLOYED!',
        });
      }
    }

    return state;
  }
}

export const ultronPlugin = new UltronScenarioPlugin();
