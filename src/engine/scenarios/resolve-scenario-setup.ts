import type { DifficultyMode, EncounterSetSelection } from '@engine/models';
import type { ScenarioDefinition } from '../../data/packs/scenario-definition';
import { listEncounterSetCodes } from './encounter-sets';

/** One encounter set choice at setup: decided by the scenario, or chosen by the players. */
export type EncounterSetSlot =
  | { fixed: true; code: string | null }
  | { fixed: false; options: string[]; required: boolean; defaultCode: string | null };

export interface EncounterSetSlots {
  standard: EncounterSetSlot;
  expert: EncounterSetSlot;
}

export interface ScenarioSetupChoices {
  difficulty?: DifficultyMode;
  /** Left out: the default. */
  standardSetCode?: string | null;
  /** Left out: the default. `null`: no Expert set, where that is allowed. */
  expertSetCode?: string | null;
  /** Skirmish only. Left out: the first version the scenario lists. */
  villainVersionCode?: string;
}

export interface ResolvedScenarioSetup {
  difficulty: DifficultyMode;
  /** RR v1.8 Double-Sided Card reads this; a scenario can play expert mode with no Expert set. */
  expertMode: boolean;
  encounterSets: EncounterSetSelection;
  villainStages: string[];
}

/**
 * The villain stages a game on this difficulty plays. A scenario's Skirmish list holds the versions
 * on offer, and only one of them plays (RR v1.8 Modes of Play): the given version, or the first.
 */
export function getVillainStages(
  definition: ScenarioDefinition,
  difficulty: DifficultyMode,
  villainVersionCode?: string,
): string[] {
  const stages = definition.villainSetup.stages[difficulty];
  if (!stages?.length) {
    throw new Error(`Scenario '${definition.id}' has no villain stages for '${difficulty}'.`);
  }
  return difficulty === 'SKIRMISH' ? [villainVersionCode ?? stages[0]] : stages;
}

/** The villain versions the players choose from. Only Skirmish offers a choice. */
export function listVillainVersions(
  definition: ScenarioDefinition,
  difficulty: DifficultyMode,
): string[] {
  return difficulty === 'SKIRMISH' ? (definition.villainSetup.stages.SKIRMISH ?? []) : [];
}

/** The version a game plays: the choice if it is still offered, otherwise the first offered. */
export function settleVillainVersion(
  definition: ScenarioDefinition,
  difficulty: DifficultyMode,
  choice: string | undefined,
): string | undefined {
  const versions = listVillainVersions(definition, difficulty);
  return choice && versions.includes(choice) ? choice : versions[0];
}

function slotFromChoices(codes: string[], required: boolean): EncounterSetSlot {
  return {
    fixed: false,
    options: codes,
    required,
    defaultCode: required ? (codes[0] ?? null) : null,
  };
}

/**
 * What each set choice offers on a difficulty (RR v1.8 Modes of Play). Standard mode has no Expert
 * set, Expert mode requires one, and Skirmish may add one ("skirmish mode can be combined with
 * expert mode"). Heroic mode selects no set. A scenario's `encounterSetRules` overrides a choice.
 */
export function describeEncounterSetSlots(
  definition: ScenarioDefinition,
  difficulty: DifficultyMode,
): EncounterSetSlots {
  const rules = definition.encounterSetRules;
  const standard: EncounterSetSlot = rules?.standard
    ? { fixed: true, code: rules.standard.fixed }
    : slotFromChoices(listEncounterSetCodes('standard'), true);

  let expert: EncounterSetSlot;
  if (rules?.expert) expert = { fixed: true, code: rules.expert.fixed };
  else if (difficulty === 'STANDARD') expert = { fixed: true, code: null };
  else expert = slotFromChoices(listEncounterSetCodes('expert'), difficulty === 'EXPERT');

  return { standard, expert };
}

/** The set a slot plays with: the choice if it is still offered, otherwise the slot's default. */
export function settleEncounterSetChoice(
  slot: EncounterSetSlot,
  choice: string | null | undefined,
): string | null {
  if (slot.fixed) return slot.code;
  if (choice === null && !slot.required) return null;
  return choice && slot.options.includes(choice) ? choice : slot.defaultCode;
}

function resolveSlot(
  definition: ScenarioDefinition,
  label: string,
  slot: EncounterSetSlot,
  choice: string | null | undefined,
): string | null {
  const offered =
    choice === undefined ||
    (slot.fixed
      ? choice === slot.code
      : choice === null
        ? !slot.required
        : slot.options.includes(choice));
  if (!offered) {
    throw new Error(`Scenario '${definition.id}' does not offer ${label} set '${choice}'.`);
  }
  return settleEncounterSetChoice(slot, choice);
}

/**
 * The one reading of a scenario's setup choices: the setup screen offers what
 * `describeEncounterSetSlots` lists and the game plays what this returns.
 */
export function resolveScenarioSetup(
  definition: ScenarioDefinition,
  choices: ScenarioSetupChoices,
): ResolvedScenarioSetup {
  const supported = definition.supportedDifficulties;
  const difficulty =
    choices.difficulty ?? (supported.includes('STANDARD') ? 'STANDARD' : supported[0]);
  if (!supported.includes(difficulty)) {
    throw new Error(`Scenario '${definition.id}' does not support difficulty '${difficulty}'.`);
  }

  const { villainVersionCode } = choices;
  if (
    villainVersionCode !== undefined &&
    !listVillainVersions(definition, difficulty).includes(villainVersionCode)
  ) {
    throw new Error(
      `Scenario '${definition.id}' does not offer villain version '${villainVersionCode}' on '${difficulty}'.`,
    );
  }

  const slots = describeEncounterSetSlots(definition, difficulty);
  const encounterSets: EncounterSetSelection = {
    standard: resolveSlot(definition, 'Standard', slots.standard, choices.standardSetCode),
    expert: resolveSlot(definition, 'Expert', slots.expert, choices.expertSetCode),
  };
  return {
    difficulty,
    expertMode:
      difficulty === 'EXPERT' || (difficulty === 'SKIRMISH' && encounterSets.expert !== null),
    encounterSets,
    villainStages: getVillainStages(definition, difficulty, villainVersionCode),
  };
}
