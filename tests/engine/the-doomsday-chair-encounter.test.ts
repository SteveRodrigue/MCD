import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '@data/importer/card-loader';
import {
  GameState,
  HeroCard,
  AlterEgoCard,
  MinionCard,
  setupGame,
  resetInstanceCounter,
  createCardInstance,
  dispatchAction,
  step4_revealEncounterCards,
  getActiveVillain,
} from '@engine/index';
import { applyDamageToTarget } from '@engine/pipeline/damage-pipeline';
import { runMatch } from '@engine/simulation/match-simulator';

const THE_DOOMSDAY_CHAIR = '01183';
const MODOK = '01184';
const BIOMECHANICAL_UPGRADES = '01185';
const HYDRA_BOMBER = '01110'; // 2 HP minion

describe('The Doomsday Chair modular set (#356, #262)', () => {
  let state: GameState;

  const p1 = () => state.players[0];

  const revealFor = (playerId: string, code: string) => {
    state.players
      .find((p) => p.id === playerId)!
      .dealtEncounterCards.push(createCardInstance(cardCatalog.getCard(code)!));
    state = step4_revealEncounterCards(state);
  };

  beforeEach(() => {
    resetInstanceCounter();
    state = setupGame({
      catalog: cardCatalog,
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: cardCatalog.getCard('01001a') as HeroCard,
          alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
          deckCards: Array(15).fill(cardCatalog.getCard('01005')!),
        },
      ],
      skipMulligan: true,
    });
    p1().currentForm = 'hero';
    p1().activeFormCard = p1().hero;
  });

  describe('01183 The Doomsday Chair', () => {
    it('searches encounter deck for M.O.D.O.K. and puts him into play engaged with player', () => {
      const modokCard = cardCatalog.getCard(MODOK)!;
      state.encounterDeck = [createCardInstance(modokCard)];

      revealFor('p1', THE_DOOMSDAY_CHAIR);

      const engaged = p1().engagedMinions.find((m) => m.card.code === MODOK);
      expect(engaged).toBeDefined();
      expect(state.encounterDeck.some((c) => c.card.code === MODOK)).toBe(false);
      expect(state.sideSchemes.some((s) => s.card.code === THE_DOOMSDAY_CHAIR)).toBe(true);
    });

    it('searches encounter discard for M.O.D.O.K. and puts him into play engaged with player', () => {
      const modokCard = cardCatalog.getCard(MODOK)!;
      state.encounterDiscard = [createCardInstance(modokCard)];
      state.encounterDeck = [createCardInstance(cardCatalog.getCard('01180')!)];

      revealFor('p1', THE_DOOMSDAY_CHAIR);

      const engaged = p1().engagedMinions.find((m) => m.card.code === MODOK);
      expect(engaged).toBeDefined();
      expect(state.encounterDiscard.some((c) => c.card.code === MODOK)).toBe(false);
    });

    it('does not search or put another M.O.D.O.K. into play if M.O.D.O.K. is already in play', () => {
      const modokCard = cardCatalog.getCard(MODOK)!;
      const modokInstance = createCardInstance(modokCard);
      p1().engagedMinions.push(modokInstance as MinionCard & typeof modokInstance);

      state.encounterDeck = [createCardInstance(modokCard)];

      revealFor('p1', THE_DOOMSDAY_CHAIR);

      const modokCount = p1().engagedMinions.filter((m) => m.card.code === MODOK).length;
      expect(modokCount).toBe(1);
    });
  });

  describe('01184 M.O.D.O.K.', () => {
    it('triggers Retaliate 2 when attacked', () => {
      const modokCard = cardCatalog.getCard(MODOK)!;
      const modokInst = createCardInstance(modokCard);
      p1().engagedMinions.push(modokInst as MinionCard & typeof modokInst);

      const p1InitialHp = p1().health;

      // Spider-Man performs basic attack on M.O.D.O.K.
      const res = dispatchAction(state, {
        type: 'BASIC_ATTACK',
        playerId: 'p1',
        targetType: 'minion',
        targetInstanceId: modokInst.instanceId,
      });
      state = res.state;

      const updatedModok = p1().engagedMinions.find((m) => m.instanceId === modokInst.instanceId)!;
      // M.O.D.O.K. took 2 damage (Spider-Man ATK is 2)
      expect(updatedModok.tokens?.damage).toBe(2);

      // Spider-Man suffered 2 Retaliate damage
      expect(p1().health).toBe(p1InitialHp - 2);
    });
  });

  describe('01185 Biomechanical Upgrades', () => {
    it('attaches to the minion with the highest printed hit points without a copy attached', () => {
      const bomber = createCardInstance(cardCatalog.getCard(HYDRA_BOMBER)!);
      const modok = createCardInstance(cardCatalog.getCard(MODOK)!);
      p1().engagedMinions.push(
        bomber as MinionCard & typeof bomber,
        modok as MinionCard & typeof modok,
      );

      revealFor('p1', BIOMECHANICAL_UPGRADES);

      const updatedModok = p1().engagedMinions.find((m) => m.card.code === MODOK)!;
      const updatedBomber = p1().engagedMinions.find((m) => m.card.code === HYDRA_BOMBER)!;

      // Attached to M.O.D.O.K. (8 HP > 2 HP)
      expect(updatedModok.attachments?.some((a) => a.card.code === BIOMECHANICAL_UPGRADES)).toBe(
        true,
      );
      expect(updatedBomber.attachments?.length || 0).toBe(0);
      expect(getActiveVillain(state).attachments?.length || 0).toBe(0);
    });

    it('skips a minion that already has Biomechanical Upgrades attached', () => {
      // Clear encounter deck so surge does not draw unexpected encounter cards mid-test
      state.encounterDeck = [];

      const modok = createCardInstance(cardCatalog.getCard(MODOK)!);
      const bomber = createCardInstance(cardCatalog.getCard(HYDRA_BOMBER)!);
      p1().engagedMinions.push(
        modok as MinionCard & typeof modok,
        bomber as MinionCard & typeof bomber,
      );

      // Attach first copy to M.O.D.O.K.
      revealFor('p1', BIOMECHANICAL_UPGRADES);
      const firstModok = p1().engagedMinions.find((m) => m.card.code === MODOK)!;
      expect(firstModok.attachments?.some((a) => a.card.code === BIOMECHANICAL_UPGRADES)).toBe(
        true,
      );

      // Reveal second copy -> should attach to bomber (highest HP without a copy)
      revealFor('p1', BIOMECHANICAL_UPGRADES);
      const secondBomber = p1().engagedMinions.find((m) => m.card.code === HYDRA_BOMBER)!;
      expect(secondBomber.attachments?.some((a) => a.card.code === BIOMECHANICAL_UPGRADES)).toBe(
        true,
      );
    });

    it('is discarded when no minions are in play and surges per printed keyword', () => {
      p1().engagedMinions = [];

      revealFor('p1', BIOMECHANICAL_UPGRADES);

      // Not attached to villain
      expect(
        getActiveVillain(state).attachments?.some((a) => a.card.code === BIOMECHANICAL_UPGRADES),
      ).toBe(false);

      // In encounter discard
      expect(state.encounterDiscard.some((c) => c.card.code === BIOMECHANICAL_UPGRADES)).toBe(true);

      // Card surged
      expect(state.log.some((l) => l.key === 'encounter.surge.triggered')).toBe(true);
    });

    it('heals all damage from attached minion instead of defeat, then discards itself (#262)', () => {
      const modok = createCardInstance(cardCatalog.getCard(MODOK)!);
      p1().engagedMinions.push(modok as MinionCard & typeof modok);

      // Attach Biomechanical Upgrades
      revealFor('p1', BIOMECHANICAL_UPGRADES);
      const modokWithAttachment = p1().engagedMinions.find((m) => m.card.code === MODOK)!;
      expect(
        modokWithAttachment.attachments?.some((a) => a.card.code === BIOMECHANICAL_UPGRADES),
      ).toBe(true);

      // Deal 8 lethal damage to M.O.D.O.K. (health is 8)
      state = applyDamageToTarget(state, {
        target: {
          type: 'minion',
          entity: modokWithAttachment,
          instanceId: modokWithAttachment.instanceId,
          name: modokWithAttachment.card.name,
          targetPlayerId: 'p1',
          attachments: modokWithAttachment.attachments,
          statusCards: modokWithAttachment.statusCards,
        },
        amount: 8,
        sourceType: 'HERO',
        sourcePlayerId: 'p1',
        isAttack: true,
      }).state;

      // M.O.D.O.K. should still be in play with 0 damage!
      const healedModok = p1().engagedMinions.find(
        (m) => m.instanceId === modokWithAttachment.instanceId,
      );
      expect(healedModok).toBeDefined();
      expect(healedModok!.tokens?.damage || 0).toBe(0);

      // Biomechanical Upgrades discarded to encounter discard pile
      expect(healedModok!.attachments?.some((a) => a.card.code === BIOMECHANICAL_UPGRADES)).toBe(
        false,
      );
      expect(state.encounterDiscard.some((c) => c.card.code === BIOMECHANICAL_UPGRADES)).toBe(true);

      // Subsequent lethal damage now defeats M.O.D.O.K. normally
      state = applyDamageToTarget(state, {
        target: {
          type: 'minion',
          entity: healedModok!,
          instanceId: healedModok!.instanceId,
          name: healedModok!.card.name,
          targetPlayerId: 'p1',
          attachments: healedModok!.attachments,
          statusCards: healedModok!.statusCards,
        },
        amount: 8,
        sourceType: 'HERO',
        sourcePlayerId: 'p1',
        isAttack: true,
      }).state;

      expect(p1().engagedMinions.some((m) => m.instanceId === modokWithAttachment.instanceId)).toBe(
        false,
      );
      expect(
        state.encounterDiscard.some((c) => c.instanceId === modokWithAttachment.instanceId),
      ).toBe(true);
    });
  });

  describe('Full modular set simulation integration into a Rhino game', () => {
    it('plays a full match with Rhino + The Doomsday Chair modular set to completion without unhandled errors', () => {
      const simState = setupGame({
        catalog: cardCatalog,
        scenarioId: 'rhino',
        modularSetCodes: ['the_doomsday_chair'],
        players: [
          {
            id: 'p1',
            name: 'Spider-Man',
            hero: cardCatalog.getCard('01001a') as HeroCard,
            alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
            deckCards: Array(15).fill(cardCatalog.getCard('01005')!),
          },
        ],
        skipMulligan: true,
      });

      const allScenarioCards = [
        ...simState.encounterDeck,
        ...simState.encounterDiscard,
        ...simState.sideSchemes,
      ];
      expect(allScenarioCards.some((c) => c.card.code === THE_DOOMSDAY_CHAIR)).toBe(true);
      expect(allScenarioCards.some((c) => c.card.code === MODOK)).toBe(true);
      expect(allScenarioCards.some((c) => c.card.code === BIOMECHANICAL_UPGRADES)).toBe(true);

      const match = runMatch(simState, { maxRounds: 5 });

      expect(['HEROES', 'VILLAIN', 'TIMEOUT']).toContain(match.winner);
      expect(match.roundsPlayed).toBeGreaterThan(0);
    });
  });
});
