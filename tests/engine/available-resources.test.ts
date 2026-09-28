import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard } from '../../src/engine/models';
import { setupGame } from '../../src/engine/state/game-setup';
import { getAvailableResources } from '../../src/engine/pipeline/cost-engine';

describe('Available Resources Calculation (Issue #162)', () => {
  let state: GameState;
  let spiderManHero: HeroCard;
  let peterParkerAlterEgo: AlterEgoCard;

  beforeEach(() => {
    spiderManHero = cardCatalog.getCard('01001a') as HeroCard;
    peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;

    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Peter Parker',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(15).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
  });

  it('1. correctly counts single-resource hand cards', () => {
    const p1 = state.players[0];
    p1.currentForm = 'hero';
    p1.activeFormCard = p1.hero;
    p1.hand = [
      { instanceId: 'c1', card: cardCatalog.getCard('01005')! }, // Haymaker (1 physical)
      { instanceId: 'c2', card: cardCatalog.getCard('01006')! }, // Backflip (1 mental)
      { instanceId: 'c3', card: cardCatalog.getCard('01004')! }, // Spider-Tracer (1 mental)
    ];

    const res = getAvailableResources(p1, state);
    expect(res.hand).toBe(3);
    expect(res.generators).toBe(0);
    expect(res.total).toBe(3);
  });

  it('2. correctly counts double-resource hand cards (Energy 01088, Genius 01089, Strength 01090)', () => {
    const p1 = state.players[0];
    p1.currentForm = 'hero';
    p1.activeFormCard = p1.hero;
    p1.hand = [
      { instanceId: 'energy_inst', card: cardCatalog.getCard('01088')! }, // Energy (2 energy)
      { instanceId: 'genius_inst', card: cardCatalog.getCard('01089')! }, // Genius (2 mental)
      { instanceId: 'strength_inst', card: cardCatalog.getCard('01090')! }, // Strength (2 physical)
    ];

    const res = getAvailableResources(p1, state);
    expect(res.hand).toBe(6);
    expect(res.total).toBe(6);
  });

  it('3. returns 0 for empty hand with no generators or identity abilities', () => {
    const p1 = state.players[0];
    p1.hand = [];
    p1.currentForm = 'hero';
    p1.activeFormCard = p1.hero;

    const res = getAvailableResources(p1, state);
    expect(res.hand).toBe(0);
    expect(res.generators).toBe(0);
    expect(res.identity).toBe(0);
    expect(res.total).toBe(0);
    expect(res.breakdown).toBe('0 Available');
  });

  it('4. counts ready tableau generator with counter uses (Web-Shooter 01008)', () => {
    const p1 = state.players[0];
    p1.hand = [];
    p1.currentForm = 'hero';
    p1.activeFormCard = p1.hero;

    p1.tableau = [
      {
        instanceId: 'ws_1',
        card: cardCatalog.getCard('01008')!, // Web-Shooter
        tokens: { counters: 2 },
        exhausted: false,
      },
    ];

    const res = getAvailableResources(p1, state);
    expect(res.generators).toBe(1);
    expect(res.total).toBe(1);
  });

  it('5. ignores exhausted tableau generator (Web-Shooter 01008)', () => {
    const p1 = state.players[0];
    p1.hand = [];
    p1.currentForm = 'hero';
    p1.activeFormCard = p1.hero;

    p1.tableau = [
      {
        instanceId: 'ws_1',
        card: cardCatalog.getCard('01008')!,
        tokens: { counters: 2 },
        exhausted: true,
      },
    ];

    const res = getAvailableResources(p1, state);
    expect(res.generators).toBe(0);
    expect(res.total).toBe(0);
  });

  it('6. ignores tableau generator with 0 counters (Web-Shooter 01008)', () => {
    const p1 = state.players[0];
    p1.hand = [];
    p1.currentForm = 'hero';
    p1.activeFormCard = p1.hero;

    p1.tableau = [
      {
        instanceId: 'ws_1',
        card: cardCatalog.getCard('01008')!,
        tokens: { counters: 0 },
        exhausted: false,
      },
    ];

    const res = getAvailableResources(p1, state);
    expect(res.generators).toBe(0);
    expect(res.total).toBe(0);
  });

  it('7. counts ready static generator (Pepper Potts 01033)', () => {
    const p1 = state.players[0];
    p1.hand = [];
    p1.currentForm = 'hero';
    p1.activeFormCard = p1.hero;

    const ppCard = cardCatalog.getCard('01033');
    if (ppCard) {
      p1.tableau = [
        {
          instanceId: 'pp_1',
          card: ppCard,
          exhausted: false,
        },
      ];
      const res = getAvailableResources(p1, state);
      expect(res.generators).toBe(1);
      expect(res.total).toBe(1);
    }
  });

  it('8. strictly excludes non-resource tableau cards like Helicarrier (01092) and Avengers Mansion (01091)', () => {
    const p1 = state.players[0];
    p1.hand = [];
    p1.currentForm = 'hero';
    p1.activeFormCard = p1.hero;

    p1.tableau = [
      {
        instanceId: 'heli_1',
        card: cardCatalog.getCard('01092')!, // Helicarrier (Action cost reducer, NOT a resource ability)
        exhausted: false,
      },
      {
        instanceId: 'mansion_1',
        card: cardCatalog.getCard('01091')!, // Avengers Mansion (Card draw action)
        exhausted: false,
      },
    ];

    const res = getAvailableResources(p1, state);
    expect(res.generators).toBe(0);
    expect(res.total).toBe(0);
  });

  it('9. enforces form restrictions on generators (e.g. Hero-only generator in Alter-Ego)', () => {
    const p1 = state.players[0];
    p1.hand = [];
    p1.currentForm = 'alter_ego';
    p1.activeFormCard = p1.alterEgo;

    // Web-Shooter timing is HERO_RESOURCE: cannot be used in alter-ego
    p1.tableau = [
      {
        instanceId: 'ws_1',
        card: cardCatalog.getCard('01008')!,
        tokens: { counters: 2 },
        exhausted: false,
      },
    ];

    const res = getAvailableResources(p1, state);
    expect(res.generators).toBe(0);
  });

  it('10. excludes tableau generator already used this round under once-per-round limit', () => {
    const p1 = state.players[0];
    p1.hand = [];
    p1.currentForm = 'hero';
    p1.activeFormCard = p1.hero;

    const baseCard = cardCatalog.getCard('01033')!;
    const genCard = {
      ...baseCard,
      enrichment: {
        abilities: [
          {
            id: 'mock_gen',
            timing: 'RESOURCE' as const,
            limit: 'ONCE_PER_ROUND' as const,
            steps: [{ effect: 'GENERATE_RESOURCE', effectParams: { amount: 1 } }],
          },
        ],
      },
    };

    p1.tableau = [
      {
        instanceId: 'gen_1',
        card: genCard as any,
        exhausted: false,
      },
    ];

    p1.usedAbilitiesThisRound = { gen_1_mock_gen: 1 };

    const res = getAvailableResources(p1, state);
    expect(res.generators).toBe(0);
  });

  it('11. counts Peter Parker Scientist in Alter-Ego form', () => {
    const p1 = state.players[0];
    p1.hand = [];
    p1.currentForm = 'alter_ego';
    p1.activeFormCard = p1.alterEgo;

    const res = getAvailableResources(p1, state);
    expect(res.identity).toBe(1);
    expect(res.total).toBe(1);
  });

  it('12. excludes Peter Parker Scientist when in Hero form', () => {
    const p1 = state.players[0];
    p1.hand = [];
    p1.currentForm = 'hero';
    p1.activeFormCard = p1.hero;

    const res = getAvailableResources(p1, state);
    expect(res.identity).toBe(0);
  });

  it('13. excludes Peter Parker Scientist when already used this round', () => {
    const p1 = state.players[0];
    p1.hand = [];
    p1.currentForm = 'alter_ego';
    p1.activeFormCard = p1.alterEgo;
    p1.usedAbilitiesThisRound = { scientist: 1 };

    const res = getAvailableResources(p1, state);
    expect(res.identity).toBe(0);
  });

  it('14. aggregates hand, generators, and identity abilities into total and breakdown string', () => {
    const p1 = state.players[0];
    p1.currentForm = 'alter_ego';
    p1.activeFormCard = p1.alterEgo;

    // 2 hand cards: 1 single + 1 double = 3 hand resources
    p1.hand = [
      { instanceId: 'c1', card: cardCatalog.getCard('01005')! }, // 1 physical
      { instanceId: 'c2', card: cardCatalog.getCard('01088')! }, // 2 energy
    ];

    // Ready generator in tableau usable in alter ego (e.g. Quincarrier 01020 or Energy Absorption if usable)
    const qCarrier = cardCatalog.getCard('01020');
    if (qCarrier) {
      p1.tableau = [
        {
          instanceId: 'qc_1',
          card: qCarrier,
          exhausted: false,
        },
      ];
    }

    const res = getAvailableResources(p1, state);
    expect(res.hand).toBe(3);
    expect(res.identity).toBe(1); // Scientist
    expect(res.total).toBe(3 + res.generators + 1);
    expect(res.breakdown).toContain('3 Hand');
    expect(res.breakdown).toContain('1 Identity');
  });
});
