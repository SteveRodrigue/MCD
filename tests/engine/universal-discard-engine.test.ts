import { describe, it, expect, beforeEach } from 'vitest';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { CardType, NormalizedCard } from '@engine/models';
import { executeEffect } from '@engine/effects';
import { peekDecisionPrompt } from '@engine/pipeline';
import { step4_revealEncounterCards } from '@engine/index';

describe('Universal DISCARD Primitive Engine (RR v1.8 p. 10, Issue #66)', () => {
  let spiderManHero: any;
  let peterParkerAlterEgo: any;
  let rhinoVillain: any;
  let mainScheme: any;

  beforeEach(() => {
    spiderManHero = cardCatalog.getCard('01001a')!;
    peterParkerAlterEgo = cardCatalog.getCard('01001b')!;
    rhinoVillain = cardCatalog.getCard('01094')!;
    mainScheme = cardCatalog.getCard('01097')!;
  });

  function createTestGame() {
    return setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: [cardCatalog.getCard('01005')!, cardCatalog.getCard('01006')!],
        },
      ],
      villain: rhinoVillain,
      mainScheme,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
  }

  it('discards cards from HAND at random (mode: RANDOM)', () => {
    const state = createTestGame();
    const player = state.players[0];
    const initialHandCount = player.hand.length;
    expect(initialHandCount).toBeGreaterThanOrEqual(2);

    const res = executeEffect(
      state,
      {
        effect: 'DISCARD',
        effectParams: {
          source: 'HAND',
          mode: 'RANDOM',
          count: 2,
        },
      },
      { playerId: 'p1' },
    );

    expect(res.success).toBe(true);
    expect(res.mutatedState).toBe(true);
    expect(player.hand.length).toBe(initialHandCount - 2);
    expect(player.discard.length).toBe(2);
    expect(res.onomatopoeia).toContain('RANDOM DISCARD');
  });

  it('discards cards from HAND in standard order', () => {
    const state = createTestGame();
    const player = state.players[0];
    const initialHandCount = player.hand.length;
    const firstCard = player.hand[0];

    const res = executeEffect(
      state,
      {
        effect: 'DISCARD',
        effectParams: {
          source: 'HAND',
          count: 1,
        },
      },
      { playerId: 'p1' },
    );

    expect(res.success).toBe(true);
    expect(player.hand.length).toBe(initialHandCount - 1);
    expect(player.discard).toContain(firstCard);
  });

  it('discards cards from player DECK (milling)', () => {
    const state = createTestGame();
    const player = state.players[0];
    player.deck = [
      createCardInstance(cardCatalog.getCard('01005')!),
      createCardInstance(cardCatalog.getCard('01006')!),
    ];
    const initialDeckCount = player.deck.length;
    const initialDiscardCount = player.discard.length;

    const res = executeEffect(
      state,
      {
        effect: 'DISCARD',
        effectParams: {
          source: 'DECK',
          count: 2,
        },
      },
      { playerId: 'p1' },
    );

    expect(res.success).toBe(true);
    expect(player.deck.length).toBe(initialDeckCount - 2);
    expect(player.discard.length).toBe(initialDiscardCount + 2);
  });

  it('discards cards from ENCOUNTER_DECK', () => {
    const state = createTestGame();
    const initialEncounterDeckCount = state.encounterDeck.length;
    const initialEncounterDiscardCount = state.encounterDiscard.length;

    const res = executeEffect(
      state,
      {
        effect: 'DISCARD',
        effectParams: {
          source: 'ENCOUNTER_DECK',
          count: 2,
        },
      },
      { playerId: 'p1' },
    );

    expect(res.success).toBe(true);
    expect(state.encounterDeck.length).toBe(initialEncounterDeckCount - 2);
    expect(state.encounterDiscard.length).toBe(initialEncounterDiscardCount + 2);
  });

  it('discards upgrade or support from TABLEAU when present', () => {
    const state = createTestGame();
    const player = state.players[0];

    const testUpgrade: NormalizedCard = {
      ...cardCatalog.getCard('01005')!,
      code: 'test_upgrade',
      name: 'Web-Shooter',
      type: CardType.UPGRADE,
    };
    const inst = createCardInstance(testUpgrade);
    player.tableau = [inst];

    const res = executeEffect(
      state,
      {
        effect: 'DISCARD',
        effectParams: {
          source: 'TABLEAU',
          filter: {
            cardTypes: ['upgrade', 'support'],
          },
          fallback: 'SURGE',
        },
      },
      { playerId: 'p1' },
    );

    expect(res.success).toBe(true);
    expect(player.tableau.length).toBe(0);
    expect(player.discard).toContain(inst);
    expect(res.onomatopoeia).toContain('DISCARDED WEB-SHOOTER');
    expect(player.dealtEncounterCards.length).toBe(0); // No surge because card was discarded
  });

  it('triggers SURGE fallback when TABLEAU has no matching cards', () => {
    const state = createTestGame();
    const player = state.players[0];
    player.tableau = []; // Empty tableau
    const initialDealtCount = player.dealtEncounterCards.length;

    const res = executeEffect(
      state,
      {
        effect: 'DISCARD',
        effectParams: {
          source: 'TABLEAU',
          filter: {
            cardTypes: ['upgrade', 'support'],
          },
          fallback: 'SURGE',
        },
      },
      { playerId: 'p1' },
    );

    expect(res.success).toBe(true);
    expect(res.onomatopoeia).toBe('SURGE!');
    expect(player.dealtEncounterCards.length).toBe(initialDealtCount + 1);
  });

  it('discards card instance via source: SELF', () => {
    const state = createTestGame();
    const player = state.players[0];

    const testCard: NormalizedCard = {
      ...cardCatalog.getCard('01005')!,
      code: 'test_self_card',
      name: 'Test Self Discard Card',
      type: CardType.UPGRADE,
    };
    const inst = createCardInstance(testCard);
    player.tableau = [inst];

    const res = executeEffect(
      state,
      {
        effect: 'DISCARD',
        effectParams: {
          source: 'SELF',
        },
      },
      { playerId: 'p1', sourceCardInstance: inst },
    );

    expect(res.success).toBe(true);
    expect(player.tableau.length).toBe(0);
    expect(player.discard).toContain(inst);
  });

  it('discards villain attachment via source: HOST', () => {
    const state = createTestGame();
    const attachmentCard = cardCatalog.getCard('01100')!;
    const inst = createCardInstance(attachmentCard);
    state.villain.attachments = [inst];

    const res = executeEffect(
      state,
      {
        effect: 'DISCARD',
        effectParams: {
          source: 'HOST',
        },
      },
      { playerId: 'p1', sourceCardInstance: inst },
    );

    expect(res.success).toBe(true);
    expect(state.villain.attachments.length).toBe(0);
    expect(state.encounterDiscard).toContain(inst);
  });

  it('discards cards tucked under villain via source: CARDS_UNDER_HOST', () => {
    const state = createTestGame();
    const encounterCard = createCardInstance(cardCatalog.getCard('01101')!); // Minion
    state.villain.cardsUnderneath = [encounterCard];

    const res = executeEffect(
      state,
      {
        effect: 'DISCARD',
        effectParams: {
          source: 'CARDS_UNDER_HOST',
          target: 'VILLAIN',
        },
      },
      { playerId: 'p1' },
    );

    expect(res.success).toBe(true);
    expect(state.villain.cardsUnderneath?.length).toBe(0);
    expect(state.encounterDiscard).toContain(encounterCard);
  });

  it('executes Black Cat (01002) two-pile split via universal DISCARD with matchingDestination: HAND', () => {
    const state = createTestGame();
    const player = state.players[0];

    // Card 1: Mental resource (01005 Web-Shooter has mental resource)
    const mentalCard = createCardInstance(cardCatalog.getCard('01005')!);
    // Card 2: Energy resource (01006 Aunt May has energy resource)
    const nonMentalCard = createCardInstance(cardCatalog.getCard('01006')!);

    player.deck = [mentalCard, nonMentalCard];
    const initialHandCount = player.hand.length;

    const res = executeEffect(
      state,
      {
        effect: 'DISCARD',
        effectParams: {
          source: 'DECK',
          count: 2,
          filter: {
            resource: 'mental',
          },
          matchingDestination: 'HAND',
        },
      },
      { playerId: 'p1' },
    );

    expect(res.success).toBe(true);
    // Universal DISCARD resolves immediately without opening decision prompt
    expect(peekDecisionPrompt(res.state)).toBeUndefined();

    // Mental card added to hand
    expect(player.hand.length).toBe(initialHandCount + 1);
    expect(player.hand.map((c) => c.instanceId)).toContain(mentalCard.instanceId);
    // Non-mental card discarded to discard pile
    expect(player.discard.map((c) => c.instanceId)).toContain(nonMentalCard.instanceId);

    // Issue #130: Verify explicit log entries for discarded cards and fetched cards
    const discardLog = res.state.log.find((l) => l.key === 'card.discarded.fromDeck');
    expect(discardLog).toBeDefined();
    expect(discardLog?.params?.cards).toContain('Aunt May');

    const fetchLog = res.state.log.find((l) => l.key === 'black_cat.fetch');
    expect(fetchLog).toBeDefined();
    expect(fetchLog?.params?.card).toBe(mentalCard.card.name);
  });

  it('records discarded card names in state.log for deck milling (e.g. Repulsor Blast)', () => {
    const state = createTestGame();
    const player = state.players[0];
    const card1 = createCardInstance(cardCatalog.getCard('01005')!);
    const card2 = createCardInstance(cardCatalog.getCard('01006')!);
    player.deck = [card1, card2];

    const res = executeEffect(
      state,
      {
        effect: 'DISCARD',
        effectParams: {
          source: 'DECK',
          count: 2,
        },
      },
      { playerId: 'p1' },
    );

    expect(res.success).toBe(true);
    const discardLog = res.state.log.find((l) => l.key === 'card.discarded.fromDeck');
    expect(discardLog).toBeDefined();
    expect(discardLog?.params?.cards).toContain(card1.card.name);
    expect(discardLog?.params?.cards).toContain(card2.card.name);
    expect(discardLog?.params?.source).toBe('deck');
  });

  it('records discarded card names in state.log when discarding from HAND', () => {
    const state = createTestGame();
    const player = state.players[0];
    const cardToDiscard = player.hand[0];

    const res = executeEffect(
      state,
      {
        effect: 'DISCARD',
        effectParams: {
          source: 'HAND',
          count: 1,
        },
      },
      { playerId: 'p1' },
    );

    expect(res.success).toBe(true);
    const discardLog = res.state.log.find((l) => l.key === 'card.discarded.fromHand');
    expect(discardLog).toBeDefined();
    expect(discardLog?.params?.cards).toBe(cardToDiscard.card.name);
    expect(discardLog?.params?.source).toBe('hand');
  });

  it('records drawn card names in state.log when executing DRAW effect', () => {
    const state = createTestGame();
    const player = state.players[0];
    const cardToDraw = createCardInstance(cardCatalog.getCard('01005')!);
    player.deck = [cardToDraw];

    const res = executeEffect(
      state,
      {
        effect: 'DRAW',
        effectParams: {
          count: 1,
        },
      },
      { playerId: 'p1' },
    );

    expect(res.success).toBe(true);
    const drawLog = res.state.log.find((l) => l.key === 'card.effect.drawCards');
    expect(drawLog).toBeDefined();
    expect(drawLog?.params?.cards).toContain(cardToDraw.card.name);
  });

  describe('hand source with filter, each-player targets and discarded-card results (#219)', () => {
    const withResources = (code: string, resources: Record<string, number>) =>
      createCardInstance({
        ...cardCatalog.getCard('01005')!,
        code,
        name: `Card ${code}`,
        resources: { physical: 0, energy: 0, mental: 0, wild: 0, ...resources },
      } as NormalizedCard);

    function createTwoPlayerGame() {
      return setupGame({
        scenarioId: 'rhino',
        players: [
          {
            id: 'p1',
            name: 'Spider-Man',
            hero: spiderManHero,
            alterEgo: peterParkerAlterEgo,
            deckCards: [cardCatalog.getCard('01005')!, cardCatalog.getCard('01006')!],
          },
          {
            id: 'p2',
            name: 'Spider-Man Two',
            hero: cardCatalog.getCard('01010a')!,
            alterEgo: cardCatalog.getCard('01010b')!,
            deckCards: [cardCatalog.getCard('01005')!, cardCatalog.getCard('01006')!],
          },
        ],
        villain: rhinoVillain,
        mainScheme,
        encounterCards: cardCatalog.getCardsBySet('rhino'),
        skipMulligan: true,
      });
    }

    it('filter + count ALL discards exactly the energy cards (printed wild included)', () => {
      const state = createTestGame();
      const player = state.players[0];
      const energy = withResources('t_energy', { energy: 1 });
      const wild = withResources('t_wild', { wild: 1 });
      const mental = withResources('t_mental', { mental: 1 });
      const physical = withResources('t_physical', { physical: 1 });
      player.hand = [energy, mental, wild, physical];

      const res = executeEffect(
        state,
        {
          effect: 'DISCARD',
          effectParams: {
            source: 'HAND',
            count: 'ALL',
            target: 'SELF_IDENTITY',
            filter: { resourceIcons: ['energy'] },
          },
        },
        { playerId: 'p1' },
      );

      expect(res.success).toBe(true);
      expect(res.mutatedState).toBe(true);
      expect(res.value).toBe(2);
      expect(res.discardedCards?.map((c) => c.instanceId)).toEqual([
        energy.instanceId,
        wild.instanceId,
      ]);
      expect(player.hand.map((c) => c.instanceId)).toEqual([
        mental.instanceId,
        physical.instanceId,
      ]);
      expect(player.discard.map((c) => c.instanceId)).toEqual([energy.instanceId, wild.instanceId]);
    });

    it('filter + count ALL with no matching card discards nothing', () => {
      const state = createTestGame();
      const player = state.players[0];
      const mental = withResources('t_mental', { mental: 1 });
      const physical = withResources('t_physical', { physical: 1 });
      player.hand = [mental, physical];

      const res = executeEffect(
        state,
        {
          effect: 'DISCARD',
          effectParams: {
            source: 'HAND',
            count: 'ALL',
            target: 'SELF_IDENTITY',
            filter: { resourceIcons: ['energy'] },
          },
        },
        { playerId: 'p1' },
      );

      expect(res.success).toBe(true);
      expect(res.value).toBe(0);
      expect(res.discardedCards).toEqual([]);
      expect(res.mutatedState).toBe(false);
      expect(player.hand.length).toBe(2);
      expect(player.discard.length).toBe(0);
    });

    it('mode RANDOM with a filter only ever discards a matching card', () => {
      for (let i = 0; i < 10; i++) {
        const state = createTestGame();
        const player = state.players[0];
        const energy = withResources('t_energy', { energy: 1 });
        player.hand = [
          withResources('t_mental', { mental: 1 }),
          energy,
          withResources('t_physical', { physical: 1 }),
        ];

        const res = executeEffect(
          state,
          {
            effect: 'DISCARD',
            effectParams: {
              source: 'HAND',
              mode: 'RANDOM',
              count: 1,
              filter: { resourceIcons: ['energy'] },
            },
          },
          { playerId: 'p1' },
        );

        expect(res.value).toBe(1);
        expect(res.discardedCards?.map((c) => c.instanceId)).toEqual([energy.instanceId]);
        expect(player.hand.length).toBe(2);
      }
    });

    it('mode RANDOM across ALL_PLAYERS discards one card per non-empty hand and skips empty hands', () => {
      const state = createTwoPlayerGame();
      const [p1, p2] = state.players;
      const p3 = { ...p2, id: 'p3', name: 'Empty Hand', hand: [], discard: [] };
      state.players.push(p3 as any);
      p1.hand = [withResources('a1', { energy: 1 }), withResources('a2', { mental: 1 })];
      p2.hand = [withResources('b1', { physical: 1 }), withResources('b2', { mental: 1 })];

      const res = executeEffect(
        state,
        {
          effect: 'DISCARD',
          effectParams: {
            source: 'HAND',
            mode: 'RANDOM',
            count: 1,
            target: 'ALL_PLAYERS',
          },
        },
        { playerId: 'p1' },
      );

      expect(res.success).toBe(true);
      expect(res.value).toBe(2);
      expect(res.discardedCards).toHaveLength(2);
      expect(p1.hand.length).toBe(1);
      expect(p2.hand.length).toBe(1);
      expect(p3.hand.length).toBe(0);
      expect(res.discardedCards![0].instanceId).toBe(p1.discard[0].instanceId);
      expect(res.discardedCards![1].instanceId).toBe(p2.discard[0].instanceId);
      expect(res.onomatopoeia).toContain('RANDOM DISCARD');
      const logs = res.state.log.filter((l) => l.key === 'card.discarded.fromHand');
      expect(logs).toHaveLength(2);
      expect(res.state.log.some((l) => l.key === 'player.hand.randomDiscard')).toBe(false);
    });

    it('mode RANDOM returns discardedCards and value', () => {
      const state = createTestGame();
      const player = state.players[0];
      const before = [...player.hand];

      const res = executeEffect(
        state,
        { effect: 'DISCARD', effectParams: { source: 'HAND', mode: 'RANDOM', count: 2 } },
        { playerId: 'p1' },
      );

      expect(res.value).toBe(2);
      expect(res.discardedCards).toHaveLength(2);
      for (const c of res.discardedCards!) {
        expect(before.map((b) => b.instanceId)).toContain(c.instanceId);
      }
    });

    it('IF_AMOUNT_ZERO gate runs the next step only after a hand discard that discarded nothing', () => {
      const steps = [
        {
          effect: 'DISCARD',
          effectParams: {
            source: 'HAND',
            count: 'ALL',
            target: 'SELF_IDENTITY',
            filter: { resourceIcons: ['energy'] },
          },
        },
        { effect: 'SURGE', gate: 'IF_RESULT', gateParams: { result: 'AMOUNT_ZERO' } },
      ] as any;

      const none = createTestGame();
      none.players[0].hand = [withResources('t_mental', { mental: 1 })];
      const noneRes = executeEffect(none, { sequence: steps } as any, { playerId: 'p1' });
      expect(noneRes.state.players[0].hand.length).toBe(1);
      expect(noneRes.state.log.some((l) => l.key === 'encounter.surge.triggered')).toBe(true);

      const some = createTestGame();
      some.players[0].hand = [withResources('t_energy', { energy: 1 })];
      const someRes = executeEffect(some, { sequence: steps } as any, { playerId: 'p1' });
      expect(someRes.state.players[0].hand.length).toBe(0);
      expect(someRes.state.log.some((l) => l.key === 'encounter.surge.triggered')).toBe(false);
    });
  });

  describe("card-level: Yon-Rogg's Treason (01179) and The Vulture's Plans (01169) (#219)", () => {
    const fillerCard = (name: string) =>
      createCardInstance({
        code: `filler-${name}`,
        name: `Filler ${name}`,
        type: 'treachery',
        faction: 'encounter',
      } as any);
    const withResources = (code: string, resources: Record<string, number>) =>
      createCardInstance({
        ...cardCatalog.getCard('01005')!,
        code,
        name: `Card ${code}`,
        resources: { physical: 0, energy: 0, mental: 0, wild: 0, ...resources },
      } as NormalizedCard);

    function twoPlayers() {
      const state = setupGame({
        scenarioId: 'rhino',
        players: ['p1', 'p2'].map((id, i) => ({
          id,
          name: id,
          hero: i === 0 ? spiderManHero : cardCatalog.getCard('01010a')!,
          alterEgo: i === 0 ? peterParkerAlterEgo : cardCatalog.getCard('01010b')!,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        })),
        villain: rhinoVillain,
        mainScheme: cardCatalog.getCard('01097b') as any,
        encounterCards: cardCatalog.getCardsBySet('rhino'),
        skipMulligan: true,
      });
      for (const p of state.players) {
        p.currentForm = 'hero';
        p.activeFormCard = p.hero;
      }
      return state;
    }

    const reveal = (state: any, code: string) => {
      const inst = createCardInstance(cardCatalog.getCard(code)!);
      state.players[0].dealtEncounterCards.push(inst);
      return step4_revealEncounterCards(state);
    };

    it('01179 with an energy card in hand discards it and does not surge', () => {
      const state = twoPlayers();
      const filler = fillerCard('a');
      state.encounterDeck = [filler, ...state.encounterDeck];
      const energy = withResources('t_energy', { energy: 1 });
      const mental = withResources('t_mental', { mental: 1 });
      state.players[0].hand = [mental, energy];

      const next = reveal(state, '01179');

      expect(next.players[0].discard.map((c) => c.instanceId)).toEqual([energy.instanceId]);
      expect(next.players[0].hand.map((c) => c.instanceId)).toEqual([mental.instanceId]);
      expect(next.encounterDiscard.some((c) => c.instanceId === filler.instanceId)).toBe(false);
    });

    it('01179 without an energy card in hand surges', () => {
      const state = twoPlayers();
      const filler = fillerCard('a');
      state.encounterDeck = [filler, ...state.encounterDeck];
      const mental = withResources('t_mental', { mental: 1 });
      state.players[0].hand = [mental];

      const next = reveal(state, '01179');

      expect(next.players[0].hand.map((c) => c.instanceId)).toEqual([mental.instanceId]);
      expect(next.encounterDiscard.some((c) => c.instanceId === filler.instanceId)).toBe(true);
    });

    it.each<{
      name: string;
      a: Record<string, number>;
      b: Record<string, number>;
      threat: number;
    }>([
      { name: 'two different types', a: { energy: 1 }, b: { mental: 1 }, threat: 2 },
      { name: 'the same type twice counts once', a: { energy: 1 }, b: { energy: 1 }, threat: 1 },
    ])('01169 with 2 players: $name', ({ a, b, threat }) => {
      const state = twoPlayers();
      state.players[0].hand = [withResources('ta', a)];
      state.players[1].hand = [withResources('tb', b)];
      const before = state.mainScheme.threat;

      const next = reveal(state, '01169');

      expect(next.players[0].hand.length).toBe(0);
      expect(next.players[1].hand.length).toBe(0);
      expect(next.mainScheme.threat).toBe(before + threat);
    });
  });
});
