import {
  GameState,
  StatusCard,
  CardInstance,
  PlayerState,
  VillainState,
  MinionCard,
  AllyCard,
  CardAbility,
  getActiveVillain,
} from '@engine/models';
import { getEffectiveMinionHitPoints, getEffectiveRetaliate } from './stat-calculator';
import { handleVillainDefeat } from './scenario-helpers';
import { eliminatePlayer } from './player-elimination';
import { dispatchTrigger, type DefeatSource } from '../triggers/trigger-dispatcher';
import type { TriggerCallNode } from '../errors/infinite-loop-error';
import { moveDefeatedCardToPile, isEncounterCard, processHostDefeated } from '../effects';

export type { DefeatSource };

export type DamageTargetType = 'villain' | 'minion' | 'player' | 'ally';

export interface TargetEntityRef {
  type: DamageTargetType;
  entity: VillainState | MinionCard | PlayerState | CardInstance;
  instanceId?: string;
  name: string;
  targetPlayerId?: string; // Player controlling/engaged with target (for minion, player, ally)
  attachments?: CardInstance[];
  statusCards?: StatusCard[];
}

export interface DamageRequest {
  target: TargetEntityRef;
  amount: number;
  sourceType?: 'HERO' | 'ALLY' | 'VILLAIN' | 'MINION' | 'CARD_EFFECT' | 'RETALIATE' | 'OVERKILL';
  sourceCardInstance?: CardInstance;
  sourcePlayerId?: string;
  isAttack?: boolean;
  hasPiercing?: boolean;
  hasOverkill?: boolean;
  skipRetaliate?: boolean;
  /**
   * Opens the DAMAGE_TAKEN window on a player target, after Tough and the damage shields, so an
   * interrupt can lower the damage. Used by ability damage to a hero (identity, all heroes).
   */
  dispatchDamageTaken?: boolean;
  triggerChain?: TriggerCallNode[];
}

/**
 * Defeats every engaged minion whose damage reached its hit points. A lost hit point bonus (the
 * attachment leaves play) lowers only the ceiling; the damage stays (RR v1.8 hit points).
 */
export function defeatMinionsBeyondHitPoints(state: GameState): void {
  for (const player of state.players) {
    for (const minion of [...player.engagedMinions]) {
      if ((minion.tokens?.damage || 0) < getEffectiveMinionHitPoints(state, minion)) continue;
      const idx = player.engagedMinions.findIndex((m) => m.instanceId === minion.instanceId);
      if (idx === -1) continue;
      player.engagedMinions.splice(idx, 1);
      processHostDefeated(state, minion);
      dispatchDefeat(state, {
        targetPlayerId: player.id,
        targetInstanceId: minion.instanceId,
        targetType: 'MINION',
        defeatSource: { kind: 'EFFECT', byAttack: false },
      });
      moveDefeatedCardToPile(state, minion, state.encounterDiscard);
    }
  }
}

export interface ShieldAbsorptionInfo {
  shieldCard: CardInstance;
  damageAbsorbed: number;
  totalDamageOnShield: number;
  threshold: number;
  discarded: boolean;
}

export interface DamageResult {
  initialAmount: number;
  damageDealt: number; // Damage after Step 1 ("would be dealt")
  damageTaken: number; // Final damage applied to health dial / tokens after Steps 2-4
  toughRemoved: boolean;
  absorbedByShield?: ShieldAbsorptionInfo;
  targetDefeated: boolean;
  /** Damage beyond the target's remaining hit points when it was defeated, else 0. */
  excessDamage: number;
  retaliateDamageDealt?: number;
  onomatopoeia?: string;
}

export interface DefeatDispatch {
  targetPlayerId: string;
  targetInstanceId: string;
  entityType?: 'CHARACTER' | 'SCHEME';
  targetType?: 'VILLAIN' | 'MINION' | 'ALLY' | 'PLAYER' | 'HERO' | 'SCHEME';
  defeatSource?: DefeatSource;
}

/**
 * The one place a defeat is announced (#247): DEFEATED, then CHARACTER_DEFEATED (or
 * SCHEME_DEFEATED for a scheme), both carrying the defeat source when the caller knows it.
 */
export function dispatchDefeat(state: GameState, defeat: DefeatDispatch): void {
  const entityType = defeat.entityType ?? 'CHARACTER';
  const context = {
    targetPlayerId: defeat.targetPlayerId,
    sourceInstanceId: defeat.targetInstanceId,
    targetInstanceId: defeat.targetInstanceId,
    entityType,
    targetType: defeat.targetType,
    ...(defeat.defeatSource ? { defeatSource: defeat.defeatSource } : {}),
  };
  dispatchTrigger(state, 'DEFEATED', context);
  dispatchTrigger(
    state,
    entityType === 'CHARACTER' ? 'CHARACTER_DEFEATED' : 'SCHEME_DEFEATED',
    context,
  );
}

function defeatSourceOf(request: DamageRequest): DefeatSource {
  const kind: DefeatSource['kind'] =
    request.sourceType === 'HERO'
      ? 'HERO'
      : request.sourceType === 'ALLY'
        ? 'ALLY'
        : request.sourceType === 'VILLAIN' || request.sourceType === 'MINION'
          ? 'ENEMY'
          : 'EFFECT';
  return {
    kind,
    ...(request.sourcePlayerId ? { playerId: request.sourcePlayerId } : {}),
    ...(request.sourceCardInstance ? { instanceId: request.sourceCardInstance.instanceId } : {}),
    byAttack: Boolean(request.isAttack),
  };
}

/**
 * Checks and resolves damage shields attached to a host entity.
 * Supports Step 1 (WOULD_BE_DEALT) and Step 3 (WOULD_BE_TAKEN).
 */
function resolveDamageShieldForHost(
  state: GameState,
  hostAttachments: CardInstance[] | undefined,
  damageAmount: number,
  hostName: string,
  stepTiming: 'DAMAGE_WOULD_BE_DEALT' | 'DAMAGE_WOULD_BE_TAKEN',
): { remainingDamage: number; shieldAbsorption?: ShieldAbsorptionInfo } {
  if (!hostAttachments || hostAttachments.length === 0 || damageAmount <= 0) {
    return { remainingDamage: damageAmount };
  }

  const shieldIndex = hostAttachments.findIndex((att) => {
    const abilities: CardAbility[] = att.card.enrichment?.abilities || [];
    return abilities.some((a) => {
      // If timing is specified on ability (e.g. DAMAGE_WOULD_BE_TAKEN vs DAMAGE_WOULD_BE_DEALT)
      if (a.trigger && a.trigger !== stepTiming && a.trigger !== 'DAMAGE_WOULD_BE_TAKEN') {
        return false;
      }
      return a.steps?.some((s) => s.effect === 'ATTACHMENT_DAMAGE_SHIELD');
    });
  });

  if (shieldIndex === -1) {
    return { remainingDamage: damageAmount };
  }

  const shieldCard = hostAttachments[shieldIndex];
  const ability = (shieldCard.card.enrichment?.abilities || []).find((a) =>
    a.steps?.some((s) => s.effect === 'ATTACHMENT_DAMAGE_SHIELD'),
  );
  const step = ability?.steps?.find((s) => s.effect === 'ATTACHMENT_DAMAGE_SHIELD');
  const threshold = step?.effectParams?.maxAbsorb;
  if (typeof threshold !== 'number') {
    throw new Error(
      `ATTACHMENT_DAMAGE_SHIELD on ${shieldCard.card.code} needs a numeric effectParams.maxAbsorb`,
    );
  }

  if (!shieldCard.tokens) {
    shieldCard.tokens = {};
  }
  const currentDamageOnShield = shieldCard.tokens.damage || 0;
  const newDamageOnShield = currentDamageOnShield + damageAmount;
  shieldCard.tokens.damage = newDamageOnShield;

  let discarded = false;
  if (newDamageOnShield >= threshold) {
    discarded = true;
    hostAttachments.splice(shieldIndex, 1);
    if (isEncounterCard(shieldCard.card)) {
      moveDefeatedCardToPile(state, shieldCard, state.encounterDiscard);
    } else {
      const activePlayerId =
        state.players[state.activePlayerIndex]?.id || state.players[0]?.id || '';
      const ownerId = shieldCard.ownerId || activePlayerId;
      const owner = state.players.find((p) => p.id === ownerId) || state.players[0];
      moveDefeatedCardToPile(state, shieldCard, owner.discard);
    }
  }

  const onomatopoeia = discarded ? 'ARMORED SUIT SHATTERED!' : 'ARMORED SUIT ABSORBS DAMAGE!';
  state.log.push({
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: Date.now(),
    round: state.roundNumber,
    phase: state.phase,
    category: 'combat',
    key: discarded ? 'attachment.damageShield.broken' : 'attachment.damageShield.absorbed',
    params: {
      host: hostName,
      attachment: shieldCard.card.name,
      damage: damageAmount,
      totalDamage: newDamageOnShield,
      threshold,
    },
    onomatopoeia,
  });

  return {
    remainingDamage: 0,
    shieldAbsorption: {
      shieldCard,
      damageAbsorbed: damageAmount,
      totalDamageOnShield: newDamageOnShield,
      threshold,
      discarded,
    },
  };
}

/**
 * Universal RR v1.8 9-Step Damage Pipeline.
 * Single source of truth for all damage application across MCD.
 */
export function applyDamageToTarget(
  state: GameState,
  request: DamageRequest,
): { state: GameState; result: DamageResult } {
  const { target, amount, isAttack, hasPiercing, skipRetaliate, sourcePlayerId } = request;
  const defeatSource = defeatSourceOf(request);

  let currentDamage = amount;
  let toughRemoved = false;
  let absorbedByShield: ShieldAbsorptionInfo | undefined;
  let onomatopoeia: string | undefined;

  // ---------------------------------------------------------------------------
  // STEP 1: "When would deal / be dealt any amount of damage..." (RR v1.8 Step 1)
  // ---------------------------------------------------------------------------
  if (currentDamage > 0) {
    const shieldRes = resolveDamageShieldForHost(
      state,
      target.attachments,
      currentDamage,
      target.name,
      'DAMAGE_WOULD_BE_DEALT',
    );
    if (shieldRes.shieldAbsorption) {
      currentDamage = shieldRes.remainingDamage;
      absorbedByShield = shieldRes.shieldAbsorption;
      onomatopoeia = absorbedByShield.discarded
        ? 'ARMORED SUIT SHATTERED!'
        : 'ARMORED SUIT ABSORBS DAMAGE!';
    }
  }
  const damageDealt = currentDamage;

  // ---------------------------------------------------------------------------
  // STEP 2: Tough Status Cards (RR v1.8 Step 2)
  // ---------------------------------------------------------------------------
  if (currentDamage > 0) {
    const statusCards = target.statusCards || (target.entity as any).statusCards || [];
    const toughIndex = statusCards.indexOf(StatusCard.TOUGH);
    if (toughIndex !== -1) {
      statusCards.splice(toughIndex, 1);
      toughRemoved = true;
      if (!hasPiercing) {
        currentDamage = 0;
        onomatopoeia = 'CLANG! (TOUGH)';
        state.log.push({
          id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          timestamp: Date.now(),
          round: state.roundNumber,
          phase: state.phase,
          category: 'combat',
          key: 'damage.prevented.tough',
          params: { target: target.name },
          onomatopoeia,
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // STEP 3: "When would take any amount of damage..." (RR v1.8 Step 3)
  // ---------------------------------------------------------------------------
  if (currentDamage > 0 && !absorbedByShield) {
    const shieldRes = resolveDamageShieldForHost(
      state,
      target.attachments,
      currentDamage,
      target.name,
      'DAMAGE_WOULD_BE_TAKEN',
    );
    if (shieldRes.shieldAbsorption) {
      currentDamage = shieldRes.remainingDamage;
      absorbedByShield = shieldRes.shieldAbsorption;
      onomatopoeia = absorbedByShield.discarded
        ? 'DAMAGE SHIELD SHATTERED!'
        : 'DAMAGE SHIELD ABSORBS DAMAGE!';
    }
  }

  if (request.dispatchDamageTaken && target.type === 'player' && currentDamage > 0) {
    const interrupted = dispatchTrigger(state, 'DAMAGE_TAKEN', {
      targetPlayerId: (target.entity as PlayerState).id,
      targetType: 'player',
      damageAmount: currentDamage,
      triggerChain: request.triggerChain,
    });
    currentDamage = interrupted.damageAmount ?? currentDamage;
  }

  const damageTaken = currentDamage;
  let targetDefeated = false;
  let excessDamage = 0;

  // ---------------------------------------------------------------------------
  // STEP 5: Placing of damage on character (RR v1.8 Step 5)
  // ---------------------------------------------------------------------------
  if (damageTaken > 0) {
    onomatopoeia = onomatopoeia || 'POW!';
    switch (target.type) {
      case 'villain': {
        const villain = target.entity as VillainState;
        const healthBefore = villain.health;
        villain.health = Math.max(0, villain.health - damageTaken);
        state.log.push({
          id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          timestamp: Date.now(),
          round: state.roundNumber,
          phase: state.phase,
          category: 'combat',
          key: 'damage.applied.villain',
          params: {
            villain: villain.card?.name || (villain as any).name || 'Villain',
            damage: damageTaken,
            remainingHealth: villain.health,
          },
          onomatopoeia,
        });

        // STEPS 6-8: Villain Defeat
        if (villain.health <= 0) {
          targetDefeated = true;
          excessDamage = Math.max(0, damageTaken - healthBefore);
          const instId = villain.instanceId || 'villain';
          const activePlayerId =
            state.players[state.activePlayerIndex]?.id || state.players[0]?.id || '';
          dispatchDefeat(state, {
            targetPlayerId: sourcePlayerId || activePlayerId,
            targetInstanceId: instId,
            targetType: 'VILLAIN',
            defeatSource,
          });
          state = handleVillainDefeat(state, instId);
        }
        break;
      }

      case 'minion': {
        const minion = target.entity as CardInstance;
        if (!minion.tokens) minion.tokens = {};
        const currentDmg = minion.tokens.damage || 0;
        const newDmg = currentDmg + damageTaken;
        minion.tokens.damage = newDmg;
        const minionHealth = getEffectiveMinionHitPoints(state, minion);

        state.log.push({
          id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          timestamp: Date.now(),
          round: state.roundNumber,
          phase: state.phase,
          category: 'combat',
          key: 'damage.applied.minion',
          params: {
            minion: minion.card.name,
            damage: damageTaken,
            totalDamage: newDmg,
            health: minionHealth,
          },
          onomatopoeia,
        });

        // STEPS 6-8: Minion Defeat
        if (newDmg >= minionHealth) {
          targetDefeated = true;
          excessDamage = newDmg - minionHealth;
          const targetPlayer =
            state.players.find((p) =>
              p.engagedMinions.some((m) => m.instanceId === minion.instanceId),
            ) || state.players.find((p) => p.id === target.targetPlayerId);

          if (targetPlayer) {
            const idx = targetPlayer.engagedMinions.findIndex(
              (m) => m.instanceId === minion.instanceId,
            );
            if (idx !== -1) {
              const [defeatedMinion] = targetPlayer.engagedMinions.splice(idx, 1);
              processHostDefeated(state, defeatedMinion);
              dispatchDefeat(state, {
                targetPlayerId: targetPlayer.id,
                targetInstanceId: defeatedMinion.instanceId,
                targetType: 'MINION',
                defeatSource,
              });
              moveDefeatedCardToPile(state, defeatedMinion, state.encounterDiscard);
            }
          }
        }
        break;
      }

      case 'player': {
        const player = target.entity as PlayerState;
        const healthBefore = player.health;
        player.health = Math.max(0, player.health - damageTaken);
        state.log.push({
          id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          timestamp: Date.now(),
          round: state.roundNumber,
          phase: state.phase,
          category: 'combat',
          key: 'damage.applied.player',
          params: {
            player: player.name,
            damage: damageTaken,
            remainingHealth: player.health,
          },
          onomatopoeia,
        });

        // STEPS 6-8: Player Defeat
        if (player.health <= 0) {
          targetDefeated = true;
          excessDamage = Math.max(0, damageTaken - healthBefore);
          dispatchDefeat(state, {
            targetPlayerId: player.id,
            targetInstanceId: player.id,
            targetType: 'PLAYER',
            defeatSource,
          });
          eliminatePlayer(state, player.id);
        }
        break;
      }

      case 'ally': {
        const ally = target.entity as CardInstance;
        if (!ally.tokens) ally.tokens = {};
        const currentDmg = ally.tokens.damage || 0;
        const newDmg = currentDmg + damageTaken;
        ally.tokens.damage = newDmg;
        const allyMaxHp = (ally.card as AllyCard)?.health || 2;

        state.log.push({
          id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          timestamp: Date.now(),
          round: state.roundNumber,
          phase: state.phase,
          category: 'combat',
          key: 'damage.applied.ally',
          params: {
            ally: ally.card?.name || 'Ally',
            damage: damageTaken,
            totalDamage: newDmg,
            health: allyMaxHp,
          },
          onomatopoeia,
        });

        // STEPS 6-8: Ally Defeat
        if (newDmg >= allyMaxHp) {
          targetDefeated = true;
          excessDamage = newDmg - allyMaxHp;
          const ownerPlayer =
            state.players.find((p) => p.allies.some((a) => a.instanceId === ally.instanceId)) ||
            state.players.find((p) => p.id === target.targetPlayerId);

          if (ownerPlayer) {
            const idx = ownerPlayer.allies.findIndex((a) => a.instanceId === ally.instanceId);
            if (idx !== -1) {
              const [defeatedAlly] = ownerPlayer.allies.splice(idx, 1);
              processHostDefeated(state, defeatedAlly);
              dispatchDefeat(state, {
                targetPlayerId: ownerPlayer.id,
                targetInstanceId: defeatedAlly.instanceId,
                targetType: 'ALLY',
                defeatSource,
              });
              const discardOwner =
                (defeatedAlly.ownerId
                  ? state.players.find((p) => p.id === defeatedAlly.ownerId)
                  : undefined) || ownerPlayer;
              moveDefeatedCardToPile(state, defeatedAlly, discardOwner.discard);
            }
          }
        }
        break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Overkill: excess damage over a defeated minion goes to the villain (RR v1.8 glossary O)
  // ---------------------------------------------------------------------------
  if (request.hasOverkill && target.type === 'minion' && targetDefeated && excessDamage > 0) {
    const villain = getActiveVillain(state);
    const overkillRes = applyDamageToTarget(state, {
      target: {
        type: 'villain',
        entity: villain,
        name: villain.card?.name || 'Villain',
        attachments: villain.attachments,
        statusCards: villain.statusCards,
      },
      amount: excessDamage,
      sourceType: 'OVERKILL',
      sourceCardInstance: request.sourceCardInstance,
      sourcePlayerId,
      isAttack,
      hasPiercing,
      skipRetaliate: true,
    });
    state = overkillRes.state;
    if (overkillRes.result.damageTaken > 0) {
      state.log.push({
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        category: 'combat',
        key: 'overkill.villain.hit',
        params: { damage: overkillRes.result.damageTaken, villain: villain.card?.name },
        onomatopoeia: `OVERKILL! ${overkillRes.result.damageTaken} DAMAGE TO VILLAIN!`,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // STEP 9: Retaliate X & Post-Resolution Triggers (RR v1.8 Step 9)
  // ---------------------------------------------------------------------------
  let retaliateDamageDealt: number | undefined;
  if (!skipRetaliate && isAttack && !targetDefeated && damageDealt > 0) {
    let retaliateX = 0;
    if (target.type === 'villain') {
      retaliateX = getEffectiveRetaliate(target.entity as VillainState, state);
    } else if (target.type === 'minion' || target.type === 'ally') {
      retaliateX = getEffectiveRetaliate(target.entity as CardInstance, state);
    } else if (target.type === 'player') {
      retaliateX = getEffectiveRetaliate(target.entity as PlayerState, state);
    }

    if (retaliateX > 0) {
      if (request.sourceType === 'ALLY' && request.sourceCardInstance) {
        retaliateDamageDealt = retaliateX;
        applyDamageToTarget(state, {
          target: {
            type: 'ally',
            entity: request.sourceCardInstance,
            instanceId: request.sourceCardInstance.instanceId,
            name: request.sourceCardInstance.card.name,
            targetPlayerId: sourcePlayerId,
            attachments: request.sourceCardInstance.attachments,
            statusCards: request.sourceCardInstance.statusCards,
          },
          amount: retaliateX,
          sourceType: 'RETALIATE',
          isAttack: false,
          skipRetaliate: true,
        });

        state.log.push({
          id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          timestamp: Date.now(),
          round: state.roundNumber,
          phase: state.phase,
          category: 'combat',
          key: 'retaliate.hit',
          params: {
            damage: retaliateX,
            source: target.name,
            player: request.sourceCardInstance.card.name,
          },
          onomatopoeia: 'RETALIATE!',
        });
      } else if (sourcePlayerId) {
        retaliateDamageDealt = retaliateX;
        const attackingPlayer = state.players.find((p) => p.id === sourcePlayerId);
        if (attackingPlayer) {
          applyDamageToTarget(state, {
            target: {
              type: 'player',
              entity: attackingPlayer,
              name: attackingPlayer.name,
              attachments: attackingPlayer.attachments,
              statusCards: attackingPlayer.statusCards,
            },
            amount: retaliateX,
            sourceType: 'RETALIATE',
            isAttack: false,
            skipRetaliate: true,
          });

          state.log.push({
            id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            timestamp: Date.now(),
            round: state.roundNumber,
            phase: state.phase,
            category: 'combat',
            key: 'retaliate.hit',
            params: {
              damage: retaliateX,
              source: target.name,
              player: attackingPlayer.name,
            },
            onomatopoeia: 'RETALIATE!',
          });
        }
      }
    }
  }

  return {
    state,
    result: {
      initialAmount: amount,
      damageDealt,
      damageTaken,
      toughRemoved,
      absorbedByShield,
      targetDefeated,
      excessDamage,
      retaliateDamageDealt,
      onomatopoeia,
    },
  };
}
