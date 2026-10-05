import {
  GameState,
  CardInstance,
  PlayerState,
  VillainState,
  MainSchemeState,
  SideSchemeState,
  StatusCard,
  Keyword,
  hasKeyword,
  getActiveVillain,
  getActiveMainScheme,
  getVillainsInPlay,
  getMainSchemesInPlay,
} from '@engine/models';
import { TargetSelector } from '../../data/supplemental/schema';
import type { EffectExecutionContext } from './index';
import { getEffectiveMaxHealth } from '../pipeline/stat-calculator';
import { hasCrisisInPlay } from '../pipeline/legality-checker';

export type EffectContext = Partial<EffectExecutionContext>;

export type ResolvedTarget =
  | {
      kind: 'character';
      entityType: 'hero' | 'alter_ego' | 'villain' | 'minion' | 'ally';
      entity: PlayerState | CardInstance | VillainState;
      id: string;
      player?: PlayerState;
    }
  | {
      kind: 'scheme';
      entityType: 'main_scheme' | 'side_scheme';
      entity: MainSchemeState | SideSchemeState;
      id: string;
    }
  | {
      kind: 'player';
      entity: PlayerState;
      id: string;
    }
  | {
      kind: 'card';
      entity: CardInstance;
      id: string;
    };

export type CharacterTarget = Extract<ResolvedTarget, { kind: 'character' }>;
export type SchemeTarget = Extract<ResolvedTarget, { kind: 'scheme' }>;
export type PlayerTarget = Extract<ResolvedTarget, { kind: 'player' }>;
export type CardTarget = Extract<ResolvedTarget, { kind: 'card' }>;

/**
 * Resolves a live entity by its instance ID from active game zones only (RR v1.8 p. 28).
 * Defeated or discarded cards in discard piles or victory display are never returned.
 */
export function resolveEntityByInstanceId(
  state: GameState,
  instanceId: string | undefined,
): ResolvedTarget | undefined {
  if (!instanceId) return undefined;

  // 1. Villain (any villain in play, by id or code; 'villain' means the active villain)
  const villain =
    instanceId === 'villain'
      ? getActiveVillain(state)
      : getVillainsInPlay(state).find(
          (v) => v.instanceId === instanceId || v.card?.code === instanceId,
        );
  if (villain) {
    return {
      kind: 'character',
      entityType: 'villain',
      entity: villain,
      id: villain.instanceId || 'villain',
    };
  }

  // 2. Main Scheme
  const mainScheme =
    instanceId === 'main_scheme'
      ? getActiveMainScheme(state)
      : getMainSchemesInPlay(state).find(
          (m) => m.instanceId === instanceId || m.card?.code === instanceId,
        );
  if (mainScheme) {
    return {
      kind: 'scheme',
      entityType: 'main_scheme',
      entity: mainScheme,
      id: mainScheme.instanceId || 'main_scheme',
    };
  }

  // 3. Side Schemes in play
  const sideScheme = (state.sideSchemes || []).find(
    (s) => s.instanceId === instanceId || s.card?.code === instanceId,
  );
  if (sideScheme) {
    return {
      kind: 'scheme',
      entityType: 'side_scheme',
      entity: sideScheme,
      id: sideScheme.instanceId,
    };
  }

  // 4. Players and their controlled/engaged entities
  for (const p of state.players) {
    if (
      p.id === instanceId ||
      p.hero?.code === instanceId ||
      p.alterEgo?.code === instanceId ||
      p.activeFormCard?.code === instanceId
    ) {
      return {
        kind: 'character',
        entityType: p.currentForm === 'hero' ? 'hero' : 'alter_ego',
        entity: p,
        id: p.id,
        player: p,
      };
    }

    const ally = (p.allies || []).find(
      (a) => a.instanceId === instanceId || a.card?.code === instanceId,
    );
    if (ally) {
      return {
        kind: 'character',
        entityType: 'ally',
        entity: ally,
        id: ally.instanceId,
        player: p,
      };
    }

    const minion = (p.engagedMinions || []).find(
      (m) => m.instanceId === instanceId || m.card?.code === instanceId,
    );
    if (minion) {
      return {
        kind: 'character',
        entityType: 'minion',
        entity: minion,
        id: minion.instanceId,
        player: p,
      };
    }

    const tableauCard = (p.tableau || []).find(
      (c) => c.instanceId === instanceId || c.card?.code === instanceId,
    );
    if (tableauCard) {
      return {
        kind: 'card',
        entity: tableauCard,
        id: tableauCard.instanceId,
      };
    }
  }

  return undefined;
}

/**
 * Universal Target Resolution Engine.
 * Maps any canonical TargetSelector (or context string) to an array of live ResolvedTargets.
 */
export function resolveTargets(
  state: GameState,
  selector: TargetSelector | string | undefined,
  context?: EffectContext,
): ResolvedTarget[] {
  if (!selector) return [];

  const resolvingPlayer =
    (context?.playerId ? state.players.find((p) => p.id === context.playerId) : undefined) ||
    state.players[state.activePlayerIndex] ||
    state.players[0];

  switch (selector) {
    // 1. IDENTITY & SELF
    case 'SELF': {
      if (context?.sourceCardInstance) {
        const inst = context.sourceCardInstance;
        // Check if source card is an ally, minion, side scheme, or generic card
        for (const p of state.players) {
          if (p.allies?.some((a) => a.instanceId === inst.instanceId)) {
            return [
              {
                kind: 'character',
                entityType: 'ally',
                entity: inst,
                id: inst.instanceId,
                player: p,
              },
            ];
          }
        }
        for (const p of state.players) {
          if (p.engagedMinions?.some((m) => m.instanceId === inst.instanceId)) {
            return [
              {
                kind: 'character',
                entityType: 'minion',
                entity: inst,
                id: inst.instanceId,
                player: p,
              },
            ];
          }
        }
        const sideScheme = (state.sideSchemes || []).find(
          (s) => s.instanceId === inst.instanceId || s.card?.code === inst.card?.code,
        );
        if (sideScheme) {
          return [
            {
              kind: 'scheme',
              entityType: 'side_scheme',
              entity: sideScheme,
              id: sideScheme.instanceId,
            },
          ];
        }
        return [
          {
            kind: 'card',
            entity: inst,
            id: inst.instanceId,
          },
        ];
      }
      if (context?.sourceCardId) {
        const found = resolveEntityByInstanceId(state, context.sourceCardId);
        if (found) return [found];
      }
      // Fallback: player identity
      return [
        {
          kind: 'character',
          entityType: resolvingPlayer.currentForm === 'hero' ? 'hero' : 'alter_ego',
          entity: resolvingPlayer,
          id: resolvingPlayer.id,
          player: resolvingPlayer,
        },
      ];
    }

    // "Your hero" (#222): the resolving player's identity only while it is in hero form. In
    // alter-ego form it resolves to nothing, never to the alter-ego, and never to another player.
    case 'SELF_HERO': {
      if (resolvingPlayer.currentForm !== 'hero') return [];
      return [
        {
          kind: 'character',
          entityType: 'hero',
          entity: resolvingPlayer,
          id: resolvingPlayer.id,
          player: resolvingPlayer,
        },
      ];
    }

    case 'IDENTITY':
    case 'SELF_IDENTITY': {
      return [
        {
          kind: 'character',
          entityType: resolvingPlayer.currentForm === 'hero' ? 'hero' : 'alter_ego',
          entity: resolvingPlayer,
          id: resolvingPlayer.id,
          player: resolvingPlayer,
        },
      ];
    }

    case 'TRIGGERING_HERO': {
      if (resolvingPlayer.currentForm === 'hero') {
        return [
          {
            kind: 'character',
            entityType: 'hero',
            entity: resolvingPlayer,
            id: resolvingPlayer.id,
            player: resolvingPlayer,
          },
        ];
      }
      return [];
    }

    case 'HERO': {
      const p =
        (context?.targetPlayerId
          ? state.players.find((pl) => pl.id === context.targetPlayerId)
          : undefined) || resolvingPlayer;
      if (p.currentForm === 'hero') {
        return [
          {
            kind: 'character',
            entityType: 'hero',
            entity: p,
            id: p.id,
            player: p,
          },
        ];
      }
      return [];
    }

    case 'DEFENDING_CHARACTER': {
      if (state.activeAttackContext) {
        if (
          state.activeAttackContext.defender?.type === 'ALLY' &&
          state.activeAttackContext.defender.allyInstanceId
        ) {
          const allyId = state.activeAttackContext.defender.allyInstanceId;
          for (const pl of state.players) {
            const allyInst = pl.allies?.find((a) => a.instanceId === allyId);
            if (allyInst) {
              return [
                {
                  kind: 'character',
                  entityType: 'ally',
                  entity: allyInst,
                  id: allyInst.instanceId,
                  player: pl,
                },
              ];
            }
          }
        }
        const p =
          (state.activeAttackContext.targetPlayerId
            ? state.players.find((pl) => pl.id === state.activeAttackContext!.targetPlayerId)
            : undefined) || resolvingPlayer;
        return [
          {
            kind: 'character',
            entityType: p.currentForm === 'hero' ? 'hero' : 'alter_ego',
            entity: p,
            id: p.id,
            player: p,
          },
        ];
      }
      return [
        {
          kind: 'character',
          entityType: resolvingPlayer.currentForm === 'hero' ? 'hero' : 'alter_ego',
          entity: resolvingPlayer,
          id: resolvingPlayer.id,
          player: resolvingPlayer,
        },
      ];
    }

    case 'DEFENDING_PLAYER': {
      const p =
        (state.activeAttackContext?.targetPlayerId
          ? state.players.find((pl) => pl.id === state.activeAttackContext!.targetPlayerId)
          : undefined) || resolvingPlayer;
      return [{ kind: 'player', entity: p, id: p.id }];
    }

    // 2. PLAYERS
    case 'PLAYER':
    case 'ACTIVE_PLAYER': {
      const activeP = state.players[state.activePlayerIndex] || resolvingPlayer || state.players[0];
      return [{ kind: 'player', entity: activeP, id: activeP.id }];
    }

    case 'CHOSEN_PLAYER': {
      if (context?.targetPlayerId) {
        const p = state.players.find(
          (pl) =>
            pl.id === context.targetPlayerId ||
            pl.hero?.code === context.targetPlayerId ||
            pl.alterEgo?.code === context.targetPlayerId ||
            pl.activeFormCard?.code === context.targetPlayerId,
        );
        if (p) return [{ kind: 'player', entity: p, id: p.id }];
      }
      if (context?.targetInstanceId) {
        const p = state.players.find(
          (pl) =>
            pl.id === context.targetInstanceId ||
            pl.hero?.code === context.targetInstanceId ||
            pl.alterEgo?.code === context.targetInstanceId ||
            pl.activeFormCard?.code === context.targetInstanceId,
        );
        if (p) return [{ kind: 'player', entity: p, id: p.id }];
      }
      return [{ kind: 'player', entity: resolvingPlayer, id: resolvingPlayer.id }];
    }

    case 'ALL_PLAYERS': {
      return state.players.map((p) => ({
        kind: 'player',
        entity: p,
        id: p.id,
      }));
    }

    // 3. CONTROLLED ENTITIES
    case 'CHOSEN_CONTROLLED_ALLY': {
      const ally =
        (context?.targetInstanceId
          ? resolvingPlayer.allies?.find((a) => a.instanceId === context.targetInstanceId)
          : undefined) || resolvingPlayer.allies?.[0];
      if (ally) {
        return [
          {
            kind: 'character',
            entityType: 'ally',
            entity: ally,
            id: ally.instanceId,
            player: resolvingPlayer,
          },
        ];
      }
      return [];
    }

    case 'ALL_CONTROLLED_ALLIES': {
      return (resolvingPlayer.allies || []).map((a) => ({
        kind: 'character',
        entityType: 'ally',
        entity: a,
        id: a.instanceId,
        player: resolvingPlayer,
      }));
    }

    case 'ALL_CONTROLLED_TABLEAU': {
      // Zone-generic: every card in the acting player's tableau. Narrow by type/trait/etc. with
      // the step `filter` (UniversalCardFilter), e.g. { types: ['upgrade'] } (Issue #158).
      return (resolvingPlayer.tableau || []).map((c) => ({
        kind: 'card' as const,
        entity: c,
        id: c.instanceId,
      }));
    }

    case 'CHOSEN_CONTROLLED_CHARACTER': {
      if (context?.targetInstanceId) {
        if (context.targetInstanceId === resolvingPlayer.id) {
          return [
            {
              kind: 'character',
              entityType: resolvingPlayer.currentForm === 'hero' ? 'hero' : 'alter_ego',
              entity: resolvingPlayer,
              id: resolvingPlayer.id,
              player: resolvingPlayer,
            },
          ];
        }
        const ally = resolvingPlayer.allies?.find((a) => a.instanceId === context.targetInstanceId);
        if (ally) {
          return [
            {
              kind: 'character',
              entityType: 'ally',
              entity: ally,
              id: ally.instanceId,
              player: resolvingPlayer,
            },
          ];
        }
      }
      return [
        {
          kind: 'character',
          entityType: resolvingPlayer.currentForm === 'hero' ? 'hero' : 'alter_ego',
          entity: resolvingPlayer,
          id: resolvingPlayer.id,
          player: resolvingPlayer,
        },
      ];
    }

    case 'ALL_CONTROLLED_CHARACTERS': {
      const results: ResolvedTarget[] = [
        {
          kind: 'character',
          entityType: resolvingPlayer.currentForm === 'hero' ? 'hero' : 'alter_ego',
          entity: resolvingPlayer,
          id: resolvingPlayer.id,
          player: resolvingPlayer,
        },
      ];
      for (const a of resolvingPlayer.allies || []) {
        results.push({
          kind: 'character',
          entityType: 'ally',
          entity: a,
          id: a.instanceId,
          player: resolvingPlayer,
        });
      }
      return results;
    }

    // 4. FRIENDLY ENTITIES (Across Table)
    case 'CHOSEN_ALLY': {
      if (context?.targetInstanceId) {
        for (const p of state.players) {
          const ally = (p.allies || []).find((a) => a.instanceId === context.targetInstanceId);
          if (ally) {
            return [
              {
                kind: 'character',
                entityType: 'ally',
                entity: ally,
                id: ally.instanceId,
                player: p,
              },
            ];
          }
        }
      }
      for (const p of state.players) {
        if (p.allies && p.allies.length > 0) {
          return [
            {
              kind: 'character',
              entityType: 'ally',
              entity: p.allies[0],
              id: p.allies[0].instanceId,
              player: p,
            },
          ];
        }
      }
      return [];
    }

    case 'ALL_ALLIES': {
      const results: ResolvedTarget[] = [];
      for (const p of state.players) {
        for (const a of p.allies || []) {
          results.push({
            kind: 'character',
            entityType: 'ally',
            entity: a,
            id: a.instanceId,
            player: p,
          });
        }
      }
      return results;
    }

    case 'CHOSEN_FRIENDLY_CHARACTER': {
      if (context?.targetInstanceId) {
        const found = resolveEntityByInstanceId(state, context.targetInstanceId);
        if (
          found &&
          found.kind === 'character' &&
          (found.entityType === 'hero' ||
            found.entityType === 'alter_ego' ||
            found.entityType === 'ally')
        ) {
          return [found];
        }
      }
      return [
        {
          kind: 'character',
          entityType: resolvingPlayer.currentForm === 'hero' ? 'hero' : 'alter_ego',
          entity: resolvingPlayer,
          id: resolvingPlayer.id,
          player: resolvingPlayer,
        },
      ];
    }

    case 'ALL_FRIENDLY_CHARACTERS': {
      const results: ResolvedTarget[] = [];
      for (const p of state.players) {
        results.push({
          kind: 'character',
          entityType: p.currentForm === 'hero' ? 'hero' : 'alter_ego',
          entity: p,
          id: p.id,
          player: p,
        });
        for (const a of p.allies || []) {
          results.push({
            kind: 'character',
            entityType: 'ally',
            entity: a,
            id: a.instanceId,
            player: p,
          });
        }
      }
      return results;
    }

    case 'ALL_HEROES': {
      return state.players
        .filter((p) => p.currentForm === 'hero')
        .map((p) => ({
          kind: 'character',
          entityType: 'hero',
          entity: p,
          id: p.id,
          player: p,
        }));
    }

    case 'ALL_HEROES_AND_ALLIES': {
      const results: ResolvedTarget[] = [];
      for (const p of state.players) {
        if (p.currentForm === 'hero') {
          results.push({
            kind: 'character',
            entityType: 'hero',
            entity: p,
            id: p.id,
            player: p,
          });
        }
        for (const a of p.allies || []) {
          results.push({
            kind: 'character',
            entityType: 'ally',
            entity: a,
            id: a.instanceId,
            player: p,
          });
        }
      }
      return results;
    }

    // 5. ENEMIES & MINIONS
    case 'VILLAIN': {
      const activeVillain = getActiveVillain(state);
      if (activeVillain) {
        return [
          {
            kind: 'character',
            entityType: 'villain',
            entity: activeVillain,
            id: activeVillain.instanceId || 'villain',
          },
        ];
      }
      return [];
    }

    case 'CHOSEN_ENEMY': {
      if (context?.targetType === 'villain') {
        const activeVillain = getActiveVillain(state);
        if (activeVillain) {
          return [
            {
              kind: 'character',
              entityType: 'villain',
              entity: activeVillain,
              id: activeVillain.instanceId || 'villain',
            },
          ];
        }
      }
      if (context?.targetInstanceId) {
        const found = resolveEntityByInstanceId(state, context.targetInstanceId);
        if (
          found &&
          found.kind === 'character' &&
          (found.entityType === 'villain' || found.entityType === 'minion')
        ) {
          return [found];
        }
      }
      // Fallback: active player's first engaged minion, or villain
      const firstEngaged = resolvingPlayer.engagedMinions?.[0];
      if (firstEngaged) {
        return [
          {
            kind: 'character',
            entityType: 'minion',
            entity: firstEngaged,
            id: firstEngaged.instanceId,
            player: resolvingPlayer,
          },
        ];
      }
      const activeVillain = getActiveVillain(state);
      if (activeVillain) {
        return [
          {
            kind: 'character',
            entityType: 'villain',
            entity: activeVillain,
            id: activeVillain.instanceId || 'villain',
          },
        ];
      }
      return [];
    }

    case 'ALL_ENEMIES': {
      const results: ResolvedTarget[] = [];
      for (const villain of getVillainsInPlay(state)) {
        results.push({
          kind: 'character',
          entityType: 'villain',
          entity: villain,
          id: villain.instanceId || 'villain',
        });
      }
      for (const p of state.players) {
        for (const m of p.engagedMinions || []) {
          results.push({
            kind: 'character',
            entityType: 'minion',
            entity: m,
            id: m.instanceId,
            player: p,
          });
        }
      }
      return results;
    }

    case 'ENGAGED_ENEMIES': {
      const results: ResolvedTarget[] = [];
      const activeVillain = getActiveVillain(state);
      if (activeVillain) {
        results.push({
          kind: 'character',
          entityType: 'villain',
          entity: activeVillain,
          id: activeVillain.instanceId || 'villain',
        });
      }
      for (const m of resolvingPlayer.engagedMinions || []) {
        results.push({
          kind: 'character',
          entityType: 'minion',
          entity: m,
          id: m.instanceId,
          player: resolvingPlayer,
        });
      }
      return results;
    }

    case 'CHOSEN_MINION': {
      if (context?.targetInstanceId) {
        for (const p of state.players) {
          const m = (p.engagedMinions || []).find(
            (em) => em.instanceId === context.targetInstanceId,
          );
          if (m) {
            return [
              {
                kind: 'character',
                entityType: 'minion',
                entity: m,
                id: m.instanceId,
                player: p,
              },
            ];
          }
        }
      }
      // Fallback: active player's first engaged minion or first minion at table
      const activeMinion = resolvingPlayer.engagedMinions?.[0];
      if (activeMinion) {
        return [
          {
            kind: 'character',
            entityType: 'minion',
            entity: activeMinion,
            id: activeMinion.instanceId,
            player: resolvingPlayer,
          },
        ];
      }
      for (const p of state.players) {
        if (p.engagedMinions && p.engagedMinions.length > 0) {
          return [
            {
              kind: 'character',
              entityType: 'minion',
              entity: p.engagedMinions[0],
              id: p.engagedMinions[0].instanceId,
              player: p,
            },
          ];
        }
      }
      return [];
    }

    case 'CHOSEN_ENGAGED_MINION': {
      const m =
        (context?.targetInstanceId
          ? resolvingPlayer.engagedMinions?.find((em) => em.instanceId === context.targetInstanceId)
          : undefined) || resolvingPlayer.engagedMinions?.[0];
      if (m) {
        return [
          {
            kind: 'character',
            entityType: 'minion',
            entity: m,
            id: m.instanceId,
            player: resolvingPlayer,
          },
        ];
      }
      return [];
    }

    case 'ENGAGED_MINIONS': {
      return (resolvingPlayer.engagedMinions || []).map((m) => ({
        kind: 'character',
        entityType: 'minion',
        entity: m,
        id: m.instanceId,
        player: resolvingPlayer,
      }));
    }

    case 'ALL_MINIONS': {
      const results: ResolvedTarget[] = [];
      for (const p of state.players) {
        for (const m of p.engagedMinions || []) {
          results.push({
            kind: 'character',
            entityType: 'minion',
            entity: m,
            id: m.instanceId,
            player: p,
          });
        }
      }
      return results;
    }

    case 'TRIGGERING_MINION': {
      if (context?.targetInstanceId) {
        const found = resolveEntityByInstanceId(state, context.targetInstanceId);
        if (found && found.kind === 'character' && found.entityType === 'minion') {
          return [found];
        }
      }
      const firstM = resolvingPlayer.engagedMinions?.[0];
      if (firstM) {
        return [
          {
            kind: 'character',
            entityType: 'minion',
            entity: firstM,
            id: firstM.instanceId,
            player: resolvingPlayer,
          },
        ];
      }
      return [];
    }

    case 'TRIGGERING_ENEMY': {
      if (context?.targetInstanceId) {
        const found = resolveEntityByInstanceId(state, context.targetInstanceId);
        if (
          found &&
          found.kind === 'character' &&
          (found.entityType === 'villain' || found.entityType === 'minion')
        ) {
          return [found];
        }
      }
      const activeVillain = getActiveVillain(state);
      if (activeVillain) {
        return [
          {
            kind: 'character',
            entityType: 'villain',
            entity: activeVillain,
            id: activeVillain.instanceId || 'villain',
          },
        ];
      }
      return [];
    }

    case 'HOST':
    case 'HOST_ENEMY': {
      if (context?.sourceCardInstance) {
        const sourceInstId = context.sourceCardInstance.instanceId;
        // 1. Check villain attachments
        const hostVillain = getVillainsInPlay(state).find((v) =>
          v.attachments?.some((a) => a.instanceId === sourceInstId),
        );
        if (hostVillain) {
          return [
            {
              kind: 'character',
              entityType: 'villain',
              entity: hostVillain,
              id: hostVillain.instanceId || 'villain',
            },
          ];
        }
        // 2. Check engaged minions across all players
        for (const player of state.players) {
          const minion = (player.engagedMinions || []).find((m) =>
            m.attachments?.some((a) => a.instanceId === sourceInstId),
          );
          if (minion) {
            return [
              {
                kind: 'character',
                entityType: 'minion',
                entity: minion,
                id: minion.instanceId,
                player,
              },
            ];
          }
        }
        // 3. Check player attachments
        if (selector === 'HOST') {
          for (const player of state.players) {
            if (player.attachments?.some((a) => a.instanceId === sourceInstId)) {
              return [
                {
                  kind: 'character',
                  entityType: player.currentForm === 'hero' ? 'hero' : 'alter_ego',
                  entity: player,
                  id: player.id,
                  player,
                },
              ];
            }
          }
        }
        // 4. Check hostInstanceId stored on source card if already detached
        const hostId = (context.sourceCardInstance as any).hostInstanceId;
        if (hostId) {
          const found = resolveEntityByInstanceId(state, hostId);
          if (found) {
            if (selector === 'HOST_ENEMY') {
              if (
                found.kind === 'character' &&
                (found.entityType === 'villain' || found.entityType === 'minion')
              ) {
                return [found];
              }
            } else {
              return [found];
            }
          }
        }
      }
      // 5. Fallback to targetInstanceId from context
      if (context?.targetInstanceId) {
        const found = resolveEntityByInstanceId(state, context.targetInstanceId);
        if (found) {
          if (selector === 'HOST_ENEMY') {
            if (
              found.kind === 'character' &&
              (found.entityType === 'villain' || found.entityType === 'minion')
            ) {
              return [found];
            }
          } else {
            return [found];
          }
        }
      }
      return [];
    }

    // 6. UNIVERSAL CHARACTERS
    case 'CHOSEN_CHARACTER': {
      if (context?.targetInstanceId) {
        const found = resolveEntityByInstanceId(state, context.targetInstanceId);
        if (found && found.kind === 'character') {
          return [found];
        }
      }
      return [
        {
          kind: 'character',
          entityType: resolvingPlayer.currentForm === 'hero' ? 'hero' : 'alter_ego',
          entity: resolvingPlayer,
          id: resolvingPlayer.id,
          player: resolvingPlayer,
        },
      ];
    }

    case 'ALL_CHARACTERS': {
      const results: ResolvedTarget[] = [];
      for (const villain of getVillainsInPlay(state)) {
        results.push({
          kind: 'character',
          entityType: 'villain',
          entity: villain,
          id: villain.instanceId || 'villain',
        });
      }
      for (const p of state.players) {
        results.push({
          kind: 'character',
          entityType: p.currentForm === 'hero' ? 'hero' : 'alter_ego',
          entity: p,
          id: p.id,
          player: p,
        });
        for (const a of p.allies || []) {
          results.push({
            kind: 'character',
            entityType: 'ally',
            entity: a,
            id: a.instanceId,
            player: p,
          });
        }
        for (const m of p.engagedMinions || []) {
          results.push({
            kind: 'character',
            entityType: 'minion',
            entity: m,
            id: m.instanceId,
            player: p,
          });
        }
      }
      return results;
    }

    // 7. SCHEMES
    case 'MAIN_SCHEME': {
      const activeMainScheme = getActiveMainScheme(state);
      if (activeMainScheme) {
        return [
          {
            kind: 'scheme',
            entityType: 'main_scheme',
            entity: activeMainScheme,
            id: activeMainScheme.instanceId || 'main_scheme',
          },
        ];
      }
      return [];
    }

    case 'THIS_SIDE_SCHEME': {
      if (context?.sourceCardInstance) {
        const inst = context.sourceCardInstance;
        const side = (state.sideSchemes || []).find(
          (s) => s.instanceId === inst.instanceId || s.card?.code === inst.card?.code,
        );
        if (side) {
          return [
            {
              kind: 'scheme',
              entityType: 'side_scheme',
              entity: side,
              id: side.instanceId,
            },
          ];
        }
      }
      if (state.sideSchemes && state.sideSchemes.length > 0) {
        return [
          {
            kind: 'scheme',
            entityType: 'side_scheme',
            entity: state.sideSchemes[0],
            id: state.sideSchemes[0].instanceId,
          },
        ];
      }
      return [];
    }

    case 'SIDE_SCHEME':
    case 'CHOSEN_SIDE_SCHEME': {
      if (context?.targetInstanceId) {
        const side = (state.sideSchemes || []).find(
          (s) =>
            s.instanceId === context.targetInstanceId || s.card?.code === context.targetInstanceId,
        );
        if (side) {
          return [
            {
              kind: 'scheme',
              entityType: 'side_scheme',
              entity: side,
              id: side.instanceId,
            },
          ];
        }
      }
      const firstSide = state.sideSchemes?.[0];
      if (firstSide) {
        return [
          {
            kind: 'scheme',
            entityType: 'side_scheme',
            entity: firstSide,
            id: firstSide.instanceId,
          },
        ];
      }
      return [];
    }

    case 'CHOSEN_SCHEME': {
      const ignoresCrisis = Boolean(
        context?.ignoresCrisis || (context as any)?.step?.effectParams?.ignoresCrisis,
      );
      const isPlayerSource = context?.sourceCardInstance?.card?.faction !== 'encounter';
      const player = context?.playerId
        ? state.players.find((p) => p.id === context.playerId)
        : context?.sourceCardInstance
          ? state.players.find((p) => p.id === context.sourceCardInstance?.ownerId)
          : undefined;
      const hasPatrol = player
        ? (player.engagedMinions || []).some((m) => hasKeyword(m.card, Keyword.PATROL))
        : false;
      const isMainBlocked =
        !ignoresCrisis && isPlayerSource && (hasCrisisInPlay(state) || hasPatrol);

      if (context?.targetInstanceId) {
        const chosenMainScheme = getActiveMainScheme(state);
        if (
          chosenMainScheme &&
          (context.targetInstanceId === chosenMainScheme.instanceId ||
            context.targetInstanceId === 'main_scheme' ||
            context.targetInstanceId === chosenMainScheme.card?.code)
        ) {
          if (isMainBlocked) {
            return [];
          }
          return [
            {
              kind: 'scheme',
              entityType: 'main_scheme',
              entity: chosenMainScheme,
              id: chosenMainScheme.instanceId || 'main_scheme',
            },
          ];
        }
        const side = (state.sideSchemes || []).find(
          (s) =>
            s.instanceId === context.targetInstanceId || s.card?.code === context.targetInstanceId,
        );
        if (side) {
          return [
            {
              kind: 'scheme',
              entityType: 'side_scheme',
              entity: side,
              id: side.instanceId,
            },
          ];
        }
        if (isMainBlocked) {
          return [];
        }
      }
      const activeMainScheme = getActiveMainScheme(state);
      if (activeMainScheme && !isMainBlocked) {
        return [
          {
            kind: 'scheme',
            entityType: 'main_scheme',
            entity: activeMainScheme,
            id: activeMainScheme.instanceId || 'main_scheme',
          },
        ];
      }
      const sideWithThreat =
        (state.sideSchemes || []).find((s) => (s.threat || 0) > 0) || (state.sideSchemes || [])[0];
      if (sideWithThreat) {
        return [
          {
            kind: 'scheme',
            entityType: 'side_scheme',
            entity: sideWithThreat,
            id: sideWithThreat.instanceId,
          },
        ];
      }
      return [];
    }

    case 'ALL_SIDE_SCHEMES': {
      return (state.sideSchemes || []).map((s) => ({
        kind: 'scheme',
        entityType: 'side_scheme',
        entity: s,
        id: s.instanceId,
      }));
    }

    case 'ALL_SCHEMES': {
      const results: ResolvedTarget[] = [];
      const activeMainScheme = getActiveMainScheme(state);
      if (activeMainScheme) {
        results.push({
          kind: 'scheme',
          entityType: 'main_scheme',
          entity: activeMainScheme,
          id: activeMainScheme.instanceId || 'main_scheme',
        });
      }
      for (const s of state.sideSchemes || []) {
        results.push({
          kind: 'scheme',
          entityType: 'side_scheme',
          entity: s,
          id: s.instanceId,
        });
      }
      return results;
    }

    case 'TRIGGERING_SCHEME': {
      if (context?.targetInstanceId) {
        const found = resolveEntityByInstanceId(state, context.targetInstanceId);
        if (found && found.kind === 'scheme') {
          return [found];
        }
      }
      const activeMainScheme = getActiveMainScheme(state);
      if (activeMainScheme) {
        return [
          {
            kind: 'scheme',
            entityType: 'main_scheme',
            entity: activeMainScheme,
            id: activeMainScheme.instanceId || 'main_scheme',
          },
        ];
      }
      return [];
    }

    // 8. CONTINUITY
    case 'ATTACK_TARGET':
    case 'ATTACKED_ENEMY':
    case 'TARGET_ENEMY':
    case 'PREVIOUS_TARGET': {
      const targetId = context?.targetInstanceId || context?.previousResult?.targetId;
      if (targetId) {
        const found = resolveEntityByInstanceId(state, targetId);
        if (found) return [found];
      }
      if (context?.targetType === 'villain') {
        const activeVillain = getActiveVillain(state);
        if (activeVillain) {
          return [
            {
              kind: 'character',
              entityType: 'villain',
              entity: activeVillain,
              id: activeVillain.instanceId || 'villain',
            },
          ];
        }
      }
      if (context?.targetType === 'hero' || context?.targetType === 'identity') {
        return [
          {
            kind: 'character',
            entityType: resolvingPlayer.currentForm === 'hero' ? 'hero' : 'alter_ego',
            entity: resolvingPlayer,
            id: resolvingPlayer.id,
            player: resolvingPlayer,
          },
        ];
      }
      if (context?.targetType === 'minion') {
        const firstM = resolvingPlayer.engagedMinions?.[0];
        if (firstM) {
          return [
            {
              kind: 'character',
              entityType: 'minion',
              entity: firstM,
              id: firstM.instanceId,
              player: resolvingPlayer,
            },
          ];
        }
      }
      // Fallback: villain
      const activeVillain = getActiveVillain(state);
      if (activeVillain) {
        return [
          {
            kind: 'character',
            entityType: 'villain',
            entity: activeVillain,
            id: activeVillain.instanceId || 'villain',
          },
        ];
      }
      return [];
    }

    case 'PREVIOUS_SELECTED_CARD': {
      const cardId =
        context?.collectedCardInstanceIds?.[0] ||
        context?.previousResult?.selectedCardInstanceIds?.[0] ||
        context?.targetInstanceId;
      if (cardId) {
        const found = resolveEntityByInstanceId(state, cardId);
        if (found && found.kind === 'card') return [found];
      }
      return [];
    }

    default: {
      // Fallback for custom or direct instance id strings
      if (context?.targetInstanceId) {
        const found = resolveEntityByInstanceId(state, context.targetInstanceId);
        if (found) return [found];
      }
      // Check if selector matches a side scheme card code or id
      const side = (state.sideSchemes || []).find(
        (s) => s.instanceId === selector || s.card?.code === selector,
      );
      if (side) {
        return [
          {
            kind: 'scheme',
            entityType: 'side_scheme',
            entity: side,
            id: side.instanceId,
          },
        ];
      }
      const direct = resolveEntityByInstanceId(state, selector);
      if (direct) return [direct];
      return [];
    }
  }
}

/**
 * Resolves character targets (Hero, Alter-Ego, Villain, Minion, Ally) from a target selector.
 */
export function resolveCharacterTargets(
  state: GameState,
  selector: TargetSelector | string | undefined,
  context?: EffectContext,
): CharacterTarget[] {
  const resolved = resolveTargets(state, selector, context);
  const characters: CharacterTarget[] = [];

  for (const t of resolved) {
    if (t.kind === 'character') {
      characters.push(t);
    } else if (t.kind === 'player') {
      characters.push({
        kind: 'character',
        entityType: t.entity.currentForm === 'hero' ? 'hero' : 'alter_ego',
        entity: t.entity,
        id: t.id,
        player: t.entity,
      });
    }
  }

  return characters;
}

/**
 * Resolves scheme targets (Main Scheme, Side Scheme) from a target selector.
 */
export function resolveSchemeTargets(
  state: GameState,
  selector: TargetSelector | string | undefined,
  context?: EffectContext,
): SchemeTarget[] {
  const resolved = resolveTargets(state, selector, context);
  return resolved.filter((t): t is SchemeTarget => t.kind === 'scheme');
}

/**
 * Resolves player targets from a target selector.
 */
export function resolvePlayerTargets(
  state: GameState,
  selector: TargetSelector | string | undefined,
  context?: EffectContext,
): PlayerState[] {
  const resolved = resolveTargets(state, selector, context);
  const players: PlayerState[] = [];
  const seenIds = new Set<string>();

  for (const t of resolved) {
    let p: PlayerState | undefined;
    if (t.kind === 'player') {
      p = t.entity;
    } else if (t.kind === 'character') {
      if (t.entityType === 'hero' || t.entityType === 'alter_ego') {
        p = t.entity as PlayerState;
      } else if (t.player) {
        p = t.player;
      }
    }
    if (p && !seenIds.has(p.id)) {
      seenIds.add(p.id);
      players.push(p);
    }
  }

  return players;
}

/**
 * Resolves card targets from a target selector.
 */
export function resolveCardTargets(
  state: GameState,
  selector: TargetSelector | string | undefined,
  context?: EffectContext,
): CardInstance[] {
  const resolved = resolveTargets(state, selector, context);
  const cards: CardInstance[] = [];
  const seenIds = new Set<string>();

  for (const t of resolved) {
    let cardInst: CardInstance | undefined;
    if (t.kind === 'card') {
      cardInst = t.entity;
    } else if (
      t.kind === 'character' &&
      (t.entityType === 'ally' || t.entityType === 'minion') &&
      'card' in t.entity
    ) {
      cardInst = t.entity as CardInstance;
    }
    if (cardInst && !seenIds.has(cardInst.instanceId)) {
      seenIds.add(cardInst.instanceId);
      cards.push(cardInst);
    }
  }

  return cards;
}

export interface TargetFilterOptions {
  damaged?: boolean;
  exhausted?: boolean;
  traits?: string[];
  status?: StatusCard | 'STUNNED' | 'CONFUSED' | 'TOUGH';
  maxPerHost?: number;
  ignoresCrisis?: boolean;
  isPlayerSource?: boolean;
}

/**
 * Returns all live game entities structurally eligible for the given target selector,
 * filtered by optional criteria (damaged, exhausted, traits, status).
 * If no filters are provided, returns the complete unfiltered set of candidate entities.
 */
export function getEligibleTargets(
  state: GameState,
  resolvingPlayer: PlayerState,
  targetScope: TargetSelector | string,
  filterOptions?: TargetFilterOptions,
): ResolvedTarget[] {
  const candidates: ResolvedTarget[] = [];

  switch (targetScope) {
    case 'CHOSEN_CHARACTER': {
      // 1. All players
      for (const p of state.players) {
        candidates.push({
          kind: 'character',
          entityType: p.currentForm === 'hero' ? 'hero' : 'alter_ego',
          entity: p,
          id: p.id,
          player: p,
        });
      }
      // 2. All allies
      for (const p of state.players) {
        for (const a of p.allies || []) {
          candidates.push({
            kind: 'character',
            entityType: 'ally',
            entity: a,
            id: a.instanceId,
            player: p,
          });
        }
      }
      // 3. Villain
      for (const villain of getVillainsInPlay(state)) {
        candidates.push({
          kind: 'character',
          entityType: 'villain',
          entity: villain,
          id: villain.instanceId || villain.card.code,
        });
      }
      // 4. All minions
      for (const p of state.players) {
        for (const m of p.engagedMinions || []) {
          candidates.push({
            kind: 'character',
            entityType: 'minion',
            entity: m,
            id: m.instanceId,
            player: p,
          });
        }
      }
      break;
    }

    case 'CHOSEN_FRIENDLY_CHARACTER': {
      for (const p of state.players) {
        candidates.push({
          kind: 'character',
          entityType: p.currentForm === 'hero' ? 'hero' : 'alter_ego',
          entity: p,
          id: p.id,
          player: p,
        });
        for (const a of p.allies || []) {
          candidates.push({
            kind: 'character',
            entityType: 'ally',
            entity: a,
            id: a.instanceId,
            player: p,
          });
        }
      }
      break;
    }

    case 'CHOSEN_CONTROLLED_CHARACTER': {
      candidates.push({
        kind: 'character',
        entityType: resolvingPlayer.currentForm === 'hero' ? 'hero' : 'alter_ego',
        entity: resolvingPlayer,
        id: resolvingPlayer.id,
        player: resolvingPlayer,
      });
      for (const a of resolvingPlayer.allies || []) {
        candidates.push({
          kind: 'character',
          entityType: 'ally',
          entity: a,
          id: a.instanceId,
          player: resolvingPlayer,
        });
      }
      break;
    }

    case 'CHOSEN_ALLY': {
      for (const p of state.players) {
        for (const a of p.allies || []) {
          candidates.push({
            kind: 'character',
            entityType: 'ally',
            entity: a,
            id: a.instanceId,
            player: p,
          });
        }
      }
      break;
    }

    case 'CHOSEN_CONTROLLED_ALLY': {
      for (const a of resolvingPlayer.allies || []) {
        candidates.push({
          kind: 'character',
          entityType: 'ally',
          entity: a,
          id: a.instanceId,
          player: resolvingPlayer,
        });
      }
      break;
    }

    case 'CHOSEN_MINION': {
      for (const p of state.players) {
        for (const m of p.engagedMinions || []) {
          candidates.push({
            kind: 'character',
            entityType: 'minion',
            entity: m,
            id: m.instanceId,
            player: p,
          });
        }
      }
      break;
    }

    case 'CHOSEN_ENGAGED_MINION': {
      for (const m of resolvingPlayer.engagedMinions || []) {
        candidates.push({
          kind: 'character',
          entityType: 'minion',
          entity: m,
          id: m.instanceId,
          player: resolvingPlayer,
        });
      }
      break;
    }

    case 'SELF_HERO': {
      if (resolvingPlayer.currentForm === 'hero') {
        candidates.push({
          kind: 'character',
          entityType: 'hero',
          entity: resolvingPlayer,
          id: resolvingPlayer.id,
          player: resolvingPlayer,
        });
      }
      break;
    }

    case 'SELF':
    case 'SELF_IDENTITY':
    case 'IDENTITY': {
      candidates.push({
        kind: 'character',
        entityType: resolvingPlayer.currentForm === 'hero' ? 'hero' : 'alter_ego',
        entity: resolvingPlayer,
        id: resolvingPlayer.id,
        player: resolvingPlayer,
      });
      break;
    }

    case 'CHOSEN_HERO': {
      for (const p of state.players) {
        if (p.currentForm === 'hero') {
          candidates.push({
            kind: 'character',
            entityType: 'hero',
            entity: p,
            id: p.id,
            player: p,
          });
        }
      }
      break;
    }

    case 'HERO': {
      if (resolvingPlayer.currentForm === 'hero') {
        candidates.push({
          kind: 'character',
          entityType: 'hero',
          entity: resolvingPlayer,
          id: resolvingPlayer.id,
          player: resolvingPlayer,
        });
      }
      break;
    }

    case 'ALTER_EGO': {
      if (resolvingPlayer.currentForm === 'alter_ego') {
        candidates.push({
          kind: 'character',
          entityType: 'alter_ego',
          entity: resolvingPlayer,
          id: resolvingPlayer.id,
          player: resolvingPlayer,
        });
      }
      break;
    }

    case 'CHOSEN_ENEMY': {
      for (const villain of getVillainsInPlay(state)) {
        candidates.push({
          kind: 'character',
          entityType: 'villain',
          entity: villain,
          id: villain.instanceId || villain.card.code,
        });
      }
      for (const p of state.players) {
        for (const m of p.engagedMinions || []) {
          candidates.push({
            kind: 'character',
            entityType: 'minion',
            entity: m,
            id: m.instanceId,
            player: p,
          });
        }
      }
      break;
    }

    case 'CHOSEN_PLAYER': {
      for (const p of state.players) {
        candidates.push({
          kind: 'player',
          entity: p,
          id: p.id,
        });
      }
      break;
    }

    case 'CHOSEN_SCHEME': {
      const isPlayerSource = filterOptions?.isPlayerSource ?? true;
      const hasPatrol = (resolvingPlayer?.engagedMinions || []).some((m) =>
        hasKeyword(m.card, Keyword.PATROL),
      );
      const isMainBlocked =
        isPlayerSource && (hasCrisisInPlay(state) || hasPatrol) && !filterOptions?.ignoresCrisis;

      const activeMainScheme = getActiveMainScheme(state);
      if (activeMainScheme && !isMainBlocked) {
        candidates.push({
          kind: 'scheme',
          entityType: 'main_scheme',
          entity: activeMainScheme,
          id: activeMainScheme.instanceId || activeMainScheme.card.code,
        });
      }
      for (const s of state.sideSchemes || []) {
        candidates.push({
          kind: 'scheme',
          entityType: 'side_scheme',
          entity: s,
          id: s.instanceId,
        });
      }
      break;
    }

    case 'CHOSEN_SIDE_SCHEME': {
      for (const s of state.sideSchemes || []) {
        candidates.push({
          kind: 'scheme',
          entityType: 'side_scheme',
          entity: s,
          id: s.instanceId,
        });
      }
      break;
    }

    default:
      return [];
  }

  if (!filterOptions) {
    return candidates;
  }

  return candidates.filter((target) => {
    // 1. Damaged filter
    if (filterOptions.damaged !== undefined) {
      if (target.kind !== 'character') return false;
      let isDamaged = false;
      if (target.entityType === 'hero' || target.entityType === 'alter_ego') {
        const p = target.entity as PlayerState;
        isDamaged = p.health < getEffectiveMaxHealth(p, state);
      } else if (target.entityType === 'ally' || target.entityType === 'minion') {
        const c = target.entity as CardInstance;
        isDamaged = (c.tokens?.damage || 0) > 0;
      } else if (target.entityType === 'villain') {
        const v = target.entity as VillainState;
        isDamaged = v.health < v.maxHealth;
      }
      if (isDamaged !== filterOptions.damaged) return false;
    }

    // 2. Exhausted filter
    if (filterOptions.exhausted !== undefined) {
      let isExhausted = false;
      if (target.kind === 'character') {
        if (target.entityType === 'hero' || target.entityType === 'alter_ego') {
          isExhausted = Boolean((target.entity as PlayerState).exhausted);
        } else if (target.entityType === 'ally') {
          isExhausted = Boolean((target.entity as CardInstance).exhausted);
        }
      }
      if (isExhausted !== filterOptions.exhausted) return false;
    }

    // 3. Status filter
    if (filterOptions.status) {
      const statusToFind = String(filterOptions.status).toLowerCase();
      let hasStatus = false;
      if (target.kind === 'character') {
        const statusCards =
          target.entityType === 'hero' || target.entityType === 'alter_ego'
            ? (target.entity as PlayerState).statusCards
            : (target.entity as CardInstance | VillainState).statusCards || [];
        hasStatus = statusCards.some((s) => String(s).toLowerCase() === statusToFind);
      }
      if (!hasStatus) return false;
    }

    // 4. Traits filter
    if (filterOptions.traits && filterOptions.traits.length > 0) {
      const requiredTraits = filterOptions.traits.map((t) => t.toLowerCase());
      let entityTraits: string[] = [];
      if (target.kind === 'character') {
        if (target.entityType === 'hero' || target.entityType === 'alter_ego') {
          entityTraits = (target.entity as PlayerState).activeFormCard?.traits || [];
        } else if (target.entityType === 'ally' || target.entityType === 'minion') {
          entityTraits = (target.entity as CardInstance).card?.traits || [];
        } else if (target.entityType === 'villain') {
          entityTraits = (target.entity as VillainState).card?.traits || [];
        }
      }
      const lowerEntityTraits = entityTraits.map((t) => t.toLowerCase());
      const hasAllTraits = requiredTraits.every((rt) => lowerEntityTraits.includes(rt));
      if (!hasAllTraits) return false;
    }

    return true;
  });
}
