import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

    const select = screen.getAllByRole('combobox')[0];
    fireEvent.change(select, { target: { value: RANDOM_MODULAR_SET_CODE } });
    expect(screen.getByText('Random pick exclude the recommended (house rule)')).toBeTruthy();
    expect(screen.getByText('Random Modular Set')).toBeTruthy();
  });

  it('resolves random modular set excluding recommended when checkbox is checked', () => {
    const onStartSetup = renderSelector();
    const select = screen.getAllByRole('combobox')[0];
    fireEvent.change(select, { target: { value: RANDOM_MODULAR_SET_CODE } });

    fireEvent.click(screen.getByText('START MISSION'));
    const selection = onStartSetup.mock.calls[0][0] as SetupSelection;
    expect(selection.selectedModularSetCodes).toBeDefined();
    expect(selection.selectedModularSetCodes?.[0]).not.toBe('bomb_scare');
    expect(['masters_of_evil', 'under_attack', 'legions_of_hydra', 'the_doomsday_chair']).toContain(
      selection.selectedModularSetCodes?.[0],
    );
  });

  it('resets modular set to default when Reset to Default is clicked', () => {
    renderSelector();
    const select = screen.getAllByRole('combobox')[0];
    fireEvent.change(select, { target: { value: RANDOM_MODULAR_SET_CODE } });
    expect(screen.getByText('Reset to Default')).toBeTruthy();

    fireEvent.click(screen.getByText('Reset to Default'));
    expect(screen.queryByText('Reset to Default')).toBeNull();
    expect(screen.getByText('Default Recommendation')).toBeTruthy();
  });
});
