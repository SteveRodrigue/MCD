import { GameState, CardInstance } from '../models';

/**
 * Traverses all containers and zones in the game state to collect every active CardInstance.
 */
export function getAllCardInstances(state: GameState): CardInstance[] {
  const cards: CardInstance[] = [];

  // 1. Player Zones & Entities
  for (const player of state.players || []) {
    cards.push(...(player.deck || []));
    cards.push(...(player.hand || []));
    cards.push(...(player.discard || []));
    cards.push(...(player.tableau || []));
    cards.push(...(player.attachments || []));
    cards.push(...(player.cardsUnderneath || []));

    for (const ally of player.allies || []) {
      cards.push(ally);
      cards.push(...(ally.attachments || []));
      cards.push(...(ally.cardsUnderneath || []));
    }

    for (const minion of player.engagedMinions || []) {
      cards.push(minion);
      cards.push(...(minion.attachments || []));
      cards.push(...(minion.cardsUnderneath || []));
    }
  }

  // 2. Villain Zones & Attachments
  if (state.villain) {
    cards.push(...(state.villain.attachments || []));
    cards.push(...(state.villain.cardsUnderneath || []));
  }

  // 3. Schemes & Attachments
  if (state.mainScheme) {
    cards.push(...(state.mainScheme.attachments || []));
    cards.push(...(state.mainScheme.cardsUnderneath || []));
  }

  for (const scheme of state.sideSchemes || []) {
    cards.push(scheme);
    cards.push(...(scheme.attachments || []));
    cards.push(...(scheme.cardsUnderneath || []));
  }

  // 4. Encounter Zones & Boosts
  cards.push(...(state.encounterDeck || []));
  cards.push(...(state.encounterDiscard || []));
  cards.push(...(state.victoryDisplay || []));
  cards.push(...(state.removedFromGame || []));

  // 5. Auxiliary Scenario Decks (ADR-0034, e.g. Infinity Gauntlet, Holding Cell, Evidence)
  for (const deck of Object.values(state.auxiliaryDecks || {})) {
    cards.push(...deck);
  }
  for (const discard of Object.values(state.auxiliaryDiscards || {})) {
    cards.push(...discard);
  }

  return cards;
}

/**
 * Asserts the Universal Card Conservation Law (ADR-0040).
 * Throws a descriptive Error if any CardInstance exists in multiple zones or multiple slots.
 */
export function assertCardConservation(state: GameState): void {
  const seenInstanceIds = new Set<string>();

  for (const card of getAllCardInstances(state)) {
    if (!card || !card.instanceId) continue;

    if (seenInstanceIds.has(card.instanceId)) {
      throw new Error(
        `[CRITICAL INVARIANT VIOLATION] Card '${card.card?.name || 'Unknown'}' (${card.instanceId}) exists in multiple zones simultaneously!`,
      );
    }
    seenInstanceIds.add(card.instanceId);
  }
}

/**
 * Atomically removes a card matching instanceId from all zones and containers across GameState.
 */
export function removeCardFromAllZones(
  state: GameState,
  instanceId: string,
): CardInstance | undefined {
  let found: CardInstance | undefined;

  const removeFromList = (list?: CardInstance[]): boolean => {
    if (!list) return false;
    const idx = list.findIndex((c) => c.instanceId === instanceId);
    if (idx !== -1) {
      found = list.splice(idx, 1)[0];
      return true;
    }
    return false;
  };

  // Players
  for (const p of state.players || []) {
    if (removeFromList(p.deck)) return found;
    if (removeFromList(p.hand)) return found;
    if (removeFromList(p.discard)) return found;
    if (removeFromList(p.tableau)) return found;
    if (removeFromList(p.attachments)) return found;
    if (removeFromList(p.cardsUnderneath)) return found;

    for (const a of p.allies || []) {
      if (removeFromList(a.attachments)) return found;
      if (removeFromList(a.cardsUnderneath)) return found;
    }
    if (removeFromList(p.allies)) return found;

    for (const m of p.engagedMinions || []) {
      if (removeFromList(m.attachments)) return found;
      if (removeFromList(m.cardsUnderneath)) return found;
    }
    if (removeFromList(p.engagedMinions)) return found;
  }

  // Villain
  if (state.villain) {
    if (removeFromList(state.villain.attachments)) return found;
    if (removeFromList(state.villain.cardsUnderneath)) return found;
  }

  // Schemes
  if (state.mainScheme) {
    if (removeFromList(state.mainScheme.attachments)) return found;
    if (removeFromList(state.mainScheme.cardsUnderneath)) return found;
  }

  for (const s of state.sideSchemes || []) {
    if (removeFromList(s.attachments)) return found;
    if (removeFromList(s.cardsUnderneath)) return found;
  }
  if (removeFromList(state.sideSchemes)) return found;

  // Encounter & Misc
  if (removeFromList(state.encounterDeck)) return found;
  if (removeFromList(state.encounterDiscard)) return found;
  if (removeFromList(state.victoryDisplay)) return found;
  if (removeFromList(state.removedFromGame)) return found;

  // Auxiliary Scenario Decks (ADR-0034)
  for (const deck of Object.values(state.auxiliaryDecks || {})) {
    if (removeFromList(deck)) return found;
  }
  for (const discard of Object.values(state.auxiliaryDiscards || {})) {
    if (removeFromList(discard)) return found;
  }

  return found;
}

/**
 * Atomically attaches a card instance to a target host entity (ADR-0040).
 */
export function attachCardToHost(
  state: GameState,
  cardInstance: CardInstance,
  targetHostType: string,
  targetHostId?: string,
): void {
  // 1. Remove from all existing zones to ensure spatial uniqueness
  removeCardFromAllZones(state, cardInstance.instanceId);

  // 2. Attach to target host
  const uTarget = targetHostType.toUpperCase();

  if (uTarget === 'VILLAIN') {
    if (!state.villain.attachments) state.villain.attachments = [];
    state.villain.attachments.push(cardInstance);
  } else if (uTarget === 'ENEMY') {
    let minion: CardInstance | undefined;
    if (targetHostId) {
      for (const p of state.players) {
        minion = p.engagedMinions?.find((m) => m.instanceId === targetHostId);
        if (minion) break;
      }
    }
    if (minion) {
      if (!minion.attachments) minion.attachments = [];
      minion.attachments.push(cardInstance);
    } else {
      if (!state.villain.attachments) state.villain.attachments = [];
      state.villain.attachments.push(cardInstance);
    }
  } else if (
    uTarget === 'HERO' ||
    uTarget === 'IDENTITY' ||
    uTarget === 'PLAYER' ||
    uTarget === 'DEFENDING_CHARACTER'
  ) {
    const targetPlayer = state.players.find((p) => p.id === targetHostId) || state.players[0];
    if (targetPlayer) {
      if (!targetPlayer.attachments) targetPlayer.attachments = [];
      targetPlayer.attachments.push(cardInstance);
    }
  } else if (uTarget === 'CHOSEN_ALLY' || uTarget === 'ALLY') {
    let ally: CardInstance | undefined;
    if (targetHostId) {
      for (const p of state.players) {
        ally = p.allies?.find((a) => a.instanceId === targetHostId);
        if (ally) break;
      }
    }
    if (!ally) ally = state.players[0]?.allies?.[0];
    if (ally) {
      if (!ally.attachments) ally.attachments = [];
      ally.attachments.push(cardInstance);
    } else {
      const p = state.players.find((p) => p.id === targetHostId) || state.players[0];
      if (p) {
        if (!p.tableau) p.tableau = [];
        p.tableau.push(cardInstance);
      }
    }
  } else if (uTarget === 'CHOSEN_MINION' || uTarget === 'MINION' || uTarget === 'ALL_MINIONS') {
    let minion: CardInstance | undefined;
    if (targetHostId) {
      for (const p of state.players) {
        minion = p.engagedMinions?.find((m) => m.instanceId === targetHostId);
        if (minion) break;
      }
    }
    if (!minion) {
      for (const p of state.players) {
        if (p.engagedMinions && p.engagedMinions.length > 0) {
          minion = p.engagedMinions[0];
          break;
        }
      }
    }
    if (minion) {
      if (!minion.attachments) minion.attachments = [];
      minion.attachments.push(cardInstance);
    } else {
      const p = state.players.find((p) => p.id === targetHostId) || state.players[0];
      if (p) {
        if (!p.tableau) p.tableau = [];
        p.tableau.push(cardInstance);
      }
    }
  } else if (uTarget === 'CHOSEN_ENGAGED_MINION' || uTarget === 'ENGAGED_MINIONS') {
    const targetPlayer = state.players.find((p) => p.id === targetHostId) || state.players[0];
    const minion = targetPlayer?.engagedMinions?.[0];
    if (minion) {
      if (!minion.attachments) minion.attachments = [];
      minion.attachments.push(cardInstance);
    } else if (targetPlayer) {
      if (!targetPlayer.tableau) targetPlayer.tableau = [];
      targetPlayer.tableau.push(cardInstance);
    }
  } else if (uTarget === 'MAIN_SCHEME' || uTarget === 'SCHEME') {
    if (!state.mainScheme.attachments) state.mainScheme.attachments = [];
    state.mainScheme.attachments.push(cardInstance);
  } else if (uTarget === 'SIDE_SCHEME' || uTarget === 'CHOSEN_SIDE_SCHEME') {
    const scheme =
      state.sideSchemes.find((s) => s.instanceId === targetHostId) || state.sideSchemes[0];
    if (scheme) {
      if (!scheme.attachments) scheme.attachments = [];
      scheme.attachments.push(cardInstance);
    }
  }
}

/**
 * Initializes counters on a card instance when it enters play if it has a 'uses' keyword definition (RR v1.8 p. 30).
 * Populates both generic tokens.counters (for UI badges) and typed counters map (for spendCounters costs).
 */
export function initializeCardUses(cardInstance: CardInstance): void {
  const usesDef = cardInstance.card.enrichment?.uses;
  if (!usesDef || usesDef.count <= 0) return;

  const counterType = usesDef.type || usesDef.counterType || 'all_purpose';

  cardInstance.tokens = {
    ...cardInstance.tokens,
    counters: usesDef.count,
  };

  cardInstance.counters = {
    ...(cardInstance.counters || {}),
    [counterType]: usesDef.count,
  };
}
