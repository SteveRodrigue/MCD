import { CardInstance, GameState, Keyword, MinionCard, StatusCard } from '../../../engine/models';
import { canAllyAttack, canBasicAttack } from '../../../engine/pipeline/legality-checker';

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
  cardInstance?: CardInstance;
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
      ? canBasicAttack(state, playerId, 'villain').allowed
      : allyInstanceId
        ? canAllyAttack(state, playerId, allyInstanceId, 'villain').allowed
        : false;

  if (canAtkVillain) {
    const vHealth = state.villain.health;
    const vMaxHealth = state.villain.card.health || 14;
    const hasTough = (state.villain.statusCards || []).includes(StatusCard.TOUGH);
    targets.push({
      id: 'villain',
      name: state.villain.card.name,
      type: 'villain',
      health: vHealth,
      maxHealth: vMaxHealth,
      damage: Math.max(0, vMaxHealth - vHealth),
      traits: state.villain.card.traits || [],
      hasGuard: false,
      hasTough,
    });
  }

  for (const playerState of state.players) {
    for (const minion of playerState.engagedMinions || []) {
      const canAtkMinion =
        attackerType === 'hero'
          ? canBasicAttack(state, playerId, 'minion', minion.instanceId).allowed
          : allyInstanceId
            ? canAllyAttack(state, playerId, allyInstanceId, 'minion', minion.instanceId).allowed
            : false;

      if (canAtkMinion) {
        const mMax = (minion.card as MinionCard).health || 1;
        const mDamage = minion.tokens?.damage || 0;
        const mHealth = Math.max(0, mMax - mDamage);
        const hasGuard =
          minion.card.keywords?.includes(Keyword.GUARD) ||
          (minion.card.text || '').includes('Guard') ||
          (minion.card.traits || []).includes('Guard');
        const hasTough = (minion.statusCards || []).includes(StatusCard.TOUGH);

        targets.push({
          id: minion.instanceId,
          name: minion.card.name,
          type: 'minion',
          instanceId: minion.instanceId,
          health: mHealth,
          maxHealth: mMax,
          damage: mDamage,
          traits: minion.card.traits || [],
          hasGuard: !!hasGuard,
          hasTough,
          cardInstance: minion,
        });
      }
    }
  }

  return targets;
}
