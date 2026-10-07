import { describe, it, expect } from 'vitest';
import { setupGame } from '../../src/engine/state/game-setup';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { HeroCard, AlterEgoCard, GameState, GamePhase } from '../../src/engine/models';
import { dispatchAction, peekDecisionPrompt } from '../../src/engine/pipeline';

/**
 * RR v1.8 Appendix II: step 15 resolves mulligans, then step 16 resolves the "Setup" abilities of
 * the player cards in play (#283: the Foresight ability of T'Challa must let the player choose,
 * after the mulligan).
 */
describe('Player Setup abilities (RR v1.8 Appendix II step 16, #283)', () => {
  const bpIdentity = {
    hero: cardCatalog.getCard('01040a') as HeroCard,
    alterEgo: cardCatalog.getCard('01040b') as AlterEgoCard,
  };
  const smIdentity = {
    hero: cardCatalog.getCard('01001a') as HeroCard,
    alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
  };

  const bpDeckCards = [
    ...Array(11).fill(cardCatalog.getCard('01044')!), // Vibranium (Resource)
    cardCatalog.getCard('01046')!, // Energy Daggers (Upgrade)
    cardCatalog.getCard('01047')!, // Panther Claws (Upgrade)
    cardCatalog.getCard('01048')!, // Tactical Genius (Upgrade)
    cardCatalog.getCard('01049')!, // Vibranium Suit (Upgrade)
  ];

  const bp = (deckCards = bpDeckCards) => ({
    id: 'p1',
    name: 'Black Panther',
    hero: bpIdentity.hero,
    alterEgo: bpIdentity.alterEgo,
    deckCards,
  });

  function answer(state: GameState, selectedOptionId: string): GameState {
    const prompt = peekDecisionPrompt(state)!;
    return dispatchAction(state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: prompt.playerId,
      selectedOptionId,
    }).state;
  }

  /** The prompt option that offers the deck card with this printed code. */
  function optionFor(state: GameState, code: string): string {
    const prompt = peekDecisionPrompt(state)!;
    const instance = state.players
      .flatMap((p) => p.deck)
      .find((c) => c.card.code === code && prompt.options.some((o) => o.id === c.instanceId));
    return instance!.instanceId;
  }

  it("asks which Black Panther upgrade to add (T'Challa 01040b), then the game begins", () => {
    let state = setupGame({
      scenarioId: 'rhino',
      players: [bp()],
      shuffleFn: (arr) => arr,
      skipMulligan: true,
    });

    const prompt = peekDecisionPrompt(state);
    expect(prompt).toBeDefined();
    expect(prompt!.playerId).toBe('p1');
    expect(prompt!.options).toHaveLength(4);
    expect(state.phase).toBe(GamePhase.SETUP_PHASE);
    expect(state.setupState?.stage).toBe('PLAYER_SETUP');
    expect(state.players[0].hand).toHaveLength(6);

    state = answer(state, optionFor(state, '01047'));

    const player = state.players[0];
    expect(peekDecisionPrompt(state)).toBeUndefined();
    expect(player.hand).toHaveLength(7);
    expect(player.hand.some((c) => c.card.code === '01047')).toBe(true);
    expect(player.deck).toHaveLength(8);
    expect(player.tableau).toHaveLength(0);
    expect(state.phase).toBe(GamePhase.PLAYER_PHASE);
    expect(state.setupState).toBeUndefined();
  });

  it('adds the only candidate without a prompt', () => {
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        bp([...Array(14).fill(cardCatalog.getCard('01044')!), cardCatalog.getCard('01049')!]),
      ],
      shuffleFn: (arr) => arr,
      skipMulligan: true,
    });

    expect(peekDecisionPrompt(state)).toBeUndefined();
    expect(state.players[0].hand.some((c) => c.card.code === '01049')).toBe(true);
    expect(state.phase).toBe(GamePhase.PLAYER_PHASE);
  });

  it('does nothing when the deck holds no Black Panther upgrade', () => {
    const state = setupGame({
      scenarioId: 'rhino',
      players: [bp(Array(15).fill(cardCatalog.getCard('01044')!))],
      shuffleFn: (arr) => arr,
      skipMulligan: true,
    });

    expect(peekDecisionPrompt(state)).toBeUndefined();
    expect(state.players[0].hand).toHaveLength(6);
    expect(state.phase).toBe(GamePhase.PLAYER_PHASE);
  });

  it('resolves Setup after the mulligan, so the fetched upgrade cannot be mulliganed', () => {
    let state = setupGame({
      scenarioId: 'rhino',
      players: [bp()],
      shuffleFn: (arr) => arr,
    });

    expect(state.setupState?.stage).toBe('MULLIGAN_PHASE');
    expect(peekDecisionPrompt(state)).toBeUndefined();
    expect(state.players[0].hand).toHaveLength(6);

    state = dispatchAction(state, {
      type: 'RESOLVE_MULLIGAN',
      playerId: 'p1',
      discardCardInstanceIds: [],
    }).state;

    expect(state.setupState?.stage).toBe('PLAYER_SETUP');
    expect(state.phase).toBe(GamePhase.SETUP_PHASE);
    expect(peekDecisionPrompt(state)!.options).toHaveLength(4);

    state = answer(state, optionFor(state, '01046'));
    expect(state.players[0].hand.some((c) => c.card.code === '01046')).toBe(true);
    expect(state.phase).toBe(GamePhase.PLAYER_PHASE);
  });

  it('leaves heroes without Setup abilities unaffected (Spider-Man 01001b)', () => {
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: smIdentity.hero,
          alterEgo: smIdentity.alterEgo,
          deckCards: Array(15).fill(cardCatalog.getCard('01005')!),
        },
      ],
      shuffleFn: (arr) => arr,
      skipMulligan: true,
    });

    expect(state.players[0].tableau).toHaveLength(0);
    expect(state.players[0].hand).toHaveLength(6);
    expect(state.phase).toBe(GamePhase.PLAYER_PHASE);
  });

  it('resolves the SETUP abilities of each player in player order, one prompt at a time', () => {
    const searchSetup = {
      ...smIdentity.alterEgo,
      enrichment: {
        ...smIdentity.alterEgo.enrichment,
        abilities: [
          {
            id: 'canonical_setup_search',
            timing: 'SETUP' as const,
            steps: [
              {
                effect: 'SEARCH' as const,
                effectParams: {
                  source: 'PLAYER_DECK',
                  filter: { types: ['resource'] },
                  selectedDestination: 'HAND',
                  shuffleAfter: true,
                },
              },
            ],
          },
        ],
      },
    } as AlterEgoCard;

    let state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: smIdentity.hero,
          alterEgo: searchSetup,
          deckCards: [
            ...Array(8).fill(cardCatalog.getCard('01005')!),
            cardCatalog.getCard('01044')!,
            cardCatalog.getCard('01044')!,
            ...Array(5).fill(cardCatalog.getCard('01005')!),
          ],
        },
        { ...bp(), id: 'p2' },
      ],
      shuffleFn: (arr) => arr,
      skipMulligan: true,
    });

    expect(peekDecisionPrompt(state)!.playerId).toBe('p1');
    expect(state.players[1].hand).toHaveLength(6);

    state = answer(state, peekDecisionPrompt(state)!.options[0].id);

    expect(peekDecisionPrompt(state)!.playerId).toBe('p2');
    expect(state.phase).toBe(GamePhase.SETUP_PHASE);

    state = answer(state, optionFor(state, '01048'));
    expect(state.players[1].hand.some((c) => c.card.code === '01048')).toBe(true);
    expect(state.phase).toBe(GamePhase.PLAYER_PHASE);
  });
});
