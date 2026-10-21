import { expect } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { createCardInstance, setupGame } from '@engine/state/game-setup';
import type { GameSetupOptions } from '@engine/state/game-setup';
import { dispatchAction } from '@engine/pipeline';
import type {
  AlterEgoCard,
  CardAbility,
  GameAction,
  GameState,
  HeroCard,
  NormalizedCard,
} from '@engine/models';

/** A seat in a fixture game; unset fields take the defaults of that seat (p1 Spider-Man, p2 Iron Man). */
export interface PlayerSpec {
  id?: string;
  name?: string;
  /** Hero card or its catalog code (the alter-ego defaults to the same set's `b` side). */
  hero?: HeroCard | string;
  alterEgo?: AlterEgoCard | string;
  deck?: NormalizedCard[];
  /** Put the seat in this form after setup. Default: the setup form (alter-ego). */
  form?: 'hero' | 'alter-ego';
  /** Catalog codes added to the seat's hand. */
  hand?: string[];
  /** Catalog codes added to the seat's tableau. */
  tableau?: string[];
}

export interface RhinoGameOptions {
  /** A player count (default seats) or one spec per seat. Default: 1. */
  players?: 1 | 2 | PlayerSpec[];
  /** Any other setup option (seed, difficulty, villain, mainScheme, encounterCards, ...). */
  setup?: Partial<GameSetupOptions>;
}

const DEFAULT_SEATS: PlayerSpec[] = [
  { hero: '01001a', alterEgo: '01001b' },
  { hero: '01029a', alterEgo: '01029b' },
];

/** A catalog card, narrowed to the hero side; throws when the code is unknown. */
export function heroCard(code: string): HeroCard {
  return cardCatalog.getCard(code) as HeroCard;
}

/** The enriched ability `id` of the catalog card `code`. */
export function abilityOf(code: string, id: string): CardAbility {
  return cardCatalog.getCard(code)!.enrichment!.abilities!.find((a) => a.id === id)!;
}

function resolveCard<T extends NormalizedCard>(card: T | string | undefined, fallback: string): T {
  return (typeof card === 'object' ? card : cardCatalog.getCard(card ?? fallback)) as T;
}

/**
 * A Rhino scenario game with the mulligan skipped. The one place a test builds a game, so a change
 * to setup is made here instead of in every test file.
 */
export function newRhinoGame(options: RhinoGameOptions = {}): GameState {
  const { players = 1, setup = {} } = options;
  const seats = typeof players === 'number' ? DEFAULT_SEATS.slice(0, players) : players;
  const state = setupGame({
    catalog: cardCatalog,
    scenarioId: 'rhino',
    players: seats.map((seat, i) => {
      const id = seat.id ?? `p${i + 1}`;
      const defaults = DEFAULT_SEATS[i] ?? DEFAULT_SEATS[0];
      const hero = resolveCard<HeroCard>(seat.hero, defaults.hero as string);
      return {
        id,
        name: seat.name ?? hero.name ?? id,
        hero,
        alterEgo: resolveCard<AlterEgoCard>(seat.alterEgo, hero.code.replace(/a$/, 'b')),
        deckCards: seat.deck ?? Array(10).fill(cardCatalog.getCard('01005')!),
      };
    }),
    skipMulligan: true,
    ...setup,
  });
  seats.forEach((seat, i) => {
    const player = state.players[i];
    if (seat.form === 'hero') {
      player.currentForm = 'hero';
      player.activeFormCard = player.hero;
    }
    for (const code of seat.hand ?? [])
      player.hand.push(createCardInstance(cardCatalog.getCard(code)!));
    for (const code of seat.tableau ?? [])
      player.tableau.push(createCardInstance(cardCatalog.getCard(code)!));
  });
  return state;
}

/** Dispatches `action`, asserts it succeeded, and returns the new state. */
export function dispatchOk(state: GameState, action: GameAction): GameState {
  const { state: next, result } = dispatchAction(state, action);
  expect(result.success, result.error).toBe(true);
  return next;
}
