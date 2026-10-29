import { describe, it, expect } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { HeroCard, AlterEgoCard, MinionCard, AllyCard } from '@engine/models';
import { kernel } from '@engine/kernel';
import {
  executeEnemyAttackSynchronously,
  initiateEnemyAttack,
  resolveDefenderDeclaration,
} from '@engine/pipeline/combat-pipeline';

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

  describe('Radioactive Man (01129) - Forced Response & Boost', () => {
    it('marks Radioactive Man (01129) supplemental data with 100% confidence', () => {
      const rm = cardCatalog.getCard('01129')!;
      expect(rm.enrichment?.audit?.confidence).toBe(100);
    });

    it('Forced Response: discards 1 random card from player hand after undefended attack', () => {
      const state = createTestState();
      const p1 = state.players[0];
      const card1 = createCardInstance(cardCatalog.getCard('01005')!, 'p1');
      const card2 = createCardInstance(cardCatalog.getCard('01006')!, 'p1');
      const card3 = createCardInstance(cardCatalog.getCard('01007')!, 'p1');
      p1.hand = [card1, card2, card3];
      p1.discard = [];

      const radioactiveMan = createCardInstance(cardCatalog.getCard('01129')! as MinionCard);
      p1.engagedMinions.push(radioactiveMan);

      executeEnemyAttackSynchronously(
        state,
        { type: 'MINION', card: radioactiveMan },
        'p1',
        'TAKE_UNDEFENDED',
      );

      expect(p1.hand.length).toBe(2);
      expect(p1.discard.length).toBe(1);
    });

    it('Forced Response: discards 1 random card from player hand when defended by an ally', () => {
      const state = createTestState();
      const p1 = state.players[0];
      const card1 = createCardInstance(cardCatalog.getCard('01005')!, 'p1');
      const card2 = createCardInstance(cardCatalog.getCard('01006')!, 'p1');
      const card3 = createCardInstance(cardCatalog.getCard('01007')!, 'p1');
      p1.hand = [card1, card2, card3];
      p1.discard = [];

      const ally = createCardInstance(cardCatalog.getCard('01002')! as AllyCard, 'p1');
      p1.allies = [ally];

      const radioactiveMan = createCardInstance(cardCatalog.getCard('01129')! as MinionCard);
      p1.engagedMinions.push(radioactiveMan);

      executeEnemyAttackSynchronously(
        state,
        { type: 'MINION', card: radioactiveMan },
        'p1',
        'ALLY_CHUMP_BLOCK',
      );

      // Ally defended, but player was attacked (RR v1.8), so player discards 1 card
      expect(p1.hand.length).toBe(2);
      expect(p1.discard.length).toBe(1);
    });

    it('Forced Response: discards 1 random card from defending player when cross-table defended in multiplayer', () => {
      const state = createTwoPlayerState();
      const p1 = state.players[0];
      const p2 = state.players[1];
      p1.hand = [
        createCardInstance(cardCatalog.getCard('01005')!, 'p1'),
        createCardInstance(cardCatalog.getCard('01006')!, 'p1'),
        createCardInstance(cardCatalog.getCard('01007')!, 'p1'),
      ];
      p2.hand = [
        createCardInstance(cardCatalog.getCard('01005')!, 'p2'),
        createCardInstance(cardCatalog.getCard('01006')!, 'p2'),
        createCardInstance(cardCatalog.getCard('01007')!, 'p2'),
      ];
      p1.discard = [];
      p2.discard = [];

      const radioactiveMan = createCardInstance(cardCatalog.getCard('01129')! as MinionCard);
      p1.engagedMinions.push(radioactiveMan);

      initiateEnemyAttack(state, { type: 'MINION', card: radioactiveMan }, 'p1');
      resolveDefenderDeclaration(
        state,
        { type: 'HERO', playerId: 'p2' },
        state.activeAttackContext!,
      );

      // p2 defended, so p2 became target player and discards 1 card; p1 hand is untouched
      expect(p2.hand.length).toBe(2);
      expect(p2.discard.length).toBe(1);
      expect(p1.hand.length).toBe(3);
      expect(p1.discard.length).toBe(0);
    });

    it('Forced Response: handles empty hand gracefully (0 cards discarded)', () => {
      const state = createTestState();
      const p1 = state.players[0];
      p1.hand = [];
      p1.discard = [];

      const radioactiveMan = createCardInstance(cardCatalog.getCard('01129')! as MinionCard);
      p1.engagedMinions.push(radioactiveMan);

      executeEnemyAttackSynchronously(
        state,
        { type: 'MINION', card: radioactiveMan },
        'p1',
        'TAKE_UNDEFENDED',
      );

      expect(p1.hand.length).toBe(0);
      expect(p1.discard.length).toBe(0);
    });

    it('Forced Response: discards the single card when hand has exactly 1 card', () => {
      const state = createTestState();
      const p1 = state.players[0];
      const card = createCardInstance(cardCatalog.getCard('01005')!, 'p1');
      p1.hand = [card];
      p1.discard = [];

      const radioactiveMan = createCardInstance(cardCatalog.getCard('01129')! as MinionCard);
      p1.engagedMinions.push(radioactiveMan);

      executeEnemyAttackSynchronously(
        state,
        { type: 'MINION', card: radioactiveMan },
        'p1',
        'TAKE_UNDEFENDED',
      );

      expect(p1.hand.length).toBe(0);
      expect(p1.discard.length).toBe(1);
      expect(p1.discard[0].card.code).toBe('01005');
    });

    it('Boost: discards 1 random card from defending player hand during villain attack', () => {
      const state = createTestState();
      const p1 = state.players[0];
      p1.hand = [
        createCardInstance(cardCatalog.getCard('01005')!, 'p1'),
        createCardInstance(cardCatalog.getCard('01006')!, 'p1'),
        createCardInstance(cardCatalog.getCard('01007')!, 'p1'),
      ];
      p1.discard = [];

      const radioactiveMan = createCardInstance(cardCatalog.getCard('01129')! as MinionCard);
      state.encounterDeck = [radioactiveMan];

      executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'TAKE_UNDEFENDED');

      expect(p1.hand.length).toBe(2);
      expect(p1.discard.length).toBe(1);
    });

    it('Boost: discards 1 random card from cross-table defender in multiplayer', () => {
      const state = createTwoPlayerState();
      const p1 = state.players[0];
      const p2 = state.players[1];
      p1.hand = [
        createCardInstance(cardCatalog.getCard('01005')!, 'p1'),
        createCardInstance(cardCatalog.getCard('01006')!, 'p1'),
        createCardInstance(cardCatalog.getCard('01007')!, 'p1'),
      ];
      p2.hand = [
        createCardInstance(cardCatalog.getCard('01005')!, 'p2'),
        createCardInstance(cardCatalog.getCard('01006')!, 'p2'),
        createCardInstance(cardCatalog.getCard('01007')!, 'p2'),
      ];
      p1.discard = [];
      p2.discard = [];

      const radioactiveMan = createCardInstance(cardCatalog.getCard('01129')! as MinionCard);
      state.encounterDeck = [radioactiveMan];

      initiateEnemyAttack(state, { type: 'VILLAIN' }, 'p1');
      resolveDefenderDeclaration(
        state,
        { type: 'HERO', playerId: 'p2' },
        state.activeAttackContext!,
      );

      // p2 defended, so boost effect discards from p2's hand; p1 hand is untouched
      expect(p2.hand.length).toBe(2);
      expect(p2.discard.length).toBe(1);
      expect(p1.hand.length).toBe(3);
      expect(p1.discard.length).toBe(0);
    });

    it('Boost: handles empty hand gracefully during boost resolution', () => {
      const state = createTestState();
      const p1 = state.players[0];
      p1.hand = [];
      p1.discard = [];

      const radioactiveMan = createCardInstance(cardCatalog.getCard('01129')! as MinionCard);
      state.encounterDeck = [radioactiveMan];

      executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'TAKE_UNDEFENDED');

      expect(p1.hand.length).toBe(0);
      expect(p1.discard.length).toBe(0);
    });
  });
});
