import { PlayerState, GameState } from '../../../engine/models';
import { canBasicAttack } from '../../../engine/pipeline/legality-checker';
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
  effectiveAttackDamage: number = 0,
): IdentityAttackState {
  const isHero = player.currentForm === 'hero';
  const isPlayerTurn = gameState
    ? gameState.phase === 'PLAYER_PHASE' &&
      gameState.players[gameState.activePlayerIndex]?.id === player.id
    : true;

  const validAttackTargets = gameState ? getValidAttackTargets(gameState, player.id, 'hero') : [];
  const canAttackVillain = gameState
    ? canBasicAttack(gameState, player.id, 'villain').allowed
    : isHero && !player.exhausted;
  const eligibleMinion = validAttackTargets.find((t) => t.type === 'minion');

  const canAttack =
    isHero &&
    isPlayerTurn &&
    !player.exhausted &&
    (gameState ? validAttackTargets.length > 0 : true);

  let subtext = '';
  if (player.exhausted) {
    subtext = 'Hero is exhausted';
  } else if (!isHero) {
    subtext = 'Cannot attack while in Alter-Ego form';
  } else if (!isPlayerTurn) {
    subtext = 'Not your turn';
  } else if (!canAttack) {
    subtext = 'No valid attack targets';
  } else if (canAttackVillain) {
    subtext =
      validAttackTargets.length > 1
        ? `Exhaust to attack enemy for ${effectiveAttackDamage} damage`
        : `Exhaust to attack villain for ${effectiveAttackDamage} damage`;
  } else if (eligibleMinion) {
    subtext = `Exhaust to attack minion (${effectiveAttackDamage} DMG) — Villain guarded`;
  } else {
    subtext = `Exhaust to attack for ${effectiveAttackDamage} damage`;
  }

  return {
    canAttack,
    canAttackVillain,
    validAttackTargets,
    eligibleMinion,
    subtext,
  };
}
