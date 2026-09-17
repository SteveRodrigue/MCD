import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DistributeAmountModal } from '../../src/ui/components/board/DistributeAmountModal';
import { PendingDecisionPrompt } from '../../src/engine/models';

describe('DistributeAmountModal Unit & Contract Tests (ADR-0064)', () => {
  it('Test 1: Renders budget banner, target tiles, and stepper controls', () => {
    const onConfirm = vi.fn();
    const prompt: PendingDecisionPrompt = {
      promptId: 'prompt_dist_1',
      playerId: 'p1',
      title: 'Explosion: Assign Damage',
      description: 'Assign 3 damage among heroes and allies:',
      sourceCardName: 'Explosion',
      kind: 'DISTRIBUTE_POINTS',
      distributionConfig: {
        totalBudget: 3,
        effectiveBudget: 3,
        budgetLabel: 'DAMAGE',
        unitSingular: 'DMG',
        unitPlural: 'DMG',
        exactMatchRequired: true,
        canCancel: false,
        allocationDomain: 'DAMAGE',
        targets: [
          {
            instanceId: 'p1',
            name: 'Spider-Man',
            cardType: 'hero',
            controllerPlayerId: 'p1',
            controllerName: 'Spider-Man',
            currentValue: 10,
            maxValue: 10,
            allocationCap: 10,
            isEligible: true,
          },
          {
            instanceId: 'ally-1',
            name: 'Black Cat',
            cardType: 'ally',
            controllerPlayerId: 'p1',
            controllerName: 'Spider-Man',
            currentValue: 2,
            maxValue: 2,
            allocationCap: 2,
            isEligible: true,
          },
        ],
      },
      options: [],
    };

    render(<DistributeAmountModal prompt={prompt} onConfirm={onConfirm} />);

    expect(screen.getByText(/POINTS TO ASSIGN:/i)).toBeDefined();
    expect(screen.getByText(/0 \/ 3/)).toBeDefined();
    expect(screen.getAllByText('Spider-Man').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Black Cat')).toBeDefined();
    expect(screen.getAllByRole('button', { name: /Increase/i }).length).toBe(2);
    expect(screen.getAllByRole('button', { name: /Decrease/i }).length).toBe(2);
    expect(screen.getAllByRole('button', { name: /Max/i }).length).toBe(2);
    expect(screen.getByRole('button', { name: /RESET ALL/i })).toBeDefined();
  });

  it('Test 2: Inactive Alter-Ego identity shows "Alter-Ego (Immune)" and steppers are disabled', () => {
    const onConfirm = vi.fn();
    const prompt: PendingDecisionPrompt = {
      promptId: 'prompt_dist_2',
      playerId: 'p1',
      title: 'Explosion: Assign Damage',
      description: 'Assign 2 damage among heroes and allies:',
      sourceCardName: 'Explosion',
      kind: 'DISTRIBUTE_POINTS',
      distributionConfig: {
        totalBudget: 2,
        effectiveBudget: 2,
        budgetLabel: 'DAMAGE',
        unitSingular: 'DMG',
        unitPlural: 'DMG',
        exactMatchRequired: true,
        canCancel: false,
        allocationDomain: 'DAMAGE',
        targets: [
          {
            instanceId: 'p1',
            name: 'Peter Parker',
            cardType: 'alter_ego',
            controllerPlayerId: 'p1',
            controllerName: 'Player 1',
            currentValue: 10,
            maxValue: 10,
            allocationCap: 0,
            isEligible: false,
            ineligibilityReason: 'Alter-Ego (Immune)',
          },
          {
            instanceId: 'p2',
            name: 'Captain Marvel',
            cardType: 'hero',
            controllerPlayerId: 'p2',
            controllerName: 'Player 2',
            currentValue: 12,
            maxValue: 12,
            allocationCap: 12,
            isEligible: true,
          },
        ],
      },
      options: [],
    };

    render(<DistributeAmountModal prompt={prompt} onConfirm={onConfirm} />);

    expect(screen.getByText(/Alter-Ego \(Immune\)/i)).toBeDefined();
    // Only Captain Marvel should have active stepper controls
    expect(screen.getAllByRole('button', { name: /Increase/i }).length).toBe(1);
    expect(screen.getAllByRole('button', { name: /Decrease/i }).length).toBe(1);
  });

  it('Test 3: In Healing mode, character at full health shows "At full health" and steppers are disabled', () => {
    const onConfirm = vi.fn();
    const prompt: PendingDecisionPrompt = {
      promptId: 'prompt_dist_3',
      playerId: 'p1',
      title: 'Med Team: Heal Characters',
      description: 'Distribute 2 healing among characters:',
      sourceCardName: 'Med Team',
      kind: 'DISTRIBUTE_POINTS',
      distributionConfig: {
        totalBudget: 2,
        effectiveBudget: 2,
        budgetLabel: 'HEALING',
        unitSingular: 'HEAL',
        unitPlural: 'HEAL',
        exactMatchRequired: true,
        canCancel: false,
        allocationDomain: 'HEAL',
        targets: [
          {
            instanceId: 'p1',
            name: 'Spider-Man',
            cardType: 'hero',
            controllerPlayerId: 'p1',
            currentValue: 10,
            maxValue: 10,
            allocationCap: 0,
            isEligible: false,
            ineligibilityReason: 'At full health',
          },
          {
            instanceId: 'ally-1',
            name: 'Daredevil',
            cardType: 'ally',
            controllerPlayerId: 'p1',
            currentValue: 1,
            maxValue: 3,
            allocationCap: 2,
            isEligible: true,
          },
        ],
      },
      options: [],
    };

    render(<DistributeAmountModal prompt={prompt} onConfirm={onConfirm} />);

    expect(screen.getByText(/At full health/i)).toBeDefined();
    // Daredevil has steppers, Spider-Man does not
    expect(screen.getAllByRole('button', { name: /Increase/i }).length).toBe(1);
  });

  it('Test 4: In Threat Removal mode, scheme at 0 threat shows "No threat on scheme"', () => {
    const onConfirm = vi.fn();
    const prompt: PendingDecisionPrompt = {
      promptId: 'prompt_dist_4',
      playerId: 'p1',
      title: 'Remove Threat Across Schemes',
      description: 'Distribute threat removal:',
      sourceCardName: 'For Justice!',
      kind: 'DISTRIBUTE_POINTS',
      distributionConfig: {
        totalBudget: 3,
        effectiveBudget: 3,
        budgetLabel: 'THREAT REMOVAL',
        unitSingular: 'THW',
        unitPlural: 'THW',
        exactMatchRequired: true,
        canCancel: false,
        allocationDomain: 'THREAT_REMOVAL',
        targets: [
          {
            instanceId: 'main_scheme',
            name: 'The Break-In',
            cardType: 'main_scheme',
            currentValue: 5,
            allocationCap: 5,
            isEligible: true,
          },
          {
            instanceId: 'side_scheme_1',
            name: 'Crowd Control',
            cardType: 'side_scheme',
            currentValue: 0,
            allocationCap: 0,
            isEligible: false,
            ineligibilityReason: 'No threat on scheme',
          },
        ],
      },
      options: [],
    };

    render(<DistributeAmountModal prompt={prompt} onConfirm={onConfirm} />);

    expect(screen.getByText(/No threat on scheme/i)).toBeDefined();
    expect(screen.getAllByRole('button', { name: /Increase/i }).length).toBe(1);
  });

  it('Test 5: Shortfall scenario (budget 4, total scheme threat 2), modal requires only 2 points and enables Confirm button at 2/2', () => {
    const onConfirm = vi.fn();
    const prompt: PendingDecisionPrompt = {
      promptId: 'prompt_dist_5',
      playerId: 'p1',
      title: 'Remove Threat',
      description: 'Remove threat:',
      sourceCardName: 'Wasp',
      kind: 'DISTRIBUTE_POINTS',
      distributionConfig: {
        totalBudget: 4,
        effectiveBudget: 2,
        shortfallNotice: 'Only 2 available capacity across targets (reduced from 4).',
        budgetLabel: 'THREAT',
        unitSingular: 'THW',
        unitPlural: 'THW',
        exactMatchRequired: true,
        canCancel: false,
        allocationDomain: 'THREAT_REMOVAL',
        targets: [
          {
            instanceId: 'main_scheme',
            name: 'The Break-In',
            cardType: 'main_scheme',
            currentValue: 2,
            allocationCap: 2,
            isEligible: true,
          },
        ],
      },
      options: [],
    };

    render(<DistributeAmountModal prompt={prompt} onConfirm={onConfirm} />);

    expect(
      screen.getByText(/Only 2 available capacity across targets \(reduced from 4\)\./i),
    ).toBeDefined();
    expect(screen.getByText(/0 \/ 2/)).toBeDefined();

    const confirmBtn = screen.getByRole('button', { name: /CONFIRM ASSIGNMENT/i });
    expect(confirmBtn.hasAttribute('disabled')).toBe(true);

    const increaseBtn = screen.getByRole('button', { name: /Increase/i });
    fireEvent.click(increaseBtn); // 1
    expect(confirmBtn.hasAttribute('disabled')).toBe(true);

    fireEvent.click(increaseBtn); // 2
    expect(screen.getByText(/2 \/ 2/)).toBeDefined();
    expect(confirmBtn.hasAttribute('disabled')).toBe(false);

    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledWith({ main_scheme: 2 });
  });

  it('Test 6: Reallocation: incrementing, decrementing, and clicking [RESET ALL] resets pool', () => {
    const onConfirm = vi.fn();
    const prompt: PendingDecisionPrompt = {
      promptId: 'prompt_dist_6',
      playerId: 'p1',
      title: 'Explosion: Assign Damage',
      description: 'Assign damage:',
      sourceCardName: 'Explosion',
      kind: 'DISTRIBUTE_POINTS',
      distributionConfig: {
        totalBudget: 3,
        effectiveBudget: 3,
        budgetLabel: 'DAMAGE',
        unitSingular: 'DMG',
        unitPlural: 'DMG',
        exactMatchRequired: true,
        canCancel: false,
        allocationDomain: 'DAMAGE',
        targets: [
          {
            instanceId: 'p1',
            name: 'Spider-Man',
            cardType: 'hero',
            currentValue: 10,
            maxValue: 10,
            allocationCap: 10,
            isEligible: true,
          },
          {
            instanceId: 'ally-1',
            name: 'Black Cat',
            cardType: 'ally',
            currentValue: 2,
            maxValue: 2,
            allocationCap: 2,
            isEligible: true,
          },
        ],
      },
      options: [],
    };

    render(<DistributeAmountModal prompt={prompt} onConfirm={onConfirm} />);

    const [increaseSpider, increaseCat] = screen.getAllByRole('button', { name: /Increase/i });
    const [decreaseSpider] = screen.getAllByRole('button', { name: /Decrease/i });
    const resetBtn = screen.getByRole('button', { name: /RESET ALL/i });

    // Increment Spider-Man twice
    fireEvent.click(increaseSpider);
    fireEvent.click(increaseSpider);
    expect(screen.getByText(/2 \/ 3/)).toBeDefined();

    // Decrement Spider-Man once
    fireEvent.click(decreaseSpider);
    expect(screen.getByText(/1 \/ 3/)).toBeDefined();

    // Increment Black Cat once
    fireEvent.click(increaseCat);
    expect(screen.getByText(/2 \/ 3/)).toBeDefined();

    // Click RESET ALL
    fireEvent.click(resetBtn);
    expect(screen.getByText(/0 \/ 3/)).toBeDefined();
    expect(screen.getByText(/3 REMAINING/i)).toBeDefined();
  });

  it('Test 7: Confirm button remains disabled until required points are allocated', () => {
    const onConfirm = vi.fn();
    const prompt: PendingDecisionPrompt = {
      promptId: 'prompt_dist_7',
      playerId: 'p1',
      title: 'Explosion: Assign Damage',
      description: 'Assign damage:',
      sourceCardName: 'Explosion',
      kind: 'DISTRIBUTE_POINTS',
      distributionConfig: {
        totalBudget: 2,
        effectiveBudget: 2,
        budgetLabel: 'DAMAGE',
        unitSingular: 'DMG',
        unitPlural: 'DMG',
        exactMatchRequired: true,
        canCancel: false,
        allocationDomain: 'DAMAGE',
        targets: [
          {
            instanceId: 'p1',
            name: 'Spider-Man',
            cardType: 'hero',
            currentValue: 10,
            maxValue: 10,
            allocationCap: 10,
            isEligible: true,
          },
        ],
      },
      options: [],
    };

    render(<DistributeAmountModal prompt={prompt} onConfirm={onConfirm} />);

    const confirmBtn = screen.getByRole('button', { name: /CONFIRM ASSIGNMENT/i });
    expect(confirmBtn.hasAttribute('disabled')).toBe(true);

    const maxBtn = screen.getByRole('button', { name: /Max/i });
    fireEvent.click(maxBtn); // Allocates all 2 points to Spider-Man

    expect(screen.getByText(/2 \/ 2/)).toBeDefined();
    expect(confirmBtn.hasAttribute('disabled')).toBe(false);

    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledWith({ p1: 2 });
  });
});
