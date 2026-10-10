import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog, CardCatalog } from '@data/importer/card-loader';
import aoaEncounterPack from '../../data/upstream/pack/aoa_encounter.json';
import {
  GameState,
  HeroCard,
  AlterEgoCard,
  CardInstance,
  StatusCard,
  NormalizedCard,
  setupGame,
  resetInstanceCounter,
  createCardInstance,
  dispatchAction,
  peekDecisionPrompt,
  step4_revealEncounterCards,
  getActiveVillain,
  getEffectiveMinionHitPoints,
  discardCardInstance,
  applyDamageToTarget,
} from '@engine/index';
import type { AttachTo } from '../../src/data/supplemental/schema';

const GENETICALLY_ENHANCED = '01163';
const SANDMAN = '01102'; // 4 hit points, 3 attack
const VULTURE = '01167'; // 4 hit points, 3 attack
const HYDRA_MERCENARY = '01101'; // 3 hit points, 1 attack
const SHOCKER = '01103'; // 3 hit points, 2 attack
const THE_FITTEST = '45109'; // Age of Apocalypse encounter set: the live loader does not load it
const CHARGE = '01099'; // an attachment, used as the base of the synthetic cards

// Ad-hoc catalog: the proof card only, imported to complement the core tests.
const theFittestRaw = (aoaEncounterPack as any[]).find((c) => c.code === THE_FITTEST);
const adHocCatalog = new CardCatalog([theFittestRaw] as any);

describe('Conditional encounter attachments (#209)', () => {
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
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
        {
          id: 'p2',
          name: 'Iron Man',
          hero: cardCatalog.getCard('01029a') as HeroCard,
          alterEgo: cardCatalog.getCard('01029b') as AlterEgoCard,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
    state.firstPlayerIndex = 0;
  });

  const engage = (playerId: string, code: string): CardInstance => {
    const minion = createCardInstance(cardCatalog.getCard(code)!);
    state.players.find((p) => p.id === playerId)!.engagedMinions.push(minion);
    return minion;
  };
  const synthetic = (code: string, attachTo: AttachTo | undefined, text = ''): NormalizedCard => ({
    ...(cardCatalog.getCard(CHARGE) as NormalizedCard),
    code,
    name: `Synthetic ${code}`,
    text,
    keywords: [],
    enrichment: { abilities: [], ...(attachTo ? { attachTo } : {}) },
  });
  const reveal = (playerId: string, card: NormalizedCard | string): CardInstance => {
    const instance = createCardInstance(
      typeof card === 'string' ? cardCatalog.getCard(card)! : card,
    );
    state.players.find((p) => p.id === playerId)!.dealtEncounterCards.push(instance);
    state = step4_revealEncounterCards(state);
    return instance;
  };
  const damageMinion = (minion: CardInstance, amount: number) => {
    state = applyDamageToTarget(state, {
      target: {
        type: 'minion',
        entity: minion,
        instanceId: minion.instanceId,
        name: minion.card.name,
        targetPlayerId: 'p1',
        attachments: minion.attachments,
        statusCards: minion.statusCards,
      },
      amount,
      sourceType: 'CARD_EFFECT',
    } as any).state;
  };
  const surged = () => state.log.some((l) => l.key === 'encounter.surge.triggered');
  const attachedTo = (instance: CardInstance) =>
    [...state.players.flatMap((p) => p.engagedMinions), ...state.villains].find((e) =>
      e.attachments?.some((a) => a.instanceId === instance.instanceId),
    );

  describe('Genetically Enhanced (01163): the minion with the highest printed hit points', () => {
    it('attaches to the minion with the highest printed hit points and to no other', () => {
      const mercenary = engage('p1', HYDRA_MERCENARY);
      const sandman = engage('p1', SANDMAN);
      const card = reveal('p1', GENETICALLY_ENHANCED);

      expect(attachedTo(card)?.instanceId).toBe(sandman.instanceId);
      expect(mercenary.attachments ?? []).toHaveLength(0);
      expect(getActiveVillain(state).attachments).toHaveLength(0);
      expect(surged()).toBe(false);
    });

    it('looks across every player when choosing the highest', () => {
      engage('p1', HYDRA_MERCENARY);
      const vulture = engage('p2', VULTURE);
      const card = reveal('p1', GENETICALLY_ENHANCED);
      expect(attachedTo(card)?.instanceId).toBe(vulture.instanceId);
    });

    it('prompts the first player when minions tie, even when another player revealed the card', () => {
      engage('p1', SANDMAN);
      const vulture = engage('p2', VULTURE);
      const card = reveal('p2', GENETICALLY_ENHANCED);

      const prompt = peekDecisionPrompt(state)!;
      expect(prompt).toBeDefined();
      expect(prompt.playerId).toBe('p1');
      expect(prompt.options.map((o) => o.id).sort()).toEqual(
        state.players.flatMap((p) => p.engagedMinions.map((m) => m.instanceId)).sort(),
      );
      expect(attachedTo(card)).toBeUndefined();

      const resolved = dispatchAction(state, {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId: 'p1',
        selectedOptionId: vulture.instanceId,
      });
      state = resolved.state;
      expect(attachedTo(card)?.instanceId).toBe(vulture.instanceId);
      expect(peekDecisionPrompt(state)).toBeUndefined();
    });

    it('gains surge when there is no minion in play: the card is discarded, not attached', () => {
      const card = reveal('p1', GENETICALLY_ENHANCED);

      expect(surged()).toBe(true);
      expect(attachedTo(card)).toBeUndefined();
      expect(
        getActiveVillain(state).attachments.some((a) => a.instanceId === card.instanceId),
      ).toBe(false);
      expect(state.encounterDiscard.some((c) => c.instanceId === card.instanceId)).toBe(true);
    });

    it('never surges twice when the card also prints Surge', () => {
      const card = synthetic(
        'SYN-SURGE',
        { host: { type: 'MINION' }, otherwise: { type: 'SURGE' } },
        'Surge.',
      );
      (card as any).keywords = ['Surge'];
      reveal('p1', card);
      // The dealt surge card may surge itself; only this card's own surges are counted.
      expect(
        state.log.filter(
          (l) => l.key === 'encounter.surge.triggered' && l.params?.card === card.name,
        ),
      ).toHaveLength(1);
    });

    it('gives the attached minion +3 hit points', () => {
      const sandman = engage('p1', SANDMAN);
      expect(getEffectiveMinionHitPoints(state, sandman)).toBe(4);
      reveal('p1', GENETICALLY_ENHANCED);
      expect(getEffectiveMinionHitPoints(state, sandman)).toBe(7);
    });

    it('lets the minion survive damage that would defeat it unmodified', () => {
      const sandman = engage('p1', SANDMAN);
      reveal('p1', GENETICALLY_ENHANCED);
      damageMinion(sandman, 5);
      expect(state.players[0].engagedMinions.some((m) => m.instanceId === sandman.instanceId)).toBe(
        true,
      );
      expect(sandman.tokens?.damage).toBe(5);
    });

    it('keeps the damage when the card leaves; the minion is defeated when damage reaches its printed hit points', () => {
      const sandman = engage('p1', SANDMAN);
      const card = reveal('p1', GENETICALLY_ENHANCED);
      sandman.tokens = { ...sandman.tokens, damage: 5 };

      discardCardInstance(state, card);

      expect(state.players[0].engagedMinions.some((m) => m.instanceId === sandman.instanceId)).toBe(
        false,
      );
      expect(state.encounterDiscard.some((c) => c.instanceId === sandman.instanceId)).toBe(true);
    });

    it('keeps the minion alive, damage unchanged, when the damage is still below its printed hit points', () => {
      const sandman = engage('p1', SANDMAN);
      const card = reveal('p1', GENETICALLY_ENHANCED);
      sandman.tokens = { ...sandman.tokens, damage: 3 };

      discardCardInstance(state, card);

      expect(state.players[0].engagedMinions.some((m) => m.instanceId === sandman.instanceId)).toBe(
        true,
      );
      expect(sandman.tokens?.damage).toBe(3);
      expect(getEffectiveMinionHitPoints(state, sandman)).toBe(4);
    });
  });

  describe('The Fittest (45109): highest printed hit points, a tough status card and +5 hit points', () => {
    it('attaches to the minion with the highest printed hit points and gives it a tough status card', () => {
      const mercenary = engage('p1', HYDRA_MERCENARY);
      const sandman = engage('p1', SANDMAN);
      const card = reveal('p1', adHocCatalog.getCard(THE_FITTEST)!);

      expect(attachedTo(card)?.instanceId).toBe(sandman.instanceId);
      expect(sandman.statusCards).toContain(StatusCard.TOUGH);
      expect(mercenary.statusCards ?? []).not.toContain(StatusCard.TOUGH);
      expect(getEffectiveMinionHitPoints(state, sandman)).toBe(9);
    });

    it('gives the tough status card to the minion the first player chose on a tie', () => {
      const sandman = engage('p1', SANDMAN);
      const vulture = engage('p2', VULTURE);
      reveal('p2', adHocCatalog.getCard(THE_FITTEST)!);
      state = dispatchAction(state, {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId: 'p1',
        selectedOptionId: vulture.instanceId,
      }).state;

      const inState = (id: string) =>
        state.players.flatMap((p) => p.engagedMinions).find((m) => m.instanceId === id)!;
      expect(inState(vulture.instanceId).statusCards).toContain(StatusCard.TOUGH);
      expect(inState(sandman.instanceId).statusCards ?? []).not.toContain(StatusCard.TOUGH);
    });

    it('with no minion in play it gains surge and gives no tough status card', () => {
      // Surge reveals the next encounter card; pin the deck so the shuffled one cannot add Tough.
      state.encounterDeck = [createCardInstance(cardCatalog.getCard(CHARGE)!)];
      const card = reveal('p1', adHocCatalog.getCard(THE_FITTEST)!);
      expect(surged()).toBe(true);
      expect(attachedTo(card)).toBeUndefined();
      expect(getActiveVillain(state).statusCards ?? []).not.toContain(StatusCard.TOUGH);
    });
  });

  describe('every host and fallback kind', () => {
    it('without attachTo the card attaches to the villain, as before', () => {
      const card = reveal('p1', synthetic('SYN-DEFAULT', undefined));
      expect(attachedTo(card)?.instanceId).toBe(getActiveVillain(state).instanceId);
    });

    it('attaches to a minion matching a filter, otherwise to the villain', () => {
      const attachTo: AttachTo = {
        host: { type: 'MINION', filter: { names: ['Sandman'] } },
        otherwise: { type: 'VILLAIN' },
      };
      const sandman = engage('p1', SANDMAN);
      const first = reveal('p1', synthetic('SYN-NAMED', attachTo));
      expect(attachedTo(first)?.instanceId).toBe(sandman.instanceId);

      state.players[0].engagedMinions = [];
      const second = reveal('p1', synthetic('SYN-NAMED', attachTo));
      expect(attachedTo(second)?.instanceId).toBe(getActiveVillain(state).instanceId);
      expect(surged()).toBe(false);
    });

    it('a single matching minion attaches without a prompt', () => {
      engage('p1', SHOCKER);
      reveal('p1', synthetic('SYN-ANY', { host: { type: 'MINION' } }));
      expect(peekDecisionPrompt(state)).toBeUndefined();
    });

    it('several candidates without a superlative are all offered to the first player', () => {
      engage('p1', SHOCKER);
      engage('p2', HYDRA_MERCENARY);
      reveal('p2', synthetic('SYN-ANY', { host: { type: 'MINION' } }));
      const prompt = peekDecisionPrompt(state)!;
      expect(prompt.playerId).toBe('p1');
      expect(prompt.options).toHaveLength(2);
    });

    it('ENEMY includes the villain: the lowest printed attack wins', () => {
      const mercenary = engage('p1', HYDRA_MERCENARY); // attack 1, Rhino has more
      const card = reveal(
        'p1',
        synthetic('SYN-LOW', {
          host: {
            type: 'ENEMY',
            superlative: { stat: 'PRINTED_ATTACK', extreme: 'LOWEST' },
          },
          otherwise: { type: 'SURGE' },
        }),
      );
      expect(attachedTo(card)?.instanceId).toBe(mercenary.instanceId);
    });

    it('ENEMY with no minion in play considers the villain', () => {
      const card = reveal(
        'p1',
        synthetic('SYN-LOW', {
          host: { type: 'ENEMY', superlative: { stat: 'PRINTED_ATTACK', extreme: 'HIGHEST' } },
          otherwise: { type: 'SURGE' },
        }),
      );
      expect(attachedTo(card)?.instanceId).toBe(getActiveVillain(state).instanceId);
      expect(surged()).toBe(false);
    });

    it('withoutCopyAttached skips an enemy already carrying a copy, then falls back', () => {
      const attachTo: AttachTo = {
        host: { type: 'MINION', withoutCopyAttached: true },
        otherwise: { type: 'SURGE' },
      };
      const shocker = engage('p1', SHOCKER);
      const first = reveal('p1', synthetic('SYN-UNIQ', attachTo));
      expect(attachedTo(first)?.instanceId).toBe(shocker.instanceId);

      const second = reveal('p1', synthetic('SYN-UNIQ', attachTo));
      expect(attachedTo(second)).toBeUndefined();
      expect(surged()).toBe(true);
    });

    it('a second host as the fallback', () => {
      engage('p1', HYDRA_MERCENARY);
      const card = reveal(
        'p1',
        synthetic('SYN-FALLBACK', {
          host: { type: 'MINION', filter: { names: ['Nobody'] } },
          otherwise: { type: 'ENEMY', superlative: { stat: 'PRINTED_ATTACK', extreme: 'HIGHEST' } },
        }),
      );
      expect(attachedTo(card)?.instanceId).toBe(getActiveVillain(state).instanceId);
    });
  });

  describe('regressions', () => {
    it('the three Rhino attachments still attach to Rhino (#175)', () => {
      for (const code of ['01098', '01099', '01100']) {
        const card = reveal('p1', code);
        expect(attachedTo(card)?.instanceId).toBe(getActiveVillain(state).instanceId);
      }
    });

    it('keeps card conservation: the attachment is in exactly one place', () => {
      engage('p1', SANDMAN);
      const card = reveal('p1', GENETICALLY_ENHANCED);
      const everyCard = [
        ...state.encounterDiscard,
        ...state.encounterDeck,
        ...state.players.flatMap((p) => [
          ...p.dealtEncounterCards,
          ...p.engagedMinions.flatMap((m) => m.attachments ?? []),
        ]),
        ...state.villains.flatMap((v) => v.attachments ?? []),
      ].filter((c) => c.instanceId === card.instanceId);
      expect(everyCard).toHaveLength(1);
    });

    it('the attachment leaves play with its defeated host', () => {
      const sandman = engage('p1', SANDMAN);
      const card = reveal('p1', GENETICALLY_ENHANCED);
      damageMinion(sandman, 7);
      expect(state.players[0].engagedMinions).toHaveLength(0);
      expect(state.encounterDiscard.some((c) => c.instanceId === card.instanceId)).toBe(true);
    });
  });
});
