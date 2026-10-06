import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '@data/importer/card-loader';
import {
  GameState,
  GamePhase,
  HeroCard,
  AlterEgoCard,
  setupGame,
  resetInstanceCounter,
  createCardInstance,
  dispatchAction,
  peekDecisionPrompt,
} from '@engine/index';
import { executeEffect } from '@engine/effects';
import { getEffectiveAllyStats, getEffectiveHeroStats } from '@engine/pipeline/stat-calculator';

const LEAD_FROM_THE_FRONT = '01070';
const VISION = '01068'; // ally, 2 ATK / 1 THW

describe('Lead from the Front (01070) asks which player (#251)', () => {
  let state: GameState;

  const step = () => cardCatalog.getCard(LEAD_FROM_THE_FRONT)!.enrichment!.abilities![0].steps[0];

  const build = (playerCount: 1 | 2) => {
    resetInstanceCounter();
    const players = [
      {
        id: 'p1',
        name: 'Spider-Man',
        hero: cardCatalog.getCard('01001a') as HeroCard,
        alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
        deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
      },
      {
        id: 'p2',
        name: 'Iron Man',
        hero: cardCatalog.getCard('01029a') as HeroCard,
        alterEgo: cardCatalog.getCard('01029b') as AlterEgoCard,
        deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
      },
    ].slice(0, playerCount);
    state = setupGame({
      scenarioId: 'rhino',
      players,
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
    state.phase = GamePhase.PLAYER_PHASE;
    for (const p of state.players) {
      p.currentForm = 'hero';
      p.activeFormCard = p.hero;
      p.allies.push(createCardInstance(cardCatalog.getCard(VISION)!));
    }
  };

  const cast = () => {
    const res = executeEffect(state, step(), { playerId: 'p1' });
    state = res.state;
    return res;
  };
  const heroAtk = (i: number) => getEffectiveHeroStats(state, state.players[i]).attack;
  const heroThw = (i: number) => getEffectiveHeroStats(state, state.players[i]).thwart;
  const allyAtk = (i: number) => getEffectiveAllyStats(state, state.players[i].allies[0]).attack;
  const choose = (playerId: string) => {
    const prompt = peekDecisionPrompt(state)!;
    const option = prompt.options.find((o) => o.params?.targetPlayerId === playerId)!;
    const res = dispatchAction(state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: option.id,
    });
    state = res.state;
  };

  describe('two players', () => {
    beforeEach(() => build(2));

    it('prompts for a player and buffs nothing before the choice', () => {
      const baseAtk = heroAtk(0);
      cast();
      const prompt = peekDecisionPrompt(state);
      expect(prompt?.title).toBe('Choose a Player');
      expect(prompt!.options).toHaveLength(2);
      expect(heroAtk(0)).toBe(baseAtk);
    });

    it('buffs the characters the other player controls, not the caster', () => {
      const base = { atk0: heroAtk(0), atk1: heroAtk(1), thw1: heroThw(1), ally0: allyAtk(0) };
      const ally1 = allyAtk(1);
      cast();
      choose('p2');
      expect(peekDecisionPrompt(state)).toBeUndefined();
      expect(heroAtk(1)).toBe(base.atk1 + 1);
      expect(heroThw(1)).toBe(base.thw1 + 1);
      expect(allyAtk(1)).toBe(ally1 + 1);
      expect(heroAtk(0)).toBe(base.atk0);
      expect(allyAtk(0)).toBe(base.ally0);
    });

    it('lets the caster choose themselves', () => {
      const base = { atk0: heroAtk(0), atk1: heroAtk(1), ally0: allyAtk(0) };
      cast();
      choose('p1');
      expect(heroAtk(0)).toBe(base.atk0 + 1);
      expect(allyAtk(0)).toBe(base.ally0 + 1);
      expect(heroAtk(1)).toBe(base.atk1);
    });
  });

  describe('solo', () => {
    beforeEach(() => build(1));

    it('does not prompt and buffs the caster and allies', () => {
      const base = { atk: heroAtk(0), thw: heroThw(0), ally: allyAtk(0) };
      cast();
      expect(peekDecisionPrompt(state)).toBeUndefined();
      expect(heroAtk(0)).toBe(base.atk + 1);
      expect(heroThw(0)).toBe(base.thw + 1);
      expect(allyAtk(0)).toBe(base.ally + 1);
    });
  });

  it('declares the chosen player and the controlled characters', () => {
    const params = step().effectParams as Record<string, unknown>;
    expect(params.target).toBe('ALL_CONTROLLED_CHARACTERS');
    expect(params.targetPlayer).toBe('CHOSEN_PLAYER');
  });
});
