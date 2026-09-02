import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard, StatusCard } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { executeEnemyAttackSynchronously } from '@engine/pipeline';
import { executeEffect, dealDirectDamage } from '@engine/effects';

describe('Sub-Milestone 2B-3: Damage Prevention, Overkill, Retaliate & Direct Damage Invariant', () => {
  let state: GameState;
  let spiderManHero: HeroCard;
  let peterParkerAlterEgo: AlterEgoCard;

  beforeEach(() => {
    spiderManHero = cardCatalog.getCard('01001a') as HeroCard;
    peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;

    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = spiderManHero;
    state.players[0].hand = [];
  });

  describe('Damage Prevention & Tough Status Preservation (Step 6)', () => {
    it('preserves Tough status when incoming damage is mitigated or prevented to 0', () => {
      state.players[0].statusCards.push(StatusCard.TOUGH);
      // Give Backflip (01003) to player hand
      state.players[0].hand = [createCardInstance(cardCatalog.getCard('01003')!)];

      // Put a 2-boost card on encounter deck
      state.encounterDeck = [
        createCardInstance(cardCatalog.getCard('01103')!),
        ...state.encounterDeck,
      ];

      const initialHp = state.players[0].health;

      executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'TAKE_UNDEFENDED');

      // Backflip prevented all 4 damage
      expect(state.players[0].health).toBe(initialHp);
      // Tough status was PRESERVED because 0 damage reached the character
      expect(state.players[0].statusCards).toContain(StatusCard.TOUGH);
    });

    it('consumes Tough status only when unmitigated damage > 0', () => {
      state.players[0].statusCards.push(StatusCard.TOUGH);
      state.players[0].hand = []; // No Backflip

      const initialHp = state.players[0].health;

      executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'TAKE_UNDEFENDED');

      // Tough absorbed the attack damage
      expect(state.players[0].health).toBe(initialHp);
      expect(state.players[0].statusCards).not.toContain(StatusCard.TOUGH);
    });
  });

  describe('Bidirectional Overkill Routing', () => {
    it('Enemy -> Ally -> Hero: routes excess damage to Hero when enemy attack with Overkill defeats ally', () => {
      // Add an ally with 2 HP remaining
      const allyInst = createCardInstance(cardCatalog.getCard('01002')!); // Black Cat (HP 1 or 2)
      state.players[0].allies.push(allyInst);

      // Attach Charge (01099) to Rhino giving Overkill (+3 ATK on attack)
      const chargeCard = cardCatalog.getCard('01099')!;
      state.villain.attachments.push(createCardInstance(chargeCard));
      state.encounterDeck = []; // No extra boost icons

      const initialHp = state.players[0].health;

      // Rhino attacks with Overkill (Base ATK 2 + Charge 3 = 5 damage)
      // Ally Black Cat (01002) has health 2
      executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'ALLY_CHUMP_BLOCK');

      // Ally defeated
      expect(state.players[0].allies.length).toBe(0);
      // Excess damage (5 - 2 = 3 damage) dealt to Hero!
      expect(state.players[0].health).toBe(initialHp - 3);
    });

    it('Player -> Minion -> Villain: routes excess damage to Villain when player attack with Overkill defeats minion', () => {
      // Spawn a minion with 1 HP (Hydra Mercenary 01108)
      const minionInst = createCardInstance(cardCatalog.getCard('01108')!);
      state.players[0].engagedMinions.push(minionInst);

      const initialVillainHp = state.villain.health;

      // Player plays Relentless Assault (01053) dealing 5 damage with Overkill
      const relentlessAssault = cardCatalog.getCard('01053')!;
      const ability = relentlessAssault.enrichment!.abilities![0];

      executeEffect(state, ability, {
        playerId: 'p1',
        targetInstanceId: minionInst.instanceId,
      });

      // Minion is defeated
      expect(state.players[0].engagedMinions.length).toBe(0);
      // Excess damage (5 - 1 = 4 damage) dealt to Villain!
      expect(state.villain.health).toBe(initialVillainHp - 4);
    });
  });

  describe('Retaliate X Return Damage (Step 7)', () => {
    it('deals Retaliate damage to attacking enemy when defending hero survives', () => {
      // Give Spider-Man hero a card with Retaliate 1 in tableau (or keyword)
      (state.players[0].hero as any).keywords = ['Retaliate 1'];

      const initialVillainHp = state.villain.health;

      executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'HERO_IF_READY');

      // Hero survived and dealt 1 Retaliate damage to Villain!
      expect(state.villain.health).toBe(initialVillainHp - 1);
    });

    it('does NOT trigger Retaliate if defending character is defeated', () => {
      (state.players[0].hero as any).keywords = ['Retaliate 1'];
      state.players[0].health = 1; // 1 HP left

      const initialVillainHp = state.villain.health;

      executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'TAKE_UNDEFENDED');

      // Hero defeated
      expect(state.players[0].health).toBe(0);
      // Villain took 0 retaliate damage because hero was defeated
      expect(state.villain.health).toBe(initialVillainHp);
    });

    it('deals Retaliate damage back to hero when hero attacks a minion with Retaliate 1 and minion survives', () => {
      // Whiplash has Retaliate 1 and 4 HP
      const whiplash = cardCatalog.getCard('01172')!;
      const whiplashInst = createCardInstance(whiplash);
      state.players[0].engagedMinions.push(whiplashInst);

      const initialHeroHp = state.players[0].health;

      // Deal 2 damage to Whiplash (survives with 2 HP left)
      const ability = {
        id: 'test_attack',
        timing: 'HERO_ACTION' as any,
        steps: [
          {
            effect: 'DEAL_DAMAGE' as any,
            params: {
              amount: 2,
              target: 'minion',
            },
          },
        ],
      };

      executeEffect(state, ability, {
        playerId: 'p1',
        targetInstanceId: whiplashInst.instanceId,
      });

      // Hero took 1 retaliate damage from Whiplash
      expect(state.players[0].health).toBe(initialHeroHp - 1);
    });
  });

  describe('Direct Damage Invariant (dealDirectDamage)', () => {
    it('direct damage bypasses Hero DEF and cannot be blocked, but is absorbed by Tough', () => {
      state.players[0].statusCards.push(StatusCard.TOUGH);
      const initialHp = state.players[0].health;

      const result = dealDirectDamage(state, 'HERO', 3, 'p1');

      expect(result.absorbedByTough).toBe(true);
      expect(state.players[0].health).toBe(initialHp);
      expect(state.players[0].statusCards).not.toContain(StatusCard.TOUGH);
    });

    it('direct damage directly reduces hero health when Tough is not present', () => {
      const initialHp = state.players[0].health;

      const result = dealDirectDamage(state, 'HERO', 3, 'p1');

      expect(result.absorbedByTough).toBe(false);
      expect(result.damageDealt).toBe(3);
      expect(state.players[0].health).toBe(initialHp - 3);
    });
  });

  describe('Promoted Core Set Cards (Wave 2C)', () => {
    it('executes Gamma Slam (01021) dealing damage equal to sustained damage (max 15)', () => {
      // Set hero max health to 15, current health to 5 (sustained 10 damage)
      (state.players[0].hero as any).health = 15;
      state.players[0].health = 5;

      const initialVillainHp = state.villain.health;

      const gammaSlam = cardCatalog.getCard('01021')!;
      const ability = gammaSlam.enrichment!.abilities![0];

      executeEffect(state, ability, {
        playerId: 'p1',
      });

      // Deals 10 damage to Villain!
      expect(state.villain.health).toBe(initialVillainHp - 10);
    });
  });
});
