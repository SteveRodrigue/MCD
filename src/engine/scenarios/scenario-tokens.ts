import { CardType, FactionCode, MinionCard } from '@engine/models';
import { ScenarioRegistry } from './registry';

/** The minion card of a token a scenario declares, for its script to put into play. */
export function scenarioTokenCard(scenarioId: string, code: string): MinionCard {
  const token = ScenarioRegistry.get(scenarioId).definition.tokens?.find((t) => t.code === code);
  if (!token) throw new Error(`Scenario '${scenarioId}' declares no token '${code}'.`);
  return {
    code: token.code,
    name: token.name,
    type: CardType.MINION,
    faction: FactionCode.ENCOUNTER,
    packCode: token.packCode,
    position: 0,
    quantity: 1,
    deckLimit: 1,
    isUnique: false,
    costPerHero: false,
    text: '',
    traits: [...token.traits],
    keywords: [],
    resources: { physical: 0, energy: 0, mental: 0, wild: 0, total: 0 },
    isLandscape: false,
    orientation: 'portrait',
    health: token.health,
    attack: token.attack,
    scheme: token.scheme,
    enrichment: { abilities: [] },
    raw: { code: token.code, name: token.name } as MinionCard['raw'],
  };
}
