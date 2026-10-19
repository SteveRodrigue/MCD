import {
  GameState,
  CardInstance,
  VillainState,
  getActiveVillain,
  getActiveMainScheme,
  getVillainById,
  getVillainsInPlay,
  getMainSchemesInPlay,
} from '../models';

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
    cards.push(...(player.obligations || []));

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
  for (const villain of getVillainsInPlay(state)) {
    cards.push(...(villain.attachments || []));
    cards.push(...(villain.cardsUnderneath || []));
  }

  // 3. Schemes & Attachments
  for (const mainScheme of getMainSchemesInPlay(state)) {
    cards.push(...(mainScheme.attachments || []));
    cards.push(...(mainScheme.cardsUnderneath || []));
  }

  for (const scheme of state.sideSchemes || []) {
    cards.push(scheme);
    cards.push(...(scheme.attachments || []));
    cards.push(...(scheme.cardsUnderneath || []));
  }

  // Environments (e.g. Ultron Drones)
  cards.push(...(state.environments || []));

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
    if (removeFromList(p.obligations)) return found;

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
  for (const villain of getVillainsInPlay(state)) {
    if (removeFromList(villain.attachments)) return found;
    if (removeFromList(villain.cardsUnderneath)) return found;
  }

  // Schemes
  for (const mainScheme of getMainSchemesInPlay(state)) {
    if (removeFromList(mainScheme.attachments)) return found;
    if (removeFromList(mainScheme.cardsUnderneath)) return found;
  }

  for (const s of state.sideSchemes || []) {
    if (removeFromList(s.attachments)) return found;
    if (removeFromList(s.cardsUnderneath)) return found;
  }
  if (removeFromList(state.sideSchemes)) return found;
  if (removeFromList(state.environments)) return found;

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
 * The villain an attachment goes on: the one named by `targetHostId` when it is in play,
 * else the active villain.
 */
function resolveVillainHost(state: GameState, targetHostId?: string): VillainState {
  return (
    (targetHostId ? getVillainById(state, targetHostId) : undefined) ?? getActiveVillain(state)
  );
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
    const host = resolveVillainHost(state, targetHostId);
    if (!host.attachments) host.attachments = [];
    host.attachments.push(cardInstance);
    cardInstance.hostInstanceId = host.instanceId || 'villain';
  } else if (uTarget === 'ENEMY' || uTarget === 'CHOSEN_ENEMY') {
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
      cardInstance.hostInstanceId = minion.instanceId;
    } else {
      const host = resolveVillainHost(state, targetHostId);
      if (!host.attachments) host.attachments = [];
      host.attachments.push(cardInstance);
      cardInstance.hostInstanceId = host.instanceId || 'villain';
    }
  } else if (
    uTarget === 'HERO' ||
    uTarget === 'IDENTITY' ||
    uTarget === 'PLAYER' ||
    uTarget === 'DEFENDING_CHARACTER' ||
    uTarget === 'SELF_IDENTITY' ||
    uTarget === 'CHOSEN_PLAYER' ||
    uTarget === 'ACTIVE_PLAYER'
  ) {
    const targetPlayer = state.players.find((p) => p.id === targetHostId) || state.players[0];
    if (targetPlayer) {
      if (!targetPlayer.attachments) targetPlayer.attachments = [];
      targetPlayer.attachments.push(cardInstance);
      cardInstance.hostInstanceId = targetPlayer.id;
    }
  } else if (uTarget === 'CHOSEN_ALLY' || uTarget === 'ALLY') {
    let ally: CardInstance | undefined;
    if (targetHostId) {
      for (const p of state.players) {
        ally = p.allies?.find((a) => a.instanceId === targetHostId);
        if (ally) break;
      }
    }
    if (!ally) {
      for (const p of state.players) {
        if (p.allies && p.allies.length > 0) {
          ally = p.allies[0];
          break;
        }
      }
    }
    if (ally) {
      if (!ally.attachments) ally.attachments = [];
      ally.attachments.push(cardInstance);
      cardInstance.hostInstanceId = ally.instanceId;
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
      cardInstance.hostInstanceId = minion.instanceId;
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
    const mainScheme = getActiveMainScheme(state);
    if (!mainScheme.attachments) mainScheme.attachments = [];
    mainScheme.attachments.push(cardInstance);
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

  const counterType = usesDef.counterType || 'all_purpose';

  cardInstance.tokens = {
    ...cardInstance.tokens,
    counters: usesDef.count,
  };

  cardInstance.counters = {
    ...(cardInstance.counters || {}),
    [counterType]: usesDef.count,
  };
}

/**
 * Scans all in-play zones for a card instance by instanceId or card code (ADR-0055).
 * Searches player tableaus, allies, identity attachments, ally attachments,
 * minion attachments, villain attachments, and scheme attachments.
 */
export function findInPlayCardInstance(
  state: GameState,
  instanceId: string,
): CardInstance | undefined {
  for (const p of state.players || []) {
    const fromTableau = p.tableau.find(
      (c) => c.instanceId === instanceId || c.card.code === instanceId,
    );
    if (fromTableau) return fromTableau;

    const fromAllies = p.allies.find(
      (c) => c.instanceId === instanceId || c.card.code === instanceId,
    );
    if (fromAllies) return fromAllies;

    const fromMinions = p.engagedMinions?.find(
      (c) => c.instanceId === instanceId || c.card.code === instanceId,
    );
    if (fromMinions) return fromMinions;

    const fromObligations = p.obligations?.find(
      (c) => c.instanceId === instanceId || c.card.code === instanceId,
    );
    if (fromObligations) return fromObligations;

    const fromAttachments = p.attachments?.find(
      (c) => c.instanceId === instanceId || c.card.code === instanceId,
    );
    if (fromAttachments) return fromAttachments;

    for (const a of p.allies || []) {
      const fromAllyAtt = a.attachments?.find(
        (c) => c.instanceId === instanceId || c.card.code === instanceId,
      );
      if (fromAllyAtt) return fromAllyAtt;
    }

    for (const m of p.engagedMinions || []) {
      const fromMinionAtt = m.attachments?.find(
        (c) => c.instanceId === instanceId || c.card.code === instanceId,
      );
      if (fromMinionAtt) return fromMinionAtt;
    }
  }

  for (const villain of getVillainsInPlay(state)) {
    const fromVillainAtt = villain.attachments?.find(
      (c) => c.instanceId === instanceId || c.card.code === instanceId,
    );
    if (fromVillainAtt) return fromVillainAtt;
  }

  for (const mainScheme of getMainSchemesInPlay(state)) {
    const fromMainSchemeAtt = mainScheme.attachments?.find(
      (c) => c.instanceId === instanceId || c.card.code === instanceId,
    );
    if (fromMainSchemeAtt) return fromMainSchemeAtt;
  }

  for (const s of state.sideSchemes || []) {
    if (s.instanceId === instanceId || s.card.code === instanceId) return s;
    const fromSideSchemeAtt = s.attachments?.find(
      (c) => c.instanceId === instanceId || c.card.code === instanceId,
    );
    if (fromSideSchemeAtt) return fromSideSchemeAtt;
  }

  for (const env of state.environments || []) {
    if (env.instanceId === instanceId || env.card.code === instanceId) return env;
    const fromEnvAtt = env.attachments?.find(
      (c) => c.instanceId === instanceId || c.card.code === instanceId,
    );
    if (fromEnvAtt) return fromEnvAtt;
  }

  return undefined;
}

/**
 * Asserts full GameState invariants across the engine:
 * 1. Universal Card Conservation Law (ADR-0040): No card instance exists in multiple zones simultaneously.
 * 2. Attachment & Host Integrity: Every attachment in play on a villain, scheme, player, ally, or minion
 *    has an active host entity, and cards in non-play zones do not retain attachments.
 * 3. Non-Negative Value Invariants: Active player health >= 0, active villain health >= 0,
 *    main/side scheme threat >= 0, and card tokens (damage, threat, counters) >= 0.
 * 4. Valid Win/Loss State: HEROES win only when all villain stages are defeated; VILLAIN wins
 *    only when main scheme reaches target threat or all heroes are eliminated; active games have no winner set.
 */
export function assertGameStateInvariants(state: GameState): void {
  // 1. Universal Card Conservation Law (ADR-0040)
  assertCardConservation(state);

  // 2. Attachment & Host Integrity
  const activeHostIds = new Set<string>();
  activeHostIds.add('villain');
  activeHostIds.add('mainScheme');

  for (const villain of getVillainsInPlay(state)) {
    if (villain.instanceId) activeHostIds.add(villain.instanceId);
  }
  for (const scheme of getMainSchemesInPlay(state)) {
    if (scheme.instanceId) activeHostIds.add(scheme.instanceId);
  }
  for (const scheme of state.sideSchemes || []) {
    if (scheme.instanceId) activeHostIds.add(scheme.instanceId);
  }
  for (const player of state.players || []) {
    activeHostIds.add(player.id);
    for (const ally of player.allies || []) {
      if (ally.instanceId) activeHostIds.add(ally.instanceId);
    }
    for (const minion of player.engagedMinions || []) {
      if (minion.instanceId) activeHostIds.add(minion.instanceId);
    }
  }

  const verifyAttachmentHost = (
    attachments: CardInstance[] | undefined,
    hostLabel: string,
    hostId?: string,
  ) => {
    for (const att of attachments || []) {
      const explicitHostId = att.hostInstanceId;
      if (explicitHostId && !activeHostIds.has(explicitHostId)) {
        throw new Error(
          `[INVARIANT VIOLATION] Attachment '${att.card?.name || att.instanceId}' on ${hostLabel} (${hostId || 'unknown'}) references missing host '${explicitHostId}'.`,
        );
      }
    }
  };

  for (const villain of getVillainsInPlay(state)) {
    verifyAttachmentHost(villain.attachments, 'villain', villain.instanceId);
  }
  for (const scheme of getMainSchemesInPlay(state)) {
    verifyAttachmentHost(scheme.attachments, 'mainScheme', scheme.instanceId);
  }
  for (const scheme of state.sideSchemes || []) {
    verifyAttachmentHost(scheme.attachments, 'sideScheme', scheme.instanceId);
  }
  for (const player of state.players || []) {
    verifyAttachmentHost(player.attachments, 'player', player.id);
    for (const ally of player.allies || []) {
      verifyAttachmentHost(ally.attachments, 'ally', ally.instanceId);
    }
    for (const minion of player.engagedMinions || []) {
      verifyAttachmentHost(minion.attachments, 'minion', minion.instanceId);
    }
  }

  // Cards in non-play zones (discard, deck, hand, victoryDisplay, removedFromGame) must not have attachments
  const verifyNoAttachmentsInZone = (cards: CardInstance[] | undefined, zoneName: string) => {
    for (const card of cards || []) {
      if (card.attachments && card.attachments.length > 0) {
        throw new Error(
          `[INVARIANT VIOLATION] Card '${card.card?.name || card.instanceId}' in zone '${zoneName}' has ${card.attachments.length} attachment(s). Attachments cannot exist on cards out of play.`,
        );
      }
    }
  };

  verifyNoAttachmentsInZone(state.encounterDeck, 'encounterDeck');
  verifyNoAttachmentsInZone(state.encounterDiscard, 'encounterDiscard');
  verifyNoAttachmentsInZone(state.victoryDisplay, 'victoryDisplay');
  verifyNoAttachmentsInZone(state.removedFromGame, 'removedFromGame');
  for (const player of state.players || []) {
    verifyNoAttachmentsInZone(player.hand, `player ${player.id} hand`);
    verifyNoAttachmentsInZone(player.deck, `player ${player.id} deck`);
    verifyNoAttachmentsInZone(player.discard, `player ${player.id} discard`);
  }

  // 3. Non-Negative Value Invariants
  for (const player of state.players || []) {
    if (player.health < 0) {
      throw new Error(
        `[INVARIANT VIOLATION] Active player '${player.id}' has negative health: ${player.health}`,
      );
    }
  }

  for (const villain of getVillainsInPlay(state)) {
    if (villain.health < 0) {
      throw new Error(
        `[INVARIANT VIOLATION] Active villain '${villain.instanceId || 'villain'}' has negative health: ${villain.health}`,
      );
    }
  }

  for (const mainScheme of getMainSchemesInPlay(state)) {
    if (mainScheme.threat < 0) {
      throw new Error(
        `[INVARIANT VIOLATION] Main scheme '${mainScheme.instanceId || 'mainScheme'}' has negative threat: ${mainScheme.threat}`,
      );
    }
  }

  for (const sideScheme of state.sideSchemes || []) {
    const threat = sideScheme.threat ?? 0;
    if (threat < 0) {
      throw new Error(
        `[INVARIANT VIOLATION] Side scheme '${sideScheme.card?.name || sideScheme.instanceId}' has negative threat: ${threat}`,
      );
    }
  }

  for (const card of getAllCardInstances(state)) {
    if (card.tokens) {
      for (const [tokenKey, tokenVal] of Object.entries(card.tokens)) {
        if (typeof tokenVal === 'number' && tokenVal < 0) {
          throw new Error(
            `[INVARIANT VIOLATION] Card '${card.card?.name || card.instanceId}' has negative token '${tokenKey}': ${tokenVal}`,
          );
        }
      }
    }
    if (card.counters) {
      for (const [counterKey, count] of Object.entries(card.counters)) {
        if (typeof count === 'number' && count < 0) {
          throw new Error(
            `[INVARIANT VIOLATION] Card '${card.card?.name || card.instanceId}' has negative counter '${counterKey}': ${count}`,
          );
        }
      }
    }
  }

  // 4. Valid Win/Loss State
  if (state.winner === 'HEROES') {
    const villains = getVillainsInPlay(state);
    const anyVillainAlive = villains.some((v) => v.health > 0);
    if (anyVillainAlive) {
      throw new Error(
        `[INVARIANT VIOLATION] Game marked as won by HEROES, but villain has health > 0.`,
      );
    }
  } else if (state.winner === 'VILLAIN') {
    const mainSchemes = state.mainSchemes || [];
    const mainSchemeCompleted = mainSchemes.some(
      (ms) => (ms.targetThreat || 0) > 0 && ms.threat >= ms.targetThreat,
    );
    const allHeroesEliminated = (state.players?.length || 0) === 0;

    if (!mainSchemeCompleted && !allHeroesEliminated) {
      throw new Error(
        `[INVARIANT VIOLATION] Game marked as won by VILLAIN, but neither main scheme reached target threat nor were all heroes eliminated.`,
      );
    }
  } else if (state.winner) {
    throw new Error(
      `[INVARIANT VIOLATION] Unknown winner '${state.winner}'. Must be 'HEROES', 'VILLAIN', or null.`,
    );
  }
}
