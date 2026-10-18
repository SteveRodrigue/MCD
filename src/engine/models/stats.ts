export interface CardUsageStats {
  played: number;
  abilitiesUsed: Record<string, number>; // abilityId -> count
  basicActions?: {
    attack?: number;
    thwart?: number;
    defense?: number;
    recover?: number;
    scheme?: number;
    changeForm?: number;
  };
}

export interface BasicActionSummary {
  heroAttack: number;
  heroThwart: number;
  heroDefense: number;
  alterEgoRecover: number;
  changeForm: number;
  allyAttack: number;
  allyThwart: number;
  villainAttack: number;
  villainScheme: number;
  minionAttack: number;
  minionScheme: number;
}

export interface GameStats {
  cards: Record<string, CardUsageStats>; // cardCode -> stats
  basicActions: BasicActionSummary;
  totalActionsExecuted: number;
}

export interface AllTimeStats {
  gamesPlayed: number;
  cards: Record<string, CardUsageStats>;
  basicActions: BasicActionSummary;
}

/** Per-game and all-time stats deltas pushed to all-time storage (#315). */
export interface StatsDelta {
  cards?: Record<string, Partial<CardUsageStats>>;
  basicActions?: Partial<BasicActionSummary>;
  gameCompleted?: boolean;
}

/** Stats reset request: one card or everything. */
export type StatsResetRequest = { cardCode: string } | { all: true };

function createInitialBasicActionSummary(): BasicActionSummary {
  return {
    heroAttack: 0,
    heroThwart: 0,
    heroDefense: 0,
    alterEgoRecover: 0,
    changeForm: 0,
    allyAttack: 0,
    allyThwart: 0,
    villainAttack: 0,
    villainScheme: 0,
    minionAttack: 0,
    minionScheme: 0,
  };
}

export function createInitialCardStats(): CardUsageStats {
  return {
    played: 0,
    abilitiesUsed: {},
    basicActions: { attack: 0, thwart: 0, defense: 0, recover: 0, scheme: 0, changeForm: 0 },
  };
}

export function createInitialGameStats(): GameStats {
  return { cards: {}, basicActions: createInitialBasicActionSummary(), totalActionsExecuted: 0 };
}

export function createInitialAllTimeStats(): AllTimeStats {
  return { gamesPlayed: 0, cards: {}, basicActions: createInitialBasicActionSummary() };
}

function addCounts<K extends string>(
  target: Partial<Record<K, number>>,
  delta: Partial<Record<K, number>>,
): void {
  for (const [key, count] of Object.entries(delta) as [K, number | undefined][]) {
    target[key] = (target[key] || 0) + (Number(count) || 0);
  }
}

/** Adds a stats delta into all-time stats in place, and returns them. */
export function mergeDeltaIntoAllTime(allTime: AllTimeStats, delta: StatsDelta): AllTimeStats {
  if (delta.gameCompleted) allTime.gamesPlayed = (allTime.gamesPlayed || 0) + 1;
  allTime.cards ??= {};
  for (const [cardCode, cardDelta] of Object.entries(delta.cards || {})) {
    const card = (allTime.cards[cardCode] ??= createInitialCardStats());
    card.played = (card.played || 0) + (Number(cardDelta.played) || 0);
    addCounts((card.abilitiesUsed ??= {}), cardDelta.abilitiesUsed || {});
    addCounts((card.basicActions ??= {}), cardDelta.basicActions || {});
  }
  addCounts((allTime.basicActions ??= createInitialBasicActionSummary()), delta.basicActions || {});
  return allTime;
}

/** Applies a stats reset request; a full reset returns fresh stats. */
export function applyStatsReset(allTime: AllTimeStats, request: StatsResetRequest): AllTimeStats {
  if ('all' in request) return createInitialAllTimeStats();
  if (allTime.cards) delete allTime.cards[request.cardCode];
  return allTime;
}
