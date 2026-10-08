import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StepPipelineEditor } from '../../src/ui/components/editor/StepPipelineEditor';
import { generateStepSummary } from '../../src/ui/components/editor/step-pipeline-utils';

const StatefulStepPipelineEditor: React.FC<{
  initial: any[];
  abilityIndex?: number;
  onChange?: (val: any[]) => void;
}> = ({ initial, abilityIndex = 0, onChange }) => {
  const [steps, setSteps] = React.useState(initial);
  return (
    <StepPipelineEditor
      steps={steps}
      abilityIndex={abilityIndex}
      onChange={(updated) => {
        setSteps(updated);
        onChange?.(updated);
      }}
    />
  );
};

describe('Compact Step Pipeline Summaries (Task 4.3)', () => {
  describe('generateStepSummary helper', () => {
    it('generates accurate labels matching all specification patterns', () => {
      // 1. Basic damage with target and amount
      expect(
        generateStepSummary(
          { effect: 'DEAL_DAMAGE', target: 'CHOSEN_ENEMY', effectParams: { amount: 3 } },
          0,
        ),
      ).toBe('#1 DEAL_DAMAGE → CHOSEN_ENEMY (3)');

      // 2. Gate prefix with count
      expect(
        generateStepSummary({ effect: 'DRAW', gate: 'THEN', effectParams: { count: 1 } }, 1),
      ).toBe('[THEN] #2 DRAW (1)');

      // 3. Conditional gate with status
      expect(
        generateStepSummary(
          {
            effect: 'ADD_STATUS',
            target: 'VILLAIN',
            gate: 'IF_PREVIOUS_SUCCESS',
            effectParams: { status: 'STUNNED' },
          },
          2,
        ),
      ).toBe('[IF_PREVIOUS_SUCCESS] #3 ADD_STATUS → VILLAIN (STUNNED)');

      // 4. Effect with target only
      expect(generateStepSummary({ effect: 'SEARCH', target: 'SELF' }, 0)).toBe('#1 SEARCH → SELF');

      // 5. Stat modification with positive/negative amounts
      expect(
        generateStepSummary({ effect: 'MODIFY_STAT', effectParams: { stat: 'ATK', amount: 2 } }, 0),
      ).toBe('#1 MODIFY_STAT (ATK +2)');

      expect(
        generateStepSummary(
          { effect: 'MODIFY_STAT', effectParams: { stat: 'DEF', amount: -1 } },
          0,
        ),
      ).toBe('#1 MODIFY_STAT (DEF -1)');

      // 6. ALWAYS gate is omitted from prefix
      expect(
        generateStepSummary({ effect: 'DRAW', gate: 'ALWAYS', effectParams: { count: 2 } }, 0),
      ).toBe('#1 DRAW (2)');

      // 7. IF_FORM gate formats with target form
      expect(
        generateStepSummary(
          { effect: 'VILLAIN_ATTACKS', gate: 'IF_FORM', gateParams: { form: 'HERO' } },
          0,
        ),
      ).toBe('[IF_FORM: HERO] #1 VILLAIN_ATTACKS');

      expect(
        generateStepSummary(
          { effect: 'SURGE', gate: 'IF_FORM', gateParams: { form: 'ALTER_EGO' } },
          1,
        ),
      ).toBe('[IF_FORM: ALTER_EGO] #2 SURGE');

      // Defaults to HERO if gateParams.form is omitted
      expect(generateStepSummary({ effect: 'VILLAIN_ATTACKS', gate: 'IF_FORM' }, 0)).toBe(
        '[IF_FORM: HERO] #1 VILLAIN_ATTACKS',
      );

      // 8. IF_PLAYER_HAS_TRAIT with negation
      expect(
        generateStepSummary(
          {
            effect: 'REMOVE_THREAT',
            gate: 'IF_PLAYER_HAS_TRAIT',
            gateParams: { trait: 'Aerial', negate: true },
            effectParams: { amount: 2 },
          },
          0,
        ),
      ).toBe('[IF NOT: IF_PLAYER_HAS_TRAIT (Aerial)] #1 REMOVE_THREAT (2)');

      // 9. IF_RESULT with fact
      expect(
        generateStepSummary(
          {
            effect: 'SURGE',
            gate: 'IF_RESULT',
            gateParams: { result: 'AMOUNT_ZERO' },
          },
          1,
        ),
      ).toBe('[IF_RESULT: AMOUNT_ZERO] #2 SURGE');
    });
  });

  describe('StepPipelineEditor Summary Rows & Expansion', () => {
    it('renders initial step expanded and subsequent steps as compact summary rows', () => {
      render(
        <StepPipelineEditor
          steps={[
            { effect: 'DEAL_DAMAGE', target: 'CHOSEN_ENEMY', effectParams: { amount: 3 } },
            { effect: 'DRAW', effectParams: { count: 2 } },
          ]}
          abilityIndex={0}
          onChange={vi.fn()}
        />,
      );

      // Verify both step items exist
      expect(screen.getByTestId('step-item-0-0')).toBeDefined();
      expect(screen.getByTestId('step-item-0-1')).toBeDefined();

      // Step 0 summary label
      expect(screen.getByTestId('step-summary-0-0').textContent).toBe(
        '#1 DEAL_DAMAGE → CHOSEN_ENEMY (3)',
      );
      // Step 1 summary label
      expect(screen.getByTestId('step-summary-0-1').textContent).toBe('#2 DRAW (2)');

      // Step 0 is expanded: inputs are visible
      expect(screen.getByTestId('step-id-0-0')).toBeDefined();
      expect(screen.getByTestId('step-target-0-0')).toBeDefined();

      // Step 1 is collapsed: inputs are not in DOM
      expect(screen.queryByTestId('step-id-0-1')).toBeNull();
      expect(screen.queryByTestId('step-target-0-1')).toBeNull();
    });

    it('clicking a collapsed step expands it and collapses the previously active step', async () => {
      const user = userEvent.setup();
      render(
        <StepPipelineEditor
          steps={[
            { effect: 'DEAL_DAMAGE', effectParams: { amount: 3 } },
            { effect: 'DRAW', effectParams: { count: 2 } },
          ]}
          abilityIndex={0}
          onChange={vi.fn()}
        />,
      );

      // Initially Step 0 expanded, Step 1 collapsed
      expect(screen.getByTestId('step-id-0-0')).toBeDefined();
      expect(screen.queryByTestId('step-id-0-1')).toBeNull();

      // Click Step 1 summary row to expand it
      await user.click(screen.getByTestId('step-item-0-1'));

      // Now Step 1 is expanded, Step 0 is collapsed
      expect(screen.getByTestId('step-id-0-1')).toBeDefined();
      expect(screen.queryByTestId('step-id-0-0')).toBeNull();

      // Click Step 0 to toggle back
      await user.click(screen.getByTestId('step-item-0-0'));
      expect(screen.getByTestId('step-id-0-0')).toBeDefined();
      expect(screen.queryByTestId('step-id-0-1')).toBeNull();
    });

    it('supports reordering and deletion directly from compact summary rows', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      render(
        <StatefulStepPipelineEditor
          initial={[
            { effect: 'DEAL_DAMAGE', effectParams: { amount: 3 } },
            { effect: 'DRAW', effectParams: { count: 2 } },
            { effect: 'HEAL', effectParams: { amount: 1 } },
          ]}
          abilityIndex={0}
          onChange={handleChange}
        />,
      );

      // Step 1 is collapsed. Click move-down on Step 1:
      // Note: clicking move-down should trigger reorder
      await user.click(screen.getByTestId('step-move-down-0-1'));

      expect(handleChange).toHaveBeenCalledWith([
        expect.objectContaining({ effect: 'DEAL_DAMAGE' }),
        expect.objectContaining({ effect: 'HEAL' }),
        expect.objectContaining({ effect: 'DRAW' }),
      ]);

      // Remove step 2 directly from summary row
      await user.click(screen.getByTestId('step-remove-0-2'));
      expect(handleChange).toHaveBeenCalledWith([
        expect.objectContaining({ effect: 'DEAL_DAMAGE' }),
        expect.objectContaining({ effect: 'HEAL' }),
      ]);
    });

    it('auto-expands newly added steps', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      render(
        <StatefulStepPipelineEditor
          initial={[{ effect: 'DEAL_DAMAGE', effectParams: { amount: 3 } }]}
          abilityIndex={0}
          onChange={handleChange}
        />,
      );

      // Initially only 1 step, expanded
      expect(screen.getByTestId('step-id-0-0')).toBeDefined();

      // Click Add Step
      await user.click(screen.getByTestId('add-step-btn-0'));

      // New step is Step #2 (index 1), should be auto-expanded
      expect(screen.getByTestId('step-id-0-1')).toBeDefined();
      // Previously expanded Step 0 is now collapsed
      expect(screen.queryByTestId('step-id-0-0')).toBeNull();
    });

    it('auto-expands a step that has validation errors even if not active', () => {
      render(
        <StepPipelineEditor
          steps={[{ effect: 'DEAL_DAMAGE' }, { effect: 'INVALID_EFFECT' }]}
          abilityIndex={0}
          onChange={vi.fn()}
          stepErrors={{
            1: ['Invalid effect type'],
          }}
        />,
      );

      // Step 1 has error, so it forces expanded and shows error
      expect(screen.getByText('• Invalid effect type')).toBeDefined();
      expect(screen.getByTestId('step-id-0-1')).toBeDefined();
    });
  });
});
