import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  EffectTypeSchema,
  TriggerTypeSchema,
  TimingTypeSchema,
} from '../../src/data/supplemental/schema';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../');

/**
 * Recognized passive or evaluative effects handled outside executeEffect in specialized pipelines:
 * - MODIFY_HAND_SIZE: evaluated dynamically in stat-calculator.ts
 * - MODIFY_MAX_HEALTH: evaluated in stat-calculator.ts and action-dispatcher.ts
 * - ADD_TRAIT: evaluated dynamically in stat-calculator.ts
 * - COST_REDUCER: evaluated in cost-engine.ts
 * - DOUBLE_RESOURCE_FOR_ASPECT: evaluated in cost-engine.ts and legality-checker.ts
 * - RESTRICTED_LIMIT_BONUS: evaluated in legality-checker.ts
 */
export const RECOGNIZED_PASSIVE_EFFECTS = new Set<string>([
  'MODIFY_HAND_SIZE',
  'MODIFY_MAX_HEALTH',
  'ADD_TRAIT',
  'COST_REDUCER',
  'DOUBLE_RESOURCE_FOR_ASPECT',
  'RESTRICTED_LIMIT_BONUS',
]);

/**
 * Recognized legacy aliases in executeEffect:
 * - DISCARD_CARDS: alias for DISCARD
 */
export const RECOGNIZED_EFFECT_ALIASES = new Set<string>(['DISCARD_CARDS']);

/**
 * Extracts only top-level case 'XYZ': clauses in switch (step.effect).
 * Tracks curly brace depth so nested switches (e.g. switch (zone)) are ignored.
 */
export function extractExecuteEffectCases(effectsFilePath: string): Set<string> {
  const content = fs.readFileSync(effectsFilePath, 'utf8');

  const fnIndex = content.indexOf('export function executeEffect(');
  if (fnIndex === -1) {
    throw new Error('executeEffect function not found in ' + effectsFilePath);
  }

  const switchPattern = 'switch (step.effect) {';
  const switchIndex = content.indexOf(switchPattern, fnIndex);
  if (switchIndex === -1) {
    throw new Error('switch (step.effect) not found in executeEffect');
  }

  const cases = new Set<string>();
  let depth = 0;
  let pos = switchIndex + switchPattern.length - 1; // pointing at opening '{'

  // Tokenize scan
  const len = content.length;
  while (pos < len) {
    const char = content[pos];

    if (char === '{') {
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0) {
        // End of top-level switch (step.effect)
        break;
      }
    } else if (depth === 1) {
      // At top-level of switch (step.effect)
      if (content.startsWith('case ', pos)) {
        const caseMatch = content.slice(pos).match(/^case\s+'([A-Z0-9_]+)':/);
        if (caseMatch) {
          cases.add(caseMatch[1]);
          pos += caseMatch[0].length - 1;
        }
      }
    }

    pos++;
  }

  return cases;
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

export function auditSchemaEngineCoverage(): {
  success: boolean;
  unhandledEffects: string[];
  orphanEffectCases: string[];
  unhandledTriggers: string[];
  unhandledTimings: string[];
} {
  const effectsFilePath = path.join(ROOT_DIR, 'src/engine/effects/index.ts');
  const engineDir = path.join(ROOT_DIR, 'src/engine');

  const executeEffectCases = extractExecuteEffectCases(effectsFilePath);
  const schemaEffects = EffectTypeSchema.options;

  // 1. Effects Audit
  const unhandledEffects = schemaEffects.filter(
    (effect) => !executeEffectCases.has(effect) && !RECOGNIZED_PASSIVE_EFFECTS.has(effect),
  );

  const orphanEffectCases = [...executeEffectCases].filter(
    (effectCase) =>
      !(schemaEffects as readonly string[]).includes(effectCase) &&
      !RECOGNIZED_EFFECT_ALIASES.has(effectCase),
  );

  // 2. Triggers Audit
  const engineFiles = getAllTsFiles(engineDir);
  let allEngineCode = '';
  for (const f of engineFiles) {
    allEngineCode += fs.readFileSync(f, 'utf8') + '\n';
  }

  const schemaTriggers = TriggerTypeSchema.options;
  const unhandledTriggers = schemaTriggers.filter(
    (t) => !allEngineCode.includes(`'${t}'`) && !allEngineCode.includes(`"${t}"`),
  );

  // 3. Timings Audit
  const schemaTimings = TimingTypeSchema.options;
  const unhandledTimings = schemaTimings.filter(
    (t) => !allEngineCode.includes(`'${t}'`) && !allEngineCode.includes(`"${t}"`),
  );

  const success =
    unhandledEffects.length === 0 &&
    orphanEffectCases.length === 0 &&
    unhandledTriggers.length === 0 &&
    unhandledTimings.length === 0;

  return {
    success,
    unhandledEffects,
    orphanEffectCases,
    unhandledTriggers,
    unhandledTimings,
  };
}

if (process.argv[1] && process.argv[1].endsWith('schema-engine-coverage.ts')) {
  console.log('========================================================');
  console.log('🔍 SUPPLEMENTAL SCHEMA <-> ENGINE COVERAGE AUDIT');
  console.log('========================================================');

  const result = auditSchemaEngineCoverage();

  console.log(`\n1. Effect Types (${EffectTypeSchema.options.length} in schema):`);
  if (result.unhandledEffects.length === 0) {
    console.log('   ✅ 100% of schema effects mapped to engine execution paths.');
  } else {
    console.log(
      `   ❌ ${result.unhandledEffects.length} unhandled effects in engine:`,
      result.unhandledEffects,
    );
  }

  if (result.orphanEffectCases.length === 0) {
    console.log('   ✅ 0 orphan switch cases in executeEffect.');
  } else {
    console.log(
      `   ❌ ${result.orphanEffectCases.length} orphan cases in executeEffect:`,
      result.orphanEffectCases,
    );
  }

  console.log(`\n2. Trigger Types (${TriggerTypeSchema.options.length} in schema):`);
  if (result.unhandledTriggers.length === 0) {
    console.log('   ✅ 100% of schema triggers mapped to engine dispatch/listeners.');
  } else {
    console.log(
      `   ❌ ${result.unhandledTriggers.length} unhandled triggers in engine:`,
      result.unhandledTriggers,
    );
  }

  console.log(`\n3. Timing Types (${TimingTypeSchema.options.length} in schema):`);
  if (result.unhandledTimings.length === 0) {
    console.log('   ✅ 100% of schema timings mapped to engine evaluation paths.');
  } else {
    console.log(
      `   ❌ ${result.unhandledTimings.length} unhandled timings in engine:`,
      result.unhandledTimings,
    );
  }

  console.log('\n========================================================');
  if (result.success) {
    console.log('🎉 AUDIT PASSED: Perfect bidirectional schema-engine alignment!');
    console.log('========================================================');
    process.exit(0);
  } else {
    console.log('💥 AUDIT FAILED: Discrepancies detected between schema and engine.');
    console.log('========================================================');
    process.exit(1);
  }
}
