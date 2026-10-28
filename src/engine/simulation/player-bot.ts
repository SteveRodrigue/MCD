import {
  GameState,
  GameAction,
  PendingDecisionPrompt,
  PlayerState,
  AllyCard,
  CardAbility,
  CardInstance,
  CardType,
  NormalizedCard,
  type UseCardAbilityAction,
  StatusCard,
  getActiveMainScheme,
  getActiveVillain,
} from '@engine/models';
import {
  canChangeForm,
  canBasicRecover,
  canAttack,
  canThwart,
  canPlayCard,
  canInitiateAbility,
  evaluateCardPlayability,
  getEffectiveCardCost,
  getEffectiveMinionAttack,
  getEffectiveMinionScheme,
  getEffectiveVillainStats,
  getGeneratorProvidedResources,
  getLegalActionsForPlayer,
  getHandCardResourceValue,
  getVillainPhaseThreatToAdd,
  HERO_ACTOR,
} from '../pipeline';
import { getStepEffectParams } from '../../data/supplemental/runtime';
import type { AbilityStep } from '../../data/supplemental/schema';
import { isGuardMinion } from '../pipeline/target-restrictions';
import { matchesCardFilter } from '../filters/card-filter';
import { abilityKey, scarcityOf, untestedWeight, type ScarcityLedger } from './ability-coverage';
import type { ActionActor } from '../pipeline';

export interface BotDecisionContext {
  state: GameState;
  playerId: string;
  /** What has been played and used so far; present, the bot also works to test untested abilities. */
  scarcity?: ScarcityLedger;
}

/** The tunable numbers of the bot; every threshold of the policy lives here. */
export const BOT_POLICY = {
  /** Extra threat assumed for the boost cards of the next villain phase. */
  threatSafetyMargin: 1,
  /** Share of the scheme target (threat now + threat to come) from which thwarting beats attacking. */
  thwartPressure: 0.6,
  /** Alter-Ego health share from which the bot flips to hero without recovering first. */
  healthyShare: 0.9,
  /** Value of a card in play, by type; payment keeps the valuable cards. */
  cardValue: {
    [CardType.ALLY]: 6,
    [CardType.UPGRADE]: 5,
    [CardType.SUPPORT]: 5,
    [CardType.EVENT]: 3,
  } as Partial<Record<CardType, number>>,
  /** Value of a card the bot would rather pay with than play. */
  defaultCardValue: 1,
  /** Value lost per resource a paying card provides beyond its first. */
  extraResourceDiscount: 0.75,
  /** Share of a paying card's keep value that counts against playing a card. */
  paymentPriceShare: 0.2,
  /** Cost of each resource paid beyond the cost of the card. */
  wastedResourceCost: 0.5,
  /** Rounds at the start of the game in which every character thwarts before attacking. */
  openingRounds: 3,
  /** Play bonus of a card that stuns an enemy while the villain is not stunned. */
  stunBonus: 10,
  /** Play bonus of a card that draws cards. */
  drawBonus: 4,
  /** Play bonus of an upgrade or support while the tableau is empty. */
  emptyTableauBonus: 3,
  /** Payment price share while the tableau is empty: the bot spends cards to fill it. */
  emptyTableauPriceShare: 0.1,
  /** Damage assumed for the boost cards of an attack that is being defended. */
  boostAllowance: 1,
  /** Health the bot wants left after an undefended hit; below it, it defends. */
  defendHealthFloor: 4,
  /** Play bonus of a card with untested abilities, scaled by how untested the scarcest one is. */
  untestedCardBonus: 6,
  /** Keep value added to a card with untested abilities, so payment spends tested cards first. */
  untestedKeepProtection: 8,
  /** Scarcity from which an ability counts as untested (never used, or used once). */
  untestedThreshold: 0.5,
  /** Play bonus of a setup piece that another card in hand needs in play. */
  setupBonus: 3,
  /** Health left after a hit the bot takes on purpose to enable a heal ability. */
  safeHitHealthFloor: 2,
} as const;

const IDENTITY_GENERATOR = 'identity_ability';
const MAX_PAYMENT_SEARCH_CARDS = 10;

interface Payment {
  paymentCardInstanceIds: string[];
  generatorInstanceIds: string[];
  /** Value of the hand cards the payment gives up, plus the waste. */
  price: number;
}

function cardValue(card: CardInstance): number {
  return BOT_POLICY.cardValue[card.card.type] ?? BOT_POLICY.defaultCardValue;
}

const ENEMY_TARGETS = new Set(['VILLAIN', 'HOST_ENEMY', 'TRIGGERING_ENEMY', 'CHOSEN_ENEMY']);

function stepsOf(card: NormalizedCard): AbilityStep[] {
  return (card.enrichment?.abilities ?? []).flatMap((a) => a.steps ?? []);
}

function stunsEnemy(card: NormalizedCard): boolean {
  return stepsOf(card).some((s) => {
    const params = getStepEffectParams(s);
    return (
      s.effect === 'ADD_STATUS' &&
      params.status === 'STUNNED' &&
      ENEMY_TARGETS.has(String(params.target))
    );
  });
}

function drawsCards(card: NormalizedCard): boolean {
  return stepsOf(card).some((s) => s.effect === 'DRAW');
}

/** True when another card in hand needs this one in play (its play requirement names this card). */
function isSetupFor(card: CardInstance, hand: readonly CardInstance[]): boolean {
  return hand.some((other) => {
    const filter = other.card.enrichment?.playRequirements?.controlFilter;
    return other !== card && filter !== undefined && matchesCardFilter(card, filter);
  });
}

/** What a play is worth now: the card value plus the bonuses of the opening plan. */
function playValue(
  state: GameState,
  player: PlayerState,
  card: CardInstance,
  ledger?: ScarcityLedger,
): number {
  let value = cardValue(card);
  const villainStunned = getActiveVillain(state).statusCards.includes(StatusCard.STUNNED);
  if (!villainStunned && stunsEnemy(card.card)) value += BOT_POLICY.stunBonus;
  if (drawsCards(card.card)) value += BOT_POLICY.drawBonus;
  const fillsTableau = card.card.type === CardType.UPGRADE || card.card.type === CardType.SUPPORT;
  if (player.tableau.length === 0 && fillsTableau) value += BOT_POLICY.emptyTableauBonus;
  if (ledger) {
    value += BOT_POLICY.untestedCardBonus * untestedWeight(ledger, card.card);
    // The payoff in hand cannot be played before its setup piece is in play
    if (isSetupFor(card, player.hand)) value += BOT_POLICY.setupBonus;
  }
  return value;
}

/** What a hand card is worth to keep: its play value, less what it is worth as a payment. */
function keepValue(
  card: CardInstance,
  played: NormalizedCard | undefined,
  ledger?: ScarcityLedger,
): number {
  const resources = getHandCardResourceValue(card, played);
  const base = Math.max(0, cardValue(card) - (resources - 1) * BOT_POLICY.extraResourceDiscount);
  // A card with abilities still to test is spent last, so it reaches the table
  return ledger
    ? base + BOT_POLICY.untestedKeepProtection * untestedWeight(ledger, card.card)
    : base;
}

/**
 * The cheapest payment for `card`: free generators first, then the subset of the other hand cards
 * that covers the rest and gives up the least value.
 */
function choosePayment(
  state: GameState,
  player: PlayerState,
  card: CardInstance,
  ledger?: ScarcityLedger,
): Payment | undefined {
  const { effectiveCost } = getEffectiveCardCost(state, player, card);
  return payResources(state, player, effectiveCost, card, ledger);
}

/** Pays `cost` resources (a card's cost or an ability's resource cost) at the least value given up. */
function payResources(
  state: GameState,
  player: PlayerState,
  cost: number,
  played: CardInstance | undefined,
  ledger?: ScarcityLedger,
): Payment | undefined {
  const generatorInstanceIds: string[] = [];
  let missing = cost;
  for (const id of [IDENTITY_GENERATOR, ...player.tableau.map((c) => c.instanceId)]) {
    if (missing <= 0) break;
    if (id === played?.instanceId) continue;
    const provided = getGeneratorProvidedResources(state, player, id);
    if (provided > 0) {
      generatorInstanceIds.push(id);
      missing -= provided;
    }
  }
  if (missing <= 0) return { paymentCardInstanceIds: [], generatorInstanceIds, price: 0 };

  const priceShare =
    player.tableau.length === 0 ? BOT_POLICY.emptyTableauPriceShare : BOT_POLICY.paymentPriceShare;
  const others = player.hand.filter((c) => c.instanceId !== played?.instanceId);
  if (others.length > MAX_PAYMENT_SEARCH_CARDS) return undefined;
  let best: { ids: string[]; price: number } | undefined;
  for (let mask = 1; mask < 1 << others.length; mask++) {
    const chosen = others.filter((_, i) => mask & (1 << i));
    const provided = chosen.reduce((sum, c) => sum + getHandCardResourceValue(c, played?.card), 0);
    if (provided < missing) continue;
    const price =
      priceShare * chosen.reduce((sum, c) => sum + keepValue(c, played?.card, ledger), 0) +
      (provided - missing) * BOT_POLICY.wastedResourceCost;
    if (!best || price < best.price) best = { ids: chosen.map((c) => c.instanceId), price };
  }
  return best && { paymentCardInstanceIds: best.ids, generatorInstanceIds, price: best.price };
}

interface AbilitySource {
  ref: string;
  card: NormalizedCard;
  exhausted?: boolean;
  instance?: CardInstance;
}

type AbilityPayment = Pick<
  UseCardAbilityAction,
  'paymentCardInstanceIds' | 'generatorInstanceIds' | 'discardCardInstanceIds'
>;

const isUntested = (ledger: ScarcityLedger | undefined, cardCode: string, ability: CardAbility) =>
  ledger !== undefined &&
  scarcityOf(ledger, abilityKey(cardCode, ability.id)) >= BOT_POLICY.untestedThreshold;

/**
 * What the bot pays for an action ability, or `undefined` when it will not use it. An ability that
 * costs at most its own exhaustion is always free to use. A paid ability (resources, a discard,
 * counters, damage, healing) is used only while it is still untested, and only with a ledger.
 */
function payAbilityCost(
  state: GameState,
  player: PlayerState,
  source: AbilitySource,
  ability: CardAbility,
  ledger?: ScarcityLedger,
): AbilityPayment | undefined {
  const cost = ability.cost;
  if (!cost || Object.keys(cost).every((key) => key === 'exhaustSelf')) return {};
  if (!isUntested(ledger, source.card.code, ability)) return undefined;

  const payment: AbilityPayment = {};
  let spentCardIds = new Set<string>();
  const resources = Object.values(cost.resourceCost ?? {}).reduce((sum, n) => sum + (n ?? 0), 0);
  if (resources > 0) {
    const pay = payResources(state, player, resources, source.instance, ledger);
    if (!pay) return undefined;
    payment.paymentCardInstanceIds = pay.paymentCardInstanceIds;
    if (pay.generatorInstanceIds.length > 0)
      payment.generatorInstanceIds = pay.generatorInstanceIds;
    spentCardIds = new Set(pay.paymentCardInstanceIds);
  }
  if (cost.discardCard) {
    const count = cost.discardCard.count || 1;
    const spare = player.hand
      .filter((c) => !spentCardIds.has(c.instanceId))
      .sort((a, b) => keepValue(a, undefined, ledger) - keepValue(b, undefined, ledger));
    if (spare.length < count) return undefined;
    payment.discardCardInstanceIds = spare.slice(0, count).map((c) => c.instanceId);
  }
  return payment;
}

const spentThisPeriod = (player: PlayerState, source: AbilitySource, ability: CardAbility) => {
  const key = source.instance ? `${source.instance.instanceId}_${ability.id}` : ability.id;
  return (
    (ability.limit === 'ONCE_PER_ROUND' && player.usedAbilitiesThisRound?.[key]) ||
    (ability.limit === 'ONCE_PER_PHASE' && player.usedAbilitiesThisPhase?.[key])
  );
};

/** A legal action ability the bot is willing to pay for, on the identity, the tableau or the encounter. */
function chooseAbility(
  state: GameState,
  player: PlayerState,
  wanted: (ability: CardAbility) => boolean,
  ledger?: ScarcityLedger,
): GameAction | undefined {
  const isHero = player.currentForm === 'hero';
  const sources: AbilitySource[] = [
    { ref: player.activeFormCard.code, card: player.activeFormCard, exhausted: false },
    ...player.tableau.map((c) => ({
      ref: c.instanceId,
      card: c.card,
      exhausted: c.exhausted,
      instance: c,
    })),
  ];
  const tryAbility = (source: AbilitySource, ability: CardAbility): GameAction | undefined => {
    const isAction =
      ability.timing === 'ACTION' ||
      (isHero ? ability.timing === 'HERO_ACTION' : ability.timing === 'ALTER_EGO_ACTION');
    if (!isAction || !wanted(ability) || spentThisPeriod(player, source, ability)) return undefined;
    const payment = payAbilityCost(state, player, source, ability, ledger);
    if (!payment) return undefined;
    if (!canInitiateAbility(state, player.id, ability, source.instance, payment).allowed) {
      return undefined;
    }
    return {
      type: 'USE_CARD_ABILITY',
      playerId: player.id,
      cardInstanceId: source.ref,
      abilityId: ability.id,
      ...payment,
    };
  };

  for (const source of sources) {
    if (source.exhausted) continue;
    for (const ability of source.card.enrichment?.abilities ?? []) {
      const action = tryAbility(source, ability);
      if (action) return action;
    }
  }
  if (!ledger) return undefined;

  // Encounter cards the player may act on (attachments, schemes, obligations), through the one
  // action discovery of the legal-actions generator
  for (const item of getLegalActionsForPlayer(state, player.id).villainActionItems) {
    const itemAction = item.action;
    if (itemAction.type !== 'USE_CARD_ABILITY') continue;
    const instance = item.targetCardInstance;
    const ability = instance?.card.enrichment?.abilities?.find(
      (a) => a.id === itemAction.abilityId,
    );
    if (!instance || !ability || instance.exhausted) continue;
    const action = tryAbility(
      { ref: instance.instanceId, card: instance.card, exhausted: instance.exhausted, instance },
      ability,
    );
    if (action) return action;
  }
  return undefined;
}

/** The most valuable legal play whose payment costs less than the card is worth. */
function choosePlay(
  state: GameState,
  player: PlayerState,
  ledger?: ScarcityLedger,
): GameAction | undefined {
  let best: { action: GameAction; net: number } | undefined;
  for (const card of player.hand) {
    if (!evaluateCardPlayability(state, player.id, card).isPlayable) continue;
    const payment = choosePayment(state, player, card, ledger);
    if (!payment) continue;
    const net = playValue(state, player, card, ledger) - payment.price;
    if (net <= 0 || (best && net <= best.net)) continue;
    if (
      !canPlayCard(
        state,
        player.id,
        card.instanceId,
        payment.paymentCardInstanceIds,
        payment.generatorInstanceIds,
      ).allowed
    ) {
      continue;
    }
    best = {
      net,
      action: {
        type: 'PLAY_CARD',
        playerId: player.id,
        cardInstanceId: card.instanceId,
        paymentCardInstanceIds: payment.paymentCardInstanceIds,
        ...(payment.generatorInstanceIds.length > 0 && {
          generatorInstanceIds: payment.generatorInstanceIds,
        }),
      },
    };
  }
  return best?.action;
}

/** Threat on the main scheme once the next villain phase has placed its threat. */
function projectedThreat(
  state: GameState,
  player: PlayerState,
  form: 'hero' | 'alter_ego',
): number {
  const villainScheme = getEffectiveVillainStats(state, getActiveVillain(state)).scheme;
  let projected = getActiveMainScheme(state).threat + getVillainPhaseThreatToAdd(state);
  for (const p of state.players) {
    // Enemies scheme against an Alter-Ego and attack a hero (RR v1.8 p. 31)
    if ((p.id === player.id ? form : p.currentForm) !== 'alter_ego') continue;
    projected += villainScheme + BOT_POLICY.threatSafetyMargin;
    for (const minion of p.engagedMinions) {
      projected += getEffectiveMinionScheme(state, minion);
    }
  }
  return projected;
}

function isMainSchemeUrgent(
  state: GameState,
  player: PlayerState,
  form: 'hero' | 'alter_ego',
): boolean {
  return projectedThreat(state, player, form) >= getActiveMainScheme(state).targetThreat;
}

function isThwartPreferred(state: GameState, player: PlayerState): boolean {
  const target = getActiveMainScheme(state).targetThreat;
  return projectedThreat(state, player, player.currentForm) >= target * BOT_POLICY.thwartPressure;
}

/** Damage the next villain phase deals to a hero: the villain and every engaged minion attack. */
function incomingAttack(state: GameState, player: PlayerState): number {
  const villain = getEffectiveVillainStats(state, getActiveVillain(state)).attack;
  return player.engagedMinions.reduce(
    (sum, m) => sum + getEffectiveMinionAttack(state, m),
    villain + BOT_POLICY.threatSafetyMargin,
  );
}

function flip(player: PlayerState, to: CardType.HERO | CardType.ALTER_EGO): GameAction | undefined {
  const form = player.availableForms.find((f) => f.type === to);
  return form && { type: 'CHANGE_FORM', playerId: player.id, targetFormCode: form.code };
}

/** The form most of the untested abilities in hand, in play and on the identity need to be used. */
function wantedForm(player: PlayerState, ledger: ScarcityLedger): 'hero' | 'alter_ego' | undefined {
  let hero = 0;
  let egoCount = 0;
  const cards = [...player.hand.map((c) => c.card), ...player.tableau.map((c) => c.card)];
  for (const card of [...cards, player.hero, player.alterEgo]) {
    for (const ability of card.enrichment?.abilities ?? []) {
      if (!isUntested(ledger, card.code, ability)) continue;
      const form = card.enrichment?.playRequirements?.identityForm;
      if (ability.timing.startsWith('HERO_') || form === 'HERO' || card === player.hero) hero++;
      if (
        ability.timing.startsWith('ALTER_EGO_') ||
        form === 'ALTER_EGO' ||
        card === player.alterEgo
      ) {
        egoCount++;
      }
    }
  }
  if (hero === egoCount) return undefined;
  return hero > egoCount ? 'hero' : 'alter_ego';
}

/** Form change: hero when the scheme is about to complete or health allows, Alter-Ego to recover. */
function chooseFormChange(
  state: GameState,
  player: PlayerState,
  ledger?: ScarcityLedger,
): GameAction | undefined {
  if (!canChangeForm(state, player.id).allowed) return undefined;
  const wanted = ledger && wantedForm(player, ledger);
  if (wanted && wanted !== player.currentForm) {
    const safe = wanted === 'hero' || !isMainSchemeUrgent(state, player, 'alter_ego');
    if (safe) return flip(player, wanted === 'hero' ? CardType.HERO : CardType.ALTER_EGO);
  }
  const half = Math.floor(player.maxHealth / 2);
  if (player.currentForm === 'alter_ego') {
    const worthFlipping =
      isMainSchemeUrgent(state, player, 'alter_ego') ||
      player.health >= Math.ceil(player.maxHealth * BOT_POLICY.healthyShare) ||
      (!player.exhausted && player.health > half);
    return worthFlipping ? flip(player, CardType.HERO) : undefined;
  }
  // One hero in Alter-Ego at a time, the most wounded first
  const needsRecovery = (p: PlayerState) =>
    p.currentForm === 'hero' && p.health <= Math.max(half, incomingAttack(state, p) - 1);
  const mostWounded = state.players
    .filter(needsRecovery)
    .reduce<PlayerState | undefined>(
      (low, p) => (!low || p.health < low.health ? p : low),
      undefined,
    );
  const othersInAlterEgo = state.players.some(
    (p) => p.id !== player.id && p.currentForm === 'alter_ego',
  );
  const inDanger = mostWounded?.id === player.id && !othersInAlterEgo;
  return inDanger && !isMainSchemeUrgent(state, player, 'alter_ego')
    ? flip(player, CardType.ALTER_EGO)
    : undefined;
}

function chooseHealing(player: PlayerState): GameAction | undefined {
  if (player.health >= player.maxHealth) return undefined;
  for (const card of player.tableau) {
    if (card.exhausted) continue;
    const ability = card.card.enrichment?.abilities?.find(
      (a) =>
        (a.timing === 'ALTER_EGO_ACTION' || a.timing === 'ACTION') &&
        a.steps?.some((s) => s.effect === 'HEAL_DAMAGE'),
    );
    if (ability) {
      return {
        type: 'USE_CARD_ABILITY',
        playerId: player.id,
        cardInstanceId: card.instanceId,
        abilityId: ability.id,
      };
    }
  }
  return undefined;
}

/** Engaged minions in attack order: Guard blocks the villain, then the most dangerous first. */
function rankedMinions(state: GameState, player: PlayerState): CardInstance[] {
  const danger = (m: CardInstance) =>
    getEffectiveMinionAttack(state, m) + getEffectiveMinionScheme(state, m);
  return [...player.engagedMinions].sort(
    (a, b) => Number(isGuardMinion(b)) - Number(isGuardMinion(a)) || danger(b) - danger(a),
  );
}

type Intent = 'thwart_main' | 'thwart_side' | 'attack_minion' | 'attack_villain';

/** What an exhausting character tries, in order: thwarting first under pressure, attacking first otherwise. */
function intentOrder(thwartFirst: boolean, urgent: boolean): Intent[] {
  if (!thwartFirst) return ['attack_minion', 'thwart_side', 'attack_villain', 'thwart_main'];
  // Side schemes before the main scheme, unless the main scheme is about to complete
  return urgent
    ? ['thwart_main', 'thwart_side', 'attack_minion', 'attack_villain']
    : ['thwart_side', 'thwart_main', 'attack_minion', 'attack_villain'];
}

/** The first legal action of a hero or an ally, by the order of `intentOrder`. */
function chooseCombatAction(
  state: GameState,
  player: PlayerState,
  actor: ActionActor,
  ally?: CardInstance,
): GameAction | undefined {
  const playerId = player.id;
  const thwart = (targetType: 'main_scheme' | 'side_scheme', targetInstanceId?: string) =>
    ally
      ? {
          type: 'ALLY_THWART' as const,
          playerId,
          allyInstanceId: ally.instanceId,
          targetType,
          targetInstanceId,
        }
      : { type: 'BASIC_THWART' as const, playerId, targetType, targetInstanceId };
  const attack = (targetType: 'villain' | 'minion', targetInstanceId?: string) =>
    ally
      ? {
          type: 'ALLY_ATTACK' as const,
          playerId,
          allyInstanceId: ally.instanceId,
          targetType,
          targetInstanceId,
        }
      : { type: 'BASIC_ATTACK' as const, playerId, targetType, targetInstanceId };
  const clean = (action: GameAction): GameAction =>
    JSON.parse(JSON.stringify(action)) as GameAction;

  const mainScheme = getActiveMainScheme(state);
  const thwartFirst =
    state.roundNumber <= BOT_POLICY.openingRounds || isThwartPreferred(state, player);
  const urgent = isMainSchemeUrgent(state, player, player.currentForm);
  for (const intent of intentOrder(thwartFirst, urgent)) {
    if (intent === 'thwart_main') {
      if (mainScheme.threat > 0 && canThwart(state, playerId, actor, 'main_scheme').allowed) {
        return clean(thwart('main_scheme'));
      }
    } else if (intent === 'thwart_side') {
      const sides = [...state.sideSchemes].sort((a, b) => b.threat - a.threat);
      for (const side of sides) {
        if (
          side.threat > 0 &&
          canThwart(state, playerId, actor, 'side_scheme', side.instanceId).allowed
        ) {
          return clean(thwart('side_scheme', side.instanceId));
        }
      }
    } else if (intent === 'attack_minion') {
      for (const minion of rankedMinions(state, player)) {
        if (canAttack(state, playerId, actor, 'minion', minion.instanceId).allowed) {
          return clean(attack('minion', minion.instanceId));
        }
      }
    } else if (canAttack(state, playerId, actor, 'villain').allowed) {
      return clean(attack('villain'));
    }
  }
  return undefined;
}

/**
 * Heuristic AI Bot that selects the best legal action during the Player Phase.
 */
export function chooseBotAction(context: BotDecisionContext): GameAction {
  const { state, playerId } = context;
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return { type: 'END_PLAYER_TURN', playerId };

  const ledger = context.scarcity;
  const draw = chooseAbility(
    state,
    player,
    (a) => !!a.steps?.some((s) => s.effect === 'DRAW'),
    ledger,
  );
  if (draw) return draw;

  const formChange = chooseFormChange(state, player, ledger);
  if (formChange) return formChange;

  const play = choosePlay(state, player, ledger);
  if (play) return play;

  const ability = chooseAbility(state, player, () => true, ledger);
  if (ability) return ability;

  const urgent = isMainSchemeUrgent(state, player, player.currentForm);
  if (player.currentForm === 'alter_ego' && !urgent) {
    const heal = chooseHealing(player);
    if (heal) return heal;
  }

  for (const ally of player.allies) {
    if (ally.exhausted) continue;
    const action = chooseCombatAction(
      state,
      player,
      { kind: 'ally', instanceId: ally.instanceId },
      ally,
    );
    if (action) return action;
  }

  if (player.currentForm === 'hero' && !player.exhausted) {
    const action = chooseCombatAction(state, player, HERO_ACTOR);
    if (action) return action;
  }

  if (
    player.currentForm === 'alter_ego' &&
    !player.exhausted &&
    player.health < player.maxHealth &&
    canBasicRecover(state, playerId).allowed
  ) {
    return { type: 'BASIC_RECOVER', playerId };
  }

  // End turn only once all available activations/exhaustions are exhausted
  return { type: 'END_PLAYER_TURN', playerId };
}

/**
 * The defender option for an enemy attack. Defending exhausts the defender, and a hero that is
 * exhausted loses its next turn (RR v1.8 End of Player Phase), so the bot only defends when the
 * hit could take it to `defendHealthFloor`: the hero first, then a ready ally.
 */
export function chooseDefenderOption(
  state: GameState,
  prompt: Pick<PendingDecisionPrompt, 'playerId' | 'options'>,
  ledger?: ScarcityLedger,
): string | undefined {
  const ids = prompt.options.filter((o) => !o.disabled).map((o) => o.id);
  if (!ids.includes('undefended')) return undefined;
  const target = state.players.find((p) => p.id === prompt.playerId);
  const attack = state.activeAttackContext?.baseAttack;
  if (!target || attack === undefined) return undefined;

  // Every enemy engaged with the target attacks this phase, and a defender stays exhausted
  const expectedDamage = Math.max(
    attack + BOT_POLICY.boostAllowance,
    incomingAttack(state, target),
  );
  if (target.health - expectedDamage > BOT_POLICY.defendHealthFloor) return 'undefended';
  // A healthy hero cannot use an untested heal ability: a hit it survives enables it
  if (
    ledger &&
    target.health >= target.maxHealth &&
    target.health - expectedDamage >= BOT_POLICY.safeHitHealthFloor &&
    holdsUntestedHeal(target, ledger)
  ) {
    return 'undefended';
  }
  // An ally that survives the hit blocks first: the hero keeps its next turn
  const survivor = ids.find((id) => {
    const ally = allyOfOption(state, id);
    return ally && allyHitPoints(ally) > attack + BOT_POLICY.boostAllowance;
  });
  return (
    survivor ??
    ids.find((id) => id === 'defend_hero') ??
    ids.find((id) => id.startsWith('defend_ally_')) ??
    'undefended'
  );
}

/** Whether an untested ability in hand, in play or on the identity needs missing health. */
function holdsUntestedHeal(player: PlayerState, ledger: ScarcityLedger): boolean {
  const cards = [...player.hand.map((c) => c.card), ...player.tableau.map((c) => c.card)];
  return [...cards, player.activeFormCard].some((card) =>
    (card.enrichment?.abilities ?? []).some(
      (ability) =>
        isUntested(ledger, card.code, ability) &&
        (Boolean(ability.cost?.heal) || ability.steps.some((s) => s.effect === 'HEAL_DAMAGE')),
    ),
  );
}

function allyOfOption(state: GameState, optionId: string): CardInstance | undefined {
  if (!optionId.startsWith('defend_ally_')) return undefined;
  const instanceId = optionId.slice('defend_ally_'.length);
  return state.players.flatMap((p) => p.allies).find((a) => a.instanceId === instanceId);
}

function allyHitPoints(ally: CardInstance): number {
  const health = (ally.card as AllyCard).health ?? 2;
  return health - (ally.tokens?.damage ?? 0);
}
