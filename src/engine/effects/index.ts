import {
  GameState,
  CardInstance,
  StatusCard,
  MinionCard,
  SideSchemeCard,
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

    case 'ADD_STATUS': {
      let status: StatusCard = StatusCard.STUNNED;
      const statusParam = ability.params?.status;
      if (statusParam === 'TOUGH' || statusParam === StatusCard.TOUGH) status = StatusCard.TOUGH;
      if (statusParam === 'CONFUSED' || statusParam === StatusCard.CONFUSED) status = StatusCard.CONFUSED;
      if (statusParam === 'STUNNED' || statusParam === StatusCard.STUNNED) status = StatusCard.STUNNED;

      const target = (ability.params?.target as string) || 'VILLAIN';

      if (target === 'VILLAIN' || target === 'CHOSEN_ENEMY') {
        if (!state.villain.statusCards.includes(status)) {
          state.villain.statusCards.push(status);
        }
      } else if (target === 'HERO' || target === 'ALL_HEROES') {
        for (const p of state.players) {
          if (!p.statusCards.includes(status)) {
            p.statusCards.push(status);
          }
        }
      }
      return { state, success: true, onomatopoeia: `${status} APPLIED!` };
    }

    case 'DISCARD_TOP_DECK_FILTER': {
      // Black Cat: Discard top 2 cards, add each Mental resource to hand
      const count = (ability.params?.count as number) || 2;
      const filterRes = (ability.params?.filterResource as string) || 'mental';
      let matchedCount = 0;

      for (let i = 0; i < count; i++) {
        const discarded = player.deck.shift();
        if (discarded) {
          const hasResource = discarded.card.resources[filterRes as keyof typeof discarded.card.resources] > 0;
          if (hasResource) {
            player.hand.push(discarded);
            matchedCount += 1;
          } else {
            player.discard.push(discarded);
          }
        }
      }
      return { state, success: true, onomatopoeia: `BLACK CAT FOUND +${matchedCount} CARDS!` };
    }

    case 'HEAL_DAMAGE_WITH_SURGE': {
      // Hard to Keep Down (01104): Rhino heals 4 HP. If 0 healed -> surge
      const amount = (ability.params?.amount as number) || 4;
      const healed = Math.min(state.villain.maxHealth - state.villain.health, amount);
      if (healed > 0) {
        state.villain.health += healed;
        return { state, success: true, onomatopoeia: `RHINO HEALED +${healed} HP!` };
      } else {
        // Surge -> deal 1 extra encounter card
        const surgeCard = state.encounterDeck.shift();
        if (surgeCard) player.dealtEncounterCards.push(surgeCard);
        return { state, success: true, onomatopoeia: 'SURGE!' };
      }
    }

    case 'ADD_STATUS_WITH_SURGE': {
      // "I'm Tough" (01105): Give Rhino Tough. If already Tough -> surge
      if (!state.villain.statusCards.includes(StatusCard.TOUGH)) {
        state.villain.statusCards.push(StatusCard.TOUGH);
        return { state, success: true, onomatopoeia: 'RHINO GAINS TOUGH!' };
      } else {
        const surgeCard = state.encounterDeck.shift();
        if (surgeCard) player.dealtEncounterCards.push(surgeCard);
        return { state, success: true, onomatopoeia: 'SURGE!' };
      }
    }

    case 'SEARCH_AND_REVEAL_SIDE_SCHEME': {
      // Rhino Stage II (01095): Search for Breakin' & Takin' (01107) and reveal it
      const schemeCode = (ability.params?.schemeCode as string) || '01107';
      const deckIdx = state.encounterDeck.findIndex((c) => c.card.code === schemeCode);
      if (deckIdx !== -1) {
        const [scheme] = state.encounterDeck.splice(deckIdx, 1);
        const sideCard = scheme.card as SideSchemeCard;
        state.sideSchemes.push({
          instanceId: scheme.instanceId,
          card: sideCard,
          threat: sideCard.baseThreat * state.players.length,
        });
      }
      return { state, success: true, onomatopoeia: 'SIDE SCHEME REVEALED!' };
    }

    default:
      return { state, success: true, onomatopoeia: 'RESOLVED!' };
  }
}
