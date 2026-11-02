import { describe, expect, it } from 'vitest';
import { assignShards, reportTimings, shardLoads } from '../../tools/test-shards';

const files = Array.from({ length: 40 }, (_, i) => `tests/f${String(i).padStart(2, '0')}.test.ts`);
const timings = Object.fromEntries(files.map((file, i) => [file, (i % 7) * 400 + 50]));

describe('assignShards', () => {
  it('puts every file in exactly one shard', () => {
    const shards = assignShards(files, timings, 4);
    expect(shards).toHaveLength(4);
    expect(shards.flat().sort()).toEqual([...files].sort());
  });

  it('gives the same split whatever order the files arrive in', () => {
    expect(assignShards([...files].reverse(), timings, 4)).toEqual(assignShards(files, timings, 4));
  });

  it('keeps every shard within 10% of the average run time', () => {
    const loads = shardLoads(assignShards(files, timings, 4), timings);
    const mean = loads.reduce((sum, load) => sum + load, 0) / loads.length;
    for (const load of loads) expect(Math.abs(load - mean)).toBeLessThan(mean * 0.1);
  });

  it('gives a slow file a shard of its own and spreads the rest', () => {
    const slow = { ...timings, 'tests/f00.test.ts': 60_000 };
    const shards = assignShards(files, slow, 4);
    expect(shards.find((shard) => shard.includes('tests/f00.test.ts'))).toEqual([
      'tests/f00.test.ts',
    ]);
  });

  it('spreads new files without a recorded time across the shards', () => {
    const added = Array.from({ length: 8 }, (_, i) => `tests/new${i}.test.ts`);
    const shards = assignShards([...files, ...added], timings, 4);
    for (const shard of shards) expect(shard.filter((f) => f.includes('/new')).length).toBe(2);
  });

  it('splits by file count when no timings are recorded', () => {
    const counts = assignShards(files, {}, 4).map((shard) => shard.length);
    expect(counts).toEqual([10, 10, 10, 10]);
  });
});

describe('reportTimings', () => {
  it('reads per-file run times from a vitest JSON report, keyed by relative path', () => {
    const report = JSON.stringify({
      testResults: [
        { name: '/repo/tests/ui/a.test.tsx', startTime: 1000, endTime: 1250.6 },
        { name: '/repo/tests/b.test.ts', startTime: 10, endTime: 30 },
      ],
    });
    expect(reportTimings(report, '/repo')).toEqual({
      'tests/ui/a.test.tsx': 251,
      'tests/b.test.ts': 20,
    });
  });
});
