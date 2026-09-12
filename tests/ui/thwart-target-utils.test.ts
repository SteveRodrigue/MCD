import { describe, it, expect, beforeEach } from 'vitest';
import { setupGame, resetInstanceCounter, createCardInstance } from '@engine/index';
import { CardCatalog } from '@data/importer/card-loader';
import { getValidThwartTargets } from '../../src/ui/components/board/thwart-target-utils';
import corePack from '../../data/upstream/pack/core.json';
import coreEncounterPack from '../../data/upstream/pack/core_encounter.json';
import { Keyword } from '@engine/models';

describe('Thwart Target Selection & Legality Utils (RR v1.8 p. 3, 11, 20, 29)', () => {
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

  it('returns Main Scheme when no side schemes exist and threat > 0', () => {
    const targets = getValidThwartTargets(gameState, 'p1', 'hero');
    expect(targets).toHaveLength(1);
    expect(targets[0].type).toBe('main_scheme');
    expect(targets[0].allowed).toBe(true);
    expect(targets[0].threat).toBe(3);
  });

  it('returns both Main Scheme and Side Schemes when side schemes are in play', () => {
    const sideSchemeCard = catalog.getCard('01108') as any; // Crowd Control (Crisis)
    const sideSchemeInstance = createCardInstance(sideSchemeCard);
    gameState.sideSchemes.push({
      instanceId: sideSchemeInstance.instanceId,
      card: sideSchemeCard,
      threat: 4,
    });

    const targets = getValidThwartTargets(gameState, 'p1', 'hero');
    expect(targets).toHaveLength(2);

    const mainTarget = targets.find((t) => t.type === 'main_scheme');
    const sideTarget = targets.find((t) => t.type === 'side_scheme');

    expect(mainTarget).toBeDefined();
    expect(sideTarget).toBeDefined();

    // Main scheme is blocked because Crowd Control has Crisis icon!
    expect(mainTarget?.allowed).toBe(false);
    expect(mainTarget?.disabledReason).toContain('Crisis');

    // Side scheme is allowed
    expect(sideTarget?.allowed).toBe(true);
    expect(sideTarget?.threat).toBe(4);
    expect(sideTarget?.hasCrisis).toBe(true);
  });

  it('evaluates ally thwart legality respecting ally exhaustion and stats', () => {
    const allyCard = catalog.getCard('01011') as any; // Spider-Woman ally
    const allyInstance = createCardInstance(allyCard);
    allyInstance.exhausted = false;
    gameState.players[0].allies.push(allyInstance);

    const targets = getValidThwartTargets(gameState, 'p1', 'ally', allyInstance.instanceId);
    expect(targets).toHaveLength(1);
    expect(targets[0].allowed).toBe(true);

    // When ally is exhausted, allowed should be false
    allyInstance.exhausted = true;
    const exhaustedTargets = getValidThwartTargets(
      gameState,
      'p1',
      'ally',
      allyInstance.instanceId,
    );
    expect(exhaustedTargets[0].allowed).toBe(false);
    expect(exhaustedTargets[0].disabledReason).toContain('exhausted');
  });

  it('flags main scheme as blocked when player is engaged with Patrol minion', () => {
    const minionCard = {
      ...catalog.getCard('01110')!,
      keywords: [Keyword.PATROL],
    };
    const minionInstance = createCardInstance(minionCard as any);
    gameState.players[0].engagedMinions.push(minionInstance);

    const targets = getValidThwartTargets(gameState, 'p1', 'hero');
    const mainTarget = targets.find((t) => t.type === 'main_scheme')!;
    expect(mainTarget.allowed).toBe(false);
    expect(mainTarget.disabledReason).toContain('Patrol');
  });
});
