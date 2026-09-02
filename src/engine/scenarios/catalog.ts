import { CardCatalog } from '../../data/importer/card-loader';
import { VillainCard, MainSchemeCard, NormalizedCard } from '../models';

export type LegacyScenarioDefinition = {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  recommendedModularSets: string[];
  stages: {
    standard: string[]; // e.g. ['01094', '01095'] -> Rhino I, Rhino II
    expert: string[]; // e.g. ['01095', '01096'] -> Rhino II, Rhino III
  };
  mainSchemeCode: string; // e.g. '01097b' -> The Break-In!
  setupInstructions: string;
  createEncounterDeck: (
    catalog: CardCatalog,
    modularSets?: string[],
  ) => {
    villain: VillainCard;
    mainScheme: MainSchemeCard;
    encounterCards: NormalizedCard[];
  };
};

export interface ModularEncounterSetInfo {
  code: string;
  name: string;
  cardCount: number;
  description: string;
}

export const MODULAR_ENCOUNTER_SETS: ModularEncounterSetInfo[] = [
  {
    code: 'bomb_scare',
    name: 'Bomb Scare',
    cardCount: 6,
    description: 'A desperate explosive plot orchestrated by the Maggia crime syndicate.',
  },
  {
    code: 'masters_of_evil',
    name: 'Masters of Evil',
    cardCount: 7,
    description:
      'A villainous alliance featuring Baron Zemo, Radioactive Man, Whirlwind, Tiger Shark, and Melter.',
  },
  {
    code: 'under_attack',
    name: 'Under Attack',
    cardCount: 8,
    description: 'A barrage of aerial bombardment and villainous assault cards.',
  },
  {
    code: 'legions_of_hydra',
    name: 'Legions of Hydra',
    cardCount: 6,
    description: 'Hydra infantry soldiers and Madame Hydra attempting to overrun the city.',
  },
  {
    code: 'the_doomsday_chair',
    name: 'The Doomsday Chair',
    cardCount: 6,
    description: 'M.O.D.O.K. and A.I.M. deploying devastating psionic weaponry.',
  },
];

export function listModularEncounterSets(): ModularEncounterSetInfo[] {
  return MODULAR_ENCOUNTER_SETS;
}

export type ScenarioDefinition = LegacyScenarioDefinition;

/**
 * Registry of Scenarios.
 * Extensible for Rhino, Klaw, Ultron, Mutagen Formula, etc.
 */
export const scenarioCatalog: Record<string, LegacyScenarioDefinition> = {
  rhino: {
    id: 'rhino',
    name: 'Rhino',
    subtitle: 'The Break-In!',
    description:
      'Rhino is attacking the secure facility! Prevent him from stealing the vibranium cache before the scheme reaches critical threshold.',
    recommendedModularSets: ['bomb_scare'],
    stages: {
      standard: ['01094', '01095'], // Rhino I & II
      expert: ['01095', '01096'], // Rhino II & III
    },
    mainSchemeCode: '01097b',
    setupInstructions:
      'Attach standard encounter cards + Bomb Scare modular set. Set Rhino HP to 14 per player.',
    createEncounterDeck: (catalog, modularSets = ['bomb_scare']) => {
      const villain = catalog.getCard('01094') as VillainCard; // Rhino I
      const mainScheme = catalog.getCard('01097b') as MainSchemeCard; // The Break-In!

      const rhinoCards = catalog
        .getCardsBySet('rhino')
        .filter((c) => c.type !== 'villain' && c.type !== 'main_scheme');
      const standardCards = catalog.getCardsBySet('standard');

      const modularCards = modularSets.flatMap((setName) => catalog.getCardsBySet(setName));

      const encounterCards = [...rhinoCards, ...standardCards, ...modularCards].flatMap((c) =>
        Array(c.quantity).fill(c),
      );

      return { villain, mainScheme, encounterCards };
    },
  },
  klaw: {
    id: 'klaw',
    name: 'Klaw',
    subtitle: 'Underground Distribution',
    description:
      'Klaw is operating an illegal underground weapons network. Intercept him before his sonic converter destroys the city!',
    recommendedModularSets: ['masters_of_evil'],
    stages: {
      standard: ['01113', '01114'], // Klaw I & II
      expert: ['01114', '01115'], // Klaw II & III
    },
    mainSchemeCode: '01116b',
    setupInstructions:
      'Attach standard encounter cards + Masters of Evil modular set. Put Defense Network into play and search for starting minion.',
    createEncounterDeck: (catalog, modularSets = ['masters_of_evil']) => {
      const villain = catalog.getCard('01113') as VillainCard; // Klaw I
      const mainScheme = catalog.getCard('01116b') as MainSchemeCard; // Underground Distribution

      const klawCards = catalog
        .getCardsBySet('klaw')
        .filter((c) => c.type !== 'villain' && c.type !== 'main_scheme');
      const standardCards = catalog.getCardsBySet('standard');

      const modularCards = modularSets.flatMap((setName) => catalog.getCardsBySet(setName));

      const encounterCards = [...klawCards, ...standardCards, ...modularCards].flatMap((c) =>
        Array(c.quantity).fill(c),
      );

      return { villain, mainScheme, encounterCards };
    },
  },
  ultron: {
    id: 'ultron',
    name: 'Ultron',
    subtitle: 'The Crimson Cowl',
    description:
      'The sentient artificial intelligence Ultron is manufacturing an army of drones to exterminate humanity!',
    recommendedModularSets: ['under_attack'],
    stages: {
      standard: ['01134', '01135'], // Ultron I & II
      expert: ['01135', '01136'], // Ultron II & III
    },
    mainSchemeCode: '01137b',
    setupInstructions:
      'Attach standard encounter cards + Under Attack modular set. Put Ultron Drones environment into play and spawn starting drone minions.',
    createEncounterDeck: (catalog, modularSets = ['under_attack']) => {
      const villain = catalog.getCard('01134') as VillainCard; // Ultron I
      const mainScheme = catalog.getCard('01137b') as MainSchemeCard; // The Crimson Cowl

      const ultronCards = catalog
        .getCardsBySet('ultron')
        .filter(
          (c) => c.type !== 'villain' && c.type !== 'main_scheme' && c.type !== 'environment',
        );
      const standardCards = catalog.getCardsBySet('standard');

      const modularCards = modularSets.flatMap((setName) => catalog.getCardsBySet(setName));

      const encounterCards = [...ultronCards, ...standardCards, ...modularCards].flatMap((c) =>
        Array(c.quantity).fill(c),
      );

      return { villain, mainScheme, encounterCards };
    },
  },
};

export function getScenario(id: string): ScenarioDefinition | undefined {
  return scenarioCatalog[id];
}

export function listScenarios(): ScenarioDefinition[] {
  return Object.values(scenarioCatalog);
}
