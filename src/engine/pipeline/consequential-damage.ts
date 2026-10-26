import type { GameState, AllyCard } from '../models';
import { getPlayer } from './legality-checker';
import { processHostDefeated, resetCardState } from '../effects';
import { dispatchDefeat } from '../triggers/defeat-dispatch';
import { kernel } from '../kernel';

/**
 * Executes consequential damage to an ally and handles ally defeat.
 * Consequential damage is dealt equal to the printed or overridden cost.
 * If the ally is defeated, it is discarded and DEFEATED/CHARACTER_DEFEATED triggers are announced.
 */
export function executeConsequentialDamage(
  state: GameState,
  playerId: string,
  allyInstanceId: string,
  amount: number,
): void {
  const player = getPlayer(state, playerId);
  if (!player) return;

  const allyIdx = player.allies.findIndex((a) => a.instanceId === allyInstanceId);
  if (allyIdx === -1) return; // Ally already left play (e.g. defeated by Retaliate)

  const ally = player.allies[allyIdx];
  const allyCard = ally.card as AllyCard;

  ally.tokens = { ...ally.tokens, damage: (ally.tokens?.damage || 0) + amount };

  const allyHp = allyCard.health || 2;
  if ((ally.tokens?.damage || 0) >= allyHp) {
    player.allies.splice(allyIdx, 1);
    processHostDefeated(state, ally, { player });
    const owner = (ally.ownerId ? getPlayer(state, ally.ownerId) : undefined) || player;
    resetCardState(ally);
    owner.discard.push(ally);
    dispatchDefeat(state, {
      targetPlayerId: player.id,
      targetInstanceId: ally.instanceId,
      targetType: 'ALLY',
      defeatSource: { kind: 'EFFECT', playerId: player.id, byAttack: false },
    });
  }
}

/**
 * Applies consequential damage to an ally per RR v1.8 Consequential Damage.
 * "Consequential damage is dealt to an ally after resolving abilities that are triggered by the ally attacking or thwarting."
 * If decision prompts are pending in the queue, consequential damage is deferred until all prompts resolve.
 */
export function applyConsequentialDamage(
  state: GameState,
  playerId: string,
  allyInstanceId: string,
  amount: number,
): void {
  if (kernel.peekDecisionPrompt(state)) {
    state.pendingConsequentialDamage = [
      ...(state.pendingConsequentialDamage ?? []),
      { playerId, allyInstanceId, amount },
    ];
    return;
  }
  executeConsequentialDamage(state, playerId, allyInstanceId, amount);
}

/**
 * Drains and executes all deferred consequential damage once all decision prompts have resolved.
 */
export function finishPendingConsequentialDamage(state: GameState): GameState {
  if (!state.pendingConsequentialDamage || state.pendingConsequentialDamage.length === 0) {
    return state;
  }

  const pending = [...state.pendingConsequentialDamage];
  delete state.pendingConsequentialDamage;

  for (const item of pending) {
    executeConsequentialDamage(state, item.playerId, item.allyInstanceId, item.amount);
  }

  return state;
}
