import fs from 'fs';
import path from 'path';
import { CardCatalog } from '../src/data/importer/card-loader';
import {
  setupGame,
  resetInstanceCounter,
  runMatch,
  VillainCard,
  MainSchemeCard,
} from '../src/engine';

import corePack from '../data/upstream/pack/core.json';
import coreEncounterPack from '../data/upstream/pack/core_encounter.json';

async function runAndLogSimulations() {
  const catalog = new CardCatalog([...corePack, ...coreEncounterPack]);

  const logsDir = path.resolve(process.cwd(), 'logs', 'simulations');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  // Clean legacy simulation-game-*.md files if any
  for (let i = 1; i <= 10; i++) {
    const legacy = path.join(logsDir, `simulation-game-${i}.md`);
    if (fs.existsSync(legacy)) {
      fs.unlinkSync(legacy);
    }
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
  const rhinoCards = catalog.getCardsBySet('rhino').filter((c) => c.type !== 'villain' && c.type !== 'main_scheme');
  const standardCards = catalog.getCardsBySet('standard');
  const bombScareCards = catalog.getCardsBySet('bomb_scare');
  const encounterCards = [...rhinoCards, ...standardCards, ...bombScareCards].flatMap((c) =>
    Array(c.quantity).fill(c)
  );

  const rhino = catalog.getCard('01094') as VillainCard; // Rhino I
  const breakIn = catalog.getCard('01097b') as MainSchemeCard; // The Break-In!

  const numGames = 3;
  const matchResults = [];
  const batchTimestamp = Date.now();

  console.log(`\n🎲 Running ${numGames} End-to-End Match Simulations (Spider-Man vs. Rhino)...`);

  for (let gameIdx = 1; gameIdx <= numGames; gameIdx++) {
    resetInstanceCounter();
    const matchId = `match_${batchTimestamp}_${gameIdx}`;
    const isoTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `game_${isoTimestamp}_${matchId}.md`;

    const initialState = setupGame({
      id: matchId,
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
    matchResults.push({ gameIdx, matchId, fileName, result });

    // Generate Markdown Log
    const markdown = generateMatchMarkdown(matchId, result);
    const filePath = path.join(logsDir, fileName);
    fs.writeFileSync(filePath, markdown, 'utf8');

    const outcomeText =
      result.winner === 'HEROES'
        ? '🏆 HERO VICTORY'
        : result.finalState.mainScheme.threat >= result.finalState.mainScheme.targetThreat
          ? '💀 HERO DEFEAT (Scheme Overwhelmed)'
          : '💀 HERO DEFEAT (Knocked Out)';

    console.log(
      `  ✓ Match [${matchId}]: ${outcomeText} in ${result.roundsPlayed} Rounds (Hero HP: ${result.finalState.players[0].health}/10, Rhino HP: ${result.finalState.villain.health}/14, Threat: ${result.finalState.mainScheme.threat}/${result.finalState.mainScheme.targetThreat})`
    );
  }

  // Update Global Summary Markdown with all historical games
  const summaryMarkdown = generateSummaryMarkdown(logsDir, matchResults);
  fs.writeFileSync(path.join(logsDir, 'SUMMARY.md'), summaryMarkdown, 'utf8');

  console.log(`\n📄 Simulation logs written without overwriting to:`);
  console.log(`   - Index: ${path.join(logsDir, 'SUMMARY.md')}`);
  for (const m of matchResults) {
    console.log(`   - ${path.join(logsDir, m.fileName)}`);
  }
}

function generateSummaryMarkdown(logsDir: string, currentBatchResults: any[]): string {
  const allFiles = fs.readdirSync(logsDir).filter((f) => f.startsWith('game_') && f.endsWith('.md'));
  
  return `# Marvel Champions Match Simulator — History & Execution Index

**Last Batch Run:** ${new Date().toISOString()}  
**Scenario:** Rhino (Stage I) — *The Break-In!*  
**Modular Set:** Bomb Scare  
**Hero:** Spider-Man (Justice Aspect, 40-Card Deck)

---

## 🎮 Match Logs Index (${allFiles.length} Total Matches Recorded)

| Match File | Timestamp / ID | Winner | Loss / Win Condition | Rounds | Final Hero HP | Final Rhino HP | Final Threat |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
${currentBatchResults
  .map((m) => {
    const outcome =
      m.result.winner === 'HEROES'
        ? '🏆 **HERO VICTORY**'
        : '💀 **HERO DEFEAT**';
    const condition =
      m.result.winner === 'HEROES'
        ? 'Rhino HP reduced to 0'
        : m.result.finalState.mainScheme.threat >= m.result.finalState.mainScheme.targetThreat
          ? 'Scheme reached limit (7)'
          : 'Hero HP reduced to 0';

    return `| [${m.fileName}](./${m.fileName}) | \`${m.matchId}\` | ${outcome} | ${condition} | ${m.result.roundsPlayed} | ${m.result.finalState.players[0].health}/10 | ${m.result.finalState.villain.health}/14 | ${m.result.finalState.mainScheme.threat}/${m.result.finalState.mainScheme.targetThreat} |`;
  })
  .join('\n')}

---

*Logs are preserved with immutable \`game_{timestamp}_{id}.md\` naming (ADR-0009).*
`;
}

function generateMatchMarkdown(matchId: string, result: any): string {
  const { finalState, roundsPlayed, winner } = result;
  const player = finalState.players[0];

  const outcomeTitle =
    winner === 'HEROES'
      ? '🏆 HERO VICTORY (Rhino HP reduced to 0)'
      : finalState.mainScheme.threat >= finalState.mainScheme.targetThreat
        ? `💀 HERO DEFEAT (Scheme Overwhelmed: Threat ${finalState.mainScheme.threat}/${finalState.mainScheme.targetThreat})`
        : `💀 HERO DEFEAT (Hero Knocked Out: 0 HP)`;

  // Group events chronologically
  const formattedLogs: string[] = [];
  let currentRound = 0;

  for (let i = 0; i < finalState.log.length; i++) {
    const entry = finalState.log[i];
    if (entry.key === 'phase.player_phase.start') {
      currentRound = entry.params?.round || currentRound + 1;
      formattedLogs.push(`\n### 🔄 Round ${currentRound}`);
      formattedLogs.push(`#### 🦸 Player Phase`);
    } else if (entry.key === 'phase.villain_phase.start') {
      formattedLogs.push(`\n#### 🦏 Villain Phase`);
    }

    if (entry.key === 'card.state.exhausted' || entry.key.startsWith('card.effect.')) {
      const omo = entry.onomatopoeia ? ` **[${entry.onomatopoeia}]**` : '';
      const paramsStr = entry.params ? ` \`${JSON.stringify(entry.params)}\`` : '';
      formattedLogs.push(`\n   ↳ \`${entry.key}\`${omo}${paramsStr}\n`);
    } else {
      const omo = entry.onomatopoeia ? ` **[${entry.onomatopoeia}]**` : '';
      const paramsStr = entry.params ? ` \`${JSON.stringify(entry.params)}\`` : '';
      formattedLogs.push(`${i + 1}. \`${entry.key}\`${omo}${paramsStr}`);
    }
  }

  return `# Match Simulation Report — \`${matchId}\`

* **Match ID:** \`${matchId}\`
* **Timestamp:** ${new Date().toISOString()}
* **Hero:** Spider-Man (Peter Parker) — Justice Aspect (10 Max HP)
* **Villain:** Rhino (Stage I — 14 Max HP)
* **Main Scheme:** The Break-In! (Target: 7 Threat)
* **Modular Set:** Bomb Scare
* **Final Outcome:** **${outcomeTitle}**
* **Duration:** ${roundsPlayed} Rounds
* **Final Hero HP:** ${player.health} / ${player.maxHealth}
* **Final Rhino HP:** ${finalState.villain.health} / ${finalState.villain.maxHealth}
* **Final Scheme Threat:** ${finalState.mainScheme.threat} / ${finalState.mainScheme.targetThreat}

---

## 📋 Full Game Action & Event Log

${formattedLogs.join('\n')}

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

*Report automatically generated by MCD Autonomous Engine Simulator (ADR-0008, ADR-0009, RR v1.8).*
`;
}

runAndLogSimulations().catch(console.error);
