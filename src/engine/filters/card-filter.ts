import type { NormalizedCard, PlayerState, GameState } from '../models';
import type { UniversalCardFilter } from '../../data/supplemental/schema';

export interface FilterContext {
  player?: PlayerState;
  state?: GameState;
}

/**
 * Universal declarative card filter evaluator (ADR-0046, RR v1.8 p. 19, 26, 28).
 * Pure, card-agnostic predicate evaluation for any card or in-play card instance.
 */
export function matchesCardFilter(
  card:
    | NormalizedCard
    | {
        code: string;
        name?: string;
        type?: string;
        traits?: string[];
        cost?: number;
        isUnique?: boolean;
        raw?: any;
        resources?: Record<string, number>;
        isExhausted?: boolean;
        statusTokens?: string[];
        [k: string]: any;
      },
  filter?: UniversalCardFilter,
  context?: FilterContext,
): boolean {
  if (!filter) return true;

  // 1. Boolean Combinator: ALL (Logical AND)
  if (filter.all && filter.all.length > 0) {
    const allMatch = filter.all.every((subFilter) => matchesCardFilter(card, subFilter, context));
    if (!allMatch) return false;
  }

  // 2. Boolean Combinator: ANY (Logical OR)
  if (filter.any && filter.any.length > 0) {
    const anyMatch = filter.any.some((subFilter) => matchesCardFilter(card, subFilter, context));
    if (!anyMatch) return false;
  }

  // 3. Boolean Combinator: NONE (Logical NOT / Exclusion)
  if (filter.none && filter.none.length > 0) {
    const noneMatch = filter.none.every(
      (subFilter) => !matchesCardFilter(card, subFilter, context),
    );
    if (!noneMatch) return false;
  }

  // 4. Exact Card Codes
  const codes =
    filter.codes ||
    ((filter as any).code
      ? [(filter as any).code as string]
      : (filter as any).targetCardCode
        ? [(filter as any).targetCardCode as string]
        : undefined);
  if (codes && codes.length > 0) {
    if (!codes.includes(card.code)) return false;
  }

  // 5. Card Names (Case-insensitive matching)
  const names =
    filter.names ||
    ((filter as any).name
      ? [(filter as any).name as string]
      : (filter as any).targetCardName
        ? [(filter as any).targetCardName as string]
        : undefined);
  if (names && names.length > 0) {
    const cardName = (card.name || '').toLowerCase().trim();
    const matchesName = names.some((n) => n.toLowerCase().trim() === cardName);
    if (!matchesName) return false;
  }

  // 6. Card Types (Matches normalized or raw type_code)
  const types =
    filter.types ||
    ((filter as any).type
      ? [(filter as any).type as string]
      : (filter as any).type_code
        ? [(filter as any).type_code as string]
        : (filter as any).cardType
          ? [(filter as any).cardType as string]
          : undefined);
  if (types && types.length > 0) {
    const cardType = (card.type || '').toLowerCase().trim();
    const rawType = ((card.raw as any)?.type_code || '').toLowerCase().trim();
    const normalizedTargetTypes = types.map((t) => t.toLowerCase().trim());
    if (!normalizedTargetTypes.includes(cardType) && !normalizedTargetTypes.includes(rawType)) {
      return false;
    }
  }

  // 7. Traits (Case- and punctuation-resilient matching, matches if card has ANY listed trait)
  const traits =
    filter.traits || ((filter as any).trait ? [(filter as any).trait as string] : undefined);
  if (traits && traits.length > 0) {
    const cardTraits = card.traits || [];
    const normalizedCardTraits = cardTraits.map((t: string) => ({
      raw: t.toLowerCase().trim(),
      stripped: t.toLowerCase().replace(/[^a-z0-9]/g, ''),
    }));

    const matchesAnyTrait = traits.some((targetTrait) => {
      const targetLower = targetTrait.toLowerCase().trim();
      const targetStripped = targetLower.replace(/[^a-z0-9]/g, '');

      return normalizedCardTraits.some(
        (ct: { raw: string; stripped: string }) =>
          ct.raw === targetLower ||
          ct.raw.includes(targetLower) ||
          (targetStripped.length > 0 &&
            (ct.stripped === targetStripped || ct.stripped.includes(targetStripped))),
      );
    });

    if (!matchesAnyTrait) return false;
  }

  // 8. Aspects / Factions
  const aspects =
    filter.aspects ||
    ((filter as any).aspect
      ? [(filter as any).aspect as string]
      : (filter as any).faction
        ? [(filter as any).faction as string]
        : undefined);
  if (aspects && aspects.length > 0) {
    const cardFaction = ((card.raw as any)?.faction_code || '').toLowerCase().trim();
    const normalizedTargetAspects = aspects.map((a) => a.toLowerCase().trim());
    if (!normalizedTargetAspects.includes(cardFaction)) return false;
  }

  // 9. Card Sets
  const sets = filter.sets || ((filter as any).set ? [(filter as any).set as string] : undefined);
  if (sets && sets.length > 0) {
    const cardSet = (
      (card as any).setCode ||
      (card.raw as any)?.card_set_code ||
      (card.raw as any)?.set_code ||
      (card as any).card_set_code ||
      ''
    )
      .toLowerCase()
      .trim();
    const matchesSet = sets.some((s) => {
      const targetSet = s.toLowerCase().trim();
      if (targetSet === 'player_nemesis') {
        const heroSetCode = (
          context?.player?.hero?.setCode ||
          (context?.player?.hero?.raw as any)?.card_set_code ||
          ''
        )
          .toLowerCase()
          .trim();
        const nemesisSetCode = heroSetCode ? `${heroSetCode}_nemesis` : '';
        return (
          cardSet.includes('nemesis') ||
          (nemesisSetCode.length > 0 && cardSet.includes(nemesisSetCode)) ||
          (heroSetCode.length > 0 &&
            cardSet.includes(heroSetCode) &&
            cardSet.includes('nemesis')) ||
          (card.raw as any)?.set_type === 'nemesis'
        );
      }
      return cardSet === targetSet || cardSet.includes(targetSet);
    });
    if (!matchesSet) return false;
  }

  // 10. Unicity
  if (filter.isUnique !== undefined) {
    if (card.isUnique !== filter.isUnique) return false;
  }

  // 11. Identity Specificity
  if (filter.isIdentitySpecific && context?.player) {
    const heroCode = context.player.hero.code;
    const heroSet =
      (context.player.hero.raw as any)?.card_set_code || context.player.hero.name.toLowerCase();
    const cardSet = (card.raw as any)?.card_set_code || '';
    if (cardSet !== heroSet && !(card.code || '').startsWith(heroCode.slice(0, 3))) {
      return false;
    }
  }

  // 12. Cost Comparisons
  if (filter.cost) {
    const cardCost = card.cost;
    if (typeof cardCost !== 'number') return false;
    if (filter.cost.min !== undefined && cardCost < filter.cost.min) return false;
    if (filter.cost.max !== undefined && cardCost > filter.cost.max) return false;
    if (filter.cost.equals !== undefined && cardCost !== filter.cost.equals) return false;
  }

  // 13. Resource Icons
  const resourceIcons =
    filter.resourceIcons ||
    ((filter as any).resource
      ? [(filter as any).resource as string]
      : (filter as any).resourceIcon
        ? [(filter as any).resourceIcon as string]
        : undefined);
  if (resourceIcons && resourceIcons.length > 0) {
    const resources = (card.resources || {}) as Record<string, number | undefined>;
    const matchesAnyResource = resourceIcons.some((r) => {
      const targetResource = r.toLowerCase().trim();
      const count = resources[targetResource] || 0;
      const wildCount = targetResource !== 'wild' ? resources['wild'] || 0 : 0;
      return count > 0 || wildCount > 0;
    });
    if (!matchesAnyResource) return false;
  }

  // 14. Keywords
  if (filter.hasKeyword) {
    const targetKeyword = filter.hasKeyword.toLowerCase().trim();
    const rawText = ((card.raw as any)?.text || '').toLowerCase();
    const keywords = (card as any).keywords || [];
    const hasKw =
      keywords.some((kw: string) => kw.toLowerCase().trim() === targetKeyword) ||
      rawText.includes(targetKeyword);
    if (!hasKw) return false;
  }

  // 15. In-Play Exhaustion State
  if (filter.isExhausted !== undefined) {
    const cardExhausted = Boolean((card as any).isExhausted || (card as any).exhausted);
    if (cardExhausted !== filter.isExhausted) return false;
  }

  // 16. In-Play Status Conditions
  if (filter.hasStatus && filter.hasStatus.length > 0) {
    const statusTokens: string[] =
      (card as any).statusTokens ||
      ((card as any).isStunned ? ['STUNNED'] : [])
        .concat((card as any).isConfused ? ['CONFUSED'] : [])
        .concat((card as any).isTough ? ['TOUGH'] : []);

    const matchesAllStatus = filter.hasStatus.every((st) =>
      statusTokens.map((s) => s.toUpperCase()).includes(st.toUpperCase()),
    );
    if (!matchesAllStatus) return false;
  }

  return true;
}
