import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import {
  GameState,
  HeroCard,
  AlterEgoCard,
  StatusCard,
  getActiveVillain,
  AllyCard,
} from '@engine/models';
import { setupGame, createCardInstance, resetInstanceCounter } from '@engine/state/game-setup';
import {
  initiateEnemyAttack,
  resolveDefenderDeclaration,
  executeEnemyAttackSynchronously,
  peekDecisionPrompt,
  dispatchAction,
} from '@engine/pipeline';

const TIGER_SHARK = '01131'; // Boost: Give the villain a tough status card. (1 boost icon)
const WHIRLWIND = '01130'; // Boost: Deal 1 damage to each hero. (0 boost icons)
const CONCUSSIVE_BLAST = '01154'; // Boost: Deal 1 damage to each character you control. (1 boost icon)
const STANDARD_NON_STAR = '01107'; // Charge: 1 boost icon, no star

describe('Boost Effect Reveal Prompt & Combat Resumption (Issue #503)', () => {
  let state: GameState;

  const player = (id: string, hero: string, alterEgo: string) => ({
    id,
    name: id,
    hero: cardCatalog.getCard(hero) as HeroCard,
    alterEgo: cardCatalog.getCard(alterEgo) as AlterEgoCard,
    deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
  });

  const setup = (playerDefs?: { id: string; hero: string; alterEgo: string }[]) => {
    resetInstanceCounter();
    state = setupGame({
      catalog: cardCatalog,
      scenarioId: 'rhino',
      players: (playerDefs || [{ id: 'p1', hero: '01010a', alterEgo: '01010b' }]).map((p) =>
        player(p.id, p.hero, p.alterEgo),
      ),
      villain: cardCatalog.getCard('01094') as any, // Rhino I (ATK 2)
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
    for (const p of state.players) {
      p.currentForm = 'hero';
      p.activeFormCard = p.hero;
      p.hand = [];
    }
    state.encounterDeck = [];
    state.encounterDiscard = [];
    state.options = {
      ...state.options,
      villainPhaseStepping: true,
    };
  };

  beforeEach(() => {
    setup();
  });

  it('pauses and enqueues BOOST_ABILITY_REVEAL prompt before resolving a star boost ability', () => {
    const tigerShark = createCardInstance(cardCatalog.getCard(TIGER_SHARK)!, 'encounter');
    state.encounterDeck = [tigerShark];

    const s1 = initiateEnemyAttack(state, { type: 'VILLAIN' }, 'p1');
    const s2 = resolveDefenderDeclaration(s1, { type: 'UNDEFENDED', playerId: 'p1' });

    expect(s2.activeAttackContext?.phase).toBe('REVEAL_BOOST');
    const prompt = peekDecisionPrompt(s2);
    expect(prompt).toBeDefined();
    expect(prompt?.kind).toBe('BOOST_ABILITY_REVEAL');
    expect(prompt?.sourceCardCode).toBe(TIGER_SHARK);
    expect(prompt?.description).toContain('Give the villain a tough status card');

    // Crucial: Effect must NOT have resolved yet
    expect(getActiveVillain(s2).statusCards ?? []).not.toContain(StatusCard.TOUGH);
  });

  it('resolves the boost ability and completes the attack when the prompt is resolved', () => {
    const tigerShark = createCardInstance(cardCatalog.getCard(TIGER_SHARK)!, 'encounter');
    state.encounterDeck = [tigerShark];

    const initialHp = state.players[0].health;
    const s1 = initiateEnemyAttack(state, { type: 'VILLAIN' }, 'p1');
    const s2 = resolveDefenderDeclaration(s1, { type: 'UNDEFENDED', playerId: 'p1' });

    const prompt = peekDecisionPrompt(s2)!;
    const s3 = dispatchAction(s2, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: prompt.options[0].id,
    }).state;

    // Villain received Tough from the boost ability
    expect(getActiveVillain(s3).statusCards).toContain(StatusCard.TOUGH);

    // Damage resolved: Rhino (2) + Tiger Shark boost icon (0) = 2 damage
    expect(s3.players[0].health).toBe(initialHp - 2);

    // Prompt cleared and boost card moved to discard
    expect(peekDecisionPrompt(s3)).toBeUndefined();
    expect(s3.encounterDiscard.some((c) => c.card.code === TIGER_SHARK)).toBe(true);
  });

  it('prompts sequentially for multiple star boost cards in the same activation', () => {
    const tigerShark = createCardInstance(cardCatalog.getCard(TIGER_SHARK)!, 'encounter');
    const whirlwind = createCardInstance(cardCatalog.getCard(WHIRLWIND)!, 'encounter');
    // Top of encounter deck is Tiger Shark, then Whirlwind
    state.encounterDeck = [tigerShark, whirlwind];

    // Give villain 1 additional boost card so 2 are dealt
    getActiveVillain(state).card = { ...getActiveVillain(state).card, additionalBoostCards: 1 };

    const s1 = initiateEnemyAttack(state, { type: 'VILLAIN' }, 'p1', {
      acceptOptionalTriggers: false,
    });
    const s2 = resolveDefenderDeclaration(s1, { type: 'UNDEFENDED', playerId: 'p1' });

    // 1st pause: Tiger Shark
    const prompt1 = peekDecisionPrompt(s2);
    expect(prompt1?.kind).toBe('BOOST_ABILITY_REVEAL');
    expect(prompt1?.sourceCardCode).toBe(TIGER_SHARK);

    // Resolve 1st prompt
    const s3 = dispatchAction(s2, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: prompt1!.options[0].id,
    }).state;

    // 2nd pause: Whirlwind
    const prompt2 = peekDecisionPrompt(s3);
    expect(prompt2?.kind).toBe('BOOST_ABILITY_REVEAL');
    expect(prompt2?.sourceCardCode).toBe(WHIRLWIND);

    // Resolve 2nd prompt
    const s4 = dispatchAction(s3, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: prompt2!.options[0].id,
    }).state;

    // Both resolved: villain has Tough, Whirlwind dealt 1 damage to each hero, attack finished
    expect(getActiveVillain(s4).statusCards).toContain(StatusCard.TOUGH);
    expect(peekDecisionPrompt(s4)).toBeUndefined();
  });

  it('resolves non-star boost cards immediately without opening a prompt', () => {
    const nonStarCard = createCardInstance(cardCatalog.getCard(STANDARD_NON_STAR)!, 'encounter');
    state.encounterDeck = [nonStarCard];

    const initialHp = state.players[0].health;
    const s1 = initiateEnemyAttack(state, { type: 'VILLAIN' }, 'p1');
    const s2 = resolveDefenderDeclaration(s1, { type: 'UNDEFENDED', playerId: 'p1' });

    // Attack completed directly to Step 6 / 7 without pausing for boost prompt
    expect(peekDecisionPrompt(s2)).toBeUndefined();
    // Rhino (2) + Charge boost icons (2) = 4 damage
    expect(s2.players[0].health).toBe(initialHp - 4);
  });

  it('halts cleanly and does not execute Step 6 damage when boost damage is lethal in solo', () => {
    const whirlwind = createCardInstance(cardCatalog.getCard(WHIRLWIND)!, 'encounter');
    state.encounterDeck = [whirlwind];
    state.players[0].health = 1; // 1 HP left

    const s1 = initiateEnemyAttack(state, { type: 'VILLAIN' }, 'p1');
    const s2 = resolveDefenderDeclaration(s1, { type: 'UNDEFENDED', playerId: 'p1' });

    const prompt = peekDecisionPrompt(s2)!;
    expect(prompt?.kind).toBe('BOOST_ABILITY_REVEAL');

    const s3 = dispatchAction(s2, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: prompt.options[0].id,
    }).state;

    // Whirlwind dealt 1 damage -> HP reached 0 -> Game Over
    expect(s3.winner).toBe('VILLAIN');
    expect(s3.players).toHaveLength(0);
    expect(s3.eliminatedPlayers?.[0]?.health).toBe(0);
    // Step 6 Rhino attack damage (2) was not applied to an already dead hero
    expect(s3.activeAttackContext).toBeUndefined();
  });

  it('eliminates target player and cleanly terminates attack in multiplayer when boost damage is lethal', () => {
    setup([
      { id: 'p1', hero: '01010a', alterEgo: '01010b' },
      { id: 'p2', hero: '01029a', alterEgo: '01029b' },
    ]);
    const whirlwind = createCardInstance(cardCatalog.getCard(WHIRLWIND)!, 'encounter');
    state.encounterDeck = [whirlwind];
    state.players[0].health = 1; // P1 has 1 HP
    state.players[1].health = 10; // P2 has 10 HP

    const s1 = initiateEnemyAttack(state, { type: 'VILLAIN' }, 'p1');
    const s2 = resolveDefenderDeclaration(s1, { type: 'UNDEFENDED', playerId: 'p1' });

    const prompt = peekDecisionPrompt(s2)!;
    const s3 = dispatchAction(s2, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: prompt.options[0].id,
    }).state;

    // P1 eliminated
    expect(s3.players.some((p) => p.id === 'p1')).toBe(false);
    expect(s3.eliminatedPlayers?.some((p) => p.id === 'p1')).toBe(true);
    // P2 took 1 damage from Whirlwind boost (hero form) but survives
    expect(s3.players.find((p) => p.id === 'p2')?.health).toBe(9);
    // Attack against P1 terminated without error
    expect(s3.winner).toBeFalsy();
    expect(s3.activeAttackContext).toBeUndefined();
  });

  it('reverts attack to UNDEFENDED when boost damage defeats the defending ally', () => {
    const concussiveBlast = createCardInstance(cardCatalog.getCard(CONCUSSIVE_BLAST)!, 'encounter');
    state.encounterDeck = [concussiveBlast];

    // Give player an ally with 1 HP
    const allyCard = cardCatalog.getCard('01058')! as AllyCard; // Daredevil
    const ally = createCardInstance(allyCard);
    ally.tokens = { damage: (allyCard.health || 3) - 1 }; // 1 HP remaining
    state.players[0].allies.push(ally);

    const initialHeroHp = state.players[0].health;

    const s1 = initiateEnemyAttack(state, { type: 'VILLAIN' }, 'p1');
    const s2 = resolveDefenderDeclaration(s1, {
      type: 'ALLY',
      playerId: 'p1',
      allyInstanceId: ally.instanceId,
    });

    const prompt = peekDecisionPrompt(s2)!;
    const s3 = dispatchAction(s2, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: prompt.options[0].id,
    }).state;

    // Ally was defeated by Concussive Blast boost damage
    expect(s3.players[0].allies.some((a) => a.instanceId === ally.instanceId)).toBe(false);

    // Per RR v1.8 p. 226-228, attack reverted to UNDEFENDED, so hero took the attack damage!
    // Hero took: Concussive Blast boost (1) + Rhino ATK (2) + Concussive Blast boost icon (0) = 3 total
    expect(s3.players[0].health).toBe(initialHeroHp - 3);
  });

  it('executes synchronously to completion when synchronousPolicy is specified', () => {
    const tigerShark = createCardInstance(cardCatalog.getCard(TIGER_SHARK)!, 'encounter');
    state.encounterDeck = [tigerShark];

    const initialHp = state.players[0].health;
    const s1 = executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'TAKE_UNDEFENDED');

    // Finished completely without opening any prompt
    expect(peekDecisionPrompt(s1)).toBeUndefined();
    expect(getActiveVillain(s1).statusCards).toContain(StatusCard.TOUGH);
    expect(s1.players[0].health).toBe(initialHp - 2);
  });
});
