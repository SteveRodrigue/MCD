import { describe, it, expect } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import {
  HeroCard,
  AlterEgoCard,
  VillainCard,
  MainSchemeCard,
  CardType,
  Keyword,
  NormalizedCard,
} from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import {
  canPlayCard,
  getPlayerRestrictedLimit,
  getPlayerRestrictedCount,
  isCardRestricted,
  getCardRestrictedWeight,
} from '@engine/pipeline/legality-checker';

describe('Sub-Milestone 2D-1: Table Invariants — Restricted Keyword & Global Unicity (RR v1.8 p. 25, 29 / ADR-0018)', () => {
  const spiderManHero = cardCatalog.getCard('01001a') as HeroCard;
  const peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;
  const captainMarvelHero = cardCatalog.getCard('01010a') as HeroCard;
  const carolDanversAlterEgo = cardCatalog.getCard('01010b') as AlterEgoCard;
  const rhinoVillain = cardCatalog.getCard('01094') as VillainCard;
  const mainScheme = cardCatalog.getCard('01097b') as MainSchemeCard;

  describe('Restricted Card Keyword Limit Engine (RR v1.8 p. 25 / ADR-0018)', () => {
    const restrictedCard1: NormalizedCard = {
      ...cardCatalog.getCard('01005')!,
      code: 'rest_01',
      name: 'Web-Shooter',
      type: CardType.UPGRADE,
      keywords: [Keyword.RESTRICTED],
      text: 'Restricted.',
      cost: 1,
    };

    const restrictedCard2: NormalizedCard = {
      ...cardCatalog.getCard('01005')!,
      code: 'rest_02',
      name: 'Spider-Tracer',
      type: CardType.UPGRADE,
      keywords: [Keyword.RESTRICTED],
      text: 'Restricted.',
      cost: 1,
    };

    const restrictedCard3: NormalizedCard = {
      ...cardCatalog.getCard('01005')!,
      code: 'rest_03',
      name: 'Laser Cannon',
      type: CardType.UPGRADE,
      keywords: [Keyword.RESTRICTED],
      text: 'Restricted.',
      cost: 1,
    };

    const heavyRestrictedCard: NormalizedCard = {
      ...cardCatalog.getCard('01005')!,
      code: 'rest_heavy',
      name: 'Rocket Launcher',
      type: CardType.UPGRADE,
      keywords: [Keyword.RESTRICTED],
      restrictedSlots: 2,
      text: 'Restricted. Counts as 2 restricted cards.',
      cost: 2,
    };

    const paymentCard = cardCatalog.getCard('01005')!;

    it('calculates restricted weights correctly (base 1 vs heavy 2)', () => {
      expect(isCardRestricted(restrictedCard1)).toBe(true);
      expect(getCardRestrictedWeight(restrictedCard1)).toBe(1);
      expect(isCardRestricted(heavyRestrictedCard)).toBe(true);
      expect(getCardRestrictedWeight(heavyRestrictedCard)).toBe(2);
      expect(isCardRestricted(paymentCard)).toBe(false);
      expect(getCardRestrictedWeight(paymentCard)).toBe(0);
    });

    it('enforces maximum 2 restricted cards per player by default', () => {
      const state = setupGame({
        scenarioId: 'rhino',
        players: [
          {
            id: 'p1',
            name: 'Spider-Man',
            hero: spiderManHero,
            alterEgo: peterParkerAlterEgo,
            deckCards: [
              restrictedCard1,
              restrictedCard2,
              restrictedCard3,
              paymentCard,
              paymentCard,
              paymentCard,
              paymentCard,
            ],
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

      expect(getPlayerRestrictedLimit(state, 'p1')).toBe(2);
      expect(getPlayerRestrictedCount(player)).toBe(0);

      // Add 2 restricted cards to player's tableau
      player.tableau.push(createCardInstance(restrictedCard1));
      player.tableau.push(createCardInstance(restrictedCard2));
      expect(getPlayerRestrictedCount(player)).toBe(2);

      // Put restrictedCard3 and payment cards in hand
      const card3Instance = createCardInstance(restrictedCard3);
      const payInstance1 = createCardInstance(paymentCard);
      player.hand = [card3Instance, payInstance1];

      // Playing a 3rd restricted card is allowed per RR v1.8 p. 25 because player can choose an in-play card to discard
      const result = canPlayCard(state, 'p1', card3Instance.instanceId, [payInstance1.instanceId]);
      expect(result.allowed).toBe(true);
    });

    it('allows playing heavy 2-slot restricted card when 1 restricted card is in play (player can discard to make room)', () => {
      const state = setupGame({
        scenarioId: 'rhino',
        players: [
          {
            id: 'p1',
            name: 'Spider-Man',
            hero: spiderManHero,
            alterEgo: peterParkerAlterEgo,
            deckCards: [
              restrictedCard1,
              heavyRestrictedCard,
              paymentCard,
              paymentCard,
              paymentCard,
              paymentCard,
            ],
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

      // 1 restricted card in play (1 / 2 slots occupied)
      player.tableau.push(createCardInstance(restrictedCard1));
      expect(getPlayerRestrictedCount(player)).toBe(1);

      // Playing 2-slot heavy card (1 + 2 = 3 > 2) is allowed because player can discard the existing 1-slot card to make room
      const heavyInstance = createCardInstance(heavyRestrictedCard);
      const payInstance1 = createCardInstance(paymentCard);
      const payInstance2 = createCardInstance(paymentCard);
      player.hand = [heavyInstance, payInstance1, payInstance2];

      const result = canPlayCard(state, 'p1', heavyInstance.instanceId, [
        payInstance1.instanceId,
        payInstance2.instanceId,
      ]);
      expect(result.allowed).toBe(true);
    });

    it('dynamically expands restricted limit with limit modifiers (e.g. Side Holster +1)', () => {
      const state = setupGame({
        scenarioId: 'rhino',
        players: [
          {
            id: 'p1',
            name: 'Spider-Man',
            hero: spiderManHero,
            alterEgo: peterParkerAlterEgo,
            deckCards: [
              restrictedCard1,
              restrictedCard2,
              restrictedCard3,
              paymentCard,
              paymentCard,
              paymentCard,
              paymentCard,
            ],
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

      // Create Side Holster upgrade card that grants RESTRICTED_LIMIT_BONUS +1
      const sideHolster: NormalizedCard = {
        ...cardCatalog.getCard('01005')!,
        code: 'side_holster',
        name: 'Side Holster',
        type: CardType.UPGRADE,
        enrichment: {
          abilities: [
            {
              id: 'side_holster_limit',
              timing: 'CONSTANT',
              steps: [
                {
                  effect: 'RESTRICTED_LIMIT_BONUS',
                  params: { amount: 1 },
                },
              ],
            },
          ],
        },
      };

      player.tableau.push(createCardInstance(sideHolster));
      player.tableau.push(createCardInstance(restrictedCard1));
      player.tableau.push(createCardInstance(restrictedCard2));

      // Limit is now 3 (2 base + 1 modifier)
      expect(getPlayerRestrictedLimit(state, 'p1')).toBe(3);
      expect(getPlayerRestrictedCount(player)).toBe(2);

      // Now playing 3rd restricted card is allowed!
      const card3Instance = createCardInstance(restrictedCard3);
      const payInstance = createCardInstance(paymentCard);
      player.hand = [card3Instance, payInstance];

      const result = canPlayCard(state, 'p1', card3Instance.instanceId, [payInstance.instanceId]);
      expect(result.allowed).toBe(true);
    });
  });

  describe('Global Unique Card Rule & Identity Collision (RR v1.8 p. 29)', () => {
    it('blocks playing a unique card if another player controls a copy in play', () => {
      const nickFuryCard = cardCatalog.getCard('01084')!; // Nick Fury (Unique Ally)
      const paymentCard = cardCatalog.getCard('01005')!;

      const state = setupGame({
        scenarioId: 'rhino',
        players: [
          {
            id: 'p1',
            name: 'Spider-Man',
            hero: spiderManHero,
            alterEgo: peterParkerAlterEgo,
            deckCards: [
              nickFuryCard,
              paymentCard,
              paymentCard,
              paymentCard,
              paymentCard,
              paymentCard,
            ],
          },
          {
            id: 'p2',
            name: 'Captain Marvel',
            hero: captainMarvelHero,
            alterEgo: carolDanversAlterEgo,
            deckCards: [
              nickFuryCard,
              paymentCard,
              paymentCard,
              paymentCard,
              paymentCard,
              paymentCard,
            ],
          },
        ],
        villain: rhinoVillain,
        mainScheme,
        encounterCards: cardCatalog.getCardsBySet('rhino'),
        skipMulligan: true,
      });

      // Player 1 controls Nick Fury in play
      state.players[0].allies.push(createCardInstance(nickFuryCard));

      // Player 2 attempts to play Nick Fury
      const p2FuryInstance = createCardInstance(nickFuryCard);
      const payCards = [
        createCardInstance(paymentCard),
        createCardInstance(paymentCard),
        createCardInstance(paymentCard),
        createCardInstance(paymentCard),
      ];
      state.players[1].hand = [p2FuryInstance, ...payCards];
      state.players[1].currentForm = 'hero';
      state.activePlayerIndex = 1;

      const result = canPlayCard(
        state,
        'p2',
        p2FuryInstance.instanceId,
        payCards.map((c) => c.instanceId),
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Global unicity violation (RR v1.8 p. 29)');
      expect(result.reason).toContain("under Spider-Man's control");
    });

    it('blocks playing a unique ally/card that shares identity with any in-game player', () => {
      // Create mock Captain Marvel ally card
      const captainMarvelAlly: NormalizedCard = {
        ...cardCatalog.getCard('01005')!,
        code: 'cm_ally',
        name: 'Captain Marvel',
        subname: 'Carol Danvers',
        type: CardType.ALLY,
        isUnique: true,
        cost: 3,
      };

      const paymentCard = cardCatalog.getCard('01005')!;

      // Game has Player 1 (Spider-Man) and Player 2 (Captain Marvel / Carol Danvers)
      const state = setupGame({
        scenarioId: 'rhino',
        players: [
          {
            id: 'p1',
            name: 'Spider-Man',
            hero: spiderManHero,
            alterEgo: peterParkerAlterEgo,
            deckCards: [
              captainMarvelAlly,
              paymentCard,
              paymentCard,
              paymentCard,
              paymentCard,
              paymentCard,
            ],
          },
          {
            id: 'p2',
            name: 'Captain Marvel',
            hero: captainMarvelHero,
            alterEgo: carolDanversAlterEgo,
            deckCards: Array(10).fill(paymentCard),
          },
        ],
        villain: rhinoVillain,
        mainScheme,
        encounterCards: cardCatalog.getCardsBySet('rhino'),
        skipMulligan: true,
      });

      // Player 1 attempts to play Captain Marvel ally
      const cmInstance = createCardInstance(captainMarvelAlly);
      const payCards = [
        createCardInstance(paymentCard),
        createCardInstance(paymentCard),
        createCardInstance(paymentCard),
      ];
      state.players[0].hand = [cmInstance, ...payCards];
      state.players[0].currentForm = 'hero';
      state.activePlayerIndex = 0;

      const result = canPlayCard(
        state,
        'p1',
        cmInstance.instanceId,
        payCards.map((c) => c.instanceId),
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Global unicity violation (RR v1.8 p. 29)');
      expect(result.reason).toContain("shares identity with player 'Captain Marvel'");
    });

    it('allows playing non-unique cards even when multiple copies are in play', () => {
      const nonUniqueCard: NormalizedCard = {
        ...cardCatalog.getCard('01005')!,
        code: 'non_unique_01',
        name: 'Armored Vest',
        type: CardType.UPGRADE,
        isUnique: false,
        cost: 1,
      };

      const paymentCard = cardCatalog.getCard('01005')!;

      const state = setupGame({
        scenarioId: 'rhino',
        players: [
          {
            id: 'p1',
            name: 'Spider-Man',
            hero: spiderManHero,
            alterEgo: peterParkerAlterEgo,
            deckCards: [
              nonUniqueCard,
              paymentCard,
              paymentCard,
              paymentCard,
              paymentCard,
              paymentCard,
            ],
          },
        ],
        villain: rhinoVillain,
        mainScheme,
        encounterCards: cardCatalog.getCardsBySet('rhino'),
        skipMulligan: true,
      });

      // Player already has 1 Armored Vest in play
      state.players[0].tableau.push(createCardInstance(nonUniqueCard));

      // Player can play a second Armored Vest
      const secondInstance = createCardInstance(nonUniqueCard);
      const payInstance = createCardInstance(paymentCard);
      state.players[0].hand = [secondInstance, payInstance];
      state.players[0].currentForm = 'hero';

      const result = canPlayCard(state, 'p1', secondInstance.instanceId, [payInstance.instanceId]);
      expect(result.allowed).toBe(true);
    });

    it('allows playing a unique ally with a different subtitle than the active hero (RR v1.8 p. 29 subtitle distinction)', () => {
      // Spider-Man (Miles Morales) ally
      const milesMoralesAlly: NormalizedCard = {
        ...cardCatalog.getCard('01005')!,
        code: 'miles_ally',
        name: 'Spider-Man',
        subname: 'Miles Morales',
        type: CardType.ALLY,
        isUnique: true,
        cost: 3,
      };

      const paymentCard = cardCatalog.getCard('01005')!;

      // Game has Player 1: Spider-Man (Peter Parker)
      const state = setupGame({
        scenarioId: 'rhino',
        players: [
          {
            id: 'p1',
            name: 'Spider-Man',
            hero: spiderManHero, // Name: Spider-Man, Subname: Peter Parker
            alterEgo: peterParkerAlterEgo,
            deckCards: [milesMoralesAlly, paymentCard, paymentCard, paymentCard, paymentCard],
          },
        ],
        villain: rhinoVillain,
        mainScheme,
        encounterCards: cardCatalog.getCardsBySet('rhino'),
        skipMulligan: true,
      });

      const milesInstance = createCardInstance(milesMoralesAlly);
      const payCards = [
        createCardInstance(paymentCard),
        createCardInstance(paymentCard),
        createCardInstance(paymentCard),
      ];
      state.players[0].hand = [milesInstance, ...payCards];
      state.players[0].currentForm = 'hero';

      const result = canPlayCard(
        state,
        'p1',
        milesInstance.instanceId,
        payCards.map((c) => c.instanceId),
      );

      // RR v1.8 p. 29: Miles Morales and Peter Parker are distinct characters with different subtitles -> ALLOWED!
      expect(result.allowed).toBe(true);
    });

    it('blocks playing a unique ally with the same subtitle as the active hero (RR v1.8 p. 29)', () => {
      // Spider-Man (Peter Parker) ally
      const peterParkerAlly: NormalizedCard = {
        ...cardCatalog.getCard('01005')!,
        code: 'peter_ally',
        name: 'Spider-Man',
        subname: 'Peter Parker',
        type: CardType.ALLY,
        isUnique: true,
        cost: 3,
      };

      const paymentCard = cardCatalog.getCard('01005')!;

      const state = setupGame({
        scenarioId: 'rhino',
        players: [
          {
            id: 'p1',
            name: 'Spider-Man',
            hero: spiderManHero,
            alterEgo: peterParkerAlterEgo,
            deckCards: [peterParkerAlly, paymentCard, paymentCard, paymentCard, paymentCard],
          },
        ],
        villain: rhinoVillain,
        mainScheme,
        encounterCards: cardCatalog.getCardsBySet('rhino'),
        skipMulligan: true,
      });

      const peterInstance = createCardInstance(peterParkerAlly);
      const payCards = [
        createCardInstance(paymentCard),
        createCardInstance(paymentCard),
        createCardInstance(paymentCard),
      ];
      state.players[0].hand = [peterInstance, ...payCards];
      state.players[0].currentForm = 'hero';

      const result = canPlayCard(
        state,
        'p1',
        peterInstance.instanceId,
        payCards.map((c) => c.instanceId),
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Global unicity violation (RR v1.8 p. 29)');
    });
  });

  describe('Max [X] Per Player Board Invariants (RR v1.8 p. 17 / Issue #3)', () => {
    it('parses maxPerPlayer: 1 from Zzorba raw text for Energy Channel, Armored Vest, Combat Training, etc.', () => {
      const energyChannel = cardCatalog.getCard('01018')!;
      const armoredVest = cardCatalog.getCard('01081')!;
      const combatTraining = cardCatalog.getCard('01057')!;
      const avengersMansion = cardCatalog.getCard('01091')!;
      const helicarrier = cardCatalog.getCard('01092')!;
      const standardWebShooter = cardCatalog.getCard('01008')!; // Restricted, but no max per player limit

      expect(energyChannel.maxPerPlayer).toBe(1);
      expect(armoredVest.maxPerPlayer).toBe(1);
      expect(combatTraining.maxPerPlayer).toBe(1);
      expect(avengersMansion.maxPerPlayer).toBe(1);
      expect(helicarrier.maxPerPlayer).toBe(1);
      expect(standardWebShooter.maxPerPlayer).toBeUndefined();
    });

    it('blocks playing a 2nd copy of Energy Channel (01018) when 1 copy is already in tableau', () => {
      const energyChannelCard = cardCatalog.getCard('01018')!;
      const paymentCard = cardCatalog.getCard('01005')!;

      const state = setupGame({
        scenarioId: 'rhino',
        players: [
          {
            id: 'p1',
            name: 'Captain Marvel',
            hero: captainMarvelHero,
            alterEgo: carolDanversAlterEgo,
            deckCards: [
              energyChannelCard,
              energyChannelCard,
              paymentCard,
              paymentCard,
              paymentCard,
            ],
          },
        ],
        villain: rhinoVillain,
        mainScheme,
        encounterCards: cardCatalog.getCardsBySet('rhino'),
        skipMulligan: true,
      });

      const player = state.players[0];
      player.currentForm = 'hero';

      // 1. First copy is in tableau
      const copy1 = createCardInstance(energyChannelCard);
      player.tableau.push(copy1);

      // 2. Player attempts to play a 2nd copy from hand
      const copy2 = createCardInstance(energyChannelCard);
      player.hand = [copy2];

      const result = canPlayCard(state, 'p1', copy2.instanceId, []);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Max 1 per player limit reached for 'Energy Channel'");
    });

    it('blocks playing a 2nd copy of Armored Vest (01081) when 1 copy is already in tableau', () => {
      const armoredVestCard = cardCatalog.getCard('01081')!;
      const paymentCard = cardCatalog.getCard('01005')!;

      const state = setupGame({
        scenarioId: 'rhino',
        players: [
          {
            id: 'p1',
            name: 'Spider-Man',
            hero: spiderManHero,
            alterEgo: peterParkerAlterEgo,
            deckCards: [armoredVestCard, paymentCard, paymentCard, paymentCard],
          },
        ],
        villain: rhinoVillain,
        mainScheme,
        encounterCards: cardCatalog.getCardsBySet('rhino'),
        skipMulligan: true,
      });

      const player = state.players[0];
      player.currentForm = 'hero';

      // First copy in tableau
      player.tableau.push(createCardInstance(armoredVestCard));

      // Attempt to play 2nd copy
      const secondVest = createCardInstance(armoredVestCard);
      const payCard = createCardInstance(paymentCard);
      player.hand = [secondVest, payCard];

      const result = canPlayCard(state, 'p1', secondVest.instanceId, [payCard.instanceId]);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Max 1 per player limit reached for 'Armored Vest'");
    });

    it('allows different players to each control 1 copy of a Max 1 per player non-unique card', () => {
      const armoredVestCard = cardCatalog.getCard('01081')!;
      const paymentCard = cardCatalog.getCard('01005')!;

      const state = setupGame({
        scenarioId: 'rhino',
        players: [
          {
            id: 'p1',
            name: 'Spider-Man',
            hero: spiderManHero,
            alterEgo: peterParkerAlterEgo,
            deckCards: [armoredVestCard, paymentCard, paymentCard, paymentCard],
          },
          {
            id: 'p2',
            name: 'Captain Marvel',
            hero: captainMarvelHero,
            alterEgo: carolDanversAlterEgo,
            deckCards: [armoredVestCard, paymentCard, paymentCard, paymentCard],
          },
        ],
        villain: rhinoVillain,
        mainScheme,
        encounterCards: cardCatalog.getCardsBySet('rhino'),
        skipMulligan: true,
      });

      // Player 1 has 1 Armored Vest in tableau
      state.players[0].tableau.push(createCardInstance(armoredVestCard));

      // Player 2 can still play their 1st Armored Vest
      const p2Vest = createCardInstance(armoredVestCard);
      const p2Pay = createCardInstance(paymentCard);
      state.players[1].hand = [p2Vest, p2Pay];
      state.players[1].currentForm = 'hero';
      state.activePlayerIndex = 1;

      const result = canPlayCard(state, 'p2', p2Vest.instanceId, [p2Pay.instanceId]);

      expect(result.allowed).toBe(true);
    });
  });
});
