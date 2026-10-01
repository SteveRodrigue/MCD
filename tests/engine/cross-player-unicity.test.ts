import { describe, it, expect, beforeEach } from 'vitest';
import { setupGame, createCardInstance } from '../../src/engine/state/game-setup';
import {
  evaluateCardPlayability,
  checkUniqueCardPlayable,
  canPlayCard,
} from '../../src/engine/pipeline/legality-checker';
import { dispatchAction } from '../../src/engine/pipeline/action-dispatcher';
import { executeEffect } from '../../src/engine/effects';
import { cardCatalog, normalizeRawCard } from '../../src/data/importer/card-loader';
import {
  GameState,
  HeroCard,
  AlterEgoCard,
  AllyCard,
  NormalizedCard,
} from '../../src/engine/models';
import trorsPack from '../../data/upstream/pack/trors.json';
import warmPack from '../../data/upstream/pack/warm.json';

describe('Cross-Player Global Unicity Enforcement (RR v1.8 pp. 28-29, Issue #187)', () => {
  let state: GameState;
  let spiderManHero: HeroCard;
  let peterParkerAlterEgo: AlterEgoCard;
  let captainMarvelHero: HeroCard;
  let carolDanversAlterEgo: AlterEgoCard;
  let sheHulkHero: HeroCard;
  let jenniferWaltersAlterEgo: AlterEgoCard;
  let ironManHero: HeroCard;
  let tonyStarkAlterEgo: AlterEgoCard;
  let paymentCard: NormalizedCard;

  beforeEach(() => {
    spiderManHero = cardCatalog.getCard('01001a') as HeroCard;
    peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;
    captainMarvelHero = cardCatalog.getCard('01010a') as HeroCard;
    carolDanversAlterEgo = cardCatalog.getCard('01010b') as AlterEgoCard;
    sheHulkHero = cardCatalog.getCard('01019a') as HeroCard;
    jenniferWaltersAlterEgo = cardCatalog.getCard('01019b') as AlterEgoCard;
    ironManHero = cardCatalog.getCard('01029a') as HeroCard;
    tonyStarkAlterEgo = cardCatalog.getCard('01029b') as AlterEgoCard;
    paymentCard = cardCatalog.getCard('01005')!; // Web-Shooter (1 resource)
  });

  describe('Cross-Player Ally Collision (Issue #187: Nick Fury 01084)', () => {
    it('disallows Player 1 from playing Nick Fury when Player 2 already controls Nick Fury', () => {
      const nickFuryCard = cardCatalog.getCard('01084') as AllyCard;

      state = setupGame({
        scenarioId: 'rhino',
        players: [
          {
            id: 'p1',
            name: 'Spider-Man',
            hero: spiderManHero,
            alterEgo: peterParkerAlterEgo,
            deckCards: Array(10).fill(paymentCard),
          },
          {
            id: 'p2',
            name: 'Captain Marvel',
            hero: captainMarvelHero,
            alterEgo: carolDanversAlterEgo,
            deckCards: Array(10).fill(paymentCard),
          },
        ],
        villain: cardCatalog.getCard('01094') as any,
        mainScheme: cardCatalog.getCard('01097b') as any,
        encounterCards: cardCatalog.getCardsBySet('rhino'),
        skipMulligan: true,
      });

      // Player 2 controls Nick Fury in their allies
      const p2Fury = createCardInstance(nickFuryCard);
      state.players[1].allies.push(p2Fury);

      // Player 1 has Nick Fury and 4 payment cards in hand
      const p1Fury = createCardInstance(nickFuryCard);
      const pay1 = createCardInstance(paymentCard);
      const pay2 = createCardInstance(paymentCard);
      const pay3 = createCardInstance(paymentCard);
      const pay4 = createCardInstance(paymentCard);
      state.players[0].hand = [p1Fury, pay1, pay2, pay3, pay4];
      state.players[0].currentForm = 'hero';
      state.players[0].activeFormCard = spiderManHero;
      state.activePlayerIndex = 0;

      // 1. evaluateCardPlayability must return isPlayable: false with unicity reason
      const playability = evaluateCardPlayability(state, 'p1', p1Fury);
      expect(playability.isPlayable).toBe(false);
      expect(playability.reasons.length).toBeGreaterThan(0);
      expect(playability.reasons[0]).toContain('Global unicity violation (RR v1.8 p. 29)');
      expect(playability.reasons[0]).toContain(
        "A unique copy of 'Nick Fury' is already in play under Captain Marvel's control",
      );

      // 2. canPlayCard must return allowed: false
      const canPlay = canPlayCard(state, 'p1', p1Fury.instanceId, [
        pay1.instanceId,
        pay2.instanceId,
        pay3.instanceId,
        pay4.instanceId,
      ]);
      expect(canPlay.allowed).toBe(false);
      expect(canPlay.reason).toContain('Global unicity violation (RR v1.8 p. 29)');
      expect(canPlay.reason).toContain("under Captain Marvel's control");

      // 3. dispatchAction PLAY_CARD must be rejected
      const dispatchResult = dispatchAction(state, {
        type: 'PLAY_CARD',
        playerId: 'p1',
        cardInstanceId: p1Fury.instanceId,
        paymentCardInstanceIds: [
          pay1.instanceId,
          pay2.instanceId,
          pay3.instanceId,
          pay4.instanceId,
        ],
      });
      expect(dispatchResult.result?.success).toBe(false);
      expect(dispatchResult.result?.error).toContain('Global unicity violation');
    });
  });

  describe('Identity Persona Matching (Spider-Man 04045 Ally vs Player 1 Spider-Man Identity)', () => {
    it('disallows playing Spider-Man ally (Peter Parker) when Player 1 is Spider-Man, but allows spending it as a resource', () => {
      // Ingest raw 04045 from trors.json
      const raw04045 = trorsPack.find((c: any) => c.code === '04045');
      expect(raw04045).toBeDefined();
      const spiderManAlly = normalizeRawCard(raw04045 as any) as AllyCard;
      expect(spiderManAlly.name).toBe('Spider-Man');
      expect(spiderManAlly.subname).toBe('Peter Parker');
      expect(spiderManAlly.isUnique).toBe(true);

      // Player 1 is Spider-Man (Peter Parker), Player 2 is She-Hulk (Jennifer Walters)
      state = setupGame({
        scenarioId: 'rhino',
        players: [
          {
            id: 'p1',
            name: 'Spider-Man',
            hero: spiderManHero,
            alterEgo: peterParkerAlterEgo,
            deckCards: Array(10).fill(paymentCard),
          },
          {
            id: 'p2',
            name: 'She-Hulk',
            hero: sheHulkHero,
            alterEgo: jenniferWaltersAlterEgo,
            deckCards: Array(10).fill(paymentCard),
          },
        ],
        villain: cardCatalog.getCard('01094') as any,
        mainScheme: cardCatalog.getCard('01097b') as any,
        encounterCards: cardCatalog.getCardsBySet('rhino'),
        skipMulligan: true,
      });

      state.players[1].currentForm = 'hero';
      state.players[1].activeFormCard = sheHulkHero;
      state.activePlayerIndex = 1;

      // 1. checkUniqueCardPlayable directly disallows 04045
      const unicityCheck = checkUniqueCardPlayable(state, spiderManAlly);
      expect(unicityCheck.allowed).toBe(false);
      expect(unicityCheck.reason).toContain('Global unicity violation (RR v1.8 p. 29)');
      expect(unicityCheck.reason).toContain(
        "Unique card 'Spider-Man' shares identity with player 'Spider-Man'",
      );

      // Player 2 has Spider-Man ally (04045) and 5 payment cards in hand
      const allyInst = createCardInstance(spiderManAlly);
      const pay1 = createCardInstance(paymentCard);
      const pay2 = createCardInstance(paymentCard);
      const pay3 = createCardInstance(paymentCard);
      const pay4 = createCardInstance(paymentCard);
      const pay5 = createCardInstance(paymentCard);

      // Player 2 also has a 1-cost legal card to play: The Triskelion (01073)
      const triskelionCard = cardCatalog.getCard('01073')!;
      const triskelionInst = createCardInstance(triskelionCard);

      state.players[1].hand = [allyInst, triskelionInst, pay1, pay2, pay3, pay4, pay5];

      // 2. evaluateCardPlayability for 04045 ally returns isPlayable: false
      const playability = evaluateCardPlayability(state, 'p2', allyInst);
      expect(playability.isPlayable).toBe(false);
      expect(playability.reasons[0]).toContain("shares identity with player 'Spider-Man'");

      // 3. canPlayCard for 04045 ally returns allowed: false
      const canPlayAlly = canPlayCard(state, 'p2', allyInst.instanceId, [
        pay1.instanceId,
        pay2.instanceId,
        pay3.instanceId,
        pay4.instanceId,
        pay5.instanceId,
      ]);
      expect(canPlayAlly.allowed).toBe(false);
      expect(canPlayAlly.reason).toContain("shares identity with player 'Spider-Man'");

      // 4. Resource Spending Legality (RR v1.8 p. 28-29):
      // The 04045 ally cannot be played, but it CAN be spent as a resource from hand to pay for another card!
      const canPlayTriskelion = canPlayCard(
        state,
        'p2',
        triskelionInst.instanceId,
        [allyInst.instanceId], // Pay using Spider-Man ally (1 mental resource)
      );
      expect(canPlayTriskelion.allowed).toBe(true);

      // 5. dispatchAction PLAY_CARD using 04045 as resource succeeds
      const dispatchPlay = dispatchAction(state, {
        type: 'PLAY_CARD',
        playerId: 'p2',
        cardInstanceId: triskelionInst.instanceId,
        paymentCardInstanceIds: [allyInst.instanceId],
      });
      expect(dispatchPlay.result?.success).toBe(true);
      // Spider-Man ally is now in Player 2's discard pile
      expect(
        dispatchPlay.state.players[1].discard.some((c) => c.instanceId === allyInst.instanceId),
      ).toBe(true);
      // Triskelion is now in Player 2's tableau
      expect(
        dispatchPlay.state.players[1].tableau.some(
          (c) => c.instanceId === triskelionInst.instanceId,
        ),
      ).toBe(true);
    });
  });

  describe('Cross-Player Identity Collision', () => {
    it('disallows Player 1 from playing an Iron Man ally when Player 2 is Iron Man', () => {
      // Ingest raw 23002 from warm.json (Iron Man ally, Tony Stark)
      const raw23002 = warmPack.find((c: any) => c.code === '23002');
      expect(raw23002).toBeDefined();
      const ironManAlly = normalizeRawCard(raw23002 as any) as AllyCard;
      expect(ironManAlly.name).toBe('Iron Man');
      expect(ironManAlly.isUnique).toBe(true);

      // Player 1 is Spider-Man, Player 2 is Iron Man
      state = setupGame({
        scenarioId: 'rhino',
        players: [
          {
            id: 'p1',
            name: 'Spider-Man',
            hero: spiderManHero,
            alterEgo: peterParkerAlterEgo,
            deckCards: Array(10).fill(paymentCard),
          },
          {
            id: 'p2',
            name: 'Iron Man',
            hero: ironManHero,
            alterEgo: tonyStarkAlterEgo,
            deckCards: Array(10).fill(paymentCard),
          },
        ],
        villain: cardCatalog.getCard('01094') as any,
        mainScheme: cardCatalog.getCard('01097b') as any,
        encounterCards: cardCatalog.getCardsBySet('rhino'),
        skipMulligan: true,
      });

      const ironManAllyInst = createCardInstance(ironManAlly);
      const pay1 = createCardInstance(paymentCard);
      const pay2 = createCardInstance(paymentCard);
      const pay3 = createCardInstance(paymentCard);
      state.players[0].hand = [ironManAllyInst, pay1, pay2, pay3];
      state.players[0].currentForm = 'hero';
      state.players[0].activeFormCard = spiderManHero;
      state.activePlayerIndex = 0;

      // evaluateCardPlayability must be false
      const playability = evaluateCardPlayability(state, 'p1', ironManAllyInst);
      expect(playability.isPlayable).toBe(false);
      expect(playability.reasons[0]).toContain("shares identity with player 'Iron Man'");

      // canPlayCard must be false
      const canPlay = canPlayCard(state, 'p1', ironManAllyInst.instanceId, [
        pay1.instanceId,
        pay2.instanceId,
        pay3.instanceId,
      ]);
      expect(canPlay.allowed).toBe(false);
      expect(canPlay.reason).toContain("shares identity with player 'Iron Man'");
    });
  });

  describe('Cross-Player Tableau Collision', () => {
    it('disallows Player 1 from playing a unique support/upgrade when Player 2 controls a copy in their tableau', () => {
      // The Triskelion (01073) is a unique support
      const triskelionCard = cardCatalog.getCard('01073')!;
      expect(triskelionCard.isUnique).toBe(true);

      state = setupGame({
        scenarioId: 'rhino',
        players: [
          {
            id: 'p1',
            name: 'Spider-Man',
            hero: spiderManHero,
            alterEgo: peterParkerAlterEgo,
            deckCards: Array(10).fill(paymentCard),
          },
          {
            id: 'p2',
            name: 'Captain Marvel',
            hero: captainMarvelHero,
            alterEgo: carolDanversAlterEgo,
            deckCards: Array(10).fill(paymentCard),
          },
        ],
        villain: cardCatalog.getCard('01094') as any,
        mainScheme: cardCatalog.getCard('01097b') as any,
        encounterCards: cardCatalog.getCardsBySet('rhino'),
        skipMulligan: true,
      });

      // Player 2 controls The Triskelion in tableau
      const p2Triskelion = createCardInstance(triskelionCard);
      state.players[1].tableau.push(p2Triskelion);

      // Player 1 has The Triskelion and payment card in hand
      const p1Triskelion = createCardInstance(triskelionCard);
      const pay1 = createCardInstance(paymentCard);
      state.players[0].hand = [p1Triskelion, pay1];
      state.players[0].currentForm = 'hero';
      state.players[0].activeFormCard = spiderManHero;
      state.activePlayerIndex = 0;

      // evaluateCardPlayability must be false
      const playability = evaluateCardPlayability(state, 'p1', p1Triskelion);
      expect(playability.isPlayable).toBe(false);
      expect(playability.reasons[0]).toContain(
        "A unique copy of 'The Triskelion' is already in play in Captain Marvel's tableau",
      );

      // canPlayCard must be false
      const canPlay = canPlayCard(state, 'p1', p1Triskelion.instanceId, [pay1.instanceId]);
      expect(canPlay.allowed).toBe(false);
      expect(canPlay.reason).toContain(
        "A unique copy of 'The Triskelion' is already in play in Captain Marvel's tableau",
      );
    });
  });

  describe('PUT_INTO_PLAY Ingress Enforcement (RR v1.8 p. 29)', () => {
    it('prevents putting a unique card into play if a matching unique card is already in play', () => {
      const nickFuryCard = cardCatalog.getCard('01084') as AllyCard;

      state = setupGame({
        scenarioId: 'rhino',
        players: [
          {
            id: 'p1',
            name: 'Spider-Man',
            hero: spiderManHero,
            alterEgo: peterParkerAlterEgo,
            deckCards: Array(10).fill(paymentCard),
          },
          {
            id: 'p2',
            name: 'Captain Marvel',
            hero: captainMarvelHero,
            alterEgo: carolDanversAlterEgo,
            deckCards: Array(10).fill(paymentCard),
          },
        ],
        villain: cardCatalog.getCard('01094') as any,
        mainScheme: cardCatalog.getCard('01097b') as any,
        encounterCards: cardCatalog.getCardsBySet('rhino'),
        skipMulligan: true,
      });

      // Player 1 controls Nick Fury in their allies
      const p1Fury = createCardInstance(nickFuryCard);
      state.players[0].allies.push(p1Fury);

      // Player 2 has a copy of Nick Fury in their discard pile
      const p2Fury = createCardInstance(nickFuryCard);
      state.players[1].discard.push(p2Fury);

      // Ability on Player 2 attempts to PUT_INTO_PLAY from discard matching ally
      const effectResult = executeEffect(
        state,
        {
          id: 'test_put_into_play',
          timing: 'HERO_ACTION',
          steps: [
            {
              effect: 'PUT_INTO_PLAY',
              effectParams: {
                from: 'DISCARD',
                to: 'ALLIES',
                filter: {
                  types: ['ally'],
                  names: ['Nick Fury'],
                },
              },
            },
          ],
        },
        {
          playerId: 'p2',
        },
      );

      // The effect should find NO valid matches because Nick Fury violates unicity
      expect(effectResult.onomatopoeia).toBe('NO MATCHES FOUND');
      expect(state.players[1].allies.length).toBe(0);
      // Nick Fury remains safely in Player 2's discard pile
      expect(state.players[1].discard.some((c) => c.instanceId === p2Fury.instanceId)).toBe(true);
    });
  });
});
