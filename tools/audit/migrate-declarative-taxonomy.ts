import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const PACK_DIR = path.join(ROOT_DIR, 'src/data/supplemental/pack');

const TRIGGER_RENAMES: Record<string, string> = {
  VILLAIN_INITIATES_ATTACK: 'ENEMY_INITIATES_ATTACK',
  TAKE_ATTACK_DAMAGE: 'DAMAGE_WOULD_BE_TAKEN',
  TAKE_DAMAGE: 'DAMAGE_WOULD_BE_TAKEN',
  HERO_DEFENDED_ATTACK: 'ATTACK_DEFENDED',
  MINION_DEFEATED: 'CHARACTER_DEFEATED',
  MINION_DEFEATED_BY_ATTACK: 'CHARACTER_DEFEATED',
  ENEMY_DEFEATED_BY_HERO_ATTACK: 'DEFEATED',
  HOST_DEFEATED: 'CHARACTER_DEFEATED',
  SCHEME_THREAT_REDUCED_TO_ZERO: 'SCHEME_DEFEATED',
  FORM_CHANGED_TO_HERO: 'FORM_CHANGED',
  FORM_CHANGED_TO_ALTER_EGO: 'FORM_CHANGED',
  HERO_FLIPPED: 'FORM_CHANGED',
};

const EFFECT_RENAMES: Record<string, string> = {
  DRAW_CARDS: 'DRAW',
  PLAY_CARD_FROM_ZONE: 'PLAY_FROM_ZONE',
  SEARCH_AND_SELECT: 'SEARCH',
};

const TARGET_RENAMES: Record<string, string> = {
  SIDE_SCHEME: 'CHOSEN_SIDE_SCHEME',
};

const RECONSTRUCTED_RENAMES = {
  ...TRIGGER_RENAMES,
  ...EFFECT_RENAMES,
};

interface Change {
  path: string;
  before: unknown;
  after: unknown;
}

interface Blocker {
  path: string;
  effect: string;
  reason: string;
}

interface TransformResult {
  value: any;
  changes: Change[];
  blockers: Blocker[];
}

function renameString(value: unknown, map: Record<string, string>): unknown {
  return typeof value === 'string' ? map[value] || value : value;
}

function renameText(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  let result = value;
  for (const [legacy, canonical] of Object.entries(RECONSTRUCTED_RENAMES).sort(
    ([left], [right]) => right.length - left.length,
  )) {
    result = result.replaceAll(legacy, canonical);
  }
  return result;
}

function clone(value: any): any {
  return JSON.parse(JSON.stringify(value));
}

function transformNested(
  value: any,
  currentPath: string,
  changes: Change[],
  blockers: Blocker[],
): any {
  if (Array.isArray(value)) {
    return value.map((item, index) =>
      transformNested(item, `${currentPath}[${index}]`, changes, blockers),
    );
  }
  if (!value || typeof value !== 'object') return value;

  const result: Record<string, any> = {};
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${currentPath}.${key}`;
    if (key === 'target' || key === 'exhaustCard') {
      const renamed = renameString(child, TARGET_RENAMES);
      if (renamed !== child) changes.push({ path: childPath, before: child, after: renamed });
      result[key] = renamed;
    } else if (key === 'effect') {
      const renamed = renameString(child, EFFECT_RENAMES);
      if (renamed !== child) changes.push({ path: childPath, before: child, after: renamed });
      result[key] = renamed;
    } else if (key === 'trigger') {
      const renamed = renameString(child, TRIGGER_RENAMES);
      if (renamed !== child) changes.push({ path: childPath, before: child, after: renamed });
      result[key] = renamed;
    } else {
      result[key] = transformNested(child, childPath, changes, blockers);
    }
  }
  return result;
}

function makeStep(effect: string, params?: Record<string, unknown>): Record<string, unknown> {
  return params && Object.keys(params).length > 0 ? { effect, params } : { effect };
}

function transformSpecialStep(
  step: Record<string, any>,
  stepPath: string,
  changes: Change[],
  blockers: Blocker[],
): Record<string, any> | Record<string, any>[] {
  const effect = step.effect;
  if (effect === 'FORM_BRANCH_VILLAIN_ATTACK_OR_SURGE') {
    const transformed = {
      ...step,
      effect: 'FORM_BRANCH',
      params: {
        heroSteps: [makeStep('VILLAIN_ATTACKS')],
        alterEgoSteps: [makeStep('TRIGGER_SURGE')],
      },
    };
    changes.push({ path: `${stepPath}.effect`, before: effect, after: 'FORM_BRANCH' });
    changes.push({
      path: `${stepPath}.params`,
      before: step.params || {},
      after: transformed.params,
    });
    return transformed;
  }

  if (effect === 'EXPLOSION') {
    blockers.push({
      path: stepPath,
      effect,
      reason: 'Bomb Scare threat-dependent damage and no-Bomb-Scare surge semantics are not represented by the current composable schema.',
    });
    return step;
  }

  if (effect === 'RETRIEVE_CARD_FROM_DISCARD' || effect === 'RETRIEVE_TECH_UPGRADE_FROM_DISCARD') {
    const filter: Record<string, unknown> = { ...(step.params?.filter || {}) };
    if (step.params?.trait) filter.traits = [step.params.trait];
    if (step.params?.type || step.params?.type_code) {
      filter.types = [step.params.type || step.params.type_code];
    }
    changes.push({ path: `${stepPath}.effect`, before: effect, after: 'SEARCH' });
    changes.push({
      path: `${stepPath}.params`,
      before: step.params || {},
      after: {
        source: 'PLAYER_DISCARD',
        filter,
        takeCount: 1,
        selectedDestination: 'HAND',
        autoSelectIfUnambiguous: true,
      },
    });
    return {
      ...step,
      effect: 'SEARCH',
      params: {
        source: 'PLAYER_DISCARD',
        filter,
        takeCount: 1,
        selectedDestination: 'HAND',
        autoSelectIfUnambiguous: true,
      },
    };
  }

  if (effect === 'HULK_DISCARD_RESOLUTION') {
    blockers.push({
      path: stepPath,
      effect,
      reason: 'Resource-icon branching requires a schema/engine capability not present in Phase 2.',
    });
  }

  if (effect === 'REPULSOR_BLAST' || effect === 'REPULSOR_BLAST_DAMAGE') {
    blockers.push({
      path: stepPath,
      effect,
      reason:
        'Discarded-energy-count evaluation requires a schema/engine capability not present in Phase 2.',
    });
  }

  return step;
}

function transformStep(
  rawStep: Record<string, any>,
  stepPath: string,
  changes: Change[],
  blockers: Blocker[],
): any[] {
  const step = clone(rawStep);
  const special = transformSpecialStep(step, stepPath, changes, blockers);
  const steps = Array.isArray(special) ? special : [special];

  return steps.map((candidate, index) => {
    const pathPrefix = steps.length > 1 ? `${stepPath}[${index}]` : stepPath;
    const transformed = transformNested(candidate, pathPrefix, changes, blockers);
    if (transformed.effect) {
      const renamedEffect = renameString(transformed.effect, EFFECT_RENAMES);
      if (renamedEffect !== transformed.effect) {
        changes.push({
          path: `${pathPrefix}.effect`,
          before: transformed.effect,
          after: renamedEffect,
        });
        transformed.effect = renamedEffect;
      }
      if (transformed.effect === 'SEARCH') {
        transformed.params = {
          ...(transformed.params || {}),
          autoSelectIfUnambiguous: transformed.params?.autoSelectIfUnambiguous !== false,
        };
      }
    }
    return transformed;
  });
}

function transformAbility(
  rawAbility: Record<string, any>,
  abilityPath: string,
  changes: Change[],
  blockers: Blocker[],
): any {
  const ability = clone(rawAbility);
  if (ability.trigger) {
    const renamedTrigger = renameString(ability.trigger, TRIGGER_RENAMES);
    if (renamedTrigger !== ability.trigger) {
      changes.push({
        path: `${abilityPath}.trigger`,
        before: ability.trigger,
        after: renamedTrigger,
      });
      ability.trigger = renamedTrigger;
    }
  }

  const sourceSteps = Array.isArray(ability.steps)
    ? ability.steps
    : Array.isArray(ability.sequence)
      ? ability.sequence
      : [];
  if (Array.isArray(ability.steps)) {
    ability.steps = sourceSteps.flatMap((step: Record<string, any>, index: number) =>
      transformStep(step, `${abilityPath}.steps[${index}]`, changes, blockers),
    );
  } else if (Array.isArray(ability.sequence)) {
    ability.sequence = sourceSteps.flatMap((step: Record<string, any>, index: number) =>
      transformStep(step, `${abilityPath}.sequence[${index}]`, changes, blockers),
    );
  }

  if (ability.audit?.reconstructedText) {
    const renamedText = renameText(ability.audit.reconstructedText);
    if (renamedText !== ability.audit.reconstructedText) {
      changes.push({
        path: `${abilityPath}.audit.reconstructedText`,
        before: ability.audit.reconstructedText,
        after: renamedText,
      });
      ability.audit.reconstructedText = renamedText;
    }
  }
  return ability;
}

function transformPack(content: any, fileName: string): TransformResult {
  const output = clone(content);
  const cards = output.cards || output;
  const changes: Change[] = [];
  const blockers: Blocker[] = [];

  for (const [code, card] of Object.entries(cards) as [string, any][]) {
    if (card.audit?.reconstructedText) {
      const renamedText = renameText(card.audit.reconstructedText);
      if (renamedText !== card.audit.reconstructedText) {
        changes.push({
          path: `${fileName}.cards.${code}.audit.reconstructedText`,
          before: card.audit.reconstructedText,
          after: renamedText,
        });
        card.audit.reconstructedText = renamedText;
      }
    }
    if (!Array.isArray(card.abilities)) continue;
    card.abilities = card.abilities.map((ability: any, index: number) =>
      transformAbility(ability, `${fileName}.cards.${code}.abilities[${index}]`, changes, blockers),
    );
  }

  return { value: output, changes, blockers };
}

function parseArgs() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const write = args.includes('--write');
  const allowBlockers = args.includes('--allow-blockers');
  const fileIndex = args.indexOf('--file');
  const fileName = fileIndex >= 0 ? args[fileIndex + 1] : undefined;
  if (!dryRun && !write) {
    throw new Error('Choose exactly one mode: --dry-run or --write.');
  }
  if (dryRun && write) throw new Error('Choose only one mode: --dry-run or --write.');
  return { dryRun, write, allowBlockers, fileName };
}

function selectedFiles(fileName?: string): string[] {
  if (fileName) {
    if (!fileName.endsWith('.json')) throw new Error(`Expected a JSON pack filename: ${fileName}`);
    const target = path.join(PACK_DIR, fileName);
    if (!fs.existsSync(target)) throw new Error(`Pack not found: ${fileName}`);
    return [fileName];
  }
  return fs
    .readdirSync(PACK_DIR)
    .filter((file) => file.endsWith('.json'))
    .sort();
}

function main() {
  const { dryRun, allowBlockers, fileName } = parseArgs();
  let hasBlockers = false;

  for (const file of selectedFiles(fileName)) {
    const filePath = path.join(PACK_DIR, file);
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const result = transformPack(content, file);
    console.log(`\n${file}: ${result.changes.length} proposed changes`);

    for (const change of result.changes) {
      console.log(
        `  ${change.path}: ${JSON.stringify(change.before)} -> ${JSON.stringify(change.after)}`,
      );
    }
    for (const blocker of result.blockers) {
      hasBlockers = true;
      console.error(`  BLOCKED ${blocker.path} (${blocker.effect}): ${blocker.reason}`);
    }

    if (!dryRun && (result.blockers.length === 0 || allowBlockers)) {
      fs.writeFileSync(filePath, `${JSON.stringify(result.value, null, 2)}\n`, 'utf8');
      console.log(
        `  WROTE ${file}${result.blockers.length > 0 ? ' (safe changes only; blockers preserved)' : ''}`,
      );
    }
  }

  if (hasBlockers) {
    process.exitCode = 2;
    console.error(
      '\nMigration stopped: resolve blocked shape changes before writing affected packs.',
    );
  }
}

main();
