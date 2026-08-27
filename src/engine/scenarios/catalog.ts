import { CardCatalog } from '../../data/importer/card-loader';
import {
  VillainCard,
  MainSchemeCard,
  NormalizedCard,
} from '../models';

export interface ScenarioDefinition {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  recommendedModularSets: string[];
  stages: {
    standard: string[]; // e.g. ['01094', '01095'] -> Rhino I, Rhino II
    expert: string[];   // e.g. ['01095', '01096'] -> Rhino II, Rhino III
  };
  mainSchemeCode: string; // e.g. '01097b' -> The Break-In!
  setupInstructions: string;
  createEncounterDeck: (
    catalog: CardCatalog,
    modularSets?: string[]
  ) => {
    villain: VillainCard;
    mainScheme: MainSchemeCard;
    encounterCards: NormalizedCard[];
  };
}

/**
 * Registry of Scenarios.
 * Extensible for Rhino, Klaw, Ultron, Mutagen Formula, etc.
 */
export const scenarioCatalog: Record<string, ScenarioDefinition> = {
  rhino: {
    id: 'rhino',
    name: 'Rhino',
    subtitle: 'The Break-In!',
    description:
      'Rhino is attacking the secure facility! Prevent him from stealing the vibranium cache before the scheme reaches critical threshold.',
    recommendedModularSets: ['bomb_scare'],
    stages: {
      standard: ['01094', '01095'], // Rhino I & II
      expert: ['01095', '01096'],   // Rhino II & III
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
        Array(c.quantity).fill(c)
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
