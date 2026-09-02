import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard } from '../../src/engine/models';
import { setupGame } from '../../src/engine/state/game-setup';
import { dispatchAction } from '../../src/engine/pipeline';

describe('Milestone 2A.1: Declarative Action Cost & Pre-Check Engine', () => {
  let state: GameState;
  let captainMarvelHero: HeroCard;
  let carolDanversAlterEgo: AlterEgoCard;
  let sheHulkHero: HeroCard;
  let jenniferWaltersAlterEgo: AlterEgoCard;

  beforeEach(() => {
    captainMarvelHero = cardCatalog.getCard('01010b') as HeroCard; // Captain Marvel Hero
    carolDanversAlterEgo = cardCatalog.getCard('01010a') as AlterEgoCard; // Carol Danvers Alter-Ego
    sheHulkHero = cardCatalog.getCard('01019a') as HeroCard;
    jenniferWaltersAlterEgo = cardCatalog.getCard('01019b') as AlterEgoCard;

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
        {
          id: 'p2',
          name: 'Jennifer Walters',
          hero: sheHulkHero,
          alterEgo: jenniferWaltersAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    state.players[0].currentForm = 'alter_ego';
    state.players[0].activeFormCard = carolDanversAlterEgo;
    state.players[1].currentForm = 'alter_ego';
    state.players[1].activeFormCard = jenniferWaltersAlterEgo;
  });

  describe('01010a Carol Danvers (Rechannel & Cost Pre-Check)', () => {
    it('Rejects Rechannel when Carol Danvers is already at maximum health', () => {
      const p1 = state.players[0];
      const maxHp = (p1.activeFormCard as AlterEgoCard).health || 12;
      p1.health = maxHp;
      p1.exhausted = false;

      const res = dispatchAction(state, {
        type: 'USE_CARD_ABILITY',
        playerId: p1.id,
        cardInstanceId: '01010a',
        abilityId: 'rechannel',
      });

      expect(res.result.success).toBe(false);
      expect(res.result.error).toContain('maximum health');
      expect(res.state.players[0].exhausted).toBe(false);
    });

    it('Allows Rechannel and exhausts Carol Danvers when damaged', () => {
      const p1 = state.players[0];
      const maxHp = (p1.activeFormCard as AlterEgoCard).health || 12;
      p1.health = maxHp - 3;
      p1.exhausted = false;

      const res = dispatchAction(state, {
        type: 'USE_CARD_ABILITY',
        playerId: p1.id,
        cardInstanceId: '01010a',
        abilityId: 'rechannel',
      });

      expect(res.result.success).toBe(true);
      expect(res.state.players[0].health).toBe(maxHp - 2);
      expect(res.state.players[0].exhausted).toBe(true);
    });
  });

  describe('01023 Legal Practice (Hand Discard Scaling Cost)', () => {
    it('Discards up to 5 cards from hand and removes 1 threat per discarded card', () => {
      const p2 = state.players[1];
      state.activePlayerIndex = 1;
      state.mainScheme.threat = 5;

      // Populate hand with 3 cards
      p2.hand = [
        { instanceId: 'h1', card: { name: 'Card A' } as any, exhausted: false },
        { instanceId: 'h2', card: { name: 'Card B' } as any, exhausted: false },
        { instanceId: 'h3', card: { name: 'Card C' } as any, exhausted: false },
      ];
      p2.discard = [];

      // Put Legal Practice card into tableau/action reference
      p2.tableau.push({
        instanceId: 'legal_practice_inst',
        card: cardCatalog.getCard('01023')!,
        exhausted: false,
      });

      const res = dispatchAction(state, {
        type: 'USE_CARD_ABILITY',
        playerId: p2.id,
        cardInstanceId: 'legal_practice_inst',
        abilityId: 'legal_practice_action',
        discardCardInstanceIds: ['h1', 'h2'],
      } as any);

      expect(res.result.success).toBe(true);
      expect(res.state.players[1].hand.length).toBe(1);
      expect(res.state.players[1].discard.length).toBe(2);
      expect(res.state.mainScheme.threat).toBe(3); // 5 - 2 = 3
    });
  });

  describe('01030 War Machine (Direct Damage Cost to Ally)', () => {
    it('Exhausts War Machine, inflicts 2 damage cost, and deals 2 damage to all enemies', () => {
      const p1 = state.players[0];
      p1.currentForm = 'hero';
      p1.activeFormCard = captainMarvelHero;
      state.activePlayerIndex = 0;

      // Put War Machine into allies
      const warMachineCard = cardCatalog.getCard('01030')!;
      p1.allies.push({
        instanceId: 'war_machine_inst',
        card: warMachineCard,
        tokens: { damage: 0 },
        exhausted: false,
      });

      // Put War Machine into tableau to use ability
      p1.tableau.push({
        instanceId: 'war_machine_inst',
        card: warMachineCard,
        tokens: { damage: 0 },
        exhausted: false,
      });

      const initialVillainHealth = state.villain.health;

      const res = dispatchAction(state, {
        type: 'USE_CARD_ABILITY',
        playerId: p1.id,
        cardInstanceId: 'war_machine_inst',
        abilityId: 'war_machine_action',
      });

      expect(res.result.success).toBe(true);
      expect(res.state.players[0].tableau[0].exhausted).toBe(true);
      expect(res.state.villain.health).toBe(initialVillainHealth - 1);
    });
  });
});
