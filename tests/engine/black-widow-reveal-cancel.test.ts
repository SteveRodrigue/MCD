import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog, CardCatalog } from '@data/importer/card-loader';
import corePack from '../../data/upstream/pack/core.json';
import coreEncounterPack from '../../data/upstream/pack/core_encounter.json';
import mtsPack from '../../data/upstream/pack/mts.json';
import {
  GameState,
  HeroCard,
  AlterEgoCard,
  StatusCard,
  setupGame,
  resetInstanceCounter,
  createCardInstance,
  peekDecisionPrompt,
  resolveDecisionPrompt,
  step4_revealEncounterCards,
  resolveDefenderDeclaration,
} from '@engine/index';
import { canCancelEncounterReveal } from '@engine/pipeline/encounter-cancel';

const BLACK_WIDOW = '01075';
const ETERNITY = '21054'; // "This effect cannot be canceled" (Mutant Genesis)
const HYDRA_MERCENARY = '01101'; // minion without When Revealed
const SHOCKER = '01103'; // minion with When Revealed
const CROWD_CONTROL = '01108'; // side scheme without When Revealed
const ARMORED_RHINO_SUIT = '01098'; // attachment without When Revealed
const FALSE_ALARM = '01112'; // treachery
const ENHANCED_SPIDER_SENSE = '01004'; // treachery only
const GET_BEHIND_ME = '01078'; // cancels, then the villain attacks "you"
const DECK_FILLER = '01005';

// Ad-hoc catalog: core + ONLY the proof card 21054 (the live loader does not load mts).
const eternityRaw = (mtsPack as any[]).find((c) => c.code === ETERNITY);
const adHocCatalog = new CardCatalog([...corePack, ...coreEncounterPack, eternityRaw] as any);

describe('Black Widow 01075 cancels any revealed encounter card (#255)', () => {
  let state: GameState;

  const p1 = () => state.players[0];
  const mentalCard = () =>
    createCardInstance({
      code: 'test_mental',
      name: 'Mental Card',
      type: 'event',
      cost: 1,
      resources: { mental: 1, total: 1 },
    } as any);

  beforeEach(() => {
    resetInstanceCounter();
    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: cardCatalog.getCard('01001a') as HeroCard,
          alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
          deckCards: Array(10).fill(cardCatalog.getCard(DECK_FILLER)!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
    p1().currentForm = 'hero';
    p1().activeFormCard = p1().hero;
    p1().hand = [mentalCard()];
    p1().allies.push(createCardInstance(cardCatalog.getCard(BLACK_WIDOW)!));
  });

  const deal = (code: string) => {
    const card = createCardInstance(cardCatalog.getCard(code)!);
    p1().dealtEncounterCards.push(card);
    return card;
  };

  const acceptBlackWidow = (s: GameState): GameState => {
    const prompt = peekDecisionPrompt(s);
    expect(prompt?.sourceCardName).toBe('Black Widow');
    return resolveDecisionPrompt(s, 'p1', prompt!.options.find((o) => o.id !== 'pass')!.id).state;
  };

  it.each([
    ['minion without When Revealed', HYDRA_MERCENARY],
    ['side scheme without When Revealed', CROWD_CONTROL],
    ['attachment without When Revealed', ARMORED_RHINO_SUIT],
  ])('is offered for a %s and discards it instead of putting it in play', (_label, code) => {
    state.encounterDeck = [createCardInstance(cardCatalog.getCard(FALSE_ALARM)!)];
    deal(code);
    const threatBefore = state.sideSchemes.length;

    const paused = step4_revealEncounterCards(state);
    const accepted = acceptBlackWidow(paused);
    // "Then, reveal another card from the encounter deck": it is dealt to the player
    expect(accepted.players[0].dealtEncounterCards.map((c) => c.card.code)).toEqual([FALSE_ALARM]);
    const after = step4_revealEncounterCards(accepted);

    expect(after.encounterDiscard.some((c) => c.card.code === code)).toBe(true);
    expect(after.players[0].engagedMinions).toHaveLength(0);
    expect(after.sideSchemes).toHaveLength(threatBefore);
    expect(after.villains.every((v) => v.attachments.length === 0)).toBe(true);
    // Cost paid
    expect(after.players[0].allies[0].exhausted).toBe(true);
    // The replacement (False Alarm) resolves: the hero is confused
    expect(after.players[0].statusCards).toContain(StatusCard.CONFUSED);
  });

  it('cancels the When Revealed effects of a minion that has some and discards it', () => {
    state.encounterDeck = [createCardInstance(cardCatalog.getCard(FALSE_ALARM)!)];
    deal(SHOCKER);
    const hp = p1().health;

    const after = acceptBlackWidow(step4_revealEncounterCards(state));

    expect(after.players[0].health).toBe(hp);
    expect(after.players[0].engagedMinions).toHaveLength(0);
    expect(after.encounterDiscard.some((c) => c.card.code === SHOCKER)).toBe(true);
  });

  it('works with auto-accepted optional triggers on a treachery (regression)', () => {
    state.encounterDeck = [];
    deal(FALSE_ALARM);

    const after = step4_revealEncounterCards(state, { acceptOptionalTriggers: true });

    expect(after.players[0].statusCards).not.toContain(StatusCard.CONFUSED);
    expect(after.encounterDiscard.some((c) => c.card.code === FALSE_ALARM)).toBe(true);
  });

  it('declining lets the minion enter play normally', () => {
    deal(HYDRA_MERCENARY);

    const paused = step4_revealEncounterCards(state);
    const after = resolveDecisionPrompt(paused, 'p1', 'pass').state;

    expect(after.players[0].engagedMinions.some((m) => m.card.code === HYDRA_MERCENARY)).toBe(true);
    expect(after.players[0].allies[0].exhausted).toBeFalsy();
  });

  it('a card discarded by Black Widow does not surge (only the replacement is revealed)', () => {
    state.encounterDeck = [
      createCardInstance(cardCatalog.getCard(FALSE_ALARM)!),
      createCardInstance(cardCatalog.getCard(HYDRA_MERCENARY)!),
    ];
    deal('01191'); // Exhaustion: Surge. When Revealed: exhaust your identity

    const accepted = acceptBlackWidow(step4_revealEncounterCards(state));

    expect(accepted.players[0].exhausted).toBe(false);
    expect(accepted.players[0].dealtEncounterCards.map((c) => c.card.code)).toEqual([FALSE_ALARM]);
  });

  it('is not offered when Black Widow is exhausted: the minion enters play', () => {
    p1().allies[0].exhausted = true;
    deal(HYDRA_MERCENARY);

    const after = step4_revealEncounterCards(state);

    expect(peekDecisionPrompt(after)).toBeUndefined();
    expect(after.players[0].engagedMinions.some((m) => m.card.code === HYDRA_MERCENARY)).toBe(true);
  });

  it('is not offered when no card can pay a mental or wild resource', () => {
    p1().hand = [
      createCardInstance({
        code: 'test_physical',
        name: 'Physical Card',
        type: 'event',
        cost: 1,
        resources: { physical: 1, total: 1 },
      } as any),
    ];
    deal(HYDRA_MERCENARY);

    const after = step4_revealEncounterCards(state);

    expect(peekDecisionPrompt(after)).toBeUndefined();
    expect(after.players[0].engagedMinions.some((m) => m.card.code === HYDRA_MERCENARY)).toBe(true);
    expect(after.players[0].allies[0].exhausted).toBeFalsy();
  });

  it('a card with a wild resource pays for the ability', () => {
    p1().hand = [
      createCardInstance({
        code: 'test_wild',
        name: 'Wild Card',
        type: 'event',
        cost: 1,
        resources: { wild: 1, total: 1 },
      } as any),
    ];
    state.encounterDeck = [createCardInstance(cardCatalog.getCard(FALSE_ALARM)!)];
    deal(HYDRA_MERCENARY);

    const accepted = acceptBlackWidow(step4_revealEncounterCards(state));

    expect(accepted.encounterDiscard.some((c) => c.card.code === HYDRA_MERCENARY)).toBe(true);
    expect(accepted.players[0].engagedMinions).toHaveLength(0);
    expect(accepted.players[0].allies[0].exhausted).toBe(true);
    expect(accepted.players[0].hand).toHaveLength(0);
  });

  it('Enhanced Spider-Sense (treachery only) is not offered for a minion', () => {
    p1().allies = [];
    p1().hand = [createCardInstance(cardCatalog.getCard(ENHANCED_SPIDER_SENSE)!), mentalCard()];
    deal(HYDRA_MERCENARY);

    const after = step4_revealEncounterCards(state);

    expect(peekDecisionPrompt(after)).toBeUndefined();
    expect(after.players[0].engagedMinions.some((m) => m.card.code === HYDRA_MERCENARY)).toBe(true);
  });
});

describe('Black Widow 01075 offers, surge and other players (#255)', () => {
  const EXHAUSTION = '01191'; // Surge keyword, When Revealed: exhaust your identity

  const mentalCard = () =>
    createCardInstance({
      code: 'test_mental',
      name: 'Mental Card',
      type: 'event',
      cost: 1,
      resources: { mental: 1, total: 1 },
    } as any);

  const twoPlayerGame = (): GameState => {
    resetInstanceCounter();
    const game = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: cardCatalog.getCard('01001a') as HeroCard,
          alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
          deckCards: Array(10).fill(cardCatalog.getCard(DECK_FILLER)!),
        },
        {
          id: 'p2',
          name: 'Iron Man',
          hero: cardCatalog.getCard('01029a') as HeroCard,
          alterEgo: cardCatalog.getCard('01029b') as AlterEgoCard,
          deckCards: Array(10).fill(cardCatalog.getCard(DECK_FILLER)!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
    for (const p of game.players) {
      p.currentForm = 'hero';
      p.activeFormCard = p.hero;
    }
    return game;
  };

  it('declining on a first card with Surge keeps it, then Black Widow is offered the surged card', () => {
    const state = twoPlayerGame();
    const [p1] = state.players;
    p1.hand = [mentalCard()];
    p1.allies.push(createCardInstance(cardCatalog.getCard(BLACK_WIDOW)!));
    state.players[1].hand = [];
    state.encounterDeck = [createCardInstance(cardCatalog.getCard(HYDRA_MERCENARY)!)];
    p1.dealtEncounterCards.push(createCardInstance(cardCatalog.getCard(EXHAUSTION)!));

    // First card (Surge): Black Widow is offered and declined
    const firstPrompt = step4_revealEncounterCards(state);
    expect(peekDecisionPrompt(firstPrompt)?.sourceCardName).toBe('Black Widow');
    expect(peekDecisionPrompt(firstPrompt)?.triggerSourceName).toBe('Exhaustion');
    const declined = resolveDecisionPrompt(firstPrompt, 'p1', 'pass').state;

    // The first card resolved and surged: the identity is exhausted, Hydra Mercenary is dealt
    expect(declined.players[0].exhausted).toBe(true);
    expect(declined.encounterDiscard.some((c) => c.card.code === EXHAUSTION)).toBe(true);
    expect(declined.players[0].dealtEncounterCards.map((c) => c.card.code)).toEqual([
      HYDRA_MERCENARY,
    ]);
    expect(declined.players[0].allies[0].exhausted).toBeFalsy();

    // The surged card is revealed: Black Widow is offered again
    const secondPrompt = step4_revealEncounterCards(declined);
    expect(peekDecisionPrompt(secondPrompt)?.sourceCardName).toBe('Black Widow');
    expect(peekDecisionPrompt(secondPrompt)?.triggerSourceName).toBe('Hydra Mercenary');
  });

  it('Black Widow in player 1 tableau is offered when a card of player 2 is revealed', () => {
    const state = twoPlayerGame();
    const [p1, p2] = state.players;
    p1.hand = [mentalCard()];
    p1.allies.push(createCardInstance(cardCatalog.getCard(BLACK_WIDOW)!));
    p2.hand = [];
    state.encounterDeck = [createCardInstance(cardCatalog.getCard(FALSE_ALARM)!)];
    p2.dealtEncounterCards.push(createCardInstance(cardCatalog.getCard(HYDRA_MERCENARY)!));

    const paused = step4_revealEncounterCards(state);

    const prompt = peekDecisionPrompt(paused);
    expect(prompt?.sourceCardName).toBe('Black Widow');
    expect(prompt?.playerId).toBe('p1');
    expect(prompt?.triggerSourceName).toBe('Hydra Mercenary');

    // Accepting: player 1 pays; the card of player 2 is discarded. The active player does not
    // change: the replacement is revealed by player 2, who is resolving the encounter cards.
    const accepted = resolveDecisionPrompt(
      paused,
      'p1',
      prompt!.options.find((o) => o.id !== 'pass')!.id,
    ).state;
    expect(accepted.encounterDiscard.some((c) => c.card.code === HYDRA_MERCENARY)).toBe(true);
    expect(accepted.players[1].engagedMinions).toHaveLength(0);
    expect(accepted.players[0].allies[0].exhausted).toBe(true);
    expect(accepted.players[0].hand).toHaveLength(0);
    expect(accepted.players[1].dealtEncounterCards.map((c) => c.card.code)).toEqual([FALSE_ALARM]);
    expect(accepted.players[0].dealtEncounterCards).toHaveLength(0);
  });

  it('Enhanced Spider-Sense (no "you" in its trigger) in player 2 hand cancels a treachery of player 1', () => {
    const state = twoPlayerGame();
    const [p1, p2] = state.players;
    p1.hand = [];
    p2.hand = [createCardInstance(cardCatalog.getCard(ENHANCED_SPIDER_SENSE)!), mentalCard()];
    p1.dealtEncounterCards.push(createCardInstance(cardCatalog.getCard(FALSE_ALARM)!));

    const paused = step4_revealEncounterCards(state);

    const prompt = peekDecisionPrompt(paused);
    expect(prompt?.sourceCardName).toBe('Enhanced Spider-Sense');
    expect(prompt?.playerId).toBe('p2');
    expect(prompt?.triggerSourceName).toBe('False Alarm');

    const accepted = resolveDecisionPrompt(
      paused,
      'p2',
      prompt!.options.find((o) => o.id !== 'pass')!.id,
    ).state;
    expect(accepted.players[0].statusCards).not.toContain(StatusCard.CONFUSED);
    expect(accepted.encounterDiscard.some((c) => c.card.code === FALSE_ALARM)).toBe(true);
    expect(accepted.players[1].discard.some((c) => c.card.code === ENHANCED_SPIDER_SENSE)).toBe(
      true,
    );
  });
  it('Get Behind Me! played by player 2 on a treachery of player 1: the villain attacks player 2', () => {
    const state = twoPlayerGame();
    const [p1, p2] = state.players;
    p1.hand = [];
    p2.hand = [createCardInstance(cardCatalog.getCard(GET_BEHIND_ME)!), mentalCard()];
    p1.dealtEncounterCards.push(createCardInstance(cardCatalog.getCard(FALSE_ALARM)!));
    const p1Hp = p1.health;
    const p2Hp = p2.health;

    const paused = step4_revealEncounterCards(state);
    const prompt = peekDecisionPrompt(paused);
    expect(prompt?.sourceCardName).toBe('Get Behind Me!');
    expect(prompt?.playerId).toBe('p2');

    const accepted = resolveDecisionPrompt(
      paused,
      'p2',
      prompt!.options.find((o) => o.id !== 'pass')!.id,
    ).state;

    // The treachery is cancelled and the attack is declared against player 2
    expect(accepted.players[0].statusCards).not.toContain(StatusCard.CONFUSED);
    const defense = peekDecisionPrompt(accepted);
    expect(defense?.playerId).toBe('p2');
    const resolved = resolveDefenderDeclaration(accepted, { type: 'UNDEFENDED', playerId: 'p2' });
    expect(resolved.players[1].health).toBeLessThan(p2Hp);
    expect(resolved.players[0].health).toBe(p1Hp);
  });
});

describe('Several cancel abilities queued for the same reveal (#255)', () => {
  const mentalCard = () =>
    createCardInstance({
      code: 'test_mental',
      name: 'Mental Card',
      type: 'event',
      cost: 1,
      resources: { mental: 1, total: 1 },
    } as any);

  // Player 1: Black Widow in play, Enhanced Spider-Sense in hand. Player 2: Get Behind Me! in hand.
  // Player 1 reveals a treachery (False Alarm).
  const threeCancelsGame = (): GameState => {
    resetInstanceCounter();
    const mk = (id: string, hero: string, alterEgo: string) => ({
      id,
      name: id,
      hero: cardCatalog.getCard(hero) as HeroCard,
      alterEgo: cardCatalog.getCard(alterEgo) as AlterEgoCard,
      deckCards: Array(10).fill(cardCatalog.getCard(DECK_FILLER)!),
    });
    const game = setupGame({
      scenarioId: 'rhino',
      players: [mk('p1', '01001a', '01001b'), mk('p2', '01029a', '01029b')],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
    for (const p of game.players) {
      p.currentForm = 'hero';
      p.activeFormCard = p.hero;
    }
    const [p1, p2] = game.players;
    p1.allies.push(createCardInstance(cardCatalog.getCard(BLACK_WIDOW)!));
    p1.hand = [
      createCardInstance(cardCatalog.getCard(ENHANCED_SPIDER_SENSE)!),
      mentalCard(),
      mentalCard(),
    ];
    p2.hand = [createCardInstance(cardCatalog.getCard(GET_BEHIND_ME)!), mentalCard(), mentalCard()];
    game.encounterDeck = [];
    p1.dealtEncounterCards.push(createCardInstance(cardCatalog.getCard(FALSE_ALARM)!));
    return game;
  };

  const sources = (s: GameState) => (s.pendingDecisionQueue ?? []).map((p) => p.sourceCardName);
  const yesOf = (s: GameState) => peekDecisionPrompt(s)!.options.find((o) => o.id !== 'pass')!.id;

  it('queues the three cancels in order', () => {
    const paused = step4_revealEncounterCards(threeCancelsGame());

    expect(sources(paused)).toEqual(['Black Widow', 'Enhanced Spider-Sense', 'Get Behind Me!']);
  });

  it('accepting Black Widow removes the other cancel prompts of the same card', () => {
    const paused = step4_revealEncounterCards(threeCancelsGame());

    const after = resolveDecisionPrompt(paused, 'p1', yesOf(paused)).state;

    expect(peekDecisionPrompt(after)).toBeUndefined();
    expect(after.encounterDiscard.some((c) => c.card.code === FALSE_ALARM)).toBe(true);
    // Only Black Widow's payment left the hand of player 1; player 2 kept Get Behind Me!
    expect(after.players[0].discard).toHaveLength(1);
    expect(after.players[1].hand.some((c) => c.card.code === GET_BEHIND_ME)).toBe(true);
  });

  it('passing Black Widow then accepting Enhanced Spider-Sense leaves no Get Behind Me!', () => {
    const paused = step4_revealEncounterCards(threeCancelsGame());
    const afterPass = resolveDecisionPrompt(paused, 'p1', 'pass').state;
    expect(sources(afterPass)).toEqual(['Enhanced Spider-Sense', 'Get Behind Me!']);

    const after = resolveDecisionPrompt(afterPass, 'p1', yesOf(afterPass)).state;

    expect(peekDecisionPrompt(after)).toBeUndefined();
    expect(after.players[0].statusCards).not.toContain(StatusCard.CONFUSED);
    expect(after.players[1].hand.some((c) => c.card.code === GET_BEHIND_ME)).toBe(true);
  });

  it('passing both first cancels still offers Get Behind Me!', () => {
    const paused = step4_revealEncounterCards(threeCancelsGame());
    const afterBw = resolveDecisionPrompt(paused, 'p1', 'pass').state;
    const afterSs = resolveDecisionPrompt(afterBw, 'p1', 'pass').state;

    expect(peekDecisionPrompt(afterSs)?.sourceCardName).toBe('Get Behind Me!');
  });

  it('auto-accept cancels once and pays once', () => {
    const game = threeCancelsGame();

    const after = step4_revealEncounterCards(game, { acceptOptionalTriggers: true });

    const [p1, p2] = after.players;
    expect(after.encounterDiscard.some((c) => c.card.code === FALSE_ALARM)).toBe(true);
    // Black Widow paid with one card; no other cancel was played
    expect(p1.allies[0].exhausted).toBe(true);
    expect(p1.discard).toHaveLength(1);
    expect(p2.hand.some((c) => c.card.code === GET_BEHIND_ME)).toBe(true);
  });
});

describe('Effects that cannot be canceled (Eternity 21054, #255)', () => {
  let state: GameState;

  beforeEach(() => {
    resetInstanceCounter();
    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: cardCatalog.getCard('01001a') as HeroCard,
          alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
          deckCards: Array(10).fill(cardCatalog.getCard(DECK_FILLER)!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = state.players[0].hero;
  });

  it('declares its When Revealed effect as not cancelable', () => {
    const step = adHocCatalog
      .getCard(ETERNITY)!
      .enrichment?.abilities?.find((a) => a.trigger === 'WHEN_REVEALED')?.steps;
    expect(step?.map((s) => s.effect)).toEqual(['DRAW', 'REMOVE_FROM_GAME']);
    expect(step?.every((s) => s.cannotBeCanceled === true)).toBe(true);
  });

  it('draws 1 card and is removed from the game when revealed', () => {
    const eternity = createCardInstance(adHocCatalog.getCard(ETERNITY)!);
    state.players[0].dealtEncounterCards.push(eternity);
    const handBefore = state.players[0].hand.length;

    const after = step4_revealEncounterCards(state);

    expect(after.players[0].hand.length).toBe(handBefore + 1);
    expect(after.removedFromGame.some((c) => c.instanceId === eternity.instanceId)).toBe(true);
    expect(after.encounterDiscard.some((c) => c.instanceId === eternity.instanceId)).toBe(false);
  });

  it('keeps its effects even when the reveal is cancelled by another source', () => {
    const eternity = createCardInstance(adHocCatalog.getCard(ETERNITY)!);
    state.players[0].dealtEncounterCards.push(eternity);
    state.players[0].hand.push(
      createCardInstance({
        code: 'test_cancel',
        name: 'Test Cancel',
        type: 'event',
        enrichment: {
          abilities: [
            {
              id: 'test_cancel_ability',
              timing: 'INTERRUPT',
              trigger: 'ENCOUNTER_CARD_REVEALED',
              zone: 'HAND',
              cost: { discardSelf: true },
              steps: [{ effect: 'CANCEL_WHEN_REVEALED', effectParams: {} }],
            },
          ],
        },
      } as any),
    );

    // Nothing to cancel on Eternity: the interrupt is not even offered and the card resolves.
    const after = step4_revealEncounterCards(state);

    expect(peekDecisionPrompt(after)).toBeUndefined();
    expect(after.removedFromGame.some((c) => c.instanceId === eternity.instanceId)).toBe(true);
    expect(after.players[0].hand.some((c) => c.card.code === 'test_cancel')).toBe(true);
  });

  it('a cancel stops the cancelable steps of a card and lets the flagged step resolve', () => {
    const draw = (cannotBeCanceled?: boolean) => ({
      effect: 'DRAW',
      effectParams: { count: 1, target: 'SELF' },
      ...(cannotBeCanceled ? { cannotBeCanceled } : {}),
    });
    const mixed = createCardInstance({
      code: 'test_mixed_treachery',
      name: 'Mixed Treachery',
      type: 'treachery',
      enrichment: {
        abilities: [
          {
            id: 'mixed_wr',
            timing: 'WHEN_REVEALED',
            trigger: 'WHEN_REVEALED',
            steps: [draw(), draw(true)],
          },
        ],
      },
    } as any);
    state.players[0].dealtEncounterCards.push(mixed);
    state.players[0].hand.push(
      createCardInstance({
        code: 'test_cancel',
        name: 'Test Cancel',
        type: 'event',
        enrichment: {
          abilities: [
            {
              id: 'test_cancel_ability',
              timing: 'INTERRUPT',
              trigger: 'ENCOUNTER_CARD_REVEALED',
              zone: 'HAND',
              cost: { discardSelf: true },
              steps: [{ effect: 'CANCEL_WHEN_REVEALED', effectParams: {} }],
            },
          ],
        },
      } as any),
    );
    const handBefore = state.players[0].hand.length;

    const after = step4_revealEncounterCards(state, { acceptOptionalTriggers: true });

    // -1 for the discarded cancel card, +1 for the flagged draw only
    expect(after.players[0].hand.length).toBe(handBefore - 1 + 1);
    expect(after.encounterDiscard.some((c) => c.card.code === 'test_mixed_treachery')).toBe(true);
  });

  it('canCancelEncounterReveal is false for a card whose reveal effects all cannot be canceled', () => {
    const eternity = createCardInstance(adHocCatalog.getCard(ETERNITY)!);
    const falseAlarm = createCardInstance(cardCatalog.getCard(FALSE_ALARM)!);
    const vanillaMinion = createCardInstance(cardCatalog.getCard(HYDRA_MERCENARY)!);

    expect(canCancelEncounterReveal(eternity)).toBe(false);
    expect(canCancelEncounterReveal(falseAlarm)).toBe(true);
    expect(canCancelEncounterReveal(vanillaMinion)).toBe(true);
  });

  it('canCancelEncounterReveal is false for villain and main scheme reveals (RR: cannot be canceled)', () => {
    const villain = createCardInstance(cardCatalog.getCard('01094')!);
    const mainScheme = createCardInstance(cardCatalog.getCard('01097b')!);

    expect(canCancelEncounterReveal(villain)).toBe(false);
    expect(canCancelEncounterReveal(mainScheme)).toBe(false);
  });
});
