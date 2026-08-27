import {
  GameState,
  CardInstance,
  StatusCard,
  MinionCard,
} from '@engine/models';

export interface CardEffectContext {
  state: GameState;
  playerId: string;
  cardInstance: CardInstance;
  targetInstanceId?: string;
  targetType?: 'villain' | 'minion' | 'main_scheme' | 'side_scheme';
}

export type CardActionHandler = (context: CardEffectContext) => {
  state: GameState;
  success: boolean;
  error?: string;
  onomatopoeia?: string;
};

/**
 * Registry of scriptable card abilities keyed by MarvelsDB card code.
 */
export const CardEffectRegistry: Record<string, CardActionHandler> = {
  // Swinging Web Kick (01005): Hero Action (attack) -> Deal 8 damage to an enemy
  '01005': (context: CardEffectContext) => {
    const { state, targetType, targetInstanceId } = context;

    if (targetType === 'villain') {
      const toughIndex = state.villain.statusCards.indexOf(StatusCard.TOUGH);
      if (toughIndex !== -1) {
        state.villain.statusCards.splice(toughIndex, 1);
        return {
          state,
          success: true,
          onomatopoeia: 'CLANG! (TOUGH)',
        };
      }

      state.villain.health = Math.max(0, state.villain.health - 8);
      if (state.villain.health <= 0) {
        state.winner = 'HEROES';
      }

      return {
        state,
        success: true,
        onomatopoeia: 'KAPOW! 8 DAMAGE!',
      };
    }

    if (targetType === 'minion' && targetInstanceId) {
      for (const player of state.players) {
        const minionIndex = player.engagedMinions.findIndex(
          (m) => m.instanceId === targetInstanceId,
        );
        if (minionIndex !== -1) {
          const minion = player.engagedMinions[minionIndex];
          const toughIndex = (minion.statusCards || []).indexOf(StatusCard.TOUGH);
          if (toughIndex !== -1) {
            minion.statusCards!.splice(toughIndex, 1);
            return { state, success: true, onomatopoeia: 'CLANG!' };
          }

          const currentDmg = minion.tokens?.damage || 0;
          const newDmg = currentDmg + 8;
          const minionHp = (minion.card as MinionCard).health || 1;

          if (newDmg >= minionHp) {
            player.engagedMinions.splice(minionIndex, 1);
            state.encounterDiscard.push(minion);
            return { state, success: true, onomatopoeia: 'SMASH! MINION DEFEATED!' };
          } else {
            minion.tokens = { ...minion.tokens, damage: newDmg };
            return { state, success: true, onomatopoeia: 'WHAM!' };
          }
        }
      }
    }

    return { state, success: false, error: 'Valid attack target required' };
  },

  // Aunt May (01006): Alter-Ego Action -> Exhaust Aunt May -> Heal 4 damage from Peter Parker
  '01006': (context: CardEffectContext) => {
    const { state, playerId, cardInstance } = context;
    const player = state.players.find((p) => p.id === playerId);
    if (!player) return { state, success: false, error: 'Player not found' };

    if (player.currentForm !== 'alter_ego') {
      return { state, success: false, error: 'Can only use Aunt May in Alter-Ego form.' };
    }

    if (cardInstance.exhausted) {
      return { state, success: false, error: 'Aunt May is already exhausted.' };
    }

    cardInstance.exhausted = true;
    const healed = Math.min(player.maxHealth - player.health, 4);
    player.health += healed;

    return {
      state,
      success: true,
      onomatopoeia: 'HEAL +4 HP!',
    };
  },

  // Web-Shooter (01008): Hero Resource -> Exhaust Web-Shooter and remove 1 counter -> generate 1 wild resource
  '01008': (context: CardEffectContext) => {
    const { state, playerId, cardInstance } = context;
    const player = state.players.find((p) => p.id === playerId);
    if (!player) return { state, success: false, error: 'Player not found' };

    if (player.currentForm !== 'hero') {
      return { state, success: false, error: 'Can only use Web-Shooter in Hero form.' };
    }

    if (cardInstance.exhausted) {
      return { state, success: false, error: 'Web-Shooter is already exhausted.' };
    }

    const currentCounters = cardInstance.tokens?.counters || 0;
    if (currentCounters <= 0) {
      return { state, success: false, error: 'No web-counters remaining on Web-Shooter.' };
    }

    cardInstance.exhausted = true;
    cardInstance.tokens = { ...cardInstance.tokens, counters: currentCounters - 1 };

    // If counters reach 0, Web-Shooter discards itself (RR v1.8 Uses keyword)
    if (cardInstance.tokens.counters === 0) {
      const idx = player.tableau.findIndex((c) => c.instanceId === cardInstance.instanceId);
      if (idx !== -1) {
        const [discarded] = player.tableau.splice(idx, 1);
        player.discard.push(discarded);
      }
    }

    return {
      state,
      success: true,
      onomatopoeia: 'THWIP! (WILD RESOURCE)',
    };
  },
};
