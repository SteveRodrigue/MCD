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

    // 1. The provenance banner is gone: the two panels carry the information
    expect(screen.queryByText(/TRIGGER: False Alarm/i)).toBeNull();
    expect(screen.queryByText(/ABILITY: Enhanced Spider-Sense/i)).toBeNull();

    // 2. Both panels are shown
    expect(screen.getByText('ABILITY CARD')).toBeDefined();
    expect(screen.getByText('Enhanced Spider-Sense', { selector: 'h4' })).toBeDefined();

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

  it('shows the ability card panel with the host card name, traits and printed text unchanged', () => {
    const blackWidow = cardCatalog.getCard('01075')!;
    const prompt: PendingDecisionPrompt = {
      promptId: 'prompt_test_ability_panel',
      playerId: 'p1',
      title: 'Do you want to use the following ability from Black Widow?',
      description: 'Cancel the revealed card.',
      sourceCardName: 'Black Widow',
      sourceCardCode: '01075',
      options: [
        { id: 'yes', label: 'Yes', effect: 'EXECUTE_OPTIONAL_TRIGGER' },
        { id: 'pass', label: 'No', effect: 'PASS' },
      ],
      isVoluntary: true,
    };

    render(<DecisionPromptModal prompt={prompt} onSelectOption={vi.fn()} />);

    expect(screen.getByText('ABILITY CARD')).toBeDefined();
    expect(screen.getByText('Black Widow', { selector: 'h4' })).toBeDefined();
    expect(screen.getByText(`${blackWidow.traits!.join('. ')}.`)).toBeDefined();
    // The printed text is shown whole: no height cap on the text box
    const textBox = screen.getByText(/reveal another card/i).closest('div.bg-white\\/90');
    expect(textBox).not.toBeNull();
    expect(textBox!.className).not.toContain('max-h');
    expect(blackWidow.text).toContain('reveal another card');
  });

  it('a reveal interrupt shows the revealed card and the ability card', () => {
    const hydra = cardCatalog.getCard('01101')!;
    const prompt: PendingDecisionPrompt = {
      promptId: 'prompt_test_reveal_interrupt',
      playerId: 'p1',
      title: 'Do you want to use the following ability from Black Widow?',
      description: 'Cancel the revealed card.',
      sourceCardName: 'Black Widow',
      sourceCardCode: '01075',
      triggerSourceName: hydra.name,
      triggerSourceCode: hydra.code,
      triggerSourceCard: hydra,
      triggerType: 'ENCOUNTER_CARD_REVEALED',
      options: [
        { id: 'yes', label: 'Yes', effect: 'EXECUTE_OPTIONAL_TRIGGER' },
        { id: 'pass', label: 'No', effect: 'PASS' },
      ],
      isVoluntary: true,
    };

    render(<DecisionPromptModal prompt={prompt} onSelectOption={vi.fn()} />);

    expect(screen.getByText('TRIGGERING ENCOUNTER CARD')).toBeDefined();
    expect(screen.getByText('Hydra Mercenary', { selector: 'h4' })).toBeDefined();
    expect(screen.getByText('ABILITY CARD')).toBeDefined();
    expect(screen.getByText('Black Widow', { selector: 'h4' })).toBeDefined();
  });

  it('renders no ability panel when the prompt has no ability host card', () => {
    const prompt: PendingDecisionPrompt = {
      promptId: 'prompt_test_no_host',
      playerId: 'p1',
      title: 'Pick one',
      description: '',
      sourceCardName: 'Unknown Source',
      options: [{ id: 'pass', label: 'No', effect: 'PASS' }],
      isVoluntary: true,
    };

    render(<DecisionPromptModal prompt={prompt} onSelectOption={vi.fn()} />);

    expect(screen.queryByText('ABILITY CARD')).toBeNull();
    expect(screen.queryByText('TRIGGERING CARD')).toBeNull();
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

  it('voluntary discard options display card thumbnail, name, cost, and formatted printed text without raw markup', async () => {
    const webShooter = cardCatalog.getCard('01005')!;
    const prompt: PendingDecisionPrompt = {
      promptId: 'prompt_cleanup_discard',
      playerId: 'p1',
      title: 'End of Player Phase: Voluntary Discard',
      description:
        'Spider-Man: Select any cards in your hand you wish to discard before drawing up to hand size:',
      sourceCardName: 'Spider-Man',
      isVoluntary: true,
      options: [
        {
          id: 'discard_inst_1',
          label: `Discard ${webShooter.name}`,
          cardCode: webShooter.code,
          cardName: webShooter.name,
          description:
            'Uses (3 web counters). <b>Hero Resource</b>: Exhaust Web-Shooter -> generate a [wild] resource.',
          effect: 'PLAYER_PHASE_DISCARD_CARD',
          params: { cardInstanceId: 'inst_1', playerId: 'p1' },
        },
        {
          id: 'done_cleanup',
          label: 'Done / Keep Remaining Cards',
          description: 'Proceed to refill hand and ready all cards',
          effect: 'FINISH_PLAYER_CLEANUP',
          params: { playerId: 'p1' },
        },
      ],
    };

    await act(async () => {
      render(<DecisionPromptModal prompt={prompt} onSelectOption={vi.fn()} />);
    });

    // Thumbnail is rendered
    expect(screen.getByAltText(`Discard ${webShooter.name}`)).toBeDefined();

    // Name and Cost badge
    expect(screen.getByText(`Discard ${webShooter.name}`)).toBeDefined();
    expect(screen.getByText(`Cost: ${webShooter.cost}`)).toBeDefined();

    // Formatted printed text without raw <b>, <i>, or [wild]
    expect(screen.getByText(/Hero Resource/i)).toBeDefined();
    expect(screen.getByText(/Wild/i)).toBeDefined();
    expect(screen.queryByText(/<b>/i)).toBeNull();
    expect(screen.queryByText(/\[wild\]/i)).toBeNull();

    // Hover zoom preview
    const thumbWrapper = screen.getByTestId('option-card-thumbnail-discard_inst_1');
    await act(async () => {
      fireEvent.mouseEnter(thumbWrapper);
    });
    expect(screen.getByTestId(`card-hover-preview-${webShooter.code}`)).toBeDefined();
  });

  it("setup choice options (e.g. T'Challa Foresight upgrade search) display card thumbnail, name, and formatted printed text without raw markup", async () => {
    const energyDaggers = cardCatalog.getCard('01047')!;
    const prompt: PendingDecisionPrompt = {
      promptId: 'prompt_search_foresight',
      playerId: 'p1',
      title: 'Foresight: Choose 1 Black Panther upgrade',
      description: 'Select 1 card(s):',
      sourceCardName: "T'Challa",
      sourceCardCode: '01040b',
      options: [
        {
          id: 'inst_upgrade_1',
          label: `${energyDaggers.name} (${energyDaggers.type}, Cost: ${energyDaggers.cost})`,
          description:
            'Black Panther. <i>Upgrade</i>. <b>Hero Action</b>: Spend a [mental] resource -> deal 2 damage.',
          effect: 'SEARCH_AND_SELECT_RESOLUTION',
          params: {
            chosenInstanceId: 'inst_upgrade_1',
            cardName: energyDaggers.name,
            cardCode: energyDaggers.code,
          },
        },
      ],
    };

    await act(async () => {
      render(<DecisionPromptModal prompt={prompt} onSelectOption={vi.fn()} />);
    });

    // Thumbnail is rendered
    expect(
      screen.getByAltText(
        `${energyDaggers.name} (${energyDaggers.type}, Cost: ${energyDaggers.cost})`,
      ),
    ).toBeDefined();

    // Name and Cost
    expect(screen.getByText(new RegExp(energyDaggers.name, 'i'))).toBeDefined();
    expect(screen.getByText(new RegExp(`Cost: ${energyDaggers.cost}`, 'i'))).toBeDefined();

    // Formatted printed text without raw <b>, <i>, or [mental]
    expect(screen.getByText(/Hero Action/i)).toBeDefined();
    expect(screen.getByText(/Mental/i)).toBeDefined();
    expect(screen.queryByText(/<b>/i)).toBeNull();
    expect(screen.queryByText(/<i>/i)).toBeNull();
    expect(screen.queryByText(/\[mental\]/i)).toBeNull();

    // Hover zoom preview
    const thumbWrapper = screen.getByTestId('option-card-thumbnail-inst_upgrade_1');
    await act(async () => {
      fireEvent.mouseEnter(thumbWrapper);
    });
    expect(screen.getByTestId(`card-hover-preview-${energyDaggers.code}`)).toBeDefined();
  });
});
