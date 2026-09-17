import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { HeroCard, AlterEgoCard, StatusCard } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { executeEffect } from '@engine/effects';

describe('Target Scopes & Form Invariants Contract Tests (ADR-0064 & RR v1.8)', () => {
  let spiderManHero: HeroCard;
  let peterParkerAlterEgo: AlterEgoCard;
  let ironManHero: HeroCard;
  let tonyStarkAlterEgo: AlterEgoCard;
  let sheHulkHero: HeroCard;
  let jenniferWaltersAlterEgo: AlterEgoCard;

  beforeEach(() => {
    spiderManHero = cardCatalog.getCard('01001a') as HeroCard;
    peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;
    ironManHero = cardCatalog.getCard('01029a') as HeroCard;
    tonyStarkAlterEgo = cardCatalog.getCard('01029b') as AlterEgoCard;
    sheHulkHero = cardCatalog.getCard('01019a') as HeroCard;
    jenniferWaltersAlterEgo = cardCatalog.getCard('01019b') as AlterEgoCard;
  });

  it('Test 1: Shocker (01103) deals 1 damage to Hero; Alter-Ego takes 0 damage', () => {
    const shockerCard = cardCatalog.getCard('01103')!;
    const shockerInst = createCardInstance(shockerCard);
    const ability = shockerCard.enrichment!.abilities![0];

    // Case 1A: Player in Hero form takes 1 damage
    const heroState = setupGame({
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
    heroState.players[0].currentForm = 'hero';
    heroState.players[0].activeFormCard = spiderManHero;

    const initialHeroHp = heroState.players[0].health;
    const heroResult = executeEffect(heroState, ability, {
      playerId: 'p1',
      sourceCardInstance: shockerInst,
    });

    expect(heroResult.success).toBe(true);
    expect(heroState.players[0].health).toBe(initialHeroHp - 1);

    // Case 1B: Player in Alter-Ego form takes 0 damage (RR v1.8 p. 11, 13)
    const alterEgoState = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Peter Parker',
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
    alterEgoState.players[0].currentForm = 'alter_ego';
    alterEgoState.players[0].activeFormCard = peterParkerAlterEgo;

    const initialAlterEgoHp = alterEgoState.players[0].health;
    const alterEgoResult = executeEffect(alterEgoState, ability, {
      playerId: 'p1',
      sourceCardInstance: shockerInst,
    });

    expect(alterEgoResult.success).toBe(true);
    expect(alterEgoState.players[0].health).toBe(initialAlterEgoHp);
  });

  it('Test 2: Shocker in 2-player game (P1 in Hero, P2 in Alter-Ego) damages P1 only', () => {
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
        {
          id: 'p2',
          name: 'Tony Stark',
          hero: ironManHero,
          alterEgo: tonyStarkAlterEgo,
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
    state.players[1].currentForm = 'alter_ego';
    state.players[1].activeFormCard = tonyStarkAlterEgo;

    const shockerCard = cardCatalog.getCard('01103')!;
    const shockerInst = createCardInstance(shockerCard);
    const ability = shockerCard.enrichment!.abilities![0];

    const p1InitialHp = state.players[0].health;
    const p2InitialHp = state.players[1].health;

    const result = executeEffect(state, ability, {
      playerId: 'p1',
      sourceCardInstance: shockerInst,
    });

    expect(result.success).toBe(true);
    // P1 (Hero) suffered 1 damage
    expect(state.players[0].health).toBe(p1InitialHp - 1);
    // P2 (Alter-Ego) was completely immune to ALL_HEROES damage
    expect(state.players[1].health).toBe(p2InitialHp);
  });

  it('Test 3: Rhino Stage III (01096) stuns all heroes in multiplayer (P1 Hero, P2 Hero stunned; P3 Alter-Ego immune)', () => {
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
        {
          id: 'p2',
          name: 'Iron Man',
          hero: ironManHero,
          alterEgo: tonyStarkAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
        {
          id: 'p3',
          name: 'Jennifer Walters',
          hero: sheHulkHero,
          alterEgo: jenniferWaltersAlterEgo,
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
    state.players[1].currentForm = 'hero';
    state.players[1].activeFormCard = ironManHero;
    state.players[2].currentForm = 'alter_ego';
    state.players[2].activeFormCard = jenniferWaltersAlterEgo;

    const rhinoStage3Card = cardCatalog.getCard('01096')!;
    const rhinoStage3Inst = createCardInstance(rhinoStage3Card);
    const whenRevealedAbility = rhinoStage3Card.enrichment!.abilities!.find(
      (a) => a.id === 'rhino_stage_iii_when_revealed',
    )!;

    const result = executeEffect(state, whenRevealedAbility, {
      playerId: 'p1',
      sourceCardInstance: rhinoStage3Inst,
    });

    expect(result.success).toBe(true);
    // P1 (Hero) and P2 (Hero) are both stunned
    expect(state.players[0].statusCards).toContain(StatusCard.STUNNED);
    expect(state.players[1].statusCards).toContain(StatusCard.STUNNED);
    // P3 (Alter-Ego) is immune to ALL_HEROES status
    expect(state.players[2].statusCards).not.toContain(StatusCard.STUNNED);
  });

  it('Test 4: Explosion (01111) targets ALL_HEROES_AND_ALLIES across multiple players', () => {
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
        {
          id: 'p2',
          name: 'Iron Man',
          hero: ironManHero,
          alterEgo: tonyStarkAlterEgo,
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
    state.players[1].currentForm = 'hero';
    state.players[1].activeFormCard = ironManHero;

    // Add Bomb Scare with 4 threat
    const bombScareCard = cardCatalog.getCard('01109')!;
    state.sideSchemes = [
      {
        instanceId: 'bomb-scare-inst',
        card: bombScareCard as any,
        threat: 4,
      },
    ];

    // Allies for P1 and P2
    const blackCatInst = createCardInstance(cardCatalog.getCard('01011')!); // 2 HP
    state.players[0].allies.push(blackCatInst);

    const warMachineInst = createCardInstance(cardCatalog.getCard('01030')!); // 4 HP
    state.players[1].allies.push(warMachineInst);

    const explosionCard = cardCatalog.getCard('01111')!;
    const explosionInst = createCardInstance(explosionCard);
    const ability = explosionCard.enrichment!.abilities![0];

    // Schema verification: canonical target is ALL_HEROES_AND_ALLIES
    expect(ability.steps[0].effectParams?.target).toBe('ALL_HEROES_AND_ALLIES');

    const p1InitialHp = state.players[0].health;
    const p2InitialHp = state.players[1].health;

    // Distribute 4 damage across all 4 characters
    const result = executeEffect(state, ability, {
      playerId: 'p1',
      sourceCardInstance: explosionInst,
      assignments: {
        p1: 1,
        [blackCatInst.instanceId]: 1,
        p2: 1,
        [warMachineInst.instanceId]: 1,
      },
    });

    expect(result.success).toBe(true);
    expect(state.players[0].health).toBe(p1InitialHp - 1);
    expect(state.players[1].health).toBe(p2InitialHp - 1);
    expect(blackCatInst.tokens?.damage).toBe(1);
    expect(warMachineInst.tokens?.damage).toBe(1);
  });
});
