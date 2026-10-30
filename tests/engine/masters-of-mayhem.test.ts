import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { createCardInstance } from '@engine/state/card-instance';
import { GamePhase, CardInstance, StatusCard } from '@engine/models';
import { newRhinoGame } from '../support/game-fixtures';
import { executeEffect } from '@engine/effects';
import { resolveDefenderDeclaration } from '@engine/pipeline/combat-pipeline';
import { peekDecisionPrompt } from '@engine/pipeline/prompt-queue';
import { dispatchAction } from '@engine/pipeline/action-dispatcher';

const MASTERS_OF_MAYHEM = '01133';
const MELTER = '01132';
const TIGER_SHARK = '01131';
const WHIRLWIND = '01130';
const RADIOACTIVE_MAN = '01129';

function createMinion(code: string): CardInstance {
  const card = cardCatalog.getCard(code);
  if (!card) throw new Error(`Card ${code} not found in catalog`);
  return createCardInstance(card);
}

function createTreachery(code: string): CardInstance {
  const card = cardCatalog.getCard(code);
  if (!card) throw new Error(`Card ${code} not found in catalog`);
  return createCardInstance(card);
}

describe('Masters of Mayhem (01133)', () => {
  let mayhemInst: CardInstance;

  beforeEach(() => {
    mayhemInst = createTreachery(MASTERS_OF_MAYHEM);
  });

  it('1 player (hero) with Masters of Evil minion engaged: minion attacks, fallback search skipped', () => {
    const state = newRhinoGame({
      players: [{ hero: '01001a', form: 'hero' }],
    });
    state.phase = GamePhase.PLAYER_PHASE;
    const player = state.players[0];
    const melter = createMinion(MELTER);
    player.engagedMinions.push(melter);

    // Deck has no boost cards; discard has a minion that could be searched if fallback triggered
    state.encounterDeck = [];
    state.encounterDiscard = [createMinion(TIGER_SHARK)];

    const ability = mayhemInst.card.enrichment!.abilities![0];
    const res = executeEffect(state, ability, {
      playerId: player.id,
      sourceCardInstance: mayhemInst,
    });

    expect(res.success).toBe(true);
    // An attack was initiated: prompt for defender declaration
    const prompt = peekDecisionPrompt(res.state);
    expect(prompt).toBeDefined();
    expect(prompt?.promptId).toMatch(/^prompt_defend_/);

    // Resolve undefended attack
    const hpBefore = player.health;
    const stateAfterCombat = resolveDefenderDeclaration(res.state, {
      type: 'UNDEFENDED',
      playerId: player.id,
    });

    // Melter has 2 ATK + 1 boost icon from Tiger Shark (exhaustion reshuffle) = 3 damage
    expect(stateAfterCombat.players[0].health).toBe(hpBefore - 3);

    // Fallback search did not trigger: Tiger Shark was used as boost card, not put into play engaged
    expect(stateAfterCombat.players[0].engagedMinions).toHaveLength(1);
    expect(stateAfterCombat.players[0].engagedMinions[0].card.code).toBe(MELTER);
  });

  it('1 player (alter-ego) with Masters of Evil minion engaged: no hero engaged, fallback search triggers', () => {
    const state = newRhinoGame({
      players: [{ hero: '01001a', form: 'alter-ego' }],
    });
    state.phase = GamePhase.PLAYER_PHASE;
    const player = state.players[0];
    const melter = createMinion(MELTER);
    player.engagedMinions.push(melter);

    const tigerShark = createMinion(TIGER_SHARK);
    state.encounterDeck = [tigerShark];
    state.encounterDiscard = [];

    const ability = mayhemInst.card.enrichment!.abilities![0];
    const res = executeEffect(state, ability, {
      playerId: player.id,
      sourceCardInstance: mayhemInst,
    });

    expect(res.success).toBe(true);
    // 0 attacks made (no hero to attack) -> fallback search triggered and put Tiger Shark into play
    expect(res.state.players[0].engagedMinions).toHaveLength(2);
    expect(res.state.players[0].engagedMinions.some((m) => m.card.code === TIGER_SHARK)).toBe(true);
    expect(res.state.encounterDeck.some((c) => c.card.code === TIGER_SHARK)).toBe(false);
  });

  it('1 player (hero) with stunned Masters of Evil minion: stun clears, attack cancelled, fallback search triggers', () => {
    const state = newRhinoGame({
      players: [{ hero: '01001a', form: 'hero' }],
    });
    state.phase = GamePhase.PLAYER_PHASE;
    const player = state.players[0];
    const melter = createMinion(MELTER);
    melter.statusCards = [StatusCard.STUNNED];
    player.engagedMinions.push(melter);

    const tigerShark = createMinion(TIGER_SHARK);
    state.encounterDeck = [tigerShark];
    state.encounterDiscard = [];

    const ability = mayhemInst.card.enrichment!.abilities![0];
    const res = executeEffect(state, ability, {
      playerId: player.id,
      sourceCardInstance: mayhemInst,
    });

    expect(res.success).toBe(true);
    // Stun was removed from Melter
    expect(melter.statusCards).toHaveLength(0);

    // 0 attacks were made -> fallback search triggered
    expect(res.state.players[0].engagedMinions).toHaveLength(2);
    expect(res.state.players[0].engagedMinions.some((m) => m.card.code === TIGER_SHARK)).toBe(true);
  });

  it('0 Masters of Evil minions in play: 0 attacks made, fallback search puts minion into play engaged', () => {
    const state = newRhinoGame({
      players: [{ hero: '01001a', form: 'hero' }],
    });
    state.phase = GamePhase.PLAYER_PHASE;
    const player = state.players[0];

    const whirlwind = createMinion(WHIRLWIND);
    state.encounterDeck = [whirlwind];
    state.encounterDiscard = [];

    const ability = mayhemInst.card.enrichment!.abilities![0];
    const res = executeEffect(state, ability, {
      playerId: player.id,
      sourceCardInstance: mayhemInst,
    });

    expect(res.success).toBe(true);
    expect(res.state.players[0].engagedMinions).toHaveLength(1);
    expect(res.state.players[0].engagedMinions[0].card.code).toBe(WHIRLWIND);
    expect(res.state.encounterDeck.some((c) => c.card.code === WHIRLWIND)).toBe(false);
  });

  it('Multiplayer (Hero & Alter-Ego): only Hero is attacked, attacksMade = 1, fallback search skipped', () => {
    const state = newRhinoGame({
      players: [
        { hero: '01001a', form: 'hero' },
        { hero: '01010a', form: 'alter-ego' },
      ],
    });
    state.phase = GamePhase.PLAYER_PHASE;
    const p1 = state.players[0];
    const p2 = state.players[1];

    const melter = createMinion(MELTER);
    p1.engagedMinions.push(melter);

    const radioactiveMan = createMinion(RADIOACTIVE_MAN);
    p2.engagedMinions.push(radioactiveMan);

    state.encounterDeck = [createMinion(TIGER_SHARK)];
    state.encounterDiscard = [];

    const ability = mayhemInst.card.enrichment!.abilities![0];
    const res = executeEffect(state, ability, { playerId: p1.id, sourceCardInstance: mayhemInst });

    expect(res.success).toBe(true);
    // P1's Melter attacked
    expect(peekDecisionPrompt(res.state)).toBeDefined();

    const stateAfterCombat = resolveDefenderDeclaration(res.state, {
      type: 'UNDEFENDED',
      playerId: p1.id,
    });

    // Fallback search was skipped (1 attack was made by Melter)
    expect(stateAfterCombat.players[0].engagedMinions).toHaveLength(1);
    expect(stateAfterCombat.players[1].engagedMinions).toHaveLength(1);
    expect(stateAfterCombat.encounterDeck.some((c) => c.card.code === TIGER_SHARK)).toBe(true);
  });

  it('Multiplayer (2 Heroes): sequential attacks resolve across heroes via pendingActivations', () => {
    const state = newRhinoGame({
      players: [
        { hero: '01001a', form: 'hero' },
        { hero: '01010a', form: 'hero' },
      ],
    });
    state.phase = GamePhase.PLAYER_PHASE;
    const p1 = state.players[0];
    const p2 = state.players[1];

    const melter = createMinion(MELTER);
    p1.engagedMinions.push(melter);

    const tigerShark = createMinion(TIGER_SHARK);
    p2.engagedMinions.push(tigerShark);

    state.encounterDeck = [];
    state.encounterDiscard = [createMinion(RADIOACTIVE_MAN)];

    const p1HpBefore = p1.health;
    const p2HpBefore = p2.health;

    const ability = mayhemInst.card.enrichment!.abilities![0];
    const res = executeEffect(state, ability, { playerId: p1.id, sourceCardInstance: mayhemInst });

    // Attack 1 against P1
    expect(peekDecisionPrompt(res.state)).toBeDefined();
    const afterP1Attack = resolveDefenderDeclaration(res.state, {
      type: 'UNDEFENDED',
      playerId: p1.id,
    });

    // Melter has 2 ATK + 1 boost from Radioactive Man = 3 damage
    expect(afterP1Attack.players[0].health).toBe(p1HpBefore - 3);

    // Attack 2 against P2 is now active
    expect(peekDecisionPrompt(afterP1Attack)).toBeDefined();
    const afterP2Attack = resolveDefenderDeclaration(afterP1Attack, {
      type: 'UNDEFENDED',
      playerId: p2.id,
    });

    // Tiger Shark has 3 ATK (no boost cards left) = 3 damage
    expect(afterP2Attack.players[1].health).toBe(p2HpBefore - 3);

    // Fallback search skipped: Radioactive Man was discarded as boost card, not engaged
    expect(afterP2Attack.players[0].engagedMinions).toHaveLength(1);
    expect(afterP2Attack.players[1].engagedMinions).toHaveLength(1);
  });

  it('Multiple Masters of Evil minions in search zones: presents modal prompt and player chooses', () => {
    const state = newRhinoGame({
      players: [{ hero: '01001a', form: 'hero' }],
    });
    state.phase = GamePhase.PLAYER_PHASE;
    const player = state.players[0];

    const melter = createMinion(MELTER);
    const tigerShark = createMinion(TIGER_SHARK);
    state.encounterDeck = [melter];
    state.encounterDiscard = [tigerShark];

    const ability = mayhemInst.card.enrichment!.abilities![0];
    const res = executeEffect(state, ability, {
      playerId: player.id,
      sourceCardInstance: mayhemInst,
    });

    // With 0 minions in play, fallback search triggers with 2 distinct candidates -> Decision prompt modal
    const prompt = peekDecisionPrompt(res.state);
    expect(prompt).toBeDefined();
    expect(prompt?.options).toHaveLength(2);
    expect(prompt?.options.some((o) => o.id === melter.instanceId)).toBe(true);
    expect(prompt?.options.some((o) => o.id === tigerShark.instanceId)).toBe(true);

    // Player chooses Tiger Shark
    const chosen = dispatchAction(res.state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: player.id,
      selectedOptionId: tigerShark.instanceId,
    });

    expect(chosen.state.players[0].engagedMinions).toHaveLength(1);
    expect(chosen.state.players[0].engagedMinions[0].card.code).toBe(TIGER_SHARK);
  });

  it('Cross-source search retention (Deck vs Discard): unselected cards remain in their original source zone', () => {
    const state = newRhinoGame({
      players: [{ hero: '01001a', form: 'hero' }],
    });
    state.phase = GamePhase.PLAYER_PHASE;
    const player = state.players[0];

    const melter = createMinion(MELTER);
    const tigerShark = createMinion(TIGER_SHARK);
    const otherDiscardCard = createMinion(WHIRLWIND);

    state.encounterDeck = [melter];
    state.encounterDiscard = [tigerShark, otherDiscardCard];

    const ability = mayhemInst.card.enrichment!.abilities![0];
    const res = executeEffect(state, ability, {
      playerId: player.id,
      sourceCardInstance: mayhemInst,
    });

    // Player chooses Tiger Shark from discard
    const chosen = dispatchAction(res.state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: player.id,
      selectedOptionId: tigerShark.instanceId,
    });

    // Tiger Shark is in play engaged with player
    expect(
      chosen.state.players[0].engagedMinions.some((m) => m.instanceId === tigerShark.instanceId),
    ).toBe(true);

    // Melter remains in encounter deck (not moved to discard)
    expect(chosen.state.encounterDeck.some((c) => c.instanceId === melter.instanceId)).toBe(true);

    // Whirlwind remains in encounter discard pile (not shuffled into deck)
    expect(
      chosen.state.encounterDiscard.some((c) => c.instanceId === otherDiscardCard.instanceId),
    ).toBe(true);
    expect(
      chosen.state.encounterDeck.some((c) => c.instanceId === otherDiscardCard.instanceId),
    ).toBe(false);
  });

  it('All Masters of Evil minions unavailable: gracefully logs NOTHING FOUND and completes', () => {
    const state = newRhinoGame({
      players: [{ hero: '01001a', form: 'hero' }],
    });
    state.phase = GamePhase.PLAYER_PHASE;
    const player = state.players[0];

    // All minions are either in other zones or dealt as facedown encounter cards
    const facedownCard = createMinion(MELTER);
    player.dealtEncounterCards = [facedownCard];
    state.encounterDeck = [];
    state.encounterDiscard = [];

    const ability = mayhemInst.card.enrichment!.abilities![0];
    const res = executeEffect(state, ability, {
      playerId: player.id,
      sourceCardInstance: mayhemInst,
    });

    expect(res.success).toBe(true);
    // Nothing put into play
    expect(res.state.players[0].engagedMinions).toHaveLength(0);
    // No prompts left open
    expect(peekDecisionPrompt(res.state)).toBeUndefined();
  });
});
