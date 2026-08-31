import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../');

const SUPPLEMENTAL_DIR = path.join(ROOT_DIR, 'src/data/supplemental/pack');
const UPSTREAM_DIR = path.join(ROOT_DIR, 'data/upstream/pack');
const OUTPUT_REPORT_PATH = path.join(ROOT_DIR, 'docs/reports/supplemental_declarations_usage_report.md');

interface CardAudit {
  createdAt?: string;
  updatedAt?: string;
  reviewedAt?: string;
  confidence?: number;
  reviewedBy?: string;
  reconstructedText?: string;
  ambiguityFile?: string;
}

interface CardAbility {
  id?: string;
  timing?: string;
  trigger?: string;
  cost?: Record<string, any>;
  effect?: string;
  params?: Record<string, any>;
  sequence?: CardAbility[];
  maxPerRound?: number;
  errata?: string | null;
}

interface SupplementalEntry {
  comment?: string;
  abilities?: CardAbility[];
  audit?: CardAudit;
  mechanicSteps?: string[];
}

interface UpstreamCard {
  code: string;
  name: string;
  type_code: string;
  faction_code: string;
  pack_code: string;
  text?: string;
}

interface UsageOccurrence {
  code: string;
  cardName: string;
  pack: string;
  abilityId: string;
}

function loadAllUpstreamCards(): Map<string, UpstreamCard> {
  const map = new Map<string, UpstreamCard>();
  if (!fs.existsSync(UPSTREAM_DIR)) return map;

  const files = fs.readdirSync(UPSTREAM_DIR).filter((f) => f.endsWith('.json'));
  for (const file of files) {
    try {
      const content = JSON.parse(fs.readFileSync(path.join(UPSTREAM_DIR, file), 'utf-8'));
      if (Array.isArray(content)) {
        for (const card of content) {
          if (card && card.code) {
            map.set(card.code, card);
          }
        }
      }
    } catch (e) {
      console.warn(`Warning: Failed to parse upstream file ${file}:`, e);
    }
  }
  return map;
}

function loadAllSupplementalPacks(): Map<string, Record<string, SupplementalEntry>> {
  const packs = new Map<string, Record<string, SupplementalEntry>>();
  if (!fs.existsSync(SUPPLEMENTAL_DIR)) return packs;

  const files = fs.readdirSync(SUPPLEMENTAL_DIR).filter((f) => f.endsWith('.json'));
  for (const file of files) {
    const packName = file.replace('.json', '');
    try {
      const content = JSON.parse(fs.readFileSync(path.join(SUPPLEMENTAL_DIR, file), 'utf-8'));
      const cards = (content && content.cards) ? content.cards : content;
      packs.set(packName, cards);
    } catch (e) {
      console.warn(`Warning: Failed to parse supplemental pack ${file}:`, e);
    }
  }
  return packs;
}

export function runDeclarationsAudit() {
  const upstreamCards = loadAllUpstreamCards();
  const supplementalPacks = loadAllSupplementalPacks();

  const effectsUsage = new Map<string, UsageOccurrence[]>();
  const triggersUsage = new Map<string, UsageOccurrence[]>();
  const timingsUsage = new Map<string, UsageOccurrence[]>();
  const targetsUsage = new Map<string, UsageOccurrence[]>();
  const costsUsage = new Map<string, UsageOccurrence[]>();
  const scalingUsage = new Map<string, UsageOccurrence[]>();

  let totalCardsInSupplemental = 0;
  let totalCardsWithAbilities = 0;
  let totalCardsBlocked = 0;
  let totalAbilitiesDeclared = 0;

  function recordUsage(map: Map<string, UsageOccurrence[]>, key: string, occ: UsageOccurrence) {
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(occ);
  }

  function processAbility(ability: CardAbility, code: string, cardName: string, pack: string) {
    totalAbilitiesDeclared += 1;
    const abilityId = ability.id || 'unnamed_ability';
    const occ: UsageOccurrence = { code, cardName, pack, abilityId };

    if (ability.timing) recordUsage(timingsUsage, ability.timing, occ);
    if (ability.trigger) recordUsage(triggersUsage, ability.trigger, occ);
    if (ability.effect) recordUsage(effectsUsage, ability.effect, occ);

    if (ability.cost) {
      for (const costKey of Object.keys(ability.cost)) {
        recordUsage(costsUsage, costKey, occ);
      }
    }

    if (ability.params) {
      if (ability.params.target) recordUsage(targetsUsage, String(ability.params.target), occ);
      if (ability.params.scaling) recordUsage(scalingUsage, String(ability.params.scaling), occ);
    }

    if (Array.isArray(ability.sequence)) {
      for (const subAbility of ability.sequence) {
        processAbility(subAbility, code, cardName, pack);
      }
    }
  }

  for (const [packName, entries] of supplementalPacks.entries()) {
    for (const [code, entry] of Object.entries(entries)) {
      totalCardsInSupplemental += 1;
      const upstream = upstreamCards.get(code);
      const cardName = upstream ? `${upstream.name} (${upstream.type_code})` : `Unknown Card #${code}`;

      if (entry.audit?.ambiguityFile) {
        totalCardsBlocked += 1;
      }

      if (entry.abilities && entry.abilities.length > 0) {
        totalCardsWithAbilities += 1;
        for (const ability of entry.abilities) {
          processAbility(ability, code, cardName, packName);
        }
      }
    }
  }

  // Known schema specifications to check for zero-usage primitives
  const knownSpecEffects = [
    'DEAL_DAMAGE',
    'REMOVE_THREAT',
    'DRAW_CARDS',
    'READY_CHARACTER',
    'EXHAUST_CHARACTER',
    'HEAL_DAMAGE',
    'MODIFY_HAND_SIZE',
    'PLAYER_CHOICE',
    'CHANGE_FORM_DRAW_TO_HAND_SIZE',
    'SEARCH_AND_DRAW',
    'SPAWN_NEMESIS',
    'VILLAIN_SCHEMES',
    'VILLAIN_ATTACKS',
    'ALLY_LIMIT_BONUS',
    'CONFUSE_TARGET',
    'STUN_TARGET',
    'GIVE_TOUGH_STATUS',
    'DISCARD_ATTACHMENT',
    'DISCARD_SELF',
    'PREVENT_DAMAGE',
    'REDISTRIBUTE_DAMAGE',
    'MODIFY_STAT',
    'ADD_THREAT_PER_PLAYER',
    'DEAL_INDIRECT_DAMAGE',
    'PLAY_FROM_ZONE',
  ];

  const knownSpecTriggers = [
    'WHEN_REVEALED',
    'BOOST_STAR_RESOLVED',
    'VILLAIN_INITIATES_ATTACK',
    'TAKE_ATTACK_DAMAGE',
    'TAKE_DAMAGE',
    'CARD_PLAYED',
    'PLAYED',
    'MINION_DEFEATED',
    'MINION_DEFEATED_BY_ATTACK',
    'ENEMY_DEFEATED_BY_HERO_ATTACK',
    'MINION_ENTERS_PLAY',
    'TREACHERY_REVEALED',
    'ATTACHED_MINION_DEFEATED',
    'ATTACHED_ENEMY_ATTACKS',
    'THREAT_WOULD_BE_PLACED',
    'MAIN_SCHEME_ADVANCED',
    'FORM_CHANGED_TO_HERO',
    'FORM_CHANGED_TO_ALTER_EGO',
    'BASIC_ATTACK_PERFORMED',
    'HERO_DEFENDED_ATTACK',
    'ATTACK_RESOLVED',
    'THWART_RESOLVED',
    'RESOURCE_SPENT',
    'MINION_ATTACKED',
    'ATTACK',
    'ROUND_BEGAN',
    'ROUND_ENDED',
    'ROUND_END',
    'PLAYER_PHASE_BEGAN',
    'PLAYER_PHASE_ENDED',
    'VILLAIN_PHASE_BEGAN',
    'VILLAIN_PHASE_ENDED',
    'DEFEATED',
    'DAMAGE_TAKEN',
    'THREAT_PLACED',
    'HERO_FLIPPED',
    'PHASE_START',
  ];

  // Markdown Report Generator
  const reportLines: string[] = [];
  const timestamp = new Date().toISOString();

  reportLines.push(`# Supplemental Card Declarations Usage & Impact Report`);
  reportLines.push(``);
  reportLines.push(`> **Generated:** \`${timestamp}\`  `);
  reportLines.push(`> **Source Packs Scanned:** \`${Array.from(supplementalPacks.keys()).join(', ')}\``);
  reportLines.push(``);
  reportLines.push(`---`);
  reportLines.push(``);
  reportLines.push(`## 📊 1. Executive Summary`);
  reportLines.push(``);
  reportLines.push(`| Metric | Count | Description |`);
  reportLines.push(`| :--- | :--- | :--- |`);
  reportLines.push(`| **Total Cards Registered** | **${totalCardsInSupplemental}** | Total cards present in \`src/data/supplemental/\` |`);
  reportLines.push(`| **Active Declared Cards** | **${totalCardsWithAbilities}** | Cards with executable \`abilities: [...]\` |`);
  reportLines.push(`| **Blocked / Ambiguity Cards** | **${totalCardsBlocked}** | Cards isolated in \`docs/ambiguities/\` |`);
  reportLines.push(`| **Total Abilities Declared** | **${totalAbilitiesDeclared}** | Total individual ability definitions declared |`);
  reportLines.push(`| **Unique Effects In Use** | **${effectsUsage.size}** | Distinct effect primitive types actively declared |`);
  reportLines.push(`| **Unique Triggers In Use** | **${triggersUsage.size}** | Distinct trigger window types actively declared |`);
  reportLines.push(`| **Unique Timings In Use** | **${timingsUsage.size}** | Distinct timing categories actively declared |`);
  reportLines.push(`| **Unique Cost Keys In Use** | **${costsUsage.size}** | Distinct ability cost types actively declared |`);
  reportLines.push(``);
  reportLines.push(`---`);
  reportLines.push(``);
  reportLines.push(`## 💥 2. High-Impact Primitives (Blast-Radius $\\ge 5$ Cards)`);
  reportLines.push(``);
  reportLines.push(`Changing these primitives will affect many cards across the entire game engine:`);
  reportLines.push(``);
  reportLines.push(`| Category | Primitive Name | Card Count | Example Cards |`);
  reportLines.push(`| :--- | :--- | :--- | :--- |`);

  function formatExamples(occurrences: UsageOccurrence[], max: number = 3): string {
    const uniqueCards = Array.from(new Set(occurrences.map((o) => `\`${o.code}\` ${o.cardName}`)));
    const sample = uniqueCards.slice(0, max).join(', ');
    return uniqueCards.length > max ? `${sample} *(+${uniqueCards.length - max} more)*` : sample;
  }

  const highImpactEffects = Array.from(effectsUsage.entries())
    .filter(([_, list]) => list.length >= 5)
    .sort((a, b) => b[1].length - a[1].length);

  for (const [effect, list] of highImpactEffects) {
    reportLines.push(`| **Effect** | \`${effect}\` | **${list.length}** | ${formatExamples(list)} |`);
  }

  const highImpactTriggers = Array.from(triggersUsage.entries())
    .filter(([_, list]) => list.length >= 5)
    .sort((a, b) => b[1].length - a[1].length);

  for (const [trigger, list] of highImpactTriggers) {
    reportLines.push(`| **Trigger** | \`${trigger}\` | **${list.length}** | ${formatExamples(list)} |`);
  }

  reportLines.push(``);
  reportLines.push(`---`);
  reportLines.push(``);
  reportLines.push(`## 🔍 3. Single-Use & Unique Primitives (Card Count = 1)`);
  reportLines.push(``);
  reportLines.push(`These primitives are only declared on a single card. They represent high specialization and are prime candidates for decomposition into composable generic primitives:`);
  reportLines.push(``);
  reportLines.push(`| Category | Primitive Name | Card Code | Card Name & Pack | Ability ID |`);
  reportLines.push(`| :--- | :--- | :--- | :--- | :--- |`);

  const singleUseEffects = Array.from(effectsUsage.entries())
    .filter(([_, list]) => list.length === 1)
    .sort((a, b) => a[0].localeCompare(b[0]));

  for (const [effect, list] of singleUseEffects) {
    const item = list[0];
    reportLines.push(`| **Effect** | \`${effect}\` | \`${item.code}\` | ${item.cardName} (${item.pack}) | \`${item.abilityId}\` |`);
  }

  const singleUseTriggers = Array.from(triggersUsage.entries())
    .filter(([_, list]) => list.length === 1)
    .sort((a, b) => a[0].localeCompare(b[0]));

  for (const [trigger, list] of singleUseTriggers) {
    const item = list[0];
    reportLines.push(`| **Trigger** | \`${trigger}\` | \`${item.code}\` | ${item.cardName} (${item.pack}) | \`${item.abilityId}\` |`);
  }

  reportLines.push(``);
  reportLines.push(`---`);
  reportLines.push(``);
  reportLines.push(`## ⚠️ 4. Zero-Usage / Unused Primitives (In Specifications but 0 Card Declarations)`);
  reportLines.push(``);
  reportLines.push(`These primitives are declared in schema types or specifications but have **0 active card declarations** in supplemental data packs:`);
  reportLines.push(``);
  reportLines.push(`| Category | Specified Primitive | Status | Notes |`);
  reportLines.push(`| :--- | :--- | :--- | :--- |`);

  for (const specEffect of knownSpecEffects) {
    if (!effectsUsage.has(specEffect)) {
      reportLines.push(`| **Effect** | \`${specEffect}\` | 🟡 \`0 Cards\` | Defined in schema/specifications; no supplemental card currently declares this effect. |`);
    }
  }

  for (const specTrigger of knownSpecTriggers) {
    if (!triggersUsage.has(specTrigger)) {
      reportLines.push(`| **Trigger** | \`${specTrigger}\` | 🟡 \`0 Cards\` | Defined in schema/specifications; no supplemental card currently declares this trigger. |`);
    }
  }

  reportLines.push(``);
  reportLines.push(`---`);
  reportLines.push(``);
  reportLines.push(`## 📑 5. Complete Effects Inventory`);
  reportLines.push(``);
  reportLines.push(`| Effect Primitive | Occurrences | Declaring Cards |`);
  reportLines.push(`| :--- | :--- | :--- |`);

  const allEffectsSorted = Array.from(effectsUsage.entries()).sort((a, b) => b[1].length - a[1].length);
  for (const [effect, list] of allEffectsSorted) {
    const cards = Array.from(new Set(list.map((o) => `\`${o.code}\` (${o.cardName})`))).join(', ');
    reportLines.push(`| \`${effect}\` | **${list.length}** | ${cards} |`);
  }

  reportLines.push(``);
  reportLines.push(`---`);
  reportLines.push(``);
  reportLines.push(`## ⏱️ 6. Complete Triggers Inventory`);
  reportLines.push(``);
  reportLines.push(`| Trigger Window | Occurrences | Declaring Cards |`);
  reportLines.push(`| :--- | :--- | :--- |`);

  const allTriggersSorted = Array.from(triggersUsage.entries()).sort((a, b) => b[1].length - a[1].length);
  for (const [trigger, list] of allTriggersSorted) {
    const cards = Array.from(new Set(list.map((o) => `\`${o.code}\` (${o.cardName})`))).join(', ');
    reportLines.push(`| \`${trigger}\` | **${list.length}** | ${cards} |`);
  }

  reportLines.push(``);
  reportLines.push(`---`);
  reportLines.push(``);
  reportLines.push(`## 🎯 7. Timings, Costs & Target Selectors Inventory`);
  reportLines.push(``);
  reportLines.push(`### Ability Timings:`);
  reportLines.push(`| Timing | Occurrences | Cards |`);
  reportLines.push(`| :--- | :--- | :--- |`);
  for (const [timing, list] of Array.from(timingsUsage.entries()).sort((a, b) => b[1].length - a[1].length)) {
    reportLines.push(`| \`${timing}\` | **${list.length}** | ${formatExamples(list, 5)} |`);
  }

  reportLines.push(``);
  reportLines.push(`### Cost Primitives:`);
  reportLines.push(`| Cost Key | Occurrences | Cards |`);
  reportLines.push(`| :--- | :--- | :--- |`);
  for (const [cost, list] of Array.from(costsUsage.entries()).sort((a, b) => b[1].length - a[1].length)) {
    reportLines.push(`| \`${cost}\` | **${list.length}** | ${formatExamples(list, 5)} |`);
  }

  reportLines.push(``);
  reportLines.push(`### Target Selectors:`);
  reportLines.push(`| Target Selector | Occurrences | Cards |`);
  reportLines.push(`| :--- | :--- | :--- |`);
  for (const [target, list] of Array.from(targetsUsage.entries()).sort((a, b) => b[1].length - a[1].length)) {
    reportLines.push(`| \`${target}\` | **${list.length}** | ${formatExamples(list, 5)} |`);
  }

  // Ensure docs/reports directory exists
  const reportsDir = path.dirname(OUTPUT_REPORT_PATH);
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_REPORT_PATH, reportLines.join('\n'), 'utf-8');

  console.log(`\n========================================================`);
  console.log(`📊 SUPPLEMENTAL DECLARATIONS USAGE AUDIT COMPLETE`);
  console.log(`========================================================`);
  console.log(`Total Cards Scanned:      ${totalCardsInSupplemental}`);
  console.log(`Cards with Abilities:     ${totalCardsWithAbilities}`);
  console.log(`Blocked (Ambiguity):      ${totalCardsBlocked}`);
  console.log(`Total Abilities Declared: ${totalAbilitiesDeclared}`);
  console.log(`Unique Effect Types:      ${effectsUsage.size}`);
  console.log(`Unique Trigger Types:     ${triggersUsage.size}`);
  console.log(`High-Impact Effects (>=5):${highImpactEffects.length}`);
  console.log(`Single-Use Effects (=1):  ${singleUseEffects.length}`);
  console.log(`Report Written To:        ${OUTPUT_REPORT_PATH}`);
  console.log(`========================================================\n`);
}

// Execute if run directly via tsx / node
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runDeclarationsAudit();
}
