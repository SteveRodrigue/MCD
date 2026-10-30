import { Keyword, hasKeyword, getActiveVillain } from '@engine/models';
import type {
  AttackExecutionContext,
  CardAbility,
  CardInstance,
  GameState,
  PlayerState,
} from '@engine/models';
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

export type DefenderRestriction = 'REQUIRE_ALLY_IF_ABLE' | 'CANNOT_DEFEND';

/**
 * Returns any defender restriction enforced on an incoming enemy attack (e.g. Melter 01132).
 */
export function getDefenderRestriction(
  state: GameState,
  attackContext: AttackExecutionContext,
): DefenderRestriction | undefined {
  const abilitiesList: (CardAbility[] | undefined)[] = [];

  if (attackContext.attackerType === 'MINION' && attackContext.attackerCard) {
    abilitiesList.push(attackContext.attackerCard.card?.enrichment?.abilities);
    for (const att of attackContext.attackerCard.attachments || []) {
      abilitiesList.push(att.card?.enrichment?.abilities);
    }
  } else if (attackContext.attackerType === 'VILLAIN') {
    const villain = getActiveVillain(state);
    if (villain) {
      abilitiesList.push(villain.card?.enrichment?.abilities);
      for (const att of villain.attachments || []) {
        abilitiesList.push(att.card?.enrichment?.abilities);
      }
    }
  }

  for (const abilities of abilitiesList) {
    for (const ab of abilities || []) {
      if (ab.timing === 'CONSTANT') {
        for (const step of ab.steps || []) {
          if (step.effect === 'RESTRICT_DEFENSE') {
            const req = step.effectParams?.requirement as DefenderRestriction | undefined;
            return req ?? 'REQUIRE_ALLY_IF_ABLE';
          }
        }
      }
    }
  }

  return undefined;
}
