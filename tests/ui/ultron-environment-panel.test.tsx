import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { VillainZone } from '../../src/ui/components/board/VillainZone';
import { GameSettingsProvider } from '../../src/ui/context/GameSettingsProvider';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { createCardInstance, setupGame } from '../../src/engine/state/game-setup';
import {
  AlterEgoCard,
  GameState,
  HeroCard,
  getActiveMainScheme,
  getActiveVillain,
} from '../../src/engine/models';
import { attachCardToHost } from '../../src/engine/state/state-validator';
import {
  optionOwnResourceCost,
  optionRequiresPayment,
} from '../../src/ui/utils/option-requires-payment';
import { TestSession } from '../support/render-with-session';

// Plan #352 S3: the player must see Ultron Drones and an Upgraded Drones attached to it.
describe('Environment panel', () => {
  function ultronGame(): GameState {
    return setupGame({
      catalog: cardCatalog,
      scenarioId: 'ultron',
      difficulty: 'STANDARD',
      seed: 'ultron-environment-panel',
      skipMulligan: true,
      players: [
        {
          id: 'p1',
          name: 'Peter Parker',
          hero: cardCatalog.getCard('01001a') as HeroCard,
          alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
          deckCards: Array(15).fill(cardCatalog.getCard('01005')!),
        },
      ],
    });
  }

  const renderZone = (state: GameState) =>
    render(
      <GameSettingsProvider>
        <TestSession state={state}>
          <VillainZone
            villain={getActiveVillain(state)}
            mainScheme={getActiveMainScheme(state)}
            sideSchemes={state.sideSchemes}
            environments={state.environments}
            outOfPlayEmpty={true}
            encounterDeck={state.encounterDeck}
            encounterDiscard={state.encounterDiscard}
            accelerationTokens={0}
          />
        </TestSession>
      </GameSettingsProvider>,
    );

  beforeEach(() => {
    Element.prototype.scrollTo = vi.fn();
    Element.prototype.scrollBy = vi.fn();
  });

  it('shows the environment and the card attached to it', async () => {
    const state = ultronGame();
    const attachment = createCardInstance(cardCatalog.getCard('01142')!);
    attachCardToHost(state, attachment, 'ENEMY', state.environments[0].instanceId);

    renderZone(state);

    const panel = screen.getByTestId('environments-panel');
    expect(within(panel).getByText('Environment (1)')).toBeDefined();
    await waitFor(() => {
      expect(panel.innerHTML).toContain('Ultron Drones');
      expect(panel.innerHTML).toContain('Upgraded Drones');
    });
  });

  it('draws no panel with no environment in play', () => {
    const state = ultronGame();
    state.environments = [];

    renderZone(state);

    expect(screen.queryByTestId('environments-panel')).toBeNull();
  });
});

describe('A choice option with its own resource cost', () => {
  const option = {
    id: 'spend_resource',
    label: 'Spend',
    cost: { resourceCost: { energy: 1 } },
  } as never;

  it('asks for payment, with the type and amount of the cost', () => {
    expect(optionRequiresPayment(option)).toBe(true);
    expect(optionOwnResourceCost(option)).toEqual({ resourceType: 'energy', amount: 1 });
  });
});
