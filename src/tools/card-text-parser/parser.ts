import { normalizeCardText } from './normalizer';
import {
  TIMING_PATTERNS,
  TRIGGER_PATTERNS,
  LIMIT_PATTERNS,
  EFFECT_PATTERNS,
  extractCostClause,
} from './patterns';
import { ParseCardResult, TextMatchSpan, UnmatchedFragment, ParsedAbilityResult } from './types';
import {
  CardEnrichment,
  CardAbility,
  CardEnrichmentSchema,
  CardUses,
} from '../../data/supplemental/schema';

/**
 * Parses raw card text into a validated declarative CardEnrichment object.
 */
export function parseCardText(rawText: string, cardCode?: string): ParseCardResult {
  const normalizedText = normalizeCardText(rawText);
  const matchedSpans: TextMatchSpan[] = [];
  const warnings: string[] = [];
  const enrichment: CardEnrichment = {};

  if (!normalizedText.trim()) {
    return {
      cardCode,
      rawText,
      normalizedText,
      enrichment: {
        noSupplementalNeeded: true,
      },
      matchedSpans: [],
      unmatchedFragments: [],
      confidence: 100,
      warnings: [],
    };
  }

  // 1. Check for Uses (X [type] counters)
  const usesMatch = normalizedText.match(/Uses \((\d+) ([a-z]+) counters?\)/i);
  if (usesMatch) {
    const count = parseInt(usesMatch[1], 10);
    const type = usesMatch[2].toLowerCase();
    const discardOnEmpty = /when those are gone, discard this card/i.test(normalizedText);
    const uses: CardUses = {
      count,
      type,
      discardOnEmpty: discardOnEmpty || undefined,
    };
    enrichment.uses = uses;
    matchedSpans.push({
      start: usesMatch.index!,
      end: usesMatch.index! + usesMatch[0].length,
      text: usesMatch[0],
      category: 'uses',
      detail: `count: ${count}, type: ${type}`,
    });

    const reminderMatch = normalizedText.match(
      /\(Enters play with \d+ counters?\. When those are gone, discard this card\.?\)/i,
    );
    if (reminderMatch) {
      matchedSpans.push({
        start: reminderMatch.index!,
        end: reminderMatch.index! + reminderMatch[0].length,
        text: reminderMatch[0],
        category: 'uses',
        detail: 'Uses reminder text',
      });
    }
  }

  // 2. Check for Max X per player
  const maxPlayerMatch = normalizedText.match(/Max (\d+) per player/i);
  if (maxPlayerMatch) {
    const maxVal = parseInt(maxPlayerMatch[1], 10);
    enrichment.maxPerPlayer = maxVal;
    matchedSpans.push({
      start: maxPlayerMatch.index!,
      end: maxPlayerMatch.index! + maxPlayerMatch[0].length,
      text: maxPlayerMatch[0],
      category: 'limit',
      detail: `maxPerPlayer: ${maxVal}`,
    });
  }

  // 3. Split into paragraphs/lines for distinct abilities
  const lines = normalizedText.split('\n');
  const abilities: CardAbility[] = [];

  let abilityIndex = 1;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Skip pure reminder text or Uses line if already handled
    if (/^Uses \(\d+ [a-z]+ counters?\)/i.test(line)) {
      continue;
    }

    const parsedAbility = parseAbilityLine(line);
    if (parsedAbility) {
      // Build CardAbility object
      const abilityId = parsedAbility.name
        ? parsedAbility.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
        : cardCode
          ? `ability_${cardCode}_${abilityIndex}`
          : `ability_${abilityIndex}`;

      const cardAbility: CardAbility = {
        id: abilityId,
        timing: parsedAbility.timing || 'ACTION',
        steps: parsedAbility.steps,
      };

      if (parsedAbility.trigger) {
        cardAbility.trigger = parsedAbility.trigger;
      }
      if (parsedAbility.cost) {
        cardAbility.cost = parsedAbility.cost;
      }
      if (parsedAbility.limit) {
        cardAbility.limit = parsedAbility.limit;
      }
      if (parsedAbility.maxPerRound) {
        cardAbility.maxPerRound = parsedAbility.maxPerRound;
      }
      if (parsedAbility.zone) {
        cardAbility.zone = parsedAbility.zone;
      }

      abilities.push(cardAbility);
      matchedSpans.push(...parsedAbility.matchedSpans);
      abilityIndex++;
    }
  }

  if (abilities.length > 0) {
    enrichment.abilities = abilities;
  }

  // Calculate Unmatched Fragments
  const unmatchedFragments = calculateUnmatchedFragments(normalizedText, matchedSpans);

  // Confidence Calculation
  const totalChars = normalizedText.length;
  const matchedChars = matchedSpans.reduce((sum, s) => sum + s.text.length, 0);
  let confidence =
    totalChars > 0 ? Math.round(Math.min(100, (matchedChars / totalChars) * 100)) : 100;
  if (unmatchedFragments.length === 0) {
    confidence = 100;
  }

  // Schema Validation Check
  try {
    CardEnrichmentSchema.parse(enrichment);
  } catch (err: any) {
    warnings.push(`Zod Schema Validation Error: ${err.message}`);
    confidence = Math.min(confidence, 50);
  }

  return {
    cardCode,
    rawText,
    normalizedText,
    enrichment,
    matchedSpans,
    unmatchedFragments,
    confidence,
    warnings,
  };
}

function parseAbilityLine(line: string): ParsedAbilityResult | null {
  let remaining = line;
  const matchedSpans: TextMatchSpan[] = [];
  let abilityName: string | undefined;

  // 1. Ability Name extraction (e.g. "Scientist — ...")
  const nameMatch = remaining.match(/^([A-Za-z0-9 '’-]+?)\s*(?:[—–]|\s-\s)\s*/);
  if (nameMatch) {
    abilityName = nameMatch[1].trim();
    matchedSpans.push({
      start: 0,
      end: nameMatch[0].length,
      text: nameMatch[0],
      category: 'name',
      detail: abilityName,
    });
    remaining = remaining.substring(nameMatch[0].length);
  }

  // 2. Timing extraction (e.g. "Hero Action: ...", "Interrupt (defense): ...")
  let timing: any;
  let trait: any;

  for (const tp of TIMING_PATTERNS) {
    const m = remaining.match(tp.regex);
    if (m) {
      timing = tp.timing;
      let matchedLen = m[0].length;
      matchedSpans.push({
        start: 0,
        end: matchedLen,
        text: m[0],
        category: 'timing',
        detail: timing,
      });
      remaining = remaining.substring(matchedLen).trim();
      break;
    }
  }

  // 3. Trait extraction (e.g. "(attack)", "(thwart)", "(defense)")
  const traitMatch = remaining.match(/^\((attack|thwart|defense)\):?/i);
  if (traitMatch) {
    trait = traitMatch[1].toLowerCase() as any;
    matchedSpans.push({
      start: 0,
      end: traitMatch[0].length,
      text: traitMatch[0],
      category: 'trait',
      detail: trait,
    });
    remaining = remaining.substring(traitMatch[0].length).trim();
  }

  // Strip leading colon/whitespace after timing/trait
  if (remaining.startsWith(':')) {
    remaining = remaining.substring(1).trim();
  }

  // 4. Check Limits (e.g. "(Limit once per round.)")
  let limit: any;
  let maxPerRound: number | undefined;

  for (const lp of LIMIT_PATTERNS) {
    const m = remaining.match(lp.regex);
    if (m) {
      limit = lp.limit;
      maxPerRound = lp.maxPerRound;
      matchedSpans.push({
        start: 0,
        end: m[0].length,
        text: m[0],
        category: 'limit',
        detail: limit,
      });
      remaining = remaining.replace(lp.regex, '').trim();
      break;
    }
  }

  // 5. Trigger extraction
  let trigger: any;
  for (const trp of TRIGGER_PATTERNS) {
    const m = remaining.match(trp.regex);
    if (m) {
      trigger = trp.trigger;
      matchedSpans.push({
        start: m.index || 0,
        end: (m.index || 0) + m[0].length,
        text: m[0],
        category: 'trigger',
        detail: trigger,
      });
      break;
    }
  }

  // 6. Cost arrow splitting (e.g. "Exhaust Focused Rage and take 1 damage → draw 1 card")
  let cost: any;
  let effectPart = remaining;

  if (remaining.includes('→')) {
    const parts = remaining.split('→');
    const costText = parts[0].trim();
    effectPart = parts.slice(1).join('→').trim();

    cost = extractCostClause(costText);
    if (cost) {
      matchedSpans.push({
        start: 0,
        end: costText.length,
        text: costText,
        category: 'cost',
        detail: JSON.stringify(cost),
      });
    }
  }

  // 7. Extract Effect Steps from effectPart
  const steps: any[] = [];
  for (const ep of EFFECT_PATTERNS) {
    const m = effectPart.match(ep.regex);
    if (m) {
      const generatedSteps = ep.handler(m);
      steps.push(...generatedSteps);
      matchedSpans.push({
        start: m.index || 0,
        end: (m.index || 0) + m[0].length,
        text: m[0],
        category: 'effect',
        detail: generatedSteps.map((s) => s.effect).join(', '),
      });
    }
  }

  // If no steps matched but timing was found, return fallback step or empty
  if (steps.length === 0) {
    if (!timing) {
      return null;
    }
    // Unknown effect primitive
    steps.push({
      effect: 'MODIFY_STAT', // Safe fallback placeholder
      params: { unparsed: effectPart },
    });
  }

  // Infer zone: if timing is interrupt/response and trigger is TAKE_ATTACK_DAMAGE / WHEN_REVEALED on event
  let zone: any;
  if (timing === 'INTERRUPT' || timing === 'HERO_INTERRUPT') {
    if (trigger === 'TAKE_ATTACK_DAMAGE' || trigger === 'WHEN_REVEALED') {
      zone = 'HAND';
      if (!cost) {
        cost = { discardSelf: true };
      }
    }
  }

  return {
    rawAbilityText: line,
    name: abilityName,
    timing,
    trait,
    trigger,
    cost,
    limit,
    maxPerRound,
    zone,
    steps,
    matchedSpans,
  };
}

function calculateUnmatchedFragments(
  normalizedText: string,
  spans: TextMatchSpan[],
): UnmatchedFragment[] {
  const fragments: UnmatchedFragment[] = [];
  const lines = normalizedText.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let lineRemaining = trimmed;

    for (const span of spans) {
      if (lineRemaining.includes(span.text)) {
        lineRemaining = lineRemaining.replace(span.text, ' ').trim();
      }
    }

    // Strip standalone punctuation and arrows
    lineRemaining = lineRemaining
      .replace(/[:.,—–-]/g, ' ')
      .replace(/→/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (lineRemaining.length > 3) {
      fragments.push({
        start: 0,
        end: lineRemaining.length,
        text: lineRemaining,
      });
    }
  }

  return fragments;
}
