import { describe, it, expect } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import {
  AlterEgoCard,
  CardRepository,
  HeroCard,
  MainSchemeCard,
  NormalizedCard,
  VillainCard,
  cloneGameState,
  getCatalog,
} from '@engine/models';
import { setupGame } from '@engine/state/game-setup';
import { DeclarativeScenarioPlugin, ScenarioDefinition, ScenarioRegistry } from '@engine/scenarios';

/** A catalog that is not the bundled Core JSON: five cards renamed from Rhino's set. */
class FakeRepository implements CardRepository {
  private readonly cards = new Map<string, NormalizedCard>();

  constructor() {
    const copy = (code: string, as: string) =>
      this.cards.set(as, { ...cardCatalog.getCard(code)!, code: as, setCode: 'fake' });
    copy('01094', 'fake_villain_1');
    copy('01095', 'fake_villain_2');
    copy('01097a', 'fake_scheme_1a');
    copy('01097b', 'fake_scheme_1b');
    copy('01109', 'fake_treachery');
  }

  getCard = (code: string) => this.cards.get(code);
  getCardsBySet = (setCode: string) =>
    [...this.cards.values()].filter((card) => card.setCode === setCode);
  getCardsByType = () => [];
  getExpandedCardsBySet = (setCode: string) => this.getCardsBySet(setCode);
  getNemesisCardsForHero = () => [];
  getVillainByStage = (setCode: string, stage: string) =>
    this.getCardsBySet(setCode).find(
      (c) => c.type === 'villain' && (c as VillainCard).stage === stage,
    ) as VillainCard | undefined;
  getMainSchemeByStage = (setCode: string, stage: string) =>
    this.getCardsBySet(setCode).find(
      (c) => c.type === 'main_scheme' && (c as MainSchemeCard).stage === stage,
    ) as MainSchemeCard | undefined;
}

/** A scenario that is only its definition.json: no subclass, no scenario code (#275). */
const fakeDefinition: ScenarioDefinition = {
  id: 'fake',
  name: 'Fake Scenario',
  scenarioCardCode: 'fake_villain_1',
  supportedDifficulties: ['STANDARD'],
  villainSetup: {
    villainName: 'Fake',
    stages: {
      SKIRMISH: ['fake_villain_1'],
      STANDARD: ['fake_villain_1', 'fake_villain_2'],
      EXPERT: ['fake_villain_2'],
    },
  },
  mainSchemeSetup: {
    stages: ['fake_scheme_1a', 'fake_scheme_1b'],
    startingThreat: 0,
    targetThreatPerPlayer: 7,
    escalationThreatPerPlayer: 1,
  },
  modularEncounterSets: {
    mandatory: ['fake'],
    defaults: { SKIRMISH: [], STANDARD: [], EXPERT: [] },
  },
};

describe('Card catalog injection (ADR-0087)', () => {
  const catalog = new FakeRepository();
  ScenarioRegistry.register(new DeclarativeScenarioPlugin(fakeDefinition, 'FAKE ONLINE!'));

  const newGame = () =>
    setupGame({
      catalog,
      scenarioId: 'fake',
      difficulty: 'STANDARD',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: cardCatalog.getCard('01001a') as HeroCard,
          alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      skipMulligan: true,
    });

  it('sets a game up from the injected catalog only', () => {
    const state = newGame();

    expect(getCatalog(state)).toBe(catalog);
    expect(state.villain.card.code).toBe('fake_villain_1');
    expect(state.mainScheme.card.code).toBe('fake_scheme_1b');
    expect(state.encounterDeck.map((c) => c.card.code)).toContain('fake_treachery');
  });

  it('keeps the catalog by reference in state clones', () => {
    const clone = cloneGameState(newGame());

    expect(getCatalog(clone)).toBe(catalog);
  });

  it('plays a scenario defined only by a definition.json through a stage change (#275)', () => {
    const plugin = ScenarioRegistry.get('fake');
    const state = newGame();

    const advanced = plugin.onVillainDefeated(state, state.villain.instanceId!);
    expect(advanced.advancedStage).toBe(true);
    expect(state.villain.card.code).toBe('fake_villain_2');

    const last = plugin.onVillainDefeated(state, state.villain.instanceId!);
    expect(last.victory).toBe(true);
    expect(state.winner).toBe('HEROES');
  });

  it('fails clearly for a state without a catalog', () => {
    const state = newGame();
    state.options = {};

    expect(() => getCatalog(state)).toThrow(/no card catalog/);
  });
});
