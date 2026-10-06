import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  TimingTypeSchema,
  TriggerTypeSchema,
  TargetSelectorSchema,
  ConditionGateSchema,
  StepConditionSchema,
  EffectTypeSchema,
  KeywordSchema,
} from '../../src/data/supplemental/schema';
import { detectDuplicateJsonKeys } from '../../src/data/supplemental/duplicate-key-detector';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../');

const SUPPLEMENTAL_DIR = path.join(ROOT_DIR, 'src/data/supplemental/pack');
const UPSTREAM_DIR = path.join(ROOT_DIR, 'data/upstream/pack');
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
  ambiguityFile?: string;
  comment?: string;
}

interface AbilityStep {
  id?: string;
  effect?: string;
  target?: string;
  distinctFrom?: string;
  gate?: string;
  gateParams?: Record<string, unknown>;
  condition?: string;
  effectParams?: Record<string, unknown>;
  params?: Record<string, unknown>;
  filter?: Record<string, unknown>;
}

interface CardAbility {
  id?: string;
  timing?: string;
  trigger?: string;
  triggerFilter?: Record<string, unknown>;
  limit?: string;
  zone?: string;
  cost?: Record<string, unknown>;
  maxPerRound?: number;
  errata?: string | null;
  steps?: AbilityStep[];
}

interface CardUses {
  count: number;
  counterType?: string;
  max?: number;
  discardOnEmpty?: boolean;
}

interface PlayRequirements {
  identityForm?: string;
  formTrait?: string;
  identityTraits?: string[];
  controlFilter?: Record<string, unknown>;
  controlZones?: string[];
  identityNames?: string[];
}

interface SupplementalEntry {
  noSupplementalNeeded?: boolean;
  abilities?: CardAbility[];
  playRequirements?: PlayRequirements;
  uses?: CardUses;
  keywords?: (string | { keyword: string; amount?: number })[];
  recipient?: { type: string; codes?: string[] };
  attackCost?: number;
  thwartCost?: number;
  maxPerPlayer?: number;
  restrictedSlots?: number;
  additionalBoostCards?: number;
  playUnderAnyPlayerControl?: boolean;
  isLandscape?: boolean;
  victoryPoints?: number;
  traits?: string[];
  errata?: string | null;
  audit?: CardAudit;
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

export function runDeclarationsAudit() {
  const upstreamCards = loadAllUpstreamCards();
  const supplementalPacks = loadAllSupplementalPacks();
  const ambiguityReports = loadAllAmbiguityReports();

  // Usage Maps
  const timingsUsage = new Map<string, UsageOccurrence[]>();
  const triggersUsage = new Map<string, UsageOccurrence[]>();
  const triggerFiltersUsage = new Map<string, UsageOccurrence[]>();
  const costsUsage = new Map<string, UsageOccurrence[]>();
  const limitsUsage = new Map<string, UsageOccurrence[]>();
  const zonesUsage = new Map<string, UsageOccurrence[]>();

  const effectsUsage = new Map<string, UsageOccurrence[]>();
  const targetsUsage = new Map<string, UsageOccurrence[]>();
  const gatesUsage = new Map<string, UsageOccurrence[]>();
  const gateParamsUsage = new Map<string, UsageOccurrence[]>();
  const stepConditionsUsage = new Map<string, UsageOccurrence[]>();
  const distinctFromUsage = new Map<string, UsageOccurrence[]>();

  const effectParamsUsage = new Map<string, UsageOccurrence[]>();
  const dynamicValuesUsage = new Map<string, UsageOccurrence[]>();

  const filterCriteriaUsage = new Map<string, UsageOccurrence[]>();
  const filterCompositionsUsage = new Map<string, UsageOccurrence[]>();

  // Card Level
  const playReqsUsage = new Map<string, UsageOccurrence[]>();
  const usesUsage = new Map<string, UsageOccurrence[]>();
  const keywordsUsage = new Map<string, UsageOccurrence[]>();
  const recipientsUsage = new Map<string, UsageOccurrence[]>();
  const cardOverridesUsage = new Map<string, UsageOccurrence[]>();

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

  function extractUniversalFilter(filter: unknown, occ: UsageOccurrence) {
    if (!filter || typeof filter !== 'object') return;
    const obj = filter as Record<string, unknown>;

    for (const [key, value] of Object.entries(obj)) {
      if (key === 'all' || key === 'any' || key === 'none') {
        recordUsage(filterCompositionsUsage, key, occ);
        if (Array.isArray(value)) {
          for (const sub of value) {
            extractUniversalFilter(sub, occ);
          }
        }
      } else {
        recordUsage(filterCriteriaUsage, key, occ);
      }
    }
  }

  function extractDynamicValue(value: unknown, occ: UsageOccurrence) {
    if (!value || typeof value !== 'object') return;
    const obj = value as Record<string, unknown>;
    if (obj.from && typeof obj.from === 'string') {
      const descriptor = obj.stat
        ? `${obj.from} (stat: ${obj.stat})`
        : obj.counterType
          ? `${obj.from} (counter: ${obj.counterType})`
          : obj.discardAttribute
            ? `${obj.from} (attr: ${obj.discardAttribute})`
            : obj.attribute
              ? `${obj.from} (attr: ${obj.attribute})`
              : obj.from;
      recordUsage(dynamicValuesUsage, descriptor, occ);

      if (obj.filter) {
        extractUniversalFilter(obj.filter, occ);
      }
    }
  }

  function processAbility(ability: CardAbility, code: string, cardName: string, pack: string) {
    totalAbilitiesDeclared += 1;
    const abilityId = ability.id || 'unnamed_ability';
    const occ: UsageOccurrence = { code, cardName, pack, abilityId };

    if (ability.timing) recordUsage(timingsUsage, ability.timing, occ);
    if (ability.trigger) recordUsage(triggersUsage, ability.trigger, occ);
    if (ability.limit) recordUsage(limitsUsage, ability.limit, occ);
    if (ability.zone) recordUsage(zonesUsage, ability.zone, occ);

    if (ability.triggerFilter) {
      for (const [tfKey, tfVal] of Object.entries(ability.triggerFilter)) {
        recordUsage(triggerFiltersUsage, tfKey, occ);
        if (tfKey === 'attackerCardFilter') {
          extractUniversalFilter(tfVal, occ);
        }
      }
    }

    if (ability.cost) {
      for (const [costKey, costVal] of Object.entries(ability.cost)) {
        recordUsage(costsUsage, costKey, occ);
        if (costKey === 'discardCard' && costVal && typeof costVal === 'object') {
          const dcObj = costVal as Record<string, unknown>;
          if (dcObj.filter) extractUniversalFilter(dcObj.filter, occ);
        }
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

        // Target Selectors (step root, effectParams, or legacy params)
        const target =
          step.target ||
          (step.effectParams && typeof step.effectParams.target === 'string'
            ? step.effectParams.target
            : undefined) ||
          (step.params && typeof step.params.target === 'string' ? step.params.target : undefined);

        if (target) {
          recordUsage(targetsUsage, target, occ);
        }

        if (step.distinctFrom) {
          recordUsage(distinctFromUsage, step.distinctFrom, occ);
        }

        // Gates & Step Conditions
        if (step.gate) recordUsage(gatesUsage, step.gate, occ);
        if (step.condition) recordUsage(stepConditionsUsage, step.condition, occ);

        if (step.gateParams && typeof step.gateParams === 'object') {
          for (const gpKey of Object.keys(step.gateParams)) {
            recordUsage(gateParamsUsage, gpKey, occ);
          }
        }

        // Effect Params
        const paramsObj = step.effectParams || step.params;
        if (paramsObj && typeof paramsObj === 'object') {
          for (const [epKey, epVal] of Object.entries(paramsObj)) {
            recordUsage(effectParamsUsage, epKey, occ);

            // Check for dynamic values
            extractDynamicValue(epVal, occ);
            if (
              epKey === 'amount' ||
              epKey === 'count' ||
              epKey === 'takeCount' ||
              epKey === 'lookCount'
            ) {
              extractDynamicValue(epVal, occ);
            }

            // Check for filters inside effect params
            if (epKey === 'filter' || epKey === 'cardFilter' || epKey === 'untilFilter') {
              extractUniversalFilter(epVal, occ);
            }
          }
        }

        // Filter on step root
        if (step.filter) {
          extractUniversalFilter(step.filter, occ);
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
      const cardOcc: UsageOccurrence = { code, cardName, pack: packName, abilityId: 'card_root' };

      // Card-level features
      if (entry.playRequirements) {
        for (const [prKey, prVal] of Object.entries(entry.playRequirements)) {
          recordUsage(playReqsUsage, prKey, cardOcc);
          if (prKey === 'controlFilter') {
            extractUniversalFilter(prVal, cardOcc);
          }
        }
      }

      if (entry.uses) {
        const usesType = entry.uses.counterType
          ? `uses (${entry.uses.counterType})`
          : 'uses (general)';
        recordUsage(usesUsage, usesType, cardOcc);
      }

      if (entry.keywords && Array.isArray(entry.keywords)) {
        for (const kw of entry.keywords) {
          const kwStr = typeof kw === 'string' ? kw : `${kw.keyword} ${kw.amount ?? ''}`.trim();
          recordUsage(keywordsUsage, kwStr, cardOcc);
        }
      }

      if (entry.recipient) {
        recordUsage(recipientsUsage, entry.recipient.type, cardOcc);
      }

      if (entry.attackCost !== undefined) recordUsage(cardOverridesUsage, 'attackCost', cardOcc);
      if (entry.thwartCost !== undefined) recordUsage(cardOverridesUsage, 'thwartCost', cardOcc);
      if (entry.maxPerPlayer !== undefined)
        recordUsage(cardOverridesUsage, 'maxPerPlayer', cardOcc);
      if (entry.restrictedSlots !== undefined)
        recordUsage(cardOverridesUsage, 'restrictedSlots', cardOcc);
      if (entry.additionalBoostCards !== undefined)
        recordUsage(cardOverridesUsage, 'additionalBoostCards', cardOcc);
      if (entry.playUnderAnyPlayerControl !== undefined)
        recordUsage(cardOverridesUsage, 'playUnderAnyPlayerControl', cardOcc);
      if (entry.victoryPoints !== undefined)
        recordUsage(cardOverridesUsage, 'victoryPoints', cardOcc);

      if (entry.noSupplementalNeeded) {
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
            entry.audit?.comment ||
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

  function formatExamples(occurrences: UsageOccurrence[], max = 3): string {
    const uniqueCards = Array.from(new Set(occurrences.map((o) => `\`${o.code}\` ${o.cardName}`)));
    const sample = uniqueCards.slice(0, max).join(', ');
    return uniqueCards.length > max ? `${sample} *(+${uniqueCards.length - max} more)*` : sample;
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
    `| **Unique Target Selectors In Use** | **${targetsUsage.size}** | Distinct target selectors actively declared |`,
  );
  reportLines.push(
    `| **Unique Triggers In Use** | **${triggersUsage.size}** | Distinct trigger window types actively declared |`,
  );
  reportLines.push(
    `| **Unique Timings In Use** | **${timingsUsage.size}** | Distinct timing categories actively declared |`,
  );
  reportLines.push(
    `| **Unique Condition Gates In Use** | **${gatesUsage.size}** | Distinct condition gate types actively declared |`,
  );
  reportLines.push(
    `| **Unique Step Conditions In Use** | **${stepConditionsUsage.size}** | Distinct step condition types actively declared |`,
  );
  reportLines.push(
    `| **Unique Cost Keys In Use** | **${costsUsage.size}** | Distinct ability cost types actively declared |`,
  );
  reportLines.push(
    `| **Unique Effect Param Keys In Use** | **${effectParamsUsage.size}** | Distinct parameter keys passed into effect steps |`,
  );
  reportLines.push(
    `| **Unique Dynamic Value Sources In Use** | **${dynamicValuesUsage.size}** | Distinct dynamic value resolver shapes actively declared |`,
  );
  reportLines.push(
    `| **Unique Filter Criteria Keys In Use** | **${filterCriteriaUsage.size}** | Distinct UniversalCardFilter criteria properties actively declared |`,
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
  reportLines.push(`## 🃏 3. Card-Level Declarations Inventory (\`CardEnrichmentSchema\`)`);
  reportLines.push(``);
  reportLines.push(
    `### 🟢 Vanilla / Passive Cards (\`"noSupplementalNeeded": true\` — ${noSupplementalCards.length} Cards)`,
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
  reportLines.push(`### Play Requirements (\`PlayRequirementsSchema\`):`);
  reportLines.push(`| Requirement Property | Occurrences | Cards |`);
  reportLines.push(`| :--- | :--- | :--- |`);
  for (const [req, list] of Array.from(playReqsUsage.entries()).sort(
    (a, b) => b[1].length - a[1].length,
  )) {
    reportLines.push(`| \`${req}\` | **${list.length}** | ${formatExamples(list, 5)} |`);
  }

  reportLines.push(``);
  reportLines.push(`### Card Uses & Counters (\`CardUsesSchema\`):`);
  reportLines.push(`| Uses Descriptor | Occurrences | Cards |`);
  reportLines.push(`| :--- | :--- | :--- |`);
  for (const [uses, list] of Array.from(usesUsage.entries()).sort(
    (a, b) => b[1].length - a[1].length,
  )) {
    reportLines.push(`| \`${uses}\` | **${list.length}** | ${formatExamples(list, 5)} |`);
  }

  reportLines.push(``);
  reportLines.push(`### Card Keywords (\`KeywordEntrySchema\`):`);
  reportLines.push(`| Keyword | Occurrences | Cards |`);
  reportLines.push(`| :--- | :--- | :--- |`);
  for (const [kw, list] of Array.from(keywordsUsage.entries()).sort(
    (a, b) => b[1].length - a[1].length,
  )) {
    reportLines.push(`| \`${kw}\` | **${list.length}** | ${formatExamples(list, 5)} |`);
  }

  for (const kw of KeywordSchema.options) {
    if (!keywordsUsage.has(kw)) {
      reportLines.push(`| \`${kw}\` | 🟡 **0** | *Unused in supplemental declarations* |`);
    }
  }

  reportLines.push(``);
  reportLines.push(`### Player Recipient Overrides (\`PlayerRecipientSchema\`):`);
  reportLines.push(`| Recipient Type | Occurrences | Cards |`);
  reportLines.push(`| :--- | :--- | :--- |`);
  for (const [rec, list] of Array.from(recipientsUsage.entries()).sort(
    (a, b) => b[1].length - a[1].length,
  )) {
    reportLines.push(`| \`${rec}\` | **${list.length}** | ${formatExamples(list, 5)} |`);
  }

  reportLines.push(``);
  reportLines.push(`### Stat & Rule Overrides:`);
  reportLines.push(`| Override Key | Occurrences | Cards |`);
  reportLines.push(`| :--- | :--- | :--- |`);
  for (const [ov, list] of Array.from(cardOverridesUsage.entries()).sort(
    (a, b) => b[1].length - a[1].length,
  )) {
    reportLines.push(`| \`${ov}\` | **${list.length}** | ${formatExamples(list, 5)} |`);
  }

  reportLines.push(``);
  reportLines.push(`---`);
  reportLines.push(``);
  reportLines.push(`## ⚡ 4. Ability Headers & Trigger Windows (\`CardAbilitySchema\`)`);
  reportLines.push(``);
  reportLines.push(`### Ability Timings (\`TimingTypeSchema\`):`);
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
  reportLines.push(`### Trigger Windows (\`TriggerTypeSchema\`):`);
  reportLines.push(`| Trigger Window | Occurrences | Cards |`);
  reportLines.push(`| :--- | :--- | :--- |`);
  for (const [trigger, list] of Array.from(triggersUsage.entries()).sort(
    (a, b) => b[1].length - a[1].length,
  )) {
    reportLines.push(`| \`${trigger}\` | **${list.length}** | ${formatExamples(list, 5)} |`);
  }

  for (const trigger of TriggerTypeSchema.options) {
    if (!triggersUsage.has(trigger)) {
      reportLines.push(`| \`${trigger}\` | 🟡 **0** | *Unused in supplemental declarations* |`);
    }
  }

  reportLines.push(``);
  reportLines.push(`### Trigger Filters (\`TriggerFilterSchema\`):`);
  reportLines.push(`| Filter Property | Occurrences | Cards |`);
  reportLines.push(`| :--- | :--- | :--- |`);
  for (const [tf, list] of Array.from(triggerFiltersUsage.entries()).sort(
    (a, b) => b[1].length - a[1].length,
  )) {
    reportLines.push(`| \`${tf}\` | **${list.length}** | ${formatExamples(list, 5)} |`);
  }

  reportLines.push(``);
  reportLines.push(`### Cost Primitives (\`AbilityCostSchema\`):`);
  reportLines.push(`| Cost Key | Occurrences | Cards |`);
  reportLines.push(`| :--- | :--- | :--- |`);
  for (const [cost, list] of Array.from(costsUsage.entries()).sort(
    (a, b) => b[1].length - a[1].length,
  )) {
    reportLines.push(`| \`${cost}\` | **${list.length}** | ${formatExamples(list, 5)} |`);
  }

  reportLines.push(``);
  reportLines.push(`### Ability Limits & Zones:`);
  reportLines.push(`| Limit / Zone | Occurrences | Cards |`);
  reportLines.push(`| :--- | :--- | :--- |`);
  for (const [lim, list] of Array.from(limitsUsage.entries()).sort(
    (a, b) => b[1].length - a[1].length,
  )) {
    reportLines.push(`| Limit: \`${lim}\` | **${list.length}** | ${formatExamples(list, 5)} |`);
  }
  for (const [z, list] of Array.from(zonesUsage.entries()).sort(
    (a, b) => b[1].length - a[1].length,
  )) {
    reportLines.push(`| Zone: \`${z}\` | **${list.length}** | ${formatExamples(list, 5)} |`);
  }

  reportLines.push(``);
  reportLines.push(
    `### 📋 Cards with Multiple Abilities (2+ Abilities Declared — ${multiAbilityCards.length} Cards)`,
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
  reportLines.push(`## 🎯 5. Target Selectors Inventory (\`TargetSelectorSchema\`)`);
  reportLines.push(``);
  reportLines.push(
    `This inventory tracks all target selectors declared on ability steps (\`step.target\` or \`step.effectParams.target\`):`,
  );
  reportLines.push(``);
  reportLines.push(`| Target Selector | Occurrences | Cards |`);
  reportLines.push(`| :--- | :--- | :--- |`);

  for (const [target, list] of Array.from(targetsUsage.entries()).sort(
    (a, b) => b[1].length - a[1].length,
  )) {
    reportLines.push(`| \`${target}\` | **${list.length}** | ${formatExamples(list, 5)} |`);
  }

  for (const target of TargetSelectorSchema.options) {
    if (!targetsUsage.has(target)) {
      reportLines.push(`| \`${target}\` | 🟡 **0** | *Unused in supplemental declarations* |`);
    }
  }

  if (distinctFromUsage.size > 0) {
    reportLines.push(``);
    reportLines.push(`### Target Differentiation (\`DistinctFromSchema\`):`);
    reportLines.push(`| Distinct Mode | Occurrences | Cards |`);
    reportLines.push(`| :--- | :--- | :--- |`);
    for (const [df, list] of Array.from(distinctFromUsage.entries()).sort(
      (a, b) => b[1].length - a[1].length,
    )) {
      reportLines.push(`| \`${df}\` | **${list.length}** | ${formatExamples(list, 5)} |`);
    }
  }

  reportLines.push(``);
  reportLines.push(`---`);
  reportLines.push(``);
  reportLines.push(
    `## 🚦 6. Condition Gates & Step Conditions (\`ConditionGateSchema\`, \`StepConditionSchema\`)`,
  );
  reportLines.push(``);
  reportLines.push(`### Condition Gates (\`ConditionGateSchema\`):`);
  reportLines.push(`| Condition Gate | Occurrences | Cards |`);
  reportLines.push(`| :--- | :--- | :--- |`);
  for (const [gate, list] of Array.from(gatesUsage.entries()).sort(
    (a, b) => b[1].length - a[1].length,
  )) {
    reportLines.push(`| \`${gate}\` | **${list.length}** | ${formatExamples(list, 5)} |`);
  }

  for (const gate of ConditionGateSchema.options) {
    if (!gatesUsage.has(gate)) {
      reportLines.push(`| \`${gate}\` | 🟡 **0** | *Unused in supplemental declarations* |`);
    }
  }

  reportLines.push(``);
  reportLines.push(`### Gate Parameters (\`gateParams\`):`);
  reportLines.push(`| Parameter Key | Occurrences | Cards |`);
  reportLines.push(`| :--- | :--- | :--- |`);
  for (const [gp, list] of Array.from(gateParamsUsage.entries()).sort(
    (a, b) => b[1].length - a[1].length,
  )) {
    reportLines.push(`| \`${gp}\` | **${list.length}** | ${formatExamples(list, 5)} |`);
  }

  reportLines.push(``);
  reportLines.push(`### Declarative Step Conditions (\`StepConditionSchema\`):`);
  reportLines.push(`| Step Condition | Occurrences | Cards |`);
  reportLines.push(`| :--- | :--- | :--- |`);
  for (const [cond, list] of Array.from(stepConditionsUsage.entries()).sort(
    (a, b) => b[1].length - a[1].length,
  )) {
    reportLines.push(`| \`${cond}\` | **${list.length}** | ${formatExamples(list, 5)} |`);
  }

  for (const cond of StepConditionSchema.options) {
    if (!stepConditionsUsage.has(cond)) {
      reportLines.push(`| \`${cond}\` | 🟡 **0** | *Unused in supplemental declarations* |`);
    }
  }

  reportLines.push(``);
  reportLines.push(`---`);
  reportLines.push(``);
  reportLines.push(`## 💥 7. Effect Primitives Inventory (\`EffectTypeSchema\`)`);
  reportLines.push(``);
  reportLines.push(`### High-Impact Effects (Blast-Radius $\\ge 5$ Cards):`);
  reportLines.push(`| Effect Primitive | Card Count | Example Cards |`);
  reportLines.push(`| :--- | :--- | :--- |`);

  const highImpactEffects = Array.from(effectsUsage.entries())
    .filter(([_, list]) => list.length >= 5)
    .sort((a, b) => b[1].length - a[1].length);

  for (const [effect, list] of highImpactEffects) {
    reportLines.push(`| \`${effect}\` | **${list.length}** | ${formatExamples(list, 3)} |`);
  }

  reportLines.push(``);
  reportLines.push(`### Single-Use Effects (Card Count = 1):`);
  reportLines.push(`| Effect Primitive | Card Code | Card Name & Pack | Ability ID |`);
  reportLines.push(`| :--- | :--- | :--- | :--- |`);

  const singleUseEffects = Array.from(effectsUsage.entries())
    .filter(([_, list]) => list.length === 1)
    .sort((a, b) => a[0].localeCompare(b[0]));

  for (const [effect, list] of singleUseEffects) {
    const item = list[0];
    reportLines.push(
      `| \`${effect}\` | \`${item.code}\` | ${item.cardName} (${item.pack}) | \`${item.abilityId}\` |`,
    );
  }

  reportLines.push(``);
  reportLines.push(`### Complete Effects Inventory:`);
  reportLines.push(`| Effect Primitive | Occurrences | Declaring Cards |`);
  reportLines.push(`| :--- | :--- | :--- |`);

  const allEffectsSorted = Array.from(effectsUsage.entries()).sort(
    (a, b) => b[1].length - a[1].length,
  );
  for (const [effect, list] of allEffectsSorted) {
    const cards = Array.from(new Set(list.map((o) => `\`${o.code}\` (${o.cardName})`))).join(', ');
    reportLines.push(`| \`${effect}\` | **${list.length}** | ${cards} |`);
  }

  for (const eff of EffectTypeSchema.options) {
    if (!effectsUsage.has(eff)) {
      reportLines.push(`| \`${eff}\` | 🟡 **0** | *Unused in supplemental declarations* |`);
    }
  }

  reportLines.push(``);
  reportLines.push(`---`);
  reportLines.push(``);
  reportLines.push(
    `## 🔧 8. Effect Parameters & Dynamic Values (\`effectParams\`, \`DynamicValueSourceSchema\`)`,
  );
  reportLines.push(``);
  reportLines.push(`### Effect Parameter Keys (\`effectParams\`):`);
  reportLines.push(`| Parameter Key | Occurrences | Cards |`);
  reportLines.push(`| :--- | :--- | :--- |`);
  for (const [ep, list] of Array.from(effectParamsUsage.entries()).sort(
    (a, b) => b[1].length - a[1].length,
  )) {
    reportLines.push(`| \`${ep}\` | **${list.length}** | ${formatExamples(list, 5)} |`);
  }

  reportLines.push(``);
  reportLines.push(`### Dynamic Value Sources (\`DynamicValueSourceSchema\`):`);
  reportLines.push(`| Dynamic Value Resolver | Occurrences | Cards |`);
  reportLines.push(`| :--- | :--- | :--- |`);
  for (const [dv, list] of Array.from(dynamicValuesUsage.entries()).sort(
    (a, b) => b[1].length - a[1].length,
  )) {
    reportLines.push(`| \`${dv}\` | **${list.length}** | ${formatExamples(list, 5)} |`);
  }

  reportLines.push(``);
  reportLines.push(`---`);
  reportLines.push(``);
  reportLines.push(
    `## 🔍 9. Universal Card Filters & Compositions (\`UniversalCardFilterSchema\`)`,
  );
  reportLines.push(``);
  reportLines.push(`### Filter Predicate Criteria:`);
  reportLines.push(`| Filter Criterion Key | Occurrences | Cards |`);
  reportLines.push(`| :--- | :--- | :--- |`);
  for (const [fc, list] of Array.from(filterCriteriaUsage.entries()).sort(
    (a, b) => b[1].length - a[1].length,
  )) {
    reportLines.push(`| \`${fc}\` | **${list.length}** | ${formatExamples(list, 5)} |`);
  }

  reportLines.push(``);
  reportLines.push(`### Filter Logical Compositions:`);
  reportLines.push(`| Composition Branch | Occurrences | Cards |`);
  reportLines.push(`| :--- | :--- | :--- |`);
  for (const [comp, list] of Array.from(filterCompositionsUsage.entries()).sort(
    (a, b) => b[1].length - a[1].length,
  )) {
    reportLines.push(
      `| \`${comp}\` (combinator) | **${list.length}** | ${formatExamples(list, 5)} |`,
    );
  }

  reportLines.push(``);
  reportLines.push(`---`);
  reportLines.push(``);
  reportLines.push(`## ⚠️ 10. Global Zero-Usage & Schema Gap Detection`);
  reportLines.push(``);
  reportLines.push(
    `The following schema enums are defined in \`src/data/supplemental/schema.ts\` but currently have **0 card declarations** across the active supplemental data packs:`,
  );
  reportLines.push(``);
  reportLines.push(`| Schema / Enum | Unused Enum Value | Status | Notes |`);
  reportLines.push(`| :--- | :--- | :--- | :--- |`);

  for (const eff of EffectTypeSchema.options) {
    if (!effectsUsage.has(eff)) {
      reportLines.push(
        `| \`EffectTypeSchema\` | \`${eff}\` | 🟡 \`0 Cards\` | Defined in schema; no card currently declares this effect. |`,
      );
    }
  }

  for (const tr of TriggerTypeSchema.options) {
    if (!triggersUsage.has(tr)) {
      reportLines.push(
        `| \`TriggerTypeSchema\` | \`${tr}\` | 🟡 \`0 Cards\` | Defined in schema; no card currently declares this trigger window. |`,
      );
    }
  }

  for (const tm of TimingTypeSchema.options) {
    if (!timingsUsage.has(tm)) {
      reportLines.push(
        `| \`TimingTypeSchema\` | \`${tm}\` | 🟡 \`0 Cards\` | Defined in schema; no card currently declares this timing category. |`,
      );
    }
  }

  for (const ts of TargetSelectorSchema.options) {
    if (!targetsUsage.has(ts)) {
      reportLines.push(
        `| \`TargetSelectorSchema\` | \`${ts}\` | 🟡 \`0 Cards\` | Defined in schema; no card currently declares this target selector. |`,
      );
    }
  }

  for (const cg of ConditionGateSchema.options) {
    if (!gatesUsage.has(cg)) {
      reportLines.push(
        `| \`ConditionGateSchema\` | \`${cg}\` | 🟡 \`0 Cards\` | Defined in schema; no card currently declares this condition gate. |`,
      );
    }
  }

  for (const sc of StepConditionSchema.options) {
    if (!stepConditionsUsage.has(sc)) {
      reportLines.push(
        `| \`StepConditionSchema\` | \`${sc}\` | 🟡 \`0 Cards\` | Defined in schema; no card currently declares this step condition. |`,
      );
    }
  }

  for (const kw of KeywordSchema.options) {
    if (!keywordsUsage.has(kw)) {
      reportLines.push(
        `| \`KeywordSchema\` | \`${kw}\` | 🟡 \`0 Cards\` | Defined in schema; no card currently declares this keyword directly in supplemental data. |`,
      );
    }
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
  console.log(`Unique Target Selectors:    ${targetsUsage.size}`);
  console.log(`Unique Trigger Types:       ${triggersUsage.size}`);
  console.log(`Unique Timing Types:        ${timingsUsage.size}`);
  console.log(`Unique Condition Gates:     ${gatesUsage.size}`);
  console.log(`Unique Step Conditions:     ${stepConditionsUsage.size}`);
  console.log(`Unique Effect Param Keys:   ${effectParamsUsage.size}`);
  console.log(`Unique Dynamic Values:      ${dynamicValuesUsage.size}`);
  console.log(`Unique Filter Criteria:     ${filterCriteriaUsage.size}`);
  console.log(`Report Written To:          ${OUTPUT_REPORT_PATH}`);
  console.log(`========================================================\n`);
}

// Execute if run directly via tsx / node
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runDeclarationsAudit();
}
