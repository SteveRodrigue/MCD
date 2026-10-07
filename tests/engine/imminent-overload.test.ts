import { describe, it, expect } from 'vitest';
import { cardCatalog } from '@data/importer/card-loader';
import {
  GameState,
  HeroCard,
  AlterEgoCard,
  SideSchemeCard,
  setupGame,
  resetInstanceCounter,
  createCardInstance,
  step1_placeThreat,
  step4_revealEncounterCards,
  getActiveMainScheme,
} from '@engine/index';
import {
  canBasicThwart,
  hasCrisisInPlay,
  getCrisisIconCount,
} from '@engine/pipeline/legality-checker';

/**
 * Imminent Overload (01171), Iron Man nemesis side scheme. Printed: Base threat 3 (fixed, not
 * per hero), one ACCELERATION icon, "When Revealed: Place an additional 1 [per_hero] threat here."
 * It prints NO Crisis icon (#132 asked to validate "the crisis icon"; the icon on this card is
 * Acceleration). RR v1.8: Acceleration icon = +1 threat on the main scheme in villain phase step 1
 * while the card is in play; Crisis icon = player cards cannot remove threat from the main scheme.
 */
const player = (id: string, hero: string, alterEgo: string) => ({
  id,
  name: id,
  hero: cardCatalog.getCard(hero) as HeroCard,
  alterEgo: cardCatalog.getCard(alterEgo) as AlterEgoCard,
  deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
});

const newGame = (playerCount: 1 | 2): GameState => {
  resetInstanceCounter();
  const players = [player('p1', '01001a', '01001b')];
  if (playerCount === 2) players.push(player('p2', '01029a', '01029b'));
  const state = setupGame({
    scenarioId: 'rhino',
    players,
    villain: cardCatalog.getCard('01094') as any,
    mainScheme: cardCatalog.getCard('01097b') as any,
    encounterCards: cardCatalog.getCardsBySet('rhino'),
    skipMulligan: true,
  });
  for (const p of state.players) {
    p.currentForm = 'hero';
    p.activeFormCard = p.hero;
  }
  return state;
};

const reveal = (state: GameState, playerId = 'p1') => {
  const card = createCardInstance(cardCatalog.getCard('01171')!);
  state.players.find((p) => p.id === playerId)!.dealtEncounterCards.push(card);
  return { card, next: step4_revealEncounterCards(state) };
};

describe('Imminent Overload (01171) (Issue #132)', () => {
  it('data: acceleration icon, fixed base threat 3, and no Crisis icon', () => {
    const card = cardCatalog.getCard('01171') as SideSchemeCard;
    expect(card.hasAcceleration).toBe(true);
    expect(getCrisisIconCount(card)).toBe(0);
    expect(card.baseThreat).toBe(3);
    expect(card.baseThreatFixed).toBe(true);
  });

  it.each([
    [1, 4],
    [2, 5],
  ] as const)(
    'with %i hero(es): starts at 3 (fixed) + 1 per hero = %i threat',
    (count, expected) => {
      const state = newGame(count);
      const { card, next } = reveal(state);
      const sideScheme = next.sideSchemes.find((s) => s.instanceId === card.instanceId);
      expect(sideScheme).toBeDefined();
      expect(sideScheme!.threat).toBe(expected);
    },
  );

  it('does NOT block thwarting the main scheme (no Crisis icon)', () => {
    const state = newGame(1);
    getActiveMainScheme(state).threat = 5;
    const { next } = reveal(state);
    expect(hasCrisisInPlay(next)).toBe(false);
    expect(canBasicThwart(next, 'p1', 'main_scheme').allowed).toBe(true);
  });

  it('acceleration: villain phase step 1 places 1 extra threat on the main scheme while it is in play', () => {
    const state = newGame(1);
    const baseline = structuredClone(state);
    const before = getActiveMainScheme(baseline).threat;
    step1_placeThreat(baseline);
    const withoutIcon = getActiveMainScheme(baseline).threat - before;

    const { next } = reveal(state);
    const threatBefore = getActiveMainScheme(next).threat;
    step1_placeThreat(next);
    const withIcon = getActiveMainScheme(next).threat - threatBefore;

    expect(withIcon).toBe(withoutIcon + 1);
  });

  it('acceleration stops once the side scheme is defeated', () => {
    const state = newGame(1);
    const { next } = reveal(state);
    next.sideSchemes = [];
    const baseline = structuredClone(newGame(1));
    const a = getActiveMainScheme(next).threat;
    step1_placeThreat(next);
    const b = getActiveMainScheme(baseline).threat;
    step1_placeThreat(baseline);
    expect(getActiveMainScheme(next).threat - a).toBe(getActiveMainScheme(baseline).threat - b);
  });
});
