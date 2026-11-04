import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { cardCatalog } from '@data/importer/card-loader';
import { HeroCard, AlterEgoCard, GameState, MainSchemeCard, VillainCard } from '@engine/models';
import { setupGame } from '@engine/state/game-setup';
import { getStarterDeck } from '@engine/decks/starter-decks';
import {
  DeclarativeScenarioPlugin,
  ScenarioRegistry,
  describeEncounterSetSlots,
  listEncounterSets,
  resolveScenarioSetup,
  setEncounterSets,
} from '@engine/scenarios';
import { getLoadedContent } from '@data/content/store';
import { ScenarioDefinitionSchema } from '@data/packs/scenario-definition';

const rhino = () => ScenarioRegistry.get('rhino').definition;

/** Fake installed alternatives: their cards do not need to exist for the choice itself. */
const withAlternativeSets = () => {
  const loaded = getLoadedContent().packs.flatMap((pack) => pack.encounterSets);
  beforeAll(() =>
    setEncounterSets([
      ...loaded,
      { code: 'standard_ii', kind: 'standard', name: 'Standard II', description: '' },
      { code: 'expert_ii', kind: 'expert', name: 'Expert II', description: '' },
    ]),
  );
  afterAll(() => setEncounterSets(loaded));
};

const setup = (options: Partial<Parameters<typeof setupGame>[0]>): GameState => {
  const deck = getStarterDeck('spider_man_justice')!.loadDeck(cardCatalog);
  return setupGame({
    catalog: cardCatalog,
    scenarioId: 'rhino',
    skipMulligan: true,
    players: [
      {
        id: 'p1',
        name: 'Spider-Man',
        hero: deck.hero as HeroCard,
        alterEgo: deck.alterEgo as AlterEgoCard,
        deckCards: deck.deckCards,
      },
    ],
    ...options,
  });
};

const deckSets = (state: GameState) => new Set(state.encounterDeck.map((c) => c.card.setCode));

describe('encounter set selection', () => {
  it('defaults to Standard, plus Expert on Expert difficulty', () => {
    expect(setup({ difficulty: 'STANDARD' }).encounterSets).toEqual({
      standard: 'standard',
      expert: null,
    });
    const expert = setup({ difficulty: 'EXPERT' });
    expect(expert.encounterSets).toEqual({ standard: 'standard', expert: 'expert' });
    expect(deckSets(expert)).toEqual(new Set(['rhino', 'standard', 'expert', 'bomb_scare']));
  });

  it('game state records the sets that were played', () => {
    const state = setup({ difficulty: 'EXPERT', expertSetCode: 'expert' });
    expect(state.encounterSets.expert).toBe('expert');
    expect(state.expertMode).toBe(true);
  });

  it('heroic level does not change the encounter sets at any difficulty', () => {
    for (const difficulty of ['SKIRMISH', 'STANDARD', 'EXPERT'] as const) {
      const plain = setup({ difficulty });
      const heroic = setup({ difficulty, heroicLevel: 3 });
      expect(heroic.encounterSets).toEqual(plain.encounterSets);
      expect(heroic.expertMode).toBe(plain.expertMode);
      expect(deckSets(heroic)).toEqual(deckSets(plain));
    }
  });

  describe('rules map', () => {
    withAlternativeSets();

    it('Standard hides the Expert set', () => {
      expect(describeEncounterSetSlots(rhino(), 'STANDARD').expert).toEqual({
        fixed: true,
        code: null,
      });
      expect(() =>
        resolveScenarioSetup(rhino(), { difficulty: 'STANDARD', expertSetCode: 'expert' }),
      ).toThrow(/does not offer Expert set/);
    });

    it('Expert requires an Expert set, from the installed ones', () => {
      expect(describeEncounterSetSlots(rhino(), 'EXPERT').expert).toEqual({
        fixed: false,
        options: ['expert', 'expert_ii'],
        required: true,
        defaultCode: 'expert',
      });
      expect(() =>
        resolveScenarioSetup(rhino(), { difficulty: 'EXPERT', expertSetCode: null }),
      ).toThrow(/does not offer Expert set/);
    });

    it('Skirmish may add an Expert set, which makes it expert mode', () => {
      const plain = resolveScenarioSetup(rhino(), { difficulty: 'SKIRMISH' });
      expect(plain.encounterSets.expert).toBeNull();
      expect(plain.expertMode).toBe(false);

      const expert = resolveScenarioSetup(rhino(), {
        difficulty: 'SKIRMISH',
        expertSetCode: 'expert_ii',
      });
      expect(expert.encounterSets.expert).toBe('expert_ii');
      expect(expert.expertMode).toBe(true);
    });

    it('rhino expert with Standard II and Expert II resolves to those sets', () => {
      expect(
        resolveScenarioSetup(rhino(), {
          difficulty: 'EXPERT',
          standardSetCode: 'standard_ii',
          expertSetCode: 'expert_ii',
        }),
      ).toEqual({
        difficulty: 'EXPERT',
        expertMode: true,
        encounterSets: { standard: 'standard_ii', expert: 'expert_ii' },
      });
    });
  });

  it('standard and expert sets never appear as modular choices', () => {
    const codes = listEncounterSets(cardCatalog, 'modular').map((set) => set.code);
    expect(codes).not.toContain('standard');
    expect(codes).not.toContain('expert');
    expect(listEncounterSets(cardCatalog, 'standard').map((set) => set.code)).toContain('standard');
    expect(listEncounterSets(cardCatalog, 'expert').map((set) => set.code)).toContain('expert');
  });

  describe('a scenario that overrides the difficulty setup', () => {
    const overrideId = 'no_sets_fixture';
    // Its villain and scheme come from Rhino: the fixture has no cards of its own.
    const overrideGame = {
      scenarioId: overrideId,
      villain: cardCatalog.getCard('01094') as VillainCard,
      mainScheme: cardCatalog.getCard('01097b') as MainSchemeCard,
    };
    beforeAll(() => {
      const definition = structuredClone(rhino());
      ScenarioRegistry.register(
        new DeclarativeScenarioPlugin({
          ...definition,
          id: overrideId,
          scenarioCardCode: '99999',
          supportedDifficulties: ['STANDARD', 'EXPERT'],
          modularEncounterSets: { mandatory: ['rhino'], slotCount: 0 },
          encounterSetRules: { standard: { fixed: null }, expert: { fixed: null } },
        }),
      );
    });

    it('scenario offering standard and expert with no sets plays expert mode without an expert set', () => {
      const state = setup({ ...overrideGame, difficulty: 'EXPERT' });
      expect(state.expertMode).toBe(true);
      expect(state.encounterSets).toEqual({ standard: null, expert: null });
      expect(deckSets(state)).toEqual(new Set(['rhino']));
    });

    it('starting on a difficulty the scenario does not support is an error', () => {
      expect(() => setup({ ...overrideGame, difficulty: 'SKIRMISH' })).toThrow(
        /does not support difficulty 'SKIRMISH'/,
      );
    });

    it('a fixed set replaces the choice', () => {
      const definition = {
        ...rhino(),
        encounterSetRules: { standard: { fixed: 'expert' } },
      };
      expect(describeEncounterSetSlots(definition, 'STANDARD').standard).toEqual({
        fixed: true,
        code: 'expert',
      });
      expect(resolveScenarioSetup(definition, { difficulty: 'STANDARD' }).encounterSets).toEqual({
        standard: 'expert',
        expert: null,
      });
    });
  });

  it('manifest missing villain stages for a supported difficulty is rejected', () => {
    const definition = structuredClone(rhino());
    delete definition.villainSetup.stages.EXPERT;
    const parsed = ScenarioDefinitionSchema.safeParse(definition);
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0].path).toEqual(['villainSetup', 'stages', 'EXPERT']);

    definition.supportedDifficulties = ['SKIRMISH', 'STANDARD'];
    expect(ScenarioDefinitionSchema.safeParse(definition).success).toBe(true);
  });

  it('the Core manifests do not mention the Standard or Expert sets', () => {
    for (const plugin of ScenarioRegistry.getAll()) {
      expect(JSON.stringify(plugin.definition.modularEncounterSets)).not.toMatch(
        /"standard"|"expert"/,
      );
    }
  });
});
