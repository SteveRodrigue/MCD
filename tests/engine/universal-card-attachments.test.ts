import { describe, it, expect, beforeEach } from 'vitest';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { executeEffect, discardHostAttachmentsAndTuckedCards } from '@engine/effects';
import { getLegalActionsForPlayer } from '@engine/pipeline/legal-actions-generator';

describe('Universal Card Attachment & Tucked Card Engine (Issue #40, RR v1.8 p. 5, 6)', () => {
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

  describe('1. Universal Cardinality & Multi-Target Attachment (RR v1.8 p. 5)', () => {
    it('attaches cards to Villain, Player Identity, Ally, Minion, and Scheme', () => {
      const state = setupGame({
        scenarioId: 'rhino',
        players: [
          {
            id: 'p1',
            name: 'Spider-Man',
            hero: spiderManHero,
            alterEgo: peterParkerAlterEgo,
            deckCards: [cardCatalog.getCard('01005')!],
          },
        ],
        villain: rhinoVillain,
        mainScheme,
        encounterCards: cardCatalog.getCardsBySet('rhino'),
        skipMulligan: true,
      });

      const player = state.players[0];
      const ally = createCardInstance(cardCatalog.getCard('01058')!); // Daredevil
      player.allies.push(ally);

      const minion = createCardInstance(cardCatalog.getCard('01096')!); // Armored Guard
      player.engagedMinions.push(minion);

      // 1. Attach to Villain
      const rhinoSuit = createCardInstance(cardCatalog.getCard('01100')!); // Armored Rhino Suit
      const resVillain = executeEffect(
        state,
        {
          id: 'attach_villain',
          timing: 'WHEN_REVEALED',
          steps: [{ effect: 'ATTACH_TO_HOST', params: { target: 'VILLAIN' } }],
        },
        { playerId: 'p1', sourceCardInstance: rhinoSuit },
      );
      expect(resVillain.success).toBe(true);
      expect(resVillain.state.villain.attachments.some((a) => a.instanceId === rhinoSuit.instanceId)).toBe(true);

      // 2. Attach to Player Identity (e.g. Caught in a Web)
      const caughtInWeb = createCardInstance(cardCatalog.getCard('01180')!); // Caught in a Web
      const resIdentity = executeEffect(
        resVillain.state,
        {
          id: 'attach_identity',
          timing: 'WHEN_REVEALED',
          steps: [{ effect: 'ATTACH_TO_HOST', params: { target: 'HERO' } }],
        },
        { playerId: 'p1', sourceCardInstance: caughtInWeb },
      );
      expect(resIdentity.success).toBe(true);
      expect(resIdentity.state.players[0].attachments?.some((a) => a.instanceId === caughtInWeb.instanceId)).toBe(true);

      // 3. Attach to Ally (e.g. Honorary Avenger)
      const honoraryAvenger = createCardInstance(cardCatalog.getCard('01025')!); // Honorary Avenger
      const resAlly = executeEffect(
        resIdentity.state,
        {
          id: 'attach_ally',
          timing: 'ACTION',
          steps: [{ effect: 'ATTACH_TO_HOST', params: { target: 'CHOSEN_ALLY' } }],
        },
        { playerId: 'p1', sourceCardInstance: honoraryAvenger, targetInstanceId: ally.instanceId },
      );
      expect(resAlly.success).toBe(true);
      const updatedAlly = resAlly.state.players[0].allies.find((a) => a.instanceId === ally.instanceId);
      expect(updatedAlly?.attachments?.some((a) => a.instanceId === honoraryAvenger.instanceId)).toBe(true);

      // 4. Attach to Minion (e.g. Webbed Up)
      const webbedUp = createCardInstance(cardCatalog.getCard('01009')!); // Webbed Up
      const resMinion = executeEffect(
        resAlly.state,
        {
          id: 'attach_minion',
          timing: 'ACTION',
          steps: [{ effect: 'ATTACH_TO_HOST', params: { target: 'CHOSEN_MINION' } }],
        },
        { playerId: 'p1', sourceCardInstance: webbedUp, targetInstanceId: minion.instanceId },
      );
      expect(resMinion.success).toBe(true);
      const updatedMinion = resMinion.state.players[0].engagedMinions.find((m) => m.instanceId === minion.instanceId);
      expect(updatedMinion?.attachments?.some((a) => a.instanceId === webbedUp.instanceId)).toBe(true);

      // 5. Attach to Scheme
      const schemeAttachment = createCardInstance(cardCatalog.getCard('01100')!);
      const resScheme = executeEffect(
        resMinion.state,
        {
          id: 'attach_scheme',
          timing: 'WHEN_REVEALED',
          steps: [{ effect: 'ATTACH_TO_HOST', params: { target: 'MAIN_SCHEME' } }],
        },
        { playerId: 'p1', sourceCardInstance: schemeAttachment },
      );
      expect(resScheme.success).toBe(true);
      expect(resScheme.state.mainScheme.attachments?.some((a) => a.instanceId === schemeAttachment.instanceId)).toBe(true);
    });
  });

  describe('2. Cascading Discard on Host Leaving Play (RR v1.8 p. 5, 6)', () => {
    it('discards all active attachments and face-down cards underneath when a host leaves play', () => {
      const state = setupGame({
        scenarioId: 'rhino',
        players: [
          {
            id: 'p1',
            name: 'Spider-Man',
            hero: spiderManHero,
            alterEgo: peterParkerAlterEgo,
            deckCards: [cardCatalog.getCard('01005')!],
          },
        ],
        villain: rhinoVillain,
        mainScheme,
        encounterCards: cardCatalog.getCardsBySet('rhino'),
        skipMulligan: true,
      });

      const player = state.players[0];
      const minion = createCardInstance(cardCatalog.getCard('01096')!);
      const encounterAttach = createCardInstance(cardCatalog.getCard('01100')!);
      const playerAttach = createCardInstance(cardCatalog.getCard('01009')!);
      const tuckedCard = createCardInstance(cardCatalog.getCard('01108')!);

      minion.attachments = [encounterAttach, playerAttach];
      minion.cardsUnderneath = [tuckedCard];
      player.engagedMinions.push(minion);

      // Execute cascading clean-up
      discardHostAttachmentsAndTuckedCards(state, minion, player.id);

      // Encounter attachment and tucked card routed to encounter discard
      expect(state.encounterDiscard.some((c) => c.instanceId === encounterAttach.instanceId)).toBe(true);
      expect(state.encounterDiscard.some((c) => c.instanceId === tuckedCard.instanceId)).toBe(true);
      // Player attachment routed to player discard
      expect(player.discard.some((c) => c.instanceId === playerAttach.instanceId)).toBe(true);
    });
  });

  describe('3. Cards Underneath (Tucked Reserves - RR v1.8 p. 6)', () => {
    it('places and retrieves cards under host entity', () => {
      const state = setupGame({
        scenarioId: 'rhino',
        players: [
          {
            id: 'p1',
            name: 'Spider-Man',
            hero: spiderManHero,
            alterEgo: peterParkerAlterEgo,
            deckCards: [cardCatalog.getCard('01005')!],
          },
        ],
        villain: rhinoVillain,
        mainScheme,
        encounterCards: cardCatalog.getCardsBySet('rhino'),
        skipMulligan: true,
      });

      const droneCard = createCardInstance(cardCatalog.getCard('01108')!);

      // Place card under villain
      const resPlace = executeEffect(
        state,
        {
          id: 'place_under',
          timing: 'WHEN_REVEALED',
          steps: [{ effect: 'PLACE_CARD_UNDER_HOST', params: { target: 'VILLAIN' } }],
        },
        { playerId: 'p1', sourceCardInstance: droneCard },
      );

      expect(resPlace.success).toBe(true);
      expect(resPlace.state.villain.cardsUnderneath?.some((c) => c.instanceId === droneCard.instanceId)).toBe(true);
    });
  });

  describe('4. Legal Actions Discovery for Attachment Discard Abilities', () => {
    it('surfaces SPEND_RESOURCES_TO_DISCARD_ATTACHMENT in legal actions for identity attachment', () => {
      const state = setupGame({
        scenarioId: 'rhino',
        players: [
          {
            id: 'p1',
            name: 'Spider-Man',
            hero: spiderManHero,
            alterEgo: peterParkerAlterEgo,
            deckCards: [cardCatalog.getCard('01005')!, cardCatalog.getCard('01005')!],
          },
        ],
        villain: rhinoVillain,
        mainScheme,
        encounterCards: cardCatalog.getCardsBySet('rhino'),
        skipMulligan: true,
      });

      const player = state.players[0];
      player.currentForm = 'hero';
      player.activeFormCard = spiderManHero;
      player.hand = [
        createCardInstance(cardCatalog.getCard('01014')!), // Physical resource
        createCardInstance(cardCatalog.getCard('01015')!), // Energy resource
      ];

      // Attach Enhanced Ivory Horn to villain
      const ivoryHorn = createCardInstance(cardCatalog.getCard('01100')!);
      state.villain.attachments = [ivoryHorn];

      const legalReport = getLegalActionsForPlayer(state, 'p1');
      const discardAction = legalReport.allActions.find(
        (a) =>
          a.action.type === 'SPEND_RESOURCES_TO_DISCARD_ATTACHMENT' &&
          (a.action as any).attachmentInstanceId === ivoryHorn.instanceId,
      );

      expect(discardAction).toBeDefined();
    });
  });
});
