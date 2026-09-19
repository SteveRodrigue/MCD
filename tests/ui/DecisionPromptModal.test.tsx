import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { DecisionPromptModal } from '../../src/ui/components/board/DecisionPromptModal';
import { PendingDecisionPrompt } from '../../src/engine/models';

describe('DecisionPromptModal Card Preview (Issue #104)', () => {
  it('renders triggering card showcase and thumbnail with printed text and handles option selection', () => {
    const falseAlarmCard = cardCatalog.getCard('01112')!;
    const onSelectOption = vi.fn();

    const prompt: PendingDecisionPrompt = {
      promptId: 'prompt_test_1',
      playerId: 'p1',
      title: 'Do you want to use the following ability from Enhanced Spider-Sense?',
      description: "Cancel the 'When Revealed' effects of that treachery.",
      sourceCardName: 'Enhanced Spider-Sense',
      sourceCardCode: '01004',
      triggerSourceName: 'False Alarm',
      triggerSourceCode: '01112',
      triggerSourceCard: falseAlarmCard,
      options: [
        { id: 'yes', label: 'Yes', effect: 'CANCEL' },
        { id: 'pass', label: 'No', effect: 'PASS' },
      ],
      isVoluntary: true,
    };

    render(<DecisionPromptModal prompt={prompt} onSelectOption={onSelectOption} />);

    // 1. Verify Provenance Banner thumbnail for triggerSourceCode (False Alarm)
    const thumbnails = screen.getAllByAltText('False Alarm');
    expect(thumbnails.length).toBeGreaterThan(0);

    // 2. Verify Provenance Banner labels
    expect(screen.getByText(/TRIGGER: False Alarm/i)).toBeDefined();
    expect(screen.getByText(/ABILITY: Enhanced Spider-Sense/i)).toBeDefined();

    // 3. Verify Triggering Card Showcase in modal body
    expect(screen.getByText(/TRIGGERING ENCOUNTER CARD/i)).toBeDefined();
    expect(screen.getAllByText(/TREACHERY/i).length).toBeGreaterThanOrEqual(1);

    // Verify printed card text is displayed in the showcase
    expect(screen.getByText(/confused/i)).toBeDefined();

    // 4. Verify option interaction
    const yesButton = screen.getByRole('button', { name: /yes/i });
    fireEvent.click(yesButton);

    expect(onSelectOption).toHaveBeenCalledWith('yes');
  });

  it('renders cost badge on options that require resource payment', () => {
    const prompt: PendingDecisionPrompt = {
      promptId: 'prompt_test_cost',
      playerId: 'p1',
      sourceCardName: 'Enhanced Spider-Sense',
      title: 'Do you want to use the following ability from Enhanced Spider-Sense?',
      description: "Cancel the 'When Revealed' effects of that treachery.",
      options: [
        {
          id: 'trigger_enhanced_spider_sense',
          label: 'Yes',
          effect: 'EXECUTE_OPTIONAL_TRIGGER',
          params: {
            requiresPayment: true,
            resourceCost: { amount: 1 },
          },
        },
        { id: 'pass', label: 'No', effect: 'PASS' },
      ],
      isVoluntary: true,
    };

    render(<DecisionPromptModal prompt={prompt} onSelectOption={vi.fn()} />);

    expect(screen.getByText(/⚡ COST: 1 RESOURCE/i)).toBeDefined();
  });
});
