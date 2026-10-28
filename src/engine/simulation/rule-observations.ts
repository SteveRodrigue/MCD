import type { CardAbility } from '../models';
import type { LogEvents } from '../models/log-events';
import type { EffectType } from '../../data/supplemental/runtime';
import type { RuleScenarioId } from './rule-scenarios';
import type { RuleSlug } from './rules-graph';

export type LogKey = keyof LogEvents;
/** Every `prefix.*` that some log key starts with, so a typo in a prefix does not compile. */
type LogPrefix<K extends string> = K extends `${infer Head}.${infer Tail}`
  ? `${Head}.*` | `${Head}.${LogPrefix<Tail>}`
  : never;
/** A log key, or a `prefix.*` that matches every key under that prefix. */
export type LogPattern = LogKey | LogPrefix<LogKey>;

/** What a simulation run has to show for a rule to count as exercised. */
export type Observable =
  /** A game-log key the engine wrote (Stage-Setter runs and Gauntlet matches). */
  | { log: LogPattern }
  /** An ability of this timing was exercised and covered. */
  | { timing: CardAbility['timing'] }
  /** A covered ability resolved a step with this effect. */
  | { effect: EffectType }
  /** A covered ability reacted to this trigger, or a trigger window opened it. */
  | { trigger: string }
  /** A rule scenario ran and passed: for a rule no log key names, the scenario checks the state itself. */
  | { scenario: RuleScenarioId };

export type UntestedKind =
  /** Text, wording, table-talk or mode rule: there is no engine behavior to observe. */
  | 'definition'
  /** The rule may be implemented, but no log key, timing or effect names it. */
  | 'no-observable'
  /** A channel exists, but no scenario reaches it yet. */
  | 'no-scenario';

export type RuleObservation =
  /** Observed when ANY listed observable is seen. */
  { observe: readonly Observable[] } | { untested: UntestedKind; reason: string };

const logs = (...keys: LogPattern[]): RuleObservation => ({
  observe: keys.map((log) => ({ log })),
});
const timings = (...names: CardAbility['timing'][]): RuleObservation => ({
  observe: names.map((timing) => ({ timing })),
});
const effects = (...names: EffectType[]): RuleObservation => ({
  observe: names.map((effect) => ({ effect })),
});
const triggers = (...names: string[]): RuleObservation => ({
  observe: names.map((trigger) => ({ trigger })),
});
const mixed = (...observe: Observable[]): RuleObservation => ({ observe });

const definition = (reason: string): RuleObservation => ({ untested: 'definition', reason });
const NO_CHANNEL = 'no log key, timing, effect or trigger names it';
const unobservable: RuleObservation = { untested: 'no-observable', reason: NO_CHANNEL };

const RESOURCE_TIMINGS = ['RESOURCE', 'HERO_RESOURCE', 'ALTER_EGO_RESOURCE'] as const;
const THWART_EVIDENCE = mixed({ effect: 'REMOVE_THREAT' }, { log: 'card.effect.removeThreat' });
const ENEMY_ACTIVATION_EVIDENCE = logs(
  'villain.attack',
  'villain.scheme.threat',
  'minion.attack.hit',
  'minion.scheme.threat',
);

/**
 * What the simulation must show for each glossary entry of the Rules Reference v1.8, keyed by the
 * slug in `references/rules/rules_graph.json`. Data, not per card (ADR-0021). Typed over every slug,
 * so a new glossary entry does not compile until it is mapped; each observable is typed over the
 * log catalog, ability timings and effect types, so a rename does not compile either.
 */
export const RULE_OBSERVATIONS: Record<RuleSlug, RuleObservation> = {
  ability: logs('card.ability.used', 'identity.ability.used'),
  'acceleration-icon': logs('scheme.acceleration.added'),
  'acceleration-token': logs('scheme.acceleration.added'),
  action: timings('ACTION', 'HERO_ACTION', 'ALTER_EGO_ACTION'),
  activation: ENEMY_ACTIVATION_EVIDENCE,
  'active-player': unobservable,
  additional: unobservable,
  after: timings('RESPONSE', 'FORCED_RESPONSE'),
  'all-purpose-counter': effects('ADD_COUNTERS', 'SPEND_COUNTERS', 'REMOVE_COUNTERS'),
  alliance: unobservable,
  ally: logs('card.ally.defeated', 'combat.ally.defended'),
  'ally-limit': effects('MODIFY_ALLY_LIMIT'),
  already: definition('wording rule for the word "already"'),
  'alteration-effect': unobservable,
  'alter-ego-alter-ego-form': logs('player.action.changeForm', 'card.effect.flipForm'),
  'amplify-icon': unobservable,
  and: definition('wording rule for the word "and"'),
  'arrow-icon': definition('printing convention that separates a cost from its effect'),
  'aspect-card': unobservable,
  assault: unobservable,
  atk: logs('player.action.attackVillain', 'player.action.allyAttack'),
  attachment: logs(
    'card.attachment.attached',
    'attachment.attached',
    'encounter.reveal.attachment',
  ),
  'attach-to': mixed({ effect: 'ATTACH_TO_HOST' }, { log: 'card.attached.to_host' }),
  'attack-enemy-activation': logs('villain.attack', 'minion.attack.hit', 'villain.attack.hit'),
  'attack-player-ability-type': logs('player.action.attackVillain', 'player.action.allyAttack'),
  'attacks-against-allies': logs('combat.ally.defended', 'damage.applied.ally'),
  'base-value': unobservable,
  'basic-card': unobservable,
  'basic-power': unobservable,
  'boost-boost-icon': mixed({ timing: 'BOOST' }, { log: 'villain.boost.revealed' }),
  'campaign-mode': definition('campaign play is outside the engine'),
  'campaign-specific-card': definition('campaign play is outside the engine'),
  cancel: mixed(
    { effect: 'CANCEL_ATTACK' },
    { effect: 'CANCEL_WHEN_REVEALED' },
    { log: 'combat.attack.cancelled' },
    { log: 'encounter.whenRevealed.cancelled' },
    { log: 'card.play.cancelled' },
  ),
  cannot: mixed({ effect: 'CANNOT_TAKE_DAMAGE' }, { log: 'damage.prevented.immune' }),
  'card-ability': logs('card.ability.used'),
  'card-types': definition('lists the card types'),
  character: unobservable,
  'choose-game-element': logs('decision.prompt.resolved'),
  'choose-option': mixed({ effect: 'PLAYER_CHOICE' }, { log: 'decision.prompt.resolved' }),
  classifications: definition('lists the card classifications'),
  'confuse-confused': logs(
    'status.confused.cleared',
    'minion.confused.cancelled',
    'villain.confused.cancelled',
  ),
  'consequential-damage': unobservable,
  'constant-ability': timings('CONSTANT'),
  control: unobservable,
  copy: unobservable,
  cost: mixed(
    { effect: 'REDUCE_NEXT_CARD_COST' },
    { log: 'cost.reduced' },
    { log: 'cost.reduction.consumed' },
    { log: 'card.cost.*' },
  ),
  'cost-arrow-icon': definition('printing convention that separates a cost from its effect'),
  counter: effects('ADD_COUNTERS', 'SPEND_COUNTERS', 'REMOVE_COUNTERS'),
  'crisis-icon': logs('card.effect.threatBlockedByCrisis'),
  damage: logs('damage.applied.*'),
  'dash-value': definition('printing convention for a stat with no value'),
  'deal-deal-an-encounter-card': logs('encounter.card.revealed'),
  deck: logs('deck.shuffled'),
  'deck-customization': definition('deckbuilding is outside the simulation'),
  def: logs('combat.hero.defended', 'combat.ally.defended'),
  defeat: logs('card.ally.defeated', 'ally.defeated', 'scheme.defeated', 'player.eliminated'),
  'defend-defense': mixed(
    { effect: 'DECLARE_DEFENDER' },
    { log: 'combat.hero.defended' },
    { log: 'combat.ally.defended' },
  ),
  'delayed-effect': unobservable,
  discard: logs('card.discarded.*'),
  'discard-pile': logs('card.discarded.*'),
  'double-sided-card': unobservable,
  'draw-drawing-cards': mixed({ effect: 'DRAW' }, { log: 'card.effect.drawCards' }),
  'each-player': unobservable,
  'each-time': unobservable,
  effect: unobservable,
  'empty-deck': logs('player.deck.exhausted'),
  'encounter-card': logs('encounter.card.revealed'),
  'encounter-deck': logs('encounter.card.revealed', 'encounter.deck.empty'),
  'encounter-discard-pile': logs(
    'encounter.reveal.cancelledAndDiscarded',
    'encounter.obligation.discarded',
  ),
  'encounter-set': definition('card-set membership'),
  'end-of-player-phase': logs('phase.player_phase.end'),
  enemy: logs('villain.attack', 'minion.attack.hit'),
  'enemy-activation': ENEMY_ACTIVATION_EVIDENCE,
  'enemy-attacks': logs('villain.attack', 'minion.attack.hit'),
  'enemy-schemes': logs('villain.scheme.threat', 'minion.scheme.threat'),
  'energy-resource': unobservable,
  engage: unobservable,
  'enters-play': mixed(
    { trigger: 'MINION_ENTERS_PLAY' },
    { log: 'card.putIntoPlay' },
    { log: 'encounter.reveal.minion' },
  ),
  environment: logs('scenario.setup.environment'),
  event: unobservable,
  'excess-damage': unobservable,
  exhausted: mixed({ effect: 'EXHAUST' }, { log: 'card.state.exhausted' }),
  'expert-mode': unobservable,
  'expert-set': unobservable,
  find: mixed({ effect: 'SEARCH' }, { log: 'card.searched.selected' }),
  'first-player': logs('first_player.passed'),
  flip: mixed({ effect: 'FLIP_FORM' }, { log: 'card.effect.flipForm' }),
  'for-each': unobservable,
  forced: timings('FORCED_INTERRUPT', 'FORCED_RESPONSE'),
  'form-change-form': mixed(
    { effect: 'CHANGE_FORM' },
    { log: 'player.action.changeForm' },
    { log: 'card.effect.flipForm' },
  ),
  friendly: unobservable,
  gains: effects('GRANT_KEYWORD', 'MODIFY_STAT'),
  'game-element': unobservable,
  generate: effects('GENERATE_RESOURCE'),
  gets: effects('MODIFY_STAT'),
  guard: unobservable,
  'hand-size': effects('MODIFY_HAND_SIZE'),
  'hazard-icon': unobservable,
  heal: mixed({ effect: 'HEAL_DAMAGE' }, { log: 'card.effect.heal' }),
  'hero-hero-form': mixed({ timing: 'HERO_ACTION' }, { log: 'player.action.changeForm' }),
  'heroic-mode': unobservable,
  'hinder-x': unobservable,
  'hit-points': logs('damage.applied.*'),
  icons: definition('lists the icons'),
  identity: logs('identity.ability.used'),
  'identity-specific-card': unobservable,
  ignore: unobservable,
  'in-play-and-out-of-play': logs('card.putIntoPlay', 'card.removedFromGame'),
  'in-player-order': unobservable,
  'incite-x': unobservable,
  'indirect-damage': unobservable,
  'infinite-hit-points': unobservable,
  'initiating-abilities': logs('card.ability.used', 'identity.ability.used'),
  instead: unobservable,
  interrupt: timings('INTERRUPT', 'HERO_INTERRUPT', 'ALTER_EGO_INTERRUPT'),
  keywords: mixed(
    { effect: 'GRANT_KEYWORD' },
    { log: 'encounter.surge.triggered' },
    { log: 'overkill.hit' },
    { log: 'retaliate.hit' },
    { log: 'damage.tough.pierced' },
  ),
  'labeled-ability': unobservable,
  'lasting-effects': unobservable,
  leader: unobservable,
  'leaves-play': logs('card.ally.defeated', 'card.removedFromGame', 'side_scheme.defeated'),
  limit: mixed(
    { effect: 'MODIFY_ALLY_LIMIT' },
    { effect: 'MODIFY_RESTRICTED_LIMIT' },
    { log: 'card.discarded.to_make_room' },
  ),
  'linked-card-title': unobservable,
  'look-looked-at': unobservable,
  loses: unobservable,
  'main-scheme-main-scheme-deck': logs('scenario.mainSchemeAdvance', 'villain.stageAdvance'),
  'max-maximum': unobservable,
  'maximum-hit-points': effects('MODIFY_MAX_HEALTH'),
  may: logs('decision.prompt.passed'),
  'mental-resource': unobservable,
  minion: logs('encounter.reveal.minion', 'minion.attack.hit'),
  'modes-of-play': definition('lists the modes of play'),
  modifiers: effects('MODIFY_STAT'),
  'modular-encounter-set': unobservable,
  move: unobservable,
  'nemesis-encounter-set': unobservable,
  'non-numerical-variable': unobservable,
  obligation: logs('encounter.reveal.obligation'),
  otherwise: unobservable,
  overkill: logs('overkill.hit'),
  overpay: unobservable,
  'ownership-and-control': unobservable,
  patrol: logs('card.effect.threatBlockedByPatrol'),
  pay: logs('card.cost.*', 'cost.reduced'),
  'per-player-icon': unobservable,
  peril: unobservable,
  permanent: unobservable,
  'physical-resource': unobservable,
  piercing: logs('damage.tough.pierced'),
  'play-put-into-play': mixed(
    { trigger: 'CARD_PLAYED' },
    { effect: 'PUT_INTO_PLAY' },
    { effect: 'PLAY_FROM_ZONE' },
    { log: 'card.putIntoPlay' },
    { log: 'card.playFromZone.resolved' },
  ),
  'play-area': unobservable,
  'play-restrictions-and-permissions': unobservable,
  player: unobservable,
  'player-card': unobservable,
  'player-deck': logs('deck.shuffled'),
  'player-discard-pile': logs('card.discarded.*'),
  'player-elimination': logs('player.eliminated'),
  'player-phase': logs('phase.player_phase.start', 'phase.player_phase.end'),
  'player-side-scheme': unobservable,
  'player-side-scheme-limit': unobservable,
  'player-turn': logs('player.turn.ended'),
  'player’s-play-area': unobservable,
  'playing-cards': mixed({ trigger: 'CARD_PLAYED' }, { log: 'card.playFromZone.resolved' }),
  prevent: mixed(
    { effect: 'PREVENT_DAMAGE' },
    { effect: 'PREVENT_THREAT' },
    { log: 'combat.damage.prevented' },
    { log: 'card.effect.preventThreat' },
  ),
  printed: unobservable,
  qualifiers: unobservable,
  quickstrike: unobservable,
  ranged: unobservable,
  ready: mixed({ effect: 'READY' }, { log: 'card.effect.readyCharacter' }),
  rec: logs('player.action.recover'),
  'recover-recovery': logs('player.action.recover'),
  'referential-ability': unobservable,
  'remaining-hit-points': unobservable,
  'reminder-text': definition('text printed in italics with no rules weight'),
  'removed-from-the-game': mixed({ effect: 'REMOVE_FROM_GAME' }, { log: 'card.removedFromGame' }),
  'replacement-effect': unobservable,
  'requirement-resources': unobservable,
  resolve: logs('decision.prompt.resolved'),
  resource: mixed(
    { timing: 'RESOURCE' },
    { timing: 'HERO_RESOURCE' },
    { effect: 'GENERATE_RESOURCE' },
  ),
  'resource-ability': timings(...RESOURCE_TIMINGS),
  'resource-card': timings(...RESOURCE_TIMINGS),
  'resource-type': unobservable,
  response: timings('RESPONSE', 'HERO_RESPONSE', 'ALTER_EGO_RESPONSE'),
  restricted: mixed({ effect: 'MODIFY_RESTRICTED_LIMIT' }, { scenario: 'restricted-limit' }),
  'retaliate-x': logs('retaliate.hit'),
  reveal: logs('encounter.card.revealed', 'villain.boost.revealed'),
  'rookie-mode': unobservable,
  'round-structure': logs(
    'phase.player_phase.start',
    'phase.villain_phase.start',
    'round.upkeep.complete',
  ),
  'running-out-of-cards': logs('player.deck.exhausted', 'encounter.deck.empty'),
  'scenario-specific-card': unobservable,
  sch: logs('villain.scheme.threat', 'minion.scheme.threat'),
  'scheme-card-type': logs('scheme.defeated', 'scheme.threat.added'),
  'scheme-enemy-activation': logs('villain.scheme.threat', 'minion.scheme.threat'),
  search: mixed(
    { effect: 'SEARCH' },
    { log: 'card.searched.selected' },
    { log: 'card.search.passed' },
  ),
  'self-referential': unobservable,
  'set-aside-set-aside': unobservable,
  'set-icon': definition('printing convention that names the card set'),
  'setup-keyword': timings('SETUP'),
  'setup-triggered-ability': mixed({ timing: 'SETUP' }, { log: 'character.setup.resolved' }),
  shuffle: mixed({ effect: 'SHUFFLE_INTO_DECK' }, { log: 'deck.shuffled' }),
  'side-scheme': logs(
    'encounter.reveal.sideScheme',
    'side_scheme.defeated',
    'scenario.setup.sideScheme',
  ),
  'simultaneous-resolution': logs('decision.order_simultaneous.resolved'),
  'skirmish-mode': definition('a mode of play outside the engine'),
  special: mixed({ timing: 'SPECIAL' }, { effect: 'EXECUTE_SPECIAL' }),
  stalwart: unobservable,
  'standard-mode': unobservable,
  'standard-set': unobservable,
  'star-icon': logs('villain.boost.starResolved'),
  treachery: logs('encounter.reveal.treachery'),
  'status-cards': mixed(
    { effect: 'ADD_STATUS' },
    { log: 'status.stunned.cleared' },
    { log: 'status.confused.cleared' },
  ),
  steady: unobservable,
  'stun-stunned': logs(
    'status.stunned.cleared',
    'minion.stunned.cancelled',
    'villain.stunned.cancelled',
  ),
  subtitle: definition('printed card subtitle'),
  support: unobservable,
  surge: mixed({ effect: 'SURGE' }, { log: 'encounter.surge.triggered' }),
  'sustained-damage': unobservable,
  swap: unobservable,
  'table-talk': definition('table etiquette for players'),
  target: logs(
    'ability.aborted.noValidTarget',
    'ability.skipped.noValidTarget',
    'decision.prompt.resolved',
  ),
  'target-threat': unobservable,
  'team-up': unobservable,
  'teamwork-trait': unobservable,
  temporary: unobservable,
  'text-box': definition('layout of a card'),
  that: definition('wording rule for the word "that"'),
  then: unobservable,
  this: definition('wording rule for the word "this"'),
  threat: logs('scheme.threat.added', 'card.effect.removeThreat'),
  thw: THWART_EVIDENCE,
  thwart: THWART_EVIDENCE,
  timing: timings('INTERRUPT', 'RESPONSE', 'ACTION', 'WHEN_REVEALED'),
  tough: logs('damage.prevented.tough'),
  toughness: logs('damage.prevented.tough', 'damage.tough.pierced'),
  traits: mixed({ effect: 'ADD_TRAIT' }, { log: 'card.effect.addTrait' }),
  'triggered-ability': timings('FORCED_INTERRUPT', 'INTERRUPT', 'FORCED_RESPONSE', 'RESPONSE'),
  'triggering-condition': triggers('CARD_PLAYED', 'ATTACK_RESOLVED', 'ROUND_ENDED'),
  tuck: effects('PLACE_CARD_UNDER_HOST', 'ATTACH_FACEDOWN_CARDS_FROM_HAND'),
  undefended: logs('combat.attack.undefended'),
  'unique-icon': unobservable,
  upgrade: unobservable,
  'uses-x-type': mixed({ effect: 'SPEND_COUNTERS' }, { log: 'card.discarded.uses_exhausted' }),
  'valid-target': logs('ability.aborted.noValidTarget', 'ability.skipped.noValidTarget'),
  'victory-display': unobservable,
  'victory-x': unobservable,
  'villain-villain-deck': logs('villain.attack', 'villain.scheme.threat', 'villain.stageAdvance'),
  'villain-defeat': logs('scenario.victory'),
  'villain-phase': logs('phase.villain_phase.start'),
  'villain’s-play-area': unobservable,
  villainous: unobservable,
  vulnerable: unobservable,
  'when-completed-abilities': unobservable,
  'when-defeated-abilities': triggers('DEFEATED', 'CHARACTER_DEFEATED'),
  'when-revealed-abilities': timings('WHEN_REVEALED'),
  'wild-resource': unobservable,
  'winning-the-game': logs('scenario.victory'),
  would: triggers('THREAT_WOULD_BE_PLACED', 'DAMAGE_WOULD_BE_TAKEN'),
  'x-value': unobservable,
  'you-your': definition('wording rule for the words "you" and "your"'),
};
