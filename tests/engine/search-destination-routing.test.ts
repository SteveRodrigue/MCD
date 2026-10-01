import { describe, it, expect, beforeEach } from 'vitest';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { executeEffect } from '@engine/effects';
import { dispatchAction } from '@engine/pipeline/action-dispatcher';

describe('SEARCH selectedDestination Routing - All 8 Choices (RR v1.8 p. 19, 26)', () => {
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

  function createTestState() {
    return setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: [],
        },
      ],
      villain: rhinoVillain,
      mainScheme,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
  }

  // 1. HAND
  describe('selectedDestination: HAND', () => {
    it('moves card from discard/deck to player.hand (autoSelect)', () => {
      const state = createTestState();
      const player = state.players[0];
      const card = createCardInstance(cardCatalog.getCard('01005')!);
      player.deck = [card];
      player.hand = [];

      const result = executeEffect(
        state,
        {
          effect: 'SEARCH',
          effectParams: {
            source: 'PLAYER_DECK',
            takeCount: 1,
            selectedDestination: 'HAND',
            autoSelectIfUnambiguous: true,
            isVoluntary: false,
          },
        },
        { playerId: 'p1' },
      );

      expect(result.success).toBe(true);
      expect(result.state.players[0].hand.length).toBe(1);
      expect(result.state.players[0].hand[0].instanceId).toBe(card.instanceId);
      expect(result.state.players[0].deck.length).toBe(0);
    });

    it('moves card from deck to player.hand via decision prompt resolution', () => {
      const state = createTestState();
      const player = state.players[0];
      const card1 = createCardInstance(cardCatalog.getCard('01005')!);
      const card2 = createCardInstance(cardCatalog.getCard('01006')!);
      player.deck = [card1, card2];
      player.hand = [];

      const result = executeEffect(
        state,
        {
          effect: 'SEARCH',
          effectParams: {
            source: 'PLAYER_DECK',
            takeCount: 1,
            selectedDestination: 'HAND',
            autoSelectIfUnambiguous: false,
          },
        },
        { playerId: 'p1' },
      );

      expect(result.state.pendingDecisionPrompt).toBeDefined();

      const resolved = dispatchAction(result.state, {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId: 'p1',
        selectedOptionId: card1.instanceId,
      });

      expect(resolved.result.success).toBe(true);
      expect(resolved.state.players[0].hand.some((c) => c.instanceId === card1.instanceId)).toBe(
        true,
      );
      expect(resolved.state.players[0].deck.some((c) => c.instanceId === card1.instanceId)).toBe(
        false,
      );
    });
  });

  // 2. TABLEAU
  describe('selectedDestination: TABLEAU', () => {
    it('moves player upgrade directly to player.tableau', () => {
      const state = createTestState();
      const player = state.players[0];
      const upgradeCard = cardCatalog.getCard('01008')!; // Web-Shooter upgrade
      const upgradeInst = createCardInstance(upgradeCard);
      player.deck = [upgradeInst];
      player.tableau = [];

      const result = executeEffect(
        state,
        {
          effect: 'SEARCH',
          effectParams: {
            source: 'PLAYER_DECK',
            takeCount: 1,
            selectedDestination: 'TABLEAU',
            autoSelectIfUnambiguous: true,
            isVoluntary: false,
          },
        },
        { playerId: 'p1' },
      );

      expect(result.success).toBe(true);
      expect(
        result.state.players[0].tableau.some((c) => c.instanceId === upgradeInst.instanceId),
      ).toBe(true);
      expect(result.state.players[0].deck.length).toBe(0);
    });

    it('moves side scheme into state.sideSchemes with calculated base threat', () => {
      const state = createTestState();
      const breakinCard = cardCatalog.getCard('01107')!; // Breakin' & Takin'
      const sideSchemeInst = createCardInstance(breakinCard);
      state.encounterDeck = [sideSchemeInst];
      state.sideSchemes = [];

      const result = executeEffect(
        state,
        {
          effect: 'SEARCH',
          effectParams: {
            source: 'ENCOUNTER_DECK',
            takeCount: 1,
            selectedDestination: 'TABLEAU',
            autoSelectIfUnambiguous: true,
            isVoluntary: false,
          },
        },
        { playerId: 'p1' },
      );

      expect(result.success).toBe(true);
      const sideScheme = result.state.sideSchemes.find(
        (s) => s.instanceId === sideSchemeInst.instanceId,
      );
      expect(sideScheme).toBeDefined();
      expect(sideScheme!.threat).toBeGreaterThan(0);
    });

    it('moves side scheme into state.sideSchemes via prompt resolution', () => {
      const state = createTestState();
      const breakinCard = cardCatalog.getCard('01107')!;
      const sideSchemeInst = createCardInstance(breakinCard);
      const dummyCard = createCardInstance(cardCatalog.getCard('01110')!);
      state.encounterDeck = [sideSchemeInst, dummyCard];
      state.sideSchemes = [];

      const result = executeEffect(
        state,
        {
          effect: 'SEARCH',
          effectParams: {
            source: 'ENCOUNTER_DECK',
            takeCount: 1,
            selectedDestination: 'TABLEAU',
            autoSelectIfUnambiguous: false,
          },
        },
        { playerId: 'p1' },
      );

      expect(result.state.pendingDecisionPrompt).toBeDefined();

      const resolved = dispatchAction(result.state, {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId: 'p1',
        selectedOptionId: sideSchemeInst.instanceId,
      });

      expect(resolved.result.success).toBe(true);
      const sideScheme = resolved.state.sideSchemes.find(
        (s) => s.instanceId === sideSchemeInst.instanceId,
      );
      expect(sideScheme).toBeDefined();
    });
  });

  // 3. DECK_TOP
  describe('selectedDestination: DECK_TOP', () => {
    it('places selected card at index 0 of player.deck (autoSelect)', () => {
      const state = createTestState();
      const player = state.players[0];
      const targetCard = createCardInstance(cardCatalog.getCard('01005')!);
      const existing1 = createCardInstance(cardCatalog.getCard('01006')!);
      const existing2 = createCardInstance(cardCatalog.getCard('01007')!);
      player.discard = [targetCard];
      player.deck = [existing1, existing2];

      const result = executeEffect(
        state,
        {
          effect: 'SEARCH',
          effectParams: {
            source: 'PLAYER_DISCARD',
            takeCount: 1,
            selectedDestination: 'DECK_TOP',
            autoSelectIfUnambiguous: true,
            isVoluntary: false,
          },
        },
        { playerId: 'p1' },
      );

      expect(result.success).toBe(true);
      expect(result.state.players[0].deck[0].instanceId).toBe(targetCard.instanceId);
      expect(result.state.players[0].deck.length).toBe(3);
      expect(result.state.players[0].discard.length).toBe(0);
    });

    it('places selected card at index 0 of player.deck via prompt resolution', () => {
      const state = createTestState();
      const player = state.players[0];
      const targetCard = createCardInstance(cardCatalog.getCard('01005')!);
      const otherCard = createCardInstance(cardCatalog.getCard('01006')!);
      const existing = createCardInstance(cardCatalog.getCard('01007')!);
      player.discard = [targetCard, otherCard];
      player.deck = [existing];

      const result = executeEffect(
        state,
        {
          effect: 'SEARCH',
          effectParams: {
            source: 'PLAYER_DISCARD',
            takeCount: 1,
            selectedDestination: 'DECK_TOP',
            autoSelectIfUnambiguous: false,
          },
        },
        { playerId: 'p1' },
      );

      expect(result.state.pendingDecisionPrompt).toBeDefined();

      const resolved = dispatchAction(result.state, {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId: 'p1',
        selectedOptionId: targetCard.instanceId,
      });

      expect(resolved.result.success).toBe(true);
      expect(resolved.state.players[0].deck[0].instanceId).toBe(targetCard.instanceId);
      expect(resolved.state.players[0].deck.length).toBe(2);
    });
  });

  // 4. DECK_BOTTOM
  describe('selectedDestination: DECK_BOTTOM', () => {
    it('places selected card at the end of player.deck (autoSelect)', () => {
      const state = createTestState();
      const player = state.players[0];
      const targetCard = createCardInstance(cardCatalog.getCard('01005')!);
      const existing1 = createCardInstance(cardCatalog.getCard('01006')!);
      const existing2 = createCardInstance(cardCatalog.getCard('01007')!);
      player.discard = [targetCard];
      player.deck = [existing1, existing2];

      const result = executeEffect(
        state,
        {
          effect: 'SEARCH',
          effectParams: {
            source: 'PLAYER_DISCARD',
            takeCount: 1,
            selectedDestination: 'DECK_BOTTOM',
            autoSelectIfUnambiguous: true,
            isVoluntary: false,
          },
        },
        { playerId: 'p1' },
      );

      expect(result.success).toBe(true);
      const deck = result.state.players[0].deck;
      expect(deck[deck.length - 1].instanceId).toBe(targetCard.instanceId);
      expect(deck[0].instanceId).toBe(existing1.instanceId);
      expect(deck.length).toBe(3);
    });

    it('places selected card at the end of player.deck via prompt resolution', () => {
      const state = createTestState();
      const player = state.players[0];
      const targetCard = createCardInstance(cardCatalog.getCard('01005')!);
      const otherCard = createCardInstance(cardCatalog.getCard('01006')!);
      const existing = createCardInstance(cardCatalog.getCard('01007')!);
      player.discard = [targetCard, otherCard];
      player.deck = [existing];

      const result = executeEffect(
        state,
        {
          effect: 'SEARCH',
          effectParams: {
            source: 'PLAYER_DISCARD',
            takeCount: 1,
            selectedDestination: 'DECK_BOTTOM',
            autoSelectIfUnambiguous: false,
          },
        },
        { playerId: 'p1' },
      );

      expect(result.state.pendingDecisionPrompt).toBeDefined();

      const resolved = dispatchAction(result.state, {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId: 'p1',
        selectedOptionId: targetCard.instanceId,
      });

      expect(resolved.result.success).toBe(true);
      const deck = resolved.state.players[0].deck;
      expect(deck[deck.length - 1].instanceId).toBe(targetCard.instanceId);
      expect(deck[0].instanceId).toBe(existing.instanceId);
      expect(deck.length).toBe(2);
    });
  });

  // 5. DECK_SHUFFLE
  describe('selectedDestination: DECK_SHUFFLE', () => {
    it('moves card from discard to deck and shuffles deck (autoSelect)', () => {
      const state = createTestState();
      const player = state.players[0];
      const targetCard = createCardInstance(cardCatalog.getCard('01005')!);
      const cardA = createCardInstance(cardCatalog.getCard('01006')!);
      const cardB = createCardInstance(cardCatalog.getCard('01007')!);
      player.discard = [targetCard];
      player.deck = [cardA, cardB];

      const result = executeEffect(
        state,
        {
          effect: 'SEARCH',
          effectParams: {
            source: 'PLAYER_DISCARD',
            takeCount: 1,
            selectedDestination: 'DECK_SHUFFLE',
            autoSelectIfUnambiguous: true,
            isVoluntary: false,
          },
        },
        { playerId: 'p1' },
      );

      expect(result.success).toBe(true);
      expect(result.state.players[0].deck.length).toBe(3);
      expect(result.state.players[0].deck.some((c) => c.instanceId === targetCard.instanceId)).toBe(
        true,
      );
      expect(result.state.players[0].discard.length).toBe(0);
    });

    it('moves card from discard to deck and shuffles deck via prompt resolution', () => {
      const state = createTestState();
      const player = state.players[0];
      const targetCard = createCardInstance(cardCatalog.getCard('01005')!);
      const otherCard = createCardInstance(cardCatalog.getCard('01006')!);
      const existing = createCardInstance(cardCatalog.getCard('01007')!);
      player.discard = [targetCard, otherCard];
      player.deck = [existing];

      const result = executeEffect(
        state,
        {
          effect: 'SEARCH',
          effectParams: {
            source: 'PLAYER_DISCARD',
            takeCount: 1,
            selectedDestination: 'DECK_SHUFFLE',
            autoSelectIfUnambiguous: false,
          },
        },
        { playerId: 'p1' },
      );

      expect(result.state.pendingDecisionPrompt).toBeDefined();

      const resolved = dispatchAction(result.state, {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId: 'p1',
        selectedOptionId: targetCard.instanceId,
      });

      expect(resolved.result.success).toBe(true);
      expect(resolved.state.players[0].deck.length).toBe(2);
      expect(
        resolved.state.players[0].deck.some((c) => c.instanceId === targetCard.instanceId),
      ).toBe(true);
      expect(
        resolved.state.players[0].discard.some((c) => c.instanceId === targetCard.instanceId),
      ).toBe(false);
      expect(
        resolved.state.players[0].discard.some((c) => c.instanceId === otherCard.instanceId),
      ).toBe(true);
    });
  });

  // 6. DISCARD
  describe('selectedDestination: DISCARD', () => {
    it('moves card from deck to player.discard (autoSelect)', () => {
      const state = createTestState();
      const player = state.players[0];
      const card = createCardInstance(cardCatalog.getCard('01005')!);
      player.deck = [card];
      player.discard = [];

      const result = executeEffect(
        state,
        {
          effect: 'SEARCH',
          effectParams: {
            source: 'PLAYER_DECK',
            takeCount: 1,
            selectedDestination: 'DISCARD',
            autoSelectIfUnambiguous: true,
            isVoluntary: false,
          },
        },
        { playerId: 'p1' },
      );

      expect(result.success).toBe(true);
      expect(result.state.players[0].discard.length).toBe(1);
      expect(result.state.players[0].discard[0].instanceId).toBe(card.instanceId);
      expect(result.state.players[0].deck.length).toBe(0);
    });

    it('moves card from deck to player.discard via prompt resolution', () => {
      const state = createTestState();
      const player = state.players[0];
      const card1 = createCardInstance(cardCatalog.getCard('01005')!);
      const card2 = createCardInstance(cardCatalog.getCard('01006')!);
      player.deck = [card1, card2];
      player.discard = [];

      const result = executeEffect(
        state,
        {
          effect: 'SEARCH',
          effectParams: {
            source: 'PLAYER_DECK',
            takeCount: 1,
            selectedDestination: 'DISCARD',
            autoSelectIfUnambiguous: false,
          },
        },
        { playerId: 'p1' },
      );

      expect(result.state.pendingDecisionPrompt).toBeDefined();

      const resolved = dispatchAction(result.state, {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId: 'p1',
        selectedOptionId: card1.instanceId,
      });

      expect(resolved.result.success).toBe(true);
      expect(resolved.state.players[0].discard.some((c) => c.instanceId === card1.instanceId)).toBe(
        true,
      );
      expect(resolved.state.players[0].deck.some((c) => c.instanceId === card1.instanceId)).toBe(
        false,
      );
    });
  });

  // 7. ATTACH_TO_TARGET
  describe('selectedDestination: ATTACH_TO_TARGET', () => {
    it('attaches searched card to villain host (autoSelect)', () => {
      const state = createTestState();
      const armorCard = cardCatalog.getCard('01110')!; // Armored Rhino Suit
      const armorInst = createCardInstance(armorCard);
      state.encounterDeck = [armorInst];
      state.villain.attachments = [];

      const result = executeEffect(
        state,
        {
          effect: 'SEARCH',
          effectParams: {
            source: 'ENCOUNTER_DECK',
            takeCount: 1,
            target: 'VILLAIN',
            selectedDestination: 'ATTACH_TO_TARGET',
            autoSelectIfUnambiguous: true,
            isVoluntary: false,
          },
        },
        { playerId: 'p1' },
      );

      expect(result.success).toBe(true);
      expect(
        result.state.villain.attachments?.some((c) => c.instanceId === armorInst.instanceId),
      ).toBe(true);
      expect(result.state.encounterDeck.length).toBe(0);
    });

    it('attaches searched card to villain host via prompt resolution', () => {
      const state = createTestState();
      const armorCard = cardCatalog.getCard('01110')!;
      const armorInst = createCardInstance(armorCard);
      const dummyCard = createCardInstance(cardCatalog.getCard('01111')!);
      state.encounterDeck = [armorInst, dummyCard];
      state.villain.attachments = [];

      const result = executeEffect(
        state,
        {
          effect: 'SEARCH',
          effectParams: {
            source: 'ENCOUNTER_DECK',
            takeCount: 1,
            target: 'VILLAIN',
            selectedDestination: 'ATTACH_TO_TARGET',
            autoSelectIfUnambiguous: false,
          },
        },
        { playerId: 'p1' },
      );

      expect(result.state.pendingDecisionPrompt).toBeDefined();

      const resolved = dispatchAction(result.state, {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId: 'p1',
        selectedOptionId: armorInst.instanceId,
      });

      expect(resolved.result.success).toBe(true);
      expect(
        resolved.state.villain.attachments?.some((c) => c.instanceId === armorInst.instanceId),
      ).toBe(true);
      expect(resolved.state.encounterDeck.some((c) => c.instanceId === armorInst.instanceId)).toBe(
        false,
      );
    });
  });

  // 8. REVEAL
  describe('selectedDestination: REVEAL', () => {
    it('reveals encounter card and resolves its effects (autoSelect)', () => {
      const state = createTestState();
      const breakinCard = cardCatalog.getCard('01107')!; // Side scheme with WHEN_REVEALED threat
      const breakinInst = createCardInstance(breakinCard);
      state.encounterDeck = [breakinInst];
      state.sideSchemes = [];

      const result = executeEffect(
        state,
        {
          effect: 'SEARCH',
          effectParams: {
            source: 'ENCOUNTER_DECK',
            takeCount: 1,
            selectedDestination: 'REVEAL',
            autoSelectIfUnambiguous: true,
            isVoluntary: false,
          },
        },
        { playerId: 'p1' },
      );

      expect(result.success).toBe(true);
      const sideScheme = result.state.sideSchemes.find(
        (s) => s.instanceId === breakinInst.instanceId,
      );
      expect(sideScheme).toBeDefined();
      // Breakin & Takin base threat is 2 + 1 when revealed per player = 3
      expect(sideScheme!.threat).toBe(3);
    });

    it('reveals encounter card and resolves its effects via prompt resolution', () => {
      const state = createTestState();
      const breakinCard = cardCatalog.getCard('01107')!;
      const breakinInst = createCardInstance(breakinCard);
      const dummyCard = createCardInstance(cardCatalog.getCard('01110')!);
      state.encounterDeck = [breakinInst, dummyCard];
      state.sideSchemes = [];

      const result = executeEffect(
        state,
        {
          effect: 'SEARCH',
          effectParams: {
            source: 'ENCOUNTER_DECK',
            takeCount: 1,
            selectedDestination: 'REVEAL',
            autoSelectIfUnambiguous: false,
          },
        },
        { playerId: 'p1' },
      );

      expect(result.state.pendingDecisionPrompt).toBeDefined();

      const resolved = dispatchAction(result.state, {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId: 'p1',
        selectedOptionId: breakinInst.instanceId,
      });

      expect(resolved.result.success).toBe(true);
      const sideScheme = resolved.state.sideSchemes.find(
        (s) => s.instanceId === breakinInst.instanceId,
      );
      expect(sideScheme).toBeDefined();
      expect(sideScheme!.threat).toBe(3);
    });
  });
});
