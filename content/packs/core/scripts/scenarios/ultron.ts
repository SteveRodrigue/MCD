import { CardInstance, CardType, GameState, MinionCard } from '@engine/models';
import type { ScenarioHooks } from '@engine/plugin-api';
import { appendLog } from '@engine/state/game-log';

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
 * Ultron (The Crimson Cowl). Stage 1A's Setup (put the Ultron Drones environment into play) is an
 * ability of the main scheme card, resolved by the engine. What stays code is stage 1B: each
 * player puts the top card of their deck into play facedown as a Drone minion, a concept the
 * engine does not have yet (the Vision pack reproduces it; see the M5 plan, decision 4).
 */
export const ultronScenarioHooks: ScenarioHooks = {
  resolveStage1BReveal(state: GameState): GameState {
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
  },
};
