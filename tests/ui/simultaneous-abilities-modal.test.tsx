import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SimultaneousAbilitiesModal } from '../../src/ui/components/board/SimultaneousAbilitiesModal';
import { PendingDecisionPrompt } from '../../src/engine/models';

describe('SimultaneousAbilitiesModal UI Component Tests (Issue #287)', () => {
  const samplePrompt: PendingDecisionPrompt = {
    promptId: 'prompt_order_simultaneous_1',
    playerId: 'p1',
    kind: 'ORDER_SIMULTANEOUS_ABILITIES',
    title: 'Simultaneous Optional Abilities: Choose Resolution Order',
    description:
      'Multiple optional abilities triggered simultaneously. The first player determines the order in which they resolve.',
    sourceCardName: 'False Alarm',
    sourceCardCode: '01112',
    isVoluntary: false,
    options: [
      {
        id: 'cand_1',
        label: 'Black Widow',
        cardName: 'Black Widow',
        cardCode: '01075',
        description: 'Exhaust Black Widow and spend 1 mental resource to cancel.',
        effect: 'ORDER_CANDIDATE',
        params: {
          promptId: 'cand_1',
          playerId: 'p1',
          playerName: 'Player 1 (Spider-Man)',
          triggerType: 'INTERRUPT',
        },
      },
      {
        id: 'cand_2',
        label: 'Enhanced Spider-Sense',
        cardName: 'Enhanced Spider-Sense',
        cardCode: '01004',
        description: 'Cancel When Revealed effects of a treachery.',
        effect: 'ORDER_CANDIDATE',
        params: {
          promptId: 'cand_2',
          playerId: 'p1',
          playerName: 'Player 1 (Spider-Man)',
          triggerType: 'HERO_INTERRUPT',
        },
      },
      {
        id: 'cand_3',
        label: 'Get Behind Me!',
        cardName: 'Get Behind Me!',
        cardCode: '01078',
        description: 'Cancel When Revealed effects. Villain attacks you instead.',
        effect: 'ORDER_CANDIDATE',
        params: {
          promptId: 'cand_3',
          playerId: 'p2',
          playerName: 'Player 2 (Captain Marvel)',
          triggerType: 'HERO_INTERRUPT',
        },
      },
    ],
    simultaneousPrompts: [
      {
        promptId: 'cand_1',
        playerId: 'p1',
        title: 'Use Black Widow?',
        description: 'Exhaust Black Widow and spend 1 mental resource to cancel.',
        sourceCardName: 'Black Widow',
        sourceCardCode: '01075',
        triggerType: 'INTERRUPT',
        options: [],
      },
      {
        promptId: 'cand_2',
        playerId: 'p1',
        title: 'Use Enhanced Spider-Sense?',
        description: 'Cancel When Revealed effects of a treachery.',
        sourceCardName: 'Enhanced Spider-Sense',
        sourceCardCode: '01004',
        triggerType: 'HERO_INTERRUPT',
        options: [],
      },
      {
        promptId: 'cand_3',
        playerId: 'p2',
        title: 'Use Get Behind Me!?',
        description: 'Cancel When Revealed effects. Villain attacks you instead.',
        sourceCardName: 'Get Behind Me!',
        sourceCardCode: '01078',
        triggerType: 'HERO_INTERRUPT',
        options: [],
      },
    ],
  };

  it('1. Renders candidates with card names, owner tags, and timing chips', () => {
    const onConfirmOrder = vi.fn();
    render(<SimultaneousAbilitiesModal prompt={samplePrompt} onConfirmOrder={onConfirmOrder} />);

    expect(screen.getByTestId('simultaneous-abilities-modal')).toBeDefined();
    expect(screen.getByText('Choose Resolution Order')).toBeDefined();
    expect(screen.queryByText('FIRST PLAYER CHOICE')).toBeNull();

    expect(screen.getByText('Black Widow')).toBeDefined();
    expect(screen.getByText('Enhanced Spider-Sense')).toBeDefined();
    expect(screen.getByText('Get Behind Me!')).toBeDefined();

    expect(screen.getAllByText('Player 1 (Spider-Man)').length).toBe(2);
    expect(screen.getByText('Player 2 (Captain Marvel)')).toBeDefined();

    expect(screen.getByText('INTERRUPT')).toBeDefined();
    expect(screen.getAllByText('HERO_INTERRUPT').length).toBe(2);
  });

  it('2. Up and down buttons reorder candidates in the resolution pipeline', () => {
    const onConfirmOrder = vi.fn();
    render(<SimultaneousAbilitiesModal prompt={samplePrompt} onConfirmOrder={onConfirmOrder} />);

    // Initial order: cand_1 (Black Widow), cand_2 (Enhanced Spider-Sense), cand_3 (Get Behind Me!)
    const moveDown1 = screen.getByTestId('move-down-cand_1');
    const moveUp1 = screen.getByTestId('move-up-cand_1');
    // First candidate has Up disabled
    expect((moveUp1 as HTMLButtonElement).disabled).toBe(true);

    // Move cand_1 down: new order [cand_2, cand_1, cand_3]
    fireEvent.click(moveDown1);

    // Now move cand_3 up: new order [cand_2, cand_3, cand_1]
    const moveUp3 = screen.getByTestId('move-up-cand_3');
    fireEvent.click(moveUp3);

    // Confirm order
    const confirmBtn = screen.getByTestId('confirm-order-button');
    fireEvent.click(confirmBtn);

    expect(onConfirmOrder).toHaveBeenCalledWith(['cand_2', 'cand_3', 'cand_1']);
  });

  it('3. Confirm button dispatches initial order if no reordering was performed', () => {
    const onConfirmOrder = vi.fn();
    render(<SimultaneousAbilitiesModal prompt={samplePrompt} onConfirmOrder={onConfirmOrder} />);

    const confirmBtn = screen.getByTestId('confirm-order-button');
    fireEvent.click(confirmBtn);

    expect(onConfirmOrder).toHaveBeenCalledWith(['cand_1', 'cand_2', 'cand_3']);
  });

  it('4. Orders simultaneous Forced abilities of two players, with no Pass option (#361)', () => {
    const onConfirmOrder = vi.fn();
    const forcedPrompt: PendingDecisionPrompt = {
      ...samplePrompt,
      title: 'Simultaneous Forced Abilities: Choose Resolution Order',
      description:
        'Multiple forced abilities triggered simultaneously. The first player determines the order in which they resolve.',
      options: [
        { ...samplePrompt.options[0], label: 'Black Widow (Player 1)' },
        { ...samplePrompt.options[2], label: 'Get Behind Me! (Player 2)' },
      ],
      simultaneousPrompts: [
        samplePrompt.simultaneousPrompts![0],
        samplePrompt.simultaneousPrompts![2],
      ],
    };
    render(<SimultaneousAbilitiesModal prompt={forcedPrompt} onConfirmOrder={onConfirmOrder} />);

    expect(screen.getByText(/Multiple forced abilities triggered simultaneously/)).toBeDefined();
    expect(screen.getByText('Player 1 (Spider-Man)')).toBeDefined();
    expect(screen.getByText('Player 2 (Captain Marvel)')).toBeDefined();
    expect(screen.queryByText(/pass/i)).toBeNull();

    fireEvent.click(screen.getByTestId('move-down-cand_1'));
    fireEvent.click(screen.getByTestId('confirm-order-button'));
    expect(onConfirmOrder).toHaveBeenCalledWith(['cand_3', 'cand_1']);
  });
});
