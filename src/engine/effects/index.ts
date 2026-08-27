import {
  GameState,
  CardInstance,
  StatusCard,
  MinionCard,
  CardAbility,
} from '@engine/models';

export interface EffectExecutionContext {
  playerId: string;
  sourceCardInstance?: CardInstance;
  targetType?: 'villain' | 'minion' | 'main_scheme' | 'side_scheme';
  targetInstanceId?: string;
}

export interface EffectResult {
  state: GameState;
  success: boolean;
  error?: string;
  onomatopoeia?: string;
}

/**
 * Executes a declarative effect primitive on the GameState.
 */
export function executeEffect(
  state: GameState,
  ability: CardAbility,
  context: EffectExecutionContext,
): EffectResult {
  const player = state.players.find((p) => p.id === context.playerId);
  if (!player) return { state, success: false, error: 'Player not found' };

  switch (ability.effect) {
    case 'DRAW_CARDS': {
      const count = (ability.params?.count as number) || 1;
      let drawnCount = 0;
      for (let i = 0; i < count; i++) {
        const drawn = player.deck.shift();
        if (drawn) {
          player.hand.push(drawn);
          drawnCount += 1;
        }
      }
      return {
        state,
        success: true,
        onomatopoeia: `DRAW +${drawnCount}!`,
      };
    }

    case 'DEAL_DAMAGE': {
      const amount = (ability.params?.amount as number) || 0;
      const targetType = context.targetType || 'villain';

      if (targetType === 'villain') {
        const toughIdx = state.villain.statusCards.indexOf(StatusCard.TOUGH);
        if (toughIdx !== -1) {
          state.villain.statusCards.splice(toughIdx, 1);
          return { state, success: true, onomatopoeia: 'CLANG! (TOUGH)' };
        }

        state.villain.health = Math.max(0, state.villain.health - amount);
        if (state.villain.health <= 0) {
          state.winner = 'HEROES';
        }

        return {
          state,
          success: true,
          onomatopoeia: `KAPOW! ${amount} DAMAGE!`,
        };
      }

      if (targetType === 'minion' && context.targetInstanceId) {
        for (const p of state.players) {
          const minionIdx = p.engagedMinions.findIndex(
            (m) => m.instanceId === context.targetInstanceId,
          );
          if (minionIdx !== -1) {
            const minion = p.engagedMinions[minionIdx];
            const toughIdx = (minion.statusCards || []).indexOf(StatusCard.TOUGH);
            if (toughIdx !== -1) {
              minion.statusCards!.splice(toughIdx, 1);
              return { state, success: true, onomatopoeia: 'CLANG!' };
            }

            const currentDmg = minion.tokens?.damage || 0;
            const newDmg = currentDmg + amount;
            const minionHp = (minion.card as MinionCard).health || 1;

            if (newDmg >= minionHp) {
              p.engagedMinions.splice(minionIdx, 1);
              state.encounterDiscard.push(minion);
              return { state, success: true, onomatopoeia: 'SMASH! MINION DEFEATED!' };
            } else {
              minion.tokens = { ...minion.tokens, damage: newDmg };
              return { state, success: true, onomatopoeia: 'WHAM!' };
            }
          }
        }
      }

      return { state, success: false, error: 'Target not found for damage effect' };
    }

    case 'HEAL_DAMAGE': {
      const amount = (ability.params?.amount as number) || 0;
      const healed = Math.min(player.maxHealth - player.health, amount);
      player.health += healed;

      return {
        state,
        success: true,
        onomatopoeia: `HEAL +${healed} HP!`,
      };
    }

    case 'PREVENT_DAMAGE': {
      return {
        state,
        success: true,
        onomatopoeia: 'DAMAGE PREVENTED!',
      };
    }

    case 'GENERATE_RESOURCE': {
      const resourceType = (ability.params?.resource as string) || 'wild';
      const amount = (ability.params?.amount as number) || 1;

      return {
        state,
        success: true,
        onomatopoeia: `+${amount} [${resourceType}] RESOURCE!`,
      };
    }

    case 'REMOVE_THREAT': {
      const amount = (ability.params?.amount as number) || 0;
      state.mainScheme.threat = Math.max(0, state.mainScheme.threat - amount);

      return {
        state,
        success: true,
        onomatopoeia: `-${amount} THREAT!`,
      };
    }

    default:
      return { state, success: false, error: `Unknown effect type: ${ability.effect}` };
  }
}
