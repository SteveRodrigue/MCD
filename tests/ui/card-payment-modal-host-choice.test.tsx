import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { CardPaymentModal } from '../../src/ui/components/board/CardPaymentModal';
import { createCardInstance, setupGame } from '../../src/engine/state/game-setup';
import type { AlterEgoCard, CardInstance, GameState, HeroCard } from '../../src/engine/models';
import { newRhinoGame } from '../support/game-fixtures';
import { TestSession } from '../support/render-with-session';
import { thaw } from '../support/thaw-state';

const SPIDER_TRACER = '01007';
const STRENGTH = '01090';

/** Ultron with Spider-Man and Iron Man: The Crimson Cowl gives each hero one Drone at setup. */
const ultronGame = (): GameState => {
  const deck = Array(20).fill(cardCatalog.getCard('01005')!);
  return thaw(
    setupGame({
      catalog: cardCatalog,
      scenarioId: 'ultron',
      players: [
        {
          id: 'p1',
          name: 'Hero Seat 1 (Spider-Man)',
          hero: cardCatalog.getCard('01001a') as HeroCard,
          alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
          deckCards: deck,
        },
        {
          id: 'p2',
          name: 'Hero Seat 2 (Iron Man)',
          hero: cardCatalog.getCard('01029a') as HeroCard,
          alterEgo: cardCatalog.getCard('01029b') as AlterEgoCard,
          deckCards: deck,
        },
      ],
      skipMulligan: true,
    }),
  );
};

const withTracerInHand = (state: GameState): CardInstance => {
  const tracer = createCardInstance(cardCatalog.getCard(SPIDER_TRACER)!, 'p1');
  state.players[0].hand = [tracer, createCardInstance(cardCatalog.getCard(STRENGTH)!, 'p1')];
  return tracer;
};

const renderPayment = (state: GameState, tracer: CardInstance) => {
  const onConfirmPlay = vi.fn();
  render(
    <TestSession state={state}>
      <CardPaymentModal
        isOpen
        onClose={() => {}}
        cardToPlay={tracer}
        player={state.players[0]}
        onConfirmPlay={onConfirmPlay}
      />
    </TestSession>,
  );
  return onConfirmPlay;
};

const confirmButton = () =>
  screen.getByRole('button', { name: /Confirm & Play!/i }) as HTMLButtonElement;
const tile = (text: string) => screen.getByText(text).closest('button')!;
const payWithStrength = () => fireEvent.click(tile('Strength'));

describe('Spider-Tracer: the player chooses the Drone (Issue #645)', () => {
  it('Scenario 1: with two Drones, none is selected and Confirm stays disabled until one is clicked', () => {
    const state = ultronGame();
    renderPayment(state, withTracerInHand(state));

    payWithStrength();
    expect(confirmButton().disabled).toBe(true);
    expect(screen.getByText(/Choose one to play this card/i)).toBeTruthy();

    fireEvent.click(tile('Drone (engaged with Iron Man)'));
    expect(confirmButton().disabled).toBe(false);
    expect(screen.queryByText(/Choose one to play this card/i)).toBeNull();
  });

  it('Scenario 1: the clicked Drone is the one sent with the play', () => {
    const state = ultronGame();
    const ironManDrone = state.players[1].engagedMinions[0];
    const onConfirmPlay = renderPayment(state, withTracerInHand(state));

    payWithStrength();
    fireEvent.click(tile('Drone (engaged with Iron Man)'));
    fireEvent.click(confirmButton());

    expect(onConfirmPlay).toHaveBeenCalledTimes(1);
    expect(onConfirmPlay.mock.calls[0][2]).toBe(ironManDrone.instanceId);
  });

  it('Scenario 1: the target choice comes before the resources on the screen', () => {
    const state = ultronGame();
    renderPayment(state, withTracerInHand(state));

    const choice = screen.getByText('Select Enemy Target:');
    const resources = screen.getByText(/Discard Hand Cards for Resources/i);
    expect(
      choice.compareDocumentPosition(resources) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('Scenario 2: a single valid target is selected and Confirm needs only the payment', () => {
    const state = thaw(newRhinoGame());
    const mercenary = createCardInstance(cardCatalog.getCard('01101')!, 'p1');
    state.players[0].engagedMinions = [mercenary];
    const onConfirmPlay = renderPayment(state, withTracerInHand(state));

    expect(confirmButton().disabled).toBe(true);
    payWithStrength();
    expect(confirmButton().disabled).toBe(false);

    fireEvent.click(confirmButton());
    expect(onConfirmPlay.mock.calls[0][2]).toBe(mercenary.instanceId);
  });

  it('Scenario 3: a Drone holding a Spider-Tracer lists it on its tile', () => {
    const state = ultronGame();
    const own = state.players[0].engagedMinions[0];
    const tracked: CardInstance = {
      ...own,
      instanceId: 'drone_tracked',
      attachments: [createCardInstance(cardCatalog.getCard(SPIDER_TRACER)!, 'p1')],
    };
    state.players[0].engagedMinions = [own, tracked];
    state.players[1].engagedMinions = [];
    renderPayment(state, withTracerInHand(state));

    const tiles = screen.getAllByText('Drone (engaged with Spider-Man)');
    expect(tiles).toHaveLength(2);
    const details = tiles.map((t) => t.closest('button')!.textContent);
    expect(details.filter((text) => text?.includes('Spider-Tracer'))).toHaveLength(1);
  });
});
