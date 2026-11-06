import { recordAbilityUsage } from './stats';
import { bindKernel, kernel } from '../kernel';
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
  getFirstPlayer,
} from '@engine/models';
import { getEffectiveMinionHitPoints, getEffectiveRetaliate } from './stat-calculator';
import { isImmuneToDamage } from './damage-immunity';
import { eliminatePlayer } from './player-elimination';
import { type DefeatSource, type TriggerContext } from '../triggers/trigger-dispatcher';
import { dispatchDefeat, type DefeatDispatch } from '../triggers/defeat-dispatch';
import type { TriggerCallNode } from '../errors/infinite-loop-error';
import { moveDefeatedCardToPile, isEncounterCard, processHostDefeated } from '../effects';
import { appendLog } from '../state/game-log';
import { nextEngineId } from '../state/rng';
import type { GameLogEntry, PendingDamagePlacement } from '../models/state';

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

/**
 * The "would take" window of an attack (RR v1.8 Damage, step 3): Hero Interrupts such as Backflip
 * and Cosmic Flight are offered for the damage an identity is about to take, including the
 * Overkill excess of a defeated ally (#389).
 */
export interface WouldTakeWindow {
  attackId: string;
  /** What the offered cards show: the attacker, the defender and the target. */
  context: Partial<TriggerContext>;
  /** Called with the damage an interrupt took off, before the rest is placed. */
  onPrevented?: (prevented: number) => void;
}

/** The request fields that survive a pause; everything else is rebuilt by the caller. */
type ResumableRequest = Pick<
  DamageRequest,
  | 'sourceType'
  | 'sourceCardInstance'
  | 'sourcePlayerId'
  | 'sourceInstanceId'
  | 'isAttack'
  | 'hasPiercing'
  | 'hasOverkill'
  | 'skipRetaliate'
  | 'triggerChain'
>;

/**
 * What an occurrence that stopped at the "would take" window needs to finish (plain data: state
 * can be saved while the prompts are open). `earlier` is the ally stage of an Overkill excess: the
 * ally is already defeated and discarded, its defeat is announced with the excess's.
 */
export interface DamageResume {
  request: ResumableRequest;
  damageDealt: number;
  toughRemoved: boolean;
  absorbedByShield?: ShieldAbsorptionInfo;
  onomatopoeia?: string;
  earlier?: { result: DamageResult; defeats: DefeatDispatch[] };
}

export interface DamageRequest {
  target: TargetEntityRef;
  amount: number;
  sourceType?: 'HERO' | 'ALLY' | 'VILLAIN' | 'MINION' | 'CARD_EFFECT' | 'RETALIATE' | 'OVERKILL';
  sourceCardInstance?: CardInstance;
  sourcePlayerId?: string;
  /**
   * The attacker's instance id when it is not a card instance (a villain), so a defeat names the
   * enemy that caused it. Wins over `sourceCardInstance`.
   */
  sourceInstanceId?: string;
  isAttack?: boolean;
  hasPiercing?: boolean;
  hasOverkill?: boolean;
  skipRetaliate?: boolean;
  /**
   * Writes the log entry for the hit on a player in place of `damage.applied.player` (an enemy
   * attack writes `villain.attack.hit` / `minion.attack.hit`, which carry the attack figures).
   * Called once the damage is placed, before the defeat is announced.
   */
  logPlayerHit?: (hit: { amount: number; remainingHealth: number }) => void;
  /** Extra attack context and defender callback for the "would take" window on an identity target. */
  wouldTakeWindow?: WouldTakeWindow;
  triggerChain?: TriggerCallNode[];
}

/**
 * Resolves minion defeat per RR v1.8 (When Defeated Abilities, Defeat):
 * 1. Resolves all When Defeated abilities on the minion before leaving play.
 * 2. Processes host attachments/tucked cards via processHostDefeated.
 * 3. Moves the minion to the encounter discard pile.
 * 4. Returns the DefeatDispatch payload to be dispatched after state changes.
 */
export function resolveMinionDefeat(
  state: GameState,
  minion: CardInstance,
  targetPlayer: PlayerState,
  defeatSource?: DefeatSource,
): DefeatDispatch {
  // 1. Resolve 'When Defeated' abilities declared on the minion itself before it leaves play (RR v1.8 p. 23)
  const abilities = minion.card.enrichment?.abilities || [];
  for (const ability of abilities) {
    const trigger = ability.trigger as string | undefined;
    const timing = ability.timing as string | undefined;
    if (
      (trigger === 'DEFEATED' || trigger === 'WHEN_DEFEATED') &&
      (timing === 'FORCED_INTERRUPT' ||
        timing === 'INTERRUPT' ||
        timing === 'FORCED_RESPONSE' ||
        timing === 'RESPONSE' ||
        timing === 'WHEN_DEFEATED' ||
        !timing)
    ) {
      kernel.executeEffect(state, ability, {
        playerId: targetPlayer.id,
        sourceCardInstance: minion,
      });
    }
  }

  // 2. Clean up attachments or cards underneath
  processHostDefeated(state, minion, { player: targetPlayer });

  // 3. Move minion to encounter discard pile
  moveDefeatedCardToPile(state, minion, state.encounterDiscard);

  return {
    targetPlayerId: targetPlayer.id,
    targetInstanceId: minion.instanceId,
    targetType: 'MINION',
    defeatSource,
    defeatedCard: minion,
  };
}

/**
 * Opens the "would be defeated" interrupt window for a minion. True when an interrupt cancelled
 * the defeat or raised its hit points above its damage.
 */
function minionDefeatIsAverted(
  state: GameState,
  minion: CardInstance,
  playerId: string,
  defeatSource: DefeatSource | undefined,
): boolean {
  const dispatchRes = kernel.dispatchTrigger(state, 'CHARACTER_WOULD_BE_DEFEATED', {
    targetPlayerId: playerId,
    targetInstanceId: minion.instanceId,
    targetType: 'MINION',
    targetCardCode: minion.card.code,
    targetName: minion.card.name,
    defeatSource,
  });
  return (
    dispatchRes.cancelled ||
    (minion.tokens?.damage || 0) < getEffectiveMinionHitPoints(state, minion)
  );
}

function allyDefeatIsAverted(
  state: GameState,
  ally: CardInstance,
  playerId: string,
  defeatSource: DefeatSource | undefined,
): boolean {
  const dispatchRes = kernel.dispatchTrigger(state, 'CHARACTER_WOULD_BE_DEFEATED', {
    targetPlayerId: playerId,
    targetInstanceId: ally.instanceId,
    targetType: 'ALLY',
    targetCardCode: ally.card.code,
    targetName: ally.card.name,
    defeatSource,
  });
  const allyMaxHp = (ally.card as AllyCard)?.health || 2;
  return Boolean(dispatchRes.cancelled || (ally.tokens?.damage || 0) < allyMaxHp);
}

function playerDefeatIsAverted(
  state: GameState,
  player: PlayerState,
  defeatSource: DefeatSource | undefined,
): boolean {
  const dispatchRes = kernel.dispatchTrigger(state, 'CHARACTER_WOULD_BE_DEFEATED', {
    targetPlayerId: player.id,
    targetInstanceId: player.id,
    targetType: 'HERO',
    targetCardCode: player.activeFormCard?.code || player.hero?.code,
    targetName: player.name,
    defeatSource,
  });
  return Boolean(dispatchRes.cancelled || player.health > 0);
}

/**
 * Defeats every engaged minion whose damage reached its hit points. A lost hit point bonus (the
 * attachment leaves play) lowers only the ceiling; the damage stays (RR v1.8 hit points).
 */
export function defeatMinionsBeyondHitPoints(state: GameState): void {
  for (const player of state.players) {
    for (const minion of [...player.engagedMinions]) {
      if ((minion.tokens?.damage || 0) < getEffectiveMinionHitPoints(state, minion)) continue;
      const defeatSource: DefeatSource = { kind: 'EFFECT', byAttack: false };
      if (minionDefeatIsAverted(state, minion, player.id, defeatSource)) continue;

      const idx = player.engagedMinions.findIndex((m) => m.instanceId === minion.instanceId);
      if (idx === -1) continue;
      player.engagedMinions.splice(idx, 1);
      dispatchDefeat(state, resolveMinionDefeat(state, minion, player, defeatSource));
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

/** Who dealt the damage, for the combat log: the card or hero (`source`) and the acting player. */
interface DamageLogOrigin {
  source?: string;
  actor?: GameLogEntry['actor'];
}

/**
 * The card or hero that dealt the damage and the player who acted, for the combat log. Neither
 * is set for an enemy's attack, which logs its own attacker.
 */
function damageLogOrigin(state: GameState, request: DamageRequest): DamageLogOrigin {
  const player =
    request.sourceType === 'VILLAIN' || request.sourceType === 'MINION'
      ? undefined
      : state.players.find((p) => p.id === request.sourcePlayerId);
  const source =
    request.sourceCardInstance?.card.name ??
    (request.sourceType === 'HERO' ? player?.activeFormCard?.name : undefined);
  return {
    source,
    actor: player && { name: player.name, type: player.currentForm },
  };
}

const sourceParam = (origin: DamageLogOrigin) => (origin.source ? { source: origin.source } : {});

function defeatSourceOf(request: DamageRequest): DefeatSource {
  const kind: DefeatSource['kind'] =
    request.sourceType === 'HERO'
      ? 'HERO'
      : request.sourceType === 'ALLY'
        ? 'ALLY'
        : request.sourceType === 'VILLAIN' || request.sourceType === 'MINION'
          ? 'ENEMY'
          : 'EFFECT';
  const instanceId = request.sourceInstanceId ?? request.sourceCardInstance?.instanceId;
  return {
    kind,
    ...(request.sourcePlayerId ? { playerId: request.sourcePlayerId } : {}),
    ...(instanceId ? { instanceId } : {}),
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
  actor: GameLogEntry['actor'],
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

  // The shield absorbs outside the effect pipeline, so its use is counted here
  if (ability) recordAbilityUsage(state, shieldCard.card.code, ability.id);

  const onomatopoeia = discarded ? 'ARMORED SUIT SHATTERED!' : 'ARMORED SUIT ABSORBS DAMAGE!';
  appendLog(state, {
    category: 'combat',
    key: discarded ? 'attachment.damageShield.broken' : 'attachment.damageShield.absorbed',
    ...(actor && { actor }),
    params: {
      target: hostName,
      card: shieldCard.card.name,
      amount: damageAmount,
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

function applyDamageAndCheckDefeat(
  state: GameState,
  target: TargetEntityRef,
  damageTaken: number,
  sourcePlayerId: string | undefined,
  origin: DamageLogOrigin,
  defeatSource: DefeatSource,
  onomatopoeia: string | undefined,
  logPlayerHit: DamageRequest['logPlayerHit'],
): {
  state: GameState;
  targetDefeated: boolean;
  excessDamage: number;
  onomatopoeia: string | undefined;
  /**
   * The defeat of the target, announced by the caller once the whole occurrence has resolved
   * (RR v1.8 Triggering Condition) and the state change (stage advance, elimination, discard) is done.
   */
  pendingDefeat?: DefeatDispatch;
} {
  let pendingDefeat: DefeatDispatch | undefined;
  let targetDefeated = false;
  let excessDamage = 0;
  let resultOnomatopoeia = onomatopoeia;

  if (damageTaken > 0) {
    resultOnomatopoeia = resultOnomatopoeia || 'POW!';
    switch (target.type) {
      case 'villain': {
        const villain = target.entity as VillainState;
        const healthBefore = villain.health;
        villain.health = Math.max(0, villain.health - damageTaken);
        appendLog(state, {
          category: 'combat',
          actor: origin.actor,
          key: 'damage.applied.villain',
          params: {
            target: villain.card?.name || (villain as { name?: string }).name || 'Villain',
            ...sourceParam(origin),
            amount: damageTaken,
            remainingHealth: villain.health,
          },
          onomatopoeia: resultOnomatopoeia,
        });

        // STEPS 6-8: Villain Defeat
        if (villain.health <= 0) {
          targetDefeated = true;
          excessDamage = Math.max(0, damageTaken - healthBefore);
          const instId = villain.instanceId || 'villain';
          const activePlayerId =
            state.players[state.activePlayerIndex]?.id || state.players[0]?.id || '';
          state = kernel.handleVillainDefeat(state, instId);
          pendingDefeat = {
            targetPlayerId: sourcePlayerId || activePlayerId,
            targetInstanceId: instId,
            targetType: 'VILLAIN',
            defeatSource,
          };
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

        appendLog(state, {
          category: 'combat',
          actor: origin.actor,
          key: 'damage.applied.minion',
          params: {
            target: minion.card.name,
            ...sourceParam(origin),
            amount: damageTaken,
            totalDamage: newDmg,
            health: minionHealth,
          },
          onomatopoeia: resultOnomatopoeia,
        });

        // STEPS 6-8: Minion Defeat
        if (newDmg >= minionHealth) {
          excessDamage = newDmg - minionHealth;
          const targetPlayer =
            state.players.find((p) =>
              p.engagedMinions.some((m) => m.instanceId === minion.instanceId),
            ) || state.players.find((p) => p.id === target.targetPlayerId);

          if (
            minionDefeatIsAverted(
              state,
              minion,
              targetPlayer?.id || state.players[0]?.id || '',
              defeatSource,
            )
          ) {
            excessDamage = 0;
            break;
          }

          targetDefeated = true;
          if (targetPlayer) {
            const idx = targetPlayer.engagedMinions.findIndex(
              (m) => m.instanceId === minion.instanceId,
            );
            if (idx !== -1) {
              const [defeatedMinion] = targetPlayer.engagedMinions.splice(idx, 1);
              pendingDefeat = resolveMinionDefeat(
                state,
                defeatedMinion,
                targetPlayer,
                defeatSource,
              );
            }
          }
        }
        break;
      }

      case 'player': {
        const player = target.entity as PlayerState;
        const healthBefore = player.health;
        player.health = Math.max(0, player.health - damageTaken);
        if (logPlayerHit) {
          logPlayerHit({ amount: damageTaken, remainingHealth: player.health });
        } else {
          appendLog(state, {
            category: 'combat',
            actor: origin.actor,
            key: 'damage.applied.player',
            params: {
              target: player.name,
              ...sourceParam(origin),
              amount: damageTaken,
              remainingHealth: player.health,
            },
            onomatopoeia: resultOnomatopoeia,
          });
        }

        // STEPS 6-8: Player Defeat
        if (player.health <= 0) {
          if (playerDefeatIsAverted(state, player, defeatSource)) {
            excessDamage = 0;
            break;
          }
          targetDefeated = true;
          excessDamage = Math.max(0, damageTaken - healthBefore);
          eliminatePlayer(state, player.id);
          pendingDefeat = {
            targetPlayerId: player.id,
            targetInstanceId: player.id,
            targetType: 'HERO',
            defeatSource,
          };
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

        appendLog(state, {
          category: 'combat',
          actor: origin.actor,
          key: 'damage.applied.ally',
          params: {
            target: ally.card?.name || 'Ally',
            ...sourceParam(origin),
            amount: damageTaken,
            totalDamage: newDmg,
            health: allyMaxHp,
          },
          onomatopoeia: resultOnomatopoeia,
        });

        // STEPS 6-8: Ally Defeat
        if (newDmg >= allyMaxHp) {
          const ownerPlayer =
            state.players.find((p) => p.allies.some((a) => a.instanceId === ally.instanceId)) ||
            state.players.find((p) => p.id === target.targetPlayerId);

          if (
            allyDefeatIsAverted(
              state,
              ally,
              ownerPlayer?.id || state.players[0]?.id || '',
              defeatSource,
            )
          ) {
            excessDamage = 0;
            break;
          }

          targetDefeated = true;
          excessDamage = newDmg - allyMaxHp;
          appendLog(state, {
            category: 'combat',
            key: 'ally.defeated',
            params: { target: ally.card?.name || 'Ally' },
            onomatopoeia: 'DEFEATED!',
          });

          if (ownerPlayer) {
            const idx = ownerPlayer.allies.findIndex((a) => a.instanceId === ally.instanceId);
            if (idx !== -1) {
              const [defeatedAlly] = ownerPlayer.allies.splice(idx, 1);
              processHostDefeated(state, defeatedAlly);
              pendingDefeat = {
                targetPlayerId: ownerPlayer.id,
                targetInstanceId: defeatedAlly.instanceId,
                targetType: 'ALLY',
                defeatSource,
              };
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

  return {
    state,
    targetDefeated,
    excessDamage,
    onomatopoeia: resultOnomatopoeia,
    pendingDefeat,
  };
}

/** Mutates `state` in place (the pipeline's damage steps do); returns the retaliate damage dealt. */
function applyRetaliateDamage(
  state: GameState,
  request: DamageRequest,
  target: TargetEntityRef,
  targetDefeated: boolean,
  damageDealt: number,
): number | undefined {
  let retaliateDamageDealt: number | undefined;
  const { skipRetaliate, isAttack, sourcePlayerId } = request;

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

        appendLog(state, {
          category: 'combat',
          key: 'retaliate.hit',
          params: {
            actor: target.name,
            target: request.sourceCardInstance.card.name,
            amount: retaliateX,
          },
          onomatopoeia: 'RETALIATE!',
        });
      } else if (sourcePlayerId) {
        retaliateDamageDealt = retaliateX;
        const attackingPlayer = state.players.find((p) => p.id === sourcePlayerId);
        if (attackingPlayer) {
          applyDamageToTarget(state, {
            target: playerTarget(attackingPlayer),
            amount: retaliateX,
            sourceType: 'RETALIATE',
            isAttack: false,
            skipRetaliate: true,
          });

          appendLog(state, {
            category: 'combat',
            key: 'retaliate.hit',
            params: {
              actor: target.name,
              target: attackingPlayer.name,
              amount: retaliateX,
            },
            onomatopoeia: 'RETALIATE!',
          });
        }
      }
    }
  }

  return retaliateDamageDealt;
}

interface ResolvedDamage {
  state: GameState;
  /** Steps 0 to 8; `retaliateDamageDealt` (step 9) is added once the defeats are announced. */
  result: DamageResult;
  /** The defeats of this occurrence, in the order they are announced (the target's first). */
  defeats: DefeatDispatch[];
  /**
   * Set when the occurrence stopped at the "would take" window because its prompts are open: the
   * damage is not placed and no defeat is announced yet. `resumeDamage` finishes it.
   */
  paused?: PendingDamagePlacement;
}

/**
 * Where the damage beyond a defeated minion or ally goes (RR v1.8 glossary O): the villain for a
 * minion, the identity of the ally's controller for an ally.
 */
function overkillTargetOf(
  state: GameState,
  target: TargetEntityRef,
  defeat: DefeatDispatch | undefined,
): TargetEntityRef | undefined {
  if (target.type === 'minion') {
    const villain = getActiveVillain(state);
    return {
      type: 'villain',
      entity: villain,
      name: villain.card?.name || 'Villain',
      attachments: villain.attachments,
      statusCards: villain.statusCards,
    };
  }
  const controller =
    target.type === 'ally' ? state.players.find((p) => p.id === defeat?.targetPlayerId) : undefined;
  return controller ? playerTarget(controller) : undefined;
}

function playerTarget(player: PlayerState): TargetEntityRef {
  return {
    type: 'player',
    entity: player,
    name: player.name,
    targetPlayerId: player.id,
    attachments: player.attachments,
    statusCards: player.statusCards,
  };
}

interface TargetContext {
  request: DamageRequest;
  origin: DamageLogOrigin;
  currentDamage: number;
  damageDealt: number;
  damageTaken: number;
  toughRemoved: boolean;
  absorbedByShield?: ShieldAbsorptionInfo;
  onomatopoeia?: string;
  isImmune: boolean;
  isDefeated: boolean;
  excessDamage: number;
  pendingDefeat?: DefeatDispatch;
  retaliateDamageDealt?: number;
  pausedPlacement?: PendingDamagePlacement;
}

interface ResolvedTargets {
  state: GameState;
  contexts: TargetContext[];
  defeats: DefeatDispatch[];
  paused?: PendingDamagePlacement[];
}

function resolveDamageForTargets(state: GameState, requests: DamageRequest[]): ResolvedTargets {
  if (requests.length === 0) {
    return { state, contexts: [], defeats: [] };
  }

  const contexts: TargetContext[] = requests.map((req) => ({
    request: req,
    origin: damageLogOrigin(state, req),
    currentDamage: req.amount,
    damageDealt: req.amount,
    damageTaken: 0,
    toughRemoved: false,
    isImmune: false,
    isDefeated: false,
    excessDamage: 0,
  }));

  // ---------------------------------------------------------------------------
  // STEP 0: a character that cannot take damage from this source ignores it (#297).
  // ---------------------------------------------------------------------------
  for (const ctx of contexts) {
    const { target, amount } = ctx.request;
    if (
      amount > 0 &&
      target.type !== 'player' &&
      isImmuneToDamage(state, target.entity, ctx.request.sourceCardInstance)
    ) {
      ctx.isImmune = true;
      ctx.currentDamage = 0;
      ctx.damageDealt = 0;
      ctx.onomatopoeia = 'IMMUNE!';
      appendLog(state, {
        category: 'combat',
        key: 'damage.prevented.immune',
        ...(ctx.origin.actor && { actor: ctx.origin.actor }),
        params: { target: target.name },
        onomatopoeia: 'IMMUNE!',
      });
    }
  }

  // ---------------------------------------------------------------------------
  // STEP 1: "When would deal / be dealt any amount of damage..." (RR v1.8 Step 1)
  // ---------------------------------------------------------------------------
  for (const ctx of contexts) {
    if (ctx.isImmune || ctx.currentDamage <= 0) continue;
    const shieldRes = resolveDamageShieldForHost(
      state,
      ctx.request.target.attachments,
      ctx.currentDamage,
      ctx.request.target.name,
      'DAMAGE_WOULD_BE_DEALT',
      ctx.origin.actor,
    );
    if (shieldRes.shieldAbsorption) {
      ctx.currentDamage = shieldRes.remainingDamage;
      ctx.absorbedByShield = shieldRes.shieldAbsorption;
      ctx.onomatopoeia = ctx.absorbedByShield.discarded
        ? 'ARMORED SUIT SHATTERED!'
        : 'ARMORED SUIT ABSORBS DAMAGE!';
    }
    ctx.damageDealt = ctx.currentDamage;
  }

  // ---------------------------------------------------------------------------
  // STEP 2: Tough Status Cards (RR v1.8 Step 2)
  // ---------------------------------------------------------------------------
  for (const ctx of contexts) {
    if (ctx.isImmune || ctx.currentDamage <= 0) continue;
    const { target, hasPiercing } = ctx.request;
    const statusCards =
      target.statusCards ||
      ('statusCards' in target.entity ? target.entity.statusCards : undefined) ||
      [];
    const toughIndex = statusCards.indexOf(StatusCard.TOUGH);
    if (toughIndex !== -1) {
      statusCards.splice(toughIndex, 1);
      ctx.toughRemoved = true;
      if (hasPiercing) {
        appendLog(state, {
          category: 'combat',
          key: 'damage.tough.pierced',
          ...(ctx.origin.actor && { actor: ctx.origin.actor }),
          params: { target: target.name },
          onomatopoeia: 'PIERCING SHRED! (TOUGH LOST)',
        });
      } else {
        ctx.currentDamage = 0;
        ctx.onomatopoeia = 'CLANG! (TOUGH)';
        appendLog(state, {
          category: 'combat',
          key: 'damage.prevented.tough',
          ...(ctx.origin.actor && { actor: ctx.origin.actor }),
          params: { target: target.name },
          onomatopoeia: ctx.onomatopoeia,
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // STEP 3: "When would take any amount of damage..." (RR v1.8 Step 3)
  // ---------------------------------------------------------------------------
  for (const ctx of contexts) {
    if (ctx.isImmune || ctx.currentDamage <= 0) continue;
    if (!ctx.absorbedByShield) {
      const shieldRes = resolveDamageShieldForHost(
        state,
        ctx.request.target.attachments,
        ctx.currentDamage,
        ctx.request.target.name,
        'DAMAGE_WOULD_BE_TAKEN',
        ctx.origin.actor,
      );
      if (shieldRes.shieldAbsorption) {
        ctx.currentDamage = shieldRes.remainingDamage;
        ctx.absorbedByShield = shieldRes.shieldAbsorption;
        ctx.onomatopoeia = ctx.absorbedByShield.discarded
          ? 'DAMAGE SHIELD SHATTERED!'
          : 'DAMAGE SHIELD ABSORBS DAMAGE!';
      }
    }

    if (ctx.currentDamage > 0 && ctx.request.target.type !== 'player') {
      const targetAbilities: CardAbility[] =
        (ctx.request.target.entity as { card?: { enrichment?: { abilities?: CardAbility[] } } })
          ?.card?.enrichment?.abilities || [];
      const damageInterrupt = targetAbilities.find(
        (a) =>
          (a.timing === 'FORCED_INTERRUPT' || a.timing === 'INTERRUPT') &&
          a.trigger === 'DAMAGE_WOULD_BE_TAKEN',
      );
      if (damageInterrupt) {
        kernel.executeEffect(state, damageInterrupt, {
          playerId: state.players[0]?.id ?? '',
          damageAmount: ctx.currentDamage,
          interceptedValue: ctx.currentDamage,
        });
        ctx.currentDamage = 0;
        ctx.onomatopoeia = 'DAMAGE REPLACED!';
        appendLog(state, {
          category: 'combat',
          key: 'damage.prevented.replacement',
          params: { target: ctx.request.target.name },
          onomatopoeia: ctx.onomatopoeia,
        });
      }
    }

    if (ctx.request.target.type === 'player' && ctx.currentDamage > 0) {
      const player = ctx.request.target.entity as PlayerState;
      const opened = openWouldTakeWindow(state, ctx.request, player, ctx.currentDamage);
      ctx.currentDamage = opened.amount;
      if (opened.placementId) {
        ctx.pausedPlacement = {
          id: opened.placementId,
          targetPlayerId: player.id,
          sourceType: ctx.request.wouldTakeWindow
            ? 'ATTACK'
            : (ctx.request.sourceType ?? 'CARD_EFFECT'),
          amount: ctx.currentDamage,
          initialAmount: ctx.currentDamage,
          ...(ctx.request.wouldTakeWindow
            ? { attackId: ctx.request.wouldTakeWindow.attackId }
            : {}),
          resume: {
            request: resumableRequest(ctx.request),
            damageDealt: ctx.damageDealt,
            toughRemoved: ctx.toughRemoved,
            absorbedByShield: ctx.absorbedByShield,
            onomatopoeia: ctx.onomatopoeia,
          },
        };
      }
    }
  }

  const pausedContexts = contexts.filter((c) => c.pausedPlacement);
  if (pausedContexts.length > 0) {
    return {
      state,
      contexts,
      defeats: [],
      paused: pausedContexts.map((c) => c.pausedPlacement!),
    };
  }

  // ---------------------------------------------------------------------------
  // STEP 4: "takes" abilities
  // ---------------------------------------------------------------------------
  for (const ctx of contexts) {
    ctx.damageTaken = ctx.currentDamage;
  }

  // ---------------------------------------------------------------------------
  // STEP 5: Placing damage on characters (health / tokens)
  // ---------------------------------------------------------------------------
  applyDamagePlacementStep(state, contexts);

  // ---------------------------------------------------------------------------
  // STEP 6: "would be defeated" abilities (CHARACTER_WOULD_BE_DEFEATED)
  // ---------------------------------------------------------------------------
  checkDefeatAvertedStep(state, contexts);

  // ---------------------------------------------------------------------------
  // STEP 7 & 8: Defeat resolution and discard
  // ---------------------------------------------------------------------------
  const defeats = resolveDefeatDiscardsStep(state, contexts);

  // ---------------------------------------------------------------------------
  // Overkill: excess damage dealt simultaneously (RR v1.8 glossary O)
  // ---------------------------------------------------------------------------
  const overkill = resolveOverkillStep(state, contexts, defeats);
  state = overkill.state;
  if (overkill.paused && overkill.paused.length > 0) {
    return { state, contexts, defeats: [], paused: overkill.paused };
  }

  return { state, contexts, defeats };
}

function applyDamagePlacementStep(state: GameState, contexts: TargetContext[]): void {
  for (const ctx of contexts) {
    if (ctx.damageTaken <= 0) continue;
    const { target } = ctx.request;
    const damageTaken = ctx.damageTaken;
    ctx.onomatopoeia = ctx.onomatopoeia || 'POW!';

    switch (target.type) {
      case 'villain': {
        const villain = target.entity as VillainState;
        villain.health = Math.max(0, villain.health - damageTaken);
        appendLog(state, {
          category: 'combat',
          actor: ctx.origin.actor,
          key: 'damage.applied.villain',
          params: {
            target: villain.card?.name || (villain as { name?: string }).name || 'Villain',
            ...sourceParam(ctx.origin),
            amount: damageTaken,
            remainingHealth: villain.health,
          },
          onomatopoeia: ctx.onomatopoeia,
        });
        break;
      }
      case 'minion': {
        const minion = target.entity as CardInstance;
        if (!minion.tokens) minion.tokens = {};
        const newDmg = (minion.tokens.damage || 0) + damageTaken;
        minion.tokens.damage = newDmg;
        const minionHealth = getEffectiveMinionHitPoints(state, minion);
        appendLog(state, {
          category: 'combat',
          actor: ctx.origin.actor,
          key: 'damage.applied.minion',
          params: {
            target: minion.card.name,
            ...sourceParam(ctx.origin),
            amount: damageTaken,
            totalDamage: newDmg,
            health: minionHealth,
          },
          onomatopoeia: ctx.onomatopoeia,
        });
        break;
      }
      case 'player': {
        const player = target.entity as PlayerState;
        player.health = Math.max(0, player.health - damageTaken);
        if (ctx.request.logPlayerHit) {
          ctx.request.logPlayerHit({ amount: damageTaken, remainingHealth: player.health });
        } else {
          appendLog(state, {
            category: 'combat',
            actor: ctx.origin.actor,
            key: 'damage.applied.player',
            params: {
              target: player.name,
              ...sourceParam(ctx.origin),
              amount: damageTaken,
              remainingHealth: player.health,
            },
            onomatopoeia: ctx.onomatopoeia,
          });
        }
        break;
      }
      case 'ally': {
        const ally = target.entity as CardInstance;
        if (!ally.tokens) ally.tokens = {};
        const newDmg = (ally.tokens.damage || 0) + damageTaken;
        ally.tokens.damage = newDmg;
        const allyMaxHp = (ally.card as AllyCard)?.health || 2;
        appendLog(state, {
          category: 'combat',
          actor: ctx.origin.actor,
          key: 'damage.applied.ally',
          params: {
            target: ally.card?.name || 'Ally',
            ...sourceParam(ctx.origin),
            amount: damageTaken,
            totalDamage: newDmg,
            health: allyMaxHp,
          },
          onomatopoeia: ctx.onomatopoeia,
        });
        break;
      }
    }
  }
}

function checkDefeatAvertedStep(state: GameState, contexts: TargetContext[]): void {
  for (const ctx of contexts) {
    if (ctx.damageTaken <= 0) continue;
    const { target } = ctx.request;
    const defeatSource = defeatSourceOf(ctx.request);

    switch (target.type) {
      case 'villain': {
        const villain = target.entity as VillainState;
        if (villain.health <= 0) {
          ctx.isDefeated = true;
          ctx.excessDamage = Math.max(0, ctx.damageTaken - (villain.health + ctx.damageTaken));
        }
        break;
      }
      case 'minion': {
        const minion = target.entity as CardInstance;
        const minionHealth = getEffectiveMinionHitPoints(state, minion);
        const currentDmg = minion.tokens?.damage || 0;
        if (currentDmg >= minionHealth) {
          const targetPlayer =
            state.players.find((p) =>
              p.engagedMinions.some((m) => m.instanceId === minion.instanceId),
            ) || state.players.find((p) => p.id === target.targetPlayerId);
          const playerId = targetPlayer?.id || state.players[0]?.id || '';
          if (minionDefeatIsAverted(state, minion, playerId, defeatSource)) {
            ctx.excessDamage = 0;
          } else {
            ctx.isDefeated = true;
            ctx.excessDamage = currentDmg - minionHealth;
          }
        }
        break;
      }
      case 'player': {
        const player = target.entity as PlayerState;
        if (player.health <= 0) {
          if (playerDefeatIsAverted(state, player, defeatSource)) {
            ctx.excessDamage = 0;
          } else {
            ctx.isDefeated = true;
            ctx.excessDamage = Math.max(0, ctx.damageTaken - (player.health + ctx.damageTaken));
          }
        }
        break;
      }
      case 'ally': {
        const ally = target.entity as CardInstance;
        const allyMaxHp = (ally.card as AllyCard)?.health || 2;
        const currentDmg = ally.tokens?.damage || 0;
        if (currentDmg >= allyMaxHp) {
          const ownerPlayer =
            state.players.find((p) => p.allies.some((a) => a.instanceId === ally.instanceId)) ||
            state.players.find((p) => p.id === target.targetPlayerId);
          const playerId = ownerPlayer?.id || state.players[0]?.id || '';
          if (allyDefeatIsAverted(state, ally, playerId, defeatSource)) {
            ctx.excessDamage = 0;
          } else {
            ctx.isDefeated = true;
            ctx.excessDamage = currentDmg - allyMaxHp;
          }
        }
        break;
      }
    }
  }
}

function resolveDefeatDiscardsStep(state: GameState, contexts: TargetContext[]): DefeatDispatch[] {
  const defeats: DefeatDispatch[] = [];
  for (const ctx of contexts) {
    if (!ctx.isDefeated) continue;
    const { target } = ctx.request;
    const defeatSource = defeatSourceOf(ctx.request);

    switch (target.type) {
      case 'villain': {
        const villain = target.entity as VillainState;
        const instId = villain.instanceId || 'villain';
        const activePlayerId =
          state.players[state.activePlayerIndex]?.id || state.players[0]?.id || '';
        state = kernel.handleVillainDefeat(state, instId);
        ctx.pendingDefeat = {
          targetPlayerId: ctx.request.sourcePlayerId || activePlayerId,
          targetInstanceId: instId,
          targetType: 'VILLAIN',
          defeatSource,
        };
        defeats.push(ctx.pendingDefeat);
        break;
      }
      case 'minion': {
        const minion = target.entity as CardInstance;
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
            ctx.pendingDefeat = resolveMinionDefeat(
              state,
              defeatedMinion,
              targetPlayer,
              defeatSource,
            );
            defeats.push(ctx.pendingDefeat);
          }
        }
        break;
      }
      case 'player': {
        const player = target.entity as PlayerState;
        eliminatePlayer(state, player.id);
        ctx.pendingDefeat = {
          targetPlayerId: player.id,
          targetInstanceId: player.id,
          targetType: 'HERO',
          defeatSource,
        };
        defeats.push(ctx.pendingDefeat);
        break;
      }
      case 'ally': {
        const ally = target.entity as CardInstance;
        appendLog(state, {
          category: 'combat',
          key: 'ally.defeated',
          params: { target: ally.card?.name || 'Ally' },
          onomatopoeia: 'DEFEATED!',
        });
        const ownerPlayer =
          state.players.find((p) => p.allies.some((a) => a.instanceId === ally.instanceId)) ||
          state.players.find((p) => p.id === target.targetPlayerId);
        if (ownerPlayer) {
          const idx = ownerPlayer.allies.findIndex((a) => a.instanceId === ally.instanceId);
          if (idx !== -1) {
            const [defeatedAlly] = ownerPlayer.allies.splice(idx, 1);
            processHostDefeated(state, defeatedAlly);
            ctx.pendingDefeat = {
              targetPlayerId: ownerPlayer.id,
              targetInstanceId: defeatedAlly.instanceId,
              targetType: 'ALLY',
              defeatSource,
            };
            defeats.push(ctx.pendingDefeat);
            const discardOwner =
              (defeatedAlly.ownerId
                ? state.players.find((p) => p.id === defeatedAlly.ownerId)
                : undefined) || ownerPlayer;
            moveDefeatedCardToPile(state, defeatedAlly, discardOwner.discard);
          }
        }
        break;
      }
    }
  }
  return defeats;
}

function resolveOverkillStep(
  state: GameState,
  contexts: TargetContext[],
  defeats: DefeatDispatch[],
): { state: GameState; paused?: PendingDamagePlacement[] } {
  for (const ctx of contexts) {
    const overkillTarget =
      ctx.request.hasOverkill && ctx.isDefeated && ctx.excessDamage > 0
        ? overkillTargetOf(state, ctx.request.target, ctx.pendingDefeat)
        : undefined;
    if (overkillTarget) {
      const overkillResolved = resolveDamageForTargets(state, [
        {
          target: overkillTarget,
          amount: ctx.excessDamage,
          sourceType: 'OVERKILL',
          sourceCardInstance: ctx.request.sourceCardInstance,
          sourceInstanceId: ctx.request.sourceInstanceId,
          sourcePlayerId: ctx.request.sourcePlayerId,
          isAttack: ctx.request.isAttack,
          hasPiercing: ctx.request.hasPiercing,
          skipRetaliate: true,
          wouldTakeWindow: ctx.request.wouldTakeWindow && {
            attackId: ctx.request.wouldTakeWindow.attackId,
            context: ctx.request.wouldTakeWindow.context,
          },
        },
      ]);
      state = overkillResolved.state;
      if (overkillResolved.paused && overkillResolved.paused.length > 0) {
        for (const p of overkillResolved.paused) {
          p.resume.earlier = {
            result: {
              initialAmount: ctx.request.amount,
              damageDealt: ctx.damageDealt,
              damageTaken: ctx.damageTaken,
              toughRemoved: ctx.toughRemoved,
              absorbedByShield: ctx.absorbedByShield,
              targetDefeated: ctx.isDefeated,
              excessDamage: ctx.excessDamage,
              onomatopoeia: ctx.onomatopoeia,
            },
            defeats: [...defeats],
          };
        }
        return { state, paused: overkillResolved.paused };
      }
      defeats.push(...overkillResolved.defeats);
      const overkillCtx = overkillResolved.contexts[0];
      if (overkillCtx) {
        logOverkillHit(state, overkillTarget, overkillCtx.damageTaken);
      }
    }
  }
  return { state };
}

/**
 * Universal RR v1.8 9-Step Damage Pipeline for multiple targets simultaneously.
 * Single source of truth for all multi-target and single-target damage across MCD.
 */
export function applyDamageToTargets(
  state: GameState,
  requests: DamageRequest[],
): { state: GameState; results: DamageResult[]; paused?: true } {
  const resolved = resolveDamageForTargets(state, requests);
  state = resolved.state;

  if (resolved.paused && resolved.paused.length > 0) {
    state.pendingDamagePlacements = [...(state.pendingDamagePlacements ?? []), ...resolved.paused];
    const results: DamageResult[] = resolved.contexts.map((c) => ({
      initialAmount: c.request.amount,
      damageDealt: c.damageDealt,
      damageTaken: 0,
      toughRemoved: c.toughRemoved,
      absorbedByShield: c.absorbedByShield,
      targetDefeated: false,
      excessDamage: 0,
      onomatopoeia: c.onomatopoeia,
    }));
    return { state, results, paused: true };
  }

  // One occurrence, one window (RR v1.8 Triggering Condition): every defeat is announced once its
  // state changes (stage advance, elimination, discard), Overkill included, have all been applied.
  for (const defeat of resolved.defeats) {
    dispatchDefeat(state, defeat);
  }

  // ---------------------------------------------------------------------------
  // STEP 9: "after takes damage" triggers & Retaliate (RR v1.8 Step 9)
  // ---------------------------------------------------------------------------
  for (const ctx of resolved.contexts) {
    if (
      ctx.damageTaken > 0 &&
      (ctx.request.target.type === 'player' || ctx.request.target.type === 'villain') &&
      state.players.length > 0
    ) {
      const isPlayer = ctx.request.target.type === 'player';
      kernel.dispatchTrigger(state, 'DAMAGE_TAKEN', {
        targetPlayerId: isPlayer
          ? (ctx.request.target.entity as PlayerState).id
          : ctx.request.sourcePlayerId || getFirstPlayer(state).id,
        targetType: ctx.request.target.type,
        targetInstanceId: isPlayer
          ? undefined
          : (ctx.request.target.entity as VillainState).instanceId,
        damageAmount: ctx.damageTaken,
        triggerChain: ctx.request.triggerChain,
      });
    }
  }

  for (const ctx of resolved.contexts) {
    ctx.retaliateDamageDealt = applyRetaliateDamage(
      state,
      ctx.request,
      ctx.request.target,
      ctx.isDefeated,
      ctx.damageDealt,
    );
  }

  const results: DamageResult[] = resolved.contexts.map((c) => ({
    initialAmount: c.request.amount,
    damageDealt: c.damageDealt,
    damageTaken: c.damageTaken,
    toughRemoved: c.toughRemoved,
    absorbedByShield: c.absorbedByShield,
    targetDefeated: c.isDefeated,
    excessDamage: c.excessDamage,
    retaliateDamageDealt: c.retaliateDamageDealt,
    onomatopoeia: c.onomatopoeia,
  }));

  return { state, results };
}

/**
 * Universal RR v1.8 9-Step Damage Pipeline.
 * Single source of truth for all damage application across MCD.
 */
export function applyDamageToTarget(
  state: GameState,
  request: DamageRequest,
): { state: GameState; result: DamageResult; paused?: true } {
  const { state: nextState, results, paused } = applyDamageToTargets(state, [request]);
  return { state: nextState, result: results[0], paused };
}

function resolveDamage(state: GameState, request: DamageRequest): ResolvedDamage {
  const { target, amount, hasPiercing } = request;
  const origin = damageLogOrigin(state, request);

  let currentDamage = amount;
  let toughRemoved = false;
  let absorbedByShield: ShieldAbsorptionInfo | undefined;
  let onomatopoeia: string | undefined;

  // ---------------------------------------------------------------------------
  // STEP 0: a character that cannot take damage from this source ignores it (#297).
  // ---------------------------------------------------------------------------
  if (
    amount > 0 &&
    target.type !== 'player' &&
    isImmuneToDamage(state, target.entity, request.sourceCardInstance)
  ) {
    appendLog(state, {
      category: 'combat',
      key: 'damage.prevented.immune',
      ...(origin.actor && { actor: origin.actor }),
      params: { target: target.name },
      onomatopoeia: 'IMMUNE!',
    });
    return {
      state,
      result: {
        initialAmount: amount,
        damageDealt: 0,
        damageTaken: 0,
        toughRemoved: false,
        targetDefeated: false,
        excessDamage: 0,
        onomatopoeia: 'IMMUNE!',
      },
      defeats: [],
    };
  }

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
      origin.actor,
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
    const statusCards =
      target.statusCards ||
      ('statusCards' in target.entity ? target.entity.statusCards : undefined) ||
      [];
    const toughIndex = statusCards.indexOf(StatusCard.TOUGH);
    if (toughIndex !== -1) {
      statusCards.splice(toughIndex, 1);
      toughRemoved = true;
      if (hasPiercing) {
        appendLog(state, {
          category: 'combat',
          key: 'damage.tough.pierced',
          ...(origin.actor && { actor: origin.actor }),
          params: { target: target.name },
          onomatopoeia: 'PIERCING SHRED! (TOUGH LOST)',
        });
      } else {
        currentDamage = 0;
        onomatopoeia = 'CLANG! (TOUGH)';
        appendLog(state, {
          category: 'combat',
          key: 'damage.prevented.tough',
          ...(origin.actor && { actor: origin.actor }),
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
      origin.actor,
    );
    if (shieldRes.shieldAbsorption) {
      currentDamage = shieldRes.remainingDamage;
      absorbedByShield = shieldRes.shieldAbsorption;
      onomatopoeia = absorbedByShield.discarded
        ? 'DAMAGE SHIELD SHATTERED!'
        : 'DAMAGE SHIELD ABSORBS DAMAGE!';
    }
  }

  if (currentDamage > 0 && target.type !== 'player') {
    const targetAbilities: CardAbility[] =
      (target.entity as { card?: { enrichment?: { abilities?: CardAbility[] } } })?.card?.enrichment
        ?.abilities || [];
    const damageInterrupt = targetAbilities.find(
      (a) =>
        (a.timing === 'FORCED_INTERRUPT' || a.timing === 'INTERRUPT') &&
        a.trigger === 'DAMAGE_WOULD_BE_TAKEN',
    );
    if (damageInterrupt) {
      kernel.executeEffect(state, damageInterrupt, {
        playerId: state.players[0]?.id ?? '',
        damageAmount: currentDamage,
        interceptedValue: currentDamage,
      });
      currentDamage = 0;
      onomatopoeia = 'DAMAGE REPLACED!';
      appendLog(state, {
        category: 'combat',
        key: 'damage.prevented.replacement',
        params: { target: target.name },
        onomatopoeia,
      });
    }
  }

  // Every identity damage occurrence opens the step-3 "would take" window (Backflip on attacks,
  // Cosmic Flight on any damage) after Tough and damage shields (#268, #389). Open prompts pause it.
  if (target.type === 'player' && currentDamage > 0) {
    const player = target.entity as PlayerState;
    const opened = openWouldTakeWindow(state, request, player, currentDamage);
    currentDamage = opened.amount;
    if (opened.placementId) {
      return {
        state,
        result: {
          initialAmount: amount,
          damageDealt,
          damageTaken: 0,
          toughRemoved,
          absorbedByShield,
          targetDefeated: false,
          excessDamage: 0,
          onomatopoeia,
        },
        defeats: [],
        paused: {
          id: opened.placementId,
          targetPlayerId: player.id,
          sourceType: request.wouldTakeWindow ? 'ATTACK' : (request.sourceType ?? 'CARD_EFFECT'),
          amount: currentDamage,
          initialAmount: currentDamage,
          ...(request.wouldTakeWindow ? { attackId: request.wouldTakeWindow.attackId } : {}),
          resume: {
            request: resumableRequest(request),
            damageDealt,
            toughRemoved,
            absorbedByShield,
            onomatopoeia,
          },
        },
      };
    }
  }

  return placeDamage(
    state,
    request,
    { damageDealt, toughRemoved, absorbedByShield, onomatopoeia },
    currentDamage,
  );
}

interface PlacementFacts {
  damageDealt: number;
  toughRemoved: boolean;
  absorbedByShield?: ShieldAbsorptionInfo;
  onomatopoeia?: string;
}

/**
 * STEPS 5-8: placing the damage on the character, defeat handling and Overkill. Also where a paused
 * occurrence continues (`resumeDamage`).
 */
function placeDamage(
  state: GameState,
  request: DamageRequest,
  facts: PlacementFacts,
  damageTaken: number,
): ResolvedDamage {
  const { target, amount, isAttack, hasPiercing, sourcePlayerId } = request;

  const defeatRes = applyDamageAndCheckDefeat(
    state,
    target,
    damageTaken,
    sourcePlayerId,
    damageLogOrigin(state, request),
    defeatSourceOf(request),
    facts.onomatopoeia,
    request.logPlayerHit,
  );
  state = defeatRes.state;
  const result: DamageResult = {
    initialAmount: amount,
    damageDealt: facts.damageDealt,
    damageTaken,
    toughRemoved: facts.toughRemoved,
    absorbedByShield: facts.absorbedByShield,
    targetDefeated: defeatRes.targetDefeated,
    excessDamage: defeatRes.excessDamage,
    onomatopoeia: defeatRes.onomatopoeia,
  };
  const defeats: DefeatDispatch[] = defeatRes.pendingDefeat ? [defeatRes.pendingDefeat] : [];

  if (
    damageTaken > 0 &&
    (target.type === 'player' || target.type === 'villain') &&
    state.players.length > 0
  ) {
    const isPlayer = target.type === 'player';
    kernel.dispatchTrigger(state, 'DAMAGE_TAKEN', {
      targetPlayerId: isPlayer
        ? (target.entity as PlayerState).id
        : request.sourcePlayerId || getFirstPlayer(state).id,
      targetType: target.type,
      targetInstanceId: isPlayer ? undefined : (target.entity as VillainState).instanceId,
      damageAmount: damageTaken,
      triggerChain: request.triggerChain,
    });
  }

  // ---------------------------------------------------------------------------
  // Overkill: the excess over a defeated minion or ally goes to the villain or to the ally's
  // controller, as damage of the same attack (RR v1.8 glossary O), so Tough, shields and the
  // "would take" window of an identity apply.
  // ---------------------------------------------------------------------------
  const overkillTarget =
    request.hasOverkill && result.targetDefeated && result.excessDamage > 0
      ? overkillTargetOf(state, target, defeatRes.pendingDefeat)
      : undefined;
  if (overkillTarget) {
    const overkill = resolveDamage(state, {
      target: overkillTarget,
      amount: result.excessDamage,
      sourceType: 'OVERKILL',
      sourceCardInstance: request.sourceCardInstance,
      sourceInstanceId: request.sourceInstanceId,
      sourcePlayerId,
      isAttack,
      hasPiercing,
      skipRetaliate: true,
      // The defender stays the one who defended the attack: no `onPrevented`.
      wouldTakeWindow: request.wouldTakeWindow && {
        attackId: request.wouldTakeWindow.attackId,
        context: request.wouldTakeWindow.context,
      },
    });
    state = overkill.state;
    if (overkill.paused) {
      overkill.paused.resume.earlier = { result, defeats };
      return { state, result, defeats: [], paused: overkill.paused };
    }
    defeats.push(...overkill.defeats);
    logOverkillHit(state, overkillTarget, overkill.result.damageTaken);
  }

  return { state, result, defeats };
}

function logOverkillHit(state: GameState, target: TargetEntityRef, dealt: number): void {
  if (dealt <= 0) return;
  appendLog(state, {
    category: 'combat',
    key: 'overkill.hit',
    params: { amount: dealt, target: target.name },
    onomatopoeia:
      target.type === 'villain' ? `OVERKILL! ${dealt} DAMAGE TO VILLAIN!` : 'OVERKILL SPILLOVER!',
  });
}

function resumableRequest(request: DamageRequest): ResumableRequest {
  const {
    sourceType,
    sourceCardInstance,
    sourcePlayerId,
    sourceInstanceId,
    isAttack,
    hasPiercing,
    hasOverkill,
    skipRetaliate,
    triggerChain,
  } = request;
  return {
    sourceType,
    sourceCardInstance,
    sourcePlayerId,
    sourceInstanceId,
    isAttack,
    hasPiercing,
    hasOverkill,
    skipRetaliate,
    triggerChain,
  };
}

/**
 * Offers the interrupts to damage an identity is about to take (RR v1.8 Damage, step 3). Returns
 * the amount left after the interrupts that resolved at once; when prompts stay open it also
 * returns the id of the placement they are tagged with (`damagePlacementId`), which the caller
 * stores so the prompts can lower its live amount (#267, #268).
 */
function openWouldTakeWindow(
  state: GameState,
  request: DamageRequest,
  player: PlayerState,
  amount: number,
): { amount: number; placementId?: string } {
  const takeWindow = request.wouldTakeWindow;
  const promptsBefore = new Set((state.pendingDecisionQueue ?? []).map((p) => p.promptId));
  const dispatched = kernel.dispatchTrigger(state, 'DAMAGE_WOULD_BE_TAKEN', {
    targetType: 'player',
    targetCardCode: player.activeFormCard?.code,
    targetName: player.activeFormCard?.name || player.name,
    targetCurrentHp: player.health,
    targetMaxHp: player.maxHealth,
    encounterCardInstance: request.sourceCardInstance,
    triggerChain: request.triggerChain,
    ...takeWindow?.context,
    targetPlayerId: player.id,
    damageAmount: amount,
    ...(takeWindow || request.isAttack ? { damageSource: 'ATTACK' } : {}),
  });
  const remaining = dispatched.damageAmount ?? amount;
  if (remaining < amount) takeWindow?.onPrevented?.(amount - remaining);

  const prompts = (state.pendingDecisionQueue ?? []).filter((p) => !promptsBefore.has(p.promptId));
  if (!dispatched.hasPendingPrompt || prompts.length === 0) return { amount: remaining };

  const placementId = nextEngineId(state, 'damage_placement');
  for (const prompt of prompts) {
    for (const option of prompt.options) {
      if (option.effect === 'EXECUTE_OPTIONAL_TRIGGER' && option.params) {
        option.params = {
          ...option.params,
          context: { ...(option.params.context as object), damagePlacementId: placementId },
        };
      }
    }
  }
  return { amount: remaining, placementId };
}

export interface ResumeHooks {
  logPlayerHit?: DamageRequest['logPlayerHit'];
  /** Called with the damage the answered prompts took off, before the rest is placed. */
  onPrevented?: (prevented: number) => void;
}

/**
 * Finishes an occurrence that stopped at the "would take" window, once its prompts are answered:
 * places the live amount of `placement`, then announces every defeat of the occurrence in order
 * (an Overkill excess announces the ally's defeat first). Attack damage only, whose Retaliate is
 * step 7 of the attack (`skipRetaliate`).
 */
export function resumeDamage(
  state: GameState,
  placement: PendingDamagePlacement,
  hooks: ResumeHooks = {},
): { state: GameState; result: DamageResult } {
  const { resume } = placement;
  const player = state.players.find((p) => p.id === placement.targetPlayerId);
  if (!player) {
    throw new Error(`Paused damage ${placement.id} waits for ${placement.targetPlayerId}`);
  }
  const prevented = placement.initialAmount - placement.amount;
  if (prevented > 0) hooks.onPrevented?.(prevented);

  const { earlier } = resume;
  const target = playerTarget(player);
  const placed = placeDamage(
    state,
    {
      ...resume.request,
      target,
      amount: placement.initialAmount,
      // The ally stage logged its own hit; the excess is logged as Overkill below.
      logPlayerHit: earlier ? undefined : hooks.logPlayerHit,
    },
    resume,
    placement.amount,
  );
  state = placed.state;
  if (earlier) logOverkillHit(state, target, placed.result.damageTaken);
  for (const defeat of [...(earlier?.defeats ?? []), ...placed.defeats]) {
    dispatchDefeat(state, defeat);
  }
  return { state, result: earlier?.result ?? placed.result };
}

bindKernel({ applyDamageToTarget, applyDamageToTargets, defeatMinionsBeyondHitPoints });
