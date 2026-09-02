import { describe, it, expect, beforeEach } from 'vitest';
import { setupGame, resetInstanceCounter, createCardInstance } from '@engine/index';
import { CardCatalog } from '@data/importer/card-loader';
import { getValidAttackTargets } from '../../src/ui/components/board/AttackTargetModal';
import corePack from '../../data/upstream/pack/core.json';
import coreEncounterPack from '../../data/upstream/pack/core_encounter.json';

describe('Attack Target Selection & Guard Invariants (RR v1.8 p. 5-6, 15)', () => {
  const catalog = new CardCatalog([...corePack, ...coreEncounterPack]);
  let gameState: ReturnType<typeof setupGame>;

  beforeEach(() => {
    resetInstanceCounter();
    const identity = catalog.getHeroIdentity('spider_man')!;
    const signatureCards = catalog.getCardsBySet('spider_man').flatMap((c) => {
      if (c.type === 'hero' || c.type === 'alter_ego') return [];
      return Array(c.quantity).fill(c);
    });
    const justiceCards = catalog
      .getCardsByFaction('justice' as any)
      .flatMap((c) => Array(c.quantity).fill(c));
    const basicCards = catalog
      .getCardsByFaction('basic' as any)
      .flatMap((c) => Array(c.quantity).fill(c));
    const deck = [...signatureCards, ...justiceCards, ...basicCards].slice(0, 40);

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
          name: 'Peter Parker',
          hero: identity.hero,
          alterEgo: identity.alterEgo,
          deckCards: deck,
        },
      ],
      villain,
      mainScheme,
      encounterCards,
      shuffleFn: (arr) => arr,
    });

    gameState.players[0].currentForm = 'hero';
    gameState.players[0].activeFormCard = gameState.players[0].hero;
  });

  it('returns only Villain when no minions are engaged in play', () => {
    const targets = getValidAttackTargets(gameState, 'p1', 'hero');
    expect(targets).toHaveLength(1);
    expect(targets[0].type).toBe('villain');
    expect(targets[0].name).toBe('Rhino');
    expect(targets[0].health).toBe(14);
  });

  it('returns Villain AND Minions when minions are engaged without Guard', () => {
    const hydraBomberCard = catalog.getCard('01110')!; // Hydra Bomber (Minion, HP 2, no Guard)
    const hydraBomber = createCardInstance(hydraBomberCard);
    gameState.players[0].engagedMinions.push(hydraBomber);

    const targets = getValidAttackTargets(gameState, 'p1', 'hero');
    expect(targets).toHaveLength(2);
    expect(targets.some((t) => t.type === 'villain')).toBe(true);
    expect(
      targets.some((t) => t.type === 'minion' && t.instanceId === hydraBomber.instanceId),
    ).toBe(true);
  });

  it('excludes Villain and returns only Minions when an engaged minion has Guard (RR v1.8 p. 15)', () => {
    const guardMinionCard = catalog.getCard('01120')!; // Armored Guard (Minion with Guard, HP 3)
    const guardMinion = createCardInstance(guardMinionCard);
    gameState.players[0].engagedMinions.push(guardMinion);

    const targets = getValidAttackTargets(gameState, 'p1', 'hero');
    expect(targets).toHaveLength(1);
    expect(targets[0].type).toBe('minion');
    expect(targets[0].instanceId).toBe(guardMinion.instanceId);
    expect(targets[0].hasGuard).toBe(true);
    // Villain is blocked by Guard!
    expect(targets.some((t) => t.type === 'villain')).toBe(false);
  });

  it('supports Ally attackers and filters targets respecting Guard', () => {
    const allyCard = catalog.getCard('01011')!; // Spider-Woman ally
    const allyInstance = createCardInstance(allyCard);
    gameState.players[0].allies.push(allyInstance);

    const hydraBomber = createCardInstance(catalog.getCard('01110')!);
    gameState.players[0].engagedMinions.push(hydraBomber);

    const allyTargets = getValidAttackTargets(gameState, 'p1', 'ally', allyInstance.instanceId);
    expect(allyTargets).toHaveLength(2);
    expect(allyTargets.some((t) => t.type === 'villain')).toBe(true);
    expect(allyTargets.some((t) => t.type === 'minion')).toBe(true);
  });

  it('includes minions engaged with other players in multiplayer games', () => {
    // Add second player with engaged minion
    const p2Identity = catalog.getHeroIdentity('she_hulk')!;
    const p2Deck = catalog
      .getCardsByFaction('aggression' as any)
      .flatMap((c) => Array(c.quantity).fill(c))
      .slice(0, 40);
    gameState.players.push({
      ...gameState.players[0],
      id: 'p2',
      name: 'Player 2',
      hero: p2Identity.hero,
      alterEgo: p2Identity.alterEgo,
      activeFormCard: p2Identity.hero,
      deck: p2Deck,
      engagedMinions: [],
    });

    const p2Minion = createCardInstance(catalog.getCard('01110')!);
    gameState.players[1].engagedMinions.push(p2Minion);

    const targets = getValidAttackTargets(gameState, 'p1', 'hero');
    expect(targets).toHaveLength(2);
    expect(targets.some((t) => t.instanceId === p2Minion.instanceId)).toBe(true);
  });
});
