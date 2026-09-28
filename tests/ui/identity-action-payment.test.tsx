import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { setupGame } from '../../src/engine/state/game-setup';
import { IdentityActionModal } from '../../src/ui/components/board/IdentityActionModal';
import { CardPaymentModal } from '../../src/ui/components/board/CardPaymentModal';
import { HeroZone } from '../../src/ui/components/board/HeroZone';
import { GameBoard } from '../../src/ui/components/board/GameBoard';
import { GameSettingsProvider } from '../../src/ui/context/GameSettingsProvider';
import { GamePhase } from '../../src/engine/models';

describe('Identity & Card Payment Subsystem Integration (Issue #162)', () => {
  const captainMarvelIdentity = cardCatalog.getHeroIdentity('captain_marvel')!;
  const spiderManIdentity = cardCatalog.getHeroIdentity('spider_man')!;
  const villain = cardCatalog.getCard('01094') as any;
  const mainScheme = cardCatalog.getCard('01097b') as any;

  function createTestGame(options?: {
    heroKey?: 'captain_marvel' | 'spider_man';
    form?: 'hero' | 'alter_ego';
  }) {
    const ident = options?.heroKey === 'spider_man' ? spiderManIdentity : captainMarvelIdentity;
    const gameState = setupGame({
      players: [
        {
          id: 'p1',
          name: ident.hero.name,
          hero: ident.hero,
          alterEgo: ident.alterEgo,
          deckCards: Array(15).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain,
      mainScheme,
      encounterCards: [],
      skipMulligan: true,
    });

    gameState.phase = GamePhase.PLAYER_PHASE;
    gameState.activePlayerIndex = 0;
    const p1 = gameState.players[0];
    p1.currentForm = options?.form || 'hero';
    p1.activeFormCard = p1.currentForm === 'hero' ? p1.hero : p1.alterEgo;
    return { gameState, player: p1, ident };
  }

  describe('1. IdentityActionModal Direct Payment Routing', () => {
    it('routes Rechannel with energy resource cost through onInitiateAction instead of raw onDispatchAction', () => {
      const { gameState, player, ident } = createTestGame({
        heroKey: 'captain_marvel',
        form: 'hero',
      });
      const onDispatchAction = vi.fn();
      const onInitiateAction = vi.fn();
      const onClose = vi.fn();

      player.health = 9; // Injured (max is 12)
      player.hand = [
        {
          instanceId: 'inst_energy_card',
          card: cardCatalog.getCard('01014')!, // Energy Channel (1 energy icon)
          ownerId: 'p1',
        },
      ];

      render(
        <IdentityActionModal
          isOpen={true}
          player={player}
          gameState={gameState}
          onClose={onClose}
          onDispatchAction={onDispatchAction}
          onInitiateAction={onInitiateAction}
        />,
      );

      const rechannelButton = screen.getByText('RECHANNEL').closest('button');
      expect(rechannelButton).not.toBeNull();
      expect(rechannelButton?.disabled).toBe(false);

      fireEvent.click(rechannelButton!);

      expect(onInitiateAction).toHaveBeenCalledTimes(1);
      expect(onInitiateAction).toHaveBeenCalledWith(
        expect.objectContaining({
          requiresModal: 'payment',
          action: expect.objectContaining({
            type: 'USE_CARD_ABILITY',
            playerId: 'p1',
            cardInstanceId: ident.hero.code,
            abilityId: 'rechannel',
          }),
        }),
      );

      expect(onDispatchAction).not.toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });

    it('dispatches free identity ability (Commander 01010b) directly without opening payment modal', () => {
      const { gameState, player, ident } = createTestGame({
        heroKey: 'captain_marvel',
        form: 'alter_ego',
      });
      const onDispatchAction = vi.fn();
      const onInitiateAction = vi.fn();
      const onClose = vi.fn();

      render(
        <IdentityActionModal
          isOpen={true}
          player={player}
          gameState={gameState}
          onClose={onClose}
          onDispatchAction={onDispatchAction}
          onInitiateAction={onInitiateAction}
        />,
      );

      const commanderButton = screen.getByText('COMMANDER').closest('button');
      expect(commanderButton).not.toBeNull();
      expect(commanderButton?.disabled).toBe(false);

      fireEvent.click(commanderButton!);

      expect(onDispatchAction).toHaveBeenCalledTimes(1);
      expect(onDispatchAction).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'USE_CARD_ABILITY',
          playerId: 'p1',
          cardInstanceId: ident.alterEgo.code,
          abilityId: 'commander',
        }),
      );
      expect(onInitiateAction).not.toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('2. Centralized Action Interceptor (GameBoard.tsx)', () => {
    it('intercepts raw USE_CARD_ABILITY with missing payment and opens CardPaymentModal', () => {
      const { gameState, player } = createTestGame({ heroKey: 'captain_marvel', form: 'hero' });
      const onDispatchAction = vi.fn();

      player.health = 9;
      player.hand = [
        {
          instanceId: 'inst_energy_card',
          card: cardCatalog.getCard('01088')!, // Energy (energy resource)
          ownerId: 'p1',
        },
      ];

      render(
        <GameSettingsProvider>
          <GameBoard gameState={gameState} onReset={vi.fn()} onDispatchAction={onDispatchAction} />
        </GameSettingsProvider>,
      );

      // Open Identity Action Modal via Hero Card click
      const heroCard = screen.getByTestId('hero-identity-card');
      fireEvent.click(heroCard);

      // Trigger RECHANNEL button
      const rechannelButton = screen.getByText('RECHANNEL').closest('button');
      expect(rechannelButton).not.toBeNull();
      fireEvent.click(rechannelButton!);

      // The raw onDispatchAction must NOT have been called with empty payment
      expect(onDispatchAction).not.toHaveBeenCalled();

      // CardPaymentModal must now be open, displaying the payment requirement for Rechannel
      expect(screen.getByText('Action: RECHANNEL')).not.toBeNull();
      expect(screen.getByText('Energy')).not.toBeNull();
    });
  });

  describe('3. CardPaymentModal Interactive Selection Invariants', () => {
    it('presents multiple energy cards in hand as discrete interactive options allowing user to choose which to spend', () => {
      const { gameState, player, ident } = createTestGame({
        heroKey: 'captain_marvel',
        form: 'hero',
      });
      const onConfirmPlay = vi.fn();
      const onClose = vi.fn();

      const card1 = cardCatalog.getCard('01014')!; // Energy Channel
      const card2 = cardCatalog.getCard('01012')!; // Crisis Interdiction
      const card3 = cardCatalog.getCard('01013')!; // Photonic Blast

      player.hand = [
        { instanceId: 'energy_card_1', card: card1 },
        { instanceId: 'energy_card_2', card: card2 },
        { instanceId: 'energy_card_3', card: card3 },
      ];

      render(
        <CardPaymentModal
          isOpen={true}
          onClose={onClose}
          cardToPlay={{
            instanceId: ident.hero.code,
            card: ident.hero,
            exhausted: false,
          }}
          abilityCost={{
            amount: 1,
            resourceType: 'energy',
            title: 'Action: RECHANNEL',
          }}
          player={player}
          gameState={gameState}
          onConfirmPlay={onConfirmPlay}
        />,
      );

      // Verify all 3 hand cards are displayed
      expect(screen.getByText(card1.name)).not.toBeNull();
      expect(screen.getByText(card2.name)).not.toBeNull();
      expect(screen.getByText(card3.name)).not.toBeNull();

      // Click card 2 to select it for payment
      const secondCard = screen.getByText(card2.name);
      fireEvent.click(secondCard);

      // Confirm button should now be enabled
      const confirmButton = screen.getByRole('button', {
        name: /CONFIRM & PLAY|PAY & TRIGGER ABILITY/i,
      });
      expect(confirmButton.hasAttribute('disabled')).toBe(false);

      fireEvent.click(confirmButton);

      // Expect onConfirmPlay to have been called with exactly the 2nd card's instanceId
      expect(onConfirmPlay).toHaveBeenCalledWith(['energy_card_2'], [], undefined, []);
    });

    it('allows player to choose a ready generator instead of discarding a hand card', () => {
      const { gameState, player, ident } = createTestGame({
        heroKey: 'captain_marvel',
        form: 'hero',
      });
      const onConfirmPlay = vi.fn();
      const onClose = vi.fn();

      const handCard = cardCatalog.getCard('01014')!; // Energy Channel
      player.hand = [{ instanceId: 'hand_energy_card', card: handCard }];
      // Pepper Potts generates resource based on top card of player discard pile
      player.discard = [
        { instanceId: 'disc_card', card: cardCatalog.getCard('01005')! }, // 1 physical
      ];

      // Add Pepper Potts (generator) to tableau
      const ppCard = cardCatalog.getCard('01033')!;
      player.tableau = [
        {
          instanceId: 'pp_generator',
          card: ppCard,
          exhausted: false,
        },
      ];

      render(
        <CardPaymentModal
          isOpen={true}
          onClose={onClose}
          cardToPlay={{
            instanceId: ident.hero.code,
            card: ident.hero,
            exhausted: false,
          }}
          abilityCost={{
            amount: 1,
            resourceType: 'wild',
            title: 'Action: RECHANNEL',
          }}
          player={player}
          gameState={gameState}
          onConfirmPlay={onConfirmPlay}
        />,
      );

      // Both hand card and generator should be displayed
      expect(screen.getByText(handCard.name)).not.toBeNull();
      expect(screen.getByText(ppCard.name)).not.toBeNull();

      // Click the Pepper Potts generator to select it
      const generatorItem = screen.getByText(ppCard.name);
      fireEvent.click(generatorItem);

      // Confirm payment
      const confirmButton = screen.getByRole('button', {
        name: /CONFIRM & PLAY|PAY & TRIGGER ABILITY/i,
      });
      fireEvent.click(confirmButton);

      // Generator selected, hand card not spent
      expect(onConfirmPlay).toHaveBeenCalledWith([], ['pp_generator'], undefined, []);
    });
  });

  describe('4. RES (Available Resources) Counter Display (HeroZone.tsx)', () => {
    it('renders the RES counter badge directly below HS in Hero form with correct total and tooltip', () => {
      const { gameState, player } = createTestGame({ heroKey: 'captain_marvel', form: 'hero' });
      player.hand = [
        { instanceId: 'c1', card: cardCatalog.getCard('01005')! }, // 1 physical
        { instanceId: 'c2', card: cardCatalog.getCard('01088')! }, // 2 energy
      ];

      render(
        <HeroZone
          player={player}
          gameState={gameState}
          seatNumber={1}
          isFocused={true}
          isMultiHero={false}
          onDispatchAction={vi.fn()}
        />,
      );

      const resCounter = screen.getByTestId('hero-available-resources-counter');
      expect(resCounter).not.toBeNull();
      expect(resCounter.textContent).toContain('RES');
      expect(resCounter.textContent).toContain('3'); // 1 + 2 = 3
      expect(resCounter.getAttribute('title')).toContain('Available Resources: 3');
      expect(resCounter.getAttribute('title')).toContain('3 Hand');
    });

    it('renders the RES counter badge directly below HS in Alter-Ego form including identity abilities', () => {
      const { gameState, player } = createTestGame({ heroKey: 'spider_man', form: 'alter_ego' });
      player.hand = [
        { instanceId: 'c1', card: cardCatalog.getCard('01005')! }, // 1 physical
      ];

      render(
        <HeroZone
          player={player}
          gameState={gameState}
          seatNumber={1}
          isFocused={true}
          isMultiHero={false}
          onDispatchAction={vi.fn()}
        />,
      );

      const resCounter = screen.getByTestId('hero-available-resources-counter');
      expect(resCounter).not.toBeNull();
      expect(resCounter.textContent).toContain('RES');
      expect(resCounter.textContent).toContain('2'); // 1 hand + 1 Peter Parker Scientist = 2
      expect(resCounter.getAttribute('title')).toContain('Available Resources: 2');
      expect(resCounter.getAttribute('title')).toContain('1 Hand, 1 Identity');
    });

    it('dynamically updates RES counter when a card is discarded from hand', () => {
      const { gameState, player } = createTestGame({ heroKey: 'captain_marvel', form: 'hero' });
      player.hand = [
        { instanceId: 'c1', card: cardCatalog.getCard('01005')! },
        { instanceId: 'c2', card: cardCatalog.getCard('01005')! },
      ];

      const { rerender } = render(
        <HeroZone
          player={player}
          gameState={gameState}
          seatNumber={1}
          isFocused={true}
          isMultiHero={false}
          onDispatchAction={vi.fn()}
        />,
      );

      let resCounter = screen.getByTestId('hero-available-resources-counter');
      expect(resCounter.textContent).toContain('2');

      // Discard 1 card
      player.hand = [{ instanceId: 'c1', card: cardCatalog.getCard('01005')! }];
      rerender(
        <HeroZone
          player={player}
          gameState={gameState}
          seatNumber={1}
          isFocused={true}
          isMultiHero={false}
          onDispatchAction={vi.fn()}
        />,
      );

      resCounter = screen.getByTestId('hero-available-resources-counter');
      expect(resCounter.textContent).toContain('1');
    });
  });
});
