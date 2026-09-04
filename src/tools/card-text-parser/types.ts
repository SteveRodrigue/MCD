import {
  CardEnrichment,
  CardAbility,
  TimingTypeSchema,
  TriggerTypeSchema,
} from '../../data/supplemental/schema';
import { z } from 'zod';

export type TimingType = z.infer<typeof TimingTypeSchema>;
export type TriggerType = z.infer<typeof TriggerTypeSchema>;

export interface TextMatchSpan {
  start: number;
  end: number;
  text: string;
  category:
    'name' | 'timing' | 'trait' | 'trigger' | 'cost' | 'limit' | 'effect' | 'uses' | 'passive';
  detail?: string;
}

export interface UnmatchedFragment {
  start: number;
  end: number;
  text: string;
}

export interface ParsedAbilityResult {
  rawAbilityText: string;
  name?: string;
  timing?: TimingType;
  trait?: 'attack' | 'thwart' | 'defense';
  trigger?: TriggerType;
  cost?: CardAbility['cost'];
  limit?: CardAbility['limit'];
  maxPerRound?: number;
  zone?: CardAbility['zone'];
  steps: CardAbility['steps'];
  matchedSpans: TextMatchSpan[];
}

export interface ParseCardResult {
  cardCode?: string;
  rawText: string;
  normalizedText: string;
  enrichment: CardEnrichment;
  matchedSpans: TextMatchSpan[];
  unmatchedFragments: UnmatchedFragment[];
  confidence: number; // 0 to 100
  warnings: string[];
}
