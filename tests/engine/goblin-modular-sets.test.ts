import path from 'node:path';
import { beforeAll, describe, it, expect } from 'vitest';
import { applyContent } from '@data/content/apply';
import { NodeFsDriver } from '@data/content/drivers/node-fs';
import { loadContent } from '@data/content/loader';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { setupGame } from '@engine/state/game-setup';
import { createCardInstance } from '@engine/state/card-instance';
import { HeroCard, AlterEgoCard, StatusCard } from '@engine/models';
import { kernel } from '@engine/kernel';
import {
  executeEnemyAttackSynchronously,
  resolveDefenderDeclaration,
} from '@engine/pipeline/combat-pipeline';
import { getEffectiveVillainStats } from '@engine/pipeline/stat-calculator';
import { canChangeForm } from '@engine/pipeline/legality-checker';
import { resolveDecisionPrompt, peekDecisionPrompt } from '@engine/pipeline/prompt-queue';

describe('Green Goblin Modular Sets Supplemental & Engine Integration', () => {
  beforeAll(async () => {
    const root = path.resolve(__dirname, '../../content');
    applyContent(await loadContent(new NodeFsDriver(root), { packs: ['core', 'gob'] }));
  });

  const spiderManHero = () => cardCatalog.getCard('01001a') as HeroCard;
  const peterParkerAlterEgo = () => cardCatalog.getCard('01001b') as AlterEgoCard;

  const createTestState = () => {
    const state = setupGame({
      catalog: cardCatalog,
      scenarioId: 'rhino',
      difficulty: 'STANDARD',
      modularSetCodes: ['bomb_scare'],
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero(),
          alterEgo: peterParkerAlterEgo(),
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
    });
    state.players[0].currentForm = 'hero';
    return state;
  };

  describe('Goblin Gimmicks', () => {
    it('02033 (Goblin Glider): attaches to enemy with highest HP and grants +1 ATK', () => {
      const state = createTestState();
      const glider = createCardInstance(cardCatalog.getCard('02033')!);
      kernel.resolveActiveEncounterCardAfterInterrupt(state, glider, state.players[0], false);

      const villain = state.villains[0];
      expect(villain.attachments.some((a) => a.card.code === '02033')).toBe(true);

      const stats = getEffectiveVillainStats(state, villain);
      expect(stats.attack).toBe(villain.card.attack! + 1);
    });

    it('02034 (Pumpkin Bombs): deals 2 indirect damage and discards after villain attack resolves', () => {
      const state = createTestState();
      const bombs = createCardInstance(cardCatalog.getCard('02034')!);
      kernel.resolveActiveEncounterCardAfterInterrupt(state, bombs, state.players[0], false);

      const villain = state.villains[0];
      expect(villain.attachments.some((a) => a.card.code === '02034')).toBe(true);

      const initialHp = state.players[0].health;
      executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1');

      // Pumpkin bombs response should have discarded it
      expect(villain.attachments.some((a) => a.card.code === '02034')).toBe(false);
      // Player took attack damage + 2 indirect damage
      expect(state.players[0].health).toBeLessThan(initialHp);
    });

    it('02035 (Intimidation): deals facedown boost card to villain on choice', () => {
      const state = createTestState();
      const intimidation = createCardInstance(cardCatalog.getCard('02035')!);
      kernel.resolveActiveEncounterCardAfterInterrupt(state, intimidation, state.players[0], false);

      expect(state.pendingDecisionQueue.length).toBeGreaterThan(0);
      const prompt = state.pendingDecisionQueue[0];
      const boostOption = prompt.options.find((o) => o.id === 'facedown_boost');
      expect(boostOption).toBeDefined();

      resolveDecisionPrompt(state, 'p1', 'facedown_boost');

      const villain = state.villains[0];
      expect((villain.facedownBoostCards ?? []).length).toBe(1);
    });

    it('02036 (Regenerative Healing): heals villain damage scaled by stage', () => {
      const state = createTestState();
      const villain = state.villains[0];
      villain.health = villain.maxHealth - 5;

      const healing = createCardInstance(cardCatalog.getCard('02036')!);
      kernel.resolveActiveEncounterCardAfterInterrupt(state, healing, state.players[0], false);

      // Stage 1 -> heals 2 * 1 = 2 damage
      expect(villain.health).toBe(villain.maxHealth - 3);
    });
  });

  describe('A Mess of Things', () => {
    it('02037 (A Mess of Things): places additional threat for stunned friendly characters', () => {
      const state = createTestState();
      state.players[0].statusCards.push(StatusCard.STUNNED);

      const mess = createCardInstance(cardCatalog.getCard('02037')!);
      kernel.resolveActiveEncounterCardAfterInterrupt(state, mess, state.players[0], false);

      const sideScheme = state.sideSchemes.find((s) => s.card.code === '02037');
      expect(sideScheme).toBeDefined();
      // Base threat 2 + (1 stunned * 2) = 4 threat
      expect(sideScheme!.threat).toBe(4);
    });

    it('02038 (Scorpion): stuns damaged character on attack', () => {
      const state = createTestState();
      const scorpion = createCardInstance(cardCatalog.getCard('02038')!);
      state.players[0].engagedMinions.push(scorpion);

      executeEnemyAttackSynchronously(state, { type: 'MINION', card: scorpion }, 'p1');

      expect(state.players[0].statusCards).toContain(StatusCard.STUNNED);
    });

    it('02039 (Gang-Up): triggers attacks in Hero form, surges in Alter-Ego form', () => {
      let state = createTestState();
      const gangUp = createCardInstance(cardCatalog.getCard('02039')!);
      const initialSurgeDealt = state.players[0].dealtEncounterCards.length;

      // In Hero form
      kernel.resolveActiveEncounterCardAfterInterrupt(state, gangUp, state.players[0], false);
      if (peekDecisionPrompt(state)?.title?.includes('Spider-Man')) {
        state = resolveDecisionPrompt(state, 'p1', 'pass').state;
      }
      state = resolveDefenderDeclaration(state, { type: 'UNDEFENDED', playerId: 'p1' });
      expect(state.players[0].health).toBeLessThan(10);

      // In Alter-Ego form
      state.players[0].currentForm = 'alter_ego';
      const gangUp2 = createCardInstance(cardCatalog.getCard('02039')!);
      kernel.resolveActiveEncounterCardAfterInterrupt(state, gangUp2, state.players[0], false);
      expect(state.players[0].dealtEncounterCards.length).toBeGreaterThan(initialSurgeDealt);
    });
  });

  describe('Power Drain', () => {
    it('02041 (Power Drain): discards cards from player hand when defeated based on boost icons', () => {
      const state = createTestState();
      const cardWithBoost = createCardInstance(cardCatalog.getCard('01100')!); // Ivory Horn (1 boost)
      state.encounterDeck.unshift(cardWithBoost, cardWithBoost);

      state.players[0].hand = [
        createCardInstance(cardCatalog.getCard('01005')!),
        createCardInstance(cardCatalog.getCard('01005')!),
      ];

      const drain = createCardInstance(cardCatalog.getCard('02041')!);
      kernel.executeEffect(
        state,
        drain.card.enrichment!.abilities!.find((a) => a.id === 'power_drain_when_defeated')!,
        {
          playerId: 'p1',
          sourceCardInstance: drain,
        },
      );

      // 2 cards discarded from deck each with 1 boost = 2 boost icons = 2 cards discarded from hand
      expect(state.players[0].hand.length).toBe(0);
    });

    it('02042 (Electro): deals indirect damage after attacking based on discarded boost icons', () => {
      const state = createTestState();
      const cardWithBoost = createCardInstance(cardCatalog.getCard('01100')!);
      state.encounterDeck.unshift(cardWithBoost);

      const electro = createCardInstance(cardCatalog.getCard('02042')!);
      state.players[0].engagedMinions.push(electro);

      const initialHp = state.players[0].health;
      executeEnemyAttackSynchronously(state, { type: 'MINION', card: electro }, 'p1');

      // Base attack (2) + boost response damage (1)
      expect(state.players[0].health).toBeLessThanOrEqual(initialHp - 3);
    });
  });

  describe('Running Interference', () => {
    it('02048 (All Tied Up): prevents identity from readying and changing form', () => {
      const state = createTestState();
      const tiedUp = createCardInstance(cardCatalog.getCard('02048')!);
      kernel.resolveActiveEncounterCardAfterInterrupt(state, tiedUp, state.players[0], false);

      expect(state.players[0].attachments?.some((a) => a.card.code === '02048')).toBe(true);

      // Verify cannot change form
      const check = canChangeForm(state, 'p1');
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('All Tied Up');

      // Verify cannot ready
      state.players[0].exhausted = true;
      kernel.executeEffect(
        state,
        {
          id: 'test_ready',
          timing: 'HERO_ACTION',
          steps: [{ effect: 'READY', effectParams: { target: 'SELF_IDENTITY' } }],
        },
        { playerId: 'p1' },
      );
      expect(state.players[0].exhausted).toBe(true);
    });

    it('02049 (Media Coverage): doubles when revealed triggers', () => {
      const state = createTestState();
      const media = createCardInstance(cardCatalog.getCard('02049')!);
      kernel.resolveActiveEncounterCardAfterInterrupt(state, media, state.players[0], false);

      expect(state.players[0].attachments?.some((a) => a.card.code === '02049')).toBe(true);

      const initialHp = state.players[0].health;
      // Shocker (01103) deals 1 damage to each hero when revealed
      const shocker = createCardInstance(cardCatalog.getCard('01103')!);
      kernel.resolveActiveEncounterCardAfterInterrupt(state, shocker, state.players[0], false);

      // Triggered twice due to Media Coverage (1 damage * 2)
      expect(state.players[0].health).toBe(initialHp - 2);
    });
  });
});
