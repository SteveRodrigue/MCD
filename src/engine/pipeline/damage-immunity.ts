import { GameState, CardInstance } from '@engine/models';
import { getEffectiveCardTraits } from './stat-calculator';

/**
 * Whether a character cannot take damage from this source (#297). Reads the target's own
 * CONSTANT `CANNOT_TAKE_DAMAGE` steps; an optional `sourceCardType` and `sourceTrait` restrict the
 * immunity to damage from a card of that type and trait (Killmonger: Black Panther upgrades). A
 * step without a filter is a full immunity. Damage with no source card (a basic attack) matches
 * no filter. RR v1.8 "Targets": such a character is not a valid target of a damage-only ability.
 */
export function isImmuneToDamage(
  state: GameState,
  target: unknown,
  sourceCard?: CardInstance,
): boolean {
  const abilities = (target as { card?: { enrichment?: { abilities?: unknown[] } } })?.card
    ?.enrichment?.abilities as
    | { timing?: string; steps?: { effect: string; effectParams?: Record<string, unknown> }[] }[]
    | undefined;
  for (const ability of abilities ?? []) {
    if (ability.timing !== 'CONSTANT') continue;
    for (const step of ability.steps ?? []) {
      if (step.effect !== 'CANNOT_TAKE_DAMAGE') continue;
      const cardType = step.effectParams?.sourceCardType as string | undefined;
      const trait = step.effectParams?.sourceTrait as string | undefined;
      if (!cardType && !trait) return true;
      if (!sourceCard) continue;
      if (cardType && String(sourceCard.card.type).toUpperCase() !== cardType.toUpperCase())
        continue;
      if (
        trait &&
        !getEffectiveCardTraits(sourceCard.card, sourceCard, { state }).some(
          (t) => t.toLowerCase().trim() === trait.toLowerCase().trim(),
        )
      ) {
        continue;
      }
      return true;
    }
  }
  return false;
}
