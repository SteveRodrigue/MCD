import { GameState } from '../models/state';
import { CardUsageStats, createInitialCardStats, createInitialGameStats } from '../models/stats';

export type BasicActionType =
  | 'heroAttack'
  | 'heroThwart'
  | 'heroDefense'
  | 'alterEgoRecover'
  | 'changeForm'
  | 'allyAttack'
  | 'allyThwart'
  | 'villainAttack'
  | 'villainScheme'
  | 'minionAttack'
  | 'minionScheme';

/**
 * Ensures state.stats is initialized.
 */
export function ensureStats(state: GameState) {
  if (!state.stats) {
    state.stats = createInitialGameStats();
  }
  return state.stats;
}

/**
 * Ensures stats for a specific cardCode are initialized.
 */
export function ensureCardStats(state: GameState, cardCode: string): CardUsageStats {
  const stats = ensureStats(state);
  const card = (stats.cards[cardCode] ??= createInitialCardStats());
  card.abilitiesUsed ??= {};
  card.basicActions ??= createInitialCardStats().basicActions;
  return card;
}

/**
 * Records a card being played (player card) or revealed/entering play (encounter card).
 */
export function recordCardPlay(state: GameState, cardCode: string): void {
  if (!cardCode) return;
  const cardStats = ensureCardStats(state, cardCode);
  cardStats.played = (cardStats.played || 0) + 1;
  state.stats!.totalActionsExecuted = (state.stats!.totalActionsExecuted || 0) + 1;
}

/**
 * Records an ability execution on a card.
 */
export function recordAbilityUsage(state: GameState, cardCode: string, abilityId: string): void {
  if (!cardCode || !abilityId) return;
  const cardStats = ensureCardStats(state, cardCode);
  cardStats.abilitiesUsed[abilityId] = (cardStats.abilitiesUsed[abilityId] || 0) + 1;
  state.stats!.totalActionsExecuted = (state.stats!.totalActionsExecuted || 0) + 1;
}

/**
 * Records a basic action execution (Hero, Alter-Ego, Ally, Villain, Minion).
 */
export function recordBasicAction(
  state: GameState,
  actionType: BasicActionType,
  cardCode?: string,
): void {
  const stats = ensureStats(state);
  stats.basicActions[actionType] = (stats.basicActions[actionType] || 0) + 1;
  stats.totalActionsExecuted = (stats.totalActionsExecuted || 0) + 1;

  if (cardCode) {
    const cardStats = ensureCardStats(state, cardCode);
    const ba = cardStats.basicActions!;
    switch (actionType) {
      case 'heroAttack':
      case 'allyAttack':
        ba.attack = (ba.attack || 0) + 1;
        break;
      case 'heroThwart':
      case 'allyThwart':
        ba.thwart = (ba.thwart || 0) + 1;
        break;
      case 'heroDefense':
        ba.defense = (ba.defense || 0) + 1;
        break;
      case 'alterEgoRecover':
        ba.recover = (ba.recover || 0) + 1;
        break;
      case 'changeForm':
        ba.changeForm = (ba.changeForm || 0) + 1;
        break;
      case 'villainAttack':
      case 'minionAttack':
        ba.attack = (ba.attack || 0) + 1;
        break;
      case 'villainScheme':
      case 'minionScheme':
        ba.scheme = (ba.scheme || 0) + 1;
        break;
    }
  }
}
