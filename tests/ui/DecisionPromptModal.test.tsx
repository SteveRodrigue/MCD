import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
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

  it('renders CardArtThumbnail inside options when cardCode is present', async () => {
    const prompt: PendingDecisionPrompt = {
      promptId: 'prompt_test_options_art',
      playerId: 'p1',
      sourceCardName: 'Spider-Tracer',
      sourceCardCode: '01007',
      title: 'Spider-Tracer: Choose a Scheme',
      description: 'Spider-Tracer: Select a scheme to remove 3 threat from:',
      options: [
        {
          id: 'main_scheme',
          label: 'The Break-In (4 Threat)',
          cardCode: '01097b',
          effect: 'REMOVE_THREAT',
        },
        {
          id: 'side_scheme_1',
          label: 'Crowd Control (2 Threat)',
          cardCode: '01108',
          effect: 'REMOVE_THREAT',
        },
      ],
    };

    await act(async () => {
      render(<DecisionPromptModal prompt={prompt} onSelectOption={vi.fn()} />);
    });

    expect(screen.getByAltText('The Break-In (4 Threat)')).toBeDefined();
    expect(screen.getByAltText('Crowd Control (2 Threat)')).toBeDefined();
  });

  it('renders incoming damage badge callout when incomingDamage is present (Issue #130)', () => {
    const prompt: PendingDecisionPrompt = {
      promptId: 'prompt_test_damage',
      playerId: 'p1',
      title: 'Do you want to use the following ability from Backflip? (Incoming Damage: 4)',
      description: 'Prevent all damage from this attack. [Incoming Damage: 4]',
      incomingDamage: 4,
      sourceCardName: 'Backflip',
      sourceCardCode: '01003',
      triggerType: 'DAMAGE_WOULD_BE_TAKEN',
      options: [
        { id: 'trigger_backflip', label: 'Yes', effect: 'EXECUTE_OPTIONAL_TRIGGER' },
        { id: 'pass', label: 'No', effect: 'PASS' },
      ],
      isVoluntary: true,
    };

    render(<DecisionPromptModal prompt={prompt} onSelectOption={vi.fn()} />);

    expect(screen.getByText(/INCOMING ATTACK DAMAGE:/i)).toBeDefined();
    expect(screen.getByText(/4 DMG/i)).toBeDefined();
  });

  it('renders combat matchup panel with attacker, target, HP counter, and damage prevented badge (Issue #152)', async () => {
    const prompt: PendingDecisionPrompt = {
      promptId: 'prompt_test_matchup',
      playerId: 'p1',
      title: 'Do you want to use the following ability from Cosmic Flight? (Incoming Damage: 4)',
      description:
        'When Captain Marvel would take damage, discard Cosmic Flight -> prevent 3 of that damage.',
      incomingDamage: 4,
      preventAmount: 3,
      attackerName: 'Rhino',
      attackerCardCode: '01094',
      targetName: 'Captain Marvel',
      targetCardCode: '01010a',
      targetCurrentHp: 12,
      targetMaxHp: 12,
      defenderType: 'UNDEFENDED',
      sourceCardName: 'Cosmic Flight',
      sourceCardCode: '01017',
      triggerType: 'HERO_INTERRUPT',
      options: [
        { id: 'trigger_cosmic_flight', label: 'Yes', effect: 'EXECUTE_OPTIONAL_TRIGGER' },
        { id: 'pass', label: 'No', effect: 'PASS' },
      ],
      isVoluntary: true,
    };

    await act(async () => {
      render(<DecisionPromptModal prompt={prompt} onSelectOption={vi.fn()} />);
    });

    // Verify attacker name and label
    expect(screen.getByText('Rhino')).toBeDefined();
    expect(screen.getByText('ATTACKER')).toBeDefined();

    // Verify target / defender name & HP
    expect(screen.getByText('Captain Marvel')).toBeDefined();
    expect(screen.getByText('TARGET')).toBeDefined();
    expect(screen.getByText('12 / 12 HP')).toBeDefined();

    // Verify damage prevented badge
    expect(screen.getByText('Prevents: 3 DMG')).toBeDefined();
  });
});
