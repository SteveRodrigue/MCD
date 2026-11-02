import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BaseSequencer, type TestSpecification } from 'vitest/node';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TIMINGS_PATH = path.join(REPO_ROOT, 'tests/shard-timings.json');

/** Setup every test file pays before its tests run (engine and loader imports), on top of its recorded time. */
const FILE_SETUP_MS = 300;

/** How far the slowest shard may run past the average before CI asks for fresh timings. */
const MAX_SHARD_SKEW = 1.25;

/** Recorded run time in ms of each test file, keyed by its repository-relative path. */
export type ShardTimings = Record<string, number>;

function weigher(timings: ShardTimings): (file: string) => number {
  const known = Object.values(timings).sort((a, b) => a - b);
  // A file with no recorded time yet (a new test) counts as a typical one
  const median = known.length > 0 ? known[Math.floor(known.length / 2)] : 0;
  return (file) => (timings[file] ?? median) + FILE_SETUP_MS;
}

/**
 * Splits test files into `count` shards of about equal run time: slowest first, each into the
 * shard with the least time so far. The result depends only on the inputs, never on their order,
 * so every shard process computes the same split.
 */
export function assignShards(files: string[], timings: ShardTimings, count: number): string[][] {
  const weight = weigher(timings);
  const ordered = [...new Set(files)].sort(
    (a, b) => weight(b) - weight(a) || (a < b ? -1 : a > b ? 1 : 0),
  );
  const shards = Array.from({ length: count }, () => ({ files: [] as string[], load: 0 }));
  for (const file of ordered) {
    const lightest = shards.reduce((min, shard) => (shard.load < min.load ? shard : min));
    lightest.files.push(file);
    lightest.load += weight(file);
  }
  return shards.map((shard) => shard.files);
}

/** Run time in ms of each shard, by the given timings. */
export function shardLoads(shards: string[][], timings: ShardTimings): number[] {
  const weight = weigher(timings);
  return shards.map((files) => files.reduce((sum, file) => sum + weight(file), 0));
}

function readTimings(): ShardTimings {
  if (!fs.existsSync(TIMINGS_PATH)) return {};
  return JSON.parse(fs.readFileSync(TIMINGS_PATH, 'utf8')) as ShardTimings;
}

function relativeTestPath(root: string, file: string): string {
  return path.relative(root, file).split(path.sep).join('/');
}

/** Per-file run times from a vitest JSON report (`--reporter=json`). */
export function reportTimings(report: string, root: string): ShardTimings {
  const { testResults } = JSON.parse(report) as {
    testResults: { name: string; startTime: number; endTime: number }[];
  };
  const timings: ShardTimings = {};
  for (const result of testResults) {
    timings[relativeTestPath(root, result.name)] = Math.round(result.endTime - result.startTime);
  }
  return timings;
}

/**
 * Shards by recorded run time (`tests/shard-timings.json`) instead of by path hash, which gives
 * every shard the same number of files however slow they are.
 */
export class ShardSequencer extends BaseSequencer {
  async shard(files: TestSpecification[]): Promise<TestSpecification[]> {
    const { root, shard } = this.ctx.config;
    if (!shard) return files;
    const keyOf = (spec: TestSpecification) => relativeTestPath(root, spec.moduleId);
    const mine = new Set(
      assignShards(files.map(keyOf), readTimings(), shard.count)[shard.index - 1],
    );
    return files.filter((spec) => mine.has(keyOf(spec)));
  }
}

function writeTimings(timings: ShardTimings): void {
  const sorted = Object.fromEntries(Object.entries(timings).sort(([a], [b]) => (a < b ? -1 : 1)));
  fs.writeFileSync(TIMINGS_PATH, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log(`Wrote ${Object.keys(sorted).length} test file timings to tests/shard-timings.json`);
}

/** Warns (GitHub annotation) when the split from the committed timings ran unevenly. */
function checkBalance(fresh: ShardTimings, count: number): void {
  const loads = shardLoads(assignShards(Object.keys(fresh), readTimings(), count), fresh);
  const mean = loads.reduce((sum, load) => sum + load, 0) / count;
  const slowest = Math.max(...loads);
  console.log(`Shard run times (s): ${loads.map((load) => (load / 1000).toFixed(1)).join(', ')}`);
  if (slowest > mean * MAX_SHARD_SKEW) {
    console.log(
      `::warning title=Unbalanced test shards::The slowest shard runs ${Math.round((slowest / mean - 1) * 100)}% past the average. Run \`npm run test:timings\` and commit tests/shard-timings.json.`,
    );
  }
}

function main(): void {
  const [mode, reportPath, count] = process.argv.slice(2);
  if (!reportPath || !(mode === 'write' || (mode === 'check' && Number(count) > 0))) {
    console.error(
      'Usage: tsx tools/test-shards.ts write <vitest-json-report>\n' +
        '       tsx tools/test-shards.ts check <vitest-json-report> <shard-count>',
    );
    process.exit(1);
  }
  const fresh = reportTimings(fs.readFileSync(reportPath, 'utf8'), REPO_ROOT);
  if (mode === 'write') writeTimings(fresh);
  else checkBalance(fresh, Number(count));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
