import { CardInstance, GameState, getActiveVillain, getVillainsInPlay } from '../models';
import type { AttachHost, AttachTo } from '../../data/supplemental/schema';
import { matchesCardFilter } from '../filters/card-filter';

/** A character an encounter attachment can attach to: a villain or an engaged minion. */
export interface AttachCandidate {
  instanceId: string;
  name: string;
  /** The card instance (minion) or the villain's card holder. */
  attachments: CardInstance[];
  kind: 'villain' | 'minion';
  /** The player a minion is engaged with. */
  engagedPlayerId?: string;
  card: CardInstance['card'];
}

/** What a revealed encounter attachment does (#209). */
export type AttachmentResolution =
  | { kind: 'attach'; host: AttachCandidate }
  | { kind: 'choose'; candidates: AttachCandidate[] }
  | { kind: 'surge' };

function candidatesOf(state: GameState): AttachCandidate[] {
  const result: AttachCandidate[] = getVillainsInPlay(state).map((villain) => ({
    instanceId: villain.instanceId || 'villain',
    name: villain.card.name,
    attachments: villain.attachments ?? [],
    kind: 'villain',
    card: villain.card,
  }));
  for (const player of state.players) {
    for (const minion of player.engagedMinions ?? []) {
      result.push({
        instanceId: minion.instanceId,
        name: minion.card.name,
        attachments: minion.attachments ?? [],
        kind: 'minion',
        engagedPlayerId: player.id,
        card: minion.card,
      });
    }
  }
  return result;
}

function printedValue(candidate: AttachCandidate, stat: 'PRINTED_HIT_POINTS' | 'PRINTED_ATTACK') {
  const card = candidate.card as { health?: number; attack?: number };
  return (stat === 'PRINTED_HIT_POINTS' ? card.health : card.attack) ?? 0;
}

/**
 * The candidates a host declaration allows, before the first player's tie-break: `VILLAIN` is the
 * active villain; `MINION` / `ENEMY` filter the minions (and villains), drop those already
 * carrying a copy when asked, then keep the highest / lowest printed value.
 */
export function findAttachCandidates(
  state: GameState,
  attachment: CardInstance,
  host: AttachHost,
): AttachCandidate[] {
  const all = candidatesOf(state);
  if (host.type === 'VILLAIN') {
    const active = getActiveVillain(state);
    return all.filter(
      (c) => c.kind === 'villain' && c.instanceId === (active.instanceId || 'villain'),
    );
  }

  let pool = all.filter((c) => host.type === 'ENEMY' || c.kind === 'minion');
  if (host.filter) {
    pool = pool.filter((c) => matchesCardFilter(c.card, host.filter, { state }));
  }
  if (host.withoutCopyAttached) {
    pool = pool.filter((c) => !c.attachments.some((a) => a.card.code === attachment.card.code));
  }
  if (host.superlative && pool.length > 0) {
    const { stat, extreme } = host.superlative;
    const values = pool.map((c) => printedValue(c, stat));
    const best =
      extreme === 'HIGHEST'
        ? Math.max(...values)
        : extreme === 'LOWEST'
          ? Math.min(...values)
          : values[0];
    pool = pool.filter((c) => printedValue(c, stat) === best);
  }
  return pool;
}

/**
 * Where a revealed encounter attachment goes. No declaration = the active villain. No candidate
 * for the host = the `otherwise` branch (surge, or a second host); with none left the villain.
 * Several candidates are a tie the first player settles (RR v1.8: the first player decides when
 * the rules leave the choice open).
 */
export function resolveAttachmentHost(
  state: GameState,
  attachment: CardInstance,
  attachTo: AttachTo | undefined,
): AttachmentResolution {
  const fromCandidates = (candidates: AttachCandidate[]): AttachmentResolution | undefined => {
    if (candidates.length === 1) return { kind: 'attach', host: candidates[0] };
    if (candidates.length > 1) return { kind: 'choose', candidates };
    return undefined;
  };

  const declared = attachTo ?? { host: { type: 'VILLAIN' as const } };
  const primary = fromCandidates(findAttachCandidates(state, attachment, declared.host));
  if (primary) return primary;

  if (declared.otherwise?.type === 'SURGE') return { kind: 'surge' };
  if (declared.otherwise) {
    const fallback = fromCandidates(findAttachCandidates(state, attachment, declared.otherwise));
    if (fallback) return fallback;
  }

  return fromCandidates(findAttachCandidates(state, attachment, { type: 'VILLAIN' }))!;
}
