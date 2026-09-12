import { describe, it, expect, beforeEach } from 'vitest';
import { setupGame, resetInstanceCounter, createCardInstance } from '@engine/index';
import { CardCatalog } from '@data/importer/card-loader';
import { getValidAttackTargets } from '../../src/ui/components/board/attack-target-utils';
import { getValidThwartTargets } from '../../src/ui/components/board/thwart-target-utils';
import corePack from '../../data/upstream/pack/core.json';
import coreEncounterPack from '../../data/upstream/pack/core_encounter.json';

describe('Card Action Selection & 2-Stage Interaction Invariants (Issue #98)', () => {
  const catalog = new CardCatalog([...corePack, ...coreEncounterPack]);
  let gameState: ReturnType<typeof setupGame>;

  beforeEach(() => {
    resetInstanceCounter();
    const identity = catalog.getHeroIdentity('spider_man')!;
    const deck = catalog
      .getCardsByFaction('justice' as any)
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
    gameState.mainScheme.threat = 3;
  });

  it('Stage 2 Attack Target Resolution: returns targets for player selection even when only 1 enemy exists', () => {
    // When only the villain is in play, targets array has length 1.
    // Instead of auto-dispatching, AttackTargetModal uses this list so the player explicitly confirms or cancels.
    const targets = getValidAttackTargets(gameState, 'p1', 'hero');
    expect(targets).toHaveLength(1);
    expect(targets[0].type).toBe('villain');
    expect(targets[0].name).toBe('Rhino');
  });

  it('Stage 2 Attack Target Resolution for Allies: returns valid targets including minions', () => {
    const allyCard = catalog.getCard('01011') as any; // Spider-Woman
    const allyInst = createCardInstance(allyCard);
    gameState.players[0].allies.push(allyInst);

    const minionCard = catalog.getCard('01110') as any; // Hydra Bomber
    const minionInst = createCardInstance(minionCard);
    gameState.players[0].engagedMinions.push(minionInst);

    const targets = getValidAttackTargets(gameState, 'p1', 'ally', allyInst.instanceId);
    expect(targets).toHaveLength(2);
    expect(targets.some((t) => t.type === 'villain')).toBe(true);
    expect(targets.some((t) => t.type === 'minion')).toBe(true);
  });

  it('Stage 2 Thwart Target Resolution: distinguishes Main Scheme from Side Schemes without silent defaults', () => {
    const sideSchemeCard = catalog.getCard('01109') as any; // Bomb Scare
    const sideSchemeInst = createCardInstance(sideSchemeCard);
    gameState.sideSchemes.push({
      instanceId: sideSchemeInst.instanceId,
      card: sideSchemeCard,
      threat: 2,
    });

    const targets = getValidThwartTargets(gameState, 'p1', 'hero');
    expect(targets).toHaveLength(2);

    const mainTarget = targets.find((t) => t.type === 'main_scheme');
    const sideTarget = targets.find((t) => t.type === 'side_scheme');

    expect(mainTarget?.allowed).toBe(true);
    expect(sideTarget?.allowed).toBe(true);
    expect(sideTarget?.name).toBe('Bomb Scare');
  });

  it('Stage 2 Thwart Target Resolution for Allies: evaluates ally legality on schemes', () => {
    const allyCard = catalog.getCard('01011') as any;
    const allyInst = createCardInstance(allyCard);
    gameState.players[0].allies.push(allyInst);

    const targets = getValidThwartTargets(gameState, 'p1', 'ally', allyInst.instanceId);
    expect(targets).toHaveLength(1);
    expect(targets[0].allowed).toBe(true);
  });
});
