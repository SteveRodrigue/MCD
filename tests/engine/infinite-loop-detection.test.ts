import { describe, it, expect, beforeEach } from 'vitest';
import { CardCatalog } from '../../src/data/importer/card-loader';
import {
  setupGame,
  resetInstanceCounter,
  createCardInstance,
  VillainCard,
  MainSchemeCard,
  NormalizedCard,
  GameState,
  CardType,
  FactionCode,
} from '../../src/engine';
import { dispatchTrigger } from '../../src/engine/triggers/trigger-dispatcher';
import { InfiniteLoopError } from '../../src/engine/errors/infinite-loop-error';

import corePack from '../../data/upstream/pack/core.json';
import coreEncounterPack from '../../data/upstream/pack/core_encounter.json';

function makeMockCard(
  partial: Partial<NormalizedCard> & { code: string; name: string },
): NormalizedCard {
  return {
    packCode: 'core',
    position: 1,
    quantity: 1,
    deckLimit: 3,
    type: CardType.UPGRADE,
    faction: FactionCode.BASIC,
    ...partial,
  } as NormalizedCard;
}

describe('Infinite Trigger Loop Detection & Prevention Guardrails (ADR-0053, Issue #48)', () => {
  const catalog = new CardCatalog([...corePack, ...coreEncounterPack]);
  let gameState: GameState;

  beforeEach(() => {
    resetInstanceCounter();
    const identity = catalog.getHeroIdentity('spider_man')!;
    const villain = catalog.getCard('01094') as VillainCard;
    const mainScheme = catalog.getCard('01097b') as MainSchemeCard;

    gameState = setupGame({
      players: [
        {
          id: 'p1',
          name: 'Peter Parker',
          hero: identity.hero,
          alterEgo: identity.alterEgo,
          deckCards: Array(10).fill(catalog.getCard('01005')!),
        },
      ],
      villain,
      mainScheme,
      encounterCards: [catalog.getCard('01094')!],
      shuffleFn: (arr) => arr,
      skipMulligan: true,
    });
  });

  it('1. Detects direct self-looping forced trigger on single card and throws InfiniteLoopError', () => {
    const player = gameState.players[0];
    const selfLoopCard = makeMockCard({
      code: 'test_self_loop',
      name: 'Echo Chamber',
      type: CardType.UPGRADE,
      cost: 1,
      faction: FactionCode.BASIC,
      traits: ['Item'],
      enrichment: {
        abilities: [
          {
            id: 'ability_self_echo',
            timing: 'FORCED_INTERRUPT',
            trigger: 'TAKE_DAMAGE',
            steps: [
              {
                effect: 'DEAL_DAMAGE',
                params: { amount: 1, target: 'SELF' },
              },
            ],
          },
        ],
      },
    });

    const cardInst = createCardInstance(selfLoopCard);
    player.tableau.push(cardInst);

    expect(() => {
      dispatchTrigger(gameState, 'TAKE_DAMAGE', {
        targetPlayerId: player.id,
        targetType: 'player',
        damageAmount: 1,
      });
    }).toThrow(InfiniteLoopError);

    try {
      dispatchTrigger(gameState, 'TAKE_DAMAGE', {
        targetPlayerId: player.id,
        targetType: 'player',
        damageAmount: 1,
      });
    } catch (err) {
      const loopErr = err as InfiniteLoopError;
      expect(loopErr.name).toBe('InfiniteLoopError');
      expect(loopErr.formattedCycle).toContain('Echo Chamber');
      expect(loopErr.formattedCycle).toContain('ability_self_echo');
      expect(loopErr.formattedCycle).toContain('TAKE_DAMAGE');
      expect(loopErr.cycle.length).toBeGreaterThanOrEqual(2);
    }

    const logEntry = gameState.log.find((l) => l.onomatopoeia === 'INFINITE LOOP DETECTED!');
    expect(logEntry).toBeDefined();
    expect(logEntry?.onomatopoeia).toBe('INFINITE LOOP DETECTED!');
    expect(gameState.lastError).toBeDefined();
    expect(gameState.lastError?.type).toBe('INFINITE_LOOP');
  });

  it('2. Detects mutual circular forced trigger loop between two distinct cards (A ? B)', () => {
    const player = gameState.players[0];

    // Card A: When CARD_DISCARDED -> deals damage to player (emitting TAKE_DAMAGE)
    const cardA = makeMockCard({
      code: 'test_loop_a',
      name: 'Spiteful Vengeance',
      type: CardType.UPGRADE,
      cost: 1,
      faction: FactionCode.BASIC,
      enrichment: {
        abilities: [
          {
            id: 'ability_vengeance_a',
            timing: 'FORCED_INTERRUPT',
            trigger: 'CARD_DISCARDED',
            steps: [
              {
                effect: 'DEAL_DAMAGE',
                params: { amount: 1, target: 'SELF' },
              },
            ],
          },
        ],
      },
    });

    // Card B: When TAKE_DAMAGE -> discards card from player hand (emitting CARD_DISCARDED)
    const cardB = makeMockCard({
      code: 'test_loop_b',
      name: 'Painful Memory',
      type: CardType.UPGRADE,
      cost: 1,
      faction: FactionCode.BASIC,
      enrichment: {
        abilities: [
          {
            id: 'ability_memory_b',
            timing: 'FORCED_INTERRUPT',
            trigger: 'TAKE_DAMAGE',
            steps: [
              {
                effect: 'DISCARD_CARDS',
                params: { count: 1 },
              },
            ],
          },
        ],
      },
    });

    player.tableau.push(createCardInstance(cardA));
    player.tableau.push(createCardInstance(cardB));

    let capturedError: InfiniteLoopError | undefined;
    try {
      dispatchTrigger(gameState, 'CARD_DISCARDED', {
        targetPlayerId: player.id,
      });
    } catch (err) {
      if (err instanceof InfiniteLoopError) {
        capturedError = err;
      }
    }

    expect(capturedError).toBeDefined();
    expect(capturedError?.formattedCycle).toContain('Spiteful Vengeance');
    expect(capturedError?.formattedCycle).toContain('Painful Memory');
    expect(capturedError?.cycle.length).toBeGreaterThanOrEqual(3);

    const logEntry = gameState.log.find((l) => l.onomatopoeia === 'INFINITE LOOP DETECTED!');
    expect(logEntry).toBeDefined();
    expect(gameState.lastError?.type).toBe('INFINITE_LOOP');
  });

  it('3. Safely halts when maximum trigger depth ceiling (MAX_TRIGGER_DEPTH = 15) is exceeded', () => {
    const player = gameState.players[0];

    // Create 18 cards in a non-repeating chain: Card_0 -> Card_1 -> Card_2 ... -> Card_17
    for (let i = 0; i < 18; i++) {
      const chainedCard = makeMockCard({
        code: `test_chain_${i}`,
        name: `Domino Effect ${i}`,
        type: CardType.UPGRADE,
        cost: 1,
        faction: FactionCode.BASIC,
        enrichment: {
          abilities: [
            {
              id: `ability_chain_${i}`,
              timing: 'FORCED_INTERRUPT',
              trigger: `CHAIN_STEP_${i}` as any,
              steps: [
                {
                  effect: 'DISCARD_CARDS',
                  params: { count: 1 },
                },
              ],
            },
          ],
        },
      });
      player.tableau.push(createCardInstance(chainedCard));
    }

    // Pass a synthetic deep trigger chain to test the depth guard directly
    expect(() => {
      dispatchTrigger(
        gameState,
        'TAKE_DAMAGE',
        {
          targetPlayerId: player.id,
          targetType: 'player',
          damageAmount: 1,
        },
        // Trigger call chain with 16 prior frames
        Array.from({ length: 16 }, (_, idx) => ({
          trigger: `EVENT_${idx}` as any,
          abilityId: `ability_${idx}`,
          cardCode: `card_${idx}`,
          cardName: `Chained Card ${idx}`,
        })),
      );
    }).toThrow(InfiniteLoopError);
  });

  it('4. Legitimate nested non-looping triggers resolve cleanly without false positives', () => {
    const player = gameState.players[0];

    // Card 1: On TAKE_DAMAGE -> HEAL 1 damage (does not emit TAKE_DAMAGE)
    const healCard = makeMockCard({
      code: 'test_heal_legit',
      name: 'First Aid Kit',
      type: CardType.SUPPORT,
      cost: 1,
      faction: FactionCode.BASIC,
      enrichment: {
        abilities: [
          {
            id: 'ability_legit_heal',
            timing: 'FORCED_INTERRUPT',
            trigger: 'TAKE_DAMAGE',
            steps: [
              {
                effect: 'HEAL_DAMAGE',
                params: { amount: 1 },
              },
            ],
          },
        ],
      },
    });

    // Card 2: On TAKE_DAMAGE -> ADD_STATUS TOUGH (does not emit TAKE_DAMAGE)
    const shieldCard = makeMockCard({
      code: 'test_shield_legit',
      name: 'Energy Barrier',
      type: CardType.UPGRADE,
      cost: 1,
      faction: FactionCode.BASIC,
      enrichment: {
        abilities: [
          {
            id: 'ability_legit_shield',
            timing: 'FORCED_INTERRUPT',
            trigger: 'TAKE_DAMAGE',
            steps: [
              {
                effect: 'ADD_STATUS',
                params: { status: 'TOUGH' },
              },
            ],
          },
        ],
      },
    });

    player.tableau.push(createCardInstance(healCard));
    player.tableau.push(createCardInstance(shieldCard));

    expect(() => {
      const res = dispatchTrigger(gameState, 'TAKE_DAMAGE', {
        targetPlayerId: player.id,
        targetType: 'player',
        damageAmount: 2,
      });
      expect(res).toBeDefined();
    }).not.toThrow();

    expect(gameState.lastError).toBeUndefined();
    expect(gameState.log.some((l) => l.onomatopoeia === 'INFINITE LOOP DETECTED!')).toBe(false);
  });
});
