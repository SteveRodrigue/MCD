/**
 * Marvel Champions Digital - Game Log Event Catalog
 * Implements ADR-0081 & AUD-20261017-232534 (R7): Typed log event catalog and canonical role vocabulary.
 *
 * Canonical role vocabulary:
 * - actor: The player, character, villain, or entity initiating the action.
 * - target: The entity receiving the action, attack, damage, thwart, status, or attachment.
 * - card: The card involved (played, discarded, drawn, attached, revealed).
 * - amount: The numeric value (damage, threat, recovery, healed, cost, discount).
 * - source: The source ability, card, or effect granting a bonus or triggering an event.
 */

export interface LogEvents {
  // Scenario & Game Setup / Phases
  'scenario.setup': {
    scenario: string;
    difficulty?: string;
    actor: string;
    health?: number;
    threatTarget?: number;
  };
  'scenario.setup.drone': { actor: string };
  'scenario.setup.environment': { card: string };
  'scenario.setup.minion': { actor: string; card: string };
  'scenario.setup.sideScheme': { card: string; amount?: number };
  'scenario.victory': { mode?: string; actor: string };
  'scenario.defeat': { card: string };
  'scenario.mainSchemeAdvance': { stage: string | number; card: string; targetThreat?: number };
  'game.setup.complete': Record<string, never>;
  'phase.player_phase.start': { round: number; actor?: string };
  'phase.player_phase.end': { round: number };
  'phase.villain_phase.start': { round: number };
  'round.upkeep.complete': { round: number };
  'first_player.passed': { actor: string };

  // Player Setup, Turns & Actions
  'player.setup.mulligan': { actor: string; discardedCount: number; handSize: number };
  'dev.card.tutor': { card: string; actor: string };
  'player.action.changeForm': { actor: string; form: string };
  'player.action.recover': { actor: string; amount: number; health?: number };
  'player.action.thwartMainScheme': { actor: string; amount: number; remainingThreat?: number };
  'player.action.thwartSideScheme': {
    actor: string;
    target: string;
    amount: number;
    remainingThreat?: number;
  };
  'player.action.allyAttack': { actor: string; card: string; amount: number; target: string };
  'player.action.attackVillain': { amount: number; actor?: string; target?: string };
  'player.deck.exhausted': { actor: string };
  'player.eliminated': { actor: string; remaining: number };
  'player.phase.cleanup.cardDiscarded': { actor: string; card: string };
  'player.phase.cleanup.complete': {
    actor: string;
    discardedCount: number;
    drawnCount: number;
    handSize: number;
    discardedCards?: string[];
    drawnCards?: string[];
    cards?: string;
  };
  'player.tableau.discarded': { actor: string; card: string; player?: string };
  'player.turn.ended': { actor: string };

  // Card Play, Routing & Effects
  CARD_PLAYED: { actor: string; card: string; amount?: number };
  'card.ability.used': { card: string };
  'card.ally.defeated': { card: string };
  'card.attached.to_host': {
    actor: string;
    card: string;
    target: string;
    host?: string;
    player?: string;
  };
  'card.attachment.attached': { card: string; target?: string };
  'card.cost.damageHero': { actor: string; amount: number; remainingHealth?: number };
  'card.cost.heal': { actor: string; amount: number; currentHealth?: number };
  'card.discarded.fromDeck': {
    actor: string;
    amount: number;
    source: string;
    cards: string;
    player?: string;
  };
  'card.discarded.fromHand': {
    actor: string;
    amount: number;
    source: string;
    cards: string;
  };
  'card.discarded.to_make_room': { actor: string; card: string; source?: string };
  'card.discarded.uses_exhausted': { actor: string; card: string };
  'card.effect.addStatus': {
    actor: string;
    card: string;
    status: string;
    target: string;
    mutatedState?: boolean;
    alreadyHadStatus?: boolean;
    isImmune?: boolean;
  };
  'card.effect.addTrait': { actor: string; trait: string; duration: string };
  'card.effect.dealDamage': {
    actor: string;
    target: string;
    amount: number;
    toughAbsorbed?: boolean;
    defeated?: boolean;
    remainingHealth?: number;
  };
  'card.effect.drawCards': {
    actor: string;
    amount: number;
    handSize?: number;
    cards?: string;
    drawnCards?: string[];
    targetLimit?: number;
    source?: string;
  };
  'card.effect.flipForm': { actor: string; form: string };
  'card.effect.heal': { actor: string; target: string; amount: number; health?: number };
  'card.effect.preventThreat': {
    actor: string;
    amount: number;
    consumed?: number;
    remaining?: number;
  };
  'card.effect.readyCharacter': { actor: string; target: string };
  'card.effect.removeThreat': {
    actor: string;
    target: string;
    amount: number;
    remainingThreat?: number;
  };
  'card.effect.threatBlockedByCrisis': { actor: string; target: string };
  'card.effect.threatBlockedByPatrol': { actor: string; target: string };
  'card.play.cancelled': { actor: string; card: string };
  'card.playFromZone': { actor: string; card: string; source?: string };
  'card.playFromZone.passed': { actor: string; source?: string };
  'card.playFromZone.resolved': { actor: string; card: string };
  'card.playUnderControl.resolved': { actor: string; card: string; target: string };
  'card.putIntoPlay': { actor: string; cards: string | string[]; destination?: string };
  'card.removedFromGame': { actor: string; card: string };
  'card.search.nothingFound': { actor: string; source?: string; zone?: string };
  'card.search.passed': { actor: string; source?: string };
  'card.searched.selected': { actor: string; card: string };
  'card.state.exhausted': { card: string; actor?: string };
  'character.setup.resolved': { actor: string; card: string };

  // Combat, Defense & Damage
  'combat.hero.defended': {
    actor: string;
    target: string;
    source: string;
    amount?: number;
  };
  'combat.ally.defended': { actor: string; target: string; source: string };
  'combat.attack.cancelled': { source?: string };
  'combat.attack.undefended': { actor: string; target: string; player?: string };
  'combat.damage.prevented': {
    actor: string;
    amount: number;
    consumed?: number;
    remaining?: number;
  };
  'villain.attack': { villain?: string; actor?: string; target?: string };
  'villain.attack.hit': {
    actor: string;
    target: string;
    amount: number;
    player?: string;
    who_attacks?: string;
    who_is_taking_damage?: string;
    damage?: number;
    remainingHp?: number;
    defended?: string | boolean;
  };
  'minion.attack.hit': {
    actor: string;
    target: string;
    amount: number;
    player?: string;
    who_attacks?: string;
    who_is_taking_damage?: string;
    damage?: number;
    remainingHp?: number;
    defended?: string | boolean;
  };
  'villain.attack.cancelled': { actor: string; source?: string };
  'minion.attack.cancelled': { actor: string; source?: string };
  'ally.attack.hit': { target: string; amount: number };
  'ally.defeated.boost.undefended': { actor: string; target: string };
  'ally.defeated': { target: string };
  'ally.piercing.tough.discarded': { target: string };
  'ally.tough.absorbed': { target: string };
  'hero.piercing.tough.discarded': { target: string };
  'hero.tough.absorbed': { target: string };
  'overkill.hit': { amount: number; target: string };
  'overkill.villain.hit': { amount: number; target: string };
  RETALIATE_DAMAGE: {
    actor: string;
    target: string;
    amount: number;
    who?: string;
    damage?: number;
  };
  'retaliate.hit': { actor: string; target: string; amount: number };

  // Damage Application & Absorption
  'damage.applied.ally': {
    target: string;
    amount: number;
    totalDamage?: number;
    health?: number;
  };
  'damage.applied.minion': {
    target: string;
    amount: number;
    totalDamage?: number;
    health?: number;
  };
  'damage.applied.player': {
    target: string;
    amount: number;
    remainingHealth?: number;
  };
  'damage.applied.villain': {
    target: string;
    amount: number;
    remainingHealth?: number;
  };
  'damage.prevented.immune': { target: string };
  'damage.prevented.tough': { target: string };
  'attachment.damageShield.absorbed': {
    target: string;
    card: string;
    amount: number;
    totalDamage?: number;
    threshold?: number;
  };
  'attachment.damageShield.broken': {
    target: string;
    card: string;
    amount: number;
    totalDamage?: number;
    threshold?: number;
  };

  // Decisions, Prompts & Costs
  'ability.aborted.noValidTarget': { actor: string; source?: string };
  'decision.distribution.cancelled': { actor: string; source?: string };
  'decision.distribution.noLegalTarget': {
    actor: string;
    domain?: string;
    amount?: number;
    source?: string;
  };
  'decision.distribution.resolved': {
    actor: string;
    domain?: string;
    amount: number;
    source?: string;
  };
  'decision.order_simultaneous.resolved': { actor: string; amount: number };
  'decision.prompt.cancelled': { actor: string; source?: string };
  'decision.prompt.opened': { actor: string; promptId: string; source?: string };
  'decision.prompt.passed': { actor: string; promptId?: string; source?: string };
  'decision.prompt.resolved': { actor: string; option: string; promptId?: string };
  'deck.shuffled': { actor: string; amount?: number; destination?: string };
  'cost.reduced': { actor: string; source?: string; amount?: number };
  'cost.reduction.consumed': {
    actor: string;
    source?: string;
    card: string;
    amount?: number;
  };

  // Encounter & Schemes
  'encounter.card.revealed': { actor: string };
  'encounter.deck.empty': Record<string, never>;
  'encounter.obligation.discarded': { actor: string; card: string };
  'encounter.reveal.attachment': { card: string; target: string };
  'encounter.reveal.attachmentNoHost': { card: string };
  'encounter.reveal.cancelledAndDiscarded': { card: string };
  'encounter.reveal.minion': { actor: string; card: string };
  'encounter.reveal.obligation': { actor: string; card: string };
  'encounter.reveal.obligationRemoved': { card: string };
  'encounter.reveal.sideScheme': { card: string; amount?: number };
  'encounter.reveal.treachery': { card: string };
  'encounter.surge.triggered': { actor: string; card: string };
  'encounter.whenRevealed.cancelled': { actor: string };
  'minion.confused.cancelled': { actor: string };
  'minion.stunned.cancelled': { actor: string };
  'villain.confused.cancelled': { actor: string };
  'villain.stunned.cancelled': { actor: string };
  'status.confused.cleared': { actor: string };
  'status.stunned.cleared': { actor: string };
  'scheme.acceleration.added': { card: string; amount?: number };
  'scheme.defeated': { target: string; actor?: string; scheme?: string };
  'scheme.threat.added': { target: string; amount: number; currentThreat?: number };
  'scheme.threat.target_missing': {
    target?: string;
    card?: string;
    amount?: number;
  };
  'side_scheme.defeated': {
    actor: string;
    target: string;
    amount?: number;
    remainingThreat?: number;
  };

  // Villain Activations & Boosts
  'villain.boost.added': { card: string };
  'villain.boost.extra': { actor: string };
  'villain.boost.revealed': {
    actor: string;
    card: string;
    amount: number;
    boostIcons?: number;
  };
  'villain.boost.starResolved': { card: string; source?: string; abilityId?: string };
  'villain.stageAdvance': { actor: string; stage: string | number; health?: number };
  'villainPhase.step1.threatPlaced': {
    target: string;
    amount: number;
    currentThreat?: number;
    targetThreat?: number;
  };
  'villainPhase.step3.encounterCardsDealt': {
    basePerPlayer: number;
    heroicLevel?: number;
    hazardCount?: number;
  };
  'villain.scheme.threat': {
    actor: string;
    target: string;
    amount: number;
    boost?: number;
    player?: string;
  };
  'minion.scheme.threat': {
    actor: string;
    target: string;
    amount: number;
    boost?: number;
    player?: string;
  };

  // Engine Internals & Dynamic Triggers
  'engine.infinite_loop_detected': { message: string; cycle?: string };
  'engine.stepError': { effect: string; error?: string; card?: string };
  'identity.ability.used': { source: string; actor: string };
  'attachment.attached': { card: string; target: string };
  'black_cat.fetch': { actor: string; card: string };

  // UI/Narrator Canonical Keys (used in templates)
  BASIC_ATTACK: {
    actor: string;
    target: string;
    amount: number;
    remainingHp?: number;
  };
  BASIC_THWART: { actor: string; target: string; amount: number };
  BASIC_RECOVER: { actor: string; amount: number };
  VILLAIN_ATTACK: {
    actor: string;
    target: string;
    baseAtk?: number;
    amount?: number;
    totalDamage?: number;
  };
  VILLAIN_SCHEME: {
    actor: string;
    target: string;
    baseSch?: number;
    amount?: number;
    totalThreat?: number;
  };
  MINION_ATTACK: { actor: string; target: string; amount: number };
  MINION_SCHEME: { actor: string; target: string; amount: number };
  ROUND_STARTED: { round: number };
  PHASE_CHANGED: { phase: string };
  GAME_STARTED: Record<string, never>;
  DECK_EXHAUSTED: { deckType: string };
  ACCELERATION_TOKEN_ADDED: { count: number };
  MAIN_SCHEME_ADVANCED: { scheme: string; nextStage: string | number };
  SIDE_SCHEME_DEFEATED: { scheme: string };
  MULLIGAN_RESOLVED: {
    player: string;
    discardCount: number;
    drawCount: number;
  };
  FIRST_PLAYER_PASSED: { player: string };
  STATUS_STUNNED: { actor: string; target: string };
  STATUS_CONFUSED: { actor: string; target: string };
  STATUS_TOUGH: { actor: string; target: string };
  APPLY_STATUS: { actor: string; status: string; target: string };
  REMOVE_STATUS: { target: string; status: string };
  DEAL_DAMAGE: { actor: string; target: string; amount: number };
  HEAL_DAMAGE: { actor: string; target: string; amount: number };
  REMOVE_THREAT: { actor: string; target: string; amount: number };
  READY_CHARACTER: { card: string; target: string };
  CANCEL_WHEN_REVEALED: { actor: string; card: string };
  UPGRADE_ATTACHED: { actor: string; card: string; target: string };
  BOOST_REVEALED: { actor: string; card: string; amount: number };
  TREACHERY_SURGED: { card: string };
  CHARACTER_DEFEATED: { target: string };
  HERO_DEFENDED: { actor: string; target?: string; source?: string };
  ALLY_DEFENDED: { actor: string; target?: string; source?: string };
  ATTACK_UNDEFENDED: { actor: string; target?: string };
  CARDS_DISCARDED_NAMES: {
    actor: string;
    amount: number;
    source: string;
    cards: string;
  };
  CARDS_DRAWN_NAMES: { actor: string; amount: number; cards: string };
  CARDS_DRAWN_FROM_SOURCE: {
    actor: string;
    amount: number;
    source: string;
    cards: string;
  };
  VILLAIN_ATTACK_HIT: { actor: string; target: string; amount: number };
  MINION_ATTACK_HIT: { actor: string; target: string; amount: number };
  VILLAIN_PHASE_STEP1_THREAT: { amount: number; scheme: string };
  VILLAIN_SCHEME_THREAT: { actor: string; scheme: string; amount: number };
  PLAYER_TURN_ENDED: { actor: string };
  COST_REDUCTION_CONSUMED: {
    actor: string;
    source: string;
    amount: number;
    card: string;
  };
  CHANGE_FORM: { actor: string; form: string };
  FORM_CHANGED: { actor: string; form: string };
  SIDE_SCHEME_REVEALED: { scheme: string; amount: number };
  STATUS_APPLIED: { target: string; status: string };
  CARD_DRAWN: { actor: string; amount: number };
  CARD_DISCARDED: { actor: string; card: string };
  PLAYER_TABLEAU_DISCARDED: { actor: string; card: string };

  // Template literal index signatures for open extensibility
  [key: `ability.${string}.triggered`]: {
    actor?: string;
    card?: string;
    target?: string;
  };
  [key: `card.${string}.threatReduced`]: {
    actor: string;
    amount: number;
  };
}

/**
 * Array of all static keys in LogEvents.
 * Guard tests iterate over this list to verify UI formatting coverage.
 */
export const ALL_LOG_EVENT_KEYS = [
  'scenario.setup',
  'scenario.setup.drone',
  'scenario.setup.environment',
  'scenario.setup.minion',
  'scenario.setup.sideScheme',
  'scenario.victory',
  'scenario.defeat',
  'scenario.mainSchemeAdvance',
  'game.setup.complete',
  'phase.player_phase.start',
  'phase.player_phase.end',
  'phase.villain_phase.start',
  'round.upkeep.complete',
  'first_player.passed',
  'player.setup.mulligan',
  'dev.card.tutor',
  'player.action.changeForm',
  'player.action.recover',
  'player.action.thwartMainScheme',
  'player.action.thwartSideScheme',
  'player.action.allyAttack',
  'player.action.attackVillain',
  'player.deck.exhausted',
  'player.eliminated',
  'player.phase.cleanup.cardDiscarded',
  'player.phase.cleanup.complete',
  'player.tableau.discarded',
  'player.turn.ended',
  'CARD_PLAYED',
  'card.ability.used',
  'card.ally.defeated',
  'card.attached.to_host',
  'card.attachment.attached',
  'card.cost.damageHero',
  'card.cost.heal',
  'card.discarded.fromDeck',
  'card.discarded.fromHand',
  'card.discarded.to_make_room',
  'card.discarded.uses_exhausted',
  'card.effect.addStatus',
  'card.effect.addTrait',
  'card.effect.dealDamage',
  'card.effect.drawCards',
  'card.effect.flipForm',
  'card.effect.heal',
  'card.effect.preventThreat',
  'card.effect.readyCharacter',
  'card.effect.removeThreat',
  'card.effect.threatBlockedByCrisis',
  'card.effect.threatBlockedByPatrol',
  'card.play.cancelled',
  'card.playFromZone',
  'card.playFromZone.passed',
  'card.playFromZone.resolved',
  'card.playUnderControl.resolved',
  'card.putIntoPlay',
  'card.removedFromGame',
  'card.search.nothingFound',
  'card.search.passed',
  'card.searched.selected',
  'card.state.exhausted',
  'character.setup.resolved',
  'combat.hero.defended',
  'combat.ally.defended',
  'combat.attack.cancelled',
  'combat.attack.undefended',
  'combat.damage.prevented',
  'villain.attack',
  'villain.attack.hit',
  'minion.attack.hit',
  'villain.attack.cancelled',
  'minion.attack.cancelled',
  'ally.attack.hit',
  'ally.defeated.boost.undefended',
  'ally.defeated',
  'ally.piercing.tough.discarded',
  'ally.tough.absorbed',
  'hero.piercing.tough.discarded',
  'hero.tough.absorbed',
  'overkill.hit',
  'overkill.villain.hit',
  'RETALIATE_DAMAGE',
  'retaliate.hit',
  'damage.applied.ally',
  'damage.applied.minion',
  'damage.applied.player',
  'damage.applied.villain',
  'damage.prevented.immune',
  'damage.prevented.tough',
  'attachment.damageShield.absorbed',
  'attachment.damageShield.broken',
  'ability.aborted.noValidTarget',
  'decision.distribution.cancelled',
  'decision.distribution.noLegalTarget',
  'decision.distribution.resolved',
  'decision.order_simultaneous.resolved',
  'decision.prompt.cancelled',
  'decision.prompt.opened',
  'decision.prompt.passed',
  'decision.prompt.resolved',
  'deck.shuffled',
  'cost.reduced',
  'cost.reduction.consumed',
  'encounter.card.revealed',
  'encounter.deck.empty',
  'encounter.obligation.discarded',
  'encounter.reveal.attachment',
  'encounter.reveal.attachmentNoHost',
  'encounter.reveal.cancelledAndDiscarded',
  'encounter.reveal.minion',
  'encounter.reveal.obligation',
  'encounter.reveal.obligationRemoved',
  'encounter.reveal.sideScheme',
  'encounter.reveal.treachery',
  'encounter.surge.triggered',
  'encounter.whenRevealed.cancelled',
  'minion.confused.cancelled',
  'minion.stunned.cancelled',
  'villain.confused.cancelled',
  'villain.stunned.cancelled',
  'status.confused.cleared',
  'status.stunned.cleared',
  'scheme.acceleration.added',
  'scheme.defeated',
  'scheme.threat.added',
  'scheme.threat.target_missing',
  'side_scheme.defeated',
  'villain.boost.added',
  'villain.boost.extra',
  'villain.boost.revealed',
  'villain.boost.starResolved',
  'villain.stageAdvance',
  'villainPhase.step1.threatPlaced',
  'villainPhase.step3.encounterCardsDealt',
  'villain.scheme.threat',
  'minion.scheme.threat',
  'engine.infinite_loop_detected',
  'engine.stepError',
  'identity.ability.used',
  'attachment.attached',
  'black_cat.fetch',
  'BASIC_ATTACK',
  'BASIC_THWART',
  'BASIC_RECOVER',
  'VILLAIN_ATTACK',
  'VILLAIN_SCHEME',
  'MINION_ATTACK',
  'MINION_SCHEME',
  'ROUND_STARTED',
  'PHASE_CHANGED',
  'GAME_STARTED',
  'DECK_EXHAUSTED',
  'ACCELERATION_TOKEN_ADDED',
  'MAIN_SCHEME_ADVANCED',
  'SIDE_SCHEME_DEFEATED',
  'MULLIGAN_RESOLVED',
  'FIRST_PLAYER_PASSED',
  'STATUS_STUNNED',
  'STATUS_CONFUSED',
  'STATUS_TOUGH',
  'APPLY_STATUS',
  'REMOVE_STATUS',
  'DEAL_DAMAGE',
  'HEAL_DAMAGE',
  'REMOVE_THREAT',
  'READY_CHARACTER',
  'CANCEL_WHEN_REVEALED',
  'UPGRADE_ATTACHED',
  'BOOST_REVEALED',
  'TREACHERY_SURGED',
  'CHARACTER_DEFEATED',
  'HERO_DEFENDED',
  'ALLY_DEFENDED',
  'ATTACK_UNDEFENDED',
  'CARDS_DISCARDED_NAMES',
  'CARDS_DRAWN_NAMES',
  'CARDS_DRAWN_FROM_SOURCE',
  'VILLAIN_ATTACK_HIT',
  'MINION_ATTACK_HIT',
  'VILLAIN_PHASE_STEP1_THREAT',
  'VILLAIN_SCHEME_THREAT',
  'PLAYER_TURN_ENDED',
  'COST_REDUCTION_CONSUMED',
  'CHANGE_FORM',
  'FORM_CHANGED',
  'SIDE_SCHEME_REVEALED',
  'STATUS_APPLIED',
  'CARD_DRAWN',
  'CARD_DISCARDED',
  'PLAYER_TABLEAU_DISCARDED',
] as const;

export type StaticLogEventKey = (typeof ALL_LOG_EVENT_KEYS)[number];
