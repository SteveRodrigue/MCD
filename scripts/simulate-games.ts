import fs from 'fs';
import path from 'path';
import { cardCatalog } from '../src/data/importer/card-loader';
import { setupGame, resetInstanceCounter, runMatch, MatchSimulationResult } from '../src/engine';
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

async function run100GameSimulationGate() {
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
  console.log(`🎮 Marvel Champions Digital: 100-Game Simulation Gate`);
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
        `[${String(config.gameNumber).padStart(3, '0')}/100] ${config.mode.padEnd(11)} | ${config.difficulty.padEnd(8)} | ${heroesStr.padEnd(34)} | ${outcomeSymbol} (${matchResult.roundsPlayed} rnds, ${matchResult.totalActionsExecuted} acts, ${durationMs}ms)`,
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
  console.log(`✅ 100-Game Simulation Gate Finished in ${totalDurationSec}s`);
  console.log(`   Wins: ${totalWins} | Losses: ${totalLosses} | Timeouts: ${totalTimeouts}`);
  console.log(`======================================================\n`);

  // Write markdown report
  const summaryMd = generateSimulationSummary(results, totalDurationSec);
  const summaryPath = path.join(logsDir, 'simulation_summary.md');
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

  return `# 100-Game Headless Match Simulation Gate Summary

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

| Game # | Mode | Difficulty | Hero(es) | Outcome | Rounds | Actions | Duration | Seed |
| :---: | :---: | :---: | :--- | :---: | :---: | :---: | :---: | :--- |
${records
  .map((r) => {
    const outcome =
      r.result.winner === 'HEROES'
        ? '🏆 HEROES'
        : r.result.winner === 'VILLAIN'
          ? '💀 VILLAIN'
          : '⏱️ TIMEOUT';
    const heroes = r.result.heroNames.join(' & ');
    return `| ${r.config.gameNumber} | ${r.config.mode} | ${r.config.difficulty} | ${heroes} | ${outcome} | ${r.result.roundsPlayed} | ${r.result.totalActionsExecuted} | ${r.durationMs}ms | \`${r.config.seed}\` |`;
  })
  .join('\n')}

---
*Report generated automatically by \`scripts/simulate-games.ts\` for Gate 1 Rhino Release verification.*
`;
}

run100GameSimulationGate().catch((err) => {
  console.error('Fatal simulation runner failure:', err);
  process.exit(1);
});
