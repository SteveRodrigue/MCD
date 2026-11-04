import type { CardArtStats } from '../../data/content/card-art';
import { CardInstance, GameState, getActiveVillain } from '../../engine/models';
import {
  getEffectiveAllyStats,
  getEffectiveMinionAttack,
  getEffectiveMinionHitPoints,
  getEffectiveVillainMaxHealth,
  getEffectiveVillainStats,
} from '../../engine/pipeline/stat-calculator';

export function minionArtStats(state: GameState, minion: CardInstance): CardArtStats {
  return {
    attack: getEffectiveMinionAttack(state, minion),
    hitPoints: getEffectiveMinionHitPoints(state, minion),
  };
}

export function allyArtStats(state: GameState, ally: CardInstance): CardArtStats {
  return {
    attack: getEffectiveAllyStats(state, ally).attack,
    hitPoints: (ally.card as { health?: number }).health ?? 1,
  };
}

/**
 * The current stats of the first in-play copy of a card. A prompt thumbnail only knows a card code.
 * Copies share their permanent upgrades, so any copy selects the same stat image.
 */
export function firstInPlayArtStats(state: GameState, code: string): CardArtStats | undefined {
  for (const player of state.players) {
    const minion = player.engagedMinions.find((m) => m.card.code === code);
    if (minion) return minionArtStats(state, minion);
    const ally = player.allies.find((a) => a.card.code === code);
    if (ally) return allyArtStats(state, ally);
  }
  const villain = getActiveVillain(state);
  if (villain?.card?.code !== code) return undefined;
  return {
    attack: getEffectiveVillainStats(state, villain).attack,
    hitPoints: getEffectiveVillainMaxHealth(state, villain),
  };
}
