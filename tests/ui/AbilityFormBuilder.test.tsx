import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AbilityFormBuilder } from '../../src/ui/components/editor/AbilityFormBuilder';
import { CardEnrichmentSchema, CardAbilitySchema } from '../../src/data/supplemental/schema';
import { cardCatalog } from '../../src/data/importer/card-loader';

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
    render(
      <AbilityFormBuilder supplemental={{ audit: { comment: 'Test card' } }} onChange={vi.fn()} />,
    );

    expect(screen.getByText(/CARD-LEVEL ATTRIBUTES & AUDIT/i)).toBeDefined();
    // Card-level attributes are a chip bar, not a Smart View / Show All toggle
    expect(screen.queryByTestId('toggle-show-all-fields-btn')).toBeNull();
    expect(screen.getByTestId('card-chip-add-uses')).toBeDefined();

    // Upstream-derived fields are not authored in the supplemental (derived from the printed card)
    expect(screen.queryByTestId('card-traits-input')).toBeNull();
    expect(screen.queryByTestId('card-restricted-slots-input')).toBeNull();
    expect(screen.queryByTestId('card-additional-boost-cards-input')).toBeNull();
    expect(screen.queryByTestId('card-victory-points-input')).toBeNull();
    expect(screen.queryByTestId('card-is-landscape-checkbox')).toBeNull();
  });

  it('manages uses counters lifecycle sub-form (add, modify, remove)', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <StatefulAbilityFormBuilder
        initial={{ audit: { comment: 'Uses card' } }}
        onChange={handleChange}
      />,
    );

    // Add the Uses / Counters chip
    await user.click(screen.getByTestId('card-chip-add-uses'));

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        uses: { count: 3, counterType: 'charge', discardOnEmpty: true },
      }),
    );

    // Modify count
    const countInput = screen.getByTestId('uses-count');
    fireEvent.change(countInput, { target: { value: '4' } });

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        uses: expect.objectContaining({ count: 4 }),
      }),
    );

    // Remove uses
    await user.click(screen.getByTestId('card-chip-remove-uses'));
    expect(handleChange).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ uses: expect.anything() }),
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
              steps: [{ effect: 'DEAL_DAMAGE', effectParams: { amount: 1 } }],
            },
          ],
        }}
        onChange={handleChange}
      />,
    );

    // Reveal the trigger filter via its chip, then expand it
    await user.click(screen.getByTestId('ability-chip-add-triggerFilter-0'));
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
              steps: [{ effect: 'DEAL_DAMAGE', effectParams: { amount: 1 } }],
            },
          ],
        }}
        onChange={handleChange}
      />,
    );

    await user.click(screen.getByTestId('ability-chip-add-cost-0'));
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
            cost: expect.objectContaining({ resourceCost: { energy: 1 } }),
          }),
        ],
      }),
    );

    // Add spend counters cost
    await user.click(screen.getByTestId('cost-spend-counters-add-0'));
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
    await user.click(screen.getByTestId('cost-discard-card-add-0'));
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
                { effect: 'DEAL_DAMAGE', effectParams: { amount: 3 } },
                { effect: 'DRAW', effectParams: { count: 2 } },
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

  it('selects step gate and updates gateParams', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <StatefulAbilityFormBuilder
        initial={{
          abilities: [
            {
              id: 'conditional_step',
              timing: 'ACTION',
              steps: [{ effect: 'DEAL_DAMAGE', effectParams: { amount: 4 } }],
            },
          ],
        }}
        onChange={handleChange}
      />,
    );

    await user.click(screen.getByTestId('step-chip-add-gate-0-0'));
    const gateSelect = screen.getByTestId('step-gate-0-0');
    await user.selectOptions(gateSelect, 'IF_ZONE_EMPTY');

    const zoneSelect = screen.getByTestId('gate-param-zone-0-0');
    await user.selectOptions(zoneSelect, 'SIDE_SCHEMES');

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        abilities: [
          expect.objectContaining({
            steps: [
              expect.objectContaining({
                gate: 'IF_ZONE_EMPTY',
                gateParams: expect.objectContaining({
                  zone: 'SIDE_SCHEMES',
                }),
              }),
            ],
          }),
        ],
      }),
    );
  });

  it('selects the IF_ACTIVATION_DEALT_DAMAGE gate (#221)', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <StatefulAbilityFormBuilder
        initial={{
          abilities: [
            {
              id: 'deferred_boost',
              timing: 'BOOST',
              trigger: 'BOOST',
              steps: [{ effect: 'ADD_STATUS', effectParams: { status: 'STUNNED' } }],
            },
          ],
        }}
        onChange={handleChange}
      />,
    );

    await user.click(screen.getByTestId('step-chip-add-gate-0-0'));
    const gateSelect = screen.getByTestId('step-gate-0-0') as HTMLSelectElement;
    expect(Array.from(gateSelect.options).map((o) => o.value)).toContain(
      'IF_ACTIVATION_DEALT_DAMAGE',
    );
    await user.selectOptions(gateSelect, 'IF_ACTIVATION_DEALT_DAMAGE');

    const last = handleChange.mock.calls[handleChange.mock.calls.length - 1][0];
    expect(CardEnrichmentSchema.safeParse(last).success).toBe(true);
    expect(last.abilities[0].steps[0]).toEqual(
      expect.objectContaining({
        gate: 'IF_ACTIVATION_DEALT_DAMAGE',
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
              steps: [{ effect: 'DEAL_DAMAGE', effectParams: { amount: 3 } }],
            },
          ],
        }}
        onChange={vi.fn()}
      />,
    );

    // DynamicValueBuilder segmented buttons should be rendered
    expect(screen.getAllByText('Fixed Number').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Dynamic Formula').length).toBeGreaterThanOrEqual(1);
  });

  it('mounts UniversalCardFilterBuilder for card-filter parameter in SEARCH', () => {
    render(
      <AbilityFormBuilder
        supplemental={{
          abilities: [
            {
              id: 'test_filter_param',
              timing: 'ACTION',
              steps: [{ effect: 'SEARCH', effectParams: { takeCount: 1 } }],
            },
          ],
        }}
        onChange={vi.fn()}
      />,
    );

    // SEARCH.filter is offered as a collapsed card-filter field; opening it mounts the builder
    expect(screen.getByTestId('step-param-filter-toggle-0-0')).toBeDefined();
    fireEvent.click(screen.getByTestId('step-param-filter-toggle-0-0'));
    expect(screen.getByTestId('filter-codes-input')).toBeDefined();
  });

  it('produces ability definitions that pass CardAbilitySchema validation', () => {
    const validAbility = {
      id: 'shield_toss',
      timing: 'HERO_ACTION' as const,
      cost: {
        exhaustSelf: true,
        resourceCost: { physical: 1 },
        spendCounters: { amount: 1, counterType: 'shield', target: 'SELF' as const },
      },
      steps: [
        {
          effect: 'DEAL_DAMAGE' as const,
          effectParams: { amount: 4 },
        },
      ],
    };

    const parsed = CardAbilitySchema.safeParse(validAbility);
    expect(parsed.success).toBe(true);

    const fullCard = {
      audit: { comment: 'Valid upgraded card' },
      uses: { count: 3, counterType: 'shield', discardOnEmpty: false },
      abilities: [validAbility],
    };

    const cardParsed = CardEnrichmentSchema.safeParse(fullCard);
    expect(cardParsed.success).toBe(true);
  });

  it('renders and updates ability-level errata field and removes key when cleared', async () => {
    const handleChange = vi.fn();

    render(
      <StatefulAbilityFormBuilder
        initial={{
          audit: { comment: 'Test' },
          abilities: [
            {
              id: 'test_errata_ab',
              timing: 'ACTION',
              errata: 'Official errata ruling',
              steps: [{ effect: 'DEAL_DAMAGE', effectParams: { amount: 1 } }],
            },
          ],
        }}
        onChange={handleChange}
      />,
    );

    const errataInput = screen.getByTestId('ability-errata-0') as HTMLInputElement;
    expect(errataInput.value).toBe('Official errata ruling');

    // Update errata
    fireEvent.change(errataInput, { target: { value: 'New ruling text' } });

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        abilities: [
          expect.objectContaining({
            id: 'test_errata_ab',
            errata: 'New ruling text',
          }),
        ],
      }),
    );

    // Clear errata
    fireEvent.change(errataInput, { target: { value: '' } });
    const lastCall = handleChange.mock.calls[handleChange.mock.calls.length - 1][0];
    expect(lastCall.abilities[0].errata).toBe('');

    // The remove control deletes the key
    fireEvent.click(screen.getByTestId('ability-chip-remove-errata-0'));
    const afterRemove = handleChange.mock.calls[handleChange.mock.calls.length - 1][0];
    expect('errata' in afterRemove.abilities[0]).toBe(false);

    // Validate with CardAbilitySchema
    const parsed = CardAbilitySchema.safeParse(lastCall.abilities[0]);
    expect(parsed.success).toBe(true);
  });

  it('offers no manual ability label controls (labels derive from the printed text)', () => {
    render(
      <StatefulAbilityFormBuilder
        initial={{
          audit: { comment: 'Test' },
          abilities: [
            {
              id: 'unlabelled',
              timing: 'HERO_ACTION',
              steps: [{ effect: 'DEAL_DAMAGE', effectParams: { amount: 1 } }],
            },
          ],
        }}
      />,
    );
    expect(screen.queryByTestId('ability-label-ATTACK-0')).toBeNull();
    expect(screen.queryByTestId('ability-label-THWART-0')).toBeNull();
    expect(screen.queryByTestId('ability-label-DEFENSE-0')).toBeNull();
  });

  it('toggles forEachPlayer on an ability (#220)', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(
      <StatefulAbilityFormBuilder
        initial={{
          audit: { comment: 'Test' },
          abilities: [
            {
              id: 'test_each_player_ab',
              timing: 'WHEN_REVEALED',
              steps: [{ effect: 'DEAL_DAMAGE', effectParams: { amount: 1 } }],
            },
          ],
        }}
        onChange={handleChange}
      />,
    );
    expect(screen.queryByTestId('ability-for-each-player-0')).toBeNull();
    await user.click(screen.getByTestId('ability-chip-add-forEachPlayer-0'));
    const box = screen.getByTestId('ability-for-each-player-0') as HTMLInputElement;
    expect(box.checked).toBe(true);
    expect(handleChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        abilities: [expect.objectContaining({ forEachPlayer: true })],
      }),
    );
    await user.click(box);
    const last = handleChange.mock.calls[handleChange.mock.calls.length - 1][0];
    expect(last.abilities[0].forEachPlayer).toBeUndefined();
  });

  describe('Real-Time Live Zod Validation', () => {
    it('displays compliant status badge when card passes schema', () => {
      render(
        <AbilityFormBuilder
          supplemental={{
            audit: { comment: 'Valid Card' },
            abilities: [
              {
                id: 'valid_ab',
                timing: 'ACTION',
                steps: [{ effect: 'DEAL_DAMAGE', effectParams: { amount: 3 } }],
              },
            ],
          }}
          onChange={vi.fn()}
        />,
      );

      expect(screen.getByTestId('live-validation-status')).toBeDefined();
      expect(screen.getByText(/SCHEMA COMPLIANT/i)).toBeDefined();
    });

    it('displays issue count and toggles details when card fails schema validation', async () => {
      const user = userEvent.setup();

      render(
        <AbilityFormBuilder
          supplemental={{
            // Removed upstream-derived field: the strict schema rejects it
            maxPerPlayer: 1,
            abilities: [
              {
                id: 'broken_ab',
                timing: 'INVALID_TIMING' as any,
                steps: [],
              },
            ],
          }}
          onChange={vi.fn()}
        />,
      );

      const statusEl = screen.getByTestId('live-validation-status');
      expect(statusEl).toBeDefined();
      expect(screen.getByText(/ISSUES? DETECTED/i)).toBeDefined();

      // Show details
      const toggleBtn = screen.getByTestId('toggle-validation-issues-btn');
      await user.click(toggleBtn);

      expect(screen.getByTestId('validation-issues-list')).toBeDefined();

      // Ability invalid badge
      expect(screen.getByTestId('ability-invalid-badge-0')).toBeDefined();
      expect(screen.getByTestId('ability-errors-0')).toBeDefined();
    });
  });
});

describe('AbilityFormBuilder derived label badges (Phase 4)', () => {
  it('shows a read-only AUTO: ATTACK badge for an ability whose loaded card prints (attack)', () => {
    const upstreamCard = cardCatalog.getCard('01005')!;
    render(
      <AbilityFormBuilder
        supplemental={{
          audit: { comment: 'Test' },
          abilities: [
            {
              id: 'swinging_web_kick',
              timing: 'HERO_ACTION',
              steps: [{ effect: 'DEAL_DAMAGE', effectParams: { amount: 8 } }],
            },
          ],
        }}
        upstreamCard={upstreamCard}
        onChange={vi.fn()}
      />,
    );
    const badge = screen.getByTestId('ability-label-badge-0-ATTACK');
    expect(badge.textContent).toBe('AUTO: ATTACK');
    expect(badge.tagName).not.toBe('INPUT');
  });

  it('shows no badge when the loaded card is absent', () => {
    render(
      <AbilityFormBuilder
        supplemental={{
          audit: { comment: 'Test' },
          abilities: [
            {
              id: 'swinging_web_kick',
              timing: 'HERO_ACTION',
              steps: [{ effect: 'DEAL_DAMAGE', effectParams: { amount: 8 } }],
            },
          ],
        }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByText(/AUTO:/)).toBeNull();
  });
});

describe('AbilityFormBuilder progressive disclosure (Phase 4)', () => {
  const baseAbility = {
    id: 'a1',
    timing: 'HERO_ACTION',
    steps: [{ effect: 'DEAL_DAMAGE', effectParams: { amount: 1 } }],
  };
  const initialWith = (ability: any) => ({ audit: { comment: 'Test' }, abilities: [ability] });

  it('hides every optional field behind the chip bar when unset', () => {
    render(<StatefulAbilityFormBuilder initial={initialWith(baseAbility)} />);
    for (const key of ['cost', 'triggerFilter', 'limit', 'zone', 'forEachPlayer', 'errata']) {
      expect(screen.getByTestId(`ability-chip-add-${key}-0`)).toBeDefined();
      expect(screen.queryByTestId(`ability-section-${key}-0`)).toBeNull();
    }
    expect(screen.queryByTestId('ability-trigger-select-0')).toBeNull();
    expect(screen.getByText('Timing Window')).toBeDefined();
  });

  it.each([
    'FORCED_INTERRUPT',
    'INTERRUPT',
    'HERO_INTERRUPT',
    'ALTER_EGO_INTERRUPT',
    'FORCED_RESPONSE',
    'RESPONSE',
    'HERO_RESPONSE',
    'ALTER_EGO_RESPONSE',
    'WHEN_REVEALED',
    'BOOST',
  ])('shows Event Trigger by default for timing %s', (timing) => {
    render(<StatefulAbilityFormBuilder initial={initialWith({ ...baseAbility, timing })} />);
    expect(screen.getByTestId('ability-trigger-select-0')).toBeDefined();
  });

  it('shows Event Trigger for a non-trigger timing when trigger is already set', () => {
    render(
      <StatefulAbilityFormBuilder
        initial={initialWith({ ...baseAbility, trigger: 'CARD_PLAYED' })}
      />,
    );
    expect(screen.getByTestId('ability-trigger-select-0')).toBeDefined();
  });

  const defaults: Array<[string, unknown]> = [
    ['cost', {}],
    ['triggerFilter', {}],
    ['limit', 'ONCE_PER_ROUND'],
    ['zone', 'HAND'],
    ['forEachPlayer', true],
    ['errata', ''],
  ];

  it.each(defaults)('adds then removes the %s chip', async (key, initial) => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(
      <StatefulAbilityFormBuilder initial={initialWith(baseAbility)} onChange={handleChange} />,
    );

    await user.click(screen.getByTestId(`ability-chip-add-${key}-0`));
    expect(handleChange.mock.calls.at(-1)![0].abilities[0][key]).toEqual(initial);
    expect(screen.getByTestId(`ability-section-${key}-0`)).toBeDefined();
    expect(screen.queryByTestId(`ability-chip-add-${key}-0`)).toBeNull();

    await user.click(screen.getByTestId(`ability-chip-remove-${key}-0`));
    expect(key in handleChange.mock.calls.at(-1)![0].abilities[0]).toBe(false);
    expect(screen.queryByTestId(`ability-section-${key}-0`)).toBeNull();
    expect(screen.getByTestId(`ability-chip-add-${key}-0`)).toBeDefined();
  });

  it('renders already-set optional fields without their chip', () => {
    render(
      <StatefulAbilityFormBuilder
        initial={initialWith({
          ...baseAbility,
          limit: 'ONCE_PER_PHASE',
          zone: 'DISCARD',
          cost: { exhaustSelf: true },
        })}
      />,
    );
    expect((screen.getByTestId('ability-limit-select-0') as HTMLSelectElement).value).toBe(
      'ONCE_PER_PHASE',
    );
    expect((screen.getByTestId('ability-zone-select-0') as HTMLSelectElement).value).toBe(
      'DISCARD',
    );
    expect(screen.getByTestId('cost-exhaust-self-0')).toBeDefined();
    expect(screen.queryByTestId('ability-chip-add-limit-0')).toBeNull();
  });
});
