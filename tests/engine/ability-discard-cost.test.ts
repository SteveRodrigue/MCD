import { describe, it, expect, beforeEach } from 'vitest';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { dispatchAction } from '../../src/engine/pipeline/action-dispatcher';
import { getLegalActionsForPlayer } from '../../src/engine/pipeline/legal-actions-generator';
import { canInitiateAbility } from '../../src/engine/pipeline/legality-checker';
import { CardInstance, GameState, HeroCard, AlterEgoCard } from '../../src/engine/models';

describe('Hand Card Discard Ability Cost & Alpha Flight Station (#45 / ADR-0055)', () => {
  let state: GameState;
  let captainMarvelHero: HeroCard;
  let carolDanversAlterEgo: AlterEgoCard;
  let rhinoVillain: any;
  let mainScheme: any;

  beforeEach(() => {
    captainMarvelHero = cardCatalog.getCard('01010a') as HeroCard;
    carolDanversAlterEgo = cardCatalog.getCard('01010b') as AlterEgoCard;
    rhinoVillain = cardCatalog.getCard('01094')!;
    mainScheme = cardCatalog.getCard('01097')!;

    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Carol Danvers',
          hero: captainMarvelHero,
          alterEgo: carolDanversAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: rhinoVillain,
      mainScheme,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    state.players[0].currentForm = 'alter_ego';
    state.players[0].activeFormCard = carolDanversAlterEgo;
  });

  describe('1. Empty Hand Legality Invariant (RR v1.8 p. 8, 11, 15)', () => {
    it('Cannot initiate Alpha Flight Station when hand is empty (0 cards in hand)', () => {
      const player = state.players[0];
      player.hand = [];

      const afsCard = cardCatalog.getCard('01015')!;
      const afsInst: CardInstance = createCardInstance(afsCard);
      player.tableau = [afsInst];

      const ability = afsCard.enrichment!.abilities![0];

      // 1. Legality check returns allowed: false
      const check = canInitiateAbility(state, player.id, ability, afsInst);
      expect(check.allowed).toBe(false);
      expect(check.reason).toMatch(/no cards in hand/i);

      // 2. Action generator does not surface Alpha Flight Station activation
      const legalReport = getLegalActionsForPlayer(state, player.id);
      const afsAction = legalReport.boardActions.find(
        (a) =>
          a.action.type === 'USE_CARD_ABILITY' &&
          (a.action as any).cardInstanceId === afsInst.instanceId,
      );
      expect(afsAction).toBeUndefined();

      // 3. Direct action dispatch fails
      const res = dispatchAction(state, {
        type: 'USE_CARD_ABILITY',
        playerId: player.id,
        cardInstanceId: afsInst.instanceId,
        abilityId: ability.id,
      });
      expect(res.result.success).toBe(false);
      expect(res.result.error).toMatch(/discard cards must be selected|no cards in hand/i);
      expect(afsInst.exhausted).toBe(false);
    });
  });

  describe('2. Form Legality: Action timing usable in both Hero and Alter-Ego forms', () => {
    it('Alpha Flight Station is legal in Alter-Ego form when hand has cards', () => {
      const player = state.players[0];
      player.currentForm = 'alter_ego';
      player.activeFormCard = carolDanversAlterEgo;

      const dummyCard = cardCatalog.getCard('01005')!;
      player.hand = [createCardInstance(dummyCard)];

      const afsCard = cardCatalog.getCard('01015')!;
      const afsInst: CardInstance = createCardInstance(afsCard);
      player.tableau = [afsInst];

      const legalReport = getLegalActionsForPlayer(state, player.id);
      const afsAction = legalReport.boardActions.find(
        (a) =>
          a.action.type === 'USE_CARD_ABILITY' &&
          (a.action as any).cardInstanceId === afsInst.instanceId,
      );
      expect(afsAction).toBeDefined();
      expect(afsAction?.requiresModal).toBe('payment');
      expect(afsAction?.badge).toBe('DISCARD 1 CARD');
    });

    it('Alpha Flight Station is legal in Hero form when hand has cards', () => {
      const player = state.players[0];
      player.currentForm = 'hero';
      player.activeFormCard = captainMarvelHero;

      const dummyCard = cardCatalog.getCard('01005')!;
      player.hand = [createCardInstance(dummyCard)];

      const afsCard = cardCatalog.getCard('01015')!;
      const afsInst: CardInstance = createCardInstance(afsCard);
      player.tableau = [afsInst];

      const legalReport = getLegalActionsForPlayer(state, player.id);
      const afsAction = legalReport.boardActions.find(
        (a) =>
          a.action.type === 'USE_CARD_ABILITY' &&
          (a.action as any).cardInstanceId === afsInst.instanceId,
      );
      expect(afsAction).toBeDefined();
      expect(afsAction?.requiresModal).toBe('payment');
      expect(afsAction?.badge).toBe('DISCARD 1 CARD');
    });
  });

  describe('3. Player Agency Selection & Discard Execution', () => {
    it('Discards chosen card B, exhausts Alpha Flight Station, and draws 2 cards as Carol Danvers', () => {
      const player = state.players[0];
      player.currentForm = 'alter_ego';
      player.activeFormCard = carolDanversAlterEgo;

      const dummyCard = cardCatalog.getCard('01005')!;
      const cardA = { ...createCardInstance(dummyCard), instanceId: 'card_a' };
      const cardB = { ...createCardInstance(dummyCard), instanceId: 'card_b' };
      const cardC = { ...createCardInstance(dummyCard), instanceId: 'card_c' };

      player.hand = [cardA, cardB, cardC];
      player.discard = [];

      const afsCard = cardCatalog.getCard('01015')!;
      const afsInst: CardInstance = createCardInstance(afsCard);
      player.tableau = [afsInst];

      const res = dispatchAction(state, {
        type: 'USE_CARD_ABILITY',
        playerId: player.id,
        cardInstanceId: afsInst.instanceId,
        abilityId: 'alpha_flight_station',
        discardCardInstanceIds: ['card_b'],
      });

      expect(res.result.success).toBe(true);

      const updatedPlayer = res.state.players[0];
      const updatedAfs = updatedPlayer.tableau.find((c) => c.instanceId === afsInst.instanceId);
      expect(updatedAfs?.exhausted).toBe(true);

      // Card B was discarded
      expect(updatedPlayer.discard.some((c) => c.instanceId === 'card_b')).toBe(true);
      expect(updatedPlayer.hand.some((c) => c.instanceId === 'card_b')).toBe(false);

      // Cards A and C remain in hand
      expect(updatedPlayer.hand.some((c) => c.instanceId === 'card_a')).toBe(true);
      expect(updatedPlayer.hand.some((c) => c.instanceId === 'card_c')).toBe(true);

      // Carol Danvers dynamicBonus (+1 to 1 draw = 2 drawn cards)
      // Hand had 3, discarded 1 = 2 remaining + 2 drawn = 4 cards
      expect(updatedPlayer.hand.length).toBe(4);
    });

    it('Discards chosen card B and draws 1 card as Captain Marvel (Hero form)', () => {
      const player = state.players[0];
      player.currentForm = 'hero';
      player.activeFormCard = captainMarvelHero;

      const dummyCard = cardCatalog.getCard('01005')!;
      const cardA = { ...createCardInstance(dummyCard), instanceId: 'card_a' };
      const cardB = { ...createCardInstance(dummyCard), instanceId: 'card_b' };
      const cardC = { ...createCardInstance(dummyCard), instanceId: 'card_c' };

      player.hand = [cardA, cardB, cardC];
      player.discard = [];

      const afsCard = cardCatalog.getCard('01015')!;
      const afsInst: CardInstance = createCardInstance(afsCard);
      player.tableau = [afsInst];

      const res = dispatchAction(state, {
        type: 'USE_CARD_ABILITY',
        playerId: player.id,
        cardInstanceId: afsInst.instanceId,
        abilityId: 'alpha_flight_station',
        discardCardInstanceIds: ['card_b'],
      });

      expect(res.result.success).toBe(true);

      const updatedPlayer = res.state.players[0];
      const updatedAfs = updatedPlayer.tableau.find((c) => c.instanceId === afsInst.instanceId);
      expect(updatedAfs?.exhausted).toBe(true);

      // Card B was discarded
      expect(updatedPlayer.discard.some((c) => c.instanceId === 'card_b')).toBe(true);
      expect(updatedPlayer.hand.some((c) => c.instanceId === 'card_b')).toBe(false);

      // Captain Marvel gets normal 1 draw (dynamicBonus for Carol Danvers does not apply)
      // Hand had 3, discarded 1 = 2 remaining + 1 drawn = 3 cards
      expect(updatedPlayer.hand.length).toBe(3);
    });
  });

  describe('4. Rejection of Missing Discard Selection', () => {
    it('Rejects dispatch without discardCardInstanceIds and leaves state unmodified', () => {
      const player = state.players[0];
      const dummyCard = cardCatalog.getCard('01005')!;
      player.hand = [createCardInstance(dummyCard), createCardInstance(dummyCard)];
      player.discard = [];

      const afsCard = cardCatalog.getCard('01015')!;
      const afsInst: CardInstance = createCardInstance(afsCard);
      player.tableau = [afsInst];

      const res = dispatchAction(state, {
        type: 'USE_CARD_ABILITY',
        playerId: player.id,
        cardInstanceId: afsInst.instanceId,
        abilityId: 'alpha_flight_station',
      });

      expect(res.result.success).toBe(false);
      expect(res.result.error).toMatch(/discard cards must be selected from hand/i);
      expect(afsInst.exhausted).toBe(false);
      expect(res.state.players[0].hand.length).toBe(2);
      expect(res.state.players[0].discard.length).toBe(0);
    });

    it('Rejects dispatch if selected card ID is not in hand', () => {
      const player = state.players[0];
      const dummyCard = cardCatalog.getCard('01005')!;
      player.hand = [createCardInstance(dummyCard)];

      const afsCard = cardCatalog.getCard('01015')!;
      const afsInst: CardInstance = createCardInstance(afsCard);
      player.tableau = [afsInst];

      const res = dispatchAction(state, {
        type: 'USE_CARD_ABILITY',
        playerId: player.id,
        cardInstanceId: afsInst.instanceId,
        abilityId: 'alpha_flight_station',
        discardCardInstanceIds: ['non_existent_card_id'],
      });

      expect(res.result.success).toBe(false);
      expect(res.result.error).toMatch(/not found in hand/i);
      expect(afsInst.exhausted).toBe(false);
    });
  });

  describe('5. Filtered Discard Cost Contract (Upstream Preparation)', () => {
    it('Enforces card filter requirement on discardCard cost', () => {
      const player = state.players[0];
      // Card with energy resource
      const energyCard = {
        ...createCardInstance(cardCatalog.getCard('01005')!),
        instanceId: 'energy_inst',
        card: {
          ...cardCatalog.getCard('01005')!,
          resources: { energy: 1, physical: 0, mental: 0, wild: 0, total: 1 },
        } as any,
      };
      // Card with physical resource
      const physicalCard = {
        ...createCardInstance(cardCatalog.getCard('01005')!),
        instanceId: 'physical_inst',
        card: {
          ...cardCatalog.getCard('01005')!,
          resources: { energy: 0, physical: 1, mental: 0, wild: 0, total: 1 },
        } as any,
      };

      player.hand = [physicalCard];

      // Custom ability requiring discarding an energy card
      const testFilteredAbility = {
        id: 'test_filtered_discard_ability',
        timing: 'ACTION' as const,
        cost: {
          exhaustSelf: true,
          discardCard: {
            from: 'HAND' as const,
            count: 1,
            mode: 'CHOSEN' as const,
            filter: {
              resourceIcons: ['energy' as const],
            },
          },
        },
        steps: [],
      };

      const testItemInst = {
        ...createCardInstance(cardCatalog.getCard('01015')!),
        instanceId: 'filtered_test_inst',
        card: {
          ...cardCatalog.getCard('01015')!,
          enrichment: {
            abilities: [testFilteredAbility],
          },
        } as any,
      };
      player.tableau = [testItemInst];

      // 1. With only physicalCard in hand, initiation is not allowed
      const check1 = canInitiateAbility(state, player.id, testFilteredAbility, testItemInst);
      expect(check1.allowed).toBe(false);
      expect(check1.reason).toMatch(/matching required discard filter/i);

      // 2. Add energy card to hand
      player.hand.push(energyCard);
      const check2 = canInitiateAbility(state, player.id, testFilteredAbility, testItemInst);
      expect(check2.allowed).toBe(true);

      // 3. Providing the physical card should be rejected
      const checkInvalid = canInitiateAbility(state, player.id, testFilteredAbility, testItemInst, {
        discardCardInstanceIds: ['physical_inst'],
      });
      expect(checkInvalid.allowed).toBe(false);
      expect(checkInvalid.reason).toMatch(/does not match the required filter/i);

      // 4. Providing the energy card should be allowed
      const checkValid = canInitiateAbility(state, player.id, testFilteredAbility, testItemInst, {
        discardCardInstanceIds: ['energy_inst'],
      });
      expect(checkValid.allowed).toBe(true);

      // 5. Dispatch with energy card succeeds
      const res = dispatchAction(state, {
        type: 'USE_CARD_ABILITY',
        playerId: player.id,
        cardInstanceId: testItemInst.instanceId,
        abilityId: testFilteredAbility.id,
        discardCardInstanceIds: ['energy_inst'],
      });
      expect(res.result.success).toBe(true);
      expect(res.state.players[0].discard.some((c) => c.instanceId === 'energy_inst')).toBe(true);
    });
  });
});
