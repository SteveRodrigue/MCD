import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  EffectTypeSchema,
  TriggerTypeSchema,
  TimingTypeSchema,
  TargetSelectorSchema,
  StepGateSchema,
} from '../../src/data/supplemental/schema';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../');

/**
 * Recognized passive or evaluative effects handled outside executeEffect in specialized pipelines:
 * - MODIFY_HAND_SIZE: evaluated dynamically in stat-calculator.ts
 * - MODIFY_MAX_HEALTH: evaluated in stat-calculator.ts and action-dispatcher.ts
 * - ADD_TRAIT: evaluated dynamically in stat-calculator.ts
 * - DOUBLE_RESOURCE_FOR_ASPECT: evaluated in cost-engine.ts and legality-checker.ts
 * - MODIFY_RESTRICTED_LIMIT: evaluated in legality-checker.ts
 */
export const RECOGNIZED_PASSIVE_EFFECTS = new Set<string>([
  'MODIFY_HAND_SIZE',
  'MODIFY_MAX_HEALTH',
  'ADD_TRAIT',
  'DOUBLE_RESOURCE_FOR_ASPECT',
  'MODIFY_RESTRICTED_LIMIT',
  'CANNOT_TAKE_DAMAGE',
  'RESTRICT_DEFENSE',
]);

/**
 * Recognized legacy aliases in executeEffect:
 * - DISCARD_CARDS: alias for DISCARD
 */
export const RECOGNIZED_EFFECT_ALIASES = new Set<string>(['DISCARD_CARDS']);

/**
 * Effects that have a step handler: the keys of the `*_HANDLERS` objects in
 * `src/engine/effects/handlers/` (the registry executeStep dispatches through, F010-A).
 */
export function extractEffectHandlerKeys(handlersDir: string): Set<string> {
  const keys = new Set<string>();
  for (const file of fs.readdirSync(handlersDir)) {
    const content = fs.readFileSync(path.join(handlersDir, file), 'utf8');
    for (const block of content.matchAll(/export const \w+_HANDLERS = \{([^}]*)\}/g)) {
      for (const key of block[1].matchAll(/^\s*([A-Z0-9_]+):/gm)) keys.add(key[1]);
    }
  }
  return keys;
}

export function extractTargetResolverCases(targetResolverPath: string): Set<string> {
  const content = fs.readFileSync(targetResolverPath, 'utf8');
  const cases = new Set<string>();
  const matches = content.matchAll(/case\s+'([A-Z0-9_]+)':/g);
  for (const m of matches) {
    cases.add(m[1]);
  }
  return cases;
}

export function extractConditionGateEvaluatorCases(evaluatorPath: string): Set<string> {
  const content = fs.readFileSync(evaluatorPath, 'utf8');
  const gates = new Set<string>();

  const matches = content.matchAll(/(?:gate\s*===?\s*'|case\s+')([A-Z0-9_]+)'/g);
  for (const m of matches) {
    gates.add(m[1]);
  }
  return gates;
}

export function extractStepConditionEvaluatorCases(
  effectsPath: string,
  gateEvaluatorPath: string,
): Set<string> {
  const conditions = new Set<string>();
  const effectsContent = fs.readFileSync(effectsPath, 'utf8');
  const gateContent = fs.readFileSync(gateEvaluatorPath, 'utf8');

  for (const content of [effectsContent, gateContent]) {
    const matches = content.matchAll(/step\.condition\s*===?\s*'([A-Z0-9_]+)'/g);
    for (const m of matches) {
      conditions.add(m[1]);
    }
  }

  return conditions;
}

export function getAllTsFiles(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllTsFiles(fullPath));
    } else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

export interface DetailedCoverageResult {
  success: boolean;
  unhandledEffects: string[];
  orphanEffectCases: string[];
  unhandledTriggers: string[];
  unhandledTimings: string[];
  unhandledTargets: string[];
  unhandledGates: string[];
  unhandledStepConditions: string[];
  effectsCoverageRate: number;
  targetsCoverageRate: number;
  gatesCoverageRate: number;
  stepConditionsCoverageRate: number;
  triggersCoverageRate: number;
  timingsCoverageRate: number;
  overallCoverageRate: number;
  effectsHandledSet: Set<string>;
  targetsHandledSet: Set<string>;
  gatesHandledSet: Set<string>;
  stepConditionsHandledSet: Set<string>;
  triggersHandledSet: Set<string>;
  timingsHandledSet: Set<string>;
}

export function auditSchemaEngineCoverage(): DetailedCoverageResult {
  const handlersDir = path.join(ROOT_DIR, 'src/engine/effects/handlers');
  const targetResolverPath = path.join(ROOT_DIR, 'src/engine/effects/target-resolver.ts');
  const gateEvaluatorPath = path.join(ROOT_DIR, 'src/engine/pipeline/step-gate-evaluator.ts');
  const engineDir = path.join(ROOT_DIR, 'src/engine');

  // 1. Effects
  const executeEffectCases = extractEffectHandlerKeys(handlersDir);
  const schemaEffects = EffectTypeSchema.options;
  const effectsHandledSet = new Set<string>();

  for (const eff of schemaEffects) {
    if (executeEffectCases.has(eff) || RECOGNIZED_PASSIVE_EFFECTS.has(eff)) {
      effectsHandledSet.add(eff);
    }
  }

  const unhandledEffects = schemaEffects.filter((eff) => !effectsHandledSet.has(eff));
  const orphanEffectCases = [...executeEffectCases].filter(
    (effectCase) =>
      !(schemaEffects as readonly string[]).includes(effectCase) &&
      !RECOGNIZED_EFFECT_ALIASES.has(effectCase),
  );

  // 2. Targets
  const targetResolverCases = extractTargetResolverCases(targetResolverPath);
  const schemaTargets = TargetSelectorSchema.options;
  const targetsHandledSet = new Set<string>();

  for (const tgt of schemaTargets) {
    if (targetResolverCases.has(tgt)) {
      targetsHandledSet.add(tgt);
    }
  }
  const unhandledTargets = schemaTargets.filter((tgt) => !targetsHandledSet.has(tgt));

  // 3. Step Gates
  const gateEvaluatorCases = extractConditionGateEvaluatorCases(gateEvaluatorPath);
  const schemaGates = StepGateSchema.options;
  const gatesHandledSet = new Set<string>();

  for (const g of schemaGates) {
    if (gateEvaluatorCases.has(g)) {
      gatesHandledSet.add(g);
    }
  }
  const unhandledGates = schemaGates.filter((g: string) => !gatesHandledSet.has(g));

  // 4. Step Conditions (Retired in ADR-0080)
  const schemaStepConditions: string[] = [];
  const stepConditionsHandledSet = new Set<string>();
  const unhandledStepConditions: string[] = [];

  // 5. Triggers & Timings
  // The TypeScript copy of the schema enums is not a dispatcher: exclude it (#276).
  const engineFiles = getAllTsFiles(engineDir).filter(
    (f) => !f.split(path.sep).join('/').endsWith('src/engine/models/abilities.ts'),
  );
  let allEngineCode = '';
  for (const f of engineFiles) {
    allEngineCode += fs.readFileSync(f, 'utf8') + '\n';
  }

  const schemaTriggers = TriggerTypeSchema.options;
  const triggersHandledSet = new Set<string>();
  for (const t of schemaTriggers) {
    if (allEngineCode.includes(`'${t}'`) || allEngineCode.includes(`"${t}"`)) {
      triggersHandledSet.add(t);
    }
  }
  const unhandledTriggers = schemaTriggers.filter((t) => !triggersHandledSet.has(t));

  const schemaTimings = TimingTypeSchema.options;
  const timingsHandledSet = new Set<string>();
  for (const t of schemaTimings) {
    if (allEngineCode.includes(`'${t}'`) || allEngineCode.includes(`"${t}"`)) {
      timingsHandledSet.add(t);
    }
  }
  const unhandledTimings = schemaTimings.filter((t) => !timingsHandledSet.has(t));

  const totalSchemaItems =
    schemaEffects.length +
    schemaTargets.length +
    schemaGates.length +
    schemaStepConditions.length +
    schemaTriggers.length +
    schemaTimings.length;

  const totalHandledItems =
    effectsHandledSet.size +
    targetsHandledSet.size +
    gatesHandledSet.size +
    stepConditionsHandledSet.size +
    triggersHandledSet.size +
    timingsHandledSet.size;

  const effectsCoverageRate = (effectsHandledSet.size / schemaEffects.length) * 100;
  const targetsCoverageRate = (targetsHandledSet.size / schemaTargets.length) * 100;
  const gatesCoverageRate = (gatesHandledSet.size / schemaGates.length) * 100;
  const stepConditionsCoverageRate =
    schemaStepConditions.length > 0
      ? (stepConditionsHandledSet.size / schemaStepConditions.length) * 100
      : 100;
  const triggersCoverageRate = (triggersHandledSet.size / schemaTriggers.length) * 100;
  const timingsCoverageRate = (timingsHandledSet.size / schemaTimings.length) * 100;
  const overallCoverageRate = (totalHandledItems / totalSchemaItems) * 100;

  const success =
    unhandledEffects.length === 0 &&
    orphanEffectCases.length === 0 &&
    unhandledTriggers.length === 0 &&
    unhandledTimings.length === 0 &&
    unhandledTargets.length === 0 &&
    unhandledGates.length === 0;

  return {
    success,
    unhandledEffects,
    orphanEffectCases,
    unhandledTriggers,
    unhandledTimings,
    unhandledTargets,
    unhandledGates,
    unhandledStepConditions,
    effectsCoverageRate,
    targetsCoverageRate,
    gatesCoverageRate,
    stepConditionsCoverageRate,
    triggersCoverageRate,
    timingsCoverageRate,
    overallCoverageRate,
    effectsHandledSet,
    targetsHandledSet,
    gatesHandledSet,
    stepConditionsHandledSet,
    triggersHandledSet,
    timingsHandledSet,
  };
}

if (process.argv[1] && process.argv[1].endsWith('schema-engine-coverage.ts')) {
  console.log('========================================================');
  console.log('🔍 SUPPLEMENTAL SCHEMA <-> ENGINE COVERAGE AUDIT');
  console.log('========================================================');

  const result = auditSchemaEngineCoverage();

  console.log(`\n1. Effect Types (${EffectTypeSchema.options.length} in schema):`);
  console.log(
    `   ${result.unhandledEffects.length === 0 ? '✅' : '❌'} Coverage: ${result.effectsCoverageRate.toFixed(1)}% (${result.effectsHandledSet.size}/${EffectTypeSchema.options.length})`,
  );
  if (result.unhandledEffects.length > 0) {
    console.log('   Unhandled:', result.unhandledEffects);
  }

  console.log(`\n2. Target Selectors (${TargetSelectorSchema.options.length} in schema):`);
  console.log(
    `   ${result.unhandledTargets.length === 0 ? '✅' : '❌'} Coverage: ${result.targetsCoverageRate.toFixed(1)}% (${result.targetsHandledSet.size}/${TargetSelectorSchema.options.length})`,
  );
  if (result.unhandledTargets.length > 0) {
    console.log('   Unhandled:', result.unhandledTargets);
  }

  console.log(`\n3. Step Gates (${StepGateSchema.options.length} in schema):`);
  console.log(
    `   ${result.unhandledGates.length === 0 ? '✅' : '❌'} Coverage: ${result.gatesCoverageRate.toFixed(1)}% (${result.gatesHandledSet.size}/${StepGateSchema.options.length})`,
  );
  if (result.unhandledGates.length > 0) {
    console.log('   Unhandled:', result.unhandledGates);
  }

  console.log(`\n4. Step Conditions (Retired in ADR-0080):`);
  console.log(`   ✅ Retired (consolidated into StepGateSchema + gateParams)`);

  console.log(`\n5. Trigger Types (${TriggerTypeSchema.options.length} in schema):`);
  console.log(
    `   ${result.unhandledTriggers.length === 0 ? '✅' : '❌'} Coverage: ${result.triggersCoverageRate.toFixed(1)}% (${result.triggersHandledSet.size}/${TriggerTypeSchema.options.length})`,
  );

  console.log(`\n6. Timing Types (${TimingTypeSchema.options.length} in schema):`);
  console.log(
    `   ${result.unhandledTimings.length === 0 ? '✅' : '❌'} Coverage: ${result.timingsCoverageRate.toFixed(1)}% (${result.timingsHandledSet.size}/${TimingTypeSchema.options.length})`,
  );

  console.log('\n========================================================');
  console.log(`OVERALL SCHEMA-ENGINE COVERAGE: ${result.overallCoverageRate.toFixed(1)}%`);
  console.log('========================================================');
  if (result.success) {
    console.log('🎉 AUDIT PASSED: Perfect bidirectional schema-engine alignment!');
    process.exit(0);
  } else {
    console.log('💥 AUDIT FAILED: Discrepancies detected between schema and engine.');
    process.exit(1);
  }
}
