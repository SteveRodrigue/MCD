import { GameState, NormalizedCard, getMainSchemesInPlay, getVillainsInPlay } from '@engine/models';

/**
 * The number of Crisis icons printed on a card (RR v1.8 p. 11). Crisis is an icon, not a keyword:
 * the count is the card's `scheme_crisis`, and card text is never read for it (#243).
 */
export function getCrisisIconCount(card?: NormalizedCard): number {
  return card?.scheme_crisis ?? 0;
}

/**
 * Counts the Crisis icons currently in play across ALL in-play cards (RR v1.8 p. 11 "Crisis",
 * p. 15 "In Play and Out of Play"). Each icon counts, so a card with two icons adds 2.
 *
 * In-play zones evaluated:
 * - Side schemes and their attachments
 * - Main scheme and its attachments
 * - Environments
 * - Villain and villain attachments
 * - Players' tableaus (supports, upgrades), allies (+ attachments), engaged minions (+ attachments), and identity attachments.
 */
export function countCrisisIconsInPlay(state: GameState): number {
  let count = 0;
  // 1. Side schemes & attachments
  for (const s of state.sideSchemes || []) {
    count += getCrisisIconCount(s.card);
    for (const att of s.attachments || []) {
      count += getCrisisIconCount(att.card);
    }
  }

  // 2. Main scheme & attachments
  for (const mainScheme of getMainSchemesInPlay(state)) {
    count += getCrisisIconCount(mainScheme.card);
    for (const att of mainScheme.attachments || []) {
      count += getCrisisIconCount(att.card);
    }
  }

  // 3. Environments
  for (const env of state.environments || []) {
    count += getCrisisIconCount(env.card);
  }

  // 4. Villain & attachments
  for (const villain of getVillainsInPlay(state)) {
    count += getCrisisIconCount(villain.card);
    for (const att of villain.attachments || []) {
      count += getCrisisIconCount(att.card);
    }
  }

  // 5. Players: tableaus, allies, engaged minions, identity attachments
  for (const p of state.players || []) {
    for (const t of p.tableau || []) {
      count += getCrisisIconCount(t.card);
    }
    for (const a of p.allies || []) {
      count += getCrisisIconCount(a.card);
      for (const att of a.attachments || []) {
        count += getCrisisIconCount(att.card);
      }
    }
    for (const m of p.engagedMinions || []) {
      count += getCrisisIconCount(m.card);
      for (const att of m.attachments || []) {
        count += getCrisisIconCount(att.card);
      }
    }
    for (const att of p.attachments || []) {
      count += getCrisisIconCount(att.card);
    }
  }

  return count;
}

/**
 * True while at least one Crisis icon is in play: player cards cannot remove threat from the
 * main scheme (RR v1.8 p. 11 "Crisis"). One icon is enough; more icons change nothing here.
 */
export function hasCrisisInPlay(state: GameState): boolean {
  return countCrisisIconsInPlay(state) > 0;
}
