export type ActionType =
  | 'RESOLVE_MULLIGAN'
  | 'CHANGE_FORM'
  | 'BASIC_RECOVER'
  | 'BASIC_ATTACK'
  | 'BASIC_THWART'
  | 'ALLY_ATTACK'
  | 'ALLY_THWART'
  | 'PLAY_CARD'
  | 'USE_CARD_ABILITY'
  | 'SPEND_RESOURCES_TO_DISCARD_ATTACHMENT'
  | 'RESOLVE_DECISION_PROMPT'
  | 'DECLARE_DEFENDER'
  | 'END_PLAYER_TURN'
  | 'DEV_ADD_CARD_TO_HAND'
  | 'MINION_ENGAGES_PLAYER'
  | 'REVEAL_ENCOUNTER_CARD';

export interface ResolveMulliganAction {
  type: 'RESOLVE_MULLIGAN';
  playerId: string;
  discardCardInstanceIds: string[]; // Cards from initial hand to discard & replace (0 to 6)
}

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
  generatorInstanceIds?: string[];  // In-play cards to exhaust or remove counters from (e.g. Web-Shooter, Helicarrier)
  targetInstanceId?: string;        // For targeted events or attachments
}

export interface UseCardAbilityAction {
  type: 'USE_CARD_ABILITY';
  playerId: string;
  cardInstanceId: string;
  abilityId: string;
  targetInstanceId?: string;
}

export interface SpendResourcesToDiscardAttachmentAction {
  type: 'SPEND_RESOURCES_TO_DISCARD_ATTACHMENT';
  playerId: string;
  attachmentInstanceId: string;
  paymentCardInstanceIds?: string[];
}

export interface ResolveDecisionPromptAction {
  type: 'RESOLVE_DECISION_PROMPT';
  playerId: string;
  selectedOptionId: string;
}

export interface DeclareDefenderAction {
  type: 'DECLARE_DEFENDER';
  playerId: string;
  defenderType: 'HERO' | 'ALLY' | 'UNDEFENDED';
  allyInstanceId?: string;
}

export interface EndPlayerTurnAction {
  type: 'END_PLAYER_TURN';
  playerId: string;
}

export interface DevAddCardToHandAction {
  type: 'DEV_ADD_CARD_TO_HAND';
  playerId: string;
  cardInstanceId: string;
}

export interface MinionEngagesPlayerAction {
  type: 'MINION_ENGAGES_PLAYER';
  playerId: string;
  minionInstance: any;
}

export interface RevealEncounterCardAction {
  type: 'REVEAL_ENCOUNTER_CARD';
  playerId?: string;
  targetPlayerId?: string;
  encounterCard: any;
}

export type GameAction =
  | ResolveMulliganAction
  | ChangeFormAction
  | BasicRecoverAction
  | BasicAttackAction
  | BasicThwartAction
  | AllyAttackAction
  | AllyThwartAction
  | PlayCardAction
  | UseCardAbilityAction
  | SpendResourcesToDiscardAttachmentAction
  | ResolveDecisionPromptAction
  | DeclareDefenderAction
  | EndPlayerTurnAction
  | DevAddCardToHandAction
  | MinionEngagesPlayerAction
  | RevealEncounterCardAction;

export interface ActionResult {
  success: boolean;
  error?: string;
  onomatopoeia?: string; // e.g. "POW!", "BAM!", "FOILED!", "THWIP!"
}
