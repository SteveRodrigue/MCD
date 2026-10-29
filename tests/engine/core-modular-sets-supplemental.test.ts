import { describe, it, expect } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { setupGame } from '@engine/state/game-setup';
import { HeroCard, AlterEgoCard } from '@engine/models';
import { kernel } from '@engine/kernel';

describe('Core Modular Sets Supplemental Data Integration', () => {
  const spiderManHero = cardCatalog.getCard('01001a') as HeroCard;
  const peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;
  const ironManHero = cardCatalog.getCard('01029a') as HeroCard;
  const tonyStarkAlterEgo = cardCatalog.getCard('01029b') as AlterEgoCard;

  const createTwoPlayerState = () =>
    setupGame({
      catalog: cardCatalog,
      scenarioId: 'rhino',
      difficulty: 'STANDARD',
      modularSetCodes: ['masters_of_evil'],
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
        {
          id: 'p2',
          name: 'Iron Man',
          hero: ironManHero,
          alterEgo: tonyStarkAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
    });

  const createTestState = () =>
    setupGame({
      catalog: cardCatalog,
      scenarioId: 'rhino',
      difficulty: 'STANDARD',
      modularSetCodes: ['masters_of_evil'],
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
    });

  it('verifies that all 16 core modular cards have supplemental entries or ambiguity files', () => {
    const codes = [
      '01128',
      '01129',
      '01130',
      '01131',
      '01132',
      '01133', // Masters of Evil
      '01151',
      '01152',
      '01153',
      '01154', // Under Attack
      '01180',
      '01181',
      '01182', // Legions of Hydra
      '01183',
      '01184',
      '01185', // The Doomsday Chair
    ];

    for (const code of codes) {
      const card = cardCatalog.getCard(code);
      expect(card).toBeDefined();
      if (!card) continue;
      expect(card.enrichment).toBeDefined();
      expect(card.enrichment?.audit).toBeDefined();
      expect(card.enrichment?.audit?.confidence).toBeGreaterThanOrEqual(75);
    }
  });

  it('resolves The Masters of Evil (01128) When Revealed: discards until MoE minion and puts it into play engaged', () => {
    const state = createTestState();
    const sideSchemeCard = cardCatalog.getCard('01128')!;
    const radioactiveManCard = cardCatalog.getCard('01129')!;

    // Place Radioactive Man into encounter deck between filler cards so deck does not exhaust
    const fillerCard = cardCatalog.getCard('01154')!;
    state.encounterDeck = [
      {
        instanceId: 'filler-1',
        card: fillerCard,
        ownerId: 'encounter',
        counters: {},
        attachments: [],
        statusCards: [],
      },
      {
        instanceId: 'radioactive-1',
        card: radioactiveManCard,
        ownerId: 'encounter',
        counters: {},
        attachments: [],
        statusCards: [],
      },
      {
        instanceId: 'filler-2',
        card: fillerCard,
        ownerId: 'encounter',
        counters: {},
        attachments: [],
        statusCards: [],
      },
    ];

    const ability = sideSchemeCard.enrichment?.abilities?.[0];
    expect(ability).toBeDefined();

    kernel.executeEffect(state, ability!, {
      playerId: 'p1',
      sourceCardInstance: {
        instanceId: 'moe-scheme',
        card: sideSchemeCard,
        ownerId: 'encounter',
        counters: {},
        attachments: [],
        statusCards: [],
      },
    });

    // Radioactive Man should now be engaged with p1
    expect(state.players[0].engagedMinions.some((m) => m.card.code === '01129')).toBe(true);
    // Filler card should be in encounter discard
    expect(state.encounterDiscard.some((c) => c.card.code === '01154')).toBe(true);
  });

  it('puts the MoE minion into play engaged with the first player even when another player resolves it', () => {
    const state = createTwoPlayerState();
    // p1 is first player (index 0)
    state.firstPlayerIndex = 0;

    const sideSchemeCard = cardCatalog.getCard('01128')!;
    const radioactiveManCard = cardCatalog.getCard('01129')!;
    const fillerCard = cardCatalog.getCard('01154')!;

    state.encounterDeck = [
      {
        instanceId: 'radioactive-1',
        card: radioactiveManCard,
        ownerId: 'encounter',
        counters: {},
        attachments: [],
        statusCards: [],
      },
      {
        instanceId: 'filler-1',
        card: fillerCard,
        ownerId: 'encounter',
        counters: {},
        attachments: [],
        statusCards: [],
      },
    ];

    const ability = sideSchemeCard.enrichment?.abilities?.[0];
    expect(ability).toBeDefined();

    // p2 resolves the When Revealed ability
    kernel.executeEffect(state, ability!, {
      playerId: 'p2',
      sourceCardInstance: {
        instanceId: 'moe-scheme',
        card: sideSchemeCard,
        ownerId: 'encounter',
        counters: {},
        attachments: [],
        statusCards: [],
      },
    });

    // Minion MUST engage p1 (the first player), NOT p2 (resolving player)
    expect(state.players[0].engagedMinions.some((m) => m.card.code === '01129')).toBe(true);
    expect(state.players[1].engagedMinions.some((m) => m.card.code === '01129')).toBe(false);
  });

  it('resolves Under Attack (01151) When Revealed by enqueuing a decision prompt for the player', () => {
    const state = createTestState();
    const sideSchemeCard = cardCatalog.getCard('01151')!;
    const ability = sideSchemeCard.enrichment?.abilities?.[0];
    expect(ability).toBeDefined();

    kernel.executeEffect(state, ability!, {
      playerId: 'p1',
      sourceCardInstance: {
        instanceId: 'under-attack-scheme',
        card: sideSchemeCard,
        ownerId: 'encounter',
        counters: {},
        attachments: [],
        statusCards: [],
      },
    });

    expect(state.pendingDecisionQueue.length).toBeGreaterThan(0);
    const prompt = state.pendingDecisionQueue[0];
    expect(prompt.options.length).toBe(2);
    expect(prompt.options[0].id).toBe('place_threat');
    expect(prompt.options[1].id).toBe('deal_damage');
  });

  it('marks M.O.D.O.K. (01184) as noSupplementalNeeded with 100% confidence', () => {
    const modok = cardCatalog.getCard('01184')!;
    expect(modok.enrichment?.noSupplementalNeeded).toBe(true);
    expect(modok.enrichment?.audit?.confidence).toBe(100);
    expect(modok.keywords).toContain('Retaliate 2');
  });
});
