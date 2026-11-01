import {
  CardType,
  FactionCode,
  type AlterEgoCard,
  type CardRepository,
  type HeroCard,
  type NormalizedCard,
} from '../models';
import { setupGame, resetInstanceCounter } from '../state/game-setup';
import { runMatch, type MatchSimulationResult } from './match-simulator';
import { digestState } from './effect-delta-verifier';
import { draftDeck, rankHeroSets } from './scarcity-matchmaker';
import { fnv1a, type ScarcityLedger, type SimulationRecipe } from './ability-coverage';

export const GAUNTLET_MATCHES = 20;
const GAUNTLET_MAX_ROUNDS = 12;
const ASPECT_CYCLE = [
  FactionCode.AGGRESSION,
  FactionCode.JUSTICE,
  FactionCode.LEADERSHIP,
  FactionCode.PROTECTION,
] as const;

export interface GauntletOptions {
  catalog: CardRepository;
  allCards: readonly NormalizedCard[];
  seed: string;
  /** The scenario every match plays (the Gate 1 scope passes `defaultScenarioId()`). */
  scenarioId: string;
  /** What is already tested; each match adds to it, so later decks lean toward what is left. */
  ledger: ScarcityLedger;
  matches?: number;
  cardDataHash: string;
}

export interface GauntletMatch {
  recipe: SimulationRecipe;
  ok: boolean;
  /** The crash, step error or broken invariant that ended the match. */
  error?: string;
  /** Hash of the log, the winner and the final state digest: a replay of the recipe must reproduce it. */
  fingerprint?: string;
  result?: MatchSimulationResult;
}

/** Plays one recorded recipe from its card codes and frozen ledger; the same recipe plays the same match. */
export function playRecipe(recipe: SimulationRecipe, catalog: CardRepository): GauntletMatch {
  try {
    resetInstanceCounter();
    const players = recipe.players.map((player, index) => {
      const identity = catalog.getCardsBySet(player.heroSetCode);
      const hero = identity.find((c): c is HeroCard => c.type === CardType.HERO);
      const alterEgo = identity.find((c): c is AlterEgoCard => c.type === CardType.ALTER_EGO);
      const obligation = identity.find((c) => c.type === CardType.OBLIGATION);
      if (!hero || !alterEgo) throw new Error(`'${player.heroSetCode}' is not a hero set`);
      return {
        id: `p${index + 1}`,
        name: hero.name,
        hero,
        alterEgo,
        deckCards: player.deckCardCodes.map((code) => {
          const card = catalog.getCard(code);
          if (!card) throw new Error(`card ${code} is not in the catalog`);
          return card;
        }),
        obligation,
        nemesisCards: catalog.getNemesisCardsForHero(player.heroSetCode),
      };
    });
    const state = setupGame({
      catalog,
      scenarioId: recipe.scenarioId,
      difficulty: recipe.difficulty,
      seed: recipe.seed,
      players,
    });
    const result = runMatch(state, {
      maxRounds: GAUNTLET_MAX_ROUNDS,
      maxActionsPerTurn: 15,
      seed: recipe.seed,
      scarcity: recipe.ledgerSnapshot,
      rotationSeed: recipe.botSeed,
    });
    // The whole log and the final state digest: a replay must end in the same game, not just the same winner
    const fingerprint = fnv1a(
      `${result.winner}|${result.logSummary.join('|')}|${JSON.stringify(digestState(result.finalState))}`,
    )
      .toString(16)
      .padStart(8, '0');
    return { recipe, ok: true, fingerprint, result };
  } catch (error) {
    return { recipe, ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * The exploratory half of the simulation: full matches by the coverage-seeking bot across the
 * Core heroes, aspects, one and two players, Standard and Expert, with decks drafted toward what
 * is still untested. It reports findings (crashes, step errors, broken invariants); it never
 * decides whether coverage is met, which is the Stage-Setter's job.
 */
export function runGauntlet(options: GauntletOptions): GauntletMatch[] {
  const { catalog, allCards, seed, cardDataHash, scenarioId } = options;
  const total = options.matches ?? GAUNTLET_MATCHES;
  let ledger = { ...options.ledger };
  const matches: GauntletMatch[] = [];

  for (let i = 0; i < total; i++) {
    const ranked = rankHeroSets(catalog, allCards, ledger);
    const playerCount = i < total / 2 ? 1 : 2;
    const drafted = Array.from({ length: playerCount }, (_, n) =>
      draftDeck({
        catalog,
        allCards,
        heroSetCode: ranked[(i + n) % ranked.length],
        ledger,
        seed: `${seed}:g${i}:p${n}`,
        aspect: ASPECT_CYCLE[(i + n) % ASPECT_CYCLE.length],
      }),
    );
    const recipe: SimulationRecipe = {
      id: `gauntlet:${seed}:${i}`,
      seed: `${seed}:g${i}`,
      botSeed: `${seed}:bot${i}`,
      players: drafted.map((d) => ({
        heroSetCode: d.heroSetCode,
        deckCardCodes: d.deckCards.map((c) => c.code),
      })),
      scenarioId,
      difficulty: i % 2 === 0 ? 'STANDARD' : 'EXPERT',
      playerCount,
      ledgerSnapshot: ledger,
      cardDataHash,
    };
    const match = playRecipe(recipe, catalog);
    matches.push(match);
    // What this match tested steers the next deck and the next bot
    if (match.ok && match.result?.scarcity) ledger = { ...match.result.scarcity };
  }
  return matches;
}
