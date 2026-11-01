import { describe, it, expect } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { AlterEgoCard, GameState, HeroCard } from '@engine/models';
import { setupGame } from '@engine/state/game-setup';

// Characterization of what scenario setup produces for each built-in scenario: a digest of the
// state after setup (villain, main scheme, side schemes, environments, encounter deck order,
// engaged minions, player decks and log keys) for a fixed seed. The digests are recorded from the
// code as it is, so a refactor of setup has to either keep them or change them on purpose, with
// the reason stated next to the new value.

type PlayerSpec = { id: string; name: string; hero: string; alterEgo: string };

const PLAYERS: PlayerSpec[] = [
  { id: 'p1', name: 'Spider-Man', hero: '01001a', alterEgo: '01001b' },
  { id: 'p2', name: 'Captain Marvel', hero: '01010a', alterEgo: '01010b' },
];

function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function summarize(state: GameState): unknown {
  const codes = (list: { card: { code: string } }[]) => list.map((c) => c.card.code);
  return {
    scenario: state.scenarioId,
    difficulty: state.difficulty,
    villains: state.villains.map((v) => [v.card.code, v.health, v.maxHealth, v.statusCards.length]),
    mainSchemes: state.mainSchemes.map((m) => [m.card.code, m.threat, m.targetThreat, m.stage]),
    sideSchemes: state.sideSchemes.map((s) => [s.card.code, s.threat]),
    environments: codes(state.environments),
    encounterDeck: codes(state.encounterDeck),
    encounterDiscard: codes(state.encounterDiscard),
    players: state.players.map((p) => ({
      engaged: p.engagedMinions.map((m) => [m.card.code, m.exhausted, m.statusCards?.length ?? 0]),
      deck: codes(p.deck),
      hand: codes(p.hand),
    })),
    log: state.log.map((entry) => entry.key),
  };
}

function setup(scenarioId: string, playerCount: number, difficulty: 'STANDARD' | 'EXPERT') {
  return setupGame({
    catalog: cardCatalog,
    scenarioId,
    difficulty,
    seed: 'scenario-digest',
    players: PLAYERS.slice(0, playerCount).map((p) => ({
      id: p.id,
      name: p.name,
      hero: cardCatalog.getCard(p.hero) as HeroCard,
      alterEgo: cardCatalog.getCard(p.alterEgo) as AlterEgoCard,
      deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
    })),
  });
}

// scenario / players / difficulty -> digest, recorded from `main` before the main scheme work.
const GOLDEN: Record<string, string> = {
  'rhino/1/STANDARD': '8cb85aa8',
  'rhino/1/EXPERT': '3bd84435',
  'rhino/2/STANDARD': '2ef9c369',
  'rhino/2/EXPERT': '3081f721',
  'klaw/1/STANDARD': 'ec2ae310',
  'klaw/1/EXPERT': 'f007a65a',
  'klaw/2/STANDARD': '99357848',
  'klaw/2/EXPERT': 'a068333f',
  'ultron/1/STANDARD': '0dff36eb',
  'ultron/1/EXPERT': '5120297c',
  'ultron/2/STANDARD': '3be460a6',
  'ultron/2/EXPERT': 'd7d3c799',
};

const CASES = (['rhino', 'klaw', 'ultron'] as const).flatMap((scenario) =>
  [1, 2].flatMap((players) =>
    (['STANDARD', 'EXPERT'] as const).map((difficulty) => ({ scenario, players, difficulty })),
  ),
);

describe('scenario setup digests', () => {
  it.each(CASES)(
    '$scenario, $players player(s), $difficulty',
    ({ scenario, players, difficulty }) => {
      const digest = fnv1a(JSON.stringify(summarize(setup(scenario, players, difficulty))));
      const key = `${scenario}/${players}/${difficulty}`;
      expect(digest, `digest for ${key}`).toBe(GOLDEN[key] ?? 'unrecorded');
    },
  );

  it('is deterministic for a fixed seed', () => {
    const a = JSON.stringify(summarize(setup('klaw', 2, 'STANDARD')));
    const b = JSON.stringify(summarize(setup('klaw', 2, 'STANDARD')));
    expect(a).toBe(b);
  });
});
