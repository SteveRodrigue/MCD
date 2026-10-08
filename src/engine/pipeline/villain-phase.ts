import { applyToughnessOnEntry } from '../state/card-instance';
import {
  GameState,
  GamePhase,
  VillainPhaseStep,
  StatusCard,
  CardType,
  CardInstance,
  SideSchemeCard,
  MinionCard,
  PlayerState,
  Keyword,
  hasKeyword,
  PendingActivation,
  cloneGameState,
  getActiveVillain,
  getActiveMainScheme,
  getFirstPlayer,
  getPerPlayerCount,
} from '@engine/models';
import { dispatchTrigger } from '../triggers';
import { executeEffect } from '../effects';
import { applyThreatPlacement } from './threat-pipeline';
import {
  getEffectiveVillainStats,
  hasEntityKeyword,
  consumeEntityStatusCards,
} from './stat-calculator';
import { initiateEnemyAttack, CombatOptions } from './combat-pipeline';
export type { CombatOptions };
import { drawEncounterCard } from './deck-exhaustion';
import { dealSurgeCard } from './surge';
import { getResolvingRevealAbilities } from './encounter-cancel';
import { resolveRevealedObligation } from './obligations';
export { drawEncounterCard };
import { enqueueDecisionPrompt, peekDecisionPrompt } from './prompt-queue';
import { resolveAttachmentHost } from './attachment-host';
import { attachCardToHost } from '../state/state-validator';
import {
  step5_passFirstPlayerToken,
  step6_endVillainPhaseAndRound,
  step6_passFirstPlayerAndRoundUpkeep,
} from './round-upkeep';
export {
  step5_passFirstPlayerToken,
  step6_endVillainPhaseAndRound,
  step6_passFirstPlayerAndRoundUpkeep,
};

/**
 * Step 1: Place Threat on Main Scheme (RR v1.8 p. 31)
 */
export function step1_placeThreat(state: GameState): GameState {
  state.villainPhaseStep = VillainPhaseStep.MAIN_SCHEME_THREAT;
  const playerCount = getPerPlayerCount(state);

  // Escalation threat per player + acceleration tokens + side scheme acceleration icons
  let totalThreatToAdd =
    getActiveMainScheme(state).card.escalationThreat * playerCount + state.accelerationTokens;

  for (const sideScheme of state.sideSchemes) {
    const card = sideScheme.card as SideSchemeCard;
    if (card.hasAcceleration) {
      totalThreatToAdd += 1;
    }
  }

  const res = applyThreatPlacement(state, {
    targetType: 'main_scheme',
    amount: totalThreatToAdd,
    sourceType: 'VILLAIN_PHASE_STEP_1',
  });

  return res.state;
}

/**
 * Executes a single villain attack against a target hero (including triggers, boost cards, and defense).
 */
export function executeVillainAttackAgainstPlayer(
  state: GameState,
  player: PlayerState,
  options?: CombatOptions,
): GameState {
  return initiateEnemyAttack(state, { type: 'VILLAIN' }, player.id, options);
}

/**
 * Executes a single villain scheme against a target alter-ego or on-demand (Advance 01186).
 */
export function executeVillainSchemeAgainstPlayer(state: GameState, player: PlayerState): void {
  // The scheming villain is fixed now: moving the active counter mid-scheme must not change it.
  const villain = getActiveVillain(state);
  // Check Confused status on Villain (taking into account Steady - RR v1.8 p. 28)
  if (consumeEntityStatusCards(villain, StatusCard.CONFUSED)) {
    state.log.push({
      id: `log_${Date.now()}`,
      timestamp: Date.now(),
      round: state.roundNumber,
      phase: state.phase,
      category: 'status',
      actor: { name: villain.card?.name || 'Villain', type: 'villain' },
      key: 'villain.confused.cancelled',
      params: { villain: villain.card?.name || 'Villain' },
      onomatopoeia: 'CONFUSION CLEARED!',
    });
    return;
  }

  // Build Boost Cards Queue (RR v1.8 p. 25: 1 base boost card + any additional boost cards)
  const boostQueue: CardInstance[] = [];

  const baseBoost = drawEncounterCard(state);
  if (baseBoost) {
    boostQueue.push(baseBoost);
  }

  // Check villain innate abilities and attachments for extra boost cards (e.g. Klaw 01113 / ADR-0019)
  const villainAbilities = villain.card.enrichment?.abilities || [];
  let extraBoostCount = 0;
  if (typeof (villain.card as any).additionalBoostCards === 'number') {
    extraBoostCount += (villain.card as any).additionalBoostCards;
  } else if ((villain.card as any).additionalBoostCards) {
    extraBoostCount += 1;
  } else if (
    villainAbilities.some((a) => a.steps?.some((s) => s.effect === 'GIVE_ADDITIONAL_BOOST_CARD'))
  ) {
    extraBoostCount += 1;
  }

  for (const att of villain.attachments || []) {
    if (typeof (att.card as any).additionalBoostCards === 'number') {
      extraBoostCount += (att.card as any).additionalBoostCards;
    } else if ((att.card as any).additionalBoostCards) {
      extraBoostCount += 1;
    } else if (
      (att.card.enrichment?.abilities || []).some((a) =>
        a.steps?.some((s) => s.effect === 'GIVE_ADDITIONAL_BOOST_CARD'),
      )
    ) {
      extraBoostCount += 1;
    }
  }

  for (let i = 0; i < extraBoostCount; i++) {
    const extraBoost = drawEncounterCard(state);
    if (extraBoost) {
      boostQueue.push(extraBoost);
      state.log.push({
        id: `log_${Date.now()}_extra_${i}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        category: 'scheme',
        actor: { name: villain.card?.name || 'Villain', type: 'villain' },
        key: 'villain.boost.extra',
        params: { villain: villain.card?.name || 'Villain' },
        onomatopoeia: 'EXTRA BOOST DEALT!',
      });
    }
  }

  let totalBoostIcons = 0;

  // Resolve boost cards one at a time in FIFO order (RR v1.8 p. 25)
  while (boostQueue.length > 0) {
    const currentBoost = boostQueue.shift()!;
    state.activeBoostCard = currentBoost;

    // 1. Dispatch Boost Reveal Interrupt Window (e.g. Defiance, Target Acquired)
    dispatchTrigger(state, 'WHEN_BOOST_CARD_REVEALED', {
      targetPlayerId: player.id,
      sourceInstanceId: currentBoost.instanceId,
    });

    // 2. Resolve ★ Star Boost Abilities (if present)
    if (currentBoost.card.boostStar) {
      const boostAbilities = (currentBoost.card.enrichment?.abilities || []).filter(
        (a) => a.timing === 'BOOST' || a.trigger === 'BOOST',
      );

      for (const boostAbility of boostAbilities) {
        executeEffect(state, boostAbility, {
          playerId: player.id,
          sourceCardInstance: currentBoost,
        });

        state.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          round: state.roundNumber,
          phase: state.phase,
          category: 'scheme',
          actor: { name: villain.card?.name || 'Villain', type: 'villain' },
          key: 'villain.boost.starResolved',
          params: { card: currentBoost.card.name, abilityId: boostAbility.id },
          onomatopoeia: 'STAR BOOST ACTIVATED!',
        });
      }
    }

    // 3. Accumulate Boost Icons
    const icons = currentBoost.card.boostIcons ?? (currentBoost.card as any).boost ?? 0;
    totalBoostIcons += icons;

    state.log.push({
      id: `log_${Date.now()}`,
      timestamp: Date.now(),
      round: state.roundNumber,
      phase: state.phase,
      category: 'scheme',
      actor: { name: villain.card?.name || 'Villain', type: 'villain' },
      key: 'villain.boost.revealed',
      params: {
        villain: villain.card?.name || 'Villain',
        card: currentBoost.card.name,
        boostIcons: icons,
      },
      onomatopoeia: 'BOOST REVEALED!',
    });

    // 4. Discard the boost card unless its own Boost put it into play engaged with this player.
    if (!player.engagedMinions.some((m) => m.instanceId === currentBoost.instanceId)) {
      state.encounterDiscard.push(currentBoost);
    }

    state.activeBoostCard = undefined;
  }

  // Calculate modified SCH stat & place threat
  const villainStats = getEffectiveVillainStats(state, villain);
  const baseScheme = villainStats.scheme;
  const totalScheme = baseScheme + totalBoostIcons;

  applyThreatPlacement(state, {
    targetType: 'main_scheme',
    amount: totalScheme,
    sourceType: 'VILLAIN_SCHEME',
    sourceEntityName: villain.card?.name || 'Villain',
    sourcePlayerId: player.id,
    boostIcons: totalBoostIcons,
  });
}

/**
 * Executes a single minion attack against a hero.
 */
export function executeMinionAttackAgainstPlayer(
  state: GameState,
  minion: CardInstance,
  player: PlayerState,
  options?: CombatOptions,
): GameState {
  const nextState = initiateEnemyAttack(
    state,
    { type: 'MINION', card: minion },
    player.id,
    options,
  );

  return nextState;
}

/**
 * Executes a single minion scheme against an alter-ego.
 */
export function executeMinionSchemeAgainstPlayer(
  state: GameState,
  minion: CardInstance,
  player: PlayerState,
): void {
  // Check Confused status on Minion (taking into account Steady - RR v1.8 p. 28)
  if (consumeEntityStatusCards(minion, StatusCard.CONFUSED)) {
    state.log.push({
      id: `log_${Date.now()}`,
      timestamp: Date.now(),
      round: state.roundNumber,
      phase: state.phase,
      category: 'status',
      actor: { name: minion.card.name, type: 'minion' },
      key: 'minion.confused.cancelled',
      params: { minion: minion.card.name },
      onomatopoeia: 'CONFUSION CLEARED!',
    });
    return;
  }

  const minionCard = minion.card as MinionCard;
  const baseScheme = minionCard.scheme ?? (minionCard as any).sch ?? 1;
  let totalBoostIcons = 0;

  // Villainous minion deals and resolves a facedown boost card (RR v1.8 p. 30)
  if (hasEntityKeyword(minion, 'Villainous')) {
    const boostQueue: CardInstance[] = [];
    const baseBoost = drawEncounterCard(state);
    if (baseBoost) {
      boostQueue.push(baseBoost);
    }

    const extraBoost =
      typeof (minion.card as any).additionalBoostCards === 'number'
        ? (minion.card as any).additionalBoostCards
        : (minion.card as any).additionalBoostCards
          ? 1
          : 0;
    for (let i = 0; i < extraBoost; i++) {
      const eb = drawEncounterCard(state);
      if (eb) boostQueue.push(eb);
    }

    while (boostQueue.length > 0) {
      const currentBoost = boostQueue.shift()!;
      state.activeBoostCard = currentBoost;

      // 1. Dispatch Boost Reveal Interrupt Window
      dispatchTrigger(state, 'WHEN_BOOST_CARD_REVEALED', {
        targetPlayerId: player.id,
        sourceInstanceId: currentBoost.instanceId,
      });

      // 2. Resolve ★ Star Boost Abilities (if present)
      if (currentBoost.card.boostStar) {
        const boostAbilities = (currentBoost.card.enrichment?.abilities || []).filter(
          (a) => a.timing === 'BOOST' || a.trigger === 'BOOST',
        );

        for (const boostAbility of boostAbilities) {
          executeEffect(state, boostAbility, {
            playerId: player.id,
            sourceCardInstance: currentBoost,
          });

          state.log.push({
            id: `log_${Date.now()}`,
            timestamp: Date.now(),
            round: state.roundNumber,
            phase: state.phase,
            category: 'scheme',
            actor: { name: minion.card.name, type: 'minion' },
            key: 'villain.boost.starResolved',
            params: { card: currentBoost.card.name, abilityId: boostAbility.id },
            onomatopoeia: 'STAR BOOST ACTIVATED!',
          });
        }
      }

      // 3. Accumulate Boost Icons
      const icons = currentBoost.card.boostIcons ?? (currentBoost.card as any).boost ?? 0;
      totalBoostIcons += icons;

      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        category: 'scheme',
        actor: { name: minion.card.name, type: 'minion' },
        key: 'villain.boost.revealed',
        params: {
          villain: minion.card.name,
          minion: minion.card.name,
          card: currentBoost.card.name,
          boostIcons: icons,
        },
        onomatopoeia: 'BOOST REVEALED!',
      });

      // 4. Discard the boost card unless its own Boost put it into play engaged with this player.
      if (!player.engagedMinions.some((m) => m.instanceId === currentBoost.instanceId)) {
        state.encounterDiscard.push(currentBoost);
      }

      state.activeBoostCard = undefined;
    }
  }

  applyThreatPlacement(state, {
    targetType: 'main_scheme',
    amount: baseScheme + totalBoostIcons,
    sourceType: 'MINION_SCHEME',
    sourceEntityName: minion.card?.name || 'Minion',
    sourcePlayerId: player.id,
    boostIcons: totalBoostIcons,
  });
}

/**
 * Executes a single minion activation against a player (Attack if hero, Scheme if alter-ego).
 */
export function executeMinionActivationAgainstPlayer(
  state: GameState,
  minion: CardInstance,
  player: PlayerState,
  options?: CombatOptions,
): GameState {
  if (player.currentForm === 'hero') {
    return executeMinionAttackAgainstPlayer(state, minion, player, options);
  } else {
    executeMinionSchemeAgainstPlayer(state, minion, player);
    return state;
  }
}

/**
 * Builds the step 2 activation queue (RR v1.8, Villain Phase step 2): in player order, one VILLAIN
 * entry (2a) and one ENGAGED_MINIONS entry (2b) per player. The ENGAGED_MINIONS entry is expanded
 * lazily by `takeNextActivation`, so a minion engaged during 2a or 2b still activates in 2b.
 */
function buildActivationQueue(state: GameState): PendingActivation[] {
  const queue: PendingActivation[] = [];
  for (let i = 0; i < state.players.length; i++) {
    const player = state.players[(state.firstPlayerIndex + i) % state.players.length];
    queue.push({ type: 'VILLAIN', playerId: player.id });
    queue.push({ type: 'ENGAGED_MINIONS', playerId: player.id, activatedMinionIds: [] });
  }
  return queue;
}

function nextUnactivatedMinion(
  state: GameState,
  entry: PendingActivation,
): CardInstance | undefined {
  const player = state.players.find((p) => p.id === entry.playerId);
  const activated = entry.activatedMinionIds ?? [];
  return player?.engagedMinions.find((m) => !activated.includes(m.instanceId));
}

/**
 * Pops the next activation. An ENGAGED_MINIONS entry reads the player's engaged minions at this
 * moment and yields the next one that has not activated in this step, keeping the entry until none
 * is left.
 */
function takeNextActivation(state: GameState): PendingActivation | undefined {
  const queue = state.pendingActivations;
  while (queue && queue.length > 0) {
    const head = queue[0];
    if (head.type !== 'ENGAGED_MINIONS') return queue.shift();
    const minion = nextUnactivatedMinion(state, head);
    if (!minion) {
      queue.shift();
      continue;
    }
    head.activatedMinionIds = [...(head.activatedMinionIds ?? []), minion.instanceId];
    return { type: 'MINION', playerId: head.playerId, minionInstanceId: minion.instanceId };
  }
  return undefined;
}

/** True while at least one activation is left, ignoring ENGAGED_MINIONS entries with no minion left. */
function hasPendingActivation(state: GameState): boolean {
  return (state.pendingActivations ?? []).some(
    (entry) =>
      entry.type !== 'ENGAGED_MINIONS' || nextUnactivatedMinion(state, entry) !== undefined,
  );
}

/**
 * Step 2: Villain & Minion Activations (RR v1.8 p. 22: Interleaved Player-by-Player Activation Loop)
 * In player order starting from firstPlayerIndex:
 * 1. The villain activates against the player (Attack if hero, Scheme if alter-ego).
 * 2. Each minion engaged with that player activates against the player (Attack if hero, Scheme if alter-ego).
 */
export function step2_villainAndMinionActivations(
  state: GameState,
  options?: CombatOptions,
): GameState {
  if (state.winner) return state;
  state.phase = GamePhase.VILLAIN_PHASE;
  state.villainPhaseStep = VillainPhaseStep.VILLAIN_ACTIVATIONS;

  const resolvedOptions: CombatOptions | undefined =
    options?.synchronousPolicy !== undefined
      ? { acceptOptionalTriggers: true, ...options }
      : options;

  if (!state.pendingActivations) {
    state.pendingActivations = buildActivationQueue(state);
  }

  for (let act = takeNextActivation(state); act; act = takeNextActivation(state)) {
    const player = state.players.find((p) => p.id === act.playerId);
    if (!player) continue;

    if (act.type === 'VILLAIN') {
      if (player.currentForm === 'hero') {
        state = executeVillainAttackAgainstPlayer(state, player, resolvedOptions);
      } else {
        executeVillainSchemeAgainstPlayer(state, player);
      }
    } else if (act.type === 'MINION') {
      const minion = player.engagedMinions.find((m) => m.instanceId === act.minionInstanceId);
      if (minion) {
        state = executeMinionActivationAgainstPlayer(state, minion, player, resolvedOptions);
      }
    }

    if (peekDecisionPrompt(state) || state.winner) {
      return state;
    }
  }

  delete state.pendingActivations;
  return state;
}

/**
 * Step 3: Deal Encounter Cards (RR v1.8 p. 11, p. 22, p. 47 & FFG Heroic Mode)
 * 1. Pass 1 (Base & Heroic): Deal 1 + heroicLevel encounter cards to each player in player order, starting with First Player.
 * 2. Pass 2 (Hazard Icons): Deal 1 additional encounter card for each active Hazard icon sequentially in player order starting with First Player.
 */
export function step3_dealEncounterCards(state: GameState): GameState {
  if (state.winner) return state;
  state.villainPhaseStep = VillainPhaseStep.DEAL_ENCOUNTER_CARDS;

  const playerCount = state.players.length;
  if (playerCount === 0) return state;

  const heroicLevel = Math.max(0, state.heroicLevel || 0);
  const baseCardsPerPlayer = 1 + heroicLevel;

  // Pass 1: Deal base encounter cards (+ heroic modifier) in player order
  for (let round = 0; round < baseCardsPerPlayer; round++) {
    for (let i = 0; i < playerCount; i++) {
      const playerIdx = (state.firstPlayerIndex + i) % playerCount;
      const card = drawEncounterCard(state);
      if (card) {
        state.players[playerIdx].dealtEncounterCards.push(card);
      }
    }
  }

  // Count active Hazard icons from all in-play side schemes
  let hazardCount = 0;
  for (const sideScheme of state.sideSchemes) {
    const card = sideScheme.card as SideSchemeCard;
    if (card.hasHazard) hazardCount += 1;
  }

  // Pass 2: Deal additional cards for hazard icons sequentially in player order starting from firstPlayerIndex (RR v1.8 p. 11)
  for (let h = 0; h < hazardCount; h++) {
    const targetPlayerIdx = (state.firstPlayerIndex + h) % playerCount;
    const extraCard = drawEncounterCard(state);
    if (extraCard) {
      state.players[targetPlayerIdx].dealtEncounterCards.push(extraCard);
    }
  }

  state.log.push({
    id: `log_${Date.now()}`,
    timestamp: Date.now(),
    key: 'villainPhase.step3.encounterCardsDealt',
    params: {
      basePerPlayer: baseCardsPerPlayer,
      heroicLevel,
      hazardCount,
    },
    onomatopoeia: 'ENCOUNTER DEALT!',
  });

  return state;
}

export interface RevealEncounterOptions {
  acceptOptionalTriggers?: boolean;
}

/**
 * Step 4: Reveal and Resolve Encounter Cards (RR v1.8 p. 32, p. 47)
 */
export function step4_revealEncounterCards(
  state: GameState,
  options?: RevealEncounterOptions,
): GameState {
  if (state.winner) return state;
  state.villainPhaseStep = VillainPhaseStep.REVEAL_ENCOUNTER_CARDS;

  // Player ids in player order, taken before any reveal: a reveal can eliminate a player (#246),
  // which shifts the indices of the others.
  const playerOrder = state.players.map(
    (_, i) => state.players[(state.firstPlayerIndex + i) % state.players.length].id,
  );
  for (const playerId of playerOrder) {
    const player = state.players.find((p) => p.id === playerId);
    if (!player) continue;

    while (player.dealtEncounterCards.length > 0) {
      const cardInstance = player.dealtEncounterCards.shift()!;

      state.activeEncounterContext = {
        encounterInstanceId: cardInstance.instanceId,
        encounterCard: cardInstance,
        targetPlayerId: player.id,
      };

      // 1. Interrupt window of the reveal: every encounter card can be interrupted, whether or not
      // it has a When Revealed ability (Black Widow 01075).
      const isCancelled = dispatchRevealInterrupts(state, cardInstance, player.id, options);

      // If a decision prompt was queued for the player to interrupt, halt and wait for choice
      if (peekDecisionPrompt(state)) {
        return state;
      }

      resolveActiveEncounterCardAfterInterrupt(state, cardInstance, player, isCancelled);

      if (peekDecisionPrompt(state) || state.winner) {
        return state;
      }
    }
  }

  return state;
}

/**
 * Opens the interrupt window of a reveal: ENCOUNTER_CARD_REVEALED for every encounter card, then
 * TREACHERY_REVEALED for treacheries. Returns true when the reveal was cancelled.
 */
function dispatchRevealInterrupts(
  state: GameState,
  cardInstance: CardInstance,
  playerId: string,
  options?: CombatOptions,
): boolean {
  const context = {
    targetPlayerId: playerId,
    encounterCardInstance: cardInstance,
    acceptOptionalTriggers: options?.acceptOptionalTriggers,
  };
  let isCancelled = false;
  const whenRevealed = dispatchTrigger(state, 'ENCOUNTER_CARD_REVEALED', context);
  if (whenRevealed.cancelled || state.activeEncounterContext?.cancelled) isCancelled = true;

  if (!isCancelled && cardInstance.card.type === CardType.TREACHERY) {
    const treachery = dispatchTrigger(state, 'TREACHERY_REVEALED', context);
    if (treachery.cancelled || state.activeEncounterContext?.cancelled) isCancelled = true;
  }
  return isCancelled;
}

/**
 * Resolves the When Revealed abilities of a card: all of them, or only the effects that cannot be
 * canceled when the reveal was cancelled.
 */
function resolveWhenRevealedAbilities(
  state: GameState,
  cardInstance: CardInstance,
  player: PlayerState,
  isCancelled: boolean,
): void {
  for (const ability of getResolvingRevealAbilities(cardInstance, isCancelled)) {
    executeEffect(state, ability, { playerId: player.id, sourceCardInstance: cardInstance });
  }
}

/**
 * Attaches a revealed encounter attachment to its host and resolves its When Revealed abilities.
 * The attachment itself is never cancelled (#175).
 */
export function completeEncounterAttachment(
  state: GameState,
  cardInstance: CardInstance,
  hostInstanceId: string,
  hostName: string,
  player: PlayerState,
  isCancelled: boolean,
): void {
  attachCardToHost(state, cardInstance, 'ENEMY', hostInstanceId);
  state.log.push({
    id: `log_${Date.now()}`,
    timestamp: Date.now(),
    key: 'encounter.reveal.attachment',
    params: { attachment: cardInstance.card.name, host: hostName },
    onomatopoeia: 'ATTACHED!',
  });
  resolveWhenRevealedAbilities(state, cardInstance, player, isCancelled);
}

/**
 * A revealed encounter attachment (#209): attaches to the host its `attachTo` declares (the active
 * villain by default). Several candidates are settled by the first player through a prompt; no
 * candidate applies the `otherwise` branch, where "gains surge" discards the card and deals the
 * surge card.
 */
function resolveRevealedAttachment(
  state: GameState,
  cardInstance: CardInstance,
  player: PlayerState,
  isCancelled: boolean,
): void {
  const card = cardInstance.card;
  const resolution = resolveAttachmentHost(state, cardInstance, card.enrichment?.attachTo);

  if (resolution.kind === 'attach') {
    completeEncounterAttachment(
      state,
      cardInstance,
      resolution.host.instanceId,
      resolution.host.name,
      player,
      isCancelled,
    );
  } else if (resolution.kind === 'surge') {
    state.encounterDiscard.push(cardInstance);
    state.log.push({
      id: `log_${Date.now()}`,
      timestamp: Date.now(),
      key: 'encounter.reveal.attachmentNoHost',
      params: { attachment: card.name },
      onomatopoeia: 'NO HOST!',
    });
    dealSurgeCard(state, player, card.name);
  } else {
    const firstPlayer = getFirstPlayer(state);
    enqueueDecisionPrompt(state, {
      promptId: `prompt_attachment_host_${cardInstance.instanceId}`,
      playerId: firstPlayer.id,
      title: 'Choose Host',
      description: `Choose which character ${card.name} attaches to:`,
      sourceCardName: card.name,
      sourceCardCode: card.code,
      sourceCardInstanceId: cardInstance.instanceId,
      isVoluntary: false,
      options: resolution.candidates.map((candidate) => ({
        id: candidate.instanceId,
        label: candidate.engagedPlayerId
          ? `${candidate.name} (${state.players.find((p) => p.id === candidate.engagedPlayerId)?.name})`
          : candidate.name,
        description: `Attach ${card.name} to ${candidate.name}`,
        cardCode: candidate.card.code,
        cardName: candidate.name,
        effect: 'ATTACH_TO_HOST',
        params: {
          isEncounterAttachmentHostChoice: true,
          attachmentCard: cardInstance,
          revealingPlayerId: player.id,
          isCancelled,
          hostName: candidate.name,
        },
      })),
    });
  }
}

/**
 * Resolves the effects and final destination of an active encounter card
 * after any When Revealed / Treachery reveal interrupts have resolved.
 */
export function resolveActiveEncounterCardAfterInterrupt(
  state: GameState,
  cardInstance: CardInstance,
  player: PlayerState,
  isCancelled: boolean,
): void {
  const card = cardInstance.card;

  // "Cancel the effects of that card and discard it" (Black Widow 01075): the card does not enter
  // play. Effects declared `cannotBeCanceled` still resolve.
  if (
    isCancelled &&
    state.activeEncounterContext?.discardCard &&
    card.type !== CardType.TREACHERY
  ) {
    resolveWhenRevealedAbilities(state, cardInstance, player, true);
    if (!state.removedFromGame.some((c) => c.instanceId === cardInstance.instanceId)) {
      state.encounterDiscard.push(cardInstance);
    }
    state.log.push({
      id: `log_${Date.now()}`,
      timestamp: Date.now(),
      key: 'encounter.reveal.cancelledAndDiscarded',
      params: { card: card.name },
      onomatopoeia: 'CANCELLED!',
    });
    state.activeEncounterContext = undefined;
    return;
  }

  if (card.type === CardType.MINION) {
    // Check Toughness keyword
    applyToughnessOnEntry(cardInstance);

    // Enters play engaged with this player
    player.engagedMinions.push(cardInstance);
    state.log.push({
      id: `log_${Date.now()}`,
      timestamp: Date.now(),
      key: 'encounter.reveal.minion',
      params: { player: player.name, minion: card.name },
      onomatopoeia: 'MINION SPAWNS!',
    });
    resolveWhenRevealedAbilities(state, cardInstance, player, isCancelled);

    dispatchTrigger(state, 'MINION_ENTERS_PLAY', {
      targetPlayerId: player.id,
      sourceInstanceId: cardInstance.instanceId,
      targetInstanceId: cardInstance.instanceId,
      encounterCardInstance: cardInstance,
    });
  } else if (card.type === CardType.SIDE_SCHEME) {
    const sideSchemeCard = card as SideSchemeCard;
    const baseThreat =
      sideSchemeCard.baseThreat * (sideSchemeCard.baseThreatFixed ? 1 : getPerPlayerCount(state));
    state.sideSchemes.push({
      instanceId: cardInstance.instanceId,
      card: sideSchemeCard,
      threat: baseThreat,
    });
    state.log.push({
      id: `log_${Date.now()}`,
      timestamp: Date.now(),
      key: 'encounter.reveal.sideScheme',
      params: { sideScheme: card.name, threat: baseThreat },
      onomatopoeia: 'SIDE SCHEME!',
    });
    resolveWhenRevealedAbilities(state, cardInstance, player, isCancelled);
  } else if (card.type === CardType.OBLIGATION) {
    resolveRevealedObligation(state, cardInstance, player);
  } else if (card.type === CardType.ATTACHMENT) {
    resolveRevealedAttachment(state, cardInstance, player, isCancelled);
  } else {
    // Treachery generic resolution: execute declarative WHEN_REVEALED unless cancelled
    resolveWhenRevealedAbilities(state, cardInstance, player, isCancelled);
    // A card that removed itself from the game (Eternity) does not go to the discard pile.
    if (!state.removedFromGame.some((c) => c.instanceId === cardInstance.instanceId)) {
      state.encounterDiscard.push(cardInstance);
    }
    state.log.push({
      id: `log_${Date.now()}`,
      timestamp: Date.now(),
      key: 'encounter.reveal.treachery',
      params: { card: card.name },
      onomatopoeia: isCancelled ? 'CANCELLED!' : 'TREACHERY!',
    });
  }

  // Surge keyword: a keyword outside the "When Revealed" text. Cancelling the When Revealed
  // effects does not cancel it; only a card that was cancelled and discarded does not surge. A card
  // that already surged by effect does not surge twice. The extra card is only dealt here; it is
  // revealed after this card has resolved.
  if (
    !state.activeEncounterContext?.discardCard &&
    hasKeyword(card, Keyword.SURGE) &&
    !state.activeEncounterContext?.surged
  ) {
    dealSurgeCard(state, player, card.name);
  }

  state.activeEncounterContext = undefined;
}

/**
 * Advances the Villain Phase by exactly one discrete atomic milestone (ADR-0068 / Issue #140).
 * Milestones:
 * 1. Step 1: Place threat on main scheme & emit THREAT_PLACED step event.
 * 2. Step 2 & 3: Pop and resolve 1 enemy activation (villain or minion), recording lastCombatOutcome and emitting step event.
 * 3. Step 4: Deal encounter cards to player threat zones & emit DEAL_ENCOUNTER_CARD step event.
 * 4. Step 5: Pop and reveal 1 encounter card across players, resolving When Revealed / Treachery and emitting REVEAL_ENCOUNTER_CARD step event.
 * 5. Step 6: Upkeep and return to PLAYER_PHASE & emit PASS_FIRST_PLAYER step event.
 */
export function advanceVillainPhaseStep(state: GameState, options?: CombatOptions): GameState {
  if (state.winner) return state;

  // Halt if an interactive decision prompt is currently waiting for player input
  if (peekDecisionPrompt(state)) return state;

  const nextState: GameState = cloneGameState(state);
  if (!nextState.options) nextState.options = {};
  nextState.options.villainPhaseStepping = true;

  // Case 0: Phase transition from PLAYER_PHASE to VILLAIN_PHASE
  if (nextState.phase !== GamePhase.VILLAIN_PHASE) {
    nextState.phase = GamePhase.VILLAIN_PHASE;

    // Reset phase-level ability limits and expire phase cost reductions for all players
    for (const player of nextState.players) {
      player.usedAbilitiesThisPhase = {};
      player.activeCostReductions = (player.activeCostReductions || []).filter(
        (r) => r.duration !== 'PHASE',
      );
      player.costReductions = player.activeCostReductions.reduce((sum, r) => sum + r.amount, 0);
      player.activeStatModifiers = (player.activeStatModifiers || []).filter(
        (m) => m.duration !== 'PHASE',
      );
      player.activeTraitModifiers = (player.activeTraitModifiers || []).filter(
        (m) => m.duration !== 'PHASE',
      );
      for (const card of [...player.allies, ...player.tableau, ...(player.attachments || [])]) {
        card.activeStatModifiers = (card.activeStatModifiers || []).filter(
          (m) => m.duration !== 'PHASE',
        );
        if (card.tokens) {
          delete (card.tokens as any).thwBonus;
          delete (card.tokens as any).atkBonus;
        }
      }
    }

    nextState.log.push({
      id: `log_${Date.now()}`,
      timestamp: Date.now(),
      round: nextState.roundNumber,
      phase: GamePhase.VILLAIN_PHASE,
      key: 'phase.villain_phase.start',
      params: { round: nextState.roundNumber },
      onomatopoeia: 'VILLAIN PHASE!',
    });

    // Dispatch Villain Phase Began triggers across all players
    for (const player of nextState.players) {
      dispatchTrigger(nextState, 'VILLAIN_PHASE_BEGAN', { targetPlayerId: player.id });
    }

    // Step 1: Place threat on main scheme
    const threatBefore = getActiveMainScheme(nextState).threat;
    step1_placeThreat(nextState);
    const threatAdded = Math.max(0, getActiveMainScheme(nextState).threat - threatBefore);

    nextState.villainPhaseStepEvent = {
      type: 'THREAT_PLACED',
      step: VillainPhaseStep.MAIN_SCHEME_THREAT,
      amount: threatAdded,
      description: `${threatAdded} threat placed on ${getActiveMainScheme(nextState).card.name}.`,
      onomatopoeia: 'SCHEME GROWS!',
    };

    if (nextState.winner) return nextState;

    nextState.villainPhaseStep = VillainPhaseStep.VILLAIN_ACTIVATIONS;
    delete nextState.pendingActivations;
    return nextState;
  }

  // Case 1: Currently on MAIN_SCHEME_THREAT -> advance to VILLAIN_ACTIVATIONS
  if (nextState.villainPhaseStep === VillainPhaseStep.MAIN_SCHEME_THREAT) {
    nextState.villainPhaseStep = VillainPhaseStep.VILLAIN_ACTIVATIONS;
    delete nextState.pendingActivations;
    return nextState;
  }

  // Case 2: Currently on VILLAIN_ACTIVATIONS
  if (nextState.villainPhaseStep === VillainPhaseStep.VILLAIN_ACTIVATIONS) {
    if (!nextState.pendingActivations) {
      nextState.pendingActivations = buildActivationQueue(nextState);
    }

    const act = takeNextActivation(nextState);

    if (act) {
      const player = nextState.players.find((p) => p.id === act.playerId);
      if (!player) {
        return advanceVillainPhaseStep(nextState, options);
      }

      const resolvedOptions: CombatOptions | undefined =
        options?.synchronousPolicy !== undefined
          ? { acceptOptionalTriggers: true, ...options }
          : options;

      if (act.type === 'VILLAIN') {
        // Resolved when the activation starts; a counter move during it does not change the attacker.
        const activatingVillain = getActiveVillain(nextState);
        if (player.currentForm === 'hero') {
          const mutatedState = executeVillainAttackAgainstPlayer(
            nextState,
            player,
            resolvedOptions,
          );
          if (peekDecisionPrompt(mutatedState)) {
            mutatedState.villainPhaseStepEvent = {
              type: 'VILLAIN_ATTACK',
              step: VillainPhaseStep.VILLAIN_ACTIVATIONS,
              sourceName: activatingVillain.card.name,
              targetPlayerId: player.id,
              targetName: player.name,
              amount: undefined,
              description: `${activatingVillain.card.name} is attacking ${player.name}! Declare a defender.`,
              onomatopoeia: 'DEFEND!',
              combatOutcome: undefined,
            };
            return mutatedState;
          }
          const dmg = mutatedState.lastCombatOutcome?.finalDamage ?? 0;
          mutatedState.villainPhaseStepEvent = {
            type: 'VILLAIN_ATTACK',
            step: VillainPhaseStep.VILLAIN_ACTIVATIONS,
            sourceName: activatingVillain.card.name,
            targetPlayerId: player.id,
            targetName: player.name,
            amount: dmg,
            description: `${activatingVillain.card.name} attacked ${player.name} for ${dmg} damage.`,
            onomatopoeia: dmg > 0 ? 'BANG!' : 'BLOCKED!',
            combatOutcome: mutatedState.lastCombatOutcome,
          };
          if (mutatedState.winner) {
            return mutatedState;
          }
          if (!hasPendingActivation(mutatedState)) {
            delete mutatedState.pendingActivations;
            mutatedState.villainPhaseStep = VillainPhaseStep.DEAL_ENCOUNTER_CARDS;
          }
          return mutatedState;
        } else {
          const threatBefore = getActiveMainScheme(nextState).threat;
          executeVillainSchemeAgainstPlayer(nextState, player);
          const threatAdded = Math.max(0, getActiveMainScheme(nextState).threat - threatBefore);
          nextState.villainPhaseStepEvent = {
            type: 'VILLAIN_SCHEME',
            step: VillainPhaseStep.VILLAIN_ACTIVATIONS,
            sourceName: activatingVillain.card.name,
            targetPlayerId: player.id,
            targetName: player.name,
            amount: threatAdded,
            description: `${activatingVillain.card.name} schemed against ${player.name} (+${threatAdded} threat).`,
            onomatopoeia: 'SCHEME!',
          };
          if (peekDecisionPrompt(nextState) || nextState.winner) {
            return nextState;
          }
          if (!hasPendingActivation(nextState)) {
            delete nextState.pendingActivations;
            nextState.villainPhaseStep = VillainPhaseStep.DEAL_ENCOUNTER_CARDS;
          }
          return nextState;
        }
      } else if (act.type === 'MINION') {
        const minion = player.engagedMinions.find((m) => m.instanceId === act.minionInstanceId);
        if (minion) {
          if (player.currentForm === 'hero') {
            const mutatedState = executeMinionActivationAgainstPlayer(
              nextState,
              minion,
              player,
              resolvedOptions,
            );
            if (peekDecisionPrompt(mutatedState)) {
              mutatedState.villainPhaseStepEvent = {
                type: 'MINION_ATTACK',
                step: VillainPhaseStep.VILLAIN_ACTIVATIONS,
                sourceName: minion.card.name,
                targetPlayerId: player.id,
                targetName: player.name,
                amount: undefined,
                description: `${minion.card.name} is attacking ${player.name}! Declare a defender.`,
                onomatopoeia: 'DEFEND!',
                combatOutcome: undefined,
              };
              return mutatedState;
            }
            const dmg = mutatedState.lastCombatOutcome?.finalDamage ?? 0;
            mutatedState.villainPhaseStepEvent = {
              type: 'MINION_ATTACK',
              step: VillainPhaseStep.VILLAIN_ACTIVATIONS,
              sourceName: minion.card.name,
              targetPlayerId: player.id,
              targetName: player.name,
              amount: dmg,
              description: `${minion.card.name} attacked ${player.name} for ${dmg} damage.`,
              onomatopoeia: dmg > 0 ? 'POW!' : 'BLOCKED!',
              combatOutcome: mutatedState.lastCombatOutcome,
            };
            if (mutatedState.winner) {
              return mutatedState;
            }
            if (!hasPendingActivation(mutatedState)) {
              delete mutatedState.pendingActivations;
              mutatedState.villainPhaseStep = VillainPhaseStep.DEAL_ENCOUNTER_CARDS;
            }
            return mutatedState;
          } else {
            const threatBefore = getActiveMainScheme(nextState).threat;
            executeMinionActivationAgainstPlayer(nextState, minion, player, resolvedOptions);
            const threatAdded = Math.max(0, getActiveMainScheme(nextState).threat - threatBefore);
            nextState.villainPhaseStepEvent = {
              type: 'MINION_SCHEME',
              step: VillainPhaseStep.VILLAIN_ACTIVATIONS,
              sourceName: minion.card.name,
              targetPlayerId: player.id,
              targetName: player.name,
              amount: threatAdded,
              description: `${minion.card.name} schemed against ${player.name} (+${threatAdded} threat).`,
              onomatopoeia: 'MINION SCHEMES!',
            };
            if (peekDecisionPrompt(nextState) || nextState.winner) {
              return nextState;
            }
            if (!hasPendingActivation(nextState)) {
              delete nextState.pendingActivations;
              nextState.villainPhaseStep = VillainPhaseStep.DEAL_ENCOUNTER_CARDS;
            }
            return nextState;
          }
        }
      }
    }

    delete nextState.pendingActivations;
    delete nextState.lastCombatOutcome;
    step3_dealEncounterCards(nextState);
    const totalDealt = nextState.players.reduce((sum, p) => sum + p.dealtEncounterCards.length, 0);
    nextState.villainPhaseStepEvent = {
      type: 'DEAL_ENCOUNTER_CARD',
      step: VillainPhaseStep.DEAL_ENCOUNTER_CARDS,
      amount: totalDealt,
      description: `${totalDealt} encounter card(s) dealt to player threat zone(s).`,
      onomatopoeia: 'ENCOUNTER DEALT!',
    };
    nextState.villainPhaseStep = VillainPhaseStep.REVEAL_ENCOUNTER_CARDS;
    if (nextState.winner) return nextState;
    return nextState;
  }

  // Case 3: DEAL_ENCOUNTER_CARDS
  if (nextState.villainPhaseStep === VillainPhaseStep.DEAL_ENCOUNTER_CARDS) {
    delete nextState.lastCombatOutcome;
    step3_dealEncounterCards(nextState);
    const totalDealt = nextState.players.reduce((sum, p) => sum + p.dealtEncounterCards.length, 0);
    nextState.villainPhaseStepEvent = {
      type: 'DEAL_ENCOUNTER_CARD',
      step: VillainPhaseStep.DEAL_ENCOUNTER_CARDS,
      amount: totalDealt,
      description: `${totalDealt} encounter card(s) dealt to player threat zone(s).`,
      onomatopoeia: 'ENCOUNTER DEALT!',
    };
    nextState.villainPhaseStep = VillainPhaseStep.REVEAL_ENCOUNTER_CARDS;
    if (nextState.winner) return nextState;
    return nextState;
  }

  // Case 4: REVEAL_ENCOUNTER_CARDS
  if (nextState.villainPhaseStep === VillainPhaseStep.REVEAL_ENCOUNTER_CARDS) {
    let targetPlayer: PlayerState | undefined;
    for (let i = 0; i < nextState.players.length; i++) {
      const pIdx = (nextState.firstPlayerIndex + i) % nextState.players.length;
      if (nextState.players[pIdx].dealtEncounterCards.length > 0) {
        targetPlayer = nextState.players[pIdx];
        break;
      }
    }

    if (targetPlayer && targetPlayer.dealtEncounterCards.length > 0) {
      const cardInstance = targetPlayer.dealtEncounterCards.shift()!;

      nextState.activeEncounterContext = {
        encounterInstanceId: cardInstance.instanceId,
        encounterCard: cardInstance,
        targetPlayerId: targetPlayer.id,
      };

      const isCancelled = dispatchRevealInterrupts(
        nextState,
        cardInstance,
        targetPlayer.id,
        options,
      );

      if (peekDecisionPrompt(nextState)) {
        return nextState;
      }

      resolveActiveEncounterCardAfterInterrupt(nextState, cardInstance, targetPlayer, isCancelled);

      nextState.villainPhaseStepEvent = {
        type: 'REVEAL_ENCOUNTER_CARD',
        step: VillainPhaseStep.REVEAL_ENCOUNTER_CARDS,
        sourceName: cardInstance.card.name,
        targetPlayerId: targetPlayer.id,
        targetName: targetPlayer.name,
        description: `${targetPlayer.name} revealed ${cardInstance.card.name}.`,
        onomatopoeia: 'HAZARD!',
        card: cardInstance,
      };

      if (peekDecisionPrompt(nextState) || nextState.winner) {
        return nextState;
      }

      const anyRemaining = nextState.players.some((p) => p.dealtEncounterCards.length > 0);
      if (!anyRemaining) {
        nextState.villainPhaseStep = VillainPhaseStep.PASS_FIRST_PLAYER;
      }
      return nextState;
    }

    nextState.villainPhaseStep = VillainPhaseStep.PASS_FIRST_PLAYER;
  }

  // Case 5: PASS_FIRST_PLAYER & Round Upkeep (RR v1.8 p. 47 Steps 5 and 6)
  if (nextState.villainPhaseStep === VillainPhaseStep.PASS_FIRST_PLAYER) {
    let finalState = step5_passFirstPlayerToken(nextState);
    finalState = step6_endVillainPhaseAndRound(finalState);
    finalState.villainPhaseStepEvent = {
      type: 'PASS_FIRST_PLAYER',
      step: VillainPhaseStep.PASS_FIRST_PLAYER,
      description: 'Round upkeep completed. First player token passed.',
      onomatopoeia: 'ROUND UPKEEP!',
    };
    return finalState;
  }

  return nextState;
}

/**
 * Resumes and continues Villain Phase progression after a prompt resolution (ADR-0031 / ADR-0032).
 */
export function continueVillainPhase(state: GameState, options?: CombatOptions): GameState {
  if (state.winner) return state;

  if (options?.stepping || state.options?.villainPhaseStepping) {
    return advanceVillainPhaseStep(state, options);
  }

  // Step 2: Activations
  if (state.villainPhaseStep === VillainPhaseStep.VILLAIN_ACTIVATIONS) {
    state = step2_villainAndMinionActivations(state, options);
    if (peekDecisionPrompt(state) || state.winner) return state;
    state.villainPhaseStep = VillainPhaseStep.DEAL_ENCOUNTER_CARDS;
  }

  // Step 3: Deal Encounter Cards
  if (state.villainPhaseStep === VillainPhaseStep.DEAL_ENCOUNTER_CARDS) {
    state = step3_dealEncounterCards(state);
    if (state.winner) return state;
    state.villainPhaseStep = VillainPhaseStep.REVEAL_ENCOUNTER_CARDS;
  }

  // Step 4: Reveal Encounter Cards
  if (state.villainPhaseStep === VillainPhaseStep.REVEAL_ENCOUNTER_CARDS) {
    state = step4_revealEncounterCards(state);
    if (peekDecisionPrompt(state) || state.winner) return state;
  }

  state = step5_passFirstPlayerToken(state);
  return step6_endVillainPhaseAndRound(state);
}

/**
 * Complete Villain Phase Automation Runner (RR v1.8 p. 22)
 * 1. Sets phase to VILLAIN_PHASE and resets usedAbilitiesThisPhase for all players.
 * 2. Dispatches VILLAIN_PHASE_BEGAN.
 * 3. Executes Steps 1 through 5 sequentially (pausing cleanly when interactive prompts are enqueued).
 * 4. Dispatches VILLAIN_PHASE_ENDED.
 * 5. Passes execution to Step 6 (Round Upkeep & Token Rotation).
 */
export function executeVillainPhase(state: GameState, options?: CombatOptions): GameState {
  if (options?.stepping || state.options?.villainPhaseStepping) {
    return advanceVillainPhaseStep(state, options);
  }

  const nextState: GameState = cloneGameState(state);
  nextState.phase = GamePhase.VILLAIN_PHASE;

  // Reset phase-level ability limits and expire phase cost reductions for all players during Villain Phase
  for (const player of nextState.players) {
    player.usedAbilitiesThisPhase = {};
    player.activeCostReductions = (player.activeCostReductions || []).filter(
      (r) => r.duration !== 'PHASE',
    );
    player.costReductions = player.activeCostReductions.reduce((sum, r) => sum + r.amount, 0);
    player.activeStatModifiers = (player.activeStatModifiers || []).filter(
      (m) => m.duration !== 'PHASE',
    );
    for (const card of [...player.allies, ...player.tableau, ...(player.attachments || [])]) {
      card.activeStatModifiers = (card.activeStatModifiers || []).filter(
        (m) => m.duration !== 'PHASE',
      );
      if (card.tokens) {
        delete (card.tokens as any).thwBonus;
        delete (card.tokens as any).atkBonus;
      }
    }
  }

  nextState.log.push({
    id: `log_${Date.now()}`,
    timestamp: Date.now(),
    round: nextState.roundNumber,
    phase: GamePhase.VILLAIN_PHASE,
    key: 'phase.villain_phase.start',
    params: { round: nextState.roundNumber },
    onomatopoeia: 'VILLAIN PHASE!',
  });

  // Dispatch Villain Phase Began triggers across all players
  for (const player of nextState.players) {
    dispatchTrigger(nextState, 'VILLAIN_PHASE_BEGAN', { targetPlayerId: player.id });
  }

  step1_placeThreat(nextState);
  if (nextState.winner) return nextState;

  nextState.villainPhaseStep = VillainPhaseStep.VILLAIN_ACTIVATIONS;
  delete nextState.pendingActivations;

  // A step 1 interrupt prompt pauses the phase; it resumes at step 2 once answered (#266).
  if (peekDecisionPrompt(nextState)) return nextState;

  return continueVillainPhase(nextState, options);
}
