import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { DecisionPromptModal } from '../../src/ui/components/board/DecisionPromptModal';
import { SelectCardsModal } from '../../src/ui/components/board/SelectCardsModal';
import { GameSessionProvider } from '../../src/ui/context/GameStateContext';
import { setupGame } from '../../src/engine/state/game-setup';
import { PendingDecisionPrompt, HeroCard, AlterEgoCard } from '../../src/engine/models';

describe('DecisionPromptModal Player Seat Indication (Issue #344)', () => {
  const sheHulkHero = cardCatalog.getCard('01019a') as HeroCard;
  const sheHulkAlterEgo = cardCatalog.getCard('01019b') as AlterEgoCard;
  const blackPantherHero = cardCatalog.getCard('01040a') as HeroCard;
  const blackPantherAlterEgo = cardCatalog.getCard('01040b') as AlterEgoCard;
  const emergencyCard = cardCatalog.getCard('01085')!;

  function createMultiplayerGame() {
    return setupGame({
      catalog: cardCatalog,
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'She-Hulk / Jennifer Walters',
          hero: sheHulkHero,
          alterEgo: sheHulkAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
        {
          id: 'p2',
          name: "Black Panther / T'Challa",
          hero: blackPantherHero,
          alterEgo: blackPantherAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      skipMulligan: true,
    });
  }

  it('correctly provides seat and hero info sequentially when 2 players both hold Emergency in hand', () => {
    const gameState = createMultiplayerGame();

    const prompt1: PendingDecisionPrompt = {
      promptId: 'prompt_trigger_emergency_p1',
      playerId: 'p1',
      title: 'Do you want to use the following ability from Emergency (Cost: 0 resources)?',
      description: 'When threat would be placed on a scheme, prevent 1 of that threat.',
      sourceCardName: 'Emergency',
      sourceCardCode: emergencyCard.code,
      triggerType: 'INTERRUPT',
      isVoluntary: true,
      queuePosition: 1,
      totalQueued: 2,
      options: [
        { id: 'yes', label: 'Yes', effect: 'PREVENT_THREAT' },
        { id: 'pass', label: 'Pass', effect: 'PASS' },
      ],
    };

    const prompt2: PendingDecisionPrompt = {
      promptId: 'prompt_trigger_emergency_p2',
      playerId: 'p2',
      title: 'Do you want to use the following ability from Emergency (Cost: 0 resources)?',
      description: 'When threat would be placed on a scheme, prevent 1 of that threat.',
      sourceCardName: 'Emergency',
      sourceCardCode: emergencyCard.code,
      triggerType: 'INTERRUPT',
      isVoluntary: true,
      queuePosition: 2,
      totalQueued: 2,
      options: [
        { id: 'yes', label: 'Yes', effect: 'PREVENT_THREAT' },
        { id: 'pass', label: 'Pass', effect: 'PASS' },
      ],
    };

    // Step A: First prompt for Seat 1 (She-Hulk)
    const { rerender } = render(
      <DecisionPromptModal prompt={prompt1} players={gameState.players} onSelectOption={vi.fn()} />,
    );

    // Header chip must identify Seat 1 and She-Hulk
    const chipP1 = screen.getByTestId('decision-prompt-player-badge');
    expect(chipP1.textContent).toContain('SEAT 1:');
    expect(chipP1.textContent).toContain('She-Hulk / Jennifer Walters');

    // Header right queue chip
    expect(screen.getByText('QUEUE: 1 OF 2')).toBeDefined();

    // Kicker must indicate Seat 1
    expect(screen.getByText(/SEAT 1 • OPTIONAL DECISION/i)).toBeDefined();

    // Body banner must indicate Seat 1 with DECIDING PLAYER
    const bannerP1 = screen.getByTestId('decision-prompt-player-banner');
    expect(bannerP1.textContent).toContain('SEAT 1: She-Hulk / Jennifer Walters');
    expect(bannerP1.textContent).toContain('DECIDING PLAYER');

    // Step B: Second prompt for Seat 2 (Black Panther)
    rerender(
      <DecisionPromptModal prompt={prompt2} players={gameState.players} onSelectOption={vi.fn()} />,
    );

    // Header chip must now identify Seat 2 and Black Panther
    const chipP2 = screen.getByTestId('decision-prompt-player-badge');
    expect(chipP2.textContent).toContain('SEAT 2:');
    expect(chipP2.textContent).toContain("Black Panther / T'Challa");

    // Header right queue chip
    expect(screen.getByText('QUEUE: 2 OF 2')).toBeDefined();

    // Kicker must indicate Seat 2
    expect(screen.getByText(/SEAT 2 • OPTIONAL DECISION/i)).toBeDefined();

    // Body banner must indicate Seat 2 with DECIDING PLAYER
    const bannerP2 = screen.getByTestId('decision-prompt-player-banner');
    expect(bannerP2.textContent).toContain("SEAT 2: Black Panther / T'Challa");
    expect(bannerP2.textContent).toContain('DECIDING PLAYER');
  });

  it('omits the multiplayer ribbon in solo game while keeping the hero chip in header', () => {
    const singlePlayerGame = setupGame({
      catalog: cardCatalog,
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'She-Hulk',
          hero: sheHulkHero,
          alterEgo: sheHulkAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      skipMulligan: true,
    });

    const prompt: PendingDecisionPrompt = {
      promptId: 'prompt_trigger_emergency_solo',
      playerId: 'p1',
      title: 'Do you want to use the following ability from Emergency?',
      description: 'Prevent 1 threat.',
      sourceCardName: 'Emergency',
      sourceCardCode: emergencyCard.code,
      triggerType: 'INTERRUPT',
      isVoluntary: true,
      options: [{ id: 'yes', label: 'Yes', effect: 'PREVENT_THREAT' }],
    };

    render(
      <DecisionPromptModal
        prompt={prompt}
        players={singlePlayerGame.players}
        onSelectOption={vi.fn()}
      />,
    );

    // In solo, the extra body ribbon is omitted to prevent visual clutter
    expect(screen.queryByTestId('decision-prompt-player-banner')).toBeNull();

    // Header chip shows hero name without SEAT prefix
    const chip = screen.getByTestId('decision-prompt-player-badge');
    expect(chip.textContent).toContain('She-Hulk');
    expect(chip.textContent).not.toContain('SEAT');

    // Kicker stays standard
    expect(screen.getByText('OPTIONAL DECISION')).toBeDefined();
  });

  it('reads players from useOptionalGameSession if players prop is omitted', () => {
    const gameState = createMultiplayerGame();

    const prompt: PendingDecisionPrompt = {
      promptId: 'prompt_session_fallback',
      playerId: 'p2',
      title: 'Emergency interrupt',
      description: 'Prevent threat',
      sourceCardName: 'Emergency',
      sourceCardCode: emergencyCard.code,
      options: [{ id: 'yes', label: 'Yes', effect: 'PREVENT_THREAT' }],
    };

    render(
      <GameSessionProvider state={gameState} dispatch={vi.fn()}>
        <DecisionPromptModal prompt={prompt} onSelectOption={vi.fn()} />
      </GameSessionProvider>,
    );

    const banner = screen.getByTestId('decision-prompt-player-banner');
    expect(banner.textContent).toContain("SEAT 2: Black Panther / T'Challa");
  });

  it('shows the player seat chip in SelectCardsModal when rendered for multiplayer', () => {
    const gameState = createMultiplayerGame();

    const prompt: PendingDecisionPrompt = {
      promptId: 'prompt_select_cards_p2',
      playerId: 'p2',
      title: 'Search your deck',
      description: 'Select up to 1 card',
      sourceCardName: 'Test Search',
      selection: { min: 0, max: 1 },
      options: [{ id: 'opt1', label: 'Card 1', effect: 'SEARCH', params: { cardName: 'Card 1' } }],
    };

    render(
      <GameSessionProvider state={gameState} dispatch={vi.fn()}>
        <SelectCardsModal prompt={prompt} onConfirm={vi.fn()} />
      </GameSessionProvider>,
    );

    const chip = screen.getByTestId('select-cards-player-badge');
    expect(chip.textContent).toContain('SEAT 2:');
    expect(chip.textContent).toContain("Black Panther / T'Challa");
  });
});
