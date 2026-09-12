import { describe, it, expect, beforeEach } from 'vitest';
import { setupGame, resetInstanceCounter, createCardInstance } from '@engine/index';
import { CardCatalog } from '@data/importer/card-loader';
import { getIdentityAttackState } from '../../src/ui/components/board/identity-action-utils';
import corePack from '../../data/upstream/pack/core.json';
import coreEncounterPack from '../../data/upstream/pack/core_encounter.json';

describe('Identity Action Modal Attack Target Resolution & Guard Invariants (Issue #102)', () => {
  const catalog = new CardCatalog([...corePack, ...coreEncounterPack]);
  let gameState: ReturnType<typeof setupGame>;

  beforeEach(() => {
    resetInstanceCounter();
    const spiderman = catalog.getHeroIdentity('spider_man')!;
    const deck1 = catalog
      .getCardsByFaction('justice' as any)
      .flatMap((c) => Array(c.quantity).fill(c))
      .slice(0, 40);

    const captainMarvel = catalog.getHeroIdentity('captain_marvel')!;
    const deck2 = catalog
      .getCardsByFaction('leadership' as any)
      .flatMap((c) => Array(c.quantity).fill(c))
      .slice(0, 40);

    const rhinoCards = catalog.getCardsBySet('rhino').filter((c) => c.type !== 'villain');
    const standardCards = catalog.getCardsBySet('standard');
    const bombScareCards = catalog.getCardsBySet('bomb_scare');
    const encounterCards = [...rhinoCards, ...standardCards, ...bombScareCards].flatMap((c) =>
      Array(c.quantity).fill(c),
    );

    const villain = catalog.getCard('01094') as any;
    const mainScheme = catalog.getCard('01097b') as any;

    gameState = setupGame({
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderman.hero,
          alterEgo: spiderman.alterEgo,
          deckCards: deck1,
        },
        {
          id: 'p2',
          name: 'Captain Marvel',
          hero: captainMarvel.hero,
          alterEgo: captainMarvel.alterEgo,
          deckCards: deck2,
        },
      ],
      villain,
      mainScheme,
      encounterCards,
      skipMulligan: true,
      shuffleFn: (arr) => arr,
    });

    gameState.players[0].currentForm = 'hero';
    gameState.players[0].activeFormCard = gameState.players[0].hero;
    gameState.players[1].currentForm = 'hero';
    gameState.players[1].activeFormCard = gameState.players[1].hero;
  });

  it('allows basic attack on villain when unhindered', () => {
    gameState.activePlayerIndex = 0;
    const attackState = getIdentityAttackState(gameState.players[0], gameState, 2);

    expect(attackState.canAttack).toBe(true);
    expect(attackState.canAttackVillain).toBe(true);
    expect(attackState.validAttackTargets).toHaveLength(1);
    expect(attackState.validAttackTargets[0].type).toBe('villain');
    expect(attackState.subtext).toContain('Exhaust to attack villain');
  });

  it('keeps attack enabled when an engaged minion has Guard (Issue #102 fix)', () => {
    // Armored Guard (01120) has Guard keyword
    const guardCard = catalog.getCard('01120')!;
    const guardMinion = createCardInstance(guardCard);
    gameState.players[0].engagedMinions.push(guardMinion);

    gameState.activePlayerIndex = 0;
    const attackState = getIdentityAttackState(gameState.players[0], gameState, 2);

    // CRITICAL: Hero attack MUST be enabled even with Guard minion engaged!
    expect(attackState.canAttack).toBe(true);
    // Villain attack is disabled by Guard
    expect(attackState.canAttackVillain).toBe(false);
    // Minion target is present
    expect(attackState.eligibleMinion).toBeDefined();
    expect(attackState.eligibleMinion?.instanceId).toBe(guardMinion.instanceId);
    expect(attackState.validAttackTargets).toHaveLength(1);
    expect(attackState.validAttackTargets[0].type).toBe('minion');
    // Subtext acknowledges villain is guarded
    expect(attackState.subtext).toContain('Villain guarded');
  });

  it('disables attack when hero is exhausted', () => {
    gameState.activePlayerIndex = 0;
    gameState.players[0].exhausted = true;

    const attackState = getIdentityAttackState(gameState.players[0], gameState, 2);
    expect(attackState.canAttack).toBe(false);
    expect(attackState.subtext).toBe('Hero is exhausted');
  });

  it('disables attack when in Alter-Ego form', () => {
    gameState.activePlayerIndex = 0;
    gameState.players[0].currentForm = 'alter_ego';
    gameState.players[0].activeFormCard = gameState.players[0].alterEgo;

    const attackState = getIdentityAttackState(gameState.players[0], gameState, 2);
    expect(attackState.canAttack).toBe(false);
    expect(attackState.subtext).toBe('Cannot attack while in Alter-Ego form');
  });

  it('disables attack when it is not the active player turn', () => {
    gameState.activePlayerIndex = 1; // Player 2 turn

    const attackState = getIdentityAttackState(gameState.players[0], gameState, 2);
    expect(attackState.canAttack).toBe(false);
    expect(attackState.subtext).toBe('Not your turn');
  });

  it('multiplayer: Player 1 with Guard minion cannot attack villain, but Player 2 CAN attack villain (RR v1.8 p. 15)', () => {
    const guardCard = catalog.getCard('01120')!;
    const guardMinion = createCardInstance(guardCard);
    // Only Player 1 is engaged with the Guard minion
    gameState.players[0].engagedMinions.push(guardMinion);
    expect(gameState.players[1].engagedMinions).toHaveLength(0);

    // 1. Evaluate Player 1 (Active)
    gameState.activePlayerIndex = 0;
    const p1AttackState = getIdentityAttackState(gameState.players[0], gameState, 2);
    expect(p1AttackState.canAttack).toBe(true);
    expect(p1AttackState.canAttackVillain).toBe(false);
    expect(p1AttackState.validAttackTargets).toHaveLength(1);
    expect(p1AttackState.validAttackTargets[0].instanceId).toBe(guardMinion.instanceId);

    // 2. Evaluate Player 2 (Active)
    gameState.activePlayerIndex = 1;
    const p2AttackState = getIdentityAttackState(gameState.players[1], gameState, 2);
    // Player 2 is NOT engaged with Guard minion -> CAN attack villain!
    expect(p2AttackState.canAttack).toBe(true);
    expect(p2AttackState.canAttackVillain).toBe(true);
    // Player 2 can target BOTH the Villain AND Player 1's Guard minion
    expect(p2AttackState.validAttackTargets).toHaveLength(2);
    expect(p2AttackState.validAttackTargets.some((t) => t.type === 'villain')).toBe(true);
    expect(
      p2AttackState.validAttackTargets.some(
        (t) => t.type === 'minion' && t.instanceId === guardMinion.instanceId,
      ),
    ).toBe(true);
    expect(p2AttackState.subtext).toContain('Exhaust to attack enemy');
  });
});
