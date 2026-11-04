import { describe, it, expect, vi, afterEach, beforeAll, afterAll } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { DeclarativeScenarioPlugin, ScenarioRegistry } from '../../src/engine/scenarios';
import {
  ScenarioSelector,
  RANDOM_MODULAR_SET_CODE,
} from '../../src/ui/components/setup/ScenarioSelector';
import { GameSettingsProvider } from '../../src/ui/context/GameSettingsProvider';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { setupGame } from '../../src/engine/state/game-setup';
import { getStarterDeck } from '../../src/engine/decks/starter-decks';
import { getActiveVillain, VillainCard } from '../../src/engine/models';
import { getLoadedContent, setLoadedContent } from '../../src/data/content/store';
import type { SetupSelection } from '../../src/ui/components/setup/ScenarioSelector';

// The setup screen reads scenarios from the ScenarioRegistry and modular sets from the catalog;
// the legacy hard-coded scenario catalog is gone (AUD-20261017-232534 F004).
describe('ScenarioSelector', () => {
  const renderSelector = (onStartSetup = vi.fn()) => {
    render(
      <GameSettingsProvider>
        <ScenarioSelector onStartSetup={onStartSetup} onOpenContent={vi.fn()} />
      </GameSettingsProvider>,
    );
    return onStartSetup;
  };

  it('lists the registered scenarios with the stage 1A main scheme as subtitle', () => {
    renderSelector();
    expect(screen.getByText('Rhino: The Break-In!')).toBeTruthy();
    expect(screen.getByRole('button', { name: '#2 Klaw' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '#3 Ultron' })).toBeTruthy();
  });

  describe('with a scenario of a pack that is not loaded', () => {
    const loaded = getLoadedContent();
    afterEach(() => setLoadedContent(loaded));

    it('lists it disabled with the pack name', () => {
      setLoadedContent({
        ...loaded,
        descriptions: [
          {
            id: 'gg',
            name: 'Green Goblin',
            enabled: false,
            state: 'data-only',
            cardCount: 0,
            supplementalCount: 0,
            lockedScenarios: [{ id: 'goblin', name: 'Goblin Raid' }],
          },
        ],
      });
      renderSelector();
      const locked = screen.getByRole('button', {
        name: /Goblin Raid · Needs Green Goblin/,
      }) as HTMLButtonElement;
      expect(locked.disabled).toBe(true);
    });
  });

  it('flips through the scenarios with the page buttons and wraps around', () => {
    renderSelector();
    const next = screen.getByTitle('Next Scenario');
    const previous = screen.getByTitle('Previous Scenario');

    fireEvent.click(next);
    expect(screen.getByText('2 OF 3')).toBeTruthy();
    fireEvent.click(next);
    fireEvent.click(next);
    expect(screen.getByText('1 OF 3')).toBeTruthy();
    fireEvent.click(previous);
    expect(screen.getByText('3 OF 3')).toBeTruthy();
  });

  it('shows modular set card counts from the catalog', () => {
    renderSelector();
    expect(screen.getByRole('option', { name: /Under Attack \(5 cards\)/ })).toBeTruthy();
    expect(
      screen.getByRole('option', { name: /Bomb Scare \(6 cards\).*Recommended/ }),
    ).toBeTruthy();
  });

  it('starts Rhino Expert with Rhino II at its own hit points and leaves the catalog untouched', () => {
    const rhinoOneHealth = (cardCatalog.getCard('01094') as VillainCard).health;
    const onStartSetup = renderSelector();
    fireEvent.click(screen.getByText('EXPERT'));
    fireEvent.click(screen.getByText('START MISSION'));

    const selection = onStartSetup.mock.calls[0][0] as SetupSelection;
    expect(selection).toMatchObject({
      scenarioId: 'rhino',
      difficulty: 'EXPERT',
      selectedModularSetCodes: ['bomb_scare'],
    });

    const deck = getStarterDeck(selection.deckIds[0])!.loadDeck(cardCatalog);
    const state = setupGame({
      catalog: cardCatalog,
      scenarioId: selection.scenarioId,
      difficulty: selection.difficulty,
      modularSetCodes: selection.selectedModularSetCodes,
      players: [
        {
          id: 'p1',
          name: deck.hero.name,
          hero: deck.hero,
          alterEgo: deck.alterEgo,
          deckCards: deck.deckCards,
        },
      ],
    });
    const villain = getActiveVillain(state);
    expect(villain.card.code).toBe('01095');
    expect(villain.maxHealth).toBe((cardCatalog.getCard('01095') as VillainCard).health);
    expect((cardCatalog.getCard('01094') as VillainCard).health).toBe(rhinoOneHealth);
  });

  it('renders Pick Randomly option and toggles house rule checkbox', () => {
    renderSelector();
    expect(screen.getByRole('option', { name: /Pick Randomly/ })).toBeTruthy();

    const select = screen.getByRole('combobox', { name: 'Modular Set' });
    fireEvent.change(select, { target: { value: RANDOM_MODULAR_SET_CODE } });
    expect(screen.getByText('Random pick exclude the recommended (house rule)')).toBeTruthy();
    expect(screen.getByText('Random Modular Set')).toBeTruthy();
  });

  it('resolves random modular set excluding recommended when checkbox is checked', () => {
    const onStartSetup = renderSelector();
    const select = screen.getByRole('combobox', { name: 'Modular Set' });
    fireEvent.change(select, { target: { value: RANDOM_MODULAR_SET_CODE } });

    fireEvent.click(screen.getByText('START MISSION'));
    const selection = onStartSetup.mock.calls[0][0] as SetupSelection;
    expect(selection.selectedModularSetCodes).toBeDefined();
    expect(selection.selectedModularSetCodes?.[0]).not.toBe('bomb_scare');
    expect(['masters_of_evil', 'under_attack', 'legions_of_hydra', 'the_doomsday_chair']).toContain(
      selection.selectedModularSetCodes?.[0],
    );
  });

  describe('difficulty and encounter set order', () => {
    it('offers Standard sets, no Expert dropdown on Standard, and a required one on Expert', () => {
      renderSelector();
      fireEvent.click(screen.getByText('STANDARD'));
      expect(screen.getByRole('combobox', { name: 'Standard Set' })).toBeTruthy();
      expect(screen.queryByRole('combobox', { name: 'Expert Set' })).toBeNull();

      fireEvent.click(screen.getByText('EXPERT'));
      const expert = screen.getByRole('combobox', { name: 'Expert Set' }) as HTMLSelectElement;
      expect(expert.value).toBe('expert');
      expect(within(expert).queryByRole('option', { name: 'None' })).toBeNull();
    });

    it('lets Skirmish add an Expert set, which goes in the selection', () => {
      const onStartSetup = renderSelector();
      fireEvent.click(screen.getByText('SKIRMISH'));
      const expert = screen.getByRole('combobox', { name: 'Expert Set' }) as HTMLSelectElement;
      expect(expert.value).toBe('');

      fireEvent.click(screen.getByText('START MISSION'));
      expect(onStartSetup.mock.calls[0][0]).toMatchObject({
        difficulty: 'SKIRMISH',
        standardSetCode: 'standard',
        expertSetCode: null,
      });
      fireEvent.change(expert, { target: { value: 'expert' } });
      fireEvent.click(screen.getByText('START MISSION'));
      expect(onStartSetup.mock.calls[1][0]).toMatchObject({ expertSetCode: 'expert' });
    });

    it('shows the villain stages of each difficulty from the cards', () => {
      renderSelector();
      expect(screen.getByText('Stage I Only')).toBeTruthy();
      expect(screen.getByText('Stage I ➔ II')).toBeTruthy();
      expect(screen.getByText('Stage II ➔ III')).toBeTruthy();
    });

    describe('Skirmish villain version', () => {
      const versions = () =>
        within(screen.getByRole('group', { name: 'Villain Version' }))
          .getAllByRole('button')
          .map((button) => button.textContent);

      it('Skirmish offers Stage I, II and III, and Stage II goes in the selection', () => {
        const onStartSetup = renderSelector();
        fireEvent.click(screen.getByText('SKIRMISH'));
        expect(versions()).toEqual(['Stage I', 'Stage II', 'Stage III']);

        fireEvent.click(screen.getByText('START MISSION'));
        expect(onStartSetup.mock.calls[0][0]).toMatchObject({ villainVersionCode: '01094' });

        fireEvent.click(screen.getByRole('button', { name: 'Stage II' }));
        fireEvent.click(screen.getByText('START MISSION'));
        expect(onStartSetup.mock.calls[1][0]).toMatchObject({ villainVersionCode: '01095' });
      });

      it('choosing Stage II updates the villain page badge and the difficulty button', () => {
        renderSelector();
        fireEvent.click(screen.getByText('SKIRMISH'));
        fireEvent.click(screen.getByRole('button', { name: 'Stage II' }));
        expect(screen.getByText('STAGE II')).toBeTruthy();
        expect(screen.getByText('Stage II Only')).toBeTruthy();
      });

      it('flipping from Rhino II to Klaw falls back to Stage I of Klaw', () => {
        const onStartSetup = renderSelector();
        fireEvent.click(screen.getByText('SKIRMISH'));
        fireEvent.click(screen.getByRole('button', { name: 'Stage II' }));
        fireEvent.click(screen.getByRole('button', { name: '#2 Klaw' }));
        fireEvent.click(screen.getByText('START MISSION'));
        expect(onStartSetup.mock.calls[0][0]).toMatchObject({
          scenarioId: 'klaw',
          villainVersionCode: '01113',
        });
      });

      it('leaving Skirmish hides the choice and sends no version, coming back restores it', () => {
        const onStartSetup = renderSelector();
        fireEvent.click(screen.getByText('SKIRMISH'));
        fireEvent.click(screen.getByRole('button', { name: 'Stage II' }));

        fireEvent.click(screen.getByText('STANDARD'));
        expect(screen.queryByRole('group', { name: 'Villain Version' })).toBeNull();
        fireEvent.click(screen.getByText('START MISSION'));
        expect(onStartSetup.mock.calls[0][0].villainVersionCode).toBeUndefined();

        fireEvent.click(screen.getByText('SKIRMISH'));
        expect(screen.getByText('Stage II Only')).toBeTruthy();
      });

      describe('with a scenario that lists one Skirmish version', () => {
        const registered = ScenarioRegistry.getAll();
        beforeAll(() => {
          const definition = structuredClone(ScenarioRegistry.get('rhino').definition);
          definition.villainSetup.stages.SKIRMISH = ['01094'];
          ScenarioRegistry.register(
            new DeclarativeScenarioPlugin({
              ...definition,
              id: 'zz_one_version',
              scenarioCardCode: '99998',
              name: 'One Version Fixture',
            }),
          );
        });
        afterAll(() => {
          ScenarioRegistry.clear();
          registered.forEach((plugin) => ScenarioRegistry.register(plugin));
        });

        it('shows no choice and plays that version', () => {
          const onStartSetup = renderSelector();
          fireEvent.click(screen.getByText('SKIRMISH'));
          fireEvent.click(screen.getByTitle('Previous Scenario'));
          expect(screen.queryByRole('group', { name: 'Villain Version' })).toBeNull();
          fireEvent.click(screen.getByText('START MISSION'));
          expect(onStartSetup.mock.calls[0][0]).toMatchObject({
            scenarioId: 'zz_one_version',
            villainVersionCode: '01094',
          });
        });
      });
    });

    it('heroic level stays selectable on every difficulty and shows no variant badge', () => {
      renderSelector();
      for (const mode of ['SKIRMISH', 'STANDARD', 'EXPERT']) {
        fireEvent.click(screen.getByText(mode));
        fireEvent.click(screen.getByText('Heroic 2 (+2)'));
        expect(screen.queryByText(/CUSTOM VARIANT|OFFICIAL FFG MODE/)).toBeNull();
      }
    });

    describe('with a scenario that overrides the difficulty setup', () => {
      const registered = ScenarioRegistry.getAll();
      beforeAll(() => {
        const { definition } = ScenarioRegistry.get('rhino');
        ScenarioRegistry.register(
          new DeclarativeScenarioPlugin({
            ...structuredClone(definition),
            id: 'zz_override_fixture',
            scenarioCardCode: '99999',
            name: 'Override Fixture',
            supportedDifficulties: ['STANDARD', 'EXPERT'],
            modularEncounterSets: { mandatory: ['rhino'], slotCount: 0 },
            encounterSetRules: { standard: { fixed: null }, expert: { fixed: null } },
          }),
        );
      });
      afterAll(() => {
        ScenarioRegistry.clear();
        registered.forEach((plugin) => ScenarioRegistry.register(plugin));
      });

      const goToFixture = () => {
        fireEvent.click(screen.getByTitle('Previous Scenario'));
        expect(screen.getAllByText(/Override Fixture/).length).toBeGreaterThan(0);
      };

      it('only the difficulties the scenario supports are shown', () => {
        renderSelector();
        goToFixture();
        expect(screen.queryByText('SKIRMISH')).toBeNull();
        expect(screen.getByText('STANDARD')).toBeTruthy();
        expect(screen.getByText('EXPERT')).toBeTruthy();
      });

      it('changing scenario moves to its first supported difficulty when the current one is not offered', () => {
        const onStartSetup = renderSelector();
        fireEvent.click(screen.getByText('SKIRMISH'));
        goToFixture();
        expect(screen.getByText('MODE: STANDARD')).toBeTruthy();
        fireEvent.click(screen.getByText('START MISSION'));
        expect(onStartSetup.mock.calls[0][0]).toMatchObject({
          difficulty: 'STANDARD',
          standardSetCode: null,
          expertSetCode: null,
          selectedModularSetCodes: [],
        });
      });

      it('scenario with no standard or expert set shows no set dropdowns', () => {
        renderSelector();
        goToFixture();
        expect(screen.queryByRole('combobox', { name: 'Standard Set' })).toBeNull();
        expect(screen.queryByRole('combobox', { name: 'Expert Set' })).toBeNull();
        expect(screen.queryByRole('combobox', { name: 'Modular Set' })).toBeNull();
      });
    });
  });

  it('resets modular set to default when Reset to Default is clicked', () => {
    renderSelector();
    const select = screen.getByRole('combobox', { name: 'Modular Set' });
    fireEvent.change(select, { target: { value: RANDOM_MODULAR_SET_CODE } });
    expect(screen.getByText('Reset to Default')).toBeTruthy();

    fireEvent.click(screen.getByText('Reset to Default'));
    expect(screen.queryByText('Reset to Default')).toBeNull();
    expect(screen.getByText('Default Recommendation')).toBeTruthy();
  });
});
