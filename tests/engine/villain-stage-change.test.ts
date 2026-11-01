import { describe, it, expect } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import {
  GameState,
  GamePhase,
  HeroCard,
  AlterEgoCard,
  StatusCard,
  VillainCard,
  CardInstance,
  getActiveVillain,
} from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import {
  advanceVillainPhaseStep,
  initiateEnemyAttack,
  peekDecisionPrompt,
  resolveDefenderDeclaration,
} from '@engine/pipeline';
import { applyDamageToTarget } from '@engine/pipeline/damage-pipeline';
import { ScenarioRegistry, advanceVillainStage } from '@engine/scenarios';

/**
 * #303: a villain stage change (RR v1.8 glossary "Villain"). Same title: the new stage is the same
 * character, so attachments, status cards and counters carry over, damage does not, and an
 * activation in progress resumes with the new stage. Different title: nothing carries over and the
 * activation ends. Hit points come from the printed card (per player), never from scenario data.
 */

const RHINO_I = '01094';
const RHINO_II = '01095';
const RHINO_III = '01096';
const KLAW_I = '01113';
const ARMORED_RHINO_SUIT = '01098';
const CHARGE = '01099';
const ENHANCED_IVORY_HORN = '01100';
const BREAKIN_AND_TAKIN = '01107';
const COUNTER_PUNCH = '01077';
const FILLER = '01005';

const HEROES: Array<[string, string, string]> = [
  ['p1', '01001a', '01001b'],
  ['p2', '01010a', '01010b'],
  ['p3', '01040a', '01040b'],
];

function build(
  playerCount = 1,
  difficulty: 'STANDARD' | 'EXPERT' = 'STANDARD',
  scenarioId = 'rhino',
): GameState {
  const state = setupGame({
    catalog: cardCatalog,
    scenarioId,
    difficulty,
    players: HEROES.slice(0, playerCount).map(([id, hero, alterEgo]) => ({
      id,
      name: `Player ${id}`,
      hero: cardCatalog.getCard(hero) as HeroCard,
      alterEgo: cardCatalog.getCard(alterEgo) as AlterEgoCard,
      deckCards: Array(10).fill(cardCatalog.getCard(FILLER)!),
    })),
    villain: cardCatalog.getCard(RHINO_I) as VillainCard,
    mainScheme: cardCatalog.getCard('01097b') as any,
    encounterCards: cardCatalog.getCardsBySet('rhino'),
    skipMulligan: true,
  });
  state.phase = GamePhase.PLAYER_PHASE;
  for (const p of state.players) {
    p.currentForm = 'hero';
    p.activeFormCard = p.hero;
    p.hand = [];
    p.discard = [];
  }
  // Known, boost-free encounter deck: reveals and boosts read no shuffled cards.
  state.encounterDeck = [];
  state.encounterDiscard = [];
  return state;
}

const give = (code: string): CardInstance => createCardInstance(cardCatalog.getCard(code)!);

/** Defeats the active villain through the real damage pipeline (health is the hit points left). */
function defeatWithDamage(state: GameState, amount: number): GameState {
  const villain = getActiveVillain(state);
  return applyDamageToTarget(state, {
    target: {
      type: 'villain',
      entity: villain,
      instanceId: villain.instanceId,
      name: villain.card.name,
    },
    amount,
    sourceType: 'CARD_EFFECT',
    sourcePlayerId: 'p1',
  }).state;
}

describe('Villain stage change (#303)', () => {
  it('1. same title: attachments, status cards, counters and underneath cards carry over', () => {
    const state = build();
    const villain = getActiveVillain(state);
    const instanceId = villain.instanceId;
    const suit = give(ARMORED_RHINO_SUIT);
    const charge = give(CHARGE);
    const horn = give(ENHANCED_IVORY_HORN);
    horn.tokens = { damage: 0, threat: 0, counters: 2 };
    const tucked = give(FILLER);
    const facedown = give(FILLER);
    villain.attachments = [suit, charge, horn];
    villain.statusCards = [StatusCard.STUNNED];
    villain.cardsUnderneath = [tucked];
    villain.facedownBoostCards = [facedown];
    villain.exhausted = true;

    const after = defeatWithDamage(state, 14);

    expect(getActiveVillain(after).card.code).toBe(RHINO_II);
    expect(getActiveVillain(after).instanceId).toBe(instanceId);
    expect(getActiveVillain(after).attachments.map((a) => a.instanceId)).toEqual([
      suit.instanceId,
      charge.instanceId,
      horn.instanceId,
    ]);
    expect(getActiveVillain(after).attachments[2].tokens?.counters).toBe(2);
    expect(getActiveVillain(after).statusCards).toEqual([StatusCard.STUNNED]);
    expect(getActiveVillain(after).cardsUnderneath?.map((c) => c.instanceId)).toEqual([
      tucked.instanceId,
    ]);
    expect(getActiveVillain(after).facedownBoostCards?.map((c) => c.instanceId)).toEqual([
      facedown.instanceId,
    ]);
    expect(getActiveVillain(after).exhausted).toBe(true);
    expect(after.encounterDiscard.map((c) => c.instanceId)).not.toContain(suit.instanceId);
    expect(after.villains).toHaveLength(1);
    expect(after.activeVillainId).toBe(instanceId);
  });

  it('2. excess damage does not carry over: the new stage starts at full hit points', () => {
    const state = build();
    const after = defeatWithDamage(state, 40);
    expect(getActiveVillain(after).card.code).toBe(RHINO_II);
    expect(getActiveVillain(after).health).toBe(15);
    expect(getActiveVillain(after).maxHealth).toBe(15);
  });

  it.each([1, 2, 3])('3. hit points are the printed health x %i player(s)', (n) => {
    const state = build(n);
    expect(getActiveVillain(state).health).toBe(14 * n);
    const after = defeatWithDamage(state, 14 * n);
    expect(getActiveVillain(after).card.code).toBe(RHINO_II);
    expect(getActiveVillain(after).health).toBe(15 * n);
    expect(getActiveVillain(after).maxHealth).toBe(15 * n);
  });

  it('3b. after an elimination the starting player count still sets the hit points (#246)', () => {
    const state = build(2);
    state.eliminatedPlayers = state.players.splice(1, 1);
    const after = defeatWithDamage(state, 28);
    expect(getActiveVillain(after).card.code).toBe(RHINO_II);
    expect(getActiveVillain(after).health).toBe(30);
  });

  it('4a. defeated in the middle of an attack: the attack resumes with the new stage (ATK 3)', () => {
    const state = build();
    initiateEnemyAttack(state, { type: 'VILLAIN' }, 'p1', {});
    const attack = state.activeAttackContext!;
    expect(attack.baseAttack).toBe(2);
    const healthBefore = state.players[0].health;

    const after = defeatWithDamage(state, 14);
    expect(getActiveVillain(after).card.code).toBe(RHINO_II);
    expect(after.activeAttackContext?.attackerVillainId).toBe(getActiveVillain(after).instanceId);

    resolveDefenderDeclaration(after, { type: 'UNDEFENDED', playerId: 'p1' });
    expect(after.players[0].health).toBe(healthBefore - 3);
    expect(after.activeAttackContext).toBeUndefined();
  });

  it('4b. defeated by Counter-Punch while Rhino activates: the villain phase goes on', () => {
    const state = build();
    state.players[0].hand = [give(COUNTER_PUNCH)];
    getActiveVillain(state).health = 1;
    const instanceId = getActiveVillain(state).instanceId;
    const horn = give(ENHANCED_IVORY_HORN);
    getActiveVillain(state).attachments = [horn];

    let next = advanceVillainPhaseStep(state, { synchronousPolicy: 'HERO_IF_READY' });
    next = advanceVillainPhaseStep(next, { synchronousPolicy: 'HERO_IF_READY' });

    expect(getActiveVillain(next).card.code).toBe(RHINO_II);
    expect(getActiveVillain(next).instanceId).toBe(instanceId);
    expect(getActiveVillain(next).health).toBe(15);
    expect(getActiveVillain(next).attachments.map((a) => a.instanceId)).toEqual([horn.instanceId]);
    expect(next.activeAttackContext).toBeUndefined();
    expect(peekDecisionPrompt(next)).toBeUndefined();
    expect(next.villainPhaseStep).toBe('DEAL_ENCOUNTER_CARDS');
  });

  it('5. different title: nothing carries over and the activation in progress ends', () => {
    const state = build();
    const oldId = getActiveVillain(state).instanceId;
    const suit = give(ARMORED_RHINO_SUIT);
    const facedown = give(FILLER);
    getActiveVillain(state).attachments = [suit];
    getActiveVillain(state).statusCards = [StatusCard.CONFUSED];
    getActiveVillain(state).facedownBoostCards = [facedown];
    initiateEnemyAttack(state, { type: 'VILLAIN' }, 'p1', {});
    expect(state.activeAttackContext?.attackerVillainId).toBe(oldId);
    expect(peekDecisionPrompt(state)).toBeDefined();
    const healthBefore = state.players[0].health;

    advanceVillainStage(state, oldId!, KLAW_I);

    expect(getActiveVillain(state).card.code).toBe(KLAW_I);
    expect(getActiveVillain(state).instanceId).not.toBe(oldId);
    expect(state.activeVillainId).toBe(getActiveVillain(state).instanceId);
    expect(getActiveVillain(state).attachments).toEqual([]);
    expect(getActiveVillain(state).statusCards).toEqual([]);
    expect(getActiveVillain(state).facedownBoostCards ?? []).toEqual([]);
    expect(getActiveVillain(state).health).toBe(12);
    const discarded = state.encounterDiscard.map((c) => c.instanceId);
    expect(discarded).toContain(suit.instanceId);
    expect(discarded).toContain(facedown.instanceId);
    expect(state.activeAttackContext).toBeUndefined();
    expect(peekDecisionPrompt(state)).toBeUndefined();
    expect(state.players[0].health).toBe(healthBefore);
  });

  it("6a. Stage II When Revealed reveals Breakin' & Takin' from supplemental data", () => {
    const state = build(1);
    const scheme = give(BREAKIN_AND_TAKIN);
    state.encounterDeck = [give(FILLER), scheme, give(FILLER)];

    const after = defeatWithDamage(state, 14);

    expect(getActiveVillain(after).card.code).toBe(RHINO_II);
    const revealed = after.sideSchemes.find((s) => s.card.code === BREAKIN_AND_TAKIN);
    expect(revealed).toBeDefined();
    expect(revealed!.instanceId).toBe(scheme.instanceId);
    expect(revealed!.threat).toBe(3);
    expect(after.encounterDeck.map((c) => c.instanceId)).not.toContain(scheme.instanceId);
    expect(after.encounterDeck).toHaveLength(2);
  });

  it('6b. Stage III enters play tough and stuns each hero, without a second tough card', () => {
    const state = build(2, 'EXPERT');
    expect(getActiveVillain(state).card.code).toBe(RHINO_II);
    getActiveVillain(state).statusCards = [StatusCard.TOUGH];
    getActiveVillain(state).health = 0;

    ScenarioRegistry.get('rhino').onVillainDefeated(state, getActiveVillain(state).instanceId!);
    const after = state;

    expect(getActiveVillain(after).card.code).toBe(RHINO_III);
    expect(getActiveVillain(after).health).toBe(32);
    expect(getActiveVillain(after).statusCards.filter((s) => s === StatusCard.TOUGH)).toHaveLength(
      1,
    );
    for (const p of after.players) {
      expect(p.statusCards).toContain(StatusCard.STUNNED);
    }
  });

  it('6c. the plugin no longer re-implements the When Revealed text in code', () => {
    const rhino = ScenarioRegistry.get('rhino');
    expect('resolveStageIIWhenRevealed' in rhino).toBe(false);
    expect('resolveStageIIIWhenRevealed' in rhino).toBe(false);
  });

  it('7a. Klaw: the stage change goes through the same helper and keeps the attachments', () => {
    const plugin = ScenarioRegistry.get('klaw');
    const state = build(1, 'STANDARD', 'klaw');
    const klaw = getActiveVillain(state);
    expect(klaw.card.code).toBe(KLAW_I);
    const instanceId = klaw.instanceId;
    const charge = give(CHARGE);
    klaw.attachments = [charge];
    klaw.statusCards = [StatusCard.CONFUSED];
    state.encounterDeck = [give('01127')];

    const result = plugin.onVillainDefeated(state, instanceId!);

    expect(result.advancedStage).toBe(true);
    expect(getActiveVillain(state).card.code).toBe('01114');
    expect(getActiveVillain(state).instanceId).toBe(instanceId);
    expect(getActiveVillain(state).statusCards).toEqual([StatusCard.CONFUSED]);
    expect(getActiveVillain(state).attachments.map((a) => a.instanceId)).toContain(
      charge.instanceId,
    );
    expect(getActiveVillain(state).attachments.map((a) => a.card.code)).not.toContain('01127');
    expect(state.sideSchemes.some((s) => s.card.code === '01127')).toBe(true);
    // Printed 18 + 10 from The "Immortal" Klaw side scheme
    expect(getActiveVillain(state).health).toBe(28);
    expect(getActiveVillain(state).maxHealth).toBe(28);
  });

  it('7c. Klaw III enters with a tough status card from its printed Toughness, never two', () => {
    const plugin = ScenarioRegistry.get('klaw');
    const state = build(1, 'EXPERT', 'klaw');
    expect(getActiveVillain(state).card.code).toBe('01114');
    expect(getActiveVillain(state).statusCards).not.toContain(StatusCard.TOUGH);

    plugin.onVillainDefeated(state, getActiveVillain(state).instanceId!);

    expect(getActiveVillain(state).card.code).toBe('01115');
    expect(getActiveVillain(state).statusCards.filter((s) => s === StatusCard.TOUGH)).toHaveLength(
      1,
    );

    const carried = build(1, 'EXPERT', 'klaw');
    getActiveVillain(carried).statusCards = [StatusCard.TOUGH];

    plugin.onVillainDefeated(carried, getActiveVillain(carried).instanceId!);

    expect(getActiveVillain(carried).card.code).toBe('01115');
    expect(
      getActiveVillain(carried).statusCards.filter((s) => s === StatusCard.TOUGH),
    ).toHaveLength(1);
  });

  it('7b. Ultron: the stage change goes through the same helper and keeps the attachments', () => {
    const plugin = ScenarioRegistry.get('ultron');
    const state = build(1, 'STANDARD', 'ultron');
    const ultron = getActiveVillain(state);
    expect(ultron.card.code).toBe('01134');
    const instanceId = ultron.instanceId;
    const charge = give(CHARGE);
    ultron.attachments = [charge];
    ultron.statusCards = [StatusCard.CONFUSED];

    const result = plugin.onVillainDefeated(state, instanceId!);

    expect(result.advancedStage).toBe(true);
    expect(getActiveVillain(state).card.code).toBe('01135');
    expect(getActiveVillain(state).instanceId).toBe(instanceId);
    expect(getActiveVillain(state).statusCards).toEqual([StatusCard.CONFUSED]);
    expect(getActiveVillain(state).attachments.map((a) => a.instanceId)).toEqual([
      charge.instanceId,
    ]);
    expect(getActiveVillain(state).health).toBe(22);
  });
});
