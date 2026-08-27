export type ActionType =
  | 'CHANGE_FORM'
  | 'BASIC_RECOVER'
  | 'BASIC_ATTACK'
  | 'BASIC_THWART'
  | 'ALLY_ATTACK'
  | 'ALLY_THWART'
  | 'PLAY_CARD'
  | 'USE_CARD_ABILITY'
  | 'END_PLAYER_TURN';

export interface ChangeFormAction {
  type: 'CHANGE_FORM';
  playerId: string;
  targetFormCode?: string; // Optional if only 2 forms exist
}

export interface BasicRecoverAction {
  type: 'BASIC_RECOVER';
  playerId: string;
}

export interface BasicAttackAction {
  type: 'BASIC_ATTACK';
  playerId: string;
  targetType: 'villain' | 'minion';
  targetInstanceId?: string; // Required if target is minion
}

export interface BasicThwartAction {
  type: 'BASIC_THWART';
  playerId: string;
  targetType: 'main_scheme' | 'side_scheme';
  targetInstanceId?: string; // Required if target is side scheme
}

export interface AllyAttackAction {
  type: 'ALLY_ATTACK';
  playerId: string;
  allyInstanceId: string;
  targetType: 'villain' | 'minion';
  targetInstanceId?: string;
}

export interface AllyThwartAction {
  type: 'ALLY_THWART';
  playerId: string;
  allyInstanceId: string;
  targetType: 'main_scheme' | 'side_scheme';
  targetInstanceId?: string;
}

export interface PaymentResource {
  cardInstanceId: string;
}

export interface PlayCardAction {
  type: 'PLAY_CARD';
  playerId: string;
  cardInstanceId: string;
  paymentCardInstanceIds: string[]; // Hand cards to discard for resources
  targetInstanceId?: string; // For targeted events or attachments
}

export interface UseCardAbilityAction {
  type: 'USE_CARD_ABILITY';
  playerId: string;
  cardInstanceId: string;
  abilityId: string;
  targetInstanceId?: string;
}

export interface EndPlayerTurnAction {
  type: 'END_PLAYER_TURN';
  playerId: string;
}

export type GameAction =
  | ChangeFormAction
  | BasicRecoverAction
  | BasicAttackAction
  | BasicThwartAction
  | AllyAttackAction
  | AllyThwartAction
  | PlayCardAction
  | UseCardAbilityAction
  | EndPlayerTurnAction;

export interface ActionResult {
  success: boolean;
  error?: string;
  onomatopoeia?: string; // e.g. "POW!", "BAM!", "FOILED!", "THWIP!"
}
