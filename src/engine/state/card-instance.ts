import { CardInstance, NormalizedCard } from '@engine/models';

let instanceCounter = 0;

export function resetInstanceCounter(): void {
  instanceCounter = 0;
}

export function createCardInstance(card: NormalizedCard): CardInstance {
  if (!card.enrichment && card.code.startsWith('unscanned_')) {
    throw new Error(`Supplemental data is missing for card ${card.code} (${card.name})`);
  }
  instanceCounter += 1;
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
      counters: 0,
    },
    statusCards: [],
    attachments: [],
  };
}
