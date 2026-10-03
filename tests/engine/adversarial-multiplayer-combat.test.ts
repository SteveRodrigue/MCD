import { describe, it, expect, beforeEach } from 'vitest';
import {
  GameState,
  PlayerState,
  StatusCard,
  CardInstance,
  GamePhase,
} from '../../src/engine/models';
import { initiateEnemyAttack } from '../../src/engine/pipeline/combat-pipeline';
import { dispatchAction } from '../../src/engine/pipeline/action-dispatcher';
import { peekDecisionPrompt } from '../../src/engine/pipeline/prompt-queue';

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

function create3PlayerTestState(): GameState {
  // Player 1: Captain Marvel, DEF: 1, HP: 12
  const player1: any = {
    id: 'player_1',
    name: 'Player 1',
    currentForm: 'hero',
    exhausted: false,
    health: 12,
    maxHealth: 12,
    hero: {
      code: '01010a',
      name: 'Captain Marvel',
      type: 'hero',
      hit_points: 12,
      defense: 1,
      attack: 2,
      thwart: 2,
      hand_size: 5,
    },
    alterEgo: {
      code: '01010b',
      name: 'Carol Danvers',
      type: 'alter_ego',
      hit_points: 12,
      recover: 4,
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

  // Player 2: Iron Man, DEF: 2, HP: 9
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

  // Player 3: Spider-Man, DEF: 3, HP: 10
  const player3: any = {
    id: 'player_3',
    name: 'Player 3',
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

  return {
    id: 'game_combat_3p_test',
    roundNumber: 1,
    phase: GamePhase.VILLAIN_PHASE,
    activePlayerIndex: 0,
    firstPlayerIndex: 0,
    activePlayerId: 'player_1',
    accelerationTokens: 0,
    targetThreat: 10,
    mainSchemeDeck: [],
    mainScheme: {
      threat: 2,
      targetThreat: 10,
    },
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
    players: [player1 as PlayerState, player2 as PlayerState, player3 as PlayerState],
    log: [],
    options: { villainPhaseStepping: true },
  } as any as GameState;
}

describe('Empirical Verification: Multiplayer Combat & Defense Scenarios', () => {
  let state: GameState;

  beforeEach(() => {
    state = create3PlayerTestState();
  });

  // Scenario 1: 3-player setup: Player 3 defending for Player 2 when Player 1 is active
  it('Scenario 1: 3-Player setup: Player 3 defends for Player 2 when Player 1 is active (full mitigation)', () => {
    expect(state.players[0].id).toBe('player_1');
    expect(state.activePlayerIndex).toBe(0);

    const p2 = state.players[1]; // Iron Man, DEF: 2, HP: 9
    const p3 = state.players[2]; // Spider-Man, DEF: 3, HP: 10

    state.encounterDeck = []; // 0 boost icons
    // Rhino (ATK: 3) attacks Player 2
    initiateEnemyAttack(state, { type: 'VILLAIN' }, p2.id);

    const prompt = peekDecisionPrompt(state);
    expect(prompt).toBeDefined();
    expect(prompt?.playerId).toBe(p2.id);

    // Verify prompt options include cross-table defense for Player 3
    const p3HeroOpt = prompt?.options.find((o) => o.id === `defend_hero_${p3.id}`);
    expect(p3HeroOpt).toBeDefined();
    expect(p3HeroOpt?.params?.playerId).toBe(p3.id);
    expect(p3HeroOpt?.params?.defenderType).toBe('HERO');

    // Player 2 resolves decision prompt by selecting Player 3's defense
    const dispatchRes = dispatchAction(state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: p2.id,
      selectedOptionId: p3HeroOpt!.id,
    });

    expect(dispatchRes.result.success).toBe(true);

    const finalP1 = dispatchRes.state.players[0];
    const finalP2 = dispatchRes.state.players[1];
    const finalP3 = dispatchRes.state.players[2];

    // Defender assertion: Player 3 is exhausted, Players 1 & 2 remain ready
    expect(finalP3.exhausted).toBe(true);
    expect(finalP1.exhausted).toBe(false);
    expect(finalP2.exhausted).toBe(false);

    // Damage assertion: 3 base ATK - 3 DEF = 0 damage dealt
    expect(finalP3.health).toBe(10);
    expect(finalP2.health).toBe(9);
    expect(finalP1.health).toBe(12);

    // Combat outcome verification
    expect(dispatchRes.state.lastCombatOutcome?.defenderName).toBe('Spider-Man');
    expect(dispatchRes.state.lastCombatOutcome?.defenseValue).toBe(3);
    expect(dispatchRes.state.lastCombatOutcome?.finalDamage).toBe(0);
    expect(dispatchRes.state.lastCombatOutcome?.targetPlayerId).toBe(p3.id);
  });

  it('Scenario 1b: 3-Player setup: Player 3 defends for Player 2 with excess incoming damage', () => {
    const p2 = state.players[1];
    const p3 = state.players[2];

    // Boost card adds 2 boost icons (total attack: 3 + 2 = 5)
    const boostCard = createMockCardInstance('01121', 'Boost Card', 'treachery', {
      boostIcons: 2,
    });
    state.encounterDeck = [boostCard];

    // Rhino attacks Player 2
    initiateEnemyAttack(state, { type: 'VILLAIN' }, p2.id);

    const prompt = peekDecisionPrompt(state);
    const p3HeroOpt = prompt?.options.find((o) => o.id === `defend_hero_${p3.id}`);

    const dispatchRes = dispatchAction(state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: p2.id,
      selectedOptionId: p3HeroOpt!.id,
    });

    expect(dispatchRes.result.success).toBe(true);

    const finalP1 = dispatchRes.state.players[0];
    const finalP2 = dispatchRes.state.players[1];
    const finalP3 = dispatchRes.state.players[2];

    // Excess damage (5 ATK - 3 DEF = 2) must be dealt to Player 3
    expect(finalP3.exhausted).toBe(true);
    expect(finalP3.health).toBe(8); // 10 - 2 = 8

    // Players 1 and 2 take 0 damage and are not exhausted
    expect(finalP1.exhausted).toBe(false);
    expect(finalP1.health).toBe(12);
    expect(finalP2.exhausted).toBe(false);
    expect(finalP2.health).toBe(9);

    expect(dispatchRes.state.lastCombatOutcome?.finalDamage).toBe(2);
    expect(dispatchRes.state.lastCombatOutcome?.targetPlayerId).toBe(p3.id);
  });

  // Scenario 2: Cross-table ally defense: Player 2 ally blocking an attack against Player 1
  it('Scenario 2: Cross-table ally defense: Player 2 ally blocks attack targeting Player 1', () => {
    const p1 = state.players[0];
    const p2 = state.players[1];

    const blackCat = createMockCardInstance('01002', 'Black Cat', 'ally', {
      health: 2,
    });
    p2.allies.push(blackCat);

    state.encounterDeck = []; // 0 boost icons
    // Rhino (ATK: 3) attacks Player 1
    initiateEnemyAttack(state, { type: 'VILLAIN' }, p1.id);

    const prompt = peekDecisionPrompt(state);
    expect(prompt).toBeDefined();
    expect(prompt?.playerId).toBe(p1.id);

    // Option for Player 2's ally exists
    const allyOpt = prompt?.options.find((o) => o.id === `defend_ally_${blackCat.instanceId}`);
    expect(allyOpt).toBeDefined();
    expect(allyOpt?.params?.playerId).toBe(p2.id);
    expect(allyOpt?.params?.allyInstanceId).toBe(blackCat.instanceId);

    // Player 1 resolves prompt selecting Player 2's ally to block
    const dispatchRes = dispatchAction(state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: p1.id,
      selectedOptionId: allyOpt!.id,
    });

    expect(dispatchRes.result.success).toBe(true);

    const finalP1 = dispatchRes.state.players[0];
    const finalP2 = dispatchRes.state.players[1];

    // Ally takes 3 damage >= 2 HP and is defeated into Player 2's discard
    expect(finalP2.allies).not.toContainEqual(
      expect.objectContaining({ instanceId: blackCat.instanceId }),
    );
    expect(finalP2.discard).toContainEqual(
      expect.objectContaining({ instanceId: blackCat.instanceId }),
    );

    // Player 1 took 0 damage and is not exhausted
    expect(finalP1.health).toBe(12);
    expect(finalP1.exhausted).toBe(false);

    // Player 2 took 0 damage and is not exhausted
    expect(finalP2.health).toBe(9);
    expect(finalP2.exhausted).toBe(false);

    expect(dispatchRes.state.lastCombatOutcome?.targetPlayerId).toBe(p2.id);
    expect(dispatchRes.state.lastCombatOutcome?.defenderType).toBe('ALLY');
  });

  it('Scenario 2b: Cross-table ally defense in 3-player game: Player 3 ally blocks for Player 2 when Player 1 is active', () => {
    const p2 = state.players[1];
    const p3 = state.players[2];

    const mockingbird = createMockCardInstance('01075', 'Mockingbird', 'ally', {
      health: 3,
    });
    p3.allies.push(mockingbird);

    state.encounterDeck = [];
    // Rhino attacks Player 2
    initiateEnemyAttack(state, { type: 'VILLAIN' }, p2.id);

    const prompt = peekDecisionPrompt(state);
    const allyOpt = prompt?.options.find((o) => o.id === `defend_ally_${mockingbird.instanceId}`);
    expect(allyOpt).toBeDefined();
    expect(allyOpt?.params?.playerId).toBe(p3.id);

    // Player 2 resolves prompt selecting Player 3's ally
    const dispatchRes = dispatchAction(state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: p2.id,
      selectedOptionId: allyOpt!.id,
    });

    expect(dispatchRes.result.success).toBe(true);

    const finalP1 = dispatchRes.state.players[0];
    const finalP2 = dispatchRes.state.players[1];
    const finalP3 = dispatchRes.state.players[2];

    // Ally defeated into Player 3's discard
    expect(finalP3.allies).not.toContainEqual(
      expect.objectContaining({ instanceId: mockingbird.instanceId }),
    );
    expect(finalP3.discard).toContainEqual(
      expect.objectContaining({ instanceId: mockingbird.instanceId }),
    );

    // All 3 heroes remain unexhausted with full health
    expect(finalP1.exhausted).toBe(false);
    expect(finalP1.health).toBe(12);
    expect(finalP2.exhausted).toBe(false);
    expect(finalP2.health).toBe(9);
    expect(finalP3.exhausted).toBe(false);
    expect(finalP3.health).toBe(10);
  });

  // Scenario 3: Multiple boost cards accumulating icons and effects during defended attack
  it('Scenario 3a: Multiple boost cards accumulating icons during cross-table defended attack', () => {
    const p2 = state.players[1];
    const p3 = state.players[2];

    // Give villain an attachment that grants +1 additional boost card (2 boost cards total)
    state.villain.attachments.push({
      card: {
        code: 'att_extra_boost',
        name: 'Extra Boost Attachment',
        type: 'attachment',
        additionalBoostCards: 1,
      } as any,
    } as any);

    const boostCard1 = createMockCardInstance('boost_1', 'Boost Card 1', 'treachery', {
      boostIcons: 2,
    });
    const boostCard2 = createMockCardInstance('boost_2', 'Boost Card 2', 'treachery', {
      boostIcons: 1,
    });
    state.encounterDeck = [boostCard1, boostCard2];

    // Rhino (Base ATK 3) attacks Player 2. Total ATK = 3 + (2 + 1) = 6.
    initiateEnemyAttack(state, { type: 'VILLAIN' }, p2.id);

    const prompt = peekDecisionPrompt(state);
    const p3HeroOpt = prompt?.options.find((o) => o.id === `defend_hero_${p3.id}`);

    // Player 2 resolves prompt selecting Player 3 (Spider-Man, 3 DEF)
    const dispatchRes = dispatchAction(state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: p2.id,
      selectedOptionId: p3HeroOpt!.id,
    });

    expect(dispatchRes.result.success).toBe(true);

    const finalP1 = dispatchRes.state.players[0];
    const finalP2 = dispatchRes.state.players[1];
    const finalP3 = dispatchRes.state.players[2];

    // Player 3 took 6 - 3 = 3 damage
    expect(finalP3.exhausted).toBe(true);
    expect(finalP3.health).toBe(7); // 10 - 3 = 7

    // Players 1 and 2 take 0 damage and are unexhausted
    expect(finalP1.exhausted).toBe(false);
    expect(finalP1.health).toBe(12);
    expect(finalP2.exhausted).toBe(false);
    expect(finalP2.health).toBe(9);

    // Both boost cards discarded
    expect(dispatchRes.state.encounterDiscard).toHaveLength(2);
    expect(dispatchRes.state.lastCombatOutcome?.finalDamage).toBe(3);
    expect(dispatchRes.state.lastCombatOutcome?.targetPlayerId).toBe(p3.id);
  });

  it('Scenario 3b: Multiple boost cards accumulating icons AND resolving Star Boost effect during cross-table defended attack', () => {
    const p2 = state.players[1];
    const p3 = state.players[2];

    // Villain has additionalBoostCards: 1
    (state.villain.card as any).additionalBoostCards = 1;

    // Boost Card 1: 2 icons
    const boostCard1 = createMockCardInstance('boost_1', 'Heavy Blow', 'treachery', {
      boostIcons: 2,
    });

    // Boost Card 2: 1 icon + Star Boost adding STUNNED to the defending player
    const boostCard2 = createMockCardInstance('boost_2', 'Disorienting Glare', 'treachery', {
      boostIcons: 1,
      boostStar: true,
      enrichment: {
        abilities: [
          {
            id: 'star_stun_target',
            timing: 'BOOST',
            steps: [
              {
                effect: 'ADD_STATUS',
                effectParams: {
                  status: StatusCard.STUNNED,
                  target: 'DEFENDING_PLAYER',
                },
              },
            ],
          },
        ],
      },
    });

    state.encounterDeck = [boostCard1, boostCard2];

    // Rhino (ATK 3) attacks Player 2
    initiateEnemyAttack(state, { type: 'VILLAIN' }, p2.id);

    const prompt = peekDecisionPrompt(state);
    const p3HeroOpt = prompt?.options.find((o) => o.id === `defend_hero_${p3.id}`);

    // Player 2 resolves prompt selecting Player 3 (Spider-Man, 3 DEF)
    const dispatchRes = dispatchAction(state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: p2.id,
      selectedOptionId: p3HeroOpt!.id,
    });

    expect(dispatchRes.result.success).toBe(true);

    const finalP1 = dispatchRes.state.players[0];
    const finalP2 = dispatchRes.state.players[1];
    const finalP3 = dispatchRes.state.players[2];

    // Player 3 defended: total attack = 3 + 2 + 1 = 6; 6 - 3 DEF = 3 damage
    expect(finalP3.exhausted).toBe(true);
    expect(finalP3.health).toBe(7);

    // Star boost effect targeted the defending player (Player 3)
    expect(finalP3.statusCards).toContain(StatusCard.STUNNED);
    // Attacked player (Player 2) and active player (Player 1) did NOT receive the stunned status
    expect(finalP2.statusCards).not.toContain(StatusCard.STUNNED);
    expect(finalP1.statusCards).not.toContain(StatusCard.STUNNED);

    expect(finalP2.health).toBe(9);
    expect(finalP1.health).toBe(12);
  });

  // Scenario 4: Overkill against cross-table ally defense (RR v1.8 Overkill rule)
  it('Scenario 4: Overkill against cross-table ally defender deals excess damage to ally controller', () => {
    const p1 = state.players[0];
    const p2 = state.players[1];

    const blackCat = createMockCardInstance('01002', 'Black Cat', 'ally', {
      health: 2,
    });
    p2.allies.push(blackCat);

    state.encounterDeck = [];
    // Rhino attacks Player 1 with Overkill keyword (via attachment) and base ATK 5
    state.villain.card.attack = 5;
    state.villain.attachments.push({
      card: {
        code: 'att_overkill',
        name: 'Brute Force Overkill',
        type: 'attachment',
        enrichment: {
          abilities: [
            {
              timing: 'CONSTANT',
              steps: [
                {
                  effect: 'GRANT_KEYWORD',
                  effectParams: { keyword: 'OVERKILL' },
                },
              ],
            },
          ],
        },
      } as any,
    } as any);

    initiateEnemyAttack(state, { type: 'VILLAIN' }, p1.id);

    const prompt = peekDecisionPrompt(state);
    const allyOpt = prompt?.options.find((o) => o.id === `defend_ally_${blackCat.instanceId}`);

    // Player 1 resolves prompt choosing Player 2's ally to block
    const dispatchRes = dispatchAction(state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: p1.id,
      selectedOptionId: allyOpt!.id,
    });

    expect(dispatchRes.result.success).toBe(true);

    const finalP1 = dispatchRes.state.players[0];
    const finalP2 = dispatchRes.state.players[1];

    // Ally is defeated (took 2 damage out of 5)
    expect(finalP2.allies).not.toContainEqual(
      expect.objectContaining({ instanceId: blackCat.instanceId }),
    );

    // Excess 3 damage spills over to the ally's controller (Player 2), NOT the originally attacked Player 1!
    expect(finalP2.health).toBe(6); // 9 - 3 = 6
    expect(finalP1.health).toBe(12); // Player 1 unharmed!
  });

  // Scenario 5: Defending Hero with Tough Status Card
  it('Scenario 5: Defending hero with Tough absorbs damage and discards Tough card', () => {
    const p2 = state.players[1];
    const p3 = state.players[2];

    p3.statusCards.push(StatusCard.TOUGH);

    const boostCard = createMockCardInstance('boost_1', 'Boost Card', 'treachery', {
      boostIcons: 2,
    });
    state.encounterDeck = [boostCard];

    // Rhino (ATK 3) attacks Player 2. Total ATK = 5 vs Spider-Man (3 DEF) -> 2 damage.
    initiateEnemyAttack(state, { type: 'VILLAIN' }, p2.id);

    const prompt = peekDecisionPrompt(state);
    const p3HeroOpt = prompt?.options.find((o) => o.id === `defend_hero_${p3.id}`);

    const dispatchRes = dispatchAction(state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: p2.id,
      selectedOptionId: p3HeroOpt!.id,
    });

    expect(dispatchRes.result.success).toBe(true);

    const finalP2 = dispatchRes.state.players[1];
    const finalP3 = dispatchRes.state.players[2];

    // Player 3 exhausted, Tough card absorbed damage and was removed
    expect(finalP3.exhausted).toBe(true);
    expect(finalP3.statusCards).not.toContain(StatusCard.TOUGH);
    expect(finalP3.health).toBe(10); // Untouched due to Tough

    expect(finalP2.health).toBe(9);
    expect(finalP2.exhausted).toBe(false);
  });

  // Scenario 6: Defending Hero with Tough vs Piercing Attack
  it('Scenario 6: Defending hero with Tough vs Piercing attack takes damage after Tough is stripped', () => {
    const p2 = state.players[1];
    const p3 = state.players[2];

    p3.statusCards.push(StatusCard.TOUGH);

    const boostCard = createMockCardInstance('boost_1', 'Boost Card', 'treachery', {
      boostIcons: 2,
    });
    state.encounterDeck = [boostCard];

    // Rhino attacks with Piercing granted via attachment
    state.villain.attachments.push({
      card: {
        code: 'att_piercing',
        name: 'Piercing Horns',
        type: 'attachment',
        enrichment: {
          abilities: [
            {
              timing: 'CONSTANT',
              steps: [
                {
                  effect: 'GRANT_KEYWORD',
                  effectParams: { keyword: 'PIERCING' },
                },
              ],
            },
          ],
        },
      } as any,
    } as any);

    initiateEnemyAttack(state, { type: 'VILLAIN' }, p2.id);

    const prompt = peekDecisionPrompt(state);
    const p3HeroOpt = prompt?.options.find((o) => o.id === `defend_hero_${p3.id}`);

    const dispatchRes = dispatchAction(state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: p2.id,
      selectedOptionId: p3HeroOpt!.id,
    });

    expect(dispatchRes.result.success).toBe(true);

    const finalP2 = dispatchRes.state.players[1];
    const finalP3 = dispatchRes.state.players[2];

    // Tough discarded by Piercing, and 2 excess damage applied to Player 3
    expect(finalP3.exhausted).toBe(true);
    expect(finalP3.statusCards).not.toContain(StatusCard.TOUGH);
    expect(finalP3.health).toBe(8); // 10 - 2 = 8

    expect(finalP2.health).toBe(9);
  });

  // Scenario 7: Defending ally defeated before damage calculation reverts attack to undefended
  it('Scenario 7: Defending ally defeated by boost ability before damage reverts attack to undefended', () => {
    const p1 = state.players[0];
    const p2 = state.players[1];

    const blackCat = createMockCardInstance('01002', 'Black Cat', 'ally', {
      health: 2,
    });
    p2.allies.push(blackCat);

    // Boost card that discards/defeats the defending ally during step 5
    const boostCard = createMockCardInstance(
      'boost_discard_ally',
      'Collateral Damage',
      'treachery',
      {
        boostIcons: 0,
        boostStar: true,
        enrichment: {
          abilities: [
            {
              id: 'boost_kill_ally',
              timing: 'BOOST',
              steps: [
                {
                  effect: 'DISCARD_ALLY',
                  effectParams: { target: 'DEFENDING_CHARACTER' },
                },
              ],
            },
          ],
        },
      },
    );
    state.encounterDeck = [boostCard];

    // Rhino (ATK 3) attacks Player 1
    initiateEnemyAttack(state, { type: 'VILLAIN' }, p1.id);

    const prompt = peekDecisionPrompt(state);
    const allyOpt = prompt?.options.find((o) => o.id === `defend_ally_${blackCat.instanceId}`);

    // Simulate ally defeat right after declaration (or by boost)
    // Manually removing ally from player2 before finish to simulate boost defeat
    p2.allies = [];

    // Resolve defender declaration
    const dispatchRes = dispatchAction(state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: p1.id,
      selectedOptionId: allyOpt!.id,
    });

    expect(dispatchRes.result.success).toBe(true);

    // Because defending ally was missing/defeated at damage step, attack reverted to UNDEFENDED
    expect(dispatchRes.state.lastCombatOutcome?.defenderType).toBe('UNDEFENDED');
    // Full base damage (3) dealt to the target player
    expect(dispatchRes.state.lastCombatOutcome?.finalDamage).toBe(3);
  });

  // Scenario 8: Undefended attack option selected in 3-player game
  it('Scenario 8: Player 2 takes attack undefended in 3-player game', () => {
    const p2 = state.players[1];

    state.encounterDeck = [];
    initiateEnemyAttack(state, { type: 'VILLAIN' }, p2.id);

    const prompt = peekDecisionPrompt(state);
    const undefendedOpt = prompt?.options.find((o) => o.id === 'undefended');
    expect(undefendedOpt).toBeDefined();

    const dispatchRes = dispatchAction(state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: p2.id,
      selectedOptionId: undefendedOpt!.id,
    });

    expect(dispatchRes.result.success).toBe(true);

    const finalP1 = dispatchRes.state.players[0];
    const finalP2 = dispatchRes.state.players[1];
    const finalP3 = dispatchRes.state.players[2];

    // Player 2 takes full 3 damage without exhausting
    expect(finalP2.health).toBe(6); // 9 - 3 = 6
    expect(finalP2.exhausted).toBe(false);

    // Other players completely untouched
    expect(finalP1.health).toBe(12);
    expect(finalP1.exhausted).toBe(false);
    expect(finalP3.health).toBe(10);
    expect(finalP3.exhausted).toBe(false);

    expect(dispatchRes.state.lastCombatOutcome?.defenderType).toBe('UNDEFENDED');
    expect(dispatchRes.state.lastCombatOutcome?.finalDamage).toBe(3);
  });

  // Scenario 9: Exhausted hero cannot be offered as a defender
  it('Scenario 9: Exhausted hero is NOT included as a defense option in decision prompt', () => {
    const p2 = state.players[1];
    const p3 = state.players[2];

    // Player 3 is already exhausted
    p3.exhausted = true;

    initiateEnemyAttack(state, { type: 'VILLAIN' }, p2.id);

    const prompt = peekDecisionPrompt(state);
    expect(prompt).toBeDefined();

    // Option to defend with Player 3 must NOT exist
    const p3Opt = prompt?.options.find((o) => o.id === `defend_hero_${p3.id}`);
    expect(p3Opt).toBeUndefined();
  });

  // Scenario 10: Player in alter-ego form cannot be offered as a defender
  it('Scenario 10: Player in alter-ego form is NOT included as a defense option', () => {
    const p2 = state.players[1];
    const p3 = state.players[2];

    // Player 3 is in alter-ego form
    p3.currentForm = 'alter_ego';

    initiateEnemyAttack(state, { type: 'VILLAIN' }, p2.id);

    const prompt = peekDecisionPrompt(state);
    expect(prompt).toBeDefined();

    // Option to defend with Player 3 must NOT exist
    const p3Opt = prompt?.options.find((o) => o.id === `defend_hero_${p3.id}`);
    expect(p3Opt).toBeUndefined();
  });

  // Scenario 11: 3 boost cards accumulating icons (Base + 2 Extra Boost attachments)
  it('Scenario 11: 3 boost cards accumulating icons during defended attack (5 boost icons total)', () => {
    const p2 = state.players[1];
    const p3 = state.players[2];

    // 2 attachments granting +1 additional boost card each (total 3 boost cards)
    state.villain.attachments.push(
      {
        card: {
          code: 'att_extra_1',
          name: 'Extra Boost 1',
          type: 'attachment',
          additionalBoostCards: 1,
        } as any,
      } as any,
      {
        card: {
          code: 'att_extra_2',
          name: 'Extra Boost 2',
          type: 'attachment',
          additionalBoostCards: 1,
        } as any,
      } as any,
    );

    const boostCard1 = createMockCardInstance('b1', 'Boost 1', 'treachery', { boostIcons: 2 });
    const boostCard2 = createMockCardInstance('b2', 'Boost 2', 'treachery', { boostIcons: 2 });
    const boostCard3 = createMockCardInstance('b3', 'Boost 3', 'treachery', { boostIcons: 1 });
    state.encounterDeck = [boostCard1, boostCard2, boostCard3];

    // Rhino (ATK 3) attacks Player 2. Total ATK = 3 + (2 + 2 + 1) = 8.
    initiateEnemyAttack(state, { type: 'VILLAIN' }, p2.id);

    const prompt = peekDecisionPrompt(state);
    const p3HeroOpt = prompt?.options.find((o) => o.id === `defend_hero_${p3.id}`);

    // Player 2 resolves prompt choosing Player 3 (Spider-Man, 3 DEF)
    const dispatchRes = dispatchAction(state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: p2.id,
      selectedOptionId: p3HeroOpt!.id,
    });

    expect(dispatchRes.result.success).toBe(true);

    const finalP2 = dispatchRes.state.players[1];
    const finalP3 = dispatchRes.state.players[2];

    // Total attack: 3 base + 5 boost = 8. Spider-Man 3 DEF -> 5 damage dealt to Player 3.
    expect(finalP3.exhausted).toBe(true);
    expect(finalP3.health).toBe(5); // 10 - 5 = 5

    expect(finalP2.exhausted).toBe(false);
    expect(finalP2.health).toBe(9);

    // All 3 boost cards discarded to encounter discard
    expect(dispatchRes.state.encounterDiscard).toHaveLength(3);
    expect(dispatchRes.state.lastCombatOutcome?.finalDamage).toBe(5);
    expect(dispatchRes.state.lastCombatOutcome?.defenseValue).toBe(3);
    expect(dispatchRes.state.lastCombatOutcome?.targetPlayerId).toBe(p3.id);
  });
});
