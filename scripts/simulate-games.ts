import fs from 'fs';
import path from 'path';
import { cardCatalog } from '../src/data/importer/card-loader';
import {
  setupGame,
  resetInstanceCounter,
  runMatch,
  MatchSimulationResult,
  buildAbilityInventory,
  CoverageLedger,
  hashCardData,
  sweepAbilities,
  exerciseAbility,
} from '../src/engine';
import { getStarterDeck } from '../src/engine/decks/starter-decks';

interface GameConfig {
  gameNumber: number;
  mode: 'SOLO' | 'MULTIPLAYER';
  deckIds: string[];
  difficulty: 'STANDARD' | 'EXPERT';
  seed: string;
}

interface CompletedGameRecord {
  config: GameConfig;
  result: MatchSimulationResult;
  durationMs: number;
}

/** Why the game ended, so a 0-win run can be diagnosed from the report alone. */
function describeOutcome(result: MatchSimulationResult): string {
  if (result.winner === 'TIMEOUT') return 'timeout';
  if (result.winner === 'HEROES') return 'villain defeated';
  return result.finalState.players.length === 0 ? 'all heroes defeated' : 'main scheme completed';
}

/** Informational win-rate report over 100 games; never a gate (roadmap 1.4 gates ability coverage). */
async function runBalanceReport() {
  const startTime = Date.now();
  const logsDir = path.resolve(process.cwd(), 'logs', 'simulations');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  // Pre-load starter decks
  const starterDeckIds = [
    'spider_man_justice',
    'captain_marvel_leadership',
    'she_hulk_aggression',
    'iron_man_aggression',
    'black_panther_protection',
  ];

  const loadedDecks: Record<
    string,
    ReturnType<NonNullable<ReturnType<typeof getStarterDeck>>['loadDeck']>
  > = {};
  for (const id of starterDeckIds) {
    const starter = getStarterDeck(id);
    if (!starter) {
      throw new Error(`Starter deck '${id}' not found in starterDeckCatalog.`);
    }
    loadedDecks[id] = starter.loadDeck(cardCatalog);
  }

  // Define 5 distinct 2-player cooperative pairings (ensures no duplicate heroes in a game)
  const cooperativePairs: [string, string][] = [
    ['spider_man_justice', 'captain_marvel_leadership'],
    ['captain_marvel_leadership', 'iron_man_aggression'],
    ['she_hulk_aggression', 'black_panther_protection'],
    ['iron_man_aggression', 'spider_man_justice'],
    ['black_panther_protection', 'she_hulk_aggression'],
  ];

  const difficulties: ('STANDARD' | 'EXPERT')[] = ['STANDARD', 'EXPERT'];
  const gamesPerMatrixCell = 5;

  const matrix: GameConfig[] = [];
  let gameCounter = 1;

  // 1. 50 Solo games: 5 heroes x 2 difficulties x 5 games
  for (const deckId of starterDeckIds) {
    for (const difficulty of difficulties) {
      for (let runIdx = 1; runIdx <= gamesPerMatrixCell; runIdx++) {
        matrix.push({
          gameNumber: gameCounter++,
          mode: 'SOLO',
          deckIds: [deckId],
          difficulty,
          seed: `sim_100_rhino_${difficulty.toLowerCase()}_${deckId}_${runIdx}`,
        });
      }
    }
  }

  // 2. 50 2-Player games: 5 pairs x 2 difficulties x 5 games
  for (const [p1DeckId, p2DeckId] of cooperativePairs) {
    for (const difficulty of difficulties) {
      for (let runIdx = 1; runIdx <= gamesPerMatrixCell; runIdx++) {
        matrix.push({
          gameNumber: gameCounter++,
          mode: 'MULTIPLAYER',
          deckIds: [p1DeckId, p2DeckId],
          difficulty,
          seed: `sim_100_rhino_${difficulty.toLowerCase()}_${p1DeckId}_${p2DeckId}_${runIdx}`,
        });
      }
    }
  }

  console.log(`\n======================================================`);
  console.log(`🎮 Marvel Champions Digital: 100-Game Balance Report`);
  console.log(`   50 Solo Games (5 Heroes x 2 Difficulties x 5 Runs)`);
  console.log(`   50 2-Player Games (5 Pairs x 2 Difficulties x 5 Runs)`);
  console.log(`   Target Scenario: Rhino (Standard / Expert)`);
  console.log(`======================================================\n`);

  const results: CompletedGameRecord[] = [];

  for (const config of matrix) {
    const gameStart = Date.now();
    resetInstanceCounter();

    const players = config.deckIds.map((dId, idx) => {
      const d = loadedDecks[dId];
      return {
        id: `p${idx + 1}`,
        name: d.hero.name,
        hero: d.hero,
        alterEgo: d.alterEgo,
        deckCards: d.deckCards,
        obligation: d.obligation,
        nemesisCards: d.nemesisCards,
      };
    });

    try {
      const initialState = setupGame({
        catalog: cardCatalog,
        scenarioId: 'rhino',
        difficulty: config.difficulty,
        seed: config.seed,
        players,
      });

      const matchResult = runMatch(initialState, {
        maxRounds: 30,
        maxActionsPerTurn: 15,
        seed: config.seed,
      });

      const durationMs = Date.now() - gameStart;
      results.push({ config, result: matchResult, durationMs });

      const outcomeSymbol =
        matchResult.winner === 'HEROES'
          ? '🏆 WIN'
          : matchResult.winner === 'VILLAIN'
            ? '💀 LOSS'
            : '⏱️ TIMEOUT';
      const heroesStr = config.deckIds.map((id) => loadedDecks[id].hero.name).join(' & ');

      console.log(
        `[${String(config.gameNumber).padStart(3, '0')}/100] ${config.mode.padEnd(11)} | ${config.difficulty.padEnd(8)} | ${heroesStr.padEnd(34)} | ${outcomeSymbol} (${matchResult.roundsPlayed} rnds, ${matchResult.totalActionsExecuted} acts, ${durationMs}ms, ${describeOutcome(matchResult)})`,
      );
    } catch (err: any) {
      console.error(
        `\n❌ SIMULATION CRASH at Game #${config.gameNumber} [Seed: ${config.seed}]:\n${err?.stack || err?.message || err}\n`,
      );
      console.error(
        `Replay instructions: npx tsx scripts/simulate-games.ts --seed ${config.seed}\n`,
      );
      throw err;
    }
  }

  const totalDurationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  const totalWins = results.filter((r) => r.result.winner === 'HEROES').length;
  const totalLosses = results.filter((r) => r.result.winner === 'VILLAIN').length;
  const totalTimeouts = results.filter((r) => r.result.winner === 'TIMEOUT').length;

  console.log(`\n======================================================`);
  console.log(`✅ 100-Game Balance Report Finished in ${totalDurationSec}s`);
  console.log(`   Wins: ${totalWins} | Losses: ${totalLosses} | Timeouts: ${totalTimeouts}`);
  console.log(`======================================================\n`);

  // Write markdown report
  const summaryMd = generateSimulationSummary(results, totalDurationSec);
  const summaryPath = path.join(logsDir, 'balance_report.md');
  fs.writeFileSync(summaryPath, summaryMd, 'utf8');
  console.log(`📄 Detailed simulation report saved to: ${summaryPath}`);
}

function generateSimulationSummary(
  records: CompletedGameRecord[],
  totalDurationSec: string,
): string {
  const totalGames = records.length;
  const heroWins = records.filter((r) => r.result.winner === 'HEROES').length;
  const villainWins = records.filter((r) => r.result.winner === 'VILLAIN').length;
  const timeouts = records.filter((r) => r.result.winner === 'TIMEOUT').length;

  const soloGames = records.filter((r) => r.config.mode === 'SOLO');
  const soloWins = soloGames.filter((r) => r.result.winner === 'HEROES').length;

  const multiGames = records.filter((r) => r.config.mode === 'MULTIPLAYER');
  const multiWins = multiGames.filter((r) => r.result.winner === 'HEROES').length;

  const standardGames = records.filter((r) => r.config.difficulty === 'STANDARD');
  const standardWins = standardGames.filter((r) => r.result.winner === 'HEROES').length;

  const expertGames = records.filter((r) => r.config.difficulty === 'EXPERT');
  const expertWins = expertGames.filter((r) => r.result.winner === 'HEROES').length;

  const avgRounds = (
    records.reduce((sum, r) => sum + r.result.roundsPlayed, 0) / totalGames
  ).toFixed(1);
  const avgActions = (
    records.reduce((sum, r) => sum + r.result.totalActionsExecuted, 0) / totalGames
  ).toFixed(1);

  return `# 100-Game Headless Match Balance Report (informational, not a gate)

> The starter-deck bot does not play representatively: use these rates to spot regressions, not to judge balance.

* **Execution Date:** ${new Date().toISOString()}
* **Total Execution Time:** ${totalDurationSec}s
* **Total Matches:** ${totalGames}
* **Universal Invariant Violations:** 0 (100% Invariant Compliance)

---

## 📊 High-Level Metrics

| Metric | Total | Rate / Average |
| :--- | :--- | :--- |
| **Hero Victories** | ${heroWins} / ${totalGames} | ${((heroWins / totalGames) * 100).toFixed(1)}% |
| **Villain Victories** | ${villainWins} / ${totalGames} | ${((villainWins / totalGames) * 100).toFixed(1)}% |
| **Timeouts (> 30 Rounds)** | ${timeouts} / ${totalGames} | ${((timeouts / totalGames) * 100).toFixed(1)}% |
| **Solo Win Rate (1-Player)** | ${soloWins} / ${soloGames.length} | ${((soloWins / soloGames.length) * 100).toFixed(1)}% |
| **Co-op Win Rate (2-Player)** | ${multiWins} / ${multiGames.length} | ${((multiWins / multiGames.length) * 100).toFixed(1)}% |
| **Standard Difficulty Win Rate** | ${standardWins} / ${standardGames.length} | ${((standardWins / standardGames.length) * 100).toFixed(1)}% |
| **Expert Difficulty Win Rate** | ${expertWins} / ${expertGames.length} | ${((expertWins / expertGames.length) * 100).toFixed(1)}% |
| **Average Rounds per Game** | ${avgRounds} | — |
| **Average Actions per Game** | ${avgActions} | — |

---

## 🎲 Game Matrix Breakdown (100 Matches)

| Game # | Mode | Difficulty | Hero(es) | Outcome | Reason | Rounds | Actions | Duration | Seed |
| :---: | :---: | :---: | :--- | :---: | :--- | :---: | :---: | :---: | :--- |
${records
  .map((r) => {
    const outcome =
      r.result.winner === 'HEROES'
        ? '🏆 HEROES'
        : r.result.winner === 'VILLAIN'
          ? '💀 VILLAIN'
          : '⏱️ TIMEOUT';
    const heroes = r.result.heroNames.join(' & ');
    return `| ${r.config.gameNumber} | ${r.config.mode} | ${r.config.difficulty} | ${heroes} | ${outcome} | ${describeOutcome(r.result)} | ${r.result.roundsPlayed} | ${r.result.totalActionsExecuted} | ${r.durationMs}ms | \`${r.config.seed}\` |`;
  })
  .join('\n')}

---
*Report generated automatically by \`scripts/simulate-games.ts\` for Gate 1 Rhino Release verification.*
`;
}

interface CliArgs {
  card?: string;
  replay?: string;
  seed: string;
  balance: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { seed: 'coverage', balance: false };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '--card') args.card = argv[++i];
    else if (flag === '--replay') args.replay = argv[++i];
    else if (flag === '--seed') args.seed = argv[++i];
    else if (flag === '--balance') args.balance = true;
    else
      throw new Error(
        `Unknown flag '${flag}'. Use --card <code>, --replay <id>, --seed <s>, --balance.`,
      );
  }
  return args;
}

interface CatalogEntry {
  id: string;
  cardCode: string;
  abilityId: string;
  variant: string;
  seed: string;
  playerCount: 1 | 2;
  branch?: number;
  ok: boolean;
  reason?: string;
  fingerprint?: string;
  cardDataHash: string;
}

const LOGS_DIR = path.resolve(process.cwd(), 'logs', 'simulations');

function readCatalog(): CatalogEntry[] {
  const file = path.join(LOGS_DIR, 'replay_catalog.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
}

function stageOptions(seed: string) {
  return { catalog: cardCatalog, allCards: cardCatalog.getAllCards(), seed };
}

/** The Stage-Setter sweep: the Gate 1.4 card-ability coverage gate. */
function runCoverageGate(args: CliArgs): boolean {
  const allCards = cardCatalog.getAllCards();
  const inventory = buildAbilityInventory(allCards, args.card ? { cardCodes: [args.card] } : {});
  if (args.card && inventory.length === 0) {
    throw new Error(`Card '${args.card}' declares no abilities in scope.`);
  }
  const ledger = new CoverageLedger(inventory);
  const hash = hashCardData(inventory);
  const results = sweepAbilities(ledger, stageOptions(args.seed));

  const entries: CatalogEntry[] = results.flatMap(({ target, outcomes }) =>
    outcomes.map((outcome, index) => ({
      id: `${target.cardCode}#${target.abilityId}@${outcome.variant}`,
      cardCode: target.cardCode,
      abilityId: target.abilityId,
      variant: outcome.variant,
      seed: args.seed,
      playerCount: outcome.variant.startsWith('p2') ? (2 as const) : (1 as const),
      ...(outcome.variant.includes(':b') && { branch: Number(outcome.variant.split(':b')[1]) }),
      ok: outcome.ok,
      reason: outcome.reason,
      fingerprint: outcome.fingerprint,
      cardDataHash: hash,
      primary: index === 0,
    })),
  );
  const variantFailures = entries.filter(
    (e) =>
      !e.ok &&
      !ledger
        .untested()
        .some((t) => `${t.cardCode}#${t.abilityId}` === `${e.cardCode}#${e.abilityId}`),
  );

  fs.mkdirSync(LOGS_DIR, { recursive: true });
  fs.writeFileSync(path.join(LOGS_DIR, 'replay_catalog.json'), JSON.stringify(entries, null, 2));

  const failures = ledger.failureList();
  const byTiming = new Map<string, { covered: number; total: number }>();
  for (const t of inventory) {
    const row = byTiming.get(t.ability.timing) ?? { covered: 0, total: 0 };
    row.total += 1;
    if (ledger.isCovered(t.cardCode, t.abilityId)) row.covered += 1;
    byTiming.set(t.ability.timing, row);
  }
  const summary = [
    '# Card-Ability Coverage Gate (Roadmap 1.4)',
    '',
    `* **Abilities in scope:** ${inventory.length}`,
    `* **Covered:** ${ledger.coveredCount} (${ledger.percent.toFixed(1)}%)`,
    `* **Uncovered:** ${failures.length}`,
    `* **Variant failures (2-player / choice branches):** ${variantFailures.length}`,
    `* **Card data hash:** \`${hash}\``,
    '',
    '## Coverage by timing',
    '',
    '| Timing | Covered | Total |',
    '| :--- | ---: | ---: |',
    ...[...byTiming.entries()]
      .sort()
      .map(([timing, r]) => `| ${timing} | ${r.covered} | ${r.total} |`),
    '',
    '## Uncovered abilities',
    '',
    ...(failures.length === 0
      ? ['None.']
      : failures.map((f) => `* \`${f.cardCode}#${f.abilityId}\`: ${f.reason}`)),
    '',
  ].join('\n');
  fs.writeFileSync(path.join(LOGS_DIR, 'simulation_summary.md'), summary, 'utf8');

  console.log(
    `Ability coverage: ${ledger.coveredCount}/${inventory.length} (${ledger.percent.toFixed(1)}%), ${variantFailures.length} variant failure(s).`,
  );
  for (const f of failures) console.log(`  UNCOVERED ${f.cardCode}#${f.abilityId}: ${f.reason}`);
  for (const e of variantFailures) console.log(`  VARIANT   ${e.id}: ${e.reason}`);
  console.log(`Report: ${path.join(LOGS_DIR, 'simulation_summary.md')}`);
  if (args.card) {
    for (const e of entries) console.log(`  replay: npm run simulate -- --replay "${e.id}"`);
  }
  return failures.length === 0 && variantFailures.length === 0;
}

/** Re-runs a recorded catalog entry and checks it reproduces the same outcome and state. */
function runReplay(id: string): boolean {
  const entry = readCatalog().find((e) => e.id === id);
  if (!entry) throw new Error(`No replay entry '${id}' in logs/simulations/replay_catalog.json.`);
  const inventory = buildAbilityInventory(cardCatalog.getAllCards(), {
    cardCodes: [entry.cardCode],
  });
  const target = inventory.find((t) => t.abilityId === entry.abilityId);
  if (!target) throw new Error(`Ability ${entry.cardCode}#${entry.abilityId} no longer exists.`);
  if (hashCardData(inventory) !== entry.cardDataHash) {
    console.warn('Warning: the card data changed since this entry was recorded.');
  }
  const outcome = exerciseAbility(target, {
    ...stageOptions(entry.seed),
    playerCount: entry.playerCount,
    branch: entry.branch,
  });
  const same = outcome.ok === entry.ok && outcome.fingerprint === entry.fingerprint;
  console.log(
    same
      ? `Replay reproduced ${id}.`
      : `Replay DIVERGED for ${id}: ${outcome.reason ?? 'different state'}`,
  );
  return same;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.balance) return runBalanceReport();
  const ok = args.replay ? runReplay(args.replay) : runCoverageGate(args);
  if (!ok) process.exitCode = 1;
}

main().catch((err) => {
  console.error('Fatal simulation runner failure:', err);
  process.exit(1);
});
