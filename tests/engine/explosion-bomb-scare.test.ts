import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard, StatusCard, CardInstance } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { executeEffect } from '@engine/effects';
import { dispatchAction, peekDecisionPrompt } from '@engine/pipeline';
import { step4_revealEncounterCards } from '@engine/index';
import { eliminatePlayer } from '@engine/pipeline/player-elimination';

// Explosion (01111), #296:
// "When Revealed: If Bomb Scare is in play, assign X damage among heroes and allies, where X is the
// amount of threat on Bomb Scare. If Bomb Scare is not in play, this card gains surge."
// The card names no player, so the first player assigns (RR v1.8 First Player).
describe('Explosion (01111): assign X damage among heroes and allies (#296)', () => {
  let state: GameState;

  const makePlayer = (id: string, name: string, hero: string, alterEgo: string) => ({
    id,
    name,
    hero: cardCatalog.getCard(hero) as HeroCard,
    alterEgo: cardCatalog.getCard(alterEgo) as AlterEgoCard,
    deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
  });

  const setup = (playerCount: 1 | 2) => {
    state = setupGame({
      scenarioId: 'rhino',
      players:
        playerCount === 1
          ? [makePlayer('p1', 'Spider-Man', '01001a', '01001b')]
          : [
              makePlayer('p1', 'Spider-Man', '01001a', '01001b'),
              makePlayer('p2', 'Iron Man', '01029a', '01029b'),
            ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
    for (const p of state.players) {
      p.currentForm = 'hero';
      p.activeFormCard = p.hero;
    }
    state.firstPlayerIndex = 0;
  };

  const bombScare = (threat: number) => {
    state.sideSchemes = [
      { instanceId: 'bomb-scare-inst', card: cardCatalog.getCard('01109') as any, threat },
    ];
  };

  const ally = (code: string, playerIndex: number): CardInstance => {
    const inst = createCardInstance(cardCatalog.getCard(code)!);
    inst.statusCards = [];
    state.players[playerIndex].allies.push(inst);
    return inst;
  };

  /** Explosion is dealt to the given player and revealed through the real encounter step. */
  const reveal = (playerIndex: number) => {
    state.players[playerIndex].dealtEncounterCards.push(
      createCardInstance(cardCatalog.getCard('01111')!),
    );
    state = step4_revealEncounterCards(state);
  };

  const resolve = (assignments: Record<string, number>, playerId = 'p1') =>
    dispatchAction(state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId,
      selectedOptionId: 'confirm_distribution',
      assignments,
    });

  describe('two heroes and one ally', () => {
    let blackCat: CardInstance;

    beforeEach(() => {
      setup(2);
      bombScare(3);
      blackCat = ally('01011', 1); // Black Cat, 2 HP
    });

    it('queues the assignment for the first player when the second player reveals it', () => {
      reveal(1);
      const prompt = peekDecisionPrompt(state);
      expect(prompt?.kind).toBe('DISTRIBUTE_POINTS');
      expect(prompt?.playerId).toBe('p1');
      expect(prompt?.distributionConfig?.effectiveBudget).toBe(3);
      expect(prompt?.distributionConfig?.exactMatchRequired).toBe(true);
      expect(prompt?.distributionConfig?.allocationDomain).toBe('DAMAGE');
      const ids = prompt!
        .distributionConfig!.targets.filter((t) => t.isEligible)
        .map((t) => t.instanceId);
      expect(ids.sort()).toEqual(['p1', 'p2', blackCat.instanceId].sort());
    });

    it('a 1/1/1 assignment damages both heroes and the ally', () => {
      const p1Hp = state.players[0].health;
      const p2Hp = state.players[1].health;
      reveal(1);

      const res = resolve({ p1: 1, p2: 1, [blackCat.instanceId]: 1 });

      expect(res.result.success).toBe(true);
      expect(peekDecisionPrompt(res.state)).toBeUndefined();
      expect(res.state.players[0].health).toBe(p1Hp - 1);
      expect(res.state.players[1].health).toBe(p2Hp - 1);
      expect(res.state.players[1].allies[0].tokens?.damage).toBe(1);
    });

    it('2 damage on the 2-HP ally defeats it: discard and CHARACTER_DEFEATED response', () => {
      state.players[1].activeFormCard!.enrichment = {
        abilities: [
          {
            id: 'p2_character_defeat_listener',
            timing: 'FORCED_RESPONSE',
            trigger: 'CHARACTER_DEFEATED',
            steps: [{ effect: 'ADD_COUNTERS', effectParams: { target: 'IDENTITY', amount: 1 } }],
          },
        ],
      } as any;
      reveal(1);

      const res = resolve({ p1: 1, [blackCat.instanceId]: 2 });

      expect(res.result.success).toBe(true);
      expect(res.state.players[1].allies.map((a) => a.instanceId)).not.toContain(
        blackCat.instanceId,
      );
      expect(res.state.players[1].discard.map((c) => c.instanceId)).toContain(blackCat.instanceId);
      expect(res.state.players[1].counters?.all_purpose).toBe(1);
    });

    it('3 damage on the 2-HP ally is rejected (a character takes at most its remaining HP)', () => {
      reveal(1);

      const res = resolve({ [blackCat.instanceId]: 3 });

      expect(res.result.success).toBe(false);
      expect(peekDecisionPrompt(res.state)).toBeDefined();
      expect(res.state.players[1].allies.map((a) => a.instanceId)).toContain(blackCat.instanceId);
    });

    it.each([
      ['a total of 2', { p1: 1, p2: 1 }],
      ['a total of 4', { p1: 2, p2: 2 }],
      ['an unknown target id', { p1: 2, 'not-a-character': 1 }],
    ])('%s is rejected and the prompt stays', (_label, assignments) => {
      const p1Hp = state.players[0].health;
      reveal(1);

      const res = resolve(assignments as Record<string, number>);

      expect(res.result.success).toBe(false);
      expect(peekDecisionPrompt(res.state)).toBeDefined();
      expect(res.state.players[0].health).toBe(p1Hp);
    });

    it('Tough on an ally absorbs the assigned damage like an attack', () => {
      blackCat.statusCards = [StatusCard.TOUGH];
      reveal(1);

      const res = resolve({ p1: 1, p2: 1, [blackCat.instanceId]: 1 });

      const after = res.state.players[1].allies[0];
      expect(after.statusCards).not.toContain(StatusCard.TOUGH);
      expect(after.tokens?.damage ?? 0).toBe(0);
    });

    it('an alter-ego player is not a target and cannot be assigned damage', () => {
      state.players[1].currentForm = 'alter_ego';
      state.players[1].activeFormCard = state.players[1].alterEgo;
      reveal(1);

      const targets = peekDecisionPrompt(state)!.distributionConfig!.targets;
      expect(targets.find((t) => t.instanceId === 'p2')?.isEligible).toBe(false);

      const res = resolve({ p1: 2, p2: 1 });
      expect(res.result.success).toBe(false);
      expect(peekDecisionPrompt(res.state)).toBeDefined();
    });

    it('an eliminated player is not offered as a target', () => {
      eliminatePlayer(state, 'p2');
      ally('01011', 0);
      reveal(0);

      const ids = peekDecisionPrompt(state)!.distributionConfig!.targets.map((t) => t.instanceId);
      expect(ids).not.toContain('p2');
      expect(ids).toContain('p1');
    });
  });

  it('solo, hero only: no prompt, the hero takes X', () => {
    setup(1);
    bombScare(3);
    const hp = state.players[0].health;

    reveal(0);

    expect(peekDecisionPrompt(state)).toBeUndefined();
    expect(state.players[0].health).toBe(hp - 3);
  });

  it('Bomb Scare not in play: surge, no prompt, no damage', () => {
    setup(1);
    state.sideSchemes = [];
    const explosion = cardCatalog.getCard('01111')!;
    const hp = state.players[0].health;
    const dealt = state.players[0].dealtEncounterCards.length;

    const result = executeEffect(state, explosion.enrichment!.abilities![0], {
      playerId: 'p1',
      sourceCardInstance: createCardInstance(explosion),
    });

    expect(result.success).toBe(true);
    expect(peekDecisionPrompt(result.state)).toBeUndefined();
    expect(state.players[0].health).toBe(hp);
    expect(state.players[0].dealtEncounterCards.length).toBe(dealt + 1);
  });

  describe('data', () => {
    it('step 1 is a DISTRIBUTE_AMOUNT of damage with no capRule', () => {
      const step = cardCatalog.getCard('01111')!.enrichment!.abilities![0].steps[0];
      expect(step.effect).toBe('DISTRIBUTE_AMOUNT');
      expect(step.effectParams).toMatchObject({
        allocationDomain: 'DAMAGE',
        targetScope: 'ALL_HEROES_AND_ALLIES',
      });
      expect(step.effectParams).not.toHaveProperty('capRule');
    });
  });
});
