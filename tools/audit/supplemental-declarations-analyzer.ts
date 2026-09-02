import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TriggerTypeSchema, TimingTypeSchema } from '../../src/data/supplemental/schema';
import { detectDuplicateJsonKeys } from '../../src/data/supplemental/duplicate-key-detector';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../');

const SUPPLEMENTAL_DIR = path.join(ROOT_DIR, 'src/data/supplemental/pack');
const UPSTREAM_DIR = path.join(ROOT_DIR, 'data/upstream/pack');
const SPECS_DIR = path.join(ROOT_DIR, 'docs/specifications/supplemental');
const AMBIGUITIES_DIR = path.join(ROOT_DIR, 'docs/ambiguities');
const OUTPUT_REPORT_PATH = path.join(
  ROOT_DIR,
  'docs/reports/supplemental_declarations_usage_report.md',
);

interface CardAudit {
  createdAt?: string;
  updatedAt?: string;
  reviewedAt?: string;
  confidence?: number;
  reviewedBy?: string;
  originalText?: string;
  reconstructedText?: string;
  ambiguityFile?: string;
}

interface AbilityStep {
  id?: string;
  effect?: string;
  gate?: string;
  params?: Record<string, unknown>;
  filter?: Record<string, unknown>;
}

interface CardAbility {
  id?: string;
  timing?: string;
  trigger?: string;
  limit?: string;
  cost?: Record<string, unknown>;
  maxPerRound?: number;
  errata?: string | null;
  steps?: AbilityStep[];
}

interface SupplementalEntry {
  noSupplementalNeeded?: boolean;
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

interface NoSupplementalCardInfo {
  code: string;
  name: string;
  type: string;
  faction: string;
  pack: string;
  comment: string;
}

interface AmbiguityReportInfo {
  filename: string;
  code: string;
  name: string;
  pack: string;
  confidence: number;
  blockerCategory: string;
}

interface FalseVanillaViolation {
  code: string;
  name: string;
  type: string;
  pack: string;
  printedText: string;
}

function hasActiveRulesText(text?: string): boolean {
  if (!text) return false;
  const stripped = text
    .replace(/<i>.*?<\/i>/gis, '')
    .replace(/<b>Contents<\/b>:.*?Setup:.*$/gis, '')
    .replace(/<b>If this stage is completed, the players lose the game\.<\/b>/gis, '')
    .replace(/Hazard icon/gis, '')
    .replace(/Acceleration icon/gis, '')
    .replace(/Crisis icon/gis, '')
    .replace(/Boost icon/gis, '')
    .trim();

  if (!stripped || stripped.length === 0) return false;

  const triggerPatterns = [
    /\bWhen Revealed\b/i,
    /\bWhen Defeated\b/i,
    /\bAction\b/i,
    /\bInterrupt\b/i,
    /\bResponse\b/i,
    /\bSpecial\b/i,
    /\bBoost\b/i,
    /\[star\]/i,
    /\bForced\b/i,
  ];
  return triggerPatterns.some((p) => p.test(stripped));
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
    const fullPath = path.join(SUPPLEMENTAL_DIR, file);
    const rawContent = fs.readFileSync(fullPath, 'utf-8');

    // Enforce raw JSON duplicate key check
    const duplicateKeys = detectDuplicateJsonKeys(rawContent);
    if (duplicateKeys.length > 0) {
      console.error(`\n❌ FATAL AUDIT ERROR: Duplicate keys found in ${file}:`);
      duplicateKeys.forEach((d) =>
        console.error(
          `  - Key "${d.key}" at line ${d.line} (previously defined at line ${d.firstSeenLine})`,
        ),
      );
      process.exit(1);
    }

    try {
      const content = JSON.parse(rawContent);
      const cards = content && content.cards ? content.cards : content;
      packs.set(packName, cards);
    } catch (e) {
      console.warn(`Warning: Failed to parse supplemental pack ${file}:`, e);
    }
  }
  return packs;
}

function loadAllAmbiguityReports(): Map<string, AmbiguityReportInfo> {
  const map = new Map<string, AmbiguityReportInfo>();
  if (!fs.existsSync(AMBIGUITIES_DIR)) return map;

  const files = fs
    .readdirSync(AMBIGUITIES_DIR)
    .filter((f) => f.endsWith('.md') && f !== 'README.md');
  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(AMBIGUITIES_DIR, file), 'utf-8');
      const codeMatch =
        content.match(/card_code:\s*["']?([0-9a-z_]+)["']?/i) ||
        file.match(/^[a-z]+_([0-9a-z]+)_/i);
      const nameMatch =
        content.match(/card_name:\s*["']?([^"'\r\n]+)["']?/i) ||
        content.match(/#\s*Card Ambiguity Report:\s*([^\r\n(#]+)/i);
      const packMatch =
        content.match(/pack:\s*["']?([^"'\r\n]+)["']?/i) || file.match(/^([a-z]+)_/i);
      const confMatch = content.match(/confidence_reached:\s*([0-9]+)/i);
      const blockerMatch = content.match(/blocker_category:\s*["']?([^"'\r\n]+)["']?/i);

      const code = codeMatch ? codeMatch[1] : file.replace('.md', '');
      const name = nameMatch ? nameMatch[1].trim() : 'Unknown';
      const pack = packMatch ? packMatch[1].trim() : 'core';
      const confidence = confMatch ? parseInt(confMatch[1], 10) : 70;
      const blockerCategory = blockerMatch ? blockerMatch[1].trim() : 'RULES_AMBIGUITY';

      map.set(code, {
        filename: file,
        code,
        name,
        pack,
        confidence,
        blockerCategory,
      });
    } catch (e) {
      console.warn(`Warning: Failed to parse ambiguity file ${file}:`, e);
    }
  }
  return map;
}

function discoverSpecifiedPrimitives(): { effects: Set<string>; triggers: Set<string> } {
  const effects = new Set<string>();
  const triggers = new Set<string>();

  // Add all triggers from Zod schema
  for (const option of TriggerTypeSchema.options) {
    triggers.add(option);
  }

  // Parse markdown spec files in docs/specifications/supplemental/
  if (fs.existsSync(SPECS_DIR)) {
    const specFiles = fs.readdirSync(SPECS_DIR).filter((f) => f.endsWith('.md'));
    for (const file of specFiles) {
      const content = fs.readFileSync(path.join(SPECS_DIR, file), 'utf-8');
      const matches = content.matchAll(/### `([A-Z0-9_]+)`/g);
      for (const m of matches) {
        if (m[1]) effects.add(m[1]);
      }
    }
  }

  return { effects, triggers };
}

export function runDeclarationsAudit() {
  const upstreamCards = loadAllUpstreamCards();
  const supplementalPacks = loadAllSupplementalPacks();
  const ambiguityReports = loadAllAmbiguityReports();
  const { effects: specifiedEffects, triggers: specifiedTriggers } = discoverSpecifiedPrimitives();

  const effectsUsage = new Map<string, UsageOccurrence[]>();
  const triggersUsage = new Map<string, UsageOccurrence[]>();
  const timingsUsage = new Map<string, UsageOccurrence[]>();
  const targetsUsage = new Map<string, UsageOccurrence[]>();
  const costsUsage = new Map<string, UsageOccurrence[]>();
  const scalingUsage = new Map<string, UsageOccurrence[]>();

  const noSupplementalCards: NoSupplementalCardInfo[] = [];
  const falseVanillaViolations: FalseVanillaViolation[] = [];
  const multiAbilityCards: {
    code: string;
    name: string;
    type: string;
    pack: string;
    abilitiesCount: number;
    abilities: { id: string; timing: string; trigger?: string; stepsCount: number }[];
  }[] = [];

  let totalCardsInSupplemental = 0;
  let totalCardsWithAbilities = 0;
  let totalAbilitiesDeclared = 0;
  let totalSingleStepAbilities = 0;
  let totalMultiStepAbilities = 0;
  let totalCardsWithMultiStep = 0;

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

    if (ability.cost) {
      for (const costKey of Object.keys(ability.cost)) {
        recordUsage(costsUsage, costKey, occ);
      }
    }

    if (Array.isArray(ability.steps)) {
      if (ability.steps.length === 1) {
        totalSingleStepAbilities += 1;
      } else if (ability.steps.length >= 2) {
        totalMultiStepAbilities += 1;
      }

      for (const step of ability.steps) {
        if (step.effect) recordUsage(effectsUsage, step.effect, occ);
        if (step.params) {
          if (step.params.target) recordUsage(targetsUsage, String(step.params.target), occ);
          if (step.params.scaling) recordUsage(scalingUsage, String(step.params.scaling), occ);
        }
      }
    }
  }

  for (const [packName, entries] of supplementalPacks.entries()) {
    for (const [code, entry] of Object.entries(entries)) {
      totalCardsInSupplemental += 1;
      const upstream = upstreamCards.get(code);
      const cardName = upstream
        ? `${upstream.name} (${upstream.type_code})`
        : `Unknown Card #${code}`;

      if (entry.noSupplementalNeeded) {
        // Quality Gate Check: Does this card actually have rules text?
        if (upstream && hasActiveRulesText(upstream.text)) {
          falseVanillaViolations.push({
            code,
            name: upstream.name,
            type: upstream.type_code,
            pack: packName,
            printedText: upstream.text || '',
          });
        }

        noSupplementalCards.push({
          code,
          name: upstream ? upstream.name : 'Unknown',
          type: upstream ? upstream.type_code : 'Unknown',
          faction: upstream ? upstream.faction_code : 'Unknown',
          pack: packName,
          comment: (
            entry.comment ||
            entry.audit?.reconstructedText ||
            'No abilities required (Vanilla / Base Stats / Standard Resource)'
          )
            .replace(/\r?\n|\r/g, ' ')
            .replace(/\s+/g, ' ')
            .trim(),
        });
      }

      if (entry.abilities && entry.abilities.length > 0) {
        totalCardsWithAbilities += 1;
        let cardHasMultiStep = false;

        for (const ability of entry.abilities) {
          if (Array.isArray(ability.steps) && ability.steps.length >= 2) {
            cardHasMultiStep = true;
          }
          processAbility(ability, code, cardName, packName);
        }

        if (cardHasMultiStep) {
          totalCardsWithMultiStep += 1;
        }

        if (entry.abilities.length > 1) {
          multiAbilityCards.push({
            code,
            name: upstream ? upstream.name : 'Unknown',
            type: upstream ? upstream.type_code : 'Unknown',
            pack: packName,
            abilitiesCount: entry.abilities.length,
            abilities: entry.abilities.map((ab) => ({
              id: ab.id || 'unnamed_ability',
              timing: ab.timing || 'ACTION',
              trigger: ab.trigger,
              stepsCount: Array.isArray(ab.steps) ? ab.steps.length : 0,
            })),
          });
        }
      }
    }
  }

  // Markdown Report Generator
  const reportLines: string[] = [];
  const timestamp = new Date().toISOString();

  reportLines.push(`# Supplemental Card Declarations Usage & Impact Report`);
  reportLines.push(``);
  reportLines.push(`> **Generated:** \`${timestamp}\`  `);
  reportLines.push(
    `> **Source Packs Scanned:** \`${Array.from(supplementalPacks.keys()).join(', ')}\``,
  );
  reportLines.push(``);
  reportLines.push(`---`);
  reportLines.push(``);
  reportLines.push(`## 📊 1. Executive Summary`);
  reportLines.push(``);
  reportLines.push(`| Metric | Count | Description |`);
  reportLines.push(`| :--- | :--- | :--- |`);
  reportLines.push(
    `| **Total Cards Registered** | **${totalCardsInSupplemental}** | Total cards present in \`src/data/supplemental/\` |`,
  );
  reportLines.push(
    `| **Active Declared Cards** | **${totalCardsWithAbilities}** | Cards with executable \`abilities: [...]\` |`,
  );
  reportLines.push(
    `| **No Supplemental Needed** | **${noSupplementalCards.length}** | Vanilla / passive cards explicitly verified as requiring no supplemental hooks |`,
  );
  reportLines.push(
    `| **Open Ambiguity Reports** | **${ambiguityReports.size}** | Blocked cards isolated in \`docs/ambiguities/\` (Inbox Zero Queue) |`,
  );
  reportLines.push(
    `| **False-Vanilla Violations** | **${falseVanillaViolations.length}** | 🚨 Cards marked \`noSupplementalNeeded\` that have printed rules text |`,
  );
  reportLines.push(
    `| **Total Abilities Declared** | **${totalAbilitiesDeclared}** | Total individual ability definitions declared |`,
  );
  reportLines.push(
    `| **Single-Step Abilities (1 Step)** | **${totalSingleStepAbilities}** | Abilities with exactly 1 atomic execution step |`,
  );
  reportLines.push(
    `| **Multi-Step Abilities (2+ Steps)** | **${totalMultiStepAbilities}** | Abilities decomposed into sequenced execution pipelines |`,
  );
  reportLines.push(
    `| **Cards with Multi-Step Sequences** | **${totalCardsWithMultiStep}** | Cards containing at least 1 ability with 2+ steps |`,
  );
  reportLines.push(
    `| **Cards with Multiple Abilities (2+)** | **${multiAbilityCards.length}** | Cards declaring more than 1 distinct ability header |`,
  );
  reportLines.push(
    `| **Unique Effects In Use** | **${effectsUsage.size}** | Distinct effect primitive types actively declared |`,
  );
  reportLines.push(
    `| **Unique Triggers In Use** | **${triggersUsage.size}** | Distinct trigger window types actively declared |`,
  );
  reportLines.push(
    `| **Unique Timings In Use** | **${timingsUsage.size}** | Distinct timing categories actively declared |`,
  );
  reportLines.push(
    `| **Unique Cost Keys In Use** | **${costsUsage.size}** | Distinct ability cost types actively declared |`,
  );
  reportLines.push(``);

  if (falseVanillaViolations.length > 0) {
    reportLines.push(`---`);
    reportLines.push(``);
    reportLines.push(`## 🚨 2. False-Vanilla Violations (Immediate Action Required)`);
    reportLines.push(``);
    reportLines.push(
      `The following **${falseVanillaViolations.length} cards** are marked \`"noSupplementalNeeded": true\`, but have active printed rules text in \`data/upstream/\`! Per Step 3 of the Card Integration Protocol, they must be converted to active abilities or isolated in \`docs/ambiguities/\`:`,
    );
    reportLines.push(``);
    reportLines.push(`| Card Code | Card Name | Type | Pack | Printed Rules Text |`);
    reportLines.push(`| :--- | :--- | :--- | :--- | :--- |`);
    for (const v of falseVanillaViolations) {
      const cleanText = v.printedText
        .replace(/\r?\n|\r/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      reportLines.push(
        `| \`${v.code}\` | **${v.name}** | \`${v.type}\` | \`${v.pack}\` | ${cleanText} |`,
      );
    }
    reportLines.push(``);
  }

  reportLines.push(`---`);
  reportLines.push(``);
  reportLines.push(
    `## 🔴 2. Active Ambiguity & Blocker Queue (Inbox Zero Queue — ${ambiguityReports.size} Cards)`,
  );
  reportLines.push(``);
  reportLines.push(
    `These **${ambiguityReports.size} cards** are currently isolated in [\`docs/ambiguities/\`](../ambiguities/README.md) pending rules engine primitives, targeting extensions, or nested resolution stack implementations. As each card is integrated and reaches $\\ge 95\\%$ confidence, its file is deleted to achieve **Inbox Zero**:`,
  );
  reportLines.push(``);
  reportLines.push(
    `| Card Code | Card Name | Pack | Confidence | Blocker Category | Ambiguity Report File |`,
  );
  reportLines.push(`| :--- | :--- | :--- | :--- | :--- | :--- |`);

  const sortedAmbiguities = Array.from(ambiguityReports.values()).sort((a, b) =>
    a.code.localeCompare(b.code, undefined, { numeric: true }),
  );
  for (const amb of sortedAmbiguities) {
    reportLines.push(
      `| \`${amb.code}\` | **${amb.name}** | \`${amb.pack}\` | \`${amb.confidence}%\` | \`${amb.blockerCategory}\` | [\`${amb.filename}\`](../ambiguities/${amb.filename}) |`,
    );
  }

  reportLines.push(``);
  reportLines.push(`---`);
  reportLines.push(``);
  reportLines.push(
    `## 🟢 3. Cards Explicitly Requiring No Supplemental Data (Vanilla / Passive — ${noSupplementalCards.length} Cards)`,
  );
  reportLines.push(``);
  reportLines.push(
    `These **${noSupplementalCards.length} cards** have been audited and explicitly verified as \`"noSupplementalNeeded": true\` (standard double resource generators, vanilla baseline minions, basic identity cards, or schemes with no custom trigger hooks):`,
  );
  reportLines.push(``);
  reportLines.push(
    `| Card Code | Card Name | Type | Faction / Aspect | Pack | Description / Comment |`,
  );
  reportLines.push(`| :--- | :--- | :--- | :--- | :--- | :--- |`);

  noSupplementalCards.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  for (const c of noSupplementalCards) {
    reportLines.push(
      `| \`${c.code}\` | **${c.name}** | \`${c.type}\` | \`${c.faction}\` | \`${c.pack}\` | ${c.comment} |`,
    );
  }

  reportLines.push(``);
  reportLines.push(`---`);
  reportLines.push(``);
  reportLines.push(
    `## 📋 4. Cards with Multiple Abilities (2+ Abilities Declared — ${multiAbilityCards.length} Cards)`,
  );
  reportLines.push(``);
  reportLines.push(
    `These **${multiAbilityCards.length} cards** declare multiple distinct ability headers (e.g. dual Hero/Alter-Ego actions, combined Constant modifiers with triggered Actions, or multiple Response triggers):`,
  );
  reportLines.push(``);
  reportLines.push(
    `| Card Code | Card Name | Type | Pack | Ability Count | Declared Abilities Summary |`,
  );
  reportLines.push(`| :--- | :--- | :--- | :--- | :--- | :--- |`);

  multiAbilityCards.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  for (const m of multiAbilityCards) {
    const abList = m.abilities
      .map((a) => {
        const triggerStr = a.trigger ? ` / \`${a.trigger}\`` : '';
        return `• \`${a.id}\` (\`${a.timing}\`${triggerStr}, **${a.stepsCount} step${a.stepsCount === 1 ? '' : 's'}**)`;
      })
      .join('<br/>');
    reportLines.push(
      `| \`${m.code}\` | **${m.name}** | \`${m.type}\` | \`${m.pack}\` | **${m.abilitiesCount}** | ${abList} |`,
    );
  }

  reportLines.push(``);
  reportLines.push(`---`);
  reportLines.push(``);
  reportLines.push(`## 💥 5. High-Impact Primitives (Blast-Radius $\\ge 5$ Cards)`);
  reportLines.push(``);
  reportLines.push(
    `Changing these primitives will affect many cards across the entire game engine:`,
  );
  reportLines.push(``);
  reportLines.push(`| Category | Primitive Name | Card Count | Example Cards |`);
  reportLines.push(`| :--- | :--- | :--- | :--- |`);

  function formatExamples(occurrences: UsageOccurrence[], max = 3): string {
    const uniqueCards = Array.from(new Set(occurrences.map((o) => `\`${o.code}\` ${o.cardName}`)));
    const sample = uniqueCards.slice(0, max).join(', ');
    return uniqueCards.length > max ? `${sample} *(+${uniqueCards.length - max} more)*` : sample;
  }

  const highImpactEffects = Array.from(effectsUsage.entries())
    .filter(([_, list]) => list.length >= 5)
    .sort((a, b) => b[1].length - a[1].length);

  for (const [effect, list] of highImpactEffects) {
    reportLines.push(
      `| **Effect** | \`${effect}\` | **${list.length}** | ${formatExamples(list)} |`,
    );
  }

  const highImpactTriggers = Array.from(triggersUsage.entries())
    .filter(([_, list]) => list.length >= 5)
    .sort((a, b) => b[1].length - a[1].length);

  for (const [trigger, list] of highImpactTriggers) {
    reportLines.push(
      `| **Trigger** | \`${trigger}\` | **${list.length}** | ${formatExamples(list)} |`,
    );
  }

  reportLines.push(``);
  reportLines.push(`---`);
  reportLines.push(``);
  reportLines.push(`## 🔍 6. Single-Use & Unique Primitives (Card Count = 1)`);
  reportLines.push(``);
  reportLines.push(
    `These primitives are only declared on a single card. They represent high specialization and are prime candidates for decomposition into composable generic primitives:`,
  );
  reportLines.push(``);
  reportLines.push(`| Category | Primitive Name | Card Code | Card Name & Pack | Ability ID |`);
  reportLines.push(`| :--- | :--- | :--- | :--- | :--- |`);

  const singleUseEffects = Array.from(effectsUsage.entries())
    .filter(([_, list]) => list.length === 1)
    .sort((a, b) => a[0].localeCompare(b[0]));

  for (const [effect, list] of singleUseEffects) {
    const item = list[0];
    reportLines.push(
      `| **Effect** | \`${effect}\` | \`${item.code}\` | ${item.cardName} (${item.pack}) | \`${item.abilityId}\` |`,
    );
  }

  const singleUseTriggers = Array.from(triggersUsage.entries())
    .filter(([_, list]) => list.length === 1)
    .sort((a, b) => a[0].localeCompare(b[0]));

  for (const [trigger, list] of singleUseTriggers) {
    const item = list[0];
    reportLines.push(
      `| **Trigger** | \`${trigger}\` | \`${item.code}\` | ${item.cardName} (${item.pack}) | \`${item.abilityId}\` |`,
    );
  }

  reportLines.push(``);
  reportLines.push(`---`);
  reportLines.push(``);
  reportLines.push(
    `## ⚠️ 7. Zero-Usage / Unused Primitives (In Specifications but 0 Card Declarations)`,
  );
  reportLines.push(``);
  reportLines.push(
    `These primitives are declared in schema types or specifications but have **0 active card declarations** in supplemental data packs:`,
  );
  reportLines.push(``);
  reportLines.push(`| Category | Specified Primitive | Status | Notes |`);
  reportLines.push(`| :--- | :--- | :--- | :--- |`);

  for (const specEffect of Array.from(specifiedEffects).sort()) {
    if (!effectsUsage.has(specEffect)) {
      reportLines.push(
        `| **Effect** | \`${specEffect}\` | 🟡 \`0 Cards\` | Documented in \`docs/specifications/supplemental/\` but has 0 card declarations. |`,
      );
    }
  }

  for (const specTrigger of Array.from(specifiedTriggers).sort()) {
    if (!triggersUsage.has(specTrigger)) {
      reportLines.push(
        `| **Trigger** | \`${specTrigger}\` | 🟡 \`0 Cards\` | Defined in \`TriggerTypeSchema\` but has 0 card declarations. |`,
      );
    }
  }

  reportLines.push(``);
  reportLines.push(`---`);
  reportLines.push(``);
  reportLines.push(`## 📑 8. Complete Effects Inventory`);
  reportLines.push(``);
  reportLines.push(`| Effect Primitive | Occurrences | Declaring Cards |`);
  reportLines.push(`| :--- | :--- | :--- |`);

  const allEffectsSorted = Array.from(effectsUsage.entries()).sort(
    (a, b) => b[1].length - a[1].length,
  );
  for (const [effect, list] of allEffectsSorted) {
    const cards = Array.from(new Set(list.map((o) => `\`${o.code}\` (${o.cardName})`))).join(', ');
    reportLines.push(`| \`${effect}\` | **${list.length}** | ${cards} |`);
  }

  reportLines.push(``);
  reportLines.push(`---`);
  reportLines.push(``);
  reportLines.push(`## ⏱️ 9. Complete Triggers Inventory`);
  reportLines.push(``);
  reportLines.push(`| Trigger Window | Occurrences | Declaring Cards |`);
  reportLines.push(`| :--- | :--- | :--- |`);

  const allTriggersSorted = Array.from(triggersUsage.entries()).sort(
    (a, b) => b[1].length - a[1].length,
  );
  for (const [trigger, list] of allTriggersSorted) {
    const cards = Array.from(new Set(list.map((o) => `\`${o.code}\` (${o.cardName})`))).join(', ');
    reportLines.push(`| \`${trigger}\` | **${list.length}** | ${cards} |`);
  }

  reportLines.push(``);
  reportLines.push(`---`);
  reportLines.push(``);
  reportLines.push(`## 🎯 10. Timings, Costs & Target Selectors Inventory`);
  reportLines.push(``);
  reportLines.push(`### Ability Timings:`);
  reportLines.push(`| Timing | Occurrences | Cards |`);
  reportLines.push(`| :--- | :--- | :--- |`);
  for (const [timing, list] of Array.from(timingsUsage.entries()).sort(
    (a, b) => b[1].length - a[1].length,
  )) {
    reportLines.push(`| \`${timing}\` | **${list.length}** | ${formatExamples(list, 5)} |`);
  }

  for (const timing of TimingTypeSchema.options) {
    if (!timingsUsage.has(timing)) {
      reportLines.push(`| \`${timing}\` | 🟡 **0** | *Unused in supplemental declarations* |`);
    }
  }

  reportLines.push(``);
  reportLines.push(`### Cost Primitives:`);
  reportLines.push(`| Cost Key | Occurrences | Cards |`);
  reportLines.push(`| :--- | :--- | :--- |`);
  for (const [cost, list] of Array.from(costsUsage.entries()).sort(
    (a, b) => b[1].length - a[1].length,
  )) {
    reportLines.push(`| \`${cost}\` | **${list.length}** | ${formatExamples(list, 5)} |`);
  }

  reportLines.push(``);
  reportLines.push(`### Target Selectors:`);
  reportLines.push(`| Target Selector | Occurrences | Cards |`);
  reportLines.push(`| :--- | :--- | :--- |`);
  for (const [target, list] of Array.from(targetsUsage.entries()).sort(
    (a, b) => b[1].length - a[1].length,
  )) {
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
  console.log(`Total Cards Scanned:        ${totalCardsInSupplemental}`);
  console.log(`Cards with Abilities:       ${totalCardsWithAbilities}`);
  console.log(`No Supplemental Needed:     ${noSupplementalCards.length}`);
  console.log(`Open Ambiguity Reports:     ${ambiguityReports.size}`);
  console.log(`False-Vanilla Violations:   ${falseVanillaViolations.length}`);
  console.log(`Total Abilities Declared:   ${totalAbilitiesDeclared}`);
  console.log(`Single-Step Abilities (=1): ${totalSingleStepAbilities}`);
  console.log(`Multi-Step Abilities (>=2): ${totalMultiStepAbilities}`);
  console.log(`Cards with Multi-Step:      ${totalCardsWithMultiStep}`);
  console.log(`Cards with 2+ Abilities:    ${multiAbilityCards.length}`);
  console.log(`Unique Effect Types:        ${effectsUsage.size}`);
  console.log(`Unique Trigger Types:       ${triggersUsage.size}`);
  console.log(`High-Impact Effects (>=5):  ${highImpactEffects.length}`);
  console.log(`Single-Use Effects (=1):    ${singleUseEffects.length}`);
  console.log(`Report Written To:          ${OUTPUT_REPORT_PATH}`);
  console.log(`========================================================\n`);
}

// Execute if run directly via tsx / node
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runDeclarationsAudit();
}
