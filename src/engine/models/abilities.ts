import type { z } from 'zod';
import type {
  AttachTo,
  CardUses,
  EffectType,
  PlayRequirements,
  StepGate,
  StepFacts,
  TimingTypeSchema,
  TriggerFilter,
  TriggerTypeSchema,
  AbilityCost,
} from '../../data/supplemental/schema';
export type {
  StepGate,
  StepFacts,
  DynamicValueSource,
  DrawCardsLimit,
  DrawCardsParams,
  TriggerFilter,
} from '../../data/supplemental/schema';

export type AbilityTiming = z.infer<typeof TimingTypeSchema>;
export type TriggerType = z.infer<typeof TriggerTypeSchema>;
export type { EffectType, AbilityCost } from '../../data/supplemental/schema';

export interface StepResolutionResult {
  success: boolean;
  mutatedState: boolean;
  value?: number;
  selectedCardInstanceIds?: string[];
  targetId?: string;
  skipped?: boolean;
  facts?: StepFacts;
  discardedCards?: import('./state').CardInstance[];
}

export interface SequenceExecutionContext {
  previousResult?: StepResolutionResult;
  collectedCardInstanceIds?: string[];
  initiatingPlayerId?: string;
  sourceInstanceId?: string;
  resourcesSpent?: string[];
}

export interface AbilityStep {
  id?: string;
  effect: EffectType;
  gateParams?: Record<string, unknown>;
  effectParams?: Record<string, unknown>;
  gate?: StepGate;
  /** "This effect cannot be canceled": still resolves when the card's reveal is cancelled. */
  cannotBeCanceled?: boolean;
}

export interface CardAbility {
  id: string;
  timing: AbilityTiming;
  trigger?: TriggerType;
  triggerFilter?: TriggerFilter;
  zone?: 'HAND' | 'PLAY' | 'DISCARD';
  limit?: 'ONCE_PER_ROUND' | 'ONCE_PER_PHASE';
  /**
   * Printed labels "(attack)", "(thwart)", "(defense)". An ability labelled `ATTACK` is an attack
   * made by the resolving player's identity (RR v1.8 glossary L). `THWART` and `DEFENSE` are
   * declared but not yet read by the engine.
   */
  labels?: ('ATTACK' | 'THWART' | 'DEFENSE')[];
  tags?: string[];
  cost?: AbilityCost;
  /** The whole step list resolves once per player in player order ("each player ... that player"). */
  forEachPlayer?: boolean;
  steps: AbilityStep[];
}

export type { CardUses as CardUsesDefinition } from '../../data/supplemental/schema';

export interface CardAuditMetadata {
  createdAt?: string;
  updatedAt: string;
  reviewedAt: string;
  reviewedBy?: string;
  rulesVersion?: string;
  confidence?: number;
  originalText?: string;
  ambiguityFile?: string;
  comment?: string;
}

/**
 * Who receives an obligation when it is revealed from the encounter deck (Issue #158).
 * Absent = default: owner of the card's hero set when it belongs to one, else the revealing player.
 */
export type PlayerRecipient =
  | { type: 'FIRST_PLAYER' }
  | { type: 'REVEALING_PLAYER' }
  | { type: 'CARD_SET_OWNER' }
  | { type: 'IDENTITY'; codes: string[] };

export interface CardEnrichment {
  noSupplementalNeeded?: boolean;
  cardName?: string;
  playRequirements?: PlayRequirements;
  audit?: CardAuditMetadata;
  /** Optional obligation recipient override (outside the abilities); absent = engine default */
  recipient?: PlayerRecipient;
  /** Encounter attachment host and fallback (#209); absent = the active villain */
  attachTo?: AttachTo;
  playUnderAnyPlayerControl?: boolean;
  uses?: CardUses;
  abilities?: CardAbility[];
}
