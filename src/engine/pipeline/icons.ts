import { GameState, NormalizedCard, getMainSchemesInPlay, getVillainsInPlay } from '@engine/models';

/**
 * The number of Crisis icons printed on a card (RR v1.8 p. 11). Crisis is an icon, not a keyword:
 * the count is the card's `scheme_crisis`, and card text is never read for it (#243).
 */
export function getCrisisIconCount(card?: NormalizedCard): number {
  return card?.scheme_crisis ?? 0;
}

/**
 * The number of Hazard icons printed on a card (RR v1.8 p. 11). Hazard is an icon, not a keyword:
 * the count is the card's `scheme_hazard`, and card text is never read for it (#345).
 */
export function getHazardIconCount(card?: NormalizedCard): number {
  return card?.scheme_hazard ?? 0;
}

/**
 * Sums `iconCount` over every in-play card (RR v1.8 p. 15 "In Play and Out of Play"). Each icon
 * counts, so a card with two icons adds 2. Returns the cards that print an icon with their count,
 * in zone order, so callers can both total them and name their sources.
 *
 * In-play zones evaluated:
 * - Side schemes and their attachments
 * - Main scheme and its attachments
 * - Environments
 * - Villain and villain attachments
 * - Players' tableaus (supports, upgrades), allies (+ attachments), engaged minions (+ attachments), and identity attachments.
 */
export function collectIconsInPlay(
  state: GameState,
  iconCount: (card?: NormalizedCard) => number,
): { card: NormalizedCard; count: number }[] {
  const found: { card: NormalizedCard; count: number }[] = [];
  const add = (card?: NormalizedCard) => {
    const count = iconCount(card);
    if (card && count > 0) found.push({ card, count });
  };
  const addWithAttachments = (card: NormalizedCard, attachments?: { card: NormalizedCard }[]) => {
    add(card);
    for (const att of attachments || []) add(att.card);
  };

  // 1. Side schemes & attachments
  for (const s of state.sideSchemes || []) addWithAttachments(s.card, s.attachments);

  // 2. Main scheme & attachments
  for (const mainScheme of getMainSchemesInPlay(state)) {
    addWithAttachments(mainScheme.card, mainScheme.attachments);
  }

  // 3. Environments
  for (const env of state.environments || []) add(env.card);

  // 4. Villain & attachments
  for (const villain of getVillainsInPlay(state)) {
    addWithAttachments(villain.card, villain.attachments);
  }

  // 5. Players: tableaus, allies, engaged minions, identity attachments
  for (const p of state.players || []) {
    for (const t of p.tableau || []) add(t.card);
    for (const a of p.allies || []) addWithAttachments(a.card, a.attachments);
    for (const m of p.engagedMinions || []) addWithAttachments(m.card, m.attachments);
    for (const att of p.attachments || []) add(att.card);
  }

  return found;
}

/** Counts the Crisis icons currently in play (RR v1.8 p. 11 "Crisis"). */
export function countCrisisIconsInPlay(state: GameState): number {
  return collectIconsInPlay(state, getCrisisIconCount).reduce((sum, i) => sum + i.count, 0);
}

/** Counts the Hazard icons currently in play (RR v1.8 p. 11 "Hazard Icon"). */
export function countHazardIconsInPlay(state: GameState): number {
  return collectIconsInPlay(state, getHazardIconCount).reduce((sum, i) => sum + i.count, 0);
}

/**
 * True while at least one Crisis icon is in play: player cards cannot remove threat from the
 * main scheme (RR v1.8 p. 11 "Crisis"). One icon is enough; more icons change nothing here.
 */
export function hasCrisisInPlay(state: GameState): boolean {
  return countCrisisIconsInPlay(state) > 0;
}
