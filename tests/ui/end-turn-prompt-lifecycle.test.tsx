import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { GameBoard } from '../../src/ui/components/board/GameBoard';
import { GameSettingsProvider } from '../../src/ui/context/GameSettingsProvider';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { setupGame } from '../../src/engine/state/game-setup';
import {
  GameState,
  HeroCard,
  AlterEgoCard,
  GamePhase,
  VillainPhaseStep,
} from '../../src/engine/models';

describe('End Turn Confirmation Modal Lifecycle (Issue #169)', () => {
  const ironManHero = cardCatalog.getCard('01029a') as HeroCard;
  const tonyStarkAlterEgo = cardCatalog.getCard('01029b') as AlterEgoCard;
  const spidermanHero = cardCatalog.getCard('01001a') as HeroCard;
  const spidermanAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;

  function createTestGameState(): GameState {
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Tony Stark',
          hero: ironManHero,
          alterEgo: tonyStarkAlterEgo,
          deckCards: Array(15).fill(cardCatalog.getCard('01005')!),
        },
        {
          id: 'p2',
          name: 'Peter Parker',
          hero: spidermanHero,
          alterEgo: spidermanAlterEgo,
          deckCards: Array(15).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
    return state;
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

  it('does NOT display End Turn confirmation modal when transitioning from VILLAIN_PHASE to PLAYER_PHASE with 0 actions', () => {
    const state = createTestGameState();
    state.phase = GamePhase.VILLAIN_PHASE;
    state.villainPhaseStep = VillainPhaseStep.PASS_FIRST_PLAYER;
    state.firstPlayerIndex = 0;
    state.activePlayerIndex = 0;

    const { rerender, queryByText } = render(
      <GameSettingsProvider>
        <GameBoard gameState={state} onReset={vi.fn()} onDispatchAction={vi.fn()} />
      </GameSettingsProvider>,
    );

    // Transition to Round 2 PLAYER_PHASE where Player 1 has 0 actions
    // (exhausted hero, empty hand, form already changed)
    const nextRoundState: GameState = JSON.parse(JSON.stringify(state));
    nextRoundState.phase = GamePhase.PLAYER_PHASE;
    delete nextRoundState.villainPhaseStep;
    delete nextRoundState.villainPhaseStepEvent;
    nextRoundState.roundNumber = 2;
    nextRoundState.activePlayerIndex = 0;

    const p1 = nextRoundState.players[0];
    p1.currentForm = 'hero';
    p1.activeFormCard = ironManHero;
    p1.exhausted = true;
    p1.formChangedThisRound = true;
    p1.basicChangeFormUsedThisRound = true;
    p1.hand = [];
    p1.tableau = [];
    p1.allies = [];

    act(() => {
      rerender(
        <GameSettingsProvider>
          <GameBoard gameState={nextRoundState} onReset={vi.fn()} onDispatchAction={vi.fn()} />
        </GameSettingsProvider>,
      );
    });

    // The modal should NOT appear at turn start!
    expect(queryByText(/PRESS RUN COMPLETE!/i)).toBeNull();
    expect(queryByText(/All Actions Resolved for/i)).toBeNull();
  });

  it('does NOT display End Turn confirmation modal when switching active players if new player starts with 0 actions', () => {
    const state = createTestGameState();
    state.phase = GamePhase.PLAYER_PHASE;
    state.roundNumber = 1;
    state.activePlayerIndex = 0; // Player 1 active with playable actions

    const { rerender, queryByText } = render(
      <GameSettingsProvider>
        <GameBoard gameState={state} onReset={vi.fn()} onDispatchAction={vi.fn()} />
      </GameSettingsProvider>,
    );

    // Player 1 passes turn to Player 2, but Player 2 has 0 actions
    const nextPlayerState: GameState = JSON.parse(JSON.stringify(state));
    nextPlayerState.activePlayerIndex = 1; // Player 2 active

    const p2 = nextPlayerState.players[1];
    p2.currentForm = 'hero';
    p2.activeFormCard = spidermanHero;
    p2.exhausted = true;
    p2.formChangedThisRound = true;
    p2.basicChangeFormUsedThisRound = true;
    p2.hand = [];
    p2.tableau = [];
    p2.allies = [];

    act(() => {
      rerender(
        <GameSettingsProvider>
          <GameBoard gameState={nextPlayerState} onReset={vi.fn()} onDispatchAction={vi.fn()} />
        </GameSettingsProvider>,
      );
    });

    // The modal should NOT appear for Player 2 on turn switch!
    expect(queryByText(/PRESS RUN COMPLETE!/i)).toBeNull();
    expect(queryByText(/All Actions Resolved for/i)).toBeNull();
  });

  it('does NOT display End Turn confirmation modal across round transition if player starts new round with 0 actions', () => {
    const state = createTestGameState();
    state.phase = GamePhase.PLAYER_PHASE;
    state.roundNumber = 1;
    state.activePlayerIndex = 0; // Player 1 active with playable actions (>0)

    const { rerender, queryByText } = render(
      <GameSettingsProvider>
        <GameBoard gameState={state} onReset={vi.fn()} onDispatchAction={vi.fn()} />
      </GameSettingsProvider>,
    );

    // Round 2 begins directly (e.g. after upkeep / instant villain phase), but player starts with 0 actions
    const nextRoundState: GameState = JSON.parse(JSON.stringify(state));
    nextRoundState.roundNumber = 2;
    nextRoundState.phase = GamePhase.PLAYER_PHASE;
    nextRoundState.activePlayerIndex = 0;

    const p1 = nextRoundState.players[0];
    p1.currentForm = 'hero';
    p1.activeFormCard = ironManHero;
    p1.exhausted = true;
    p1.formChangedThisRound = true;
    p1.basicChangeFormUsedThisRound = true;
    p1.hand = [];
    p1.tableau = [];
    p1.allies = [];

    act(() => {
      rerender(
        <GameSettingsProvider>
          <GameBoard gameState={nextRoundState} onReset={vi.fn()} onDispatchAction={vi.fn()} />
        </GameSettingsProvider>,
      );
    });

    // The modal should NOT appear on round transition!
    expect(queryByText(/PRESS RUN COMPLETE!/i)).toBeNull();
    expect(queryByText(/All Actions Resolved for/i)).toBeNull();
  });

  it('DOES display End Turn confirmation modal when active actions drop from >0 to 0 during the SAME turn', () => {
    const state = createTestGameState();
    state.phase = GamePhase.PLAYER_PHASE;
    state.roundNumber = 1;
    state.activePlayerIndex = 0;

    const p1 = state.players[0];
    p1.currentForm = 'hero';
    p1.activeFormCard = ironManHero;
    p1.exhausted = false; // Hero ready -> basic attack / thwart available
    p1.hand = [];
    p1.tableau = [];
    p1.allies = [];

    const { rerender, queryByText } = render(
      <GameSettingsProvider>
        <GameBoard gameState={state} onReset={vi.fn()} onDispatchAction={vi.fn()} />
      </GameSettingsProvider>,
    );

    expect(queryByText(/PRESS RUN COMPLETE!/i)).toBeNull();

    // Now player performs basic attack, exhausting hero and leaving 0 actions during the same turn
    const stateAfterAction: GameState = JSON.parse(JSON.stringify(state));
    const p1After = stateAfterAction.players[0];
    p1After.exhausted = true;
    p1After.formChangedThisRound = true;
    p1After.basicChangeFormUsedThisRound = true;

    act(() => {
      rerender(
        <GameSettingsProvider>
          <GameBoard gameState={stateAfterAction} onReset={vi.fn()} onDispatchAction={vi.fn()} />
        </GameSettingsProvider>,
      );
    });

    // Modal SHOULD appear when actions genuinely drop to 0 during turn
    expect(queryByText(/PRESS RUN COMPLETE!/i)).not.toBeNull();
    expect(queryByText(/All Actions Resolved for Tony Stark/i)).not.toBeNull();
  });
});
