import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getAllTimeStats,
  syncGameStats,
  resetCardStats,
  resetAllStats,
  resetSessionSyncTracking,
  computeGameStatsDelta,
} from '../../src/ui/services/stats-storage-service';
import {
  createInitialGameStats,
  createInitialAllTimeStats,
  mergeDeltaIntoAllTime,
} from '../../src/engine/models/stats';

describe('Stats Storage Service & Delta Synchronization (#315)', () => {
  const memoryStore = new Map<string, string>();

  beforeEach(() => {
    resetSessionSyncTracking();
    memoryStore.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => memoryStore.get(key) ?? null,
      setItem: (key: string, value: string) => memoryStore.set(key, value),
      removeItem: (key: string) => memoryStore.delete(key),
      clear: () => memoryStore.clear(),
    });
    vi.restoreAllMocks();
  });

  it('computes delta between current and previous game stats without duplicate accumulation', () => {
    const current = createInitialGameStats();
    current.cards['01001a'] = {
      played: 2,
      abilitiesUsed: { ab_1: 3 },
      basicActions: { attack: 1 },
    };
    current.basicActions.heroAttack = 1;

    // First delta against null
    const firstDelta = computeGameStatsDelta(current, null);
    expect(firstDelta.hasDelta).toBe(true);
    expect(firstDelta.cards['01001a']?.played).toBe(2);
    expect(firstDelta.cards['01001a']?.abilitiesUsed?.['ab_1']).toBe(3);
    expect(firstDelta.cards['01001a']?.basicActions?.attack).toBe(1);
    expect(firstDelta.basicActions.heroAttack).toBe(1);

    // Second delta with same stats yields no delta
    const secondDelta = computeGameStatsDelta(current, current);
    expect(secondDelta.hasDelta).toBe(false);

    // Incrementing stats yields only the difference
    const updated = JSON.parse(JSON.stringify(current));
    updated.cards['01001a'].played = 3;
    updated.cards['01001a'].abilitiesUsed['ab_1'] = 5;

    const thirdDelta = computeGameStatsDelta(updated, current);
    expect(thirdDelta.hasDelta).toBe(true);
    expect(thirdDelta.cards['01001a']?.played).toBe(1);
    expect(thirdDelta.cards['01001a']?.abilitiesUsed?.['ab_1']).toBe(2);
  });

  it('merges deltas cleanly into all-time stats', () => {
    const allTime = createInitialAllTimeStats();
    mergeDeltaIntoAllTime(allTime, {
      cards: {
        '01001a': { played: 2, abilitiesUsed: { ab_1: 1 } },
      },
      basicActions: { heroAttack: 2 },
      gameCompleted: true,
    });

    expect(allTime.gamesPlayed).toBe(1);
    expect(allTime.cards['01001a']?.played).toBe(2);
    expect(allTime.cards['01001a']?.abilitiesUsed['ab_1']).toBe(1);
    expect(allTime.basicActions.heroAttack).toBe(2);

    // Merge next session
    mergeDeltaIntoAllTime(allTime, {
      cards: {
        '01001a': { played: 1, abilitiesUsed: { ab_1: 2 } },
      },
      basicActions: { heroAttack: 1 },
    });

    expect(allTime.cards['01001a']?.played).toBe(3);
    expect(allTime.cards['01001a']?.abilitiesUsed['ab_1']).toBe(3);
    expect(allTime.basicActions.heroAttack).toBe(3);
  });

  it('syncGameStats falls back to localStorage when fetch fails and accumulates safely', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const gameStats = createInitialGameStats();
    gameStats.cards['01008'] = {
      played: 1,
      abilitiesUsed: { '01008_res': 2 },
    };

    const res1 = await syncGameStats(gameStats, false);
    expect(res1?.cards['01008']?.played).toBe(1);
    expect(res1?.cards['01008']?.abilitiesUsed['01008_res']).toBe(2);

    // Syncing same state sends nothing
    expect(await syncGameStats(gameStats, false)).toBeNull();

    // Incrementing by 1
    gameStats.cards['01008'].played = 2;
    const res3 = await syncGameStats(gameStats, false);
    expect(res3?.cards['01008']?.played).toBe(2);
  });

  it('overlapping syncs never send the same plays twice', async () => {
    const posted: { cards: Record<string, { played?: number }> }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        posted.push(JSON.parse(init.body as string));
        return { ok: true, json: async () => ({ stats: createInitialAllTimeStats() }) };
      }),
    );

    const first = createInitialGameStats();
    first.cards['01008'] = { played: 1, abilitiesUsed: {} };
    const second = structuredClone(first);
    second.cards['01008'].played = 2;

    await Promise.all([syncGameStats(first, false), syncGameStats(second, false)]);

    expect(posted.map((p) => p.cards['01008']?.played)).toEqual([1, 1]);
  });

  it('a new game starts a fresh sync baseline', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const game1 = createInitialGameStats();
    game1.cards['01001a'] = { played: 5, abilitiesUsed: {} };
    await syncGameStats(game1, true);

    resetSessionSyncTracking();
    const game2 = createInitialGameStats();
    game2.cards['01001a'] = { played: 3, abilitiesUsed: {} };
    const after = await syncGameStats(game2, true);

    expect(after?.cards['01001a']?.played).toBe(8);
    expect(after?.gamesPlayed).toBe(2);
  });

  it('resetCardStats clears only the specified card stats', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const initial = createInitialAllTimeStats();
    initial.cards['01001a'] = { played: 5, abilitiesUsed: {} };
    initial.cards['01002'] = { played: 3, abilitiesUsed: {} };
    localStorage.setItem('mcd_card_play_stats', JSON.stringify(initial));

    const afterReset = await resetCardStats('01001a');
    expect(afterReset.cards['01001a']).toBeUndefined();
    expect(afterReset.cards['01002']?.played).toBe(3);
  });

  it('resetAllStats clears all card stats and basic actions cleanly', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const initial = createInitialAllTimeStats();
    initial.gamesPlayed = 10;
    initial.cards['01001a'] = { played: 5, abilitiesUsed: {} };
    initial.basicActions.heroAttack = 15;
    localStorage.setItem('mcd_card_play_stats', JSON.stringify(initial));

    const afterReset = await resetAllStats();
    expect(afterReset.gamesPlayed).toBe(0);
    expect(afterReset.cards).toEqual({});
    expect(afterReset.basicActions.heroAttack).toBe(0);
  });

  it('getAllTimeStats retrieves stats from endpoint with localStorage fallback', async () => {
    // 1. With successful server response
    const serverStats = createInitialAllTimeStats();
    serverStats.cards['01001a'] = { played: 10, abilitiesUsed: {} };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => serverStats,
      }),
    );

    const fromServer = await getAllTimeStats();
    expect(fromServer.cards['01001a']?.played).toBe(10);

    // 2. With server failure, falls back to localStorage
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    const fallbackStats = await getAllTimeStats();
    expect(fallbackStats.cards['01001a']?.played).toBe(10);
  });
});
