import type { DecisionPromptOption } from '../../engine/models';

/**
 * True when picking this decision prompt option still has to be paid for.
 * An ability target choice carries the ability (and its cost) only so the engine can resolve its
 * steps; the cost was already paid when the ability was used, so it never asks again (#298).
 */
export function optionRequiresPayment(option: DecisionPromptOption): boolean {
  const id = option.id;
  if (id === 'pass' || id === 'PASS' || id.includes('decline') || id.includes('none')) return false;
  const params = option.params as Record<string, any> | undefined;
  if (params?.isAbilityTargetChoice) return false;
  const abilityCost = params?.ability?.cost?.resourceCost;
  return Boolean(
    (option as any).requiresPayment ||
    params?.requiresPayment ||
    (params?.resourceCost && params.resourceCost.amount !== 0) ||
    (abilityCost !== undefined && abilityCost !== 0),
  );
}
