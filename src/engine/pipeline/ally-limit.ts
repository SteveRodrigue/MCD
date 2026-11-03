import { GameState } from '@engine/models';
import { kernel } from '../kernel';
import { getEffectiveAllyLimit } from './stat-calculator';

const ALLY_LIMIT_PROMPT_PREFIX = 'prompt_ally_limit_';

/**
 * Ally Limit (RR v1.8): a player may play or put into play allies beyond their ally limit, but a
 * player who controls more allies than it must immediately discard allies they control down to
 * it, before abilities that resolve upon entering play. Runs after every action, so it also covers
 * a limit that drops (Avengers Tower leaving play, or a non-Avenger ally joining 03024's Avengers).
 * Each prompt discards one ally; the check after it asks again until the player is at the limit.
 */
export function enforceAllyLimits(state: GameState): void {
  for (const player of state.players) {
    const limit = getEffectiveAllyLimit(player, state);
    const promptId = `${ALLY_LIMIT_PROMPT_PREFIX}${player.id}`;
    if (player.allies.length <= limit) continue;
    if (state.pendingDecisionQueue.some((p) => p.promptId === promptId)) continue;

    kernel.enqueueDecisionPrompt(
      state,
      {
        promptId,
        playerId: player.id,
        title: 'Ally Limit Exceeded',
        description: `You control ${player.allies.length} allies but your ally limit is ${limit}. Choose an ally to discard:`,
        sourceCardName: 'Ally Limit',
        options: player.allies.map((ally) => ({
          id: ally.instanceId,
          label: `Discard ${ally.card.name}`,
          cardCode: ally.card.code,
          description: `Discard ${ally.card.name} from play`,
          effect: 'DISCARD',
          params: { source: 'TABLEAU', targetInstanceId: ally.instanceId },
        })),
      },
      { front: true },
    );
  }
}
