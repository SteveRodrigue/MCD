import { describe, expect, it } from 'vitest';
import {
  GamePhase,
  StatusCard,
  getActiveVillain,
  type CardInstance,
  type GameState,
} from '@engine/models';
import { createCardInstance } from '@engine/state/game-setup';
import { executeEnemyAttackSynchronously } from '@engine/pipeline';
import { applyDamageToTarget } from '@engine/pipeline/damage-pipeline';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { recordDispatchedTriggers } from '../helpers/kernel-spy';
import { overrideCard } from '../support/card-overrides';
import { newRhinoGame } from '../support/game-fixtures';

/**
 * #360 and #269: the damage of an enemy attack to an ally or an identity, Overkill included, goes
 * through applyDamageToTarget, so Tough, Piercing, damage shields and defeat behave as for every
 * other damage (RR v1.8 Damage, Overkill, Tough, Piercing).
 */

const CHARGE = '01099'; // +3 ATK, Overkill: Rhino attacks for 2 + 3 = 5
const BLACK_CAT = '01002'; // ally, 2 hit points
const ARMORED_SUIT = '01098'; // damage shield, absorbs up to 5
const HYDRA_MERCENARY = '01108'; // minion

const dispatched = recordDispatchedTriggers();

function inPlay(code: string): CardInstance {
  return createCardInstance(cardCatalog.getCard(code)!);
}

function logKeys(state: GameState): string[] {
  return state.log.map((l) => l.key);
}

/** Rhino with Charge attacks the only player, who has Black Cat in play. */
function overkillGame(seats = 1): GameState {
  const state = newRhinoGame({
    players: ['01001a', '01010a'].slice(0, seats).map((hero) => ({ hero, form: 'hero' as const })),
  });
  state.phase = GamePhase.PLAYER_PHASE;
  for (const player of state.players) player.hand = [];
  state.players[seats - 1].allies.push(inPlay(BLACK_CAT));
  getActiveVillain(state).attachments.push(inPlay(CHARGE));
  state.encounterDeck = [];
  return state;
}

function rhinoAttacksAlly(state: GameState, playerId = state.players[0].id): void {
  executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, playerId, 'ALLY_CHUMP_BLOCK');
}

/** Piercing, granted the way an attachment does (see adversarial-multiplayer-combat Scenario 6). */
function givePiercing(state: GameState): void {
  getActiveVillain(state).attachments.push({
    card: {
      code: 'att_piercing',
      name: 'Piercing Horns',
      type: 'attachment',
      enrichment: {
        abilities: [
          {
            timing: 'CONSTANT',
            steps: [{ effect: 'GRANT_KEYWORD', effectParams: { keyword: 'PIERCING' } }],
          },
        ],
      },
    },
  } as unknown as CardInstance);
}

describe('#360: Overkill excess on the controller of a defeated ally', () => {
  it('A: Tough on the identity prevents the whole excess and is discarded', () => {
    const state = overkillGame();
    const [player] = state.players;
    player.statusCards.push(StatusCard.TOUGH);
    const hitPoints = player.health;

    rhinoAttacksAlly(state);

    expect(player.allies).toHaveLength(0);
    expect(player.statusCards).not.toContain(StatusCard.TOUGH);
    expect(player.health).toBe(hitPoints);
    expect(logKeys(state)).toContain('damage.prevented.tough');
    expect(logKeys(state)).not.toContain('overkill.hit');
  });

  it('B: a damage shield on the identity absorbs the excess', () => {
    const state = overkillGame();
    const [player] = state.players;
    const shield = inPlay(ARMORED_SUIT);
    player.attachments = [shield];
    const hitPoints = player.health;

    rhinoAttacksAlly(state);

    expect(player.allies).toHaveLength(0);
    expect(player.health).toBe(hitPoints);
    expect(shield.tokens?.damage).toBe(3);
    expect(logKeys(state)).not.toContain('overkill.hit');
  });

  it('C: without protection the identity takes the excess and the log says how much', () => {
    const state = overkillGame();
    const [player] = state.players;
    const hitPoints = player.health;

    rhinoAttacksAlly(state);

    expect(player.health).toBe(hitPoints - 3);
    const entry = state.log.find((l) => l.key === 'overkill.hit');
    expect(entry?.params).toMatchObject({ amount: 3, target: player.name });
  });

  it('D: a lethal excess eliminates the player; both defeats are announced after both changes', () => {
    const state = overkillGame(2);
    const [a, b] = state.players;
    b.health = 1;
    const ally = b.allies[0];

    rhinoAttacksAlly(state, b.id);

    expect(state.players.map((p) => p.id)).toEqual([a.id]);
    const defeats = dispatched.filter((d) => d.trigger === 'DEFEATED');
    expect(defeats.map((d) => d.context.targetType)).toEqual(['ALLY', 'HERO']);
    expect(defeats.map((d) => d.context.targetInstanceId)).toEqual([ally.instanceId, b.id]);
  });

  it('E: a minion with Overkill defeats the ally; the defeat names that minion as the source', () => {
    const state = overkillGame();
    const [player] = state.players;
    getActiveVillain(state).attachments = [];
    const minion = inPlay(HYDRA_MERCENARY);
    player.engagedMinions.push(minion);
    overrideCard(state, minion.card, { keywords: ['Overkill'], attack: 5 });
    const hitPoints = player.health;

    executeEnemyAttackSynchronously(
      state,
      { type: 'MINION', card: minion },
      player.id,
      'ALLY_CHUMP_BLOCK',
    );

    expect(player.allies).toHaveLength(0);
    expect(player.health).toBe(hitPoints - 3);
    const defeat = dispatched.find(
      (d) => d.trigger === 'DEFEATED' && d.context.targetType === 'ALLY',
    );
    expect(defeat?.context.defeatSource).toEqual({
      kind: 'ENEMY',
      instanceId: minion.instanceId,
      byAttack: true,
    });
  });
});

describe('#269: enemy attack damage to an ally or an identity is the pipeline damage', () => {
  it('F: a damage shield on the defending ally absorbs the attack', () => {
    const state = overkillGame();
    const [player] = state.players;
    const ally = player.allies[0];
    const shield = inPlay(ARMORED_SUIT);
    ally.attachments = [shield];

    rhinoAttacksAlly(state);

    expect(player.allies).toHaveLength(1);
    expect(ally.tokens?.damage ?? 0).toBe(0);
    // 5 damage reach the shield's threshold of 5: it absorbed the attack and is discarded.
    expect(logKeys(state)).toContain('attachment.damageShield.broken');
    expect(state.encounterDiscard).toContain(shield);
  });

  it('G1: Piercing discards the Tough card of the identity and the damage goes through', () => {
    const state = overkillGame();
    const [player] = state.players;
    player.allies = [];
    getActiveVillain(state).attachments = [];
    givePiercing(state);
    player.statusCards.push(StatusCard.TOUGH);
    const hitPoints = player.health;

    executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, player.id, 'TAKE_UNDEFENDED');

    expect(player.statusCards).not.toContain(StatusCard.TOUGH);
    expect(player.health).toBe(hitPoints - 2);
    expect(logKeys(state)).toContain('damage.tough.pierced');
  });

  it('G2: Piercing discards the Tough card of the defending ally and the damage goes through', () => {
    const state = overkillGame();
    const [player] = state.players;
    getActiveVillain(state).attachments = [];
    givePiercing(state);
    const ally = player.allies[0];
    ally.statusCards = [StatusCard.TOUGH];

    rhinoAttacksAlly(state);

    expect(player.allies).toHaveLength(0);
    expect(logKeys(state)).toContain('damage.tough.pierced');
  });

  it('H: a hit on an undefended identity writes one hit entry, with the attack figures', () => {
    const state = overkillGame();
    const [player] = state.players;
    player.allies = [];
    getActiveVillain(state).attachments = [];
    const hitPoints = player.health;

    executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, player.id, 'TAKE_UNDEFENDED');

    const hits = state.log.filter((l) => l.key === 'villain.attack.hit');
    expect(hits).toHaveLength(1);
    expect(hits[0].params).toMatchObject({ damage: 2, remainingHp: hitPoints - 2 });
    expect(logKeys(state)).not.toContain('damage.applied.player');
  });

  it('I: the defeat of an identity by the villain names the villain as the source', () => {
    const state = overkillGame(2);
    const [, b] = state.players;
    b.allies = [];
    b.health = 1;
    getActiveVillain(state).attachments = [];

    executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, b.id, 'TAKE_UNDEFENDED');

    const defeat = dispatched.find(
      (d) => d.trigger === 'DEFEATED' && d.context.targetType === 'HERO',
    );
    expect(defeat?.context.defeatSource).toEqual({
      kind: 'ENEMY',
      instanceId: getActiveVillain(state).instanceId,
      byAttack: true,
    });
  });

  it('J: a defeated ally with a Victory keyword goes to the victory display', () => {
    const state = overkillGame();
    const [player] = state.players;
    getActiveVillain(state).attachments = [];
    const ally = player.allies[0];
    overrideCard(state, ally.card, { keywords: ['Victory 1'] });

    rhinoAttacksAlly(state);

    expect(player.allies).toHaveLength(0);
    expect(state.victoryDisplay.map((c) => c.instanceId)).toContain(ally.instanceId);
    expect(player.discard.map((c) => c.instanceId)).not.toContain(ally.instanceId);
  });
});

describe('applyDamageToTarget: Overkill from an ally to its controller', () => {
  function hitAlly(state: GameState, hasOverkill: boolean) {
    const [player] = state.players;
    const ally = player.allies[0];
    return applyDamageToTarget(state, {
      target: {
        type: 'ally',
        entity: ally,
        instanceId: ally.instanceId,
        name: ally.card.name,
        targetPlayerId: player.id,
        attachments: ally.attachments,
        statusCards: ally.statusCards,
      },
      amount: 5,
      sourceType: 'VILLAIN',
      isAttack: true,
      hasOverkill,
    });
  }

  it('sends the damage beyond the ally to its controller, with the OVERKILL source', () => {
    const state = overkillGame();
    const hitPoints = state.players[0].health;

    const { result } = hitAlly(state, true);

    expect(result.targetDefeated).toBe(true);
    expect(result.excessDamage).toBe(3);
    expect(state.players[0].health).toBe(hitPoints - 3);
  });

  it('sends nothing without Overkill', () => {
    const state = overkillGame();
    const hitPoints = state.players[0].health;

    hitAlly(state, false);

    expect(state.players[0].health).toBe(hitPoints);
  });
});
