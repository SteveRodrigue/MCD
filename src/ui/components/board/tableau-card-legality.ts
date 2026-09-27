import { CardInstance } from '../../../engine/models/state';
import { isAbilityPlayableInForm } from '../../../engine/pipeline/cost-engine';

export interface TableauCardLegality {
  isUsable: boolean;
  reason?: string;
  badge?: 'HERO ONLY' | 'ALTER-EGO ONLY';
}

/**
 * Evaluates whether an in-play tableau card (Upgrade / Support) is active and legal
 * to trigger or benefit from in the player's current identity form (RR v1.8 p. 14, 15).
 */
export function evaluateTableauCardLegality(
  cardInst: CardInstance,
  currentForm: 'hero' | 'alter_ego',
): TableauCardLegality {
  const card = cardInst.card;
  const enrichment = card.enrichment;
  const abilities = enrichment?.abilities || [];
  const text = (card.text || '').toLowerCase();

  // 1. Explicit Card-Level Form Requirements (e.g. "Hero form only", "Alter-Ego form only")
  const reqForm = enrichment?.playRequirements?.identityForm;
  if (reqForm === 'HERO' || text.includes('hero form only')) {
    if (currentForm !== 'hero') {
      return {
        isUsable: false,
        reason: 'Requires Hero form',
        badge: 'HERO ONLY',
      };
    }
  }

  if (reqForm === 'ALTER_EGO' || text.includes('alter-ego form only')) {
    if (currentForm !== 'alter_ego') {
      return {
        isUsable: false,
        reason: 'Requires Alter-Ego form',
        badge: 'ALTER-EGO ONLY',
      };
    }
  }

  // 2. Ability Timing Legality
  if (abilities.length > 0) {
    const hasAnyLegalAbilityInForm = abilities.some((ab) =>
      isAbilityPlayableInForm(ab.timing as any, currentForm),
    );

    // If card has active/triggered abilities and NONE of them can be used in this form:
    if (!hasAnyLegalAbilityInForm) {
      const allRequireHero = abilities.every((ab) => ab.timing && ab.timing.startsWith('HERO_'));
      const allRequireAlterEgo = abilities.every(
        (ab) => ab.timing && ab.timing.startsWith('ALTER_EGO_'),
      );

      if (allRequireHero && currentForm !== 'hero') {
        return {
          isUsable: false,
          reason: 'Requires Hero form',
          badge: 'HERO ONLY',
        };
      }

      if (allRequireAlterEgo && currentForm !== 'alter_ego') {
        return {
          isUsable: false,
          reason: 'Requires Alter-Ego form',
          badge: 'ALTER-EGO ONLY',
        };
      }
    }
  }

  return { isUsable: true };
}
