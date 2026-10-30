import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { createCardInstance } from '@engine/state/card-instance';
import { GamePhase, CardInstance, StatusCard } from '@engine/models';
import { newRhinoGame } from '../support/game-fixtures';
import { initiateEnemyAttack } from '@engine/pipeline/combat-pipeline';
import { step2_villainAndMinionActivations } from '@engine/pipeline/villain-phase';

const WHIRLWIND = '01130';

function createMinion(code: string): CardInstance {
  const card = cardCatalog.getCard(code);
  if (!card) throw new Error(`Card ${code} not found in catalog`);
  return createCardInstance(card);
}

describe('Whirlwind (01130)', () => {
  beforeEach(() => {
    // Ensure supplemental rules are loaded
  });

  describe('Forced Interrupt: Multi-hero attack', () => {
    it('1 player: attacks the hero once and causes no secondary attacks', () => {
      const state = newRhinoGame({
        players: [{ hero: '01001a', form: 'hero' }],
      });
      state.phase = GamePhase.PLAYER_PHASE;
      const whirlwind = createMinion(WHIRLWIND);
      state.players[0].engagedMinions.push(whirlwind);
      state.encounterDeck = []; // No boost cards

      const hpBefore = state.players[0].health;
      initiateEnemyAttack(state, { type: 'MINION', card: whirlwind }, state.players[0].id, {
        synchronousPolicy: 'TAKE_UNDEFENDED',
      });

      // Whirlwind has 2 ATK
      expect(state.players[0].health).toBe(hpBefore - 2);
      expect(state.pendingActivations ?? []).toHaveLength(0);
    });

    it('2 players (both heroes): attacks primary hero and also resolves attack against second hero', () => {
      const state = newRhinoGame({
        players: [
          { hero: '01001a', form: 'hero' },
          { hero: '01010a', form: 'hero' },
        ],
      });
      state.phase = GamePhase.PLAYER_PHASE;
      const whirlwind = createMinion(WHIRLWIND);
      state.players[0].engagedMinions.push(whirlwind);
      state.encounterDeck = [];

      const p1HpBefore = state.players[0].health;
      const p2HpBefore = state.players[1].health;

      initiateEnemyAttack(state, { type: 'MINION', card: whirlwind }, state.players[0].id, {
        synchronousPolicy: 'TAKE_UNDEFENDED',
      });

      // Both heroes were attacked for 2 damage each
      expect(state.players[0].health).toBe(p1HpBefore - 2);
      expect(state.players[1].health).toBe(p2HpBefore - 2);
      expect(state.pendingActivations ?? []).toHaveLength(0);
    });

    it('2 players: attacks hero, does NOT attack second player in alter-ego', () => {
      const state = newRhinoGame({
        players: [
          { hero: '01001a', form: 'hero' },
          { hero: '01010a', form: 'alter-ego' },
        ],
      });
      state.phase = GamePhase.PLAYER_PHASE;
      const whirlwind = createMinion(WHIRLWIND);
      state.players[0].engagedMinions.push(whirlwind);
      state.encounterDeck = [];

      const p1HpBefore = state.players[0].health;
      const p2HpBefore = state.players[1].health;

      initiateEnemyAttack(state, { type: 'MINION', card: whirlwind }, state.players[0].id, {
        synchronousPolicy: 'TAKE_UNDEFENDED',
      });

      // Player 1 attacked, Player 2 in alter-ego is untouched
      expect(state.players[0].health).toBe(p1HpBefore - 2);
      expect(state.players[1].health).toBe(p2HpBefore);
      expect(state.pendingActivations ?? []).toHaveLength(0);
    });

    it('3 players (Hero, Hero, Alter-Ego): attacks P1 and P2, skips P3', () => {
      const state = newRhinoGame({
        players: [
          { hero: '01001a', form: 'hero' },
          { hero: '01010a', form: 'hero' },
          { hero: '01029a', form: 'alter-ego' },
        ],
      });
      state.phase = GamePhase.PLAYER_PHASE;
      const whirlwind = createMinion(WHIRLWIND);
      state.players[0].engagedMinions.push(whirlwind);
      state.encounterDeck = [];

      const hpBefore = state.players.map((p) => p.health);

      initiateEnemyAttack(state, { type: 'MINION', card: whirlwind }, state.players[0].id, {
        synchronousPolicy: 'TAKE_UNDEFENDED',
      });

      expect(state.players[0].health).toBe(hpBefore[0] - 2);
      expect(state.players[1].health).toBe(hpBefore[1] - 2);
      expect(state.players[2].health).toBe(hpBefore[2]); // Alter-ego took 0 damage
      expect(state.pendingActivations ?? []).toHaveLength(0);
    });

    it('4 players (Hero, Alter-Ego, Hero, Hero): attacks P1, P3, P4 in order, skips P2', () => {
      const state = newRhinoGame({
        players: [
          { hero: '01001a', form: 'hero' },
          { hero: '01010a', form: 'alter-ego' },
          { hero: '01019a', form: 'hero' },
          { hero: '01029a', form: 'hero' },
        ],
      });
      state.phase = GamePhase.PLAYER_PHASE;
      const whirlwind = createMinion(WHIRLWIND);
      state.players[0].engagedMinions.push(whirlwind);
      state.encounterDeck = [];

      const hpBefore = state.players.map((p) => p.health);

      initiateEnemyAttack(state, { type: 'MINION', card: whirlwind }, state.players[0].id, {
        synchronousPolicy: 'TAKE_UNDEFENDED',
      });

      expect(state.players[0].health).toBe(hpBefore[0] - 2);
      expect(state.players[1].health).toBe(hpBefore[1]); // Alter-ego skipped
      expect(state.players[2].health).toBe(hpBefore[2] - 2);
      expect(state.players[3].health).toBe(hpBefore[3] - 2);
      expect(state.pendingActivations ?? []).toHaveLength(0);
    });

    it('during Villain Phase step 2: resolves attacks across all heroes', () => {
      const state = newRhinoGame({
        players: [
          { hero: '01001a', form: 'hero' },
          { hero: '01010a', form: 'hero' },
        ],
      });
      const whirlwind = createMinion(WHIRLWIND);
      state.players[0].engagedMinions.push(whirlwind);
      state.encounterDeck = [];

      const p1HpBefore = state.players[0].health;
      const p2HpBefore = state.players[1].health;

      // In step 2:
      // Rhino attacks P1 (2 ATK), P2 (2 ATK)
      // Whirlwind activates against P1 (2 ATK) and also attacks P2 (2 ATK)
      step2_villainAndMinionActivations(state, {
        synchronousPolicy: 'TAKE_UNDEFENDED',
      });

      // P1: Rhino (2) + Whirlwind (2) = 4
      expect(state.players[0].health).toBe(p1HpBefore - 4);
      // P2: Rhino (2) + Whirlwind (2) = 4
      expect(state.players[1].health).toBe(p2HpBefore - 4);
    });

    it('minion defeat during first attack: secondary attacks do not occur', () => {
      const state = newRhinoGame({
        players: [
          { hero: '01040a', form: 'hero' }, // Black Panther has Retaliate 1
          { hero: '01010a', form: 'hero' },
        ],
      });
      state.phase = GamePhase.PLAYER_PHASE;
      const whirlwind = createMinion(WHIRLWIND);
      whirlwind.tokens = { damage: 5 }; // Whirlwind has 6 HP, so 1 retaliate damage will defeat him
      state.players[0].engagedMinions.push(whirlwind);
      state.encounterDeck = [];

      const p1HpBefore = state.players[0].health;
      const p2HpBefore = state.players[1].health;

      initiateEnemyAttack(state, { type: 'MINION', card: whirlwind }, state.players[0].id, {
        synchronousPolicy: 'TAKE_UNDEFENDED',
      });

      // P1 took 2 damage
      expect(state.players[0].health).toBe(p1HpBefore - 2);
      // Whirlwind was defeated by Retaliate
      expect(state.players[0].engagedMinions).not.toContain(whirlwind);
      // P2 took 0 damage because Whirlwind was defeated before secondary attack initiated
      expect(state.players[1].health).toBe(p2HpBefore);
    });

    it('stun check: a stunned Whirlwind cancels attack in step 1 and makes no secondary attacks', () => {
      const state = newRhinoGame({
        players: [
          { hero: '01001a', form: 'hero' },
          { hero: '01010a', form: 'hero' },
        ],
      });
      state.phase = GamePhase.PLAYER_PHASE;
      const whirlwind = createMinion(WHIRLWIND);
      whirlwind.statusCards = [StatusCard.STUNNED];
      state.players[0].engagedMinions.push(whirlwind);
      state.encounterDeck = [];

      const p1HpBefore = state.players[0].health;
      const p2HpBefore = state.players[1].health;

      initiateEnemyAttack(state, { type: 'MINION', card: whirlwind }, state.players[0].id, {
        synchronousPolicy: 'TAKE_UNDEFENDED',
      });

      // Stun cleared
      expect(whirlwind.statusCards).toHaveLength(0);
      // No damage dealt to either player
      expect(state.players[0].health).toBe(p1HpBefore);
      expect(state.players[1].health).toBe(p2HpBefore);
      expect(state.pendingActivations ?? []).toHaveLength(0);
    });
  });

  describe('Boost Ability: Deal 1 damage to each hero', () => {
    it('deals 1 damage to each hero, ignoring alter-egos', () => {
      const state = newRhinoGame({
        players: [
          { hero: '01001a', form: 'hero' },
          { hero: '01010a', form: 'alter-ego' },
          { hero: '01019a', form: 'hero' },
        ],
      });
      state.phase = GamePhase.PLAYER_PHASE;
      const whirlwind = createMinion(WHIRLWIND);
      state.encounterDeck = [whirlwind];

      const hpBefore = state.players.map((p) => p.health);

      // Rhino (2 ATK) attacks P1 with Whirlwind as boost card
      initiateEnemyAttack(state, { type: 'VILLAIN' }, state.players[0].id, {
        synchronousPolicy: 'TAKE_UNDEFENDED',
        acceptOptionalTriggers: true,
      });

      // Rhino has 2 ATK. Whirlwind boost deals 1 damage to each hero (P1, P3).
      // Whirlwind has 0 boost icons.
      // P1 takes 2 (Rhino ATK) + 1 (Boost) = 3 damage
      // P2 (alter-ego) takes 0 damage
      // P3 (hero) takes 1 (Boost) damage
      expect(state.players[0].health).toBe(hpBefore[0] - 3);
      expect(state.players[1].health).toBe(hpBefore[1]);
      expect(state.players[2].health).toBe(hpBefore[2] - 1);
    });
  });
});
