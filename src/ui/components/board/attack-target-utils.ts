import {
  GameState,
  Keyword,
  StatusCard,
  hasKeyword,
  getActiveVillain,
} from '../../../engine/models';
import { canAttack, HERO_ACTOR } from '../../../engine/pipeline/legality-checker';
import { getEffectiveMinionHitPoints } from '../../../engine/pipeline/stat-calculator';

export interface EnemyTarget {
  id: string;
  name: string;
  type: 'villain' | 'minion';
  instanceId?: string;
  health: number;
  maxHealth: number;
  damage: number;
  traits: string[];
  hasGuard: boolean;
  hasTough: boolean;
  /** Card code of the target, for its thumbnail. */
  code?: string;
}

export function getValidAttackTargets(
  state: GameState,
  playerId: string,
  attackerType: 'hero' | 'ally',
  allyInstanceId?: string,
): EnemyTarget[] {
  const targets: EnemyTarget[] = [];
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return targets;

  const canAtkVillain =
    attackerType === 'hero'
      ? canAttack(state, playerId, HERO_ACTOR, 'villain').allowed
      : allyInstanceId
        ? canAttack(state, playerId, { kind: 'ally', instanceId: allyInstanceId }, 'villain')
            .allowed
        : false;

  if (canAtkVillain) {
    // Offers the active villain only; a villain selection for multi-villain scenarios is #212.
    const villain = getActiveVillain(state);
    const vHealth = villain.health;
    const vMaxHealth = villain.maxHealth;
    const hasTough = (villain.statusCards || []).includes(StatusCard.TOUGH);
    targets.push({
      id: 'villain',
      name: villain.card.name,
      code: villain.card.code,
      type: 'villain',
      health: vHealth,
      maxHealth: vMaxHealth,
      damage: Math.max(0, vMaxHealth - vHealth),
      traits: villain.card.traits || [],
      hasGuard: false,
      hasTough,
    });
  }

  for (const playerState of state.players) {
    for (const minion of playerState.engagedMinions || []) {
      const canAtkMinion =
        attackerType === 'hero'
          ? canAttack(state, playerId, HERO_ACTOR, 'minion', minion.instanceId).allowed
          : allyInstanceId
            ? canAttack(
                state,
                playerId,
                { kind: 'ally', instanceId: allyInstanceId },
                'minion',
                minion.instanceId,
              ).allowed
            : false;

      if (canAtkMinion) {
        const mMax = getEffectiveMinionHitPoints(state, minion);
        const mDamage = minion.tokens?.damage || 0;
        const mHealth = Math.max(0, mMax - mDamage);
        const hasGuard = hasKeyword(minion.card, Keyword.GUARD);
        const hasTough = (minion.statusCards || []).includes(StatusCard.TOUGH);

        targets.push({
          id: minion.instanceId,
          name: minion.card.name,
          code: minion.card.code,
          type: 'minion',
          instanceId: minion.instanceId,
          health: mHealth,
          maxHealth: mMax,
          damage: mDamage,
          traits: minion.card.traits || [],
          hasGuard: !!hasGuard,
          hasTough,
        });
      }
    }
  }

  return targets;
}
