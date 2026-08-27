import fs from 'fs';
import path from 'path';
import { CardCatalog } from '../src/data/importer/card-loader';
import {
  setupGame,
  resetInstanceCounter,
  runMatch,
  VillainCard,
  MainSchemeCard,
  HeroCard,
  AlterEgoCard,
} from '../src/engine';

import corePack from '../data/upstream/pack/core.json';
import coreEncounterPack from '../data/upstream/pack/core_encounter.json';

async function runAndLogSimulations() {
  const catalog = new CardCatalog([...corePack, ...coreEncounterPack]);

  const logsDir = path.resolve(process.cwd(), 'logs', 'simulations');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  // Load Cards for Learn to Play Scenario
  const identity = catalog.getHeroIdentity('spider_man')!;
  const signatureCards = catalog.getCardsBySet('spider_man').flatMap((c) => {
    if (c.type === 'hero' || c.type === 'alter_ego') return [];
    return Array(c.quantity).fill(c);
  });
  const justiceCards = catalog.getCardsByFaction('justice' as any).flatMap((c) => Array(c.quantity).fill(c));
  const basicCards = catalog.getCardsByFaction('basic' as any).flatMap((c) => Array(c.quantity).fill(c));
  const deckCards = [...signatureCards, ...justiceCards, ...basicCards].slice(0, 40);

  // Encounter Deck: Rhino + Standard + Bomb Scare
  const rhinoCards = catalog.getCardsBySet('rhino').filter((c) => c.type !== 'villain');
  const standardCards = catalog.getCardsBySet('standard');
  const bombScareCards = catalog.getCardsBySet('bomb_scare');
  const encounterCards = [...rhinoCards, ...standardCards, ...bombScareCards].flatMap((c) =>
    Array(c.quantity).fill(c)
  );

  const rhino = catalog.getCard('01094') as VillainCard; // Rhino I
  const breakIn = catalog.getCard('01097b') as MainSchemeCard; // The Break-In!

  const numGames = 3;
  const matchResults = [];

  console.log(`\n🎲 Running ${numGames} End-to-End Match Simulations (Spider-Man vs. Rhino)...`);

  for (let gameIdx = 1; gameIdx <= numGames; gameIdx++) {
    resetInstanceCounter();
    const initialState = setupGame({
      id: `match_sim_${gameIdx}`,
      players: [
        {
          id: 'player_1',
          name: 'Peter Parker / Spider-Man',
          hero: identity.hero,
          alterEgo: identity.alterEgo,
          deckCards,
        },
      ],
      villain: rhino,
      mainScheme: breakIn,
      encounterCards,
    });

    const result = runMatch(initialState, { maxRounds: 25 });
    matchResults.push({ gameIdx, result });

    // Generate Markdown Log
    const markdown = generateMatchMarkdown(gameIdx, result);
    const filePath = path.join(logsDir, `simulation-game-${gameIdx}.md`);
    fs.writeFileSync(filePath, markdown, 'utf8');

    console.log(
      `  ✓ Game ${gameIdx}: Winner = ${result.winner} in ${result.roundsPlayed} Rounds (Hero HP: ${result.finalState.players[0].health}, Rhino HP: ${result.finalState.villain.health}, Threat: ${result.finalState.mainScheme.threat}/${result.finalState.mainScheme.targetThreat})`
    );
  }

  // Generate Global Summary Markdown
  const summaryMarkdown = generateSummaryMarkdown(matchResults);
  fs.writeFileSync(path.join(logsDir, 'SUMMARY.md'), summaryMarkdown, 'utf8');

  console.log(`\n📄 Simulation logs successfully written to:`);
  console.log(`   - ${path.join(logsDir, 'SUMMARY.md')}`);
  for (let i = 1; i <= numGames; i++) {
    console.log(`   - ${path.join(logsDir, `simulation-game-${i}.md`)}`);
  }
}

function generateSummaryMarkdown(matchResults: any[]): string {
  const totalGames = matchResults.length;
  const heroWins = matchResults.filter((m) => m.result.winner === 'HEROES').length;
  const villainWins = matchResults.filter((m) => m.result.winner === 'VILLAIN').length;
  const avgRounds = (
    matchResults.reduce((acc, m) => acc + m.result.roundsPlayed, 0) / totalGames
  ).toFixed(1);

  return `# Marvel Champions Match Simulator — Batch Execution Summary

**Generated:** ${new Date().toISOString()}  
**Scenario:** Rhino (Stage I) — *The Break-In!*  
**Modular Set:** Bomb Scare  
**Hero:** Spider-Man (Justice Aspect, 40-Card Deck)

---

## 📊 High-Level Metrics

| Metric | Result |
| :--- | :--- |
| **Total Matches Simulated** | ${totalGames} |
| **Hero Win Rate** | **${((heroWins / totalGames) * 100).toFixed(0)}%** (${heroWins}/${totalGames}) |
| **Villain Win Rate** | **${((villainWins / totalGames) * 100).toFixed(0)}%** (${villainWins}/${totalGames}) |
| **Average Game Duration** | ${avgRounds} Rounds |

---

## 🎮 Match Breakdown

| Match | Winner | Rounds | Final Hero HP | Final Rhino HP | Final Threat | Detailed Log |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
${matchResults
  .map(
    (m) =>
      `| Game #${m.gameIdx} | **${m.result.winner === 'HEROES' ? '🏆 HEROES' : '💀 VILLAIN'}** | ${m.result.roundsPlayed} | ${m.result.finalState.players[0].health}/10 | ${m.result.finalState.villain.health}/14 | ${m.result.finalState.mainScheme.threat}/${m.result.finalState.mainScheme.targetThreat} | [simulation-game-${m.gameIdx}.md](./simulation-game-${m.gameIdx}.md) |`
  )
  .join('\n')}

---

*Generated by MCD Automated Match Engine (Rules Reference v1.8).*
`;
}

function generateMatchMarkdown(gameIdx: number, result: any): string {
  const { finalState, roundsPlayed, winner } = result;
  const player = finalState.players[0];

  return `# Match Simulation Report — Game #${gameIdx}

* **Hero:** Spider-Man (Peter Parker) — Justice Aspect
* **Villain:** Rhino (Stage I — 14 HP)
* **Main Scheme:** The Break-In! (Target: 7 Threat)
* **Modular Set:** Bomb Scare
* **Outcome:** **${winner === 'HEROES' ? '🏆 HERO VICTORY' : '💀 VILLAIN DEFEAT'}**
* **Duration:** ${roundsPlayed} Rounds
* **Final Hero HP:** ${player.health} / ${player.maxHealth}
* **Final Rhino HP:** ${finalState.villain.health} / ${finalState.villain.maxHealth}
* **Final Scheme Threat:** ${finalState.mainScheme.threat} / ${finalState.mainScheme.targetThreat}

---

## 📋 Full Game Action & Event Log

${finalState.log
  .map((entry: any, i: number) => {
    const omo = entry.onomatopoeia ? ` **[${entry.onomatopoeia}]**` : '';
    const paramsStr = entry.params ? ` \`${JSON.stringify(entry.params)}\`` : '';
    return `${i + 1}. \`${entry.key}\`${omo}${paramsStr}`;
  })
  .join('\n')}

---

## 🃏 Final End-Game Board State

### 🦸 Hero Status
* **Identity:** ${player.name} (${player.currentForm.toUpperCase()})
* **Hit Points:** ${player.health} / ${player.maxHealth}
* **Status Cards:** ${player.statusCards.length ? player.statusCards.join(', ') : 'None'}
* **Hand Size:** ${player.hand.length} cards
* **Tableau (In-Play):** ${player.tableau.map((c: any) => `${c.card.name}`).join(', ') || 'None'}
* **Allies in Play:** ${player.allies.map((a: any) => `${a.card.name} (${(a.card.health || 2) - (a.tokens?.damage || 0)} HP)`).join(', ') || 'None'}
* **Engaged Minions:** ${player.engagedMinions.map((m: any) => `${m.card.name} (${m.card.health} HP)`).join(', ') || 'None'}
* **Cards Remaining in Deck:** ${player.deck.length}
* **Discard Pile:** ${player.discard.length} cards

### 🦏 Villain & Scheme Status
* **Villain:** ${finalState.villain.card.name} (${finalState.villain.health} / ${finalState.villain.maxHealth} HP)
* **Status Cards:** ${finalState.villain.statusCards.length ? finalState.villain.statusCards.join(', ') : 'None'}
* **Attachments:** ${finalState.villain.attachments.map((a: any) => a.card.name).join(', ') || 'None'}
* **Main Scheme:** ${finalState.mainScheme.card.name} (${finalState.mainScheme.threat} / ${finalState.mainScheme.targetThreat} Threat)
* **Active Side Schemes:** ${finalState.sideSchemes.map((s: any) => `${s.card.name} (${s.threat} Threat)`).join(', ') || 'None'}
* **Encounter Deck Remaining:** ${finalState.encounterDeck.length} cards
* **Encounter Discard:** ${finalState.encounterDiscard.length} cards

---

*Report automatically generated by MCD Autonomous Engine Simulator (ADR-0008, RR v1.8).*
`;
}

runAndLogSimulations().catch(console.error);
