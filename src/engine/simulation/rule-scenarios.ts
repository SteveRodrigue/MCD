import { CardType, Keyword, StatusCard, type HeroCard, type NormalizedCard } from '../models';
import type { GameState, LogEvents, CardInstance } from '../models';
import { createCardInstance } from '../state/game-setup';
import { executeEnemyAttackSynchronously } from '../pipeline/combat-pipeline';
import { applyThreatPlacement, removeThreatFromScheme } from '../pipeline/threat-pipeline';
import { getPlayerRestrictedCount } from '../pipeline/legality-checker';
import { getEffectiveMinionHitPoints } from '../pipeline/stat-calculator';
import { buildAbilityInventory } from './ability-coverage';
import { drainPrompts, type PromptOptionPicker } from './match-simulator';
import {
  basicAttack,
  createStage,
  dispatchOrThrow,
  endRound,
  logKeysOf,
  openTriggerWindow,
  paymentIds,
  player1,
  revealFixture,
  setForm,
  STAGED_TRIGGERS,
  thaw,
  type Stage,
  type StageOptions,
} from './ability-stage-setter';

type LogKey = keyof LogEvents;

/** A situation the rules describe, played through real engine actions and checked by what it wrote. */
interface RuleScenario {
  /** Log keys that must appear: a scenario that does not write them did not reach its situation. */
  expects: readonly LogKey[];
  stage: (options: StageOptions) => GameState;
  /** A rule the log cannot show (no key names it): the scenario itself checks the final state. */
  verify?: (state: GameState) => string | undefined;
}

const SEED = 'rule-scenario';

/** Takes the first enabled option whose id starts with one of the prefixes, else the default pick. */
const prefer =
  (...prefixes: string[]): PromptOptionPicker =>
  (prompt) => {
    const enabled = prompt.options.filter((o) => !o.disabled);
    for (const prefix of prefixes) {
      const hit = enabled.find((o) => o.id.startsWith(prefix));
      if (hit) return hit.id;
    }
    return undefined;
  };

const hasKeywordNamed = (card: NormalizedCard, name: string) =>
  (card.keywords ?? []).some((k) => String(k).toLowerCase().startsWith(name));

/** The keyword a rule is named after: a scenario asks for 'patrol' and prints it on a fixture, it never reads the rule. */
const keywordNamed = (name: string): Keyword => {
  const keyword = Object.values(Keyword).find((k) => k.toLowerCase() === name);
  if (!keyword) throw new Error(`[RuleScenarios] '${name}' is not a keyword`);
  return keyword;
};

/** A catalog card re-printed with a keyword the Core set never prints (Patrol, Piercing, Restricted). */
const printedWith = (card: NormalizedCard, name: string): NormalizedCard =>
  ({
    ...card,
    code: `${card.code}_${name}`,
    keywords: [...(card.keywords ?? []), keywordNamed(name)],
  }) as NormalizedCard;

function newStage(options: StageOptions, scenarioId?: string): Stage {
  const hero = options.catalog
    .getCardsBySet('spider_man')
    .find((c): c is HeroCard => c.type === CardType.HERO);
  if (!hero) throw new Error('[RuleScenarios] no hero in the spider_man set');
  const stage = createStage({ card: hero, seed: SEED, setup: false, scenarioId }, options);
  setForm(player1(stage), 'hero');
  return stage;
}

const fixture = (name: string, card: NormalizedCard | undefined): NormalizedCard => {
  if (!card) throw new Error(`[RuleScenarios] no ${name} fixture in the catalog`);
  return card;
};

const instance = (stage: Stage, card: NormalizedCard): CardInstance =>
  createCardInstance(card, player1(stage).id);

/** The villain phase from the player's end of turn, answering each prompt as `pick` says. */
function villainPhase(stage: Stage, pick: PromptOptionPicker): GameState {
  const state = dispatchOrThrow(stage.state, {
    type: 'END_PLAYER_TURN',
    playerId: player1(stage).id,
  });
  return drainPrompts(state, SEED, pick);
}

const allyDefends: RuleScenario = {
  expects: ['combat.ally.defended', 'decision.prompt.passed'],
  stage: (options) => {
    const stage = newStage(options);
    player1(stage).allies.push(instance(stage, fixture('ally', stage.fixtures.ally)));
    return villainPhase(stage, prefer('pass', 'defend_ally'));
  },
};

const toughHero: RuleScenario = {
  expects: ['damage.prevented.tough'],
  stage: (options) => {
    const stage = newStage(options);
    player1(stage).statusCards.push(StatusCard.TOUGH);
    return villainPhase(stage, prefer('pass', 'undefended'));
  },
};

/** The first catalog minion that prints the keyword (Toughness, Retaliate). */
const minionWith = (stage: Stage, name: string): NormalizedCard =>
  fixture(
    `${name} minion`,
    stage.options.allCards.find((c) => c.type === CardType.MINION && hasKeywordNamed(c, name)),
  );

function engage(stage: Stage, card: NormalizedCard): CardInstance {
  const minion = instance(stage, card);
  player1(stage).engagedMinions.push(minion);
  return minion;
}

const toughnessMinion: RuleScenario = {
  expects: ['damage.prevented.tough'],
  stage: (options) => {
    const stage = newStage(options);
    // Revealed through the encounter pipeline, which gives a Toughness minion its tough status
    stage.state = revealFixture(stage, minionWith(stage, 'toughness'));
    const minion = player1(stage).engagedMinions.at(-1);
    if (!minion) throw new Error('the revealed minion did not engage');
    return basicAttack(stage, 'minion', minion.instanceId);
  },
};

const retaliateMinion: RuleScenario = {
  expects: ['retaliate.hit'],
  stage: (options) => {
    const stage = newStage(options);
    const minion = engage(stage, minionWith(stage, 'retaliate'));
    return drainPrompts(basicAttack(stage, 'minion', minion.instanceId), SEED);
  },
};

/** A minion printed with a keyword it does not have in the core set, engaged with the player. */
function engageWith(stage: Stage, keyword: string, stats = {}): CardInstance {
  const base = fixture('minion', stage.fixtures.minion);
  return engage(stage, { ...printedWith(base, keyword), ...stats } as NormalizedCard);
}

const piercingAttack: RuleScenario = {
  expects: ['damage.tough.pierced'],
  stage: (options) => {
    const stage = newStage(options);
    player1(stage).statusCards.push(StatusCard.TOUGH);
    const minion = engageWith(stage, 'piercing');
    return executeEnemyAttackSynchronously(
      stage.state,
      { type: 'MINION', card: minion },
      player1(stage).id,
      'TAKE_UNDEFENDED',
    );
  },
};

const overkillAttack: RuleScenario = {
  expects: ['overkill.hit'],
  stage: (options) => {
    const stage = newStage(options);
    const ally = instance(stage, fixture('ally', stage.fixtures.ally));
    // One hit point left, so the attack's excess damage spills over to the hero
    ally.tokens = { ...ally.tokens, damage: getEffectiveMinionHitPoints(stage.state, ally) - 1 };
    player1(stage).allies.push(ally);
    const minion = engageWith(stage, 'overkill', { attack: 5 });
    return executeEnemyAttackSynchronously(
      stage.state,
      { type: 'MINION', card: minion },
      player1(stage).id,
      'ALLY_CHUMP_BLOCK',
    );
  },
};

/** Takes threat off the main scheme the way a player card's effect does (the thwart action is gated earlier). */
function thwartMainScheme(stage: Stage): GameState {
  applyThreatPlacement(stage.state, {
    targetType: 'main_scheme',
    amount: 3,
    sourceType: 'CARD_EFFECT',
  });
  removeThreatFromScheme(stage.state, {
    playerId: player1(stage).id,
    targetType: 'main_scheme',
    amount: 1,
    sourceName: 'Rule scenario',
  });
  return stage.state;
}

const patrolBlocks: RuleScenario = {
  expects: ['card.effect.threatBlockedByPatrol'],
  stage: (options) => {
    const stage = newStage(options);
    engageWith(stage, 'patrol');
    return thwartMainScheme(stage);
  },
};

const crisisBlocks: RuleScenario = {
  expects: ['card.effect.threatBlockedByCrisis'],
  stage: (options) => {
    const stage = newStage(options);
    const crisis = fixture(
      'crisis side scheme',
      stage.options.allCards.find(
        (c) => c.type === CardType.SIDE_SCHEME && (c.scheme_crisis ?? 0) > 0,
      ),
    );
    stage.state.sideSchemes.push({
      instanceId: 'sim_crisis',
      card: crisis as never,
      threat: crisis.scheme_crisis ?? 1,
    });
    return thwartMainScheme(stage);
  },
};

const stunned: RuleScenario = {
  expects: ['status.stunned.cleared', 'villain.stunned.cancelled', 'minion.stunned.cancelled'],
  stage: (options) => {
    const stage = newStage(options);
    player1(stage).statusCards.push(StatusCard.STUNNED);
    stage.state.villains[0].statusCards.push(StatusCard.STUNNED);
    engage(stage, fixture('minion', stage.fixtures.minion)).statusCards = [StatusCard.STUNNED];
    const attacked = basicAttack(stage, 'villain');
    stage.state = attacked;
    return villainPhase(stage, prefer('pass', 'undefended'));
  },
};

const confused: RuleScenario = {
  expects: ['status.confused.cleared', 'villain.confused.cancelled', 'minion.confused.cancelled'],
  stage: (options) => {
    const stage = newStage(options);
    const p = player1(stage);
    p.statusCards.push(StatusCard.CONFUSED);
    stage.state.villains[0].statusCards.push(StatusCard.CONFUSED);
    engage(stage, fixture('minion', stage.fixtures.minion)).statusCards = [StatusCard.CONFUSED];
    applyThreatPlacement(stage.state, {
      targetType: 'main_scheme',
      amount: 3,
      sourceType: 'CARD_EFFECT',
    });
    stage.state = dispatchOrThrow(stage.state, {
      type: 'BASIC_THWART',
      playerId: p.id,
      targetType: 'main_scheme',
    });
    // Enemies scheme against an alter-ego, so the confused villain and minion have something to cancel
    stage.state = thaw(stage.state);
    setForm(player1(stage), 'alter_ego');
    return villainPhase(stage, prefer('pass', 'undefended'));
  },
};

const recoverAction: RuleScenario = {
  expects: ['player.action.recover'],
  stage: (options) => {
    const stage = newStage(options);
    const p = player1(stage);
    setForm(p, 'alter_ego');
    p.health = Math.max(1, p.maxHealth - 3);
    return dispatchOrThrow(stage.state, { type: 'BASIC_RECOVER', playerId: p.id });
  },
};

const emptyDecks: RuleScenario = {
  expects: ['player.deck.exhausted'],
  stage: (options) => {
    const stage = newStage(options);
    const p = player1(stage);
    // The discard pile is what an empty deck is reshuffled from
    p.deck = [];
    p.discard.push(instance(stage, stage.fixtures.filler));
    return endRound(stage);
  },
};

const victory: RuleScenario = {
  expects: ['scenario.victory'],
  stage: (options) => {
    const stage = newStage(options);
    let state = stage.state;
    // Every stage of the villain falls to one hit; the last one ends the game
    for (let i = 0; i < 6 && !state.winner; i++) {
      stage.state = thaw(state);
      stage.state.villains[0].health = 1;
      player1(stage).exhausted = false;
      state = drainPrompts(basicAttack(stage, 'villain'), SEED);
    }
    return state;
  },
};

/**
 * Two copies of an optional event response, opened by the trigger they share. When the first copy
 * takes away the second's target (a ready needs an exhausted hero), the second is skipped. The
 * first catalog event that does so is the fixture: found by what the window wrote, not by effect.
 */
const noValidTarget: RuleScenario = {
  expects: ['ability.skipped.noValidTarget'],
  stage: (options) => {
    const candidates = buildAbilityInventory(options.allCards).filter(
      (t) =>
        t.card.type === CardType.EVENT &&
        t.ability.trigger !== undefined &&
        STAGED_TRIGGERS.includes(t.ability.trigger),
    );
    let last: GameState | undefined;
    for (const candidate of candidates) {
      try {
        last = openTriggerWindow([candidate, candidate], options).state;
      } catch {
        continue; // this event cannot be staged twice: try the next one
      }
      if (logKeysOf(last).includes('ability.skipped.noValidTarget')) return last;
    }
    if (!last) throw new Error('no event response could be staged twice');
    return last;
  },
};

const RESTRICTED_LIMIT = 2;

/** A third Restricted card forces a discard from play: no log key says so, so the scenario checks the table. */
const restrictedLimit: RuleScenario = {
  expects: [],
  stage: (options) => {
    const stage = newStage(options);
    const upgrade = fixture(
      'upgrade',
      stage.options.allCards.find((c) => c.type === CardType.UPGRADE),
    );
    const restricted = {
      ...printedWith(upgrade, 'restricted'),
      cost: 1,
      enrichment: undefined,
    } as NormalizedCard;
    const p = player1(stage);
    for (let i = 0; i < RESTRICTED_LIMIT; i++) p.tableau.push(instance(stage, restricted));
    const incoming = instance(stage, restricted);
    p.hand.push(incoming);
    const played = dispatchOrThrow(stage.state, {
      type: 'PLAY_CARD',
      playerId: p.id,
      cardInstanceId: incoming.instanceId,
      paymentCardInstanceIds: paymentIds(stage, incoming.instanceId),
    });
    // The replacement prompt offers each restricted card in play; anything but cancelling discards one
    return drainPrompts(
      played,
      SEED,
      (prompt) => prompt.options.find((o) => !o.disabled && o.id !== 'cancel_play')?.id,
    );
  },
  verify: (state) => {
    const count = getPlayerRestrictedCount(state.players[0]);
    return count === RESTRICTED_LIMIT
      ? undefined
      : `${count} restricted cards in play, expected ${RESTRICTED_LIMIT}`;
  },
};

/** The last Uses counter spent through the card's own action discards the card. */
const usesExhausted: RuleScenario = {
  expects: ['card.discarded.uses_exhausted'],
  stage: (options) => {
    const stage = newStage(options);
    const spender = (card: NormalizedCard) =>
      card.enrichment?.uses?.discardOnEmpty
        ? (card.enrichment.abilities ?? []).find(
            (a) => a.timing === 'ACTION' && a.cost?.spendCounters && !a.trigger,
          )
        : undefined;
    const card = fixture(
      'Uses support',
      stage.options.allCards.find((c) => c.type === CardType.SUPPORT && spender(c)),
    );
    const ability = spender(card);
    if (!ability?.cost?.spendCounters) throw new Error('the Uses fixture lost its ability');
    const { amount } = ability.cost.spendCounters;
    const counterType =
      ability.cost.spendCounters.counterType ?? card.enrichment?.uses?.counterType ?? 'all_purpose';
    const source = instance(stage, card);
    source.counters = { ...source.counters, [counterType]: amount };
    source.tokens = { ...source.tokens, counters: amount };
    player1(stage).tableau.push(source);
    const used = dispatchOrThrow(stage.state, {
      type: 'USE_CARD_ABILITY',
      playerId: player1(stage).id,
      cardInstanceId: source.instanceId,
      abilityId: ability.id,
      paymentCardInstanceIds: paymentIds(stage),
    });
    return drainPrompts(used, SEED);
  },
};

const environmentSetup: RuleScenario = {
  expects: ['scenario.setup.environment'],
  stage: (options) => newStage(options, 'ultron').state,
};

export const RULE_SCENARIOS = {
  'ally-defends': allyDefends,
  'tough-hero': toughHero,
  'toughness-minion': toughnessMinion,
  'retaliate-minion': retaliateMinion,
  'piercing-attack': piercingAttack,
  'overkill-attack': overkillAttack,
  'patrol-blocks': patrolBlocks,
  'crisis-blocks': crisisBlocks,
  stunned,
  confused,
  'recover-action': recoverAction,
  'empty-decks': emptyDecks,
  victory,
  'no-valid-target': noValidTarget,
  'restricted-limit': restrictedLimit,
  'uses-exhausted': usesExhausted,
  'environment-setup': environmentSetup,
} as const satisfies Record<string, RuleScenario>;

export type RuleScenarioId = keyof typeof RULE_SCENARIOS;

export interface RuleScenarioResult {
  id: RuleScenarioId;
  ok: boolean;
  reason?: string;
  /** Every distinct log key an `ok` scenario wrote, sorted. */
  logKeys: string[];
}

export function runRuleScenario(id: RuleScenarioId, options: StageOptions): RuleScenarioResult {
  const scenario: RuleScenario = RULE_SCENARIOS[id];
  try {
    const state = scenario.stage(options);
    const logKeys = logKeysOf(state);
    const missing = scenario.expects.filter((key) => !logKeys.includes(key));
    if (missing.length > 0) {
      return { id, ok: false, reason: `did not write ${missing.join(', ')}`, logKeys: [] };
    }
    const failure = scenario.verify?.(state);
    return failure ? { id, ok: false, reason: failure, logKeys: [] } : { id, ok: true, logKeys };
  } catch (error) {
    return {
      id,
      ok: false,
      reason: `threw: ${error instanceof Error ? error.message : error}`,
      logKeys: [],
    };
  }
}

/** Every rule scenario in a fixed order, so the same catalog always gives the same report. */
export function sweepRuleScenarios(options: StageOptions): RuleScenarioResult[] {
  return (Object.keys(RULE_SCENARIOS) as RuleScenarioId[]).map((id) =>
    runRuleScenario(id, options),
  );
}
