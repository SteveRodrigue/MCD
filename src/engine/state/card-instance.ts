import { CardInstance, NormalizedCard } from '@engine/models';

let instanceCounter = 0;

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
    const counterType = uses.type || 'all_purpose';
    initialCounters[counterType] = uses.count;
    totalCounters = uses.count;
  }
  return {
    instanceId: `inst_${instanceCounter}_${card.code}`,
    card: {
      ...card,
      enrichment: card.enrichment || { abilities: [] },
    },
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
