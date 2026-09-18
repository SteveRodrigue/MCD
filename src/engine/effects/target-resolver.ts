import {
  GameState,
  CardInstance,
  PlayerState,
  VillainState,
  MainSchemeState,
  SideSchemeState,
} from '@engine/models';
import { TargetSelector } from '../../data/supplemental/schema';
import type { EffectExecutionContext } from './index';

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

  // 1. Villain
  if (
    state.villain &&
    (state.villain.instanceId === instanceId ||
      instanceId === 'villain' ||
      instanceId === state.villain.card?.code)
  ) {
    return {
      kind: 'character',
      entityType: 'villain',
      entity: state.villain,
      id: state.villain.instanceId || 'villain',
    };
  }

  // 2. Main Scheme
  if (
    state.mainScheme &&
    (state.mainScheme.instanceId === instanceId ||
      instanceId === 'main_scheme' ||
      instanceId === state.mainScheme.card?.code)
  ) {
    return {
      kind: 'scheme',
      entityType: 'main_scheme',
      entity: state.mainScheme,
      id: state.mainScheme.instanceId || 'main_scheme',
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
    if (p.id === instanceId) {
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

    case 'ACTIVE_IDENTITY':
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
        const p = state.players.find((pl) => pl.id === context.targetPlayerId);
        if (p) return [{ kind: 'player', entity: p, id: p.id }];
      }
      if (context?.targetInstanceId) {
        const p = state.players.find((pl) => pl.id === context.targetInstanceId);
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
      if (state.villain) {
        return [
          {
            kind: 'character',
            entityType: 'villain',
            entity: state.villain,
            id: state.villain.instanceId || 'villain',
          },
        ];
      }
      return [];
    }

    case 'CHOSEN_ENEMY': {
      if (context?.targetType === 'villain') {
        if (state.villain) {
          return [
            {
              kind: 'character',
              entityType: 'villain',
              entity: state.villain,
              id: state.villain.instanceId || 'villain',
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
      if (state.villain) {
        return [
          {
            kind: 'character',
            entityType: 'villain',
            entity: state.villain,
            id: state.villain.instanceId || 'villain',
          },
        ];
      }
      return [];
    }

    case 'ALL_ENEMIES': {
      const results: ResolvedTarget[] = [];
      if (state.villain) {
        results.push({
          kind: 'character',
          entityType: 'villain',
          entity: state.villain,
          id: state.villain.instanceId || 'villain',
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
      if (state.villain) {
        results.push({
          kind: 'character',
          entityType: 'villain',
          entity: state.villain,
          id: state.villain.instanceId || 'villain',
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
      if (state.villain) {
        return [
          {
            kind: 'character',
            entityType: 'villain',
            entity: state.villain,
            id: state.villain.instanceId || 'villain',
          },
        ];
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
      if (state.villain) {
        results.push({
          kind: 'character',
          entityType: 'villain',
          entity: state.villain,
          id: state.villain.instanceId || 'villain',
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
      if (state.mainScheme) {
        return [
          {
            kind: 'scheme',
            entityType: 'main_scheme',
            entity: state.mainScheme,
            id: state.mainScheme.instanceId || 'main_scheme',
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
      if (context?.targetInstanceId) {
        if (
          state.mainScheme &&
          (context.targetInstanceId === state.mainScheme.instanceId ||
            context.targetInstanceId === 'main_scheme')
        ) {
          return [
            {
              kind: 'scheme',
              entityType: 'main_scheme',
              entity: state.mainScheme,
              id: state.mainScheme.instanceId || 'main_scheme',
            },
          ];
        }
        const side = (state.sideSchemes || []).find(
          (s) => s.instanceId === context.targetInstanceId,
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
      if (state.mainScheme) {
        return [
          {
            kind: 'scheme',
            entityType: 'main_scheme',
            entity: state.mainScheme,
            id: state.mainScheme.instanceId || 'main_scheme',
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
      if (state.mainScheme) {
        results.push({
          kind: 'scheme',
          entityType: 'main_scheme',
          entity: state.mainScheme,
          id: state.mainScheme.instanceId || 'main_scheme',
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
      if (state.mainScheme) {
        return [
          {
            kind: 'scheme',
            entityType: 'main_scheme',
            entity: state.mainScheme,
            id: state.mainScheme.instanceId || 'main_scheme',
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
        if (state.villain) {
          return [
            {
              kind: 'character',
              entityType: 'villain',
              entity: state.villain,
              id: state.villain.instanceId || 'villain',
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
      if (state.villain) {
        return [
          {
            kind: 'character',
            entityType: 'villain',
            entity: state.villain,
            id: state.villain.instanceId || 'villain',
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
