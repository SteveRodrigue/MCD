import { CardAbility } from '../models/abilities';
import { CardType } from '../models/enums';
import { CardInstance } from '../models/state';

/** Effects that cancel the reveal of an encounter card (Enhanced Spider-Sense, Black Widow, ...). */
export const CANCEL_REVEAL_EFFECTS = [
  'CANCEL_WHEN_REVEALED',
  'CANCEL_WHEN_REVEALED_AND_REVEAL_ANOTHER',
] as const;

/** The cancel also discards the card: it does not enter play ("cancel the effects and discard it"). */
export const CANCEL_AND_DISCARD_EFFECT = 'CANCEL_WHEN_REVEALED_AND_REVEAL_ANOTHER';

export function abilityCancelsEncounterReveal(ability: CardAbility): boolean {
  return (ability.steps ?? []).some((step) =>
    (CANCEL_REVEAL_EFFECTS as readonly string[]).includes(step.effect),
  );
}

function isWhenRevealed(ability: CardAbility): boolean {
  return ability.trigger === 'WHEN_REVEALED' || ability.timing === 'WHEN_REVEALED';
}

/**
 * The single rule for "can the reveal of this encounter card be cancelled" (RR v1.8 Cancel,
 * Villain, When Revealed):
 * - the reveal of a villain and the When Revealed of villain and main scheme cards cannot be
 *   cancelled;
 * - a When Revealed ability whose effects are all declared `cannotBeCanceled` leaves nothing to
 *   cancel ("This effect cannot be canceled").
 * A cancel that cannot cancel is not offered, so its cost is not paid for nothing.
 */
export function canCancelEncounterReveal(cardInstance: CardInstance): boolean {
  const type = cardInstance.card.type;
  if (type === CardType.VILLAIN || type === CardType.MAIN_SCHEME) return false;
  const steps = (cardInstance.card.enrichment?.abilities ?? [])
    .filter(isWhenRevealed)
    .flatMap((ability) => ability.steps ?? []);
  return steps.length === 0 || steps.some((step) => step.cannotBeCanceled !== true);
}

/**
 * The When Revealed abilities of a card that still resolve: all of them, or only the steps
 * declared `cannotBeCanceled` when the reveal was cancelled.
 */
export function getResolvingRevealAbilities(
  cardInstance: CardInstance,
  isCancelled: boolean,
): CardAbility[] {
  const abilities = (cardInstance.card.enrichment?.abilities ?? []).filter(isWhenRevealed);
  if (!isCancelled) return abilities;
  return abilities
    .map((ability) => ({
      ...ability,
      steps: (ability.steps ?? []).filter((step) => step.cannotBeCanceled === true),
    }))
    .filter((ability) => ability.steps.length > 0);
}
