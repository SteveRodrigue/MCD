import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GameBoard } from '../../src/ui/components/board/GameBoard';
import { GameSettingsProvider } from '../../src/ui/context/GameSettingsProvider';
import {
  GamePhase,
  GameState,
  HeroCard,
  AlterEgoCard,
  CombatResolutionSummary,
  PendingDecisionPrompt,
} from '../../src/engine/models';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { setupGame, createCardInstance } from '../../src/engine/state/game-setup';
import { TestSession } from '../support/render-with-session';

describe('GameBoard Combat Boost & Decision Prompt Sequencing (Issue #441, #402)', () => {
  let spiderManHero: HeroCard;
  let peterParkerAlterEgo: AlterEgoCard;

  beforeEach(() => {
    spiderManHero = cardCatalog.getCard('01001a') as HeroCard;
    peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;

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

  function createCombatStateWithReactionPrompt(): {
    state: GameState;
    outcome: CombatResolutionSummary;
    prompt: PendingDecisionPrompt;
  } {
    const state = setupGame({
      catalog: cardCatalog,
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Peter Parker',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(15).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    state.phase = GamePhase.VILLAIN_PHASE;
    state.activePlayerIndex = 0;

    const boostCard = createCardInstance({
      ...cardCatalog.getCard('01107')!,
      boostIcons: 1,
    });

    const outcome: CombatResolutionSummary = {
      id: 'attack_441',
      attackerName: 'Rhino',
      attackerType: 'VILLAIN',
      targetPlayerId: 'p1',
      targetHeroName: 'Spider-Man',
      baseAttack: 2,
      boostCards: [boostCard],
      totalBoostIcons: 1,
      defenseValue: 3,
      defenderType: 'HERO',
      defenderName: 'Spider-Man',
      finalDamage: 0,
      hasOverkill: false,
      hasPiercing: false,
    };

    const prompt: PendingDecisionPrompt = {
      promptId: 'prompt_trigger_counter_punch_response',
      playerId: 'p1',
      title: 'Counter-Punch',
      description:
        'After your hero defends against an enemy attack, deal damage to that enemy equal to your hero ATK.',
      sourceCardName: 'Counter-Punch',
      sourceCardCode: '01077',
      options: [
        {
          id: 'trigger_counter_punch_response',
          label: 'Trigger Counter-Punch',
          effect: 'DEAL_DAMAGE',
        },
        {
          id: 'pass',
          label: 'Pass',
          effect: 'PASS',
        },
      ],
    };

    state.lastCombatOutcome = outcome;
    state.pendingDecisionQueue = [prompt];

    return { state, outcome, prompt };
  }

  it('renders CombatBoostModal first when lastCombatOutcome exists, even if a post-defense decision prompt is queued', () => {
    const { state } = createCombatStateWithReactionPrompt();

    render(
      <GameSettingsProvider>
        <TestSession state={state}>
          <GameBoard onReset={vi.fn()} />
        </TestSession>
      </GameSettingsProvider>,
    );

    // Combat summary with boost card must be shown first
    expect(screen.getByTestId('combat-boost-modal')).toBeDefined();
    expect(screen.getByText('Base ATK')).toBeDefined();
    expect(screen.getByText('Boost Icons')).toBeDefined();

    // The reaction decision prompt modal should NOT obscure the combat summary
    expect(screen.queryByTestId('decision-prompt-modal')).toBeNull();
  });

  it('renders the post-defense DecisionPromptModal only after CombatBoostModal is dismissed, without advancing the villain phase', () => {
    const { state } = createCombatStateWithReactionPrompt();
    const mockDispatch = vi.fn();

    render(
      <GameSettingsProvider>
        <TestSession state={state} dispatch={mockDispatch}>
          <GameBoard onReset={vi.fn()} />
        </TestSession>
      </GameSettingsProvider>,
    );

    // 1. Initial render has combat boost modal
    expect(screen.getByTestId('combat-boost-modal')).toBeDefined();
    expect(screen.queryByTestId('decision-prompt-modal')).toBeNull();

    // 2. Player clicks Continue on the boost modal
    const continueBtn = screen.getByRole('button', { name: /continue/i });
    fireEvent.click(continueBtn);

    // 3. CombatBoostModal is closed, DecisionPromptModal is now shown
    expect(screen.queryByTestId('combat-boost-modal')).toBeNull();
    expect(screen.getByTestId('decision-prompt-modal')).toBeDefined();
    expect(screen.getByText('Trigger Counter-Punch')).toBeDefined();

    // 4. Must NOT have dispatched ADVANCE_VILLAIN_PHASE because a decision prompt was pending
    expect(mockDispatch).not.toHaveBeenCalledWith({ type: 'ADVANCE_VILLAIN_PHASE' });
  });
});
