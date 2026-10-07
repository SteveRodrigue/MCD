import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { setupGame } from '../../src/engine/state/game-setup';
import { CardPaymentModal } from '../../src/ui/components/board/CardPaymentModal';
import { GamePhase, HeroCard, AlterEgoCard } from '../../src/engine/models';

// #277: the payment modal asks for the discard choice of an event ("up to 5") before it resolves.
describe('Legal Practice discard choice in the payment modal (#277)', () => {
  const setup = (handSize: number) => {
    const gameState = setupGame({
      players: [
        {
          id: 'p1',
          name: 'Jennifer Walters',
          hero: cardCatalog.getCard('01019a') as HeroCard,
          alterEgo: cardCatalog.getCard('01019b') as AlterEgoCard,
          deckCards: Array(15).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: [],
      skipMulligan: true,
    });
    gameState.phase = GamePhase.PLAYER_PHASE;
    const player = gameState.players[0];
    player.currentForm = 'alter_ego';
    player.activeFormCard = player.alterEgo;
    const legalPractice = {
      instanceId: 'lp',
      card: cardCatalog.getCard('01023')!,
      exhausted: false,
    };
    player.hand = [
      legalPractice,
      ...Array.from({ length: handSize }, (_, i) => ({
        instanceId: `h${i + 1}`,
        card: { ...cardCatalog.getCard('01005')!, name: `Filler ${i + 1}` },
        exhausted: false,
      })),
    ] as any;
    return { gameState, player, legalPractice };
  };

  const renderModal = (handSize: number) => {
    const { gameState, player, legalPractice } = setup(handSize);
    const onConfirmPlay = vi.fn();
    render(
      <CardPaymentModal
        isOpen={true}
        onClose={vi.fn()}
        cardToPlay={legalPractice as any}
        player={player}
        gameState={gameState}
        onConfirmPlay={onConfirmPlay}
      />,
    );
    return onConfirmPlay;
  };

  const confirm = () => screen.getByText('Confirm & Play!').closest('button')!;

  it('offers up to 5 hand cards (never the played card) and needs at least one', () => {
    const onConfirmPlay = renderModal(6);
    expect(screen.getByText(/Selected: 0 \/ 5/)).not.toBeNull();
    expect(confirm().disabled).toBe(true);

    fireEvent.click(screen.getAllByText('Filler 1')[0]);
    expect(confirm().disabled).toBe(false);

    for (const n of [2, 3, 4, 5, 6]) fireEvent.click(screen.getAllByText(`Filler ${n}`)[0]);
    expect(screen.getByText(/Selected: 5 \/ 5/)).not.toBeNull();

    fireEvent.click(confirm());
    expect(onConfirmPlay).toHaveBeenCalledTimes(1);
    expect(onConfirmPlay.mock.calls[0][3]).toEqual(['h1', 'h2', 'h3', 'h4', 'h5']);
  });
});
