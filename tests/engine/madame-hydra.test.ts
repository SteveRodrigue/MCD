import { describe, it, expect } from 'vitest';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { applyDamageToTarget } from '@engine/pipeline/damage-pipeline';
import { executeEnemyAttackSynchronously } from '@engine/pipeline/combat-pipeline';
import { executeMinionSchemeAgainstPlayer } from '@engine/pipeline/villain-phase';
import { getValidStepTargets } from '@engine/effects/target-choice';
import { executeEffect } from '@engine/effects';
import {
  GameState,
  StatusCard,
  CardInstance,
  SideSchemeState,
  getActiveMainScheme,
  getActiveVillain,
} from '@engine/models';

function buildGame(): {
  state: GameState;
  madameHydra: CardInstance;
  legionsOfHydra: SideSchemeState;
  hydraBomber: CardInstance;
} {
  const state = setupGame({
    catalog: cardCatalog,
    scenarioId: 'rhino',
    players: [
      {
        id: 'p1',
        name: 'Spider-Man',
        hero: cardCatalog.getCard('01001a')!,
        alterEgo: cardCatalog.getCard('01001b')!,
        deckCards: [cardCatalog.getCard('01005')!],
      },
    ] as any,
    villain: cardCatalog.getCard('01094')! as any,
    mainScheme: cardCatalog.getCard('01097')! as any,
    encounterCards: cardCatalog.getCardsBySet('rhino'),
    skipMulligan: true,
  });

  const player = state.players[0];
  player.currentForm = 'hero';

  const madameHydraCard = cardCatalog.getCard('01181')!;
  const madameHydra = createCardInstance(madameHydraCard);

  const hydraBomberCard = cardCatalog.getCard('01110')!;
  const hydraBomber = createCardInstance(hydraBomberCard);

  player.engagedMinions = [madameHydra, hydraBomber];

  const legionsCard = cardCatalog.getCard('01180')!;
  const legionsOfHydra: SideSchemeState = {
    instanceId: 'side_scheme_legions',
    card: legionsCard as any,
    threat: 3,
  };
  state.sideSchemes = [legionsOfHydra];

  return { state, madameHydra, legionsOfHydra, hydraBomber };
}

const refOf = (m: CardInstance) => ({
  type: 'minion' as const,
  entity: m,
  instanceId: m.instanceId,
  name: m.card.name,
  targetPlayerId: 'p1',
  statusCards: m.statusCards,
  attachments: m.attachments,
});

describe('Madame Hydra (01181) - Damage Immunity & Forced Response (#489)', () => {
  describe('Damage Immunity while Legions of Hydra (01180) is in play', () => {
    it('1. basic attack deals 0 damage to Madame Hydra', () => {
      const { state, madameHydra } = buildGame();
      const res = applyDamageToTarget(state, {
        target: refOf(madameHydra),
        amount: 2,
        sourcePlayerId: 'p1',
        sourceType: 'HERO',
        isAttack: true,
      } as any);

      expect(res.result.damageTaken ?? 0).toBe(0);
      expect(madameHydra.tokens?.damage ?? 0).toBe(0);
    });

    it('2. single-target attack events reject Madame Hydra as an eligible target', () => {
      const { state, madameHydra, hydraBomber } = buildGame();
      const player = state.players[0];

      // Swinging Web-Kick (01005) or generic single-target attack DEAL_DAMAGE
      const step = {
        effect: 'DEAL_DAMAGE',
        effectParams: { amount: 8, target: 'CHOSEN_ENEMY' },
      } as any;

      const validTargets = getValidStepTargets(state, player, step, {}).map((t) => t.id);
      expect(validTargets).not.toContain(madameHydra.instanceId);
      expect(validTargets).toContain(hydraBomber.instanceId);
      expect(validTargets).toContain(getActiveVillain(state)?.instanceId);
    });

    it('3. forced direct damage deals 0 damage, preserves Tough status, and never defeats her', () => {
      const { state, madameHydra } = buildGame();
      madameHydra.statusCards = [StatusCard.TOUGH];

      const res = applyDamageToTarget(state, {
        target: refOf(madameHydra),
        amount: 99,
        sourcePlayerId: 'p1',
        sourceType: 'CARD_EFFECT',
      } as any);

      expect(res.result.damageTaken ?? 0).toBe(0);
      expect(madameHydra.tokens?.damage ?? 0).toBe(0);
      expect(madameHydra.statusCards).toContain(StatusCard.TOUGH);
      expect(res.state.players[0].engagedMinions).toContain(madameHydra);
    });

    it('4. multi-enemy attack events deal damage to other enemies while Madame Hydra takes 0 damage', () => {
      const { state, madameHydra, hydraBomber } = buildGame();
      const player = state.players[0];
      const villain = getActiveVillain(state)!;
      const initialVillainHp = villain.health;

      // Energy Daggers (01046): deal 1 damage to villain and each minion engaged with you
      const energyDaggersCard = cardCatalog.getCard('01046')!;
      const ability = energyDaggersCard.enrichment?.abilities?.[0];
      expect(ability).toBeDefined();

      executeEffect(state, ability!, {
        playerId: player.id,
        targetPlayerId: player.id,
        sourceCardInstance: createCardInstance(energyDaggersCard),
      });

      // Villain took 1 damage
      expect(villain.health).toBe(initialVillainHp - 1);
      // Other minion took 1 damage
      expect(hydraBomber.tokens?.damage ?? 0).toBe(1);
      // Madame Hydra took 0 damage
      expect(madameHydra.tokens?.damage ?? 0).toBe(0);
    });

    it('5. Retaliate deals 0 damage to Madame Hydra when she attacks a hero with Retaliate', () => {
      const { state, madameHydra } = buildGame();
      const player = state.players[0];
      // Hero with Retaliate 1
      const vibraniumSuit = createCardInstance(cardCatalog.getCard('01049')!);
      player.tableau = [vibraniumSuit];

      executeEnemyAttackSynchronously(
        state,
        { type: 'MINION', card: madameHydra },
        player.id,
        'TAKE_UNDEFENDED',
      );

      // Hero takes Madame Hydra's ATK (2)
      expect(player.health).toBe(player.maxHealth - 2);
      // Madame Hydra took 0 Retaliate damage
      expect(madameHydra.tokens?.damage ?? 0).toBe(0);
    });
  });

  describe('Damage Vulnerability once Legions of Hydra (01180) is defeated', () => {
    it('1. basic attack deals full damage once Legions of Hydra is discarded', () => {
      const { state, madameHydra } = buildGame();
      state.sideSchemes = []; // Legions of Hydra defeated and removed

      const res = applyDamageToTarget(state, {
        target: refOf(madameHydra),
        amount: 2,
        sourcePlayerId: 'p1',
        sourceType: 'HERO',
        isAttack: true,
      } as any);

      expect(res.result.damageTaken).toBe(2);
      expect(madameHydra.tokens?.damage).toBe(2);
    });

    it('2. attack events accept Madame Hydra as a target once Legions of Hydra is discarded', () => {
      const { state, madameHydra } = buildGame();
      state.sideSchemes = []; // Legions of Hydra defeated

      const step = {
        effect: 'DEAL_DAMAGE',
        effectParams: { amount: 8, target: 'CHOSEN_ENEMY' },
      } as any;

      const validTargets = getValidStepTargets(state, state.players[0], step, {}).map((t) => t.id);
      expect(validTargets).toContain(madameHydra.instanceId);
    });

    it('3. lethal damage strips Tough and defeats Madame Hydra once Legions of Hydra is discarded', () => {
      const { state, madameHydra } = buildGame();
      state.sideSchemes = [];
      madameHydra.statusCards = [StatusCard.TOUGH];

      // First hit consumes Tough
      applyDamageToTarget(state, {
        target: refOf(madameHydra),
        amount: 2,
        sourcePlayerId: 'p1',
        sourceType: 'HERO',
      } as any);
      expect(madameHydra.statusCards).not.toContain(StatusCard.TOUGH);
      expect(madameHydra.tokens?.damage ?? 0).toBe(0);

      // Second hit defeats her (HP: 6)
      applyDamageToTarget(state, {
        target: refOf(madameHydra),
        amount: 6,
        sourcePlayerId: 'p1',
        sourceType: 'HERO',
      } as any);
      expect(state.players[0].engagedMinions).not.toContain(madameHydra);
    });
  });

  describe('Forced Response: After Madame Hydra schemes or attacks', () => {
    it('1. places 2 threat on Legions of Hydra (01180) after Madame Hydra attacks', () => {
      const { state, madameHydra, legionsOfHydra } = buildGame();
      const player = state.players[0];
      const initialMainThreat = getActiveMainScheme(state).threat;

      executeEnemyAttackSynchronously(
        state,
        { type: 'MINION', card: madameHydra },
        player.id,
        'TAKE_UNDEFENDED',
      );

      // 2 threat placed on Legions of Hydra (3 -> 5)
      expect(legionsOfHydra.threat).toBe(5);
      // Main scheme threat unaffected by attack
      expect(getActiveMainScheme(state).threat).toBe(initialMainThreat);
    });

    it('2. places 2 threat on Legions of Hydra (01180) after Madame Hydra schemes', () => {
      const { state, madameHydra, legionsOfHydra } = buildGame();
      const player = state.players[0];
      player.currentForm = 'alter_ego';
      const initialMainThreat = getActiveMainScheme(state).threat;

      executeMinionSchemeAgainstPlayer(state, madameHydra, player);

      // Main scheme threat increased by Madame Hydra's SCH (2)
      expect(getActiveMainScheme(state).threat).toBe(initialMainThreat + 2);
      // Forced Response placed 2 threat on Legions of Hydra (3 -> 5)
      expect(legionsOfHydra.threat).toBe(5);
    });

    it('3. threat placement fizzles safely when Legions of Hydra is not in play', () => {
      const { state, madameHydra } = buildGame();
      state.sideSchemes = []; // Legions of Hydra absent
      const player = state.players[0];
      const initialMainThreat = getActiveMainScheme(state).threat;

      executeEnemyAttackSynchronously(
        state,
        { type: 'MINION', card: madameHydra },
        player.id,
        'TAKE_UNDEFENDED',
      );

      // Main scheme unaffected and no crash
      expect(getActiveMainScheme(state).threat).toBe(initialMainThreat);
    });
  });
});
