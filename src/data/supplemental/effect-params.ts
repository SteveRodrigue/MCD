import { z } from 'zod';
import {
  AspectSchema,
  CardLocationSelectorSchema,
  CharacterStatusSchema,
  DecisionPromptOptionSchema,
  DiscardParamsSchema,
  DrawCardsParamsSchema,
  DurationSchema,
  DynamicValueSourceSchema,
  GenerateResourceParamsSchema,
  KeywordSchema,
  PlayCardFromZoneParamsSchema,
  ReduceNextCardCostParamsSchema,
  ResourceTypeSchema,
  SearchAndSelectParamsSchema,
  TargetSelectorSchema,
  UniversalCardFilterSchema,
  type EffectType,
} from './schema-primitives.ts';
import type { FieldMeta } from './schema-introspector.ts';

/**
 * Allowed `effectParams` per effect primitive (Issue #230, Card Editor re-architecture Phase 2).
 *
 * `EFFECT_PARAM_SCHEMAS` is the single source of truth: a strict object per effect whose keys are
 * the parameters the engine reads, whose value types match what the engine accepts, and whose
 * `.meta()` annotations (label, description, placeholder, primary, widget, options) feed the
 * Card Editor through `schema-introspector.ts`. `AbilityStepSchema` validates every step's
 * `effectParams` against it. Every parameter is optional: the engine falls back to a default.
 */

/** A number, or a dynamic value source the engine resolves from the game state. */
const AMOUNT = z.union([z.number(), DynamicValueSourceSchema]);
/** Like AMOUNT, plus the literal `ALL`. */
const AMOUNT_ALL = z.union([z.number(), z.literal('ALL'), DynamicValueSourceSchema]);

const annotated = <T extends z.ZodType>(schema: T, meta: FieldMeta) => schema.meta(meta);
const optional = <T extends z.ZodType>(schema: T, meta: FieldMeta) =>
  schema.meta(meta).optional();

const target = (label: string, defaultValue?: string, description?: string) =>
  optional(TargetSelectorSchema, { label, defaultValue, description, primary: true });

const BONUS_DESCRIPTION = 'Dynamic bonus calculated from game state or discarded cards';
const effectOnly = () => z.object({}).strict();

export const EFFECT_PARAM_SCHEMAS = {
  ADD_ACCELERATION: z
    .object({
      amount: optional(AMOUNT, { label: 'Acceleration Tokens', defaultValue: 1, primary: true }),
    })
    .strict(),
  ADD_COUNTERS: z
    .object({
      counterType: optional(z.string(), {
        label: 'Counter Type',
        placeholder: 'e.g. all-purpose, charge',
        defaultValue: 'all-purpose',
        primary: true,
      }),
      amount: optional(AMOUNT, { label: 'Counter Amount', defaultValue: 1, primary: true }),
      target: target('Target', 'SELF'),
    })
    .strict(),
  ADD_STATUS: z
    .object({
      status: optional(CharacterStatusSchema, {
        label: 'Status Card',
        defaultValue: 'STUNNED',
        primary: true,
      }),
      target: target('Target', 'CHOSEN_ENEMY'),
    })
    .strict(),
  ADD_THREAT: z
    .object({
      amount: optional(AMOUNT, {
        label: 'Threat Amount',
        defaultValue: 1,
        placeholder: '1',
        primary: true,
      }),
      perPlayer: optional(z.boolean(), { label: 'Scale Per Player', defaultValue: false }),
      target: target('Target Scheme', 'MAIN_SCHEME'),
      cardCode: optional(z.string(), { label: 'Card Code' }),
    })
    .strict(),
  ADD_TRAIT: z
    .object({
      trait: optional(z.string(), {
        label: 'Trait Name',
        placeholder: 'e.g. Aerial, Avenger',
        primary: true,
      }),
      target: target('Target', 'SELF_IDENTITY'),
      duration: optional(DurationSchema, {
        label: 'Duration (empty = while the source card is in play)',
      }),
    })
    .strict(),
  ATTACHMENT_DAMAGE_SHIELD: z
    .object({
      maxAbsorb: optional(z.number(), {
        label: 'Max Damage Absorbed',
        placeholder: 'e.g. 4',
        primary: true,
      }),
    })
    .strict(),
  ATTACH_FACEDOWN_CARDS_FROM_HAND: effectOnly(),
  ATTACH_TO_HOST: z
    .object({
      target: target('Host Target', 'VILLAIN'),
      maxPerHost: optional(z.number(), { label: 'Max Per Host', placeholder: 'e.g. 1' }),
    })
    .strict(),
  CANCEL_ATTACK: effectOnly(),
  CANCEL_WHEN_REVEALED: effectOnly(),
  CANCEL_WHEN_REVEALED_AND_REVEAL_ANOTHER: effectOnly(),
  CANNOT_TAKE_DAMAGE: z
    .object({
      target: optional(z.enum(['SELF']), { label: 'Target', defaultValue: 'SELF' }),
      sourceCardType: optional(z.enum(['UPGRADE', 'ALLY', 'EVENT', 'SUPPORT', 'RESOURCE']), {
        label: 'Source Card Type',
        description: 'Only damage from a card of this type is ignored (empty: any source)',
        primary: true,
      }),
      sourceTrait: optional(z.string(), {
        label: 'Source Trait',
        description: 'Only damage from a card with this trait is ignored (empty: any source)',
        primary: true,
      }),
    })
    .strict(),
  CHANGE_FORM: z
    .object({
      form: optional(z.string(), { label: 'Form', primary: true }),
      optional: optional(z.boolean(), { label: 'Optional' }),
    })
    .strict(),
  DEAL_DAMAGE: z
    .object({
      amount: optional(AMOUNT, {
        label: 'Damage Amount',
        placeholder: 'e.g. 3',
        description: 'Fixed damage value',
        primary: true,
      }),
      target: target('Target', 'CHOSEN_ENEMY'),
      targetPlayer: optional(z.enum(['SELF', 'CHOSEN_PLAYER']), {
        label: 'Target Player',
        description:
          "Which player's engaged enemies are hit when Target is Engaged Enemies (prompts in multiplayer)",
      }),
      finisherBonus: optional(z.number(), {
        label: 'Finisher Bonus Damage',
        placeholder: 'e.g. 2',
      }),
      dynamicBonus: optional(AMOUNT, {
        label: 'Dynamic Bonus Damage',
        description: BONUS_DESCRIPTION,
      }),
    })
    .strict(),
  DEAL_FACEDOWN_ENCOUNTER_CARD: z
    .object({
      target: optional(
        z.enum(['ENGAGED_PLAYER', 'ACTIVE_PLAYER', 'FIRST_PLAYER', 'ALL_PLAYERS']),
        { label: 'Target', defaultValue: 'ENGAGED_PLAYER' },
      ),
      count: optional(AMOUNT, {
        label: 'Encounter Card Count',
        placeholder: '1',
        description: 'Number of facedown encounter cards to deal',
        primary: true,
      }),
    })
    .strict(),
  DECLARE_DEFENDER: effectOnly(),
  DISCARD: z
    .object({
      source: annotated(DiscardParamsSchema.shape.source, {
        label: 'Source Zone',
        description: 'Source zone cards are discarded from (RR v1.8 p. 10)',
        primary: true,
      }),
      count: annotated(DiscardParamsSchema.shape.count, {
        label: 'Card Count',
        placeholder: '1',
        primary: true,
      }),
      mode: annotated(DiscardParamsSchema.shape.mode, {
        label: 'Discard Mode',
        defaultValue: 'CHOSEN',
      }),
      target: target('Target Player / Entity', 'SELF'),
      filter: optional(UniversalCardFilterSchema, {
        label: 'Card Filter',
        widget: 'card-filter',
        description: 'Universal card filter for eligible cards to discard',
      }),
      untilFilter: optional(UniversalCardFilterSchema, {
        label: 'Until Match Filter',
        widget: 'card-filter',
        description: 'Filter defining termination condition for UNTIL_MATCH discard mode',
      }),
      fallback: annotated(DiscardParamsSchema.shape.fallback, {
        label: 'Fallback Action',
        defaultValue: 'NONE',
        description: 'Action if no cards could be discarded (e.g. Surge)',
      }),
      matchingDestination: annotated(DiscardParamsSchema.shape.matchingDestination, {
        label: 'Matching Destination',
        defaultValue: 'DISCARD',
        description:
          'Destination for discarded cards matching filter (e.g. HAND for Black Cat, REVEAL for the card found by an encounter deck UNTIL_MATCH)',
      }),
    })
    .strict(),
  DISTRIBUTE_AMOUNT: z
    .object({
      budget: optional(AMOUNT, {
        label: 'Budget Amount',
        defaultValue: 1,
        placeholder: 'e.g. 4',
        description: 'Total points to allocate across targets',
        primary: true,
      }),
      allocationDomain: optional(
        z.enum(['DAMAGE', 'THREAT_REMOVAL', 'HEAL', 'COUNTERS', 'EXHAUST']),
        {
          label: 'Allocation Domain',
          defaultValue: 'DAMAGE',
          description: 'Domain of effect being distributed',
          primary: true,
        },
      ),
      targetScope: optional(TargetSelectorSchema, {
        label: 'Target Scope',
        defaultValue: 'ALL_HEROES_AND_ALLIES',
        description: 'Set of targets eligible for point allocation',
        primary: true,
      }),
    })
    .strict(),
  DOUBLE_RESOURCE_FOR_ASPECT: z
    .object({
      aspect: optional(AspectSchema, {
        label: 'Aspect',
        placeholder: 'e.g. aggression, leadership',
        primary: true,
      }),
    })
    .strict(),
  DRAW: z
    .object({
      count: optional(DrawCardsParamsSchema.shape.count.unwrap(), {
        label: 'Card Count',
        defaultValue: 1,
        primary: true,
      }),
      limit: annotated(DrawCardsParamsSchema.shape.limit, { label: 'Hand Size Limit' }),
      target: optional(TargetSelectorSchema, { label: 'Target Player', primary: true }),
      targetPlayerId: optional(z.string(), {
        label: 'Target Player ID',
        placeholder: 'e.g. player_1',
        description: 'Specific player ID to draw cards',
      }),
      dynamicBonus: optional(AMOUNT, {
        label: 'Dynamic Bonus Cards',
        description: 'Dynamic bonus card draw calculated from identity, traits, or game state',
      }),
    })
    .strict(),
  ENEMY_ATTACKS: z
    .object({
      enemy: optional(z.string(), {
        label: 'Enemy Card Code',
        placeholder: 'e.g. 01162',
        primary: true,
      }),
      filter: optional(UniversalCardFilterSchema, {
        label: 'Enemy Filter',
        description: 'Filter for enemies that initiate attacks (e.g. trait or minion type)',
        widget: 'card-filter',
      }),
      target: optional(z.enum(['SELF_HERO', 'SELF_IDENTITY', 'ALL_OTHER_HEROES', 'ENGAGED_HERO']), {
        label: 'Attacked Character',
        defaultValue: 'SELF_HERO',
      }),
    })
    .strict(),
  EXECUTE_SPECIAL: z
    .object({
      specialId: optional(z.string(), {
        label: 'Special Handler Id',
        placeholder: 'e.g. WAKANDA_FOREVER',
        primary: true,
      }),
      sequenceOrder: optional(z.array(z.string()), {
        label: 'Sequence Order (instance ids)',
        widget: 'string-list',
      }),
    })
    .strict(),
  EXHAUST: z
    .object({
      target: optional(TargetSelectorSchema, {
        label: 'Target Selector',
        defaultValue: 'SELF_IDENTITY',
        description: 'The entity to exhaust (SELF_IDENTITY, SELF, CHOSEN_ALLY, VILLAIN, etc.).',
        primary: true,
      }),
      filter: optional(UniversalCardFilterSchema, {
        label: 'Target Filter (Optional)',
        widget: 'card-filter',
        description: 'Universal card filter applied to eligible targets.',
      }),
    })
    .strict(),
  FLIP_FORM: effectOnly(),
  GENERATE_RESOURCE: z
    .object({
      resource: optional(ResourceTypeSchema, {
        label: 'Resource Type (Static)',
        defaultValue: 'wild',
        primary: true,
      }),
      amount: optional(GenerateResourceParamsSchema.shape.amount.unwrap(), {
        label: 'Resource Amount (Static)',
        defaultValue: 1,
        placeholder: '1',
        primary: true,
      }),
      count: optional(z.number(), {
        label: 'Resource Count',
        placeholder: '1',
        description: 'Number of resources to generate',
      }),
      fromCard: optional(CardLocationSelectorSchema, {
        label: 'Resource Source Card',
        widget: 'card-location',
        description: 'Card selector whose resources are generated',
      }),
    })
    .strict(),
  GIVE_ADDITIONAL_BOOST_CARD: effectOnly(),
  GRANT_ATTACK_KEYWORD: z
    .object({
      keyword: optional(z.string().min(1), {
        label: 'Keyword',
        options: KeywordSchema.options,
        defaultValue: 'Overkill',
        primary: true,
      }),
    })
    .strict(),
  GRANT_KEYWORD: z
    .object({
      keyword: optional(z.string().min(1), {
        label: 'Keyword',
        options: KeywordSchema.options,
        defaultValue: 'Retaliate',
        primary: true,
      }),
      amount: optional(z.number(), {
        label: 'Amount (e.g. for Retaliate X or Incite X)',
        placeholder: '1',
        primary: true,
      }),
      duration: optional(DurationSchema, { label: 'Duration' }),
      target: target('Target', 'SELF'),
    })
    .strict(),
  HEAL_DAMAGE: z
    .object({
      amount: optional(AMOUNT_ALL, {
        label: 'Heal Amount',
        defaultValue: 1,
        placeholder: '1',
        primary: true,
      }),
      target: target('Target Character', 'SELF'),
    })
    .strict(),
  MODIFY_ALLY_LIMIT: z
    .object({
      amount: optional(z.number(), { label: 'Ally Limit Delta', defaultValue: 1, primary: true }),
      target: target('Target Player', 'SELF'),
    })
    .strict(),
  MODIFY_HAND_SIZE: z
    .object({
      amount: optional(AMOUNT, { label: 'Hand Size Delta', placeholder: '1', primary: true }),
    })
    .strict(),
  MODIFY_MAX_HEALTH: z
    .object({
      amount: optional(z.number(), {
        label: 'Max Health Delta',
        placeholder: 'e.g. 1 or 2',
        primary: true,
      }),
      target: target('Target', 'SELF'),
    })
    .strict(),
  MODIFY_STAT: z
    .object({
      stat: optional(z.enum(['ATTACK', 'THWART', 'DEFENSE', 'RECOVERY', 'SCHEME']), {
        label: 'Stat',
        defaultValue: 'ATTACK',
        primary: true,
      }),
      amount: optional(AMOUNT, {
        label: 'Modifier Amount (+/-)',
        defaultValue: 1,
        placeholder: 'e.g. 1 or -1',
        primary: true,
      }),
      duration: optional(DurationSchema, { label: 'Duration', defaultValue: 'PHASE' }),
      target: target('Target', 'SELF'),
      targetPlayer: optional(z.enum(['SELF', 'CHOSEN_PLAYER']), {
        label: 'Target Player',
        description:
          'With Target All Controlled Characters: whose characters get the bonus (prompts in multiplayer)',
      }),
      atkBonus: optional(z.number(), {
        label: 'ATK Bonus',
        placeholder: 'e.g. 1',
        description: 'Shorthand: ATK bonus for every character of the target player',
      }),
      thwBonus: optional(z.number(), {
        label: 'THW Bonus',
        placeholder: 'e.g. 1',
        description: 'Shorthand: THW bonus for every character of the target player',
      }),
    })
    .strict(),
  MODIFY_RESTRICTED_LIMIT: z
    .object({
      amount: optional(z.number(), {
        label: 'Bonus Restricted Slots',
        defaultValue: 1,
        primary: true,
      }),
    })
    .strict(),
  PLACE_CARD_UNDER_HOST: effectOnly(),
  PLAYER_CHOICE: z
    .object({
      title: optional(z.string(), {
        label: 'Prompt Title',
        placeholder: 'e.g. Choose an Option',
        primary: true,
      }),
      description: optional(z.string(), {
        label: 'Prompt Description',
        placeholder: 'e.g. Choose one of the following:',
      }),
      options: optional(z.array(DecisionPromptOptionSchema), {
        label: 'Choice Options',
        primary: true,
      }),
      isVoluntary: optional(z.boolean(), { label: 'Voluntary Choice', defaultValue: false }),
    })
    .strict(),
  PLAY_FROM_ZONE: z
    .object({
      source: annotated(PlayCardFromZoneParamsSchema.shape.source, {
        label: 'Source Zone',
        primary: true,
      }),
      costMode: annotated(PlayCardFromZoneParamsSchema.shape.costMode, {
        label: 'Cost Mode',
        primary: true,
      }),
      costReduction: annotated(PlayCardFromZoneParamsSchema.shape.costReduction, {
        label: 'Cost Reduction',
        defaultValue: 0,
      }),
      destination: annotated(PlayCardFromZoneParamsSchema.shape.destination, {
        label: 'Destination',
      }),
      control: annotated(PlayCardFromZoneParamsSchema.shape.control, { label: 'Control' }),
      filter: optional(UniversalCardFilterSchema, {
        label: 'Card Filter',
        widget: 'card-filter',
        description: 'Universal card filter for eligible cards to play',
      }),
      promptTitle: optional(z.string(), {
        label: 'Prompt Title',
        placeholder: 'e.g. Choose a card to play',
        description: 'Title displayed in the player selection prompt',
      }),
    })
    .strict(),
  PREVENT_DAMAGE: z
    .object({
      amount: optional(AMOUNT_ALL, {
        label: 'Damage Prevented',
        placeholder: 'e.g. 3 or blank for all',
        primary: true,
      }),
    })
    .strict(),
  PREVENT_THREAT: z
    .object({
      amount: optional(AMOUNT_ALL, {
        label: 'Threat Prevented',
        placeholder: 'e.g. 1 or blank for all',
        primary: true,
      }),
      target: target('Target Scheme', 'MAIN_SCHEME'),
    })
    .strict(),
  PUT_INTO_PLAY: z
    .object({
      from: optional(z.enum(['SET_ASIDE', 'DISCARD', 'HAND', 'DECK']), {
        label: 'Source Zone',
        defaultValue: 'SET_ASIDE',
        primary: true,
      }),
      to: optional(z.enum(['TABLEAU', 'ENGAGED_WITH_PLAYER', 'SIDE_SCHEMES']), {
        label: 'Destination Zone',
        defaultValue: 'TABLEAU',
        primary: true,
      }),
      target: optional(z.enum(['SELF']), {
        label: 'Target',
        description:
          'SELF puts the source card itself into play (e.g. a boost card). Empty selects cards by filter.',
      }),
      filter: optional(UniversalCardFilterSchema, {
        label: 'Target Card Filter',
        widget: 'card-filter',
        description: 'Universal card filter to match eligible card to put into play',
      }),
      reveal: optional(z.boolean(), {
        label: 'Reveal',
        defaultValue: false,
        description:
          'Reveal the card as it enters play: its When Revealed abilities and Surge resolve (RR v1.8 glossary R, W)',
      }),
    })
    .strict(),
  READY: z
    .object({
      target: optional(TargetSelectorSchema, {
        label: 'Target Selector',
        defaultValue: 'SELF_IDENTITY',
        description: 'The entity to ready (SELF_IDENTITY, SELF, CHOSEN_ALLY, etc.).',
        primary: true,
      }),
      filter: optional(UniversalCardFilterSchema, {
        label: 'Target Filter (Optional)',
        widget: 'card-filter',
        description: 'Universal card filter applied to eligible targets.',
      }),
    })
    .strict(),
  REDUCE_NEXT_CARD_COST: z
    .object({
      amount: optional(z.number().int().positive(), {
        label: 'Cost Reduction Amount',
        defaultValue: 1,
        primary: true,
      }),
      duration: optional(DurationSchema, { label: 'Duration', defaultValue: 'PHASE' }),
      target: target('Target Player', 'SELF'),
      cardFilter: annotated(ReduceNextCardCostParamsSchema.shape.cardFilter, {
        label: 'Eligible Card Filter',
        widget: 'card-filter',
        description: 'Universal card filter for eligible cards (e.g. aspect, card type, trait)',
      }),
    })
    .strict(),
  REMOVE_COUNTERS: z
    .object({
      counterType: optional(z.string(), {
        label: 'Counter Type',
        placeholder: 'e.g. all-purpose, charge',
        primary: true,
      }),
      amount: optional(AMOUNT_ALL, {
        label: 'Amount Removed',
        defaultValue: 1,
        primary: true,
      }),
      target: target('Target', 'SELF'),
    })
    .strict(),
  REMOVE_COUNTERS_MATCHING_FILTER: z
    .object({
      counterType: optional(z.string(), {
        label: 'Counter Type',
        placeholder: 'e.g. all-purpose',
        primary: true,
      }),
      traitFilter: optional(z.string(), {
        label: 'Trait Filter',
        placeholder: 'e.g. Gamma',
        primary: true,
      }),
      targetZone: optional(z.enum(['IN_PLAY', 'PLAYER_DISCARD', 'ENCOUNTER_DECK']), {
        label: 'Target Zone',
        defaultValue: 'IN_PLAY',
        description: 'Zone in which to match cards for counter removal',
      }),
      amount: optional(AMOUNT_ALL, {
        label: 'Amount to Remove',
        defaultValue: 1,
        placeholder: '1',
        description: 'Number of counters to remove, ALL, or dynamic formula',
        primary: true,
      }),
    })
    .strict(),
  REMOVE_FROM_GAME: z
    .object({
      target: optional(z.string(), {
        label: 'Target',
        description: 'Pseudo-primitive key kept for existing card data (#231 / #232)',
      }),
    })
    .strict(),
  REMOVE_STATUS: z
    .object({
      status: optional(z.enum(['STUNNED', 'CONFUSED', 'TOUGH', 'ALL']), {
        label: 'Status',
        primary: true,
      }),
      target: optional(TargetSelectorSchema, { label: 'Target', primary: true }),
    })
    .strict(),
  REMOVE_THREAT: z
    .object({
      amount: optional(AMOUNT, {
        label: 'Threat Amount',
        defaultValue: 1,
        placeholder: '1',
        primary: true,
      }),
      target: target('Target Scheme', 'MAIN_SCHEME'),
      ignoresCrisis: optional(z.boolean(), {
        label: 'Ignores Crisis',
        description: 'This card may remove threat from the main scheme while Crisis is in play',
      }),
      finisherBonus: optional(z.number(), {
        label: 'Finisher Bonus Threat',
        placeholder: 'e.g. 1',
      }),
      dynamicBonus: optional(AMOUNT, {
        label: 'Dynamic Bonus Threat',
        description: BONUS_DESCRIPTION,
      }),
      distinctFrom: optional(z.literal('PREVIOUS_TARGET'), {
        label: 'Distinct From',
        description: 'Use PREVIOUS_TARGET to pick a different scheme than the prior step',
      }),
    })
    .strict(),
  RETURN_TO_HAND: effectOnly(),
  REVEAL_ENCOUNTER_CARD: effectOnly(),
  SEARCH: z
    .object({
      source: annotated(SearchAndSelectParamsSchema.shape.source, {
        label: 'Source Zone',
        widget: 'multi-enum',
        primary: true,
      }),
      target: annotated(SearchAndSelectParamsSchema.shape.target, {
        label: 'Target Selector',
        description:
          'Target player whose zones are searched (e.g. CHOSEN_PLAYER for cross-player abilities)',
      }),
      fromTop: annotated(SearchAndSelectParamsSchema.shape.fromTop, {
        label: 'From Top of Discard',
        description: 'Evaluate discard pile from top to bottom (retrieves topmost matching card)',
      }),
      lookCount: annotated(SearchAndSelectParamsSchema.shape.lookCount, {
        label: 'Look Count',
        placeholder: 'e.g. 5',
        description:
          'Number of cards to look at (0 or ALL = search entire pile, 1+ = top X cards)',
      }),
      takeCount: annotated(SearchAndSelectParamsSchema.shape.takeCount, {
        label: 'Take Count',
        description:
          'Number of matching cards to take (0 or ALL = take all matching cards, 1+ = take up to X cards)',
        primary: true,
      }),
      filter: optional(UniversalCardFilterSchema, {
        label: 'Card Filter',
        widget: 'card-filter',
        description: 'Universal card filter for eligible cards',
        primary: true,
      }),
      selectedDestination: annotated(SearchAndSelectParamsSchema.shape.selectedDestination, {
        label: 'Selected Destination',
        primary: true,
      }),
      unselectedDestination: annotated(SearchAndSelectParamsSchema.shape.unselectedDestination, {
        label: 'Unselected Destination',
      }),
      autoSelectIfUnambiguous: annotated(
        SearchAndSelectParamsSchema.shape.autoSelectIfUnambiguous,
        {
          label: 'Auto-select Unambiguous Results',
          description:
            'Automatically resolve without a decision prompt when the number of candidates is <= Minimum Cards to Take (nothing left to choose)',
        },
      ),
      shuffleAfter: annotated(SearchAndSelectParamsSchema.shape.shuffleAfter, {
        label: 'Shuffle Deck After Search',
        defaultValue: false,
        description: 'Shuffle the searched deck after completing the search',
      }),
      minimumTake: annotated(SearchAndSelectParamsSchema.shape.minimumTake, {
        label: 'Minimum Cards to Take',
        description:
          'Fewest cards the player must take (0 = "up to" Take Count). With fewer candidates than this, all are taken.',
      }),
      distinctBy: annotated(SearchAndSelectParamsSchema.shape.distinctBy, {
        label: 'Distinct By',
        description: 'NAME: no two chosen cards may share a card name',
      }),
      promptTitle: annotated(SearchAndSelectParamsSchema.shape.promptTitle, {
        label: 'Search Prompt Title',
        placeholder: 'e.g. Search your deck for...',
        description: 'Title displayed in the search selection prompt',
      }),
    })
    .strict(),
  SHUFFLE_INTO_DECK: z
    .object({
      from: optional(z.enum(['SET_ASIDE', 'DISCARD', 'HAND']), {
        label: 'Source Zone',
        defaultValue: 'SET_ASIDE',
        primary: true,
      }),
      toDeck: optional(z.enum(['ENCOUNTER_DECK', 'PLAYER_DECK']), {
        label: 'Destination Deck',
        defaultValue: 'ENCOUNTER_DECK',
        primary: true,
      }),
      count: optional(z.number(), { label: 'Card Count', placeholder: 'e.g. 3' }),
      filter: optional(UniversalCardFilterSchema, { label: 'Card Filter', widget: 'card-filter' }),
    })
    .strict(),
  SPEND_COUNTERS: z
    .object({
      counterType: optional(z.string(), {
        label: 'Counter Type',
        placeholder: 'e.g. all-purpose',
        primary: true,
      }),
      amount: optional(AMOUNT, { label: 'Amount Spent', defaultValue: 1, primary: true }),
      target: target('Target', 'SELF'),
    })
    .strict(),
  SURGE: effectOnly(),
  TRANSFER_DAMAGE: z
    .object({
      amount: optional(AMOUNT, { label: 'Amount', defaultValue: 1, primary: true }),
      finisherBonus: optional(z.number(), {
        label: 'Finisher Bonus Damage',
        placeholder: 'e.g. 1',
      }),
      dynamicBonus: optional(AMOUNT, {
        label: 'Dynamic Bonus Damage',
        description: BONUS_DESCRIPTION,
      }),
    })
    .strict(),
  VILLAIN_AND_ENGAGED_MINIONS_ATTACK: effectOnly(),
  VILLAIN_ATTACKS: effectOnly(),
  VILLAIN_SCHEMES: z
    .object({
      target: target('Target Player', 'SELF'),
    })
    .strict(),
  RESTRICT_DEFENSE: z
    .object({
      requirement: optional(z.enum(['REQUIRE_ALLY_IF_ABLE', 'CANNOT_DEFEND']), {
        label: 'Defense Requirement',
        defaultValue: 'REQUIRE_ALLY_IF_ABLE',
        description: 'Defense restriction enforced during attacks by or against this card.',
        primary: true,
      }),
    })
    .strict(),
} satisfies Record<EffectType, z.ZodObject<any>>;

/** Static parameter contract per effect, derived from `EFFECT_PARAM_SCHEMAS` (Issue #127, R5). */
export type EffectParamsMap = {
  [E in EffectType]: z.infer<(typeof EFFECT_PARAM_SCHEMAS)[E]>;
};

/** Allowed `effectParams` keys per effect, derived from `EFFECT_PARAM_SCHEMAS`. */
export const EFFECT_PARAM_KEYS: Record<EffectType, readonly string[]> = Object.fromEntries(
  Object.entries(EFFECT_PARAM_SCHEMAS).map(([effect, schema]) => [
    effect,
    Object.keys(schema.shape),
  ]),
) as unknown as Record<EffectType, readonly string[]>;

/** One-line help text per effect primitive, shown next to the effect selector in the Card Editor. */
export const EFFECT_DESCRIPTIONS: Record<EffectType, string> = {
  DEAL_DAMAGE: "Deal damage to a target character or enemy.",
  DEAL_FACEDOWN_ENCOUNTER_CARD: "Deal facedown encounter cards to target player(s) (RR v1.8 p. 8).",
  DISTRIBUTE_AMOUNT: "Distribute a pool of damage, threat removal, heal, or counters across multiple eligible targets (ADR-0064).",
  PREVENT_DAMAGE: "Prevent incoming attack or effect damage to a character.",
  HEAL_DAMAGE: "Heal damage from target identity, ally, or friendly character.",
  TRANSFER_DAMAGE: "Move damage from one character to another.",
  REMOVE_THREAT: "Remove threat counters from target scheme.",
  ADD_THREAT: "Place threat counters on target scheme.",
  PREVENT_THREAT: "Prevent or reduce impending threat that would be placed on a scheme.",
  ADD_STATUS: "Apply status card (Stunned, Confused, Tough) to target.",
  GENERATE_RESOURCE: "Generate resources statically or dynamically from a card (e.g. top card of discard pile).",
  DOUBLE_RESOURCE_FOR_ASPECT: "Double resource generation when paying for a matching aspect card.",
  ADD_ACCELERATION: "Place acceleration tokens on the main scheme (+1 threat per token each villain phase).",
  ADD_COUNTERS: "Add multiple counter tokens to target card.",
  REMOVE_COUNTERS: "Remove multiple counters from target card.",
  REMOVE_COUNTERS_MATCHING_FILTER: "Remove counters across cards matching a trait or zone filter.",
  SPEND_COUNTERS: "Spend counter tokens to pay cost or resolve effect.",
  MODIFY_STAT: "Modify dynamic ATTACK, THWART, DEFENSE, or RECOVERY stat on target character.",
  ADD_TRAIT: "Grant a trait (e.g. Aerial, Avenger, Gamma) to target character.",
  GRANT_ATTACK_KEYWORD: "The attack of this ability gains a keyword (e.g. \"this attack gains overkill\"). Ends with the ability. Put it before the damage step and gate it.",
  GRANT_KEYWORD: "Grant keyword (Retaliate, Overkill, Ranged, etc.) to target character.",
  MODIFY_MAX_HEALTH: "Modify maximum hit points of target character.",
  MODIFY_HAND_SIZE: "Modify effective hand size. Use a dynamic formula for scaled bonuses (e.g. Iron Man: +1 per Tech upgrade, clamp max 6).",
  MODIFY_ALLY_LIMIT: "Expand or reduce maximum player ally capacity in play.",
  MODIFY_RESTRICTED_LIMIT: "Grant additional restricted item slots (Side Holster).",
  EXHAUST: "Exhaust a card, identity, ally, minion, villain, or character.",
  READY: "Ready an exhausted card, identity, ally, minion, or character.",
  DISCARD: "Discard cards from a specified source zone (hand, tableau, deck, host, or self).",
  ATTACH_TO_HOST: "Attach card to target character or scheme.",
  ATTACH_FACEDOWN_CARDS_FROM_HAND: "Tuck cards facedown under host card from hand.",
  REMOVE_FROM_GAME: "Remove the source card from the game (it ends only in the removed-from-game zone).",
  PLACE_CARD_UNDER_HOST: "Place card underneath host card.",
  RETURN_TO_HAND: "Return target card in play or attached facedown cards back to owner hand.",
  ATTACHMENT_DAMAGE_SHIELD: "Absorb incoming damage directed at host (e.g. Armored Rhino).",
  CHANGE_FORM: "Flip between Hero and Alter-Ego identity forms (RR v1.8 p. 8).",
  FLIP_FORM: "Flip identity form card.",
  REDUCE_NEXT_CARD_COST: "Reduce resource cost of next played card (Helicarrier).",
  PLAY_FROM_ZONE: "Play a card from a designated zone (e.g. discard, deck) with optional cost modes.",
  PUT_INTO_PLAY: "Put card into play without paying resource cost.",
  SHUFFLE_INTO_DECK: "Shuffle cards from a designated zone into a target deck.",
  VILLAIN_ATTACKS: "Induce the Villain to immediately initiate an attack against player.",
  ENEMY_ATTACKS: "A specific enemy (minion, or a named villain) attacks the player. The step fails when it did not attack (not in play, stunned, cancelled, no hero), so a later step can gate on IF_FAILED.",
  VILLAIN_SCHEMES: "Induce the Villain to immediately scheme against player.",
  VILLAIN_AND_ENGAGED_MINIONS_ATTACK: "Villain and all engaged minions initiate attacks against player.",
  SURGE: "Resolve Surge keyword: deal and reveal an additional encounter card.",
  REVEAL_ENCOUNTER_CARD: "Reveal top card of encounter deck.",
  GIVE_ADDITIONAL_BOOST_CARD: "Deal additional facedown boost card to activating enemy.",
  CANCEL_WHEN_REVEALED: "Cancel the \"When Revealed\" effect of an encounter card.",
  CANCEL_WHEN_REVEALED_AND_REVEAL_ANOTHER: "Cancel When Revealed effect and reveal another encounter card.",
  CANNOT_TAKE_DAMAGE: "CONSTANT: the host cannot take damage. Optional source filter: only damage from a card of this type and/or trait is ignored (Killmonger: Black Panther upgrades). No Tough, shield or Retaliate is used, and the host is not a valid target of a damage-only ability from such a source.",
  CANCEL_ATTACK: "Cancel incoming enemy attack before boost cards or damage are resolved.",
  DECLARE_DEFENDER: "Prompt player to declare a defender against an incoming enemy attack.",
  EXECUTE_SPECIAL: "Execute signature card-specific special logic.",
  PLAYER_CHOICE: "Prompt player to choose between multiple options.",
  DRAW: "Canonical alias for drawing cards.",
  SEARCH: "Canonical alias for searching and selecting cards.",
  REMOVE_STATUS: "Remove a status card from a target.",
  RESTRICT_DEFENSE:
    'CONSTANT: Enforce a defense restriction during attacks (e.g. must defend with a controlled ally, if able; or cannot defend).',
};
