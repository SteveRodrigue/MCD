import {
  AllTimeStats,
  CardUsageStats,
  GameStats,
  BasicActionSummary,
  StatsResetRequest,
  applyStatsReset,
  createInitialAllTimeStats,
  mergeDeltaIntoAllTime,
} from '../../engine/models/stats';

const LOCAL_STORAGE_KEY = 'mcd_card_play_stats';

let lastSyncedGameStats: GameStats | null = null;
let lastGameCompletedSynced = false;

function getLocalStats(): AllTimeStats {
  try {
    if (typeof localStorage !== 'undefined') {
      const data = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (data) {
        return JSON.parse(data);
      }
    }
  } catch {
    // Ignore storage errors
  }
  return createInitialAllTimeStats();
}

function saveLocalStats(stats: AllTimeStats): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(stats));
    }
  } catch {
    // Ignore storage errors
  }
}

export function computeGameStatsDelta(
  current: GameStats,
  previous: GameStats | null,
): {
  cards: Record<string, Partial<CardUsageStats>>;
  basicActions: Partial<BasicActionSummary>;
  hasDelta: boolean;
} {
  const deltaCards: Record<string, Partial<CardUsageStats>> = {};
  let hasDelta = false;

  for (const [cardCode, currentCard] of Object.entries(current.cards || {})) {
    const prevCard = previous?.cards?.[cardCode];
    const playedDelta = (currentCard.played || 0) - (prevCard?.played || 0);

    const abilitiesDelta: Record<string, number> = {};
    for (const [abId, count] of Object.entries(currentCard.abilitiesUsed || {})) {
      const prevCount = prevCard?.abilitiesUsed?.[abId] || 0;
      const diff = (count || 0) - prevCount;
      if (diff > 0) {
        abilitiesDelta[abId] = diff;
      }
    }

    const basicActionsDelta: NonNullable<CardUsageStats['basicActions']> = {};
    if (currentCard.basicActions) {
      for (const [k, count] of Object.entries(currentCard.basicActions)) {
        const key = k as keyof NonNullable<CardUsageStats['basicActions']>;
        const prevCount = prevCard?.basicActions?.[key] || 0;
        const diff = (count || 0) - prevCount;
        if (diff > 0) {
          basicActionsDelta[key] = diff;
        }
      }
    }

    const cardHasDelta =
      playedDelta > 0 ||
      Object.keys(abilitiesDelta).length > 0 ||
      Object.keys(basicActionsDelta).length > 0;

    if (cardHasDelta) {
      hasDelta = true;
      deltaCards[cardCode] = {
        played: playedDelta > 0 ? playedDelta : 0,
        abilitiesUsed: abilitiesDelta,
        basicActions: basicActionsDelta,
      };
    }
  }

  const deltaBasicActions: Partial<BasicActionSummary> = {};
  if (current.basicActions) {
    for (const [k, count] of Object.entries(current.basicActions)) {
      const key = k as keyof BasicActionSummary;
      const prevCount = previous?.basicActions?.[key] || 0;
      const diff = (count || 0) - prevCount;
      if (diff > 0) {
        deltaBasicActions[key] = diff;
        hasDelta = true;
      }
    }
  }

  return { cards: deltaCards, basicActions: deltaBasicActions, hasDelta };
}

export async function getAllTimeStats(): Promise<AllTimeStats> {
  try {
    const res = await fetch('/api/stats', { method: 'GET' });
    if (res.ok) {
      const stats = await res.json();
      saveLocalStats(stats);
      return stats;
    }
  } catch {
    // Fall back to localStorage
  }
  return getLocalStats();
}

/**
 * Pushes the stats recorded since the last sync to all-time storage. The sync baseline advances
 * before the request is sent, so overlapping calls never send the same plays twice. Resolves to
 * null when there is nothing new to sync.
 */
export async function syncGameStats(
  currentStats: GameStats,
  gameCompleted: boolean,
): Promise<AllTimeStats | null> {
  const isNewGameCompletion = gameCompleted && !lastGameCompletedSynced;
  const { cards, basicActions, hasDelta } = computeGameStatsDelta(
    currentStats,
    lastSyncedGameStats,
  );
  if (!hasDelta && !isNewGameCompletion) return null;

  lastSyncedGameStats = structuredClone(currentStats);
  if (isNewGameCompletion) lastGameCompletedSynced = true;
  const payload = { cards, basicActions, gameCompleted: isNewGameCompletion };

  try {
    const res = await fetch('/api/stats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      const updated = data.stats || data;
      saveLocalStats(updated);
      return updated;
    }
  } catch {
    // Fall back to offline merge
  }

  const merged = mergeDeltaIntoAllTime(getLocalStats(), payload);
  saveLocalStats(merged);
  return merged;
}

async function requestStatsReset(request: StatsResetRequest): Promise<AllTimeStats> {
  try {
    const res = await fetch('/api/stats/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (res.ok) {
      const data = await res.json();
      const updated = data.stats || data;
      saveLocalStats(updated);
      return updated;
    }
  } catch {
    // Offline reset
  }

  const reset = applyStatsReset(getLocalStats(), request);
  saveLocalStats(reset);
  return reset;
}

export function resetCardStats(cardCode: string): Promise<AllTimeStats> {
  return requestStatsReset({ cardCode });
}

export function resetAllStats(): Promise<AllTimeStats> {
  return requestStatsReset({ all: true });
}

/** Starts a fresh sync baseline; call when a new game begins. */
export function resetSessionSyncTracking(): void {
  lastSyncedGameStats = null;
  lastGameCompletedSynced = false;
}
