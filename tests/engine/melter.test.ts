import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { createCardInstance } from '@engine/state/card-instance';
import { GamePhase, CardInstance } from '@engine/models';
import { newRhinoGame } from '../support/game-fixtures';
import { initiateEnemyAttack } from '@engine/pipeline/combat-pipeline';
import { peekDecisionPrompt } from '@engine/pipeline/prompt-queue';
import { canDeclareDefender } from '@engine/pipeline/legality-checker';
import { dispatchAction } from '@engine/pipeline/action-dispatcher';
import { resolveBoostCards } from '@engine/pipeline/boost-resolution';

const MELTER = '01132';

function createMinion(code: string): CardInstance {
  const card = cardCatalog.getCard(code);
  if (!card) throw new Error(`Card ${code} not found in catalog`);
  return createCardInstance(card);
}

function createAlly(code: string): CardInstance {
  const card = cardCatalog.getCard(code);
  if (!card) throw new Error(`Card ${code} not found in catalog`);
  return createCardInstance(card);
}

describe('Melter (01132)', () => {
  beforeEach(() => {
    // Ensure supplemental rules are loaded
  });

  describe('Constant: Ally defense requirement', () => {
    it('forces player to defend with ready ally when able: hero and undefended are excluded from prompt and illegal', () => {
      const state = newRhinoGame({
        players: [{ hero: '01001a', form: 'hero' }],
      });
      state.phase = GamePhase.PLAYER_PHASE;
      const player = state.players[0];
      const melter = createMinion(MELTER);
      player.engagedMinions.push(melter);

      const ally = createAlly('01011'); // Black Cat
      ally.exhausted = false;
      player.allies.push(ally);

      initiateEnemyAttack(state, { type: 'MINION', card: melter }, player.id);

      const prompt = peekDecisionPrompt(state);
      expect(prompt).toBeDefined();
      expect(prompt?.promptId).toMatch(/^prompt_defend_/);

      // Only ally defense option should be offered
      const optionIds = prompt!.options.map((o) => o.id);
      expect(optionIds).toEqual([`defend_ally_${ally.instanceId}`]);

      // Verify legality checker rejects Hero defense and Undefended
      const heroLegality = canDeclareDefender(
        state,
        player.id,
        { type: 'HERO', playerId: player.id },
        state.activeAttackContext,
      );
      expect(heroLegality.allowed).toBe(false);

      const undefendedLegality = canDeclareDefender(
        state,
        player.id,
        { type: 'UNDEFENDED', playerId: player.id },
        state.activeAttackContext,
      );
      expect(undefendedLegality.allowed).toBe(false);

      const allyLegality = canDeclareDefender(
        state,
        player.id,
        { type: 'ALLY', playerId: player.id, allyInstanceId: ally.instanceId },
        state.activeAttackContext,
      );
      expect(allyLegality.allowed).toBe(true);
    });

    it('allows choosing among multiple ready allies; hero and undefended remain illegal', () => {
      const state = newRhinoGame({
        players: [{ hero: '01001a', form: 'hero' }],
      });
      state.phase = GamePhase.PLAYER_PHASE;
      const player = state.players[0];
      const melter = createMinion(MELTER);
      player.engagedMinions.push(melter);

      const ally1 = createAlly('01011'); // Black Cat
      ally1.exhausted = false;
      const ally2 = createAlly('01020'); // Hellcat
      ally2.exhausted = false;
      player.allies.push(ally1, ally2);

      initiateEnemyAttack(state, { type: 'MINION', card: melter }, player.id);

      const prompt = peekDecisionPrompt(state);
      expect(prompt).toBeDefined();

      const optionIds = prompt!.options.map((o) => o.id);
      expect(optionIds).toEqual([
        `defend_ally_${ally1.instanceId}`,
        `defend_ally_${ally2.instanceId}`,
      ]);
    });

    it('waives requirement when all controlled allies are exhausted (not able)', () => {
      const state = newRhinoGame({
        players: [{ hero: '01001a', form: 'hero' }],
      });
      state.phase = GamePhase.PLAYER_PHASE;
      const player = state.players[0];
      const melter = createMinion(MELTER);
      player.engagedMinions.push(melter);

      const ally = createAlly('01011');
      ally.exhausted = true; // Exhausted ally
      player.allies.push(ally);

      initiateEnemyAttack(state, { type: 'MINION', card: melter }, player.id);

      const prompt = peekDecisionPrompt(state);
      expect(prompt).toBeDefined();

      // Since ally is exhausted, player cannot defend with ally -> hero and undefended are available
      const optionIds = prompt!.options.map((o) => o.id);
      expect(optionIds).toContain('defend_hero');
      expect(optionIds).toContain('undefended');
      expect(optionIds).not.toContain(`defend_ally_${ally.instanceId}`);

      const heroLegality = canDeclareDefender(
        state,
        player.id,
        { type: 'HERO', playerId: player.id },
        state.activeAttackContext,
      );
      expect(heroLegality.allowed).toBe(true);
    });

    it('waives requirement when player controls no allies', () => {
      const state = newRhinoGame({
        players: [{ hero: '01001a', form: 'hero' }],
      });
      state.phase = GamePhase.PLAYER_PHASE;
      const player = state.players[0];
      const melter = createMinion(MELTER);
      player.engagedMinions.push(melter);

      initiateEnemyAttack(state, { type: 'MINION', card: melter }, player.id);

      const prompt = peekDecisionPrompt(state);
      expect(prompt).toBeDefined();

      const optionIds = prompt!.options.map((o) => o.id);
      expect(optionIds).toContain('defend_hero');
      expect(optionIds).toContain('undefended');
    });

    it('prohibits other players from defending when engaged player is able to defend with an ally', () => {
      const state = newRhinoGame({
        players: [
          { hero: '01001a', form: 'hero' },
          { hero: '01010a', form: 'hero' },
        ],
      });
      state.phase = GamePhase.PLAYER_PHASE;
      const p1 = state.players[0];
      const p2 = state.players[1];

      const melter = createMinion(MELTER);
      p1.engagedMinions.push(melter);

      const p1Ally = createAlly('01011');
      p1Ally.exhausted = false;
      p1.allies.push(p1Ally);

      const p2Ally = createAlly('01020');
      p2Ally.exhausted = false;
      p2.allies.push(p2Ally);

      initiateEnemyAttack(state, { type: 'MINION', card: melter }, p1.id);

      const prompt = peekDecisionPrompt(state);
      expect(prompt).toBeDefined();

      // Only p1's ready ally should be offered, NOT p2 hero or p2 ally
      const optionIds = prompt!.options.map((o) => o.id);
      expect(optionIds).toEqual([`defend_ally_${p1Ally.instanceId}`]);

      // Cross-table defense is illegal
      const p2HeroLegality = canDeclareDefender(
        state,
        p2.id,
        { type: 'HERO', playerId: p2.id },
        state.activeAttackContext,
      );
      expect(p2HeroLegality.allowed).toBe(false);

      const p2AllyLegality = canDeclareDefender(
        state,
        p2.id,
        { type: 'ALLY', playerId: p2.id, allyInstanceId: p2Ally.instanceId },
        state.activeAttackContext,
      );
      expect(p2AllyLegality.allowed).toBe(false);
    });

    it('rejects DECLARE_DEFENDER action handler when hero defense is attempted while ready ally exists', () => {
      const state = newRhinoGame({
        players: [{ hero: '01001a', form: 'hero' }],
      });
      state.phase = GamePhase.PLAYER_PHASE;
      const player = state.players[0];
      const melter = createMinion(MELTER);
      player.engagedMinions.push(melter);

      const ally = createAlly('01011');
      ally.exhausted = false;
      player.allies.push(ally);

      initiateEnemyAttack(state, { type: 'MINION', card: melter }, player.id);

      const dispatchResult = dispatchAction(state, {
        type: 'DECLARE_DEFENDER',
        playerId: player.id,
        defenderType: 'HERO',
      });

      expect(dispatchResult.result.success).toBe(false);
      expect(dispatchResult.result.error).toMatch(/ally/i);
    });
  });

  describe('Boost Star: Exhaust each ally you control', () => {
    it('exhausts all allies controlled by defending player during boost resolution', () => {
      const state = newRhinoGame({
        players: [{ hero: '01001a', form: 'hero' }],
      });
      const player = state.players[0];

      const ally1 = createAlly('01011');
      ally1.exhausted = false;
      const ally2 = createAlly('01020');
      ally2.exhausted = false;
      player.allies.push(ally1, ally2);

      const melterCard = createMinion(MELTER);

      const icons = resolveBoostCards(state, {
        queue: [melterCard],
        activatorInstanceId: state.villains[0].instanceId ?? 'villain_1',
        playerId: player.id,
        category: 'combat',
        actor: { name: 'Rhino', type: 'villain' },
      });

      // Melter has 0 boost icons, boost star ability
      expect(icons).toBe(0);
      expect(ally1.exhausted).toBe(true);
      expect(ally2.exhausted).toBe(true);
    });

    it('safely resolves boost star when defending player controls 0 allies', () => {
      const state = newRhinoGame({
        players: [{ hero: '01001a', form: 'hero' }],
      });
      const player = state.players[0];
      const melterCard = createMinion(MELTER);

      const icons = resolveBoostCards(state, {
        queue: [melterCard],
        activatorInstanceId: state.villains[0].instanceId ?? 'villain_1',
        playerId: player.id,
        category: 'combat',
        actor: { name: 'Rhino', type: 'villain' },
      });

      expect(icons).toBe(0);
      expect(player.allies).toHaveLength(0);
    });
  });
});
