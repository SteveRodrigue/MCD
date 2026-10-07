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

  it('Enhanced Spider-Sense (treachery only) is not offered for a minion', () => {
    p1().allies = [];
    p1().hand = [createCardInstance(cardCatalog.getCard(ENHANCED_SPIDER_SENSE)!), mentalCard()];
    deal(HYDRA_MERCENARY);

    const after = step4_revealEncounterCards(state);

    expect(peekDecisionPrompt(after)).toBeUndefined();
    expect(after.players[0].engagedMinions.some((m) => m.card.code === HYDRA_MERCENARY)).toBe(true);
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
