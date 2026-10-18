import {
  CardInstance,
  NormalizedCard,
  Keyword,
  StatusCard,
  hasKeyword,
  isSharedCardDefinition,
  registerSharedCardDefinition,
} from '@engine/models';

let instanceCounter = 0;

const emptyEnrichmentDefinitions = new WeakMap<NormalizedCard, NormalizedCard>();

/**
 * A card without supplemental data plays with an empty enrichment. Each such card gets one copy,
 * shared by all its instances like the catalog definition it comes from (AUD-20261017-232534 F005).
 */
function withEmptyEnrichment(card: NormalizedCard): NormalizedCard {
  let definition = emptyEnrichmentDefinitions.get(card);
  if (!definition) {
    definition = { ...card, enrichment: { abilities: [] } };
    emptyEnrichmentDefinitions.set(card, definition);
    if (isSharedCardDefinition(card)) registerSharedCardDefinition(definition);
  }
  return definition;
}

export function resetInstanceCounter(): void {
  instanceCounter = 0;
}

export function createCardInstance(card: NormalizedCard, ownerId?: string): CardInstance {
  if (!card.enrichment && card.code.startsWith('unscanned_')) {
    throw new Error(`Supplemental data is missing for card ${card.code} (${card.name})`);
  }
  instanceCounter += 1;
  const uses = card.enrichment?.uses;
  const initialCounters: Record<string, number> = {};
  let totalCounters = 0;
  if (uses) {
    const counterType = uses.counterType || 'all_purpose';
    initialCounters[counterType] = uses.count;
    totalCounters = uses.count;
  }
  return {
    instanceId: `inst_${instanceCounter}_${card.code}`,
    card: card.enrichment ? card : withEmptyEnrichment(card),
    exhausted: false,
    tokens: {
      damage: 0,
      threat: 0,
      counters: totalCounters,
    },
    counters: initialCounters,
    statusCards: [],
    attachments: [],
    ownerId,
  };
}

/**
 * Toughness: "This character enters play with a tough status card." Call it once for every
 * ally, minion or villain stage that enters play (played, put into play, revealed), after its state
 * is reset.
 */
export function applyToughnessOnEntry(instance: {
  card: NormalizedCard;
  statusCards?: StatusCard[];
}): void {
  if (!hasKeyword(instance.card, Keyword.TOUGHNESS)) return;
  if (!instance.statusCards) instance.statusCards = [];
  if (!instance.statusCards.includes(StatusCard.TOUGH)) {
    instance.statusCards.push(StatusCard.TOUGH);
  }
}
