import { CardInstance, GameState, PlayerState } from '@engine/models';
import type { EffectExecutionContext, EffectResult } from '@engine/effects';
import { kernel } from '@engine/kernel';
import { drawPlayerCard } from '@engine/pipeline/deck-exhaustion';
import type { SpecialAbilityHandler } from '@engine/plugin-api';
import { scenarioTokenCard } from '@engine/scenarios/scenario-tokens';
import { appendLog } from '@engine/state/game-log';

/**
 * The face of every facedown Drone, declared in Ultron's `definition.json` (01140: base SCH 1,
 * ATK 1, hit points 1). It says nothing about the real card underneath (FAQ, Steve Rogers: a card
 * in play as a Drone is hidden from searches). Named by this script's own scenario, because an
 * Ultron card can be staged outside its scenario.
 */
const droneFace = () => scenarioTokenCard('ultron', 'ultron_drone');

/** The players a Drone action names, "each player" starting with the first player (RR "Each Player"). */
function dronePlayers(
  state: GameState,
  target: unknown,
  context: EffectExecutionContext,
): PlayerState[] {
  const first = state.players[state.firstPlayerIndex] ?? state.players[0];
  if (target === 'ALL_PLAYERS') {
    const start = state.players.indexOf(first);
    return [...state.players.slice(start), ...state.players.slice(0, start)];
  }
  if (target === 'FIRST_PLAYER') return [first];
  const source = context.sourceCardInstance;
  const engaged =
    target === 'ENGAGED_PLAYER' && source
      ? state.players.find((p) => p.engagedMinions.some((m) => m.instanceId === source.instanceId))
      : undefined;
  return [engaged ?? state.players.find((p) => p.id === context.playerId) ?? first];
}

/**
 * Puts the top card of the player's deck into play facedown, engaged with them as a Drone: a minion
 * shell with the real card tucked under it. An empty deck runs out as usual first (RR Player Deck).
 * Defeating or discarding the shell sends the tucked card to its owner's discard pile (01140).
 */
function createDrone(state: GameState, player: PlayerState): CardInstance | undefined {
  const realCard = drawPlayerCard(state, player.id);
  if (!realCard) return undefined;
  realCard.ownerId = realCard.ownerId ?? player.id;

  const drone: CardInstance = {
    instanceId: `drone_${realCard.instanceId}`,
    card: droneFace(),
    isShell: true,
    exhausted: false,
    tokens: { damage: 0, threat: 0, counters: 0 },
    statusCards: [],
    attachments: [],
    cardsUnderneath: [realCard],
  };
  player.engagedMinions.push(drone);
  appendLog(state, {
    category: 'combat',
    key: 'minion.drone.created',
    params: { actor: player.name },
    onomatopoeia: 'DRONE DEPLOYED!',
  });
  kernel.dispatchTrigger(state, 'MINION_ENTERS_PLAY', {
    targetPlayerId: player.id,
    sourceInstanceId: drone.instanceId,
    targetInstanceId: drone.instanceId,
    encounterCardInstance: drone,
  });
  return drone;
}

/**
 * "Put the top card of your deck into play facedown, engaged with you as a Drone minion", called
 * from Ultron card data through EXECUTE_SPECIAL. `target` picks the players (default SELF), `count`
 * the Drones per player (default 1). The result's `value` is the number of Drones created.
 */
export const ultronDroneSpecialHandler: SpecialAbilityHandler = {
  id: 'ULTRON_DRONE',
  execute: (state, context, payload): EffectResult => {
    const count = typeof payload?.count === 'number' ? payload.count : 1;
    let created = 0;
    for (const player of dronePlayers(state, payload?.target, context)) {
      for (let i = 0; i < count; i++) {
        if (createDrone(state, player)) created++;
      }
    }
    return { state, success: true, mutatedState: created > 0, value: created };
  },
};
