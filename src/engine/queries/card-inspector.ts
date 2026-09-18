import type { GameState, PlayerState, CardInstance, NormalizedCard } from '../models';
import { ResourceType } from '../models/enums';
import type { CardLocationSelector, CardInspectionAttribute } from '../../data/supplemental/schema';
import { matchesCardFilter } from '../filters/card-filter';

export interface CardLocatorContext {
  player?: PlayerState;
  sourceCardInstance?: CardInstance;
  targetCardInstance?: CardInstance;
  targetInstanceId?: string;
}

/**
 * Universal Card Locator Subsystem (ADR-0046, Issue #13, RR v1.8)
 *
 * Locates cards across any game zone or in play using declarative CardLocationSelector.
 */
export function locateCard(
  state: GameState,
  selector: CardLocationSelector,
  context?: CardLocatorContext,
): CardInstance | NormalizedCard | undefined {
  if (!selector) return undefined;

  // 1. Target-based resolution
  if (selector.target) {
    switch (selector.target) {
      case 'SELF':
        return context?.sourceCardInstance;
      case 'TARGET_CARD':
        return context?.targetCardInstance;
      case 'ATTACHED_CARD': {
        const host = context?.sourceCardInstance || context?.targetCardInstance;
        return host?.attachments?.[0];
      }
      case 'HOST_CARD': {
        const src = context?.sourceCardInstance;
        if (!src) return undefined;
        for (const p of state.players || []) {
          if (p.attachments?.some((a) => a.instanceId === src.instanceId)) {
            return p.activeFormCard;
          }
          for (const t of p.tableau || []) {
            if (t.attachments?.some((a) => a.instanceId === src.instanceId)) return t;
          }
          for (const al of p.allies || []) {
            if (al.attachments?.some((a) => a.instanceId === src.instanceId)) return al;
          }
        }
        if (state.villain?.attachments?.some((a) => a.instanceId === src.instanceId)) {
          return state.villain.card;
        }
        for (const s of state.sideSchemes || []) {
          if (s.attachments?.some((a) => a.instanceId === src.instanceId)) return s.card;
        }
        return undefined;
      }
    }
  }

  const player = context?.player || state.players?.[state.activePlayerIndex] || state.players?.[0];

  const matchesCard = (c: CardInstance | NormalizedCard | any): boolean => {
    if (!c) return false;
    const normCard: NormalizedCard = 'card' in c ? c.card : c;
    if (selector.cardCode) {
      if (normCard.code !== selector.cardCode && (c as any).code !== selector.cardCode) {
        return false;
      }
    }
    if (selector.filter) {
      return matchesCardFilter(normCard, selector.filter, { player, state });
    }
    return true;
  };

  const pickFromList = (
    list: (CardInstance | NormalizedCard | any)[],
  ): CardInstance | NormalizedCard | undefined => {
    if (!list || list.length === 0) return undefined;
    const pos = selector.position;

    if (pos === 'BOTTOM') {
      if (selector.cardCode || selector.filter) {
        for (let i = 0; i < list.length; i++) {
          if (matchesCard(list[i])) return list[i];
        }
        return undefined;
      }
      return list[0];
    }

    if (pos === 'TOPMOST_MATCHING' || selector.cardCode || selector.filter) {
      for (let i = list.length - 1; i >= 0; i--) {
        if (matchesCard(list[i])) return list[i];
      }
      return undefined;
    }

    // Default: TOP (last element in deck/discard arrays)
    return list[list.length - 1];
  };

  switch (selector.zone) {
    case 'PLAYER_DISCARD': {
      if (!player) return undefined;
      return pickFromList(player.discard || []);
    }

    case 'PLAYER_DECK': {
      if (!player) return undefined;
      return pickFromList(player.deck || []);
    }

    case 'ENCOUNTER_DECK': {
      return pickFromList(state.encounterDeck || []);
    }

    case 'ENCOUNTER_DISCARD': {
      return pickFromList(state.encounterDiscard || []);
    }

    case 'SIDE_SCHEMES': {
      const schemes = state.sideSchemes || [];
      for (let i = schemes.length - 1; i >= 0; i--) {
        const s = schemes[i];
        if (matchesCard(s.card)) {
          return {
            instanceId: s.instanceId,
            card: s.card,
            threat: s.threat,
            tokens: { threat: s.threat },
            attachments: s.attachments,
            cardsUnderneath: s.cardsUnderneath,
            ownerId: s.ownerId,
          } as any;
        }
      }
      return undefined;
    }

    case 'TABLEAU': {
      if (!player) return undefined;
      return pickFromList(player.tableau || []);
    }

    case 'TUCKED': {
      const host =
        context?.sourceCardInstance || context?.targetCardInstance || player?.activeFormCard;
      const cardsUnder = (host as any)?.cardsUnderneath || player?.cardsUnderneath || [];
      return pickFromList(cardsUnder);
    }

    case 'ATTACHED': {
      const host = context?.sourceCardInstance || context?.targetCardInstance || player;
      const attachments = (host as any)?.attachments || [];
      return pickFromList(attachments);
    }

    case 'IN_PLAY': {
      // 1. Check side schemes
      for (const s of state.sideSchemes || []) {
        if (matchesCard(s.card)) {
          return {
            instanceId: s.instanceId,
            card: s.card,
            threat: s.threat,
            tokens: { threat: s.threat },
            attachments: s.attachments,
            cardsUnderneath: s.cardsUnderneath,
          } as any;
        }
      }

      // 2. Check main schemes
      for (const ms of state.mainSchemes || (state.mainScheme ? [state.mainScheme] : [])) {
        if (matchesCard(ms.card)) {
          return {
            instanceId: ms.instanceId || 'main_scheme',
            card: ms.card,
            threat: ms.threat,
            tokens: { threat: ms.threat },
            attachments: ms.attachments,
            cardsUnderneath: ms.cardsUnderneath,
          } as any;
        }
      }

      // 3. Check villains
      for (const v of state.villains || (state.villain ? [state.villain] : [])) {
        if (matchesCard(v.card)) {
          return {
            instanceId: v.instanceId || 'villain',
            card: v.card,
            tokens: { damage: v.health < v.maxHealth ? v.maxHealth - v.health : 0 },
            health: v.health,
            maxHealth: v.maxHealth,
            attachments: v.attachments,
            cardsUnderneath: v.cardsUnderneath,
          } as any;
        }
      }

      // 4. Check players' in-play cards (tableau, allies, engagedMinions, attachments)
      const allPlayers = state.players || [];
      for (const p of allPlayers) {
        for (const t of p.tableau || []) {
          if (matchesCard(t)) return t;
        }
        for (const a of p.allies || []) {
          if (matchesCard(a)) return a;
        }
        for (const m of p.engagedMinions || []) {
          if (matchesCard(m)) return m;
        }
        for (const att of p.attachments || []) {
          if (matchesCard(att)) return att;
        }
      }

      // 5. Check environments
      for (const env of state.environments || []) {
        if (matchesCard(env)) return env;
      }

      return undefined;
    }

    default: {
      if (selector.cardCode || selector.filter) {
        return locateCard(state, { ...selector, zone: 'IN_PLAY' }, context);
      }
      return undefined;
    }
  }
}

/**
 * Reads a numeric property or resource yield from a card or in-play entity.
 */
export function readCardAttribute(
  card: CardInstance | NormalizedCard | any,
  attribute: CardInspectionAttribute,
): number {
  if (!card) return 0;

  const cardData: NormalizedCard = 'card' in card ? card.card : card;

  switch (attribute) {
    case 'PRINTED_COST': {
      const cost = cardData?.cost ?? (cardData?.raw as any)?.cost;
      return typeof cost === 'number' ? cost : 0;
    }

    case 'BOOST_ICONS': {
      const boost =
        cardData?.boostIcons ?? (cardData as any)?.boost ?? (cardData?.raw as any)?.boost;
      return typeof boost === 'number' ? boost : 0;
    }

    case 'THREAT': {
      const threat = card?.threat ?? card?.tokens?.threat ?? (card as any)?.card?.threat ?? 0;
      return typeof threat === 'number' ? threat : 0;
    }

    case 'DAMAGE': {
      const damage = card?.damage ?? card?.tokens?.damage ?? 0;
      return typeof damage === 'number' ? damage : 0;
    }

    case 'COUNTERS': {
      if (typeof card?.tokens?.counters === 'number') {
        return card.tokens.counters;
      }
      if (card?.counters && typeof card.counters === 'object') {
        return Object.values(card.counters as Record<string, number>).reduce(
          (sum, val) => sum + (typeof val === 'number' ? val : 0),
          0,
        );
      }
      return 0;
    }

    case 'PRINTED_RESOURCES':
    case 'TOTAL_RESOURCES': {
      if (cardData?.resources?.total !== undefined) {
        return cardData.resources.total;
      }
      return readCardResources(cardData).length;
    }

    case 'PHYSICAL_RESOURCES': {
      const p = cardData?.resources?.physical ?? (cardData?.raw as any)?.resource_physical;
      return typeof p === 'number' ? p : 0;
    }

    case 'ENERGY_RESOURCES': {
      const e = cardData?.resources?.energy ?? (cardData?.raw as any)?.resource_energy;
      return typeof e === 'number' ? e : 0;
    }

    case 'MENTAL_RESOURCES': {
      const m = cardData?.resources?.mental ?? (cardData?.raw as any)?.resource_mental;
      return typeof m === 'number' ? m : 0;
    }

    case 'WILD_RESOURCES': {
      const w = cardData?.resources?.wild ?? (cardData?.raw as any)?.resource_wild;
      return typeof w === 'number' ? w : 0;
    }

    default:
      return 0;
  }
}

/**
 * Reads the array of printed resource types on a card.
 * (e.g. Energy 01088 returns ['energy', 'energy'], The Power of Leadership returns ['wild', 'wild']).
 */
export function readCardResources(card: CardInstance | NormalizedCard | any): ResourceType[] {
  if (!card) return [];

  const cardData: NormalizedCard = 'card' in card ? card.card : card;
  const res = cardData?.resources;
  const raw = cardData?.raw as any;

  const result: ResourceType[] = [];

  const physical = res?.physical ?? raw?.resource_physical ?? 0;
  const energy = res?.energy ?? raw?.resource_energy ?? 0;
  const mental = res?.mental ?? raw?.resource_mental ?? 0;
  const wild = res?.wild ?? raw?.resource_wild ?? 0;

  for (let i = 0; i < physical; i++) result.push(ResourceType.PHYSICAL);
  for (let i = 0; i < energy; i++) result.push(ResourceType.ENERGY);
  for (let i = 0; i < mental; i++) result.push(ResourceType.MENTAL);
  for (let i = 0; i < wild; i++) result.push(ResourceType.WILD);

  return result;
}
