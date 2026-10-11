import { describe, it, expect } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { optionRequiresPayment } from '../../src/ui/utils/option-requires-payment';
import { CardAbility, DecisionPromptOption } from '../../src/engine/models';

describe('optionRequiresPayment (#298: no second payment after an ability target choice)', () => {
  const costlyAbility = cardCatalog
    .getCard('01026')!
    .enrichment!.abilities!.find((a) => a.id === 'superhuman_law_division') as CardAbility;

  it('is false for an ability target choice: the cost was paid when the prompt was created', () => {
    const option: DecisionPromptOption = {
      id: 'main_scheme',
      label: 'Main Scheme',
      effect: 'ABILITY_CHOSEN_TARGET',
      params: { isAbilityTargetChoice: true, ability: costlyAbility },
    };
    expect(optionRequiresPayment(option)).toBe(false);
  });

  it('is true for an option that still carries an unpaid ability cost', () => {
    const option: DecisionPromptOption = {
      id: 'use',
      label: 'Use',
      effect: 'USE_ABILITY',
      params: { ability: costlyAbility },
    };
    expect(optionRequiresPayment(option)).toBe(true);
  });

  it('is true for a resourceCost param or an explicit requiresPayment flag', () => {
    expect(
      optionRequiresPayment({
        id: 'a',
        label: 'A',
        effect: 'X',
        params: { resourceCost: { amount: 2 } },
      }),
    ).toBe(true);
    expect(
      optionRequiresPayment({
        id: 'b',
        label: 'B',
        effect: 'X',
        params: { requiresPayment: true },
      }),
    ).toBe(true);
  });

  it('is false for a decline option and for an option with no cost', () => {
    expect(
      optionRequiresPayment({
        id: 'pass',
        label: 'No',
        effect: 'PASS',
        params: { ability: costlyAbility },
      }),
    ).toBe(false);
    expect(optionRequiresPayment({ id: 'free', label: 'Free', effect: 'X' })).toBe(false);
  });
});
