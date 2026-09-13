import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard, MinionCard, Keyword } from '@engine/models';
import { parseKeywordItem } from '@engine/models/keyword';
import { hasKeyword, getKeywordValue } from '@engine/models/keyword-helpers';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { executeEnemyAttackSynchronously } from '@engine/pipeline';
import { dispatchAction } from '@engine/pipeline/action-dispatcher';
import { getEffectiveRetaliate, hasEntityKeyword } from '@engine/pipeline/stat-calculator';

describe('Feature: Parameterized Keyword Stacking & Retaliate Value Accumulation (RR v1.8, ADR-0054)', () => {
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

  describe('1. Normalization & Structured Keyword Parsing (parseKeywordItem)', () => {
    it('correctly parses structured keyword objects', () => {
      expect(parseKeywordItem({ keyword: 'Retaliate', amount: 2 })).toEqual({
        name: 'Retaliate',
        amount: 2,
      });
      expect(parseKeywordItem({ keyword: Keyword.RETALIATE, amount: 1 })).toEqual({
        name: 'Retaliate',
        amount: 1,
      });
    });

    it('defaults amount to 1 when omitted in structured object or bare string', () => {
      expect(parseKeywordItem({ keyword: 'Retaliate' })).toEqual({
        name: 'Retaliate',
        amount: 1,
      });
      expect(parseKeywordItem('Retaliate')).toEqual({
        name: 'Retaliate',
        amount: 1,
      });
      expect(parseKeywordItem(Keyword.RETALIATE)).toEqual({
        name: 'Retaliate',
        amount: 1,
      });
    });

    it('correctly normalizes legacy string tokens with numbers', () => {
      expect(parseKeywordItem('Retaliate 1')).toEqual({
        name: 'Retaliate',
        amount: 1,
      });
      expect(parseKeywordItem('Retaliate 3')).toEqual({
        name: 'Retaliate',
        amount: 3,
      });
      expect(parseKeywordItem('Incite 2')).toEqual({
        name: 'Incite',
        amount: 2,
      });
    });

    it('returns null for falsy or empty inputs', () => {
      expect(parseKeywordItem(null)).toBeNull();
      expect(parseKeywordItem(undefined)).toBeNull();
      expect(parseKeywordItem('')).toBeNull();
    });
  });

  describe('2. Single Card Keyword Helpers (hasKeyword & getKeywordValue)', () => {
    it('detects and evaluates structured keywords on card instances', () => {
      const mockCard: any = {
        code: 'mock_1',
        name: 'Mock Armor',
        keywords: [{ keyword: 'Retaliate', amount: 2 }],
      };

      expect(hasKeyword(mockCard, 'Retaliate')).toBe(true);
      expect(hasKeyword(mockCard, Keyword.RETALIATE)).toBe(true);
      expect(getKeywordValue(mockCard, 'Retaliate')).toBe(2);
    });

    it('accumulates multiple instances on the same card per RR v1.8 p. 24', () => {
      const mockCardWithMultiple: any = {
        code: 'mock_stacked',
        name: 'Super Armor',
        keywords: ['Retaliate 1', { keyword: 'Retaliate', amount: 2 }],
      };

      expect(getKeywordValue(mockCardWithMultiple, 'Retaliate')).toBe(3);
    });

    it('evaluates constant GRANT_KEYWORD abilities on the card itself', () => {
      const mockCardWithAbility: any = {
        code: 'mock_ability',
        name: 'Shield',
        keywords: [],
        enrichment: {
          abilities: [
            {
              id: 'shield_retaliate',
              timing: 'CONSTANT',
              steps: [
                {
                  effect: 'GRANT_KEYWORD',
                  params: {
                    keyword: 'Retaliate',
                    amount: 1,
                  },
                },
              ],
            },
          ],
        },
      };

      expect(hasKeyword(mockCardWithAbility, 'Retaliate')).toBe(true);
      expect(getKeywordValue(mockCardWithAbility, 'Retaliate')).toBe(1);
    });
  });

  describe('3. Dynamic Stacking across Entity, Upgrades & Attachments (getEffectiveRetaliate)', () => {
    it('aggregates Hero base Retaliate and Tableau upgrade Retaliate (1 + 1 = 2)', () => {
      // Spider-Man has no base Retaliate
      expect(getEffectiveRetaliate(state.players[0])).toBe(0);

      // Give base Retaliate 1 to Hero
      (state.players[0].hero as any).keywords = [{ keyword: 'Retaliate', amount: 1 }];
      expect(getEffectiveRetaliate(state.players[0])).toBe(1);
      expect(hasEntityKeyword(state.players[0], 'Retaliate')).toBe(true);

      // Add upgrade in tableau with structured Retaliate 1
      const mockUpgrade: any = {
        instanceId: 'upgrade_retaliate_1',
        card: {
          code: 'up_01',
          name: 'Electrostatic Armor',
          enrichment: {
            abilities: [
              {
                id: 'armor_retaliate',
                timing: 'CONSTANT',
                steps: [
                  {
                    effect: 'GRANT_KEYWORD',
                    params: {
                      keyword: 'Retaliate',
                      amount: 1,
                    },
                  },
                ],
              },
            ],
          },
        },
      };
      state.players[0].tableau.push(mockUpgrade);

      // Total stacked Retaliate should now be 2
      expect(getEffectiveRetaliate(state.players[0])).toBe(2);
    });

    it('aggregates Villain attachments granting Retaliate', () => {
      expect(getEffectiveRetaliate(state.villain)).toBe(0);

      const mockConcussionBlasters: any = {
        instanceId: 'att_blasters',
        card: {
          code: '01153',
          name: 'Concussion Blasters',
          enrichment: {
            abilities: [
              {
                id: 'blasters_retaliate',
                timing: 'CONSTANT',
                steps: [
                  {
                    effect: 'GRANT_KEYWORD',
                    params: {
                      keyword: 'Retaliate',
                      amount: 1,
                    },
                  },
                ],
              },
            ],
          },
        },
      };
      state.villain.attachments.push(mockConcussionBlasters);

      expect(getEffectiveRetaliate(state.villain)).toBe(1);
      expect(hasEntityKeyword(state.villain, 'Retaliate')).toBe(true);
    });

    it('correctly calculates Retaliate on Black Panther (01040a) from catalog', () => {
      const bpCard = cardCatalog.getCard('01040a') as HeroCard;
      expect(bpCard).toBeDefined();

      const bpPlayer = {
        ...state.players[0],
        hero: bpCard,
        activeFormCard: bpCard,
        tableau: [],
      };

      expect(getEffectiveRetaliate(bpPlayer)).toBe(1);
      expect(hasEntityKeyword(bpPlayer, 'Retaliate')).toBe(true);
    });

    it('correctly calculates Retaliate on Whiplash (01172) from catalog', () => {
      const whiplashCard = cardCatalog.getCard('01172') as MinionCard;
      expect(whiplashCard).toBeDefined();
      const whiplashInstance = createCardInstance(whiplashCard);

      expect(getEffectiveRetaliate(whiplashInstance)).toBe(1);
      expect(hasEntityKeyword(whiplashInstance, 'Retaliate')).toBe(true);
    });
  });

  describe('4. Combat Pipeline Step 7 Enemy Attack Resolution with Stacking', () => {
    it('deals stacked Retaliate 2 to attacking Villain when defending hero survives', () => {
      // Give Spider-Man stacked Retaliate 2
      (state.players[0].hero as any).keywords = [{ keyword: 'Retaliate', amount: 1 }];
      state.players[0].tableau.push({
        instanceId: 'up_stacked',
        card: {
          code: 'up_02',
          name: 'Spiked Armor',
          enrichment: {
            abilities: [
              {
                id: 'spikes',
                timing: 'CONSTANT',
                steps: [{ effect: 'GRANT_KEYWORD', params: { keyword: 'Retaliate', amount: 1 } }],
              },
            ],
          },
        },
      } as any);

      // Hero defends against Rhino
      const initialVillainHp = state.villain.health;
      const endState = executeEnemyAttackSynchronously(
        state,
        { type: 'VILLAIN' },
        'p1',
        'HERO_IF_READY',
      );

      // Villain took 2 Retaliate damage
      expect(endState.villain.health).toBe(initialVillainHp - 2);
    });

    it('does NOT deal Retaliate damage if defending hero is defeated', () => {
      (state.players[0].hero as any).keywords = [{ keyword: 'Retaliate', amount: 2 }];
      state.players[0].health = 1; // 1 HP left, will be defeated by Rhino ATK 2+

      const endState = executeEnemyAttackSynchronously(
        state,
        { type: 'VILLAIN' },
        'p1',
        'TAKE_UNDEFENDED',
      );

      // Hero defeated, villain takes 0 retaliate damage
      expect(endState.players[0].health).toBe(0);
      expect(endState.villain.health).toBe(14); // Rhino I base HP unchanged
    });

    it('triggers Retaliate from defending Ally when ally survives attack', () => {
      const daredevilCard = cardCatalog.getCard('01083') || cardCatalog.getCard('01011');
      const allyInstance = createCardInstance(daredevilCard!);
      (allyInstance.card as any).health = 10;
      (allyInstance.card as any).keywords = [{ keyword: 'Retaliate', amount: 1 }];
      state.players[0].allies.push(allyInstance);

      const initialVillainHp = state.villain.health;

      // Ally defends and survives
      const endState = executeEnemyAttackSynchronously(
        state,
        { type: 'VILLAIN' },
        'p1',
        'ALLY_CHUMP_BLOCK',
      );

      expect(endState.villain.health).toBe(initialVillainHp - 1);
    });
  });

  describe('5. Basic Attack & Ally Attack Retaliate Counters', () => {
    it('deals Retaliate damage back to Hero when Hero basic attacks Whiplash and Whiplash survives', () => {
      const whiplash = cardCatalog.getCard('01172')!;
      const whiplashInst = createCardInstance(whiplash);
      state.players[0].engagedMinions.push(whiplashInst);

      const initialHeroHp = state.players[0].health;

      // Spider-Man ATK is 2, Whiplash has 4 HP -> survives with 2 HP
      const { state: nextState, result } = dispatchAction(state, {
        type: 'BASIC_ATTACK',
        playerId: 'p1',
        targetType: 'minion',
        targetInstanceId: whiplashInst.instanceId,
      });

      expect(result.success).toBe(true);
      const updatedWhiplash = nextState.players[0].engagedMinions.find(
        (m) => m.instanceId === whiplashInst.instanceId,
      );
      expect(updatedWhiplash?.tokens?.damage).toBe(2);
      // Hero took 1 retaliate damage
      expect(nextState.players[0].health).toBe(initialHeroHp - 1);
    });

    it('does NOT deal Retaliate damage back to Hero if Whiplash is defeated by the attack', () => {
      const whiplash = cardCatalog.getCard('01172')!;
      const whiplashInst = createCardInstance(whiplash);
      whiplashInst.tokens = { damage: 3 }; // 3 damage already on 4 HP Whiplash
      state.players[0].engagedMinions.push(whiplashInst);

      const initialHeroHp = state.players[0].health;

      const { state: nextState, result } = dispatchAction(state, {
        type: 'BASIC_ATTACK',
        playerId: 'p1',
        targetType: 'minion',
        targetInstanceId: whiplashInst.instanceId,
      });

      expect(result.success).toBe(true);
      // Whiplash was defeated and discarded
      expect(nextState.players[0].engagedMinions.length).toBe(0);
      // Hero took 0 retaliate damage
      expect(nextState.players[0].health).toBe(initialHeroHp);
    });

    it('deals Retaliate damage back to Hero when Hero basic attacks Villain with Retaliate attachment', () => {
      // Attach Concussion Blasters to Villain
      state.villain.attachments.push({
        instanceId: 'att_cb',
        card: {
          code: '01153',
          name: 'Concussion Blasters',
          enrichment: {
            abilities: [
              {
                id: 'cb_retaliate',
                timing: 'CONSTANT',
                steps: [{ effect: 'GRANT_KEYWORD', params: { keyword: 'Retaliate', amount: 1 } }],
              },
            ],
          },
        },
      } as any);

      const initialHeroHp = state.players[0].health;
      const initialVillainHp = state.villain.health;

      const { state: nextState, result } = dispatchAction(state, {
        type: 'BASIC_ATTACK',
        playerId: 'p1',
        targetType: 'villain',
      });

      expect(result.success).toBe(true);
      expect(nextState.villain.health).toBe(initialVillainHp - 2);
      // Hero took 1 retaliate damage from Villain
      expect(nextState.players[0].health).toBe(initialHeroHp - 1);
    });

    it('deals Retaliate damage to attacking Ally when Ally attacks surviving enemy with Retaliate', () => {
      const whiplash = cardCatalog.getCard('01172')!;
      const whiplashInst = createCardInstance(whiplash);
      state.players[0].engagedMinions.push(whiplashInst);

      // Add Ally
      const allyCard = cardCatalog.getCard('01011')!; // Nick Fury
      const allyInst = createCardInstance(allyCard);
      (allyInst.card as any).attack = 1;
      (allyInst.card as any).health = 5;
      state.players[0].allies.push(allyInst);

      const { state: nextState, result } = dispatchAction(state, {
        type: 'ALLY_ATTACK',
        playerId: 'p1',
        allyInstanceId: allyInst.instanceId,
        targetType: 'minion',
        targetInstanceId: whiplashInst.instanceId,
      });

      expect(result.success).toBe(true);
      const updatedWhiplash = nextState.players[0].engagedMinions.find(
        (m) => m.instanceId === whiplashInst.instanceId,
      );
      // Whiplash took 1 damage and survived
      expect(updatedWhiplash?.tokens?.damage).toBe(1);

      const updatedAlly = nextState.players[0].allies.find(
        (a) => a.instanceId === allyInst.instanceId,
      );
      // Ally took 1 consequential damage + 1 retaliate damage = 2 damage
      expect(updatedAlly?.tokens?.damage).toBe(2);
    });
  });
});
