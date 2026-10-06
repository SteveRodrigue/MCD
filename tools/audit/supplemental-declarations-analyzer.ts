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
} from '../../src/data/supplemental/schema';
import { detectDuplicateJsonKeys } from '../../src/data/supplemental/duplicate-key-detector';
import { auditSchemaEngineCoverage } from './schema-engine-coverage';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../');

const SUPPLEMENTAL_DIR = path.join(ROOT_DIR, 'src/data/supplemental/pack');
const UPSTREAM_DIR = path.join(ROOT_DIR, 'data/upstream/pack');
const AMBIGUITIES_DIR = path.join(ROOT_DIR, 'docs/ambiguities');

// Output paths
const REPORTS_BASE_DIR = path.join(ROOT_DIR, 'docs/reports/supplemental_data');
const DETAILED_REPORTS_DIR = path.join(REPORTS_BASE_DIR, 'detailed_reports');
const MAIN_REPORT_PATH = path.join(REPORTS_BASE_DIR, 'usage_report.md');
const LEGACY_POINTER_PATH = path.join(
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

function anchorId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function runDeclarationsAudit() {
  const upstreamCards = loadAllUpstreamCards();
  const supplementalPacks = loadAllSupplementalPacks();
  const ambiguityReports = loadAllAmbiguityReports();
  const coverageAudit = auditSchemaEngineCoverage();

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

  const multiStepCards: {
    code: string;
    name: string;
    type: string;
    pack: string;
    abilityId: string;
    timing: string;
    stepsCount: number;
    effectsSummary: string;
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
        multiStepCards.push({
          code,
          name: cardName,
          type: upstreamCards.get(code)?.type_code || 'unknown',
          pack,
          abilityId,
          timing: ability.timing || 'ACTION',
          stepsCount: ability.steps.length,
          effectsSummary: ability.steps
            .map((s, idx) => `[${idx + 1}] ${s.effect || 'UNKNOWN'}`)
            .join(' ➔ '),
        });
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

  function formatCardListTable(occurrences: UsageOccurrence[]): string {
    const uniqueMap = new Map<
      string,
      { code: string; name: string; pack: string; abilityIds: Set<string> }
    >();
    for (const occ of occurrences) {
      if (!uniqueMap.has(occ.code)) {
        uniqueMap.set(occ.code, {
          code: occ.code,
          name: occ.cardName,
          pack: occ.pack,
          abilityIds: new Set<string>(),
        });
      }
      uniqueMap.get(occ.code)!.abilityIds.add(occ.abilityId);
    }

    const rows = Array.from(uniqueMap.values()).sort((a, b) =>
      a.code.localeCompare(b.code, undefined, { numeric: true }),
    );

    const lines: string[] = [];
    lines.push(`| Card Code | Card Name | Pack | Declared In Abilities |`);
    lines.push(`| :--- | :--- | :--- | :--- |`);
    for (const r of rows) {
      const abilities = Array.from(r.abilityIds)
        .map((id) => `\`${id}\``)
        .join(', ');
      lines.push(`| \`${r.code}\` | **${r.name}** | \`${r.pack}\` | ${abilities} |`);
    }
    return lines.join('\n');
  }

  // Ensure output directories exist
  if (!fs.existsSync(DETAILED_REPORTS_DIR)) {
    fs.mkdirSync(DETAILED_REPORTS_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString();

  // =========================================================================
  // DETAILED REPORT 1: Vanilla & Passive Cards
  // =========================================================================
  const vanillaReportLines: string[] = [];
  vanillaReportLines.push(`# 🟢 Vanilla & Passive Cards Inventory (\`noSupplementalNeeded\`)`);
  vanillaReportLines.push(``);
  vanillaReportLines.push(`[← Back to Main Usage Report](../usage_report.md)`);
  vanillaReportLines.push(``);
  vanillaReportLines.push(
    `> **Generated:** \`${timestamp}\` | **Total Verified Vanilla Cards:** **${noSupplementalCards.length}**`,
  );
  vanillaReportLines.push(``);
  vanillaReportLines.push(
    `These cards require zero declarative engine hooks (e.g. vanilla resources, base stats only, or passive encounter cards without triggers).`,
  );
  vanillaReportLines.push(``);
  vanillaReportLines.push(
    `| Card Code | Card Name | Type | Faction / Aspect | Pack | Audit Comment / Justification |`,
  );
  vanillaReportLines.push(`| :--- | :--- | :--- | :--- | :--- | :--- |`);
  noSupplementalCards.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  for (const c of noSupplementalCards) {
    vanillaReportLines.push(
      `| \`${c.code}\` | **${c.name}** | \`${c.type}\` | \`${c.faction}\` | \`${c.pack}\` | ${c.comment} |`,
    );
  }
  vanillaReportLines.push(``);
  vanillaReportLines.push(`[← Back to Main Usage Report](../usage_report.md)`);
  fs.writeFileSync(
    path.join(DETAILED_REPORTS_DIR, 'vanilla_and_passive_cards.md'),
    vanillaReportLines.join('\n'),
    'utf-8',
  );

  // =========================================================================
  // DETAILED REPORT 2: Multi-Ability & Multi-Step Cards
  // =========================================================================
  const multiReportLines: string[] = [];
  multiReportLines.push(`# 📋 Multi-Ability & Multi-Step Pipelines Inventory`);
  multiReportLines.push(``);
  multiReportLines.push(`[← Back to Main Usage Report](../usage_report.md)`);
  multiReportLines.push(``);
  multiReportLines.push(`> **Generated:** \`${timestamp}\``);
  multiReportLines.push(``);
  multiReportLines.push(
    `## 1. Cards with Multiple Abilities (2+ Declared Abilities — ${multiAbilityCards.length} Cards)`,
  );
  multiReportLines.push(``);
  multiReportLines.push(
    `| Card Code | Card Name | Type | Pack | Ability Count | Declared Abilities Summary |`,
  );
  multiReportLines.push(`| :--- | :--- | :--- | :--- | :--- | :--- |`);
  multiAbilityCards.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  for (const m of multiAbilityCards) {
    const abList = m.abilities
      .map((a) => {
        const triggerStr = a.trigger ? ` / \`${a.trigger}\`` : '';
        return `• \`${a.id}\` (\`${a.timing}\`${triggerStr}, **${a.stepsCount} step${a.stepsCount === 1 ? '' : 's'}**)`;
      })
      .join('<br/>');
    multiReportLines.push(
      `| \`${m.code}\` | **${m.name}** | \`${m.type}\` | \`${m.pack}\` | **${m.abilitiesCount}** | ${abList} |`,
    );
  }

  multiReportLines.push(``);
  multiReportLines.push(
    `## 2. Multi-Step Execution Pipelines (2+ Steps — ${multiStepCards.length} Pipelines Across ${totalCardsWithMultiStep} Cards)`,
  );
  multiReportLines.push(``);
  multiReportLines.push(
    `| Card Code | Card Name | Pack | Ability ID | Timing | Steps | Pipeline Execution Sequence |`,
  );
  multiReportLines.push(`| :--- | :--- | :--- | :--- | :--- | :--- | :--- |`);
  multiStepCards.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  for (const p of multiStepCards) {
    multiReportLines.push(
      `| \`${p.code}\` | **${p.name}** | \`${p.pack}\` | \`${p.abilityId}\` | \`${p.timing}\` | **${p.stepsCount}** | \`${p.effectsSummary}\` |`,
    );
  }
  multiReportLines.push(``);
  multiReportLines.push(`[← Back to Main Usage Report](../usage_report.md)`);
  fs.writeFileSync(
    path.join(DETAILED_REPORTS_DIR, 'multi_ability_and_multistep_cards.md'),
    multiReportLines.join('\n'),
    'utf-8',
  );

  // =========================================================================
  // DETAILED REPORT 3: Effects Usage
  // =========================================================================
  const effectsReportLines: string[] = [];
  effectsReportLines.push(`# 💥 Effect Primitives Usage Inventory (\`EffectTypeSchema\`)`);
  effectsReportLines.push(``);
  effectsReportLines.push(`[← Back to Main Usage Report](../usage_report.md)`);
  effectsReportLines.push(``);
  effectsReportLines.push(
    `> **Generated:** \`${timestamp}\` | **Active Effects In Use:** **${effectsUsage.size}/${EffectTypeSchema.options.length}**`,
  );
  effectsReportLines.push(``);
  effectsReportLines.push(
    `This detailed catalog groups cards declaring each effect primitive in \`src/data/supplemental/\`.`,
  );
  effectsReportLines.push(``);

  const sortedEffects = Array.from(effectsUsage.entries()).sort(
    (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]),
  );

  for (const [effect, occs] of sortedEffects) {
    const uniqueCards = new Set(occs.map((o) => o.code)).size;
    effectsReportLines.push(
      `### <a id="${anchorId(effect)}"></a>\`${effect}\` (${uniqueCards} Cards, ${occs.length} Step Occurrences)`,
    );
    effectsReportLines.push(``);
    effectsReportLines.push(formatCardListTable(occs));
    effectsReportLines.push(``);
  }
  effectsReportLines.push(`[← Back to Main Usage Report](../usage_report.md)`);
  fs.writeFileSync(
    path.join(DETAILED_REPORTS_DIR, 'effects_usage.md'),
    effectsReportLines.join('\n'),
    'utf-8',
  );

  // =========================================================================
  // DETAILED REPORT 4: Target Selectors Usage
  // =========================================================================
  const targetsReportLines: string[] = [];
  targetsReportLines.push(`# 🎯 Target Selectors Usage Inventory (\`TargetSelectorSchema\`)`);
  targetsReportLines.push(``);
  targetsReportLines.push(`[← Back to Main Usage Report](../usage_report.md)`);
  targetsReportLines.push(``);
  targetsReportLines.push(
    `> **Generated:** \`${timestamp}\` | **Active Target Selectors In Use:** **${targetsUsage.size}/${TargetSelectorSchema.options.length}**`,
  );
  targetsReportLines.push(``);

  const sortedTargets = Array.from(targetsUsage.entries()).sort(
    (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]),
  );

  for (const [target, occs] of sortedTargets) {
    const uniqueCards = new Set(occs.map((o) => o.code)).size;
    targetsReportLines.push(
      `### <a id="${anchorId(target)}"></a>\`${target}\` (${uniqueCards} Cards, ${occs.length} Declarations)`,
    );
    targetsReportLines.push(``);
    targetsReportLines.push(formatCardListTable(occs));
    targetsReportLines.push(``);
  }
  targetsReportLines.push(`[← Back to Main Usage Report](../usage_report.md)`);
  fs.writeFileSync(
    path.join(DETAILED_REPORTS_DIR, 'target_selectors_usage.md'),
    targetsReportLines.join('\n'),
    'utf-8',
  );

  // =========================================================================
  // DETAILED REPORT 5: Timing & Triggers Usage
  // =========================================================================
  const timingTriggersReportLines: string[] = [];
  timingTriggersReportLines.push(`# ⚡ Timing & Triggers Usage Inventory`);
  timingTriggersReportLines.push(``);
  timingTriggersReportLines.push(`[← Back to Main Usage Report](../usage_report.md)`);
  timingTriggersReportLines.push(``);
  timingTriggersReportLines.push(`> **Generated:** \`${timestamp}\``);
  timingTriggersReportLines.push(``);
  timingTriggersReportLines.push(
    `## 1. Ability Timings (\`TimingTypeSchema\` — ${timingsUsage.size}/${TimingTypeSchema.options.length} In Use)`,
  );
  timingTriggersReportLines.push(``);

  const sortedTimings = Array.from(timingsUsage.entries()).sort(
    (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]),
  );
  for (const [timing, occs] of sortedTimings) {
    const uniqueCards = new Set(occs.map((o) => o.code)).size;
    timingTriggersReportLines.push(
      `### <a id="${anchorId(timing)}"></a>\`${timing}\` (${uniqueCards} Cards)`,
    );
    timingTriggersReportLines.push(``);
    timingTriggersReportLines.push(formatCardListTable(occs));
    timingTriggersReportLines.push(``);
  }

  timingTriggersReportLines.push(
    `## 2. Trigger Windows (\`TriggerTypeSchema\` — ${triggersUsage.size}/${TriggerTypeSchema.options.length} In Use)`,
  );
  timingTriggersReportLines.push(``);
  const sortedTriggers = Array.from(triggersUsage.entries()).sort(
    (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]),
  );
  for (const [trigger, occs] of sortedTriggers) {
    const uniqueCards = new Set(occs.map((o) => o.code)).size;
    timingTriggersReportLines.push(
      `### <a id="${anchorId(trigger)}"></a>\`${trigger}\` (${uniqueCards} Cards)`,
    );
    timingTriggersReportLines.push(``);
    timingTriggersReportLines.push(formatCardListTable(occs));
    timingTriggersReportLines.push(``);
  }
  timingTriggersReportLines.push(`[← Back to Main Usage Report](../usage_report.md)`);
  fs.writeFileSync(
    path.join(DETAILED_REPORTS_DIR, 'timing_and_triggers_usage.md'),
    timingTriggersReportLines.join('\n'),
    'utf-8',
  );

  // =========================================================================
  // DETAILED REPORT 6: Condition Gates & Step Conditions Usage
  // =========================================================================
  const conditionsReportLines: string[] = [];
  conditionsReportLines.push(`# 🚦 Condition Gates & Step Conditions Usage Inventory`);
  conditionsReportLines.push(``);
  conditionsReportLines.push(`[← Back to Main Usage Report](../usage_report.md)`);
  conditionsReportLines.push(``);
  conditionsReportLines.push(`> **Generated:** \`${timestamp}\``);
  conditionsReportLines.push(``);
  conditionsReportLines.push(
    `## 1. Condition Gates (\`ConditionGateSchema\` — ${gatesUsage.size}/${ConditionGateSchema.options.length} In Use)`,
  );
  conditionsReportLines.push(``);

  const sortedGates = Array.from(gatesUsage.entries()).sort(
    (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]),
  );
  for (const [gate, occs] of sortedGates) {
    const uniqueCards = new Set(occs.map((o) => o.code)).size;
    conditionsReportLines.push(
      `### <a id="${anchorId(gate)}"></a>\`${gate}\` (${uniqueCards} Cards)`,
    );
    conditionsReportLines.push(``);
    conditionsReportLines.push(formatCardListTable(occs));
    conditionsReportLines.push(``);
  }

  conditionsReportLines.push(
    `## 2. Step Conditions (\`StepConditionSchema\` — ${stepConditionsUsage.size}/${StepConditionSchema.options.length} In Use)`,
  );
  conditionsReportLines.push(``);
  const sortedStepConds = Array.from(stepConditionsUsage.entries()).sort(
    (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]),
  );
  for (const [sc, occs] of sortedStepConds) {
    const uniqueCards = new Set(occs.map((o) => o.code)).size;
    conditionsReportLines.push(`### <a id="${anchorId(sc)}"></a>\`${sc}\` (${uniqueCards} Cards)`);
    conditionsReportLines.push(``);
    conditionsReportLines.push(formatCardListTable(occs));
    conditionsReportLines.push(``);
  }
  conditionsReportLines.push(`[← Back to Main Usage Report](../usage_report.md)`);
  fs.writeFileSync(
    path.join(DETAILED_REPORTS_DIR, 'condition_gates_usage.md'),
    conditionsReportLines.join('\n'),
    'utf-8',
  );

  // =========================================================================
  // DETAILED REPORT 7: Full Schema <-> Engine Code Path Audit
  // =========================================================================
  const schemaAuditLines: string[] = [];
  schemaAuditLines.push(`# 🔍 Schema Primitives Code Path Verification Matrix`);
  schemaAuditLines.push(``);
  schemaAuditLines.push(`[← Back to Main Usage Report](../usage_report.md)`);
  schemaAuditLines.push(``);
  schemaAuditLines.push(
    `> **Generated:** \`${timestamp}\` | **Overall Coverage:** **${coverageAudit.overallCoverageRate.toFixed(1)}%**`,
  );
  schemaAuditLines.push(``);
  schemaAuditLines.push(
    `This matrix audits every schema primitive defined in \`src/data/supplemental/schema.ts\` across 3 dimensions:`,
  );
  schemaAuditLines.push(`1. **In Schema**: Is the enum option formally defined in schema.ts?`);
  schemaAuditLines.push(`2. **In Supplemental Data**: Is it declared by active card packages?`);
  schemaAuditLines.push(
    `3. **In Engine / Pipeline**: Does a live code path (handler / evaluator / resolver) exist in \`src/engine/\`?`,
  );
  schemaAuditLines.push(``);
  schemaAuditLines.push(`### Health Status Legend:`);
  schemaAuditLines.push(
    `- 🟢 **Active / Healthy**: Defined in Schema + Code Path Implemented + Used by Cards.`,
  );
  schemaAuditLines.push(
    `- 🔵 **Engine-Ready (Unused)**: Defined in Schema + Code Path Implemented + 0 Cards (ready for new cards).`,
  );
  schemaAuditLines.push(
    `- 🔴 **Missing Engine Handler**: Declared by Cards + **No Engine Code Path** (Runtime failure risk!).`,
  );
  schemaAuditLines.push(
    `- ⚠️ **Schema Ghost / Dead Schema**: Defined in Schema + **No Code Path** + 0 Cards (Unused schema debt).`,
  );
  schemaAuditLines.push(``);

  function generateAuditTable(
    enumTitle: string,
    options: readonly string[],
    usageMap: Map<string, UsageOccurrence[]>,
    handledSet: Set<string>,
    handlerLocation: string,
  ): string[] {
    const lines: string[] = [];
    lines.push(`### ${enumTitle}`);
    lines.push(``);
    lines.push(
      `| Primitive Value | In Engine Code Path? | Cards Declaring | Status | Health Rationale / Code Location |`,
    );
    lines.push(`| :--- | :---: | :---: | :---: | :--- |`);

    for (const opt of options) {
      const cardCount = usageMap.get(opt)?.length || 0;
      const hasEngine = handledSet.has(opt);

      let status = '';
      let note = '';
      if (hasEngine && cardCount > 0) {
        status = '🟢 Active';
        note = `Handled in ${handlerLocation}; declared by ${cardCount} card(s).`;
      } else if (hasEngine && cardCount === 0) {
        status = '🔵 Engine-Ready';
        note = `Handled in ${handlerLocation}; 0 cards currently declare this.`;
      } else if (!hasEngine && cardCount > 0) {
        status = '🔴 Missing Handler';
        note = `🚨 DECLARED BY ${cardCount} CARD(S) BUT NO ENGINE CODE PATH FOUND!`;
      } else {
        status = '⚠️ Schema Ghost';
        note = `Defined in schema but no engine handler and 0 cards. Candidate for cleanup.`;
      }

      lines.push(
        `| \`${opt}\` | ${hasEngine ? '✅ Yes' : '❌ No'} | **${cardCount}** | ${status} | ${note} |`,
      );
    }
    lines.push(``);
    return lines;
  }

  schemaAuditLines.push(
    ...generateAuditTable(
      `1. Effect Primitives (\`EffectTypeSchema\` — ${coverageAudit.effectsCoverageRate.toFixed(1)}% Engine Coverage)`,
      EffectTypeSchema.options,
      effectsUsage,
      coverageAudit.effectsHandledSet,
      '`src/engine/effects/index.ts` / specialized pipelines',
    ),
  );

  schemaAuditLines.push(
    ...generateAuditTable(
      `2. Target Selectors (\`TargetSelectorSchema\` — ${coverageAudit.targetsCoverageRate.toFixed(1)}% Engine Coverage)`,
      TargetSelectorSchema.options,
      targetsUsage,
      coverageAudit.targetsHandledSet,
      '`src/engine/effects/target-resolver.ts`',
    ),
  );

  schemaAuditLines.push(
    ...generateAuditTable(
      `3. Condition Gates (\`ConditionGateSchema\` — ${coverageAudit.gatesCoverageRate.toFixed(1)}% Engine Coverage)`,
      ConditionGateSchema.options,
      gatesUsage,
      coverageAudit.gatesHandledSet,
      '`src/engine/pipeline/step-gate-evaluator.ts`',
    ),
  );

  schemaAuditLines.push(
    ...generateAuditTable(
      `4. Step Conditions (\`StepConditionSchema\` — ${coverageAudit.stepConditionsCoverageRate.toFixed(1)}% Engine Coverage)`,
      StepConditionSchema.options,
      stepConditionsUsage,
      coverageAudit.stepConditionsHandledSet,
      '`src/engine/effects/index.ts` / `step-gate-evaluator.ts`',
    ),
  );

  schemaAuditLines.push(
    ...generateAuditTable(
      `5. Trigger Windows (\`TriggerTypeSchema\` — ${coverageAudit.triggersCoverageRate.toFixed(1)}% Engine Coverage)`,
      TriggerTypeSchema.options,
      triggersUsage,
      coverageAudit.triggersHandledSet,
      '`src/engine/triggers/` & scenario pipelines',
    ),
  );

  schemaAuditLines.push(
    ...generateAuditTable(
      `6. Ability Timings (\`TimingTypeSchema\` — ${coverageAudit.timingsCoverageRate.toFixed(1)}% Engine Coverage)`,
      TimingTypeSchema.options,
      timingsUsage,
      coverageAudit.timingsHandledSet,
      '`src/engine/` timing evaluation paths',
    ),
  );

  schemaAuditLines.push(`[← Back to Main Usage Report](../usage_report.md)`);
  fs.writeFileSync(
    path.join(DETAILED_REPORTS_DIR, 'schema_code_path_audit.md'),
    schemaAuditLines.join('\n'),
    'utf-8',
  );

  // =========================================================================
  // MAIN DASHBOARD: docs/reports/supplemental_data/usage_report.md
  // =========================================================================
  const mainReportLines: string[] = [];
  mainReportLines.push(`# Supplemental Card Declarations Usage & Impact Report`);
  mainReportLines.push(``);
  mainReportLines.push(`> **Generated:** \`${timestamp}\`  `);
  mainReportLines.push(
    `> **Source Packs Scanned:** \`${Array.from(supplementalPacks.keys()).join(', ')}\``,
  );
  mainReportLines.push(``);
  mainReportLines.push(`---`);
  mainReportLines.push(``);
  mainReportLines.push(`## 📊 1. Executive Summary & Code Path Health`);
  mainReportLines.push(``);
  mainReportLines.push(`| Metric | Count | Health / Coverage | Description |`);
  mainReportLines.push(`| :--- | :---: | :---: | :--- |`);
  mainReportLines.push(
    `| **Total Cards Registered** | **${totalCardsInSupplemental}** | 100% | Total cards present in \`src/data/supplemental/\` |`,
  );
  mainReportLines.push(
    `| **Active Declared Cards** | **${totalCardsWithAbilities}** | - | Cards with executable \`abilities: [...]\` |`,
  );
  mainReportLines.push(
    `| **No Supplemental Needed** | [${noSupplementalCards.length}](detailed_reports/vanilla_and_passive_cards.md) | Verified | Vanilla / passive cards explicitly requiring no supplemental hooks |`,
  );
  mainReportLines.push(
    `| **Open Ambiguity Reports** | **${ambiguityReports.size}** | Blocked | Cards isolated in \`docs/ambiguities/\` (Inbox Zero Queue) |`,
  );
  mainReportLines.push(
    `| **False-Vanilla Violations** | **${falseVanillaViolations.length}** | ${falseVanillaViolations.length === 0 ? '🟢 0' : '🚨 ALERT'} | Cards marked \`noSupplementalNeeded\` that have printed rules text |`,
  );
  mainReportLines.push(
    `| **Overall Schema Engine Coverage** | **${coverageAudit.overallCoverageRate.toFixed(1)}%** | [Matrix](detailed_reports/schema_code_path_audit.md) | Percentage of all schema primitives with active engine code paths |`,
  );
  mainReportLines.push(
    `| **Effect Types Code Path Coverage** | **${coverageAudit.effectsCoverageRate.toFixed(1)}%** | **${coverageAudit.effectsHandledSet.size}/${EffectTypeSchema.options.length}** | [${effectsUsage.size} In Use](detailed_reports/effects_usage.md) |`,
  );
  mainReportLines.push(
    `| **Target Selectors Code Path Coverage** | **${coverageAudit.targetsCoverageRate.toFixed(1)}%** | **${coverageAudit.targetsHandledSet.size}/${TargetSelectorSchema.options.length}** | [${targetsUsage.size} In Use](detailed_reports/target_selectors_usage.md) |`,
  );
  mainReportLines.push(
    `| **Condition Gates Code Path Coverage** | **${coverageAudit.gatesCoverageRate.toFixed(1)}%** | **${coverageAudit.gatesHandledSet.size}/${ConditionGateSchema.options.length}** | [${gatesUsage.size} In Use](detailed_reports/condition_gates_usage.md) |`,
  );
  mainReportLines.push(
    `| **Step Conditions Code Path Coverage** | **${coverageAudit.stepConditionsCoverageRate.toFixed(1)}%** | **${coverageAudit.stepConditionsHandledSet.size}/${StepConditionSchema.options.length}** | [${stepConditionsUsage.size} In Use](detailed_reports/condition_gates_usage.md) |`,
  );
  mainReportLines.push(
    `| **Trigger Types Code Path Coverage** | **${coverageAudit.triggersCoverageRate.toFixed(1)}%** | **${coverageAudit.triggersHandledSet.size}/${TriggerTypeSchema.options.length}** | [${triggersUsage.size} In Use](detailed_reports/timing_and_triggers_usage.md) |`,
  );
  mainReportLines.push(
    `| **Timing Types Code Path Coverage** | **${coverageAudit.timingsCoverageRate.toFixed(1)}%** | **${coverageAudit.timingsHandledSet.size}/${TimingTypeSchema.options.length}** | [${timingsUsage.size} In Use](detailed_reports/timing_and_triggers_usage.md) |`,
  );
  mainReportLines.push(
    `| **Total Abilities Declared** | **${totalAbilitiesDeclared}** | - | Total individual ability definitions declared |`,
  );
  mainReportLines.push(
    `| **Multi-Step Pipelines (2+ Steps)** | [${totalMultiStepAbilities}](detailed_reports/multi_ability_and_multistep_cards.md) | - | Abilities decomposed into sequenced execution pipelines |`,
  );
  mainReportLines.push(
    `| **Cards with Multiple Abilities (2+)** | [${multiAbilityCards.length}](detailed_reports/multi_ability_and_multistep_cards.md) | - | Cards declaring more than 1 distinct ability header |`,
  );

  if (falseVanillaViolations.length > 0) {
    mainReportLines.push(``);
    mainReportLines.push(`---`);
    mainReportLines.push(`## 🚨 2. False-Vanilla Violations (Immediate Action Required)`);
    mainReportLines.push(``);
    mainReportLines.push(`| Card Code | Card Name | Type | Pack | Printed Rules Text |`);
    mainReportLines.push(`| :--- | :--- | :--- | :--- | :--- |`);
    for (const v of falseVanillaViolations) {
      const cleanText = v.printedText
        .replace(/\r?\n|\r/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      mainReportLines.push(
        `| \`${v.code}\` | **${v.name}** | \`${v.type}\` | \`${v.pack}\` | ${cleanText} |`,
      );
    }
  }

  mainReportLines.push(``);
  mainReportLines.push(`---`);
  mainReportLines.push(``);
  mainReportLines.push(
    `## 🔴 2. Active Ambiguity & Blocker Queue (${ambiguityReports.size} Cards)`,
  );
  mainReportLines.push(``);
  mainReportLines.push(
    `These cards are currently isolated in [\`docs/ambiguities/\`](../../ambiguities/README.md) pending rules engine primitives or targeting extensions:`,
  );
  mainReportLines.push(``);
  mainReportLines.push(
    `| Card Code | Card Name | Pack | Confidence | Blocker Category | Ambiguity Report File |`,
  );
  mainReportLines.push(`| :--- | :--- | :--- | :--- | :--- | :--- |`);
  const sortedAmbiguities = Array.from(ambiguityReports.values()).sort((a, b) =>
    a.code.localeCompare(b.code, undefined, { numeric: true }),
  );
  for (const amb of sortedAmbiguities) {
    mainReportLines.push(
      `| \`${amb.code}\` | **${amb.name}** | \`${amb.pack}\` | \`${amb.confidence}%\` | \`${amb.blockerCategory}\` | [\`${amb.filename}\`](../../ambiguities/${amb.filename}) |`,
    );
  }

  mainReportLines.push(``);
  mainReportLines.push(`---`);
  mainReportLines.push(``);
  mainReportLines.push(`## 🃏 3. Card-Level Declarations Summary`);
  mainReportLines.push(``);
  mainReportLines.push(`| Category | Active Count | Detailed Breakdown |`);
  mainReportLines.push(`| :--- | :---: | :--- |`);
  mainReportLines.push(
    `| **Vanilla / Passive Cards** | **${noSupplementalCards.length}** | [View Full List](detailed_reports/vanilla_and_passive_cards.md) |`,
  );
  mainReportLines.push(
    `| **Play Requirements** | **${playReqsUsage.size}** | ${Array.from(playReqsUsage.keys())
      .map((k) => `\`${k}\` (${playReqsUsage.get(k)!.length})`)
      .join(', ')} |`,
  );
  mainReportLines.push(
    `| **Card Uses & Counters** | **${usesUsage.size}** | ${Array.from(usesUsage.keys())
      .map((k) => `\`${k}\` (${usesUsage.get(k)!.length})`)
      .join(', ')} |`,
  );
  mainReportLines.push(
    `| **Keywords** | **${keywordsUsage.size}** | ${
      keywordsUsage.size > 0
        ? Array.from(keywordsUsage.keys())
            .map((k) => `\`${k}\` (${keywordsUsage.get(k)!.length})`)
            .join(', ')
        : '*(None declared directly in supplemental)*'
    } |`,
  );
  mainReportLines.push(
    `| **Player Recipient Overrides** | **${recipientsUsage.size}** | ${Array.from(
      recipientsUsage.keys(),
    )
      .map((k) => `\`${k}\` (${recipientsUsage.get(k)!.length})`)
      .join(', ')} |`,
  );
  mainReportLines.push(
    `| **Stat & Rule Overrides** | **${cardOverridesUsage.size}** | ${Array.from(
      cardOverridesUsage.keys(),
    )
      .map((k) => `\`${k}\` (${cardOverridesUsage.get(k)!.length})`)
      .join(', ')} |`,
  );

  mainReportLines.push(``);
  mainReportLines.push(`---`);
  mainReportLines.push(``);
  mainReportLines.push(`## ⚡ 4. Ability Headers, Timings & Triggers Summary`);
  mainReportLines.push(``);
  mainReportLines.push(`| Component | In Use | Schema Total | Coverage | Detailed Report |`);
  mainReportLines.push(`| :--- | :---: | :---: | :---: | :--- |`);
  mainReportLines.push(
    `| **Ability Timings** | **${timingsUsage.size}** | ${TimingTypeSchema.options.length} | ${coverageAudit.timingsCoverageRate.toFixed(1)}% | [View Declaring Cards](detailed_reports/timing_and_triggers_usage.md) |`,
  );
  mainReportLines.push(
    `| **Trigger Windows** | **${triggersUsage.size}** | ${TriggerTypeSchema.options.length} | ${coverageAudit.triggersCoverageRate.toFixed(1)}% | [View Declaring Cards](detailed_reports/timing_and_triggers_usage.md#2-trigger-windows-triggertypeschema) |`,
  );
  mainReportLines.push(
    `| **Trigger Filters** | **${triggerFiltersUsage.size}** | - | - | ${Array.from(
      triggerFiltersUsage.keys(),
    )
      .map((k) => `\`${k}\` (${triggerFiltersUsage.get(k)!.length})`)
      .join(', ')} |`,
  );
  mainReportLines.push(
    `| **Cost Primitives** | **${costsUsage.size}** | - | - | ${Array.from(costsUsage.keys())
      .map((k) => `\`${k}\` (${costsUsage.get(k)!.length})`)
      .join(', ')} |`,
  );
  mainReportLines.push(
    `| **Multi-Ability Cards (2+)** | **${multiAbilityCards.length}** | - | - | [View ${multiAbilityCards.length} Cards](detailed_reports/multi_ability_and_multistep_cards.md) |`,
  );

  mainReportLines.push(``);
  mainReportLines.push(`---`);
  mainReportLines.push(``);
  mainReportLines.push(`## 🎯 5. Target Selectors Summary`);
  mainReportLines.push(``);
  mainReportLines.push(`| Top Target Selectors | Occurrences | Cards Count | Link to Details |`);
  mainReportLines.push(`| :--- | :---: | :---: | :--- |`);
  for (const [target, occs] of Array.from(targetsUsage.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 10)) {
    const uniqueCount = new Set(occs.map((o) => o.code)).size;
    mainReportLines.push(
      `| \`${target}\` | **${occs.length}** | ${uniqueCount} | [Inspect Cards](detailed_reports/target_selectors_usage.md#${anchorId(target)}) |`,
    );
  }
  mainReportLines.push(``);
  mainReportLines.push(
    `> 🔗 **[View all ${targetsUsage.size} Target Selectors in Use →](detailed_reports/target_selectors_usage.md)**`,
  );

  mainReportLines.push(``);
  mainReportLines.push(`---`);
  mainReportLines.push(``);
  mainReportLines.push(`## 🚦 6. Condition Gates & Step Conditions Summary`);
  mainReportLines.push(``);
  mainReportLines.push(`| Mechanism | In Use | Schema Total | Coverage | Detailed Breakdown |`);
  mainReportLines.push(`| :--- | :---: | :---: | :---: | :--- |`);
  mainReportLines.push(
    `| **Condition Gates** | **${gatesUsage.size}** | ${ConditionGateSchema.options.length} | ${coverageAudit.gatesCoverageRate.toFixed(1)}% | [View Gates Breakdown](detailed_reports/condition_gates_usage.md#1-condition-gates-conditiongateschema) |`,
  );
  mainReportLines.push(
    `| **Step Conditions** | **${stepConditionsUsage.size}** | ${StepConditionSchema.options.length} | ${coverageAudit.stepConditionsCoverageRate.toFixed(1)}% | [View Step Conditions](detailed_reports/condition_gates_usage.md#2-step-conditions-stepconditionschema) |`,
  );
  mainReportLines.push(
    `| **Gate Parameters** | **${gateParamsUsage.size}** | - | - | ${Array.from(
      gateParamsUsage.keys(),
    )
      .map((k) => `\`${k}\` (${gateParamsUsage.get(k)!.length})`)
      .join(', ')} |`,
  );

  mainReportLines.push(``);
  mainReportLines.push(`---`);
  mainReportLines.push(``);
  mainReportLines.push(`## 💥 7. Effect Primitives Summary`);
  mainReportLines.push(``);
  mainReportLines.push(`### High-Impact Effects (Blast Radius $\\ge 5$ Cards):`);
  mainReportLines.push(``);
  mainReportLines.push(`| Effect Primitive | Declaring Cards | Occurrences | Detailed Card List |`);
  mainReportLines.push(`| :--- | :---: | :---: | :--- |`);
  const highImpact = Array.from(effectsUsage.entries())
    .map(([eff, occs]) => ({
      eff,
      uniqueCards: new Set(occs.map((o) => o.code)).size,
      totalOccs: occs.length,
    }))
    .filter((e) => e.uniqueCards >= 5)
    .sort((a, b) => b.uniqueCards - a.uniqueCards);

  for (const h of highImpact) {
    mainReportLines.push(
      `| \`${h.eff}\` | **${h.uniqueCards} cards** | ${h.totalOccs} steps | [View Cards](detailed_reports/effects_usage.md#${anchorId(h.eff)}) |`,
    );
  }
  mainReportLines.push(``);
  mainReportLines.push(
    `> 🔗 **[View all ${effectsUsage.size} Effects in Use →](detailed_reports/effects_usage.md)**`,
  );

  mainReportLines.push(``);
  mainReportLines.push(`---`);
  mainReportLines.push(``);
  mainReportLines.push(`## 🔍 8. Dynamic Values & Universal Filters Summary`);
  mainReportLines.push(``);
  mainReportLines.push(`| Feature | In Use | Declared Keys / Resolvers |`);
  mainReportLines.push(`| :--- | :---: | :--- |`);
  mainReportLines.push(
    `| **Dynamic Value Sources** | **${dynamicValuesUsage.size}** | ${Array.from(
      dynamicValuesUsage.keys(),
    )
      .slice(0, 6)
      .map((k) => `\`${k}\``)
      .join(
        ', ',
      )}${dynamicValuesUsage.size > 6 ? ` *(+${dynamicValuesUsage.size - 6} more)*` : ''} |`,
  );
  mainReportLines.push(
    `| **Filter Criteria Keys** | **${filterCriteriaUsage.size}** | ${Array.from(
      filterCriteriaUsage.keys(),
    )
      .map((k) => `\`${k}\` (${filterCriteriaUsage.get(k)!.length})`)
      .join(', ')} |`,
  );
  mainReportLines.push(
    `| **Filter Compositions** | **${filterCompositionsUsage.size}** | ${
      filterCompositionsUsage.size > 0
        ? Array.from(filterCompositionsUsage.keys())
            .map((k) => `\`${k}\` (${filterCompositionsUsage.get(k)!.length})`)
            .join(', ')
        : '*(None declared)*'
    } |`,
  );

  mainReportLines.push(``);
  mainReportLines.push(`---`);
  mainReportLines.push(``);
  mainReportLines.push(`## ⚠️ 9. Code Path Verification & Zero-Usage Detection`);
  mainReportLines.push(``);
  mainReportLines.push(
    `Every schema primitive is verified for a matching engine handler. Check the complete **[Schema Primitives Code Path Matrix](detailed_reports/schema_code_path_audit.md)** for status on all ${EffectTypeSchema.options.length + TargetSelectorSchema.options.length + ConditionGateSchema.options.length + StepConditionSchema.options.length + TriggerTypeSchema.options.length + TimingTypeSchema.options.length} schema definitions.`,
  );
  mainReportLines.push(``);
  mainReportLines.push(`### Summary of Unhandled or Zero-Usage Primitives:`);
  mainReportLines.push(
    `| Category | Schema Total | Unused in Cards (0 Cards) | Missing Engine Handler |`,
  );
  mainReportLines.push(`| :--- | :---: | :---: | :---: |`);
  mainReportLines.push(
    `| **Effects** | ${EffectTypeSchema.options.length} | ${EffectTypeSchema.options.length - effectsUsage.size} | ${coverageAudit.unhandledEffects.length === 0 ? '🟢 0' : `🔴 ${coverageAudit.unhandledEffects.length}`} |`,
  );
  mainReportLines.push(
    `| **Targets** | ${TargetSelectorSchema.options.length} | ${TargetSelectorSchema.options.length - targetsUsage.size} | ${coverageAudit.unhandledTargets.length === 0 ? '🟢 0' : `🔴 ${coverageAudit.unhandledTargets.length}`} |`,
  );
  mainReportLines.push(
    `| **Gates** | ${ConditionGateSchema.options.length} | ${ConditionGateSchema.options.length - gatesUsage.size} | ${coverageAudit.unhandledGates.length === 0 ? '🟢 0' : `🔴 ${coverageAudit.unhandledGates.length}`} |`,
  );
  mainReportLines.push(
    `| **Step Conditions** | ${StepConditionSchema.options.length} | ${StepConditionSchema.options.length - stepConditionsUsage.size} | ${coverageAudit.unhandledStepConditions.length === 0 ? '🟢 0' : `⚠️ ${coverageAudit.unhandledStepConditions.length} (${coverageAudit.unhandledStepConditions.join(', ')})`} |`,
  );
  mainReportLines.push(
    `| **Triggers** | ${TriggerTypeSchema.options.length} | ${TriggerTypeSchema.options.length - triggersUsage.size} | ${coverageAudit.unhandledTriggers.length === 0 ? '🟢 0' : `🔴 ${coverageAudit.unhandledTriggers.length}`} |`,
  );
  mainReportLines.push(
    `| **Timings** | ${TimingTypeSchema.options.length} | ${TimingTypeSchema.options.length - timingsUsage.size} | ${coverageAudit.unhandledTimings.length === 0 ? '🟢 0' : `🔴 ${coverageAudit.unhandledTimings.length}`} |`,
  );

  fs.writeFileSync(MAIN_REPORT_PATH, mainReportLines.join('\n'), 'utf-8');

  // =========================================================================
  // LEGACY POINTER
  // =========================================================================
  const legacyPointerContent = [
    `# Supplemental Card Declarations Usage & Impact Report`,
    ``,
    `> **NOTICE:** This report has moved to a scalable, modular format:`,
    `> 👉 **[docs/reports/supplemental_data/usage_report.md](supplemental_data/usage_report.md)**`,
    ``,
    `### Detailed Reports:`,
    `- [Vanilla & Passive Cards](supplemental_data/detailed_reports/vanilla_and_passive_cards.md)`,
    `- [Multi-Ability & Multi-Step Pipelines](supplemental_data/detailed_reports/multi_ability_and_multistep_cards.md)`,
    `- [Effects Usage Inventory](supplemental_data/detailed_reports/effects_usage.md)`,
    `- [Target Selectors Usage Inventory](supplemental_data/detailed_reports/target_selectors_usage.md)`,
    `- [Timing & Triggers Inventory](supplemental_data/detailed_reports/timing_and_triggers_usage.md)`,
    `- [Condition Gates & Step Conditions Inventory](supplemental_data/detailed_reports/condition_gates_usage.md)`,
    `- [Schema Primitives Code Path Verification Matrix](supplemental_data/detailed_reports/schema_code_path_audit.md)`,
    ``,
  ].join('\n');
  fs.writeFileSync(LEGACY_POINTER_PATH, legacyPointerContent, 'utf-8');

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
  console.log(`Overall Code Path Coverage: ${coverageAudit.overallCoverageRate.toFixed(1)}%`);
  console.log(`Main Report Written To:     ${MAIN_REPORT_PATH}`);
  console.log(`Detailed Reports Dir:       ${DETAILED_REPORTS_DIR}`);
  console.log(`========================================================\n`);
}

// Execute if run directly via tsx / node
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runDeclarationsAudit();
}
