import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AbilityFormBuilder } from '../../src/ui/components/editor/AbilityFormBuilder';
import { CardEnrichmentSchema, CardAbilitySchema } from '../../src/data/supplemental/schema';

// Helper component that holds state for multi-step interactions
const StatefulAbilityFormBuilder: React.FC<{
  initial: any;
  onChange?: (val: any) => void;
}> = ({ initial, onChange }) => {
  const [data, setData] = React.useState(initial);
  return (
    <AbilityFormBuilder
      supplemental={data}
      onChange={(updated) => {
        setData(updated);
        onChange?.(updated);
      }}
    />
  );
};

describe('AbilityFormBuilder Card-Level Attributes', () => {
  it('renders top-level card metadata fields', () => {
    render(<AbilityFormBuilder supplemental={{ comment: 'Test card' }} onChange={vi.fn()} />);

    expect(screen.getByText(/CARD-LEVEL ATTRIBUTES & AUDIT/i)).toBeDefined();
    expect(screen.getByTestId('card-traits-input')).toBeDefined();
    expect(screen.getByTestId('card-restricted-slots-input')).toBeDefined();
    expect(screen.getByTestId('card-additional-boost-cards-input')).toBeDefined();
    expect(screen.getByTestId('card-victory-points-input')).toBeDefined();
    expect(screen.getByTestId('card-is-landscape-checkbox')).toBeDefined();
    expect(screen.getByTestId('toggle-uses-btn')).toBeDefined();
  });

  it('updates card traits, restricted slots, and victory points', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <StatefulAbilityFormBuilder initial={{ traits: ['Avenger'] }} onChange={handleChange} />,
    );

    const traitsInput = screen.getByTestId('card-traits-input') as HTMLInputElement;
    fireEvent.change(traitsInput, { target: { value: 'Avenger, Aerial, Soldier' } });
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        traits: ['Avenger', 'Aerial', 'Soldier'],
      }),
    );

    const slotsInput = screen.getByTestId('card-restricted-slots-input');
    fireEvent.change(slotsInput, { target: { value: '1' } });
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        restrictedSlots: 1,
      }),
    );

    const vpInput = screen.getByTestId('card-victory-points-input');
    fireEvent.change(vpInput, { target: { value: '2' } });
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        victoryPoints: 2,
      }),
    );

    const landscapeCheckbox = screen.getByTestId('card-is-landscape-checkbox');
    await user.click(landscapeCheckbox);
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        isLandscape: true,
      }),
    );
  });

  it('manages uses counters lifecycle sub-form (add, modify, remove)', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <StatefulAbilityFormBuilder initial={{ comment: 'Uses card' }} onChange={handleChange} />,
    );

    // Click Configure Uses
    const toggleBtn = screen.getByTestId('toggle-uses-btn');
    await user.click(toggleBtn);

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        uses: { count: 3, type: 'charge', discardOnEmpty: true },
      }),
    );

    // Modify count
    const countInput = screen.getByTestId('uses-count-input');
    fireEvent.change(countInput, { target: { value: '4' } });

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        uses: expect.objectContaining({ count: 4 }),
      }),
    );

    // Remove uses
    await user.click(screen.getByTestId('toggle-uses-btn'));
    expect(handleChange).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ uses: expect.anything() }),
    );
  });

  it('toggles keywords and configures Retaliate amount', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(<StatefulAbilityFormBuilder initial={{ keywords: [] }} onChange={handleChange} />);

    // Toggle Guard
    const guardBtn = screen.getByText('Guard');
    await user.click(guardBtn);
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        keywords: ['Guard'],
      }),
    );

    // Toggle Retaliate
    const retaliateBtn = screen.getByText('Retaliate');
    await user.click(retaliateBtn);

    const retaliateAmount = screen.getByTestId('keyword-retaliate-amount');
    fireEvent.change(retaliateAmount, { target: { value: '2' } });

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        keywords: expect.arrayContaining([{ keyword: 'Retaliate', amount: 2 }]),
      }),
    );
  });
});

describe('AbilityFormBuilder Trigger Filter & Scope', () => {
  it('renders trigger filter sub-form when event trigger is selected', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <StatefulAbilityFormBuilder
        initial={{
          abilities: [
            {
              id: 'retaliation',
              timing: 'RESPONSE',
              trigger: 'ENEMY_INITIATES_ATTACK',
              steps: [{ effect: 'DEAL_DAMAGE', params: { amount: 1 } }],
            },
          ],
        }}
        onChange={handleChange}
      />,
    );

    // Click Configure to expand trigger filter
    const configBtn = screen.getByText('Configure');
    await user.click(configBtn);

    expect(screen.getByTestId('trigger-attacker-kind-0')).toBeDefined();
    expect(screen.getByTestId('trigger-target-player-scope-0')).toBeDefined();
    expect(screen.getByTestId('trigger-target-form-0')).toBeDefined();
    expect(screen.getByTestId('trigger-is-engaged-0')).toBeDefined();

    // Select Attacker Kind: MINION
    const attackerKindSelect = screen.getByTestId('trigger-attacker-kind-0');
    await user.selectOptions(attackerKindSelect, 'MINION');

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        abilities: [
          expect.objectContaining({
            triggerFilter: expect.objectContaining({ attackerKind: 'MINION' }),
          }),
        ],
      }),
    );

    // Check Enemy Engaged
    const isEngagedCheck = screen.getByTestId('trigger-is-engaged-0');
    await user.click(isEngagedCheck);

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        abilities: [
          expect.objectContaining({
            triggerFilter: expect.objectContaining({
              attackerKind: 'MINION',
              isEngaged: true,
            }),
          }),
        ],
      }),
    );
  });
});

describe('AbilityFormBuilder Costs & Multi-Step Resolution Pipeline', () => {
  it('configures host exhaustion, hero damage, resource costs, and spend counters', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <StatefulAbilityFormBuilder
        initial={{
          abilities: [
            {
              id: 'repulsor_blast',
              timing: 'ACTION',
              steps: [{ effect: 'DEAL_DAMAGE', params: { amount: 1 } }],
            },
          ],
        }}
        onChange={handleChange}
      />,
    );

    // Exhaust host
    await user.click(screen.getByTestId('cost-exhaust-self-0'));
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        abilities: [
          expect.objectContaining({
            cost: expect.objectContaining({ exhaustSelf: true }),
          }),
        ],
      }),
    );

    // Hero DMG
    const heroDmg = screen.getByTestId('cost-damage-hero-0');
    fireEvent.change(heroDmg, { target: { value: '2' } });
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        abilities: [
          expect.objectContaining({
            cost: expect.objectContaining({ damageHero: 2 }),
          }),
        ],
      }),
    );

    // Add energy resource
    await user.click(screen.getByTestId('cost-res-plus-energy-0'));
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        abilities: [
          expect.objectContaining({
            cost: expect.objectContaining({ resources: ['energy'] }),
          }),
        ],
      }),
    );

    // Add spend counters cost
    await user.click(screen.getByTestId('cost-spend-counters-toggle-0'));
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        abilities: [
          expect.objectContaining({
            cost: expect.objectContaining({
              spendCounters: { amount: 1, counterType: 'charge', target: 'SELF' },
            }),
          }),
        ],
      }),
    );

    // Add discard card cost
    await user.click(screen.getByTestId('cost-discard-card-toggle-0'));
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        abilities: [
          expect.objectContaining({
            cost: expect.objectContaining({
              discardCard: { count: 1, from: 'HAND' },
            }),
          }),
        ],
      }),
    );
  });

  it('reorders steps using Move Up and Move Down buttons', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <StatefulAbilityFormBuilder
        initial={{
          abilities: [
            {
              id: 'multi_step',
              timing: 'ACTION',
              steps: [
                { effect: 'DEAL_DAMAGE', params: { amount: 3 } },
                { effect: 'DRAW', params: { count: 2 } },
              ],
            },
          ],
        }}
        onChange={handleChange}
      />,
    );

    // Step 2 move up button
    const step2MoveUp = screen.getByTestId('step-move-up-0-1');
    await user.click(step2MoveUp);

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        abilities: [
          expect.objectContaining({
            steps: [
              expect.objectContaining({ effect: 'DRAW' }),
              expect.objectContaining({ effect: 'DEAL_DAMAGE' }),
            ],
          }),
        ],
      }),
    );
  });

  it('selects step condition and gate', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <StatefulAbilityFormBuilder
        initial={{
          abilities: [
            {
              id: 'conditional_step',
              timing: 'ACTION',
              steps: [{ effect: 'DEAL_DAMAGE', params: { amount: 4 } }],
            },
          ],
        }}
        onChange={handleChange}
      />,
    );

    const gateSelect = screen.getByTestId('step-gate-0-0');
    await user.selectOptions(gateSelect, 'THEN');

    const conditionSelect = screen.getByTestId('step-condition-0-0');
    await user.selectOptions(conditionSelect, 'TARGET_DEFEATED');

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        abilities: [
          expect.objectContaining({
            steps: [
              expect.objectContaining({
                gate: 'THEN',
                condition: 'TARGET_DEFEATED',
              }),
            ],
          }),
        ],
      }),
    );
  });

  it('mounts DynamicValueBuilder for dynamic amount parameter', () => {
    render(
      <AbilityFormBuilder
        supplemental={{
          abilities: [
            {
              id: 'test_dynamic_param',
              timing: 'ACTION',
              steps: [{ effect: 'DEAL_DAMAGE', params: { amount: 3 } }],
            },
          ],
        }}
        onChange={vi.fn()}
      />,
    );

    // DynamicValueBuilder segmented buttons should be rendered
    expect(screen.getByText('Fixed Number')).toBeDefined();
    expect(screen.getByText('Dynamic Formula')).toBeDefined();
  });

  it('mounts UniversalCardFilterBuilder for card-filter parameter in SEARCH', () => {
    render(
      <AbilityFormBuilder
        supplemental={{
          abilities: [
            {
              id: 'test_filter_param',
              timing: 'ACTION',
              steps: [{ effect: 'SEARCH', params: { takeCount: 1 } }],
            },
          ],
        }}
        onChange={vi.fn()}
      />,
    );

    // UniversalCardFilterBuilder rendered for SEARCH.filter
    expect(screen.getByText(/Card Filter/i)).toBeDefined();
    expect(screen.getByTestId('filter-codes-input')).toBeDefined();
  });

  it('produces ability definitions that pass CardAbilitySchema validation', () => {
    const validAbility = {
      id: 'shield_toss',
      timing: 'HERO_ACTION' as const,
      cost: {
        exhaustSelf: true,
        resources: ['physical' as const],
        spendCounters: { amount: 1, counterType: 'shield', target: 'SELF' as const },
      },
      steps: [
        {
          effect: 'DEAL_DAMAGE' as const,
          params: { amount: 4 },
          condition: 'TARGET_DEFEATED' as const,
        },
      ],
    };

    const parsed = CardAbilitySchema.safeParse(validAbility);
    expect(parsed.success).toBe(true);

    const fullCard = {
      comment: 'Valid upgraded card',
      uses: { count: 3, type: 'shield', discardOnEmpty: false },
      keywords: [{ keyword: 'Retaliate', amount: 1 }, 'Guard'],
      restrictedSlots: 1,
      isLandscape: false,
      abilities: [validAbility],
    };

    const cardParsed = CardEnrichmentSchema.safeParse(fullCard);
    expect(cardParsed.success).toBe(true);
  });
});
