import {
  GameState,
  StatusCard,
  CardInstance,
  PlayerState,
  VillainState,
  MinionCard,
  AllyCard,
  CardAbility,
} from '@engine/models';
import { getEffectiveRetaliate } from './stat-calculator';
import { handleVillainDefeat } from './scenario-helpers';
import { dispatchTrigger } from '../triggers/trigger-dispatcher';
import { moveDefeatedCardToPile, isEncounterCard, processHostDefeated } from '../effects';

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
  retaliateDamageDealt?: number;
  onomatopoeia?: string;
}

function dispatchCanonicalDefeat(
  state: GameState,
  targetPlayerId: string,
  sourceInstanceId: string,
  targetType: 'VILLAIN' | 'MINION' | 'ALLY' | 'PLAYER',
): void {
  const context = {
    targetPlayerId,
    sourceInstanceId,
    targetInstanceId: sourceInstanceId,
    entityType: 'CHARACTER' as const,
    targetType,
  };
  dispatchTrigger(state, 'DEFEATED', context);
  dispatchTrigger(state, 'CHARACTER_DEFEATED', context);
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
  isAttack?: boolean,
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
      return a.steps?.some((s) => {
        if (s.effect !== 'ATTACHMENT_DAMAGE_SHIELD') return false;
        const attackOnly = (s.effectParams as any)?.attackOnly;
        if (attackOnly && !isAttack) return false;
        return true;
      });
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
  const threshold =
    (step?.effectParams as any)?.maxAbsorb ?? (step?.effectParams as any)?.threshold ?? 5;

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
      isAttack,
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
      isAttack,
    );
    if (shieldRes.shieldAbsorption) {
      currentDamage = shieldRes.remainingDamage;
      absorbedByShield = shieldRes.shieldAbsorption;
      onomatopoeia = absorbedByShield.discarded
        ? 'DAMAGE SHIELD SHATTERED!'
        : 'DAMAGE SHIELD ABSORBS DAMAGE!';
    }
  }

  const damageTaken = currentDamage;
  let targetDefeated = false;

  // ---------------------------------------------------------------------------
  // STEP 5: Placing of damage on character (RR v1.8 Step 5)
  // ---------------------------------------------------------------------------
  if (damageTaken > 0) {
    onomatopoeia = onomatopoeia || 'POW!';
    switch (target.type) {
      case 'villain': {
        const villain = state.villain;
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
          const instId = villain.instanceId || 'villain';
          const activePlayerId =
            state.players[state.activePlayerIndex]?.id || state.players[0]?.id || '';
          dispatchCanonicalDefeat(state, sourcePlayerId || activePlayerId, instId, 'VILLAIN');
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
        const minionHealth = (minion.card as MinionCard).health || 1;

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
              dispatchCanonicalDefeat(state, targetPlayer.id, defeatedMinion.instanceId, 'MINION');
              moveDefeatedCardToPile(state, defeatedMinion, state.encounterDiscard);
            }
          }
        }
        break;
      }

      case 'player': {
        const player = target.entity as PlayerState;
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
          dispatchCanonicalDefeat(state, player.id, player.id, 'PLAYER');
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
          const ownerPlayer =
            state.players.find((p) => p.allies.some((a) => a.instanceId === ally.instanceId)) ||
            state.players.find((p) => p.id === target.targetPlayerId);

          if (ownerPlayer) {
            const idx = ownerPlayer.allies.findIndex((a) => a.instanceId === ally.instanceId);
            if (idx !== -1) {
              const [defeatedAlly] = ownerPlayer.allies.splice(idx, 1);
              processHostDefeated(state, defeatedAlly);
              dispatchCanonicalDefeat(state, ownerPlayer.id, defeatedAlly.instanceId, 'ALLY');
              moveDefeatedCardToPile(state, defeatedAlly, ownerPlayer.discard);
            }
          }
        }
        break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // STEP 9: Retaliate X & Post-Resolution Triggers (RR v1.8 Step 9)
  // ---------------------------------------------------------------------------
  let retaliateDamageDealt: number | undefined;
  if (!skipRetaliate && isAttack && !targetDefeated && damageDealt > 0) {
    let retaliateX = 0;
    if (target.type === 'villain') {
      retaliateX = getEffectiveRetaliate(state.villain, state);
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
      retaliateDamageDealt,
      onomatopoeia,
    },
  };
}
