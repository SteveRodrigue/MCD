import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScenarioSelector } from '../../src/ui/components/setup/ScenarioSelector';
import { GameSettingsProvider } from '../../src/ui/context/GameSettingsProvider';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { setupGame } from '../../src/engine/state/game-setup';
import { getStarterDeck } from '../../src/engine/decks/starter-decks';
import { getActiveVillain, VillainCard } from '../../src/engine/models';
import type { SetupSelection } from '../../src/ui/components/setup/ScenarioSelector';

// The setup screen reads scenarios from the ScenarioRegistry and modular sets from the catalog;
// the legacy hard-coded scenario catalog is gone (AUD-20261017-232534 F004).
describe('ScenarioSelector', () => {
  const renderSelector = (onStartSetup = vi.fn()) => {
    render(
      <GameSettingsProvider>
        <ScenarioSelector onStartSetup={onStartSetup} />
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
});
