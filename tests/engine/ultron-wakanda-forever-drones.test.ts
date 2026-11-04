import { describe, it, expect } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { AlterEgoCard, CardInstance, GameState, HeroCard, getActiveVillain } from '@engine/models';
import { createCardInstance, setupGame } from '@engine/state/game-setup';
import { executeEffect } from '@engine/effects';
import { dispatchAction, peekDecisionPrompt } from '@engine/pipeline';
import { evaluatePlayRequirements } from '@engine/pipeline/legality-checker';

// Plan #352, scenario S8: Wakanda Forever! vs Drones, in a real Ultron game.

const WAKANDA_FOREVER = '01043a';
const ENERGY_DAGGERS = '01046';
const PANTHER_CLAWS = '01047';
const WEB_SHOOTER = '01008';
const SWINGING_WEB_KICK = '01005';
const FILLER = '01044'; // Vibranium, a basic resource

function ultronGame(): GameState {
  const state = setupGame({
    catalog: cardCatalog,
    scenarioId: 'ultron',
    difficulty: 'STANDARD',
    seed: 'ultron-wakanda',
    skipMulligan: true,
    players: [
      {
        id: 'p1',
        name: 'Black Panther',
        hero: cardCatalog.getCard('01040a') as HeroCard,
        alterEgo: cardCatalog.getCard('01040b') as AlterEgoCard,
        deckCards: Array(15).fill(cardCatalog.getCard(FILLER)!),
      },
      {
        id: 'p2',
        name: 'Spider-Man',
        hero: cardCatalog.getCard('01001a') as HeroCard,
        alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
        deckCards: Array(15).fill(cardCatalog.getCard(FILLER)!),
      },
    ],
  });
  const panther = state.players[0];
  panther.currentForm = 'hero';
  panther.activeFormCard = cardCatalog.getCard('01040a')!;
  // Only the Drones each scenario names
  panther.engagedMinions = [];
  state.players[1].engagedMinions = [];
  return state;
}

const instance = (code: string): CardInstance => createCardInstance(cardCatalog.getCard(code)!);

/** Puts these cards on top of the player's deck and turns them into Drones, in order. */
function dronesFrom(state: GameState, playerId: string, codes: string[]): CardInstance[] {
  const player = state.players.find((p) => p.id === playerId)!;
  player.deck.unshift(...codes.map(instance));
  executeEffect(
    state,
    {
      id: 'test_drones',
      timing: 'WHEN_REVEALED',
      steps: [
        {
          effect: 'EXECUTE_SPECIAL',
          effectParams: { specialId: 'ULTRON_DRONE', target: 'SELF', count: codes.length },
        },
      ],
    } as never,
    { playerId },
  );
  return player.engagedMinions.slice(-codes.length);
}

function playWakandaForever(state: GameState) {
  const wakanda = instance(WAKANDA_FOREVER);
  return executeEffect(state, wakanda.card.enrichment!.abilities![0], {
    playerId: 'p1',
    sourceCardInstance: wakanda,
  });
}

function answer(state: GameState, fields: Record<string, unknown>): GameState {
  const { state: next, result } = dispatchAction(state, {
    type: 'RESOLVE_DECISION_PROMPT',
    playerId: 'p1',
    ...fields,
  } as never);
  expect(result.success).toBe(true);
  return next;
}

function chooseDaggersPlayer(state: GameState, targetPlayerId: string): GameState {
  const option = peekDecisionPrompt(state)!.options.find(
    (o) => (o.params as { targetPlayerId?: string } | undefined)?.targetPlayerId === targetPlayerId,
  )!;
  return answer(state, { selectedOptionId: option.id });
}

const codesIn = (pile: CardInstance[]) => pile.map((c) => c.card.code);

describe('S8: Wakanda Forever! vs Drones', () => {
  it("S8: Panther Claws then Energy Daggers defeat both Drones and their real cards go to the owner's discard", () => {
    const state = ultronGame();
    const panther = state.players[0];
    const claws = instance(PANTHER_CLAWS);
    const daggers = instance(ENERGY_DAGGERS);
    panther.tableau = [claws, daggers];
    const [drone1, drone2] = dronesFrom(state, 'p2', [WEB_SHOOTER, SWINGING_WEB_KICK]);
    expect(drone1.cardsUnderneath![0].card.code).toBe(WEB_SHOOTER);
    const hp = getActiveVillain(state).health;
    const encounterDiscardBefore = state.encounterDiscard.length;
    const pantherDiscardBefore = panther.discard.length;

    // The player picks the order: Claws first, Daggers last (the final step, so double damage)
    const played = playWakandaForever(state);
    const ordered = answer(played.state, { sequenceOrder: [claws.instanceId, daggers.instanceId] });

    // Claws: 2 damage to Drone 1
    expect(peekDecisionPrompt(ordered)!.options.some((o) => o.id === drone1.instanceId)).toBe(true);
    const afterClaws = answer(ordered, { selectedOptionId: drone1.instanceId });
    const spideyAfterClaws = afterClaws.players[1];
    expect(spideyAfterClaws.engagedMinions.map((m) => m.instanceId)).toEqual([drone2.instanceId]);
    expect(codesIn(spideyAfterClaws.discard)).toEqual([WEB_SHOOTER]);

    // Daggers (final): 2 damage to Ultron and to each enemy engaged with Spider-Man
    const after = chooseDaggersPlayer(afterClaws, 'p2');
    expect(peekDecisionPrompt(after)).toBeUndefined();
    expect(getActiveVillain(after).health).toBe(hp - 2);
    const [pantherAfter, spideyAfter] = after.players;
    expect(spideyAfter.engagedMinions).toHaveLength(0);
    expect(codesIn(spideyAfter.discard)).toEqual([WEB_SHOOTER, SWINGING_WEB_KICK]);
    expect(pantherAfter.discard).toHaveLength(pantherDiscardBefore);
    expect(after.encounterDiscard).toHaveLength(encounterDiscardBefore);
  });

  it('S8-a: a Black Panther upgrade turned into a Drone is not resolved by Wakanda Forever and returns to discard when killed', () => {
    const state = ultronGame();
    const panther = state.players[0];
    const daggers = instance(ENERGY_DAGGERS);
    panther.tableau = [daggers];
    const [clawsDrone] = dronesFrom(state, 'p1', [PANTHER_CLAWS]);
    const hp = getActiveVillain(state).health;

    // One upgrade: no order prompt, it is the final step. Only Daggers asks a question (its player).
    const played = playWakandaForever(state);
    expect(peekDecisionPrompt(played.state)!.title).not.toContain('Sequence Order');
    const after = chooseDaggersPlayer(played.state, 'p1');

    expect(getActiveVillain(after).health).toBe(hp - 2);
    const pantherAfter = after.players[0];
    expect(pantherAfter.engagedMinions.some((m) => m.instanceId === clawsDrone.instanceId)).toBe(
      false,
    );
    // Panther Claws is back in the discard pile, not the tableau
    expect(codesIn(pantherAfter.discard)).toContain(PANTHER_CLAWS);
    expect(codesIn(pantherAfter.tableau)).not.toContain(PANTHER_CLAWS);
    expect(codesIn(pantherAfter.tableau)).toContain(ENERGY_DAGGERS);
  });

  it('S8-a: Wakanda Forever is unplayable when the only Black Panther upgrade is a facedown Drone', () => {
    const state = ultronGame();
    const panther = state.players[0];
    panther.tableau = [];
    dronesFrom(state, 'p1', [PANTHER_CLAWS]);

    const wakanda = cardCatalog.getCard(WAKANDA_FOREVER)!;

    expect(evaluatePlayRequirements(state, panther, wakanda).allowed).toBe(false);

    // Control: the same card in the tableau makes it playable
    panther.tableau = [instance(PANTHER_CLAWS)];
    expect(evaluatePlayRequirements(state, panther, wakanda).allowed).toBe(true);
  });
});
