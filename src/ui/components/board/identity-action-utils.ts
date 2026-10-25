import { PlayerState, GameState } from '../../../engine/models';
import { canAttack, HERO_ACTOR } from '../../../engine/pipeline/legality-checker';
import { EnemyTarget, getValidAttackTargets } from './attack-target-utils';

export interface IdentityAttackState {
  canAttack: boolean;
  canAttackVillain: boolean;
  validAttackTargets: EnemyTarget[];
  eligibleMinion?: EnemyTarget;
  subtext: string;
}

export function getIdentityAttackState(
  player: PlayerState,
  gameState?: GameState,
): IdentityAttackState {
  const isHero = player.currentForm === 'hero';
  const isPlayerTurn = gameState
    ? gameState.phase === 'PLAYER_PHASE' &&
      gameState.players[gameState.activePlayerIndex]?.id === player.id
    : true;

  const validAttackTargets = gameState ? getValidAttackTargets(gameState, player.id, 'hero') : [];
  const canAttackVillain = gameState
    ? canAttack(gameState, player.id, HERO_ACTOR, 'villain').allowed
    : isHero && !player.exhausted;
  const eligibleMinion = validAttackTargets.find((t) => t.type === 'minion');

  const heroCanAttack =
    isHero &&
    isPlayerTurn &&
    !player.exhausted &&
    (gameState ? validAttackTargets.length > 0 : true);

  let subtext: string;
  if (player.exhausted) {
    subtext = 'Hero is exhausted';
  } else if (!isHero) {
    subtext = 'Cannot attack while in Alter-Ego form';
  } else if (!isPlayerTurn) {
    subtext = 'Not your turn';
  } else if (!heroCanAttack) {
    subtext = 'No valid attack targets';
  } else if (canAttackVillain) {
    subtext =
      validAttackTargets.length > 1 ? 'Exhaust to attack enemy' : 'Exhaust to attack villain';
  } else if (eligibleMinion) {
    subtext = 'Exhaust to attack minion — Villain guarded';
  } else {
    subtext = 'Exhaust to attack';
  }

  return {
    canAttack: heroCanAttack,
    canAttackVillain,
    validAttackTargets,
    eligibleMinion,
    subtext,
  };
}
