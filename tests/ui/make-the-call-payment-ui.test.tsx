import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GameBoard } from '../../src/ui/components/board/GameBoard';
import { GameSettingsProvider } from '../../src/ui/context/GameSettingsProvider';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { setupGame } from '../../src/engine/state/game-setup';
import type {
  HeroCard,
  AlterEgoCard,
  CardInstance,
  PendingDecisionPrompt,
} from '../../src/engine/models';
import { GamePhase } from '../../src/engine/models';
import { dispatchAction, enqueueDecisionPrompt } from '../../src/engine/pipeline';

describe('Make the Call Payment UI Flow (Issue #173)', () => {
  const spiderManHero = cardCatalog.getCard('01001a') as HeroCard;
  const spiderManAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;
  const mtcCard = cardCatalog.getCard('01071')!; // Make the Call
  const mariaHillCard = cardCatalog.getCard('01067')!; // Maria Hill (cost 2)
  const energyCard = cardCatalog.getCard('01088')!; // Energy (2 resources)

  function createInstance(card: any, instanceId: string, ownerId: string = 'p1'): CardInstance {
    return {
      instanceId,
      card,
      ownerId,
      exhausted: false,
      tokens: {},
      counters: {},
      statusCards: [],
      activeStatModifiers: [],
      attachments: [],
      cardsUnderneath: [],
    };
  }

  function createTestGame() {
    const state = setupGame({
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: spiderManAlterEgo,
          deckCards: Array(15).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: [],
      skipMulligan: true,
    });

    state.phase = GamePhase.PLAYER_PHASE;
    state.activePlayerIndex = 0;
    const player = state.players[0];
    player.currentForm = 'hero';
    player.activeFormCard = player.hero;
    return { state, player };
  }

  beforeEach(() => {
    Element.prototype.scrollTo = vi.fn();
    Element.prototype.scrollBy = vi.fn();
    Element.prototype.getBoundingClientRect = vi.fn().mockReturnValue({
      top: 0,
      left: 0,
      right: 1920,
      bottom: 1080,
      width: 1920,
      height: 1080,
      x: 0,
      y: 0,
    });
  });

  it("opens CardPaymentModal when selecting an ally in Make the Call's Decision Prompt and resolves with pass when cancelled", () => {
    let { state, player } = createTestGame();
    const onDispatchAction = vi.fn();

    const mtcInst = createInstance(mtcCard, 'mtc_inst_1', 'p1');
    const mariaInst = createInstance(mariaHillCard, 'maria_inst_1', 'p1');
    const energyInst = createInstance(energyCard, 'energy_inst_1', 'p1');

    // Make the Call is in discard having been played
    player.discard = [mtcInst, mariaInst];
    player.hand = [energyInst];

    // Make the Call decision prompt is active
    const prompt: PendingDecisionPrompt = {
      promptId: 'prompt_mtc_1',
      playerId: 'p1',
      title: 'Choose a card to play:',
      description: 'Choose a card to pay for and play into your tableau:',
      sourceCardName: 'Make the Call',
      sourceCardCode: '01071',
      sourceCardInstanceId: 'mtc_inst_1',
      options: [
        {
          id: 'maria_inst_1',
          label: 'Maria Hill (Cost: 2)',
          description: mariaHillCard.text,
          effect: 'PLAY_CARD_FROM_ZONE_RESOLUTION',
          requiresPayment: true,
          params: {
            chosenInstanceId: 'maria_inst_1',
            ownerId: 'p1',
            source: 'ANY_PLAYER_DISCARD',
            destination: 'TABLEAU',
            control: 'SELF',
            costMode: 'PRINTED_COST',
            costReduction: 0,
            requiresPayment: true,
            resourceCost: { amount: 2 },
            costCardInstanceId: 'maria_inst_1',
            cardInstance: mariaInst,
          },
        },
        {
          id: 'pass_play_from_zone',
          label: 'Pass / Cancel',
          description: 'Do not play a card',
          effect: 'PLAY_CARD_FROM_ZONE_PASS',
          params: {},
        },
      ],
      isVoluntary: true,
    };

    state = enqueueDecisionPrompt(state, prompt);

    render(
      <GameSettingsProvider>
        <GameBoard gameState={state} onDispatchAction={onDispatchAction} onReset={vi.fn()} />
      </GameSettingsProvider>,
    );

    // 1. Verify Decision Prompt option for Maria Hill is displayed
    const mariaOptionButton = screen.getByRole('button', { name: /Maria Hill \(Cost: 2\)/i });
    expect(mariaOptionButton).not.toBeNull();

    // 2. Select Maria Hill
    fireEvent.click(mariaOptionButton);

    // 3. CardPaymentModal should now be open displaying Maria Hill
    expect(screen.getByText(/Resource Payment & Action/i)).not.toBeNull();
    expect(screen.getByText(/Play Maria Hill/i)).not.toBeNull();

    // 4. Click Cancel in CardPaymentModal
    const cancelButton = screen.getByRole('button', { name: /^cancel$/i });
    fireEvent.click(cancelButton);

    // 5. Verifies that canceling dispatches RESOLVE_DECISION_PROMPT with pass_play_from_zone
    expect(onDispatchAction).toHaveBeenCalledTimes(1);
    expect(onDispatchAction).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'RESOLVE_DECISION_PROMPT',
        playerId: 'p1',
        selectedOptionId: 'pass_play_from_zone',
      }),
    );

    // 6. Verifies that executing this action returns Make the Call to hand
    const { state: refundedState } = dispatchAction(state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: 'pass_play_from_zone',
    });

    const p1After = refundedState.players[0];
    expect(p1After.hand.some((c) => c.instanceId === 'mtc_inst_1')).toBe(true);
    expect(p1After.discard.some((c) => c.instanceId === 'mtc_inst_1')).toBe(false);
  });

  it('allows completing payment in CardPaymentModal and dispatches RESOLVE_DECISION_PROMPT with paymentCardInstanceIds', () => {
    let { state, player } = createTestGame();
    const onDispatchAction = vi.fn();

    const mtcInst = createInstance(mtcCard, 'mtc_inst_1', 'p1');
    const mariaInst = createInstance(mariaHillCard, 'maria_inst_1', 'p1');
    const energyInst = createInstance(energyCard, 'energy_inst_1', 'p1'); // 2 resources

    player.discard = [mtcInst, mariaInst];
    player.hand = [energyInst];

    const prompt: PendingDecisionPrompt = {
      promptId: 'prompt_mtc_1',
      playerId: 'p1',
      title: 'Choose a card to play:',
      description: 'Choose a card to pay for and play into your tableau:',
      sourceCardName: 'Make the Call',
      sourceCardCode: '01071',
      sourceCardInstanceId: 'mtc_inst_1',
      options: [
        {
          id: 'maria_inst_1',
          label: 'Maria Hill (Cost: 2)',
          description: mariaHillCard.text,
          effect: 'PLAY_CARD_FROM_ZONE_RESOLUTION',
          requiresPayment: true,
          params: {
            chosenInstanceId: 'maria_inst_1',
            ownerId: 'p1',
            source: 'ANY_PLAYER_DISCARD',
            destination: 'TABLEAU',
            control: 'SELF',
            costMode: 'PRINTED_COST',
            costReduction: 0,
            requiresPayment: true,
            resourceCost: { amount: 2 },
            costCardInstanceId: 'maria_inst_1',
            cardInstance: mariaInst,
          },
        },
        {
          id: 'pass_play_from_zone',
          label: 'Pass / Cancel',
          description: 'Do not play a card',
          effect: 'PLAY_CARD_FROM_ZONE_PASS',
          params: {},
        },
      ],
      isVoluntary: true,
    };

    state = enqueueDecisionPrompt(state, prompt);

    render(
      <GameSettingsProvider>
        <GameBoard gameState={state} onDispatchAction={onDispatchAction} onReset={vi.fn()} />
      </GameSettingsProvider>,
    );

    // Click Maria Hill
    const mariaOptionButton = screen.getByRole('button', { name: /Maria Hill \(Cost: 2\)/i });
    fireEvent.click(mariaOptionButton);

    // Select Energy resource card in payment modal
    const energyButton = screen.getByRole('button', { name: /Energy/i });
    fireEvent.click(energyButton);

    // Click Confirm & Play
    const confirmButton = screen.getByRole('button', { name: /Confirm & Play!/i });
    expect(confirmButton.hasAttribute('disabled')).toBe(false);
    fireEvent.click(confirmButton);

    // Verify onDispatchAction was called with RESOLVE_DECISION_PROMPT, maria_inst_1 and paymentCardInstanceIds
    expect(onDispatchAction).toHaveBeenCalledWith({
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: 'maria_inst_1',
      paymentCardInstanceIds: ['energy_inst_1'],
      generatorInstanceIds: [],
    });
  });
});
