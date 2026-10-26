import { Keyword, hasKeyword } from '@engine/models';
import type { CardInstance, GameState, PlayerState } from '@engine/models';
import { hasCrisisInPlay } from './icons';

/**
 * The restrictions that make a scheme or villain an illegal target for one acting player's cards:
 * Crisis and Patrol (main scheme threat removal), Guard (villain attack). Every caller that asks
 * "is this target blocked?" asks here (the legality gate, the target enumeration, the action
 * checks and the thwart executor), so a rule is written once (ADR-0090, #331).
 */

export type MainSchemeThreatBlock = 'CRISIS' | 'PATROL';

export interface MainSchemeThreatBlockOptions {
  /** False for an encounter card's ability: Crisis and Patrol limit player cards only. */
  isPlayerSource?: boolean;
  /** A step that may remove threat while Crisis is in play; Patrol still applies. */
  ignoresCrisis?: boolean;
}

/** What the player is told when the block stops a thwart or a threat removal. */
export const MAIN_SCHEME_BLOCK_REASON: Record<MainSchemeThreatBlock, string> = {
  CRISIS: 'Cannot thwart the main scheme while a Crisis icon is in play.',
  PATROL: 'Cannot thwart the main scheme while an engaged minion with Patrol is in play.',
};

export const GUARD_BLOCK_REASON =
  'Cannot attack the villain while an engaged minion with Guard is in play.';

/**
 * Why this player's cards cannot remove threat from the main scheme right now (RR v1.8 "Crisis
 * Icon", "Patrol"): a Crisis icon anywhere in play, or a Patrol minion engaged with this player.
 */
export function getMainSchemeThreatBlock(
  state: GameState,
  actingPlayer: PlayerState,
  options: MainSchemeThreatBlockOptions = {},
): MainSchemeThreatBlock | undefined {
  const { isPlayerSource = true, ignoresCrisis = false } = options;
  if (!isPlayerSource) return undefined;
  if (actingPlayer.engagedMinions.some((m) => hasKeyword(m.card, Keyword.PATROL))) return 'PATROL';
  if (!ignoresCrisis && hasCrisisInPlay(state)) return 'CRISIS';
  return undefined;
}

/** Whether a Guard minion engaged with this player stops their cards attacking a villain (RR v1.8 "Guard"). */
export function isVillainAttackBlockedByGuard(actingPlayer: PlayerState): boolean {
  return actingPlayer.engagedMinions.some(isGuardMinion);
}

/** Whether a minion has the Guard keyword (RR v1.8 "Guard"). */
export function isGuardMinion(minion: CardInstance): boolean {
  return hasKeyword(minion.card, Keyword.GUARD);
}
