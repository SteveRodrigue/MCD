/** Applying a DISTRIBUTE_AMOUNT assignment, whether it came with the step or from a prompt answer. */
import type {
  CardInstance,
  DistributionPromptConfig,
  GameState,
  PlayerState,
} from '@engine/models';
import { removeThreatFromScheme } from '../pipeline/threat-pipeline';
import { findInPlayCardInstance } from '../state/state-validator';
import { applyDistributedDamage, isEncounterCard } from './index';

/** The card behind a distribution: its name for the log, its instance for damage and Crisis/Patrol. */
export interface DistributionSource {
  name: string;
  card?: CardInstance;
}

/**
 * Applies `assignments` (target id → amount) in one allocation domain. The one copy of this
 * application, so a rule written for a domain holds on both paths: threat removal obeys Crisis and
 * Patrol like a thwart does, damage goes through the damage pipeline (#296, #370).
 */
export function applyDistributedAmounts(
  state: GameState,
  domain: DistributionPromptConfig['allocationDomain'],
  assignments: Record<string, number>,
  player: PlayerState,
  source: DistributionSource,
): GameState {
  if (domain === 'DAMAGE') {
    return applyDistributedDamage(state, assignments, player, source.card);
  }

  const isPlayerSource = !(source.card && isEncounterCard(source.card.card));
  for (const [targetId, amount] of Object.entries(assignments)) {
    if (!(amount > 0)) continue;

    if (domain === 'THREAT_REMOVAL') {
      removeThreatFromScheme(state, {
        playerId: player.id,
        targetType: targetId === 'main_scheme' ? 'main_scheme' : 'side_scheme',
        targetInstanceId: targetId,
        amount,
        sourceName: source.name,
        isPlayerSource,
      });
    } else if (domain === 'HEAL') {
      const ally = state.players.flatMap((p) => p.allies).find((a) => a.instanceId === targetId);
      if (ally) {
        const currentDmg = ally.tokens?.damage || 0;
        ally.tokens = { ...ally.tokens, damage: Math.max(0, currentDmg - amount) };
        continue;
      }
      const targetPlayer = state.players.find(
        (pl) =>
          pl.id === targetId || pl.activeFormCard?.code === targetId || pl.hero?.code === targetId,
      );
      if (targetPlayer) {
        targetPlayer.health = Math.min(targetPlayer.maxHealth, targetPlayer.health + amount);
      }
    } else if (domain === 'EXHAUST') {
      const cardInst = findInPlayCardInstance(state, targetId);
      if (cardInst) {
        cardInst.exhausted = true;
      } else {
        const targetPlayer = state.players.find((pl) => pl.id === targetId);
        if (targetPlayer) targetPlayer.exhausted = true;
      }
    } else if (domain === 'COUNTERS') {
      const cardInst = findInPlayCardInstance(state, targetId);
      if (cardInst) {
        cardInst.tokens = {
          ...cardInst.tokens,
          counters: (cardInst.tokens?.counters || 0) + amount,
        };
      }
    }
  }
  return state;
}
