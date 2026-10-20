import { describe, it, expect, beforeEach, vi } from 'vitest';
import { overrideCard } from '../support/card-overrides';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard, StatusCard } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import {
  initiateEnemyAttack,
  resolveDefenderDeclaration,
  executeEnemyAttackSynchronously,
} from '@engine/pipeline';

const dispatched = vi.hoisted(
  () => [] as Array<{ trigger: string; context: Record<string, unknown> }>,
);

vi.mock('../../src/engine/triggers/trigger-dispatcher', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../src/engine/triggers/trigger-dispatcher')>();
  return {
    ...actual,
    dispatchTrigger: ((state: any, trigger: any, context: any) => {
      dispatched.push({ trigger, context: { ...context } });
      return actual.dispatchTrigger(state, trigger, context);
    }) as typeof actual.dispatchTrigger,
  };
});

function buildTestGame(options?: {
  playerCount?: number;
  heroCodes?: Array<[string, string]>;
  difficulty?: 'STANDARD' | 'EXPERT';
}): GameState {
  const heroes = options?.heroCodes || [['01040a', '01040b']];
  const count = options?.playerCount || heroes.length;
  const state = setupGame({
    scenarioId: 'rhino',
    difficulty: options?.difficulty || 'STANDARD',
    players: heroes.slice(0, count).map(([hCode, aeCode], idx) => {
      const hero = cardCatalog.getCard(hCode) as HeroCard;
      const alterEgo = cardCatalog.getCard(aeCode) as AlterEgoCard;
      return {
        id: `p${idx + 1}`,
        name: hero.name,
        hero,
        alterEgo,
        deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
      };
    }),
    encounterCards: cardCatalog.getCardsBySet('rhino'),
    skipMulligan: true,
  });

  for (let i = 0; i < state.players.length; i++) {
    state.players[i].currentForm = 'hero';
    state.players[i].activeFormCard = state.players[i].hero;
    state.players[i].exhausted = false;
    state.players[i].hand = [];
  }
  state.encounterDeck = [];
  state.log = [];
  return state;
}

function mockZeroBoostDeck(state: GameState): void {
  state.encounterDeck = [
    createCardInstance({
      code: 'mock_boost',
      name: 'Mock Boost',
      type: 'treachery',
      boost: 0,
    } as any),
  ];
}

describe('Issue #306: Retaliate damage routes through damage pipeline', () => {
  beforeEach(() => {
    dispatched.length = 0;
  });

  describe('A. Villain Defeat & Stage Progression (Core Acceptance)', () => {
    it('1. Hero Retaliate defeats Villain Stage I', () => {
      const state = buildTestGame({ heroCodes: [['01040a', '01040b']] });
      state.villain.health = 1;
      mockZeroBoostDeck(state);

      executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'HERO_IF_READY');

      expect(state.villain.card.code).toBe('01095');
      expect(state.villain.health).toBe(15);
    });

    it('2. Hero Retaliate defeats final Villain stage (victory)', () => {
      const state = buildTestGame({ heroCodes: [['01040a', '01040b']] });
      const rhino2Card = cardCatalog.getCard('01095')!;
      state.villain.card = rhino2Card as any;
      state.villain.health = 1;
      state.villain.maxHealth = 15;
      if (state.villains && state.villains[0]) {
        state.villains[0].card = rhino2Card as any;
        state.villains[0].health = 1;
        state.villains[0].maxHealth = 15;
      }
      mockZeroBoostDeck(state);

      executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'HERO_IF_READY');

      expect(state.winner).toBe('HEROES');
    });

    it('3. Ally Retaliate defeats Villain', () => {
      const state = buildTestGame({ heroCodes: [['01001a', '01001b']] });
      state.villain.health = 1;
      const allyCard = cardCatalog.getCard('01058')!;
      const ally = createCardInstance(allyCard);
      ally.card = { ...ally.card, health: 5 } as typeof ally.card;
      ally.card = {
        ...ally.card,
        enrichment: {
          ...ally.card.enrichment,
          abilities: [
            {
              id: 'ally_retaliate',
              timing: 'CONSTANT',
              steps: [
                { effect: 'GRANT_KEYWORD', effectParams: { keyword: 'Retaliate', amount: 1 } },
              ],
            },
          ],
        },
      } as typeof ally.card;
      state.players[0].allies.push(ally);
      mockZeroBoostDeck(state);

      initiateEnemyAttack(state, { type: 'VILLAIN' }, 'p1');
      const ctx = state.activeAttackContext!;
      resolveDefenderDeclaration(
        state,
        { type: 'ALLY', playerId: 'p1', allyInstanceId: ally.instanceId },
        ctx,
      );

      expect(state.villain.card.code).toBe('01095');
      expect(state.villain.health).toBe(15);
    });
  });

  describe('B. Minion Defeat', () => {
    it('4. Hero Retaliate defeats Minion', () => {
      const state = buildTestGame({ heroCodes: [['01040a', '01040b']] });
      const minionCard = cardCatalog.getCard('01168')!;
      const minion = createCardInstance(minionCard);
      minion.tokens = { damage: 1 };
      state.players[0].engagedMinions.push(minion);

      executeEnemyAttackSynchronously(
        state,
        { type: 'MINION', card: minion },
        'p1',
        'HERO_IF_READY',
      );

      expect(state.players[0].engagedMinions.some((m) => m.instanceId === minion.instanceId)).toBe(
        false,
      );
      expect(state.encounterDiscard.some((c) => c.instanceId === minion.instanceId)).toBe(true);

      const defeatEvent = dispatched.find(
        (d) => d.trigger === 'DEFEATED' && d.context?.targetType === 'MINION',
      );
      expect(defeatEvent).toBeDefined();
      expect((defeatEvent?.context?.defeatSource as any)?.byAttack).toBe(false);
    });

    it('5. Ally Retaliate defeats Minion', () => {
      const state = buildTestGame({ heroCodes: [['01001a', '01001b']] });
      const allyCard = cardCatalog.getCard('01058')!;
      const ally = createCardInstance(allyCard);
      ally.card = { ...ally.card, health: 5 } as typeof ally.card;
      ally.card = {
        ...ally.card,
        enrichment: {
          ...ally.card.enrichment,
          abilities: [
            {
              id: 'ally_retaliate',
              timing: 'CONSTANT',
              steps: [
                { effect: 'GRANT_KEYWORD', effectParams: { keyword: 'Retaliate', amount: 1 } },
              ],
            },
          ],
        },
      } as typeof ally.card;
      state.players[0].allies.push(ally);

      const minionCard = cardCatalog.getCard('01168')!;
      const minion = createCardInstance(minionCard);
      minion.tokens = { damage: 1 };
      state.players[0].engagedMinions.push(minion);

      initiateEnemyAttack(state, { type: 'MINION', card: minion }, 'p1');
      const ctx = state.activeAttackContext!;
      resolveDefenderDeclaration(
        state,
        { type: 'ALLY', playerId: 'p1', allyInstanceId: ally.instanceId },
        ctx,
      );

      expect(state.players[0].engagedMinions.some((m) => m.instanceId === minion.instanceId)).toBe(
        false,
      );
      expect(state.encounterDiscard.some((c) => c.instanceId === minion.instanceId)).toBe(true);
    });

    it('6. Defeated minion does not trigger post-attack abilities', () => {
      const state = buildTestGame({ heroCodes: [['01040a', '01040b']] });
      const minionCard = cardCatalog.getCard('01168')!;
      const minion = createCardInstance(minionCard);
      minion.tokens = { damage: 1 };
      minion.card = {
        ...minion.card,
        enrichment: {
          ...minion.card.enrichment,
          abilities: [
            {
              id: 'post_attack_threat',
              timing: 'FORCED_RESPONSE',
              trigger: 'MINION_ATTACKED',
              steps: [
                {
                  effect: 'ADD_THREAT',
                  effectParams: { amount: 3 },
                },
              ],
            },
          ],
        },
      } as typeof minion.card;
      state.players[0].engagedMinions.push(minion);
      const initialThreat = state.mainScheme.threat;

      executeEnemyAttackSynchronously(
        state,
        { type: 'MINION', card: minion },
        'p1',
        'HERO_IF_READY',
      );

      expect(state.mainScheme.threat).toBe(initialThreat);
    });
  });

  describe('C. Undefended Attacks (Option A)', () => {
    it('7. Hero Retaliate on surviving undefended attack', () => {
      const state = buildTestGame({ heroCodes: [['01040a', '01040b']] });
      const initialVillainHp = state.villain.health;
      const initialHeroHp = state.players[0].health;
      mockZeroBoostDeck(state);

      executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'TAKE_UNDEFENDED');

      expect(state.players[0].health).toBe(initialHeroHp - 2);
      expect(state.villain.health).toBe(initialVillainHp - 1);
    });

    it('8. Defeated hero does NOT retaliate on undefended attack', () => {
      const state = buildTestGame({ heroCodes: [['01040a', '01040b']] });
      state.players[0].health = 1;
      const initialVillainHp = state.villain.health;
      mockZeroBoostDeck(state);

      executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'TAKE_UNDEFENDED');

      expect(state.eliminatedPlayers?.[0]?.health).toBe(0);
      expect(state.villain.health).toBe(initialVillainHp);
    });
  });

  describe('D. Overkill Interactions', () => {
    it('9. Overkill damage to hero does NOT trigger hero Retaliate', () => {
      const state = buildTestGame({ heroCodes: [['01040a', '01040b']] });
      const initialVillainHp = state.villain.health;
      const initialHeroHp = state.players[0].health;

      const allyCard = cardCatalog.getCard('01002')!;
      const ally = createCardInstance(allyCard);
      ally.card = { ...ally.card, health: 2 } as typeof ally.card;
      state.players[0].allies.push(ally);

      overrideCard(state, state.villain.card, { attack: 4 });
      overrideCard(state, state.villain.card, { keywords: ['Overkill'] });
      mockZeroBoostDeck(state);

      initiateEnemyAttack(state, { type: 'VILLAIN' }, 'p1');
      const ctx = state.activeAttackContext!;
      ctx.hasOverkill = true;
      resolveDefenderDeclaration(
        state,
        { type: 'ALLY', playerId: 'p1', allyInstanceId: ally.instanceId },
        ctx,
      );

      expect(state.players[0].allies.find((a) => a.instanceId === ally.instanceId)).toBeUndefined();
      expect(state.players[0].health).toBe(initialHeroHp - 2);
      expect(state.villain.health).toBe(initialVillainHp);
    });
  });

  describe('E. Cross-Table Defense', () => {
    it('10. Player 2 Hero defends for Black Panther', () => {
      const state = buildTestGame({
        playerCount: 2,
        heroCodes: [
          ['01040a', '01040b'],
          ['01001a', '01001b'],
        ],
      });
      const initialVillainHp = state.villain.health;
      mockZeroBoostDeck(state);

      initiateEnemyAttack(state, { type: 'VILLAIN' }, 'p1');
      const ctx = state.activeAttackContext!;
      resolveDefenderDeclaration(state, { type: 'HERO', playerId: 'p2' }, ctx);

      expect(state.players[1].exhausted).toBe(true);
      expect(state.players[0].health).toBe(11);
      expect(state.villain.health).toBe(initialVillainHp);
    });

    it('11. Player 2 Hero with Retaliate defends for Black Panther', () => {
      const state = buildTestGame({
        playerCount: 2,
        heroCodes: [
          ['01040a', '01040b'],
          ['01001a', '01001b'],
        ],
      });
      state.players[1].tableau.push({
        instanceId: 'p2_retaliate_upg',
        card: {
          code: 'mock_upg',
          name: 'Spiky Suit',
          type: 'upgrade',
          enrichment: {
            abilities: [
              {
                id: 'spiky_retaliate',
                timing: 'CONSTANT',
                steps: [
                  { effect: 'GRANT_KEYWORD', effectParams: { keyword: 'Retaliate', amount: 1 } },
                ],
              },
            ],
          },
        } as any,
      });
      const initialVillainHp = state.villain.health;
      mockZeroBoostDeck(state);

      initiateEnemyAttack(state, { type: 'VILLAIN' }, 'p1');
      const ctx = state.activeAttackContext!;
      resolveDefenderDeclaration(state, { type: 'HERO', playerId: 'p2' }, ctx);

      expect(state.villain.health).toBe(initialVillainHp - 1);
    });

    it('12. Player 2 Ally defends for Black Panther', () => {
      const state = buildTestGame({
        playerCount: 2,
        heroCodes: [
          ['01040a', '01040b'],
          ['01001a', '01001b'],
        ],
      });
      const ally = createCardInstance(cardCatalog.getCard('01002')!);
      ally.card = { ...ally.card, health: 5 } as typeof ally.card;
      state.players[1].allies.push(ally);
      const initialVillainHp = state.villain.health;
      mockZeroBoostDeck(state);

      initiateEnemyAttack(state, { type: 'VILLAIN' }, 'p1');
      const ctx = state.activeAttackContext!;
      resolveDefenderDeclaration(
        state,
        { type: 'ALLY', playerId: 'p2', allyInstanceId: ally.instanceId },
        ctx,
      );

      expect(state.villain.health).toBe(initialVillainHp);
    });

    it('13. Black Panther defends for Player 2 (Hero)', () => {
      const state = buildTestGame({
        playerCount: 2,
        heroCodes: [
          ['01040a', '01040b'],
          ['01001a', '01001b'],
        ],
      });
      const initialVillainHp = state.villain.health;
      mockZeroBoostDeck(state);

      initiateEnemyAttack(state, { type: 'VILLAIN' }, 'p2');
      const ctx = state.activeAttackContext!;
      resolveDefenderDeclaration(state, { type: 'HERO', playerId: 'p1' }, ctx);

      expect(state.players[0].exhausted).toBe(true);
      expect(state.villain.health).toBe(initialVillainHp - 1);
    });

    it('14. Black Panther defends for Player 2 and defeats Villain Stage I', () => {
      const state = buildTestGame({
        playerCount: 2,
        heroCodes: [
          ['01040a', '01040b'],
          ['01001a', '01001b'],
        ],
      });
      state.villain.health = 1;
      mockZeroBoostDeck(state);

      initiateEnemyAttack(state, { type: 'VILLAIN' }, 'p2');
      const ctx = state.activeAttackContext!;
      resolveDefenderDeclaration(state, { type: 'HERO', playerId: 'p1' }, ctx);

      expect(state.villain.card.code).toBe('01095');
    });

    it("15. Black Panther's Ally defends for Player 2", () => {
      const state = buildTestGame({
        playerCount: 2,
        heroCodes: [
          ['01040a', '01040b'],
          ['01001a', '01001b'],
        ],
      });
      const ally = createCardInstance(cardCatalog.getCard('01002')!);
      ally.card = { ...ally.card, health: 5 } as typeof ally.card;
      state.players[0].allies.push(ally);
      const initialVillainHp = state.villain.health;
      mockZeroBoostDeck(state);

      initiateEnemyAttack(state, { type: 'VILLAIN' }, 'p2');
      const ctx = state.activeAttackContext!;
      resolveDefenderDeclaration(
        state,
        { type: 'ALLY', playerId: 'p1', allyInstanceId: ally.instanceId },
        ctx,
      );

      expect(state.villain.health).toBe(initialVillainHp);
    });
  });

  describe('F. Damage Mitigation on Enemy Attacker', () => {
    it('16. Retaliate against Tough enemy', () => {
      const state = buildTestGame({ heroCodes: [['01040a', '01040b']] });
      state.villain.statusCards = [StatusCard.TOUGH];
      const initialVillainHp = state.villain.health;
      mockZeroBoostDeck(state);

      executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'HERO_IF_READY');

      expect(state.villain.statusCards).not.toContain(StatusCard.TOUGH);
      expect(state.villain.health).toBe(initialVillainHp);
    });

    it('17. Retaliate against damage shield', () => {
      const state = buildTestGame({ heroCodes: [['01040a', '01040b']] });
      const suit = createCardInstance(cardCatalog.getCard('01098')!);
      state.villain.attachments = [suit];
      const initialVillainHp = state.villain.health;
      mockZeroBoostDeck(state);

      executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'HERO_IF_READY');

      expect(state.villain.health).toBe(initialVillainHp);
      expect(suit.tokens?.damage).toBe(1);
    });

    it('18. Retaliate against damage immunity', () => {
      const state = buildTestGame({ heroCodes: [['01040a', '01040b']] });
      overrideCard(state, state.villain.card, {
        enrichment: {
          ...state.villain.card.enrichment,
          abilities: [
            {
              id: 'invulnerable',
              timing: 'CONSTANT',
              steps: [{ effect: 'CANNOT_TAKE_DAMAGE' }],
            },
          ],
        },
      });
      const initialVillainHp = state.villain.health;
      mockZeroBoostDeck(state);

      executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'HERO_IF_READY');

      expect(state.villain.health).toBe(initialVillainHp);
      const immuneLog = state.log.find((l) => l.key === 'damage.prevented.immune');
      expect(immuneLog).toBeDefined();
      expect(immuneLog?.onomatopoeia).toBe('IMMUNE!');
    });
  });

  describe('G. Combat Log Formatting', () => {
    it('19. Specific Combat Log entry for hero Retaliate', () => {
      const state = buildTestGame({ heroCodes: [['01040a', '01040b']] });
      mockZeroBoostDeck(state);

      executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'HERO_IF_READY');

      const retaliateLog = state.log.find((l) => l.key === 'RETALIATE_DAMAGE');
      expect(retaliateLog).toBeDefined();
      expect(retaliateLog?.text).toBe('Black Panther retaliated for 1 damage.');
      expect(retaliateLog?.onomatopoeia).toBe('RETALIATE!');
      expect(retaliateLog?.actor).toEqual({ name: 'Black Panther', type: 'hero' });
      expect(retaliateLog?.params).toEqual({
        actor: 'Black Panther',
        who: 'Black Panther',
        amount: 1,
        damage: 1,
        target: 'Rhino',
      });
    });

    it('20. Specific Combat Log entry for ally Retaliate', () => {
      const state = buildTestGame({ heroCodes: [['01001a', '01001b']] });
      const allyCard = cardCatalog.getCard('01058')!;
      const ally = createCardInstance(allyCard);
      ally.card = { ...ally.card, health: 5 } as typeof ally.card;
      ally.card = {
        ...ally.card,
        enrichment: {
          ...ally.card.enrichment,
          abilities: [
            {
              id: 'ally_retaliate',
              timing: 'CONSTANT',
              steps: [
                { effect: 'GRANT_KEYWORD', effectParams: { keyword: 'Retaliate', amount: 1 } },
              ],
            },
          ],
        },
      } as typeof ally.card;
      state.players[0].allies.push(ally);
      mockZeroBoostDeck(state);

      initiateEnemyAttack(state, { type: 'VILLAIN' }, 'p1');
      const ctx = state.activeAttackContext!;
      resolveDefenderDeclaration(
        state,
        { type: 'ALLY', playerId: 'p1', allyInstanceId: ally.instanceId },
        ctx,
      );

      const retaliateLog = state.log.find(
        (l) => l.key === 'RETALIATE_DAMAGE' && l.actor?.type === 'ally',
      );
      expect(retaliateLog).toBeDefined();
      expect(retaliateLog?.text).toBe('Daredevil retaliated for 1 damage.');
      expect(retaliateLog?.actor).toEqual({ name: 'Daredevil', type: 'ally' });
      expect(retaliateLog?.params).toEqual({
        actor: 'Daredevil',
        who: 'Daredevil',
        amount: 1,
        damage: 1,
        target: 'Rhino',
      });
    });
  });
});
