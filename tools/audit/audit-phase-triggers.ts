import fs from 'fs';
import path from 'path';

interface UpstreamCard {
  code: string;
  name: string;
  type_code: string;
  pack_code: string;
  text?: string;
}

const UPSTREAM_PACK_DIR = './data/upstream/pack';
const files = fs.readdirSync(UPSTREAM_PACK_DIR).filter((f) => f.endsWith('.json'));

interface MatchRecord {
  code: string;
  name: string;
  type: string;
  pack: string;
  matchedCategory: string;
  text: string;
}

const startMatches: MatchRecord[] = [];
const endMatches: MatchRecord[] = [];
const durationMatches: MatchRecord[] = [];
const otherMatches: MatchRecord[] = [];

for (const file of files) {
  const filePath = path.join(UPSTREAM_PACK_DIR, file);
  try {
    const cards: UpstreamCard[] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    for (const card of cards) {
      if (!card.text) continue;
      const lower = card.text.toLowerCase();
      if (!lower.includes('phase')) continue;

      const cleanText = card.text.replace(/(\r\n|\n|\r)/gm, ' ');

      if (
        lower.includes('start of the phase') ||
        lower.includes('start of a phase') ||
        lower.includes('start of each phase') ||
        lower.includes('start of the player phase') ||
        lower.includes('start of the villain phase') ||
        lower.includes('start of next phase') ||
        lower.includes('start of the next phase') ||
        lower.includes('phase begins') ||
        lower.includes('phase start') ||
        lower.includes('phase starts') ||
        lower.includes('at the start of')
      ) {
        startMatches.push({
          code: card.code,
          name: card.name,
          type: card.type_code,
          pack: card.pack_code,
          matchedCategory: 'Start/Begin Triggers',
          text: cleanText,
        });
      } else if (
        lower.includes('end of the phase') ||
        lower.includes('end of the player phase') ||
        lower.includes('end of the villain phase') ||
        lower.includes('end of this phase') ||
        lower.includes('phase ends')
      ) {
        endMatches.push({
          code: card.code,
          name: card.name,
          type: card.type_code,
          pack: card.pack_code,
          matchedCategory: 'End/Expiration Triggers & Durations',
          text: cleanText,
        });
      } else if (
        lower.includes('during the player phase') ||
        lower.includes('during the villain phase') ||
        lower.includes('player phase') ||
        lower.includes('villain phase')
      ) {
        durationMatches.push({
          code: card.code,
          name: card.name,
          type: card.type_code,
          pack: card.pack_code,
          matchedCategory: 'Phase Action Restrictions',
          text: cleanText,
        });
      } else {
        otherMatches.push({
          code: card.code,
          name: card.name,
          type: card.type_code,
          pack: card.pack_code,
          matchedCategory: 'Other Phase Mention',
          text: cleanText,
        });
      }
    }
  } catch (err) {
    console.error(`Error reading ${file}:`, err);
  }
}

console.log(`=== AUDIT SUMMARY: ALL 120 UPSTREAM PACKS ===`);
console.log(
  `Total Cards containing "phase": ${startMatches.length + endMatches.length + durationMatches.length + otherMatches.length}`,
);
console.log(`1. Phase Start / Begin Triggers: ${startMatches.length}`);
console.log(`2. Phase End / Expiration:       ${endMatches.length}`);
console.log(`3. Phase Action Restrictions:    ${durationMatches.length}`);
console.log(`4. Other Phase Mentions:         ${otherMatches.length}`);

console.log('\n=============================================');
console.log('CATEGORY 1: Phase Start / Begin Triggers Breakdown');
console.log('=============================================');
const villainPhaseStarts = startMatches.filter((m) =>
  m.text.toLowerCase().includes('villain phase'),
);
const playerPhaseStarts = startMatches.filter((m) => m.text.toLowerCase().includes('player phase'));
const otherStarts = startMatches.filter(
  (m) =>
    !m.text.toLowerCase().includes('villain phase') &&
    !m.text.toLowerCase().includes('player phase'),
);

console.log(`- Specifically "Villain Phase Begins": ${villainPhaseStarts.length}`);
console.log(`- Specifically "Player Phase Begins":  ${playerPhaseStarts.length}`);
console.log(`- Generic "Phase Begins / Starts":     ${otherStarts.length}`);

console.log('\n=============================================');
console.log('CATEGORY 2: Phase End Triggers vs Durations');
console.log('=============================================');
const endTriggers = endMatches.filter(
  (m) => m.text.includes('Response') || m.text.includes('Interrupt'),
);
const endDurations = endMatches.filter(
  (m) => !m.text.includes('Response') && !m.text.includes('Interrupt'),
);
console.log(`- Reactive Triggers ("When/After the phase ends"): ${endTriggers.length}`);
for (const m of endTriggers) {
  console.log(`  [${m.code}] ${m.name}: ${m.text}`);
}
console.log(
  `- Passive Expiration Durations ("until the end of the phase"): ${endDurations.length}`,
);
