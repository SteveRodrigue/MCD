import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../');
const SUPPLEMENTAL_DIR = path.join(ROOT_DIR, 'src/data/supplemental/pack');

function transformStep(rawStep: any): any {
  const step: any = {};
  if (rawStep.id) step.id = rawStep.id;
  if (rawStep.effect) step.effect = rawStep.effect;
  if (rawStep.gate) step.gate = rawStep.gate;
  if (rawStep.params) step.params = rawStep.params;
  if (rawStep.filter) step.filter = rawStep.filter;
  return step;
}

function transformAbility(rawAbility: any): any {
  const ability: any = {
    id: rawAbility.id,
    timing: rawAbility.timing,
  };

  if (rawAbility.trigger) ability.trigger = rawAbility.trigger;
  if (rawAbility.zone) ability.zone = rawAbility.zone;
  if (rawAbility.limit) ability.limit = rawAbility.limit;
  if (rawAbility.maxPerRound !== undefined) ability.maxPerRound = rawAbility.maxPerRound;
  if (rawAbility.tags) ability.tags = rawAbility.tags;
  if (rawAbility.cost) ability.cost = rawAbility.cost;
  if (rawAbility.errata !== undefined) ability.errata = rawAbility.errata;

  if (Array.isArray(rawAbility.steps) && rawAbility.steps.length > 0) {
    ability.steps = rawAbility.steps.map(transformStep);
  } else if (Array.isArray(rawAbility.sequence) && rawAbility.sequence.length > 0) {
    ability.steps = rawAbility.sequence.map(transformStep);
  } else if (rawAbility.effect) {
    const singleStep: any = {
      effect: rawAbility.effect,
    };
    if (rawAbility.gate) singleStep.gate = rawAbility.gate;
    if (rawAbility.params) singleStep.params = rawAbility.params;
    if (rawAbility.filter) singleStep.filter = rawAbility.filter;
    ability.steps = [singleStep];
  } else {
    throw new Error(`Ability ${rawAbility.id} has no effect, sequence, or steps!`);
  }

  return ability;
}

export function migrateSupplementalFiles() {
  const files = fs.readdirSync(SUPPLEMENTAL_DIR).filter((f) => f.endsWith('.json'));

  for (const file of files) {
    const filePath = path.join(SUPPLEMENTAL_DIR, file);
    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const cards = content.cards || content;

    let migratedCardsCount = 0;
    let migratedAbilitiesCount = 0;

    for (const [_code, card] of Object.entries(cards) as [string, any][]) {
      if (Array.isArray(card.abilities) && card.abilities.length > 0) {
        migratedCardsCount += 1;
        card.abilities = card.abilities.map((ab: any) => {
          migratedAbilitiesCount += 1;
          return transformAbility(ab);
        });
      }
    }

    fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n', 'utf-8');
    console.log(
      `Migrated ${file}: ${migratedCardsCount} cards, ${migratedAbilitiesCount} abilities.`,
    );
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  migrateSupplementalFiles();
}
