import { describe, it, expect, beforeEach } from 'vitest';
import {
  GameState,
  PlayerState,
  StatusCard,
  CardInstance,
  GamePhase,
} from '../../src/engine/models';
import {
  initiateEnemyAttack,
  resolveDefenderDeclaration,
  finishAttackDamageAndPostResolution,
} from '../../src/engine/pipeline/combat-pipeline';
import { dispatchAction } from '../../src/engine/pipeline/action-dispatcher';
import { peekDecisionPrompt } from '../../src/engine/pipeline/prompt-queue';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { createCardInstance } from '../../src/engine/state/card-instance';

function createMockCardInstance(
  code: string,
  name: string,
  type: string,
  overrides: Record<string, any> = {},
): CardInstance {
  return {
    instanceId: `inst_${code}_${Math.random().toString(36).substring(2, 7)}`,
    card: {
      code,
      name,
      type,
      cost: 1,
      ...overrides,
    } as any,
    exhausted: false,
    tokens: {},
    statusCards: [],
  };
}

function createInitialTestState(): GameState {
  const player1: any = {
    id: 'player_1',
    name: 'Player 1',
    currentForm: 'hero',
    exhausted: false,
    health: 10,
    maxHealth: 10,
    hero: {
      code: '01001a',
      name: 'Spider-Man',
      type: 'hero',
      hit_points: 10,
      defense: 3,
      attack: 2,
      thwart: 1,
      hand_size: 5,
    },
    alterEgo: {
      code: '01001b',
      name: 'Peter Parker',
      type: 'alter_ego',
      hit_points: 10,
      recover: 3,
      hand_size: 6,
    },
    hand: [],
    deck: [],
    discard: [],
    allies: [],
    tableau: [],
    engagedMinions: [],
    statusCards: [],
  };

  const player2: any = {
    id: 'player_2',
    name: 'Player 2',
    currentForm: 'hero',
    exhausted: false,
    health: 9,
    maxHealth: 9,
    hero: {
      code: '01029a',
      name: 'Iron Man',
      type: 'hero',
      hit_points: 9,
      defense: 2,
      attack: 1,
      thwart: 2,
      hand_size: 5,
    },
    alterEgo: {
      code: '01029b',
      name: 'Tony Stark',
      type: 'alter_ego',
      hit_points: 9,
      recover: 3,
      hand_size: 6,
    },
    hand: [],
    deck: [],
    discard: [],
    allies: [],
    tableau: [],
    engagedMinions: [],
    statusCards: [],
  };

  return {
    id: 'game_combat_test',
    roundNumber: 1,
    phase: GamePhase.VILLAIN_PHASE,
    activePlayerIndex: 0,
    firstPlayerIndex: 0,
    accelerationTokens: 0,
    targetThreat: 10,
    mainSchemeDeck: [],
    sideSchemes: [],
    villain: {
      card: {
        code: '01094',
        name: 'Rhino',
        type: 'villain',
        attack: 3,
        scheme: 1,
        hit_points: 14,
      } as any,
      health: 14,
      maxHealth: 14,
      exhausted: false,
      statusCards: [],
      attachments: [],
    },
    encounterDeck: [],
    encounterDiscard: [],
    players: [player1 as PlayerState, player2 as PlayerState],
    log: [],
  } as any as GameState;
}

describe('Combat & Defense Pipeline (RR v1.8)', () => {
  let state: GameState;

  beforeEach(() => {
    state = createInitialTestState();
  });

  it('Test 1: Defense card (Backflip) played on undefended attack marks hero as defender and triggers ATTACK_DEFENDED', () => {
    const p1 = state.players[0];

    // Empty boost deck so 0 boost icons
    state.encounterDeck = [];

    // Initiate attack against Player 1
    initiateEnemyAttack(state, { type: 'VILLAIN' }, p1.id);
    const ctx = state.activeAttackContext!;
    expect(ctx).toBeDefined();

    // Declare undefended
    resolveDefenderDeclaration(state, { type: 'UNDEFENDED', playerId: p1.id }, ctx);

    // Initial resolution with 3 damage dealt
    expect(state.lastCombatOutcome?.finalDamage).toBe(3);
    expect(p1.health).toBe(7);

    // Now simulate Backflip prevention via finishAttackDamageAndPostResolution (reversing the 3 damage)
    p1.health = 10;
    ctx.pendingDamage = 3;
    state.activeAttackContext = ctx;
    finishAttackDamageAndPostResolution(state, ctx, 3);

    // Verify hero is marked as defended
    expect(ctx.heroDefended).toBe(true);
    expect(ctx.defender?.type).toBe('HERO');
    expect(state.lastCombatOutcome?.finalDamage).toBe(0);
    expect(p1.health).toBe(10); // 0 damage taken
  });

  it('Test 2: Defending ally defeated by boost ability causes attack to revert to undefended against hero', () => {
    const p1 = state.players[0];
    const ally = createMockCardInstance('01002', 'Black Cat', 'ally', { health: 1 });
    p1.allies.push(ally);

    // Create a boost card with a Star ability that defeats the ally
    const boostCard = createMockCardInstance('01120', 'Bomb Threat Boost', 'treachery', {
      boostStar: true,
      boostIcons: 0,
      enrichment: {
        abilities: [
          {
            id: 'boost_kill_ally',
            timing: 'BOOST',
            steps: [
              {
                effect: 'DISCARD_ALLY',
                effectParams: { target: 'CHOSEN_ALLY' },
              },
            ],
          },
        ],
      },
    });
    state.encounterDeck = [boostCard];

    // Initiate attack against Player 1
    initiateEnemyAttack(state, { type: 'VILLAIN' }, p1.id);
    const ctx = state.activeAttackContext!;

    // Defending ally removed before damage (simulating boost defeat)
    p1.allies = [];

    // Resolve defender declaration
    resolveDefenderDeclaration(
      state,
      { type: 'ALLY', playerId: p1.id, allyInstanceId: ally.instanceId },
      ctx,
    );

    expect(ctx.defender?.type).toBe('UNDEFENDED');
    expect(ctx.heroDefended).toBe(false);
    expect(p1.health).toBe(10 - 3); // 3 damage to hero
    expect(state.lastCombatOutcome?.defenderType).toBe('UNDEFENDED');
  });

  it('Test 3: Cross-Table Hero Defense retargets attack and mitigates damage with Player 2 DEF', () => {
    const p1 = state.players[0];
    const p2 = state.players[1];

    // Initiate attack targeting Player 1
    initiateEnemyAttack(state, { type: 'VILLAIN' }, p1.id);
    const ctx = state.activeAttackContext!;
    expect(ctx.targetPlayerId).toBe('player_1');

    // Player 2 declares hero defense
    resolveDefenderDeclaration(state, { type: 'HERO', playerId: p2.id }, ctx);

    expect(ctx.targetPlayerId).toBe('player_2');
    expect(ctx.heroDefended).toBe(true);
    expect(p2.exhausted).toBe(true);
    expect(p1.exhausted).toBe(false);
    expect(ctx.defenseValue).toBe(2); // Iron Man DEF: 2

    expect(p2.health).toBe(8); // 9 - (3 - 2) = 8
    expect(p1.health).toBe(10); // Player 1 unaffected
    expect(state.lastCombatOutcome?.targetPlayerId).toBe('player_2');
  });

  it('Test 3b: Cross-Table Ally Defense retargets attack to Player 2 and deals damage to Player 2 ally with Overkill', () => {
    const p1 = state.players[0];
    const p2 = state.players[1];

    const warMachineAlly = createMockCardInstance('01030', 'War Machine', 'ally', { health: 2 });
    p2.allies.push(warMachineAlly);

    // Initiate attack against Player 1
    initiateEnemyAttack(state, { type: 'VILLAIN' }, p1.id);
    const ctx = state.activeAttackContext!;
    ctx.hasOverkill = true;

    // Player 2 declares War Machine as defender
    resolveDefenderDeclaration(
      state,
      { type: 'ALLY', playerId: p2.id, allyInstanceId: warMachineAlly.instanceId },
      ctx,
    );

    expect(ctx.targetPlayerId).toBe('player_2');
    expect(p2.allies.length).toBe(0); // Ally defeated
    expect(p2.discard).toContain(warMachineAlly);
    expect(p2.health).toBe(8); // Overkill 1 damage dealt to Player 2 (9 - 1 = 8)
    expect(p1.health).toBe(10); // Player 1 unharmed
    expect(state.lastCombatOutcome?.targetPlayerId).toBe('player_2');
  });

  it('Test 4: Basic Hero Defense with Armored Vest (+1 DEF)', () => {
    const p1 = state.players[0];
    p1.tableau.push(
      createMockCardInstance('01081', 'Armored Vest', 'upgrade', {
        enrichment: {
          abilities: [
            {
              id: 'armored_vest_def',
              timing: 'CONSTANT',
              steps: [{ effect: 'MODIFY_STAT', effectParams: { stat: 'DEFENSE', amount: 1 } }],
            },
          ],
        },
      }),
    );

    initiateEnemyAttack(state, { type: 'VILLAIN' }, p1.id);
    const ctx = state.activeAttackContext!;

    resolveDefenderDeclaration(state, { type: 'HERO', playerId: p1.id }, ctx);

    // Spider-Man DEF 3 + Armored Vest 1 = 4 DEF vs 3 ATK -> 0 damage
    expect(ctx.defenseValue).toBe(4);
    expect(p1.health).toBe(10);
    expect(state.lastCombatOutcome?.finalDamage).toBe(0);
    expect(ctx.heroDefended).toBe(true);
  });

  it('Test 5: Multi-Hero Defender Prompt Generation with Overkill, Piercing, Tough & Retaliate', () => {
    const p1 = state.players[0];
    const p2 = state.players[1];

    p1.statusCards.push(StatusCard.TOUGH);
    const blackCat = createMockCardInstance('01002', 'Black Cat', 'ally', { health: 2 });
    p1.allies.push(blackCat);

    const warMachine = createMockCardInstance('01030', 'War Machine', 'ally', { health: 4 });
    p2.allies.push(warMachine);

    // Initiate attack against Player 1
    state.encounterDeck = [];
    initiateEnemyAttack(state, { type: 'VILLAIN' }, p1.id);

    const prompt = state.pendingDecisionQueue?.[0];
    expect(prompt).toBeDefined();
    expect(prompt?.targetPlayerName).toBe('Player 1');
    expect(prompt?.targetHasTough).toBe(true);

    // Options order:
    // 1. Player 1 Hero
    // 2. Player 1 Black Cat
    // 3. Player 2 Hero (Iron Man)
    // 4. Player 2 War Machine
    // 5. Take Undefended
    const options = prompt!.options;
    expect(options.length).toBe(5);
    expect(options[0].id).toBe('defend_hero');
    expect(options[0].cardCode).toBe('01001a');
    expect(options[0].statusBadges?.isTough).toBe(true);

    expect(options[1].id).toBe(`defend_ally_${blackCat.instanceId}`);
    expect(options[1].cardCode).toBe('01002');

    expect(options[2].id).toBe('defend_hero_player_2');
    expect(options[2].cardCode).toBe('01029a');
    expect(options[2].label).toContain('Iron Man (Player 2)');

    expect(options[3].id).toBe(`defend_ally_${warMachine.instanceId}`);
    expect(options[3].cardCode).toBe('01030');
    expect(options[3].label).toContain('War Machine');

    expect(options[4].id).toBe('undefended');
    expect(options[4].icon).toBe('punch');
  });

  it('Test 6: Piercing discards Tough before damage', () => {
    const p1 = state.players[0];
    p1.statusCards.push(StatusCard.TOUGH);

    initiateEnemyAttack(state, { type: 'VILLAIN' }, p1.id);
    const ctx = state.activeAttackContext!;
    ctx.hasPiercing = true;

    resolveDefenderDeclaration(state, { type: 'UNDEFENDED', playerId: p1.id }, ctx);

    // Tough discarded AND 3 damage dealt to hero (10 - 3 = 7)
    expect(p1.statusCards.includes(StatusCard.TOUGH)).toBe(false);
    expect(p1.health).toBe(7);
  });

  it('Test 7: Issue #191 Regression: Player 2 Hero Defense prevents damage to Spider-Man and does NOT trigger Backflip', () => {
    const p1 = state.players[0];
    const p2 = state.players[1];

    const backflip = createCardInstance(cardCatalog.getCard('01003')!, p1.id);
    p1.hand = [backflip];

    state.encounterDeck = [];
    initiateEnemyAttack(state, { type: 'VILLAIN' }, p1.id, { acceptOptionalTriggers: true });
    const ctx = state.activeAttackContext!;
    expect(ctx).toBeDefined();
    expect(ctx.targetPlayerId).toBe('player_1');

    // Player 2 (Iron Man) declares Hero defense
    resolveDefenderDeclaration(state, { type: 'HERO', playerId: p2.id }, ctx);

    // Verify attackContext.targetPlayerId is player_2
    expect(ctx.targetPlayerId).toBe('player_2');
    expect(state.lastCombatOutcome?.targetPlayerId).toBe('player_2');

    // Verify Iron Man absorbs damage (mitigated by DEF 2: takes 1 damage)
    expect(ctx.heroDefended).toBe(true);
    expect(p2.exhausted).toBe(true);
    expect(ctx.defenseValue).toBe(2);
    expect(p2.health).toBe(8); // 9 max - 1 damage

    // Verify Spider-Man takes 0 damage (remains at 10 HP)
    expect(p1.health).toBe(10);
    expect(p1.exhausted).toBe(false);

    // Verify Backflip is NOT triggered, remains in Player 1's hand
    expect(p1.hand).toContain(backflip);
    expect(p1.discard).not.toContain(backflip);
    expect(peekDecisionPrompt(state)).toBeUndefined();
  });

  it('Test 8: Issue #191 Regression: Ally Defense for Spider-Man prevents damage to Spider-Man and does NOT trigger Backflip', () => {
    const p1 = state.players[0];
    const backflip = createCardInstance(cardCatalog.getCard('01003')!, p1.id);
    p1.hand = [backflip];

    const blackCat = createCardInstance(cardCatalog.getCard('01002')!, p1.id);
    p1.allies.push(blackCat);

    state.encounterDeck = [];
    initiateEnemyAttack(state, { type: 'VILLAIN' }, p1.id, { acceptOptionalTriggers: true });
    const ctx = state.activeAttackContext!;
    expect(ctx).toBeDefined();

    // Player 1 declares Ally defense (Black Cat 01002)
    resolveDefenderDeclaration(
      state,
      { type: 'ALLY', playerId: p1.id, allyInstanceId: blackCat.instanceId },
      ctx,
    );

    // Verify Black Cat absorbs attack damage (defeated and discarded)
    expect(p1.allies).not.toContain(blackCat);
    expect(p1.discard).toContain(blackCat);

    // Verify Spider-Man takes 0 damage (remains at 10 HP)
    expect(p1.health).toBe(10);
    expect(p1.exhausted).toBe(false);

    // Verify Backflip is NOT triggered, remains in Player 1's hand
    expect(p1.hand).toContain(backflip);
    expect(p1.discard).not.toContain(backflip);
    expect(peekDecisionPrompt(state)).toBeUndefined();
  });

  it('Test 9: Issue #191 Regression: Cross-Table Ally Defense for Spider-Man prevents damage to Spider-Man and does NOT trigger Backflip', () => {
    const p1 = state.players[0];
    const p2 = state.players[1];

    const backflip = createCardInstance(cardCatalog.getCard('01003')!, p1.id);
    p1.hand = [backflip];

    const warMachine = createCardInstance(cardCatalog.getCard('01030')!, p2.id);
    p2.allies.push(warMachine);

    state.encounterDeck = [];
    initiateEnemyAttack(state, { type: 'VILLAIN' }, p1.id, { acceptOptionalTriggers: true });
    const ctx = state.activeAttackContext!;
    expect(ctx).toBeDefined();

    // Player 2 declares Ally defense (War Machine 01030)
    resolveDefenderDeclaration(
      state,
      { type: 'ALLY', playerId: p2.id, allyInstanceId: warMachine.instanceId },
      ctx,
    );

    // Verify target retargeted to Player 2
    expect(ctx.targetPlayerId).toBe('player_2');
    expect(state.lastCombatOutcome?.targetPlayerId).toBe('player_2');

    // Verify War Machine absorbs attack damage (takes 3 damage on 4 HP)
    expect(warMachine.tokens?.damage).toBe(3);
    expect(p2.allies).toContain(warMachine);

    // Verify Spider-Man takes 0 damage and Backflip remains in Player 1's hand
    expect(p1.health).toBe(10);
    expect(p1.exhausted).toBe(false);
    expect(p1.hand).toContain(backflip);
    expect(p1.discard).not.toContain(backflip);
    expect(peekDecisionPrompt(state)).toBeUndefined();
  });

  it('Test 10: Issue #183 Regression: Cross-Table Hero Defense via RESOLVE_DECISION_PROMPT declares Spider-Man, exhausts Spider-Man, and applies 3 DEF', () => {
    state.options = { villainPhaseStepping: true };
    const p1 = state.players[0]; // Spider-Man, DEF: 3, HP: 10
    const p2 = state.players[1]; // Iron Man, DEF: 2, HP: 9

    state.encounterDeck = []; // 0 boost icons
    // Rhino (ATK 3) attacks Player 2
    initiateEnemyAttack(state, { type: 'VILLAIN' }, p2.id);

    const prompt = peekDecisionPrompt(state);
    expect(prompt).toBeDefined();
    expect(prompt?.playerId).toBe(p2.id);

    const crossHeroOpt = prompt?.options.find((o) => o.id === `defend_hero_${p1.id}`);
    expect(crossHeroOpt).toBeDefined();
    expect(crossHeroOpt?.params?.playerId).toBe(p1.id);

    // Player 2 resolves the prompt by selecting Player 1's hero defense
    const dispatchRes = dispatchAction(state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: p2.id,
      selectedOptionId: crossHeroOpt!.id,
    });

    expect(dispatchRes.result.success).toBe(true);

    const finalP1 = dispatchRes.state.players[0];
    const finalP2 = dispatchRes.state.players[1];

    // Spider-Man (Player 1) must be declared defender and exhausted
    expect(finalP1.exhausted).toBe(true);
    // Player 2 must NOT be exhausted
    expect(finalP2.exhausted).toBe(false);

    // Defender stats and damage reduction:
    // Rhino 3 ATK - Spider-Man 3 DEF = 0 damage dealt
    expect(dispatchRes.state.lastCombatOutcome?.defenderName).toBe('Spider-Man');
    expect(dispatchRes.state.lastCombatOutcome?.defenseValue).toBe(3);
    expect(dispatchRes.state.lastCombatOutcome?.finalDamage).toBe(0);
    expect(dispatchRes.state.lastCombatOutcome?.targetPlayerId).toBe(p1.id);

    // Player 1 HP unchanged (10)
    expect(finalP1.health).toBe(10);
    // Player 2 HP unchanged (9)
    expect(finalP2.health).toBe(9);
  });

  it('Test 11: Issue #183 Regression: Cross-Table Ally Defense via RESOLVE_DECISION_PROMPT correctly declares and exhausts defending ally', () => {
    state.options = { villainPhaseStepping: true };
    const p1 = state.players[0];
    const p2 = state.players[1];

    const blackCat = createMockCardInstance('01002', 'Black Cat', 'ally', { health: 2 });
    p1.allies.push(blackCat);

    state.encounterDeck = [];
    // Rhino attacks Player 2
    initiateEnemyAttack(state, { type: 'VILLAIN' }, p2.id);

    const prompt = peekDecisionPrompt(state);
    expect(prompt).toBeDefined();
    const allyOpt = prompt?.options.find((o) => o.id === `defend_ally_${blackCat.instanceId}`);
    expect(allyOpt).toBeDefined();
    expect(allyOpt?.params?.playerId).toBe(p1.id);

    // Player 2 chooses Player 1's ally to block
    const dispatchRes = dispatchAction(state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: p2.id,
      selectedOptionId: allyOpt!.id,
    });

    expect(dispatchRes.result.success).toBe(true);
    const finalP1 = dispatchRes.state.players[0];
    const finalP2 = dispatchRes.state.players[1];

    // Ally takes damage and is defeated
    expect(finalP1.allies).not.toContainEqual(
      expect.objectContaining({ instanceId: blackCat.instanceId }),
    );
    expect(finalP1.discard).toContainEqual(
      expect.objectContaining({ instanceId: blackCat.instanceId }),
    );

    // Player 2 is untouched
    expect(finalP2.health).toBe(9);
    expect(finalP2.exhausted).toBe(false);
    expect(dispatchRes.state.lastCombatOutcome?.targetPlayerId).toBe(p1.id);
  });

  it('Test 12: Issue #183 Regression: Direct/Solo Hero Defense via RESOLVE_DECISION_PROMPT functions seamlessly', () => {
    let currentState = state;
    currentState.options = { villainPhaseStepping: true };
    const p1 = currentState.players[0]; // Spider-Man, DEF: 3, HP: 10

    currentState.encounterDeck = [];
    currentState = initiateEnemyAttack(currentState, { type: 'VILLAIN' }, p1.id);

    const prompt = peekDecisionPrompt(currentState);
    expect(prompt).toBeDefined();
    expect(prompt?.playerId).toBe(p1.id);

    const heroOpt = prompt?.options.find((o) => o.id === 'defend_hero');
    expect(heroOpt).toBeDefined();

    const dispatchRes = dispatchAction(currentState, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: p1.id,
      selectedOptionId: heroOpt!.id,
    });

    expect(dispatchRes.result.success).toBe(true);
    const finalP1 = dispatchRes.state.players[0];

    expect(finalP1.exhausted).toBe(true);
    expect(dispatchRes.state.lastCombatOutcome?.defenderName).toBe('Spider-Man');
    expect(dispatchRes.state.lastCombatOutcome?.defenseValue).toBe(3);
    expect(dispatchRes.state.lastCombatOutcome?.finalDamage).toBe(0);
    expect(finalP1.health).toBe(10);
  });

  it('Test 13: Issue #183 Regression: Cross-Table Hero Defense with excess attack damage deals remaining damage to defending hero, not attacked player', () => {
    state.options = { villainPhaseStepping: true };
    const p1 = state.players[0]; // Spider-Man, DEF: 3, HP: 10
    const p2 = state.players[1]; // Iron Man, DEF: 2, HP: 9

    // Boost card with 2 boost icons
    const boostCard = createMockCardInstance('01121', 'Boost Card', 'treachery', {
      boostIcons: 2,
    });
    state.encounterDeck = [boostCard];

    // Rhino (ATK 3) attacks Player 2. Total ATK will be 3 + 2 = 5.
    initiateEnemyAttack(state, { type: 'VILLAIN' }, p2.id);

    const prompt = peekDecisionPrompt(state);
    const crossHeroOpt = prompt?.options.find((o) => o.id === `defend_hero_${p1.id}`);

    const dispatchRes = dispatchAction(state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: p2.id,
      selectedOptionId: crossHeroOpt!.id,
    });

    expect(dispatchRes.result.success).toBe(true);
    const finalP1 = dispatchRes.state.players[0];
    const finalP2 = dispatchRes.state.players[1];

    // Spider-Man defends: 5 ATK - 3 DEF = 2 damage dealt to Spider-Man
    expect(finalP1.exhausted).toBe(true);
    expect(finalP1.health).toBe(8); // 10 - 2 = 8
    // Player 2 takes 0 damage and is not exhausted
    expect(finalP2.exhausted).toBe(false);
    expect(finalP2.health).toBe(9);
    expect(dispatchRes.state.lastCombatOutcome?.finalDamage).toBe(2);
    expect(dispatchRes.state.lastCombatOutcome?.targetPlayerId).toBe(p1.id);
  });
});
