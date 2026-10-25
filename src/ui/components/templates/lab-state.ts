import { cardCatalog } from '../../../data/importer/card-loader';
import type {
  AlterEgoCard,
  CardInstance,
  GameState,
  HeroCard,
  PlayerState,
} from '../../../engine/models';
import { createCardInstance, setupGame } from '../../../engine/state/game-setup';
import type { EnemyTarget } from '../board/attack-target-utils';
import type { SchemeTarget } from '../board/thwart-target-utils';

/**
 * A real Rhino game for the modals that read the game session (menus, payment, options, game over).
 * Spider-Man is in hero form with an ally, an upgrade and a resource generator in play and a hand to choose from.
 */

const card = (code: string) => cardCatalog.getCard(code)!;
const instance = (code: string): CardInstance => createCardInstance(card(code));

export interface LabGame {
  state: GameState;
  player: PlayerState;
  ally: CardInstance;
  upgrade: CardInstance;
  /** A hand card that costs resources, so the payment modal has something to pay. */
  costly: CardInstance;
}

export const buildLabGame = (): LabGame => {
  const state = setupGame({
    catalog: cardCatalog,
    scenarioId: 'rhino',
    players: [
      {
        id: 'p1',
        name: 'Spider-Man',
        hero: card('01001a') as HeroCard,
        alterEgo: card('01001b') as AlterEgoCard,
        deckCards: Array(10).fill(card('01005')),
      },
    ],
    skipMulligan: true,
    seed: 'template-lab',
  });
  const player = state.players[0];
  player.currentForm = 'hero';
  player.activeFormCard = player.hero;
  const ally = instance('01050');
  const upgrade = instance('01007');
  const costly = instance('01050');
  // Web-Shooter: a hero resource generator with web counters, so payment has one to offer.
  player.tableau.push(ally, upgrade, instance('01008'));
  player.hand.push(
    costly,
    instance('01003'),
    instance('01075'),
    instance('01059'),
    instance('01066'),
  );
  return { state, player, ally, upgrade, costly };
};

export const labEnemyTargets = (): EnemyTarget[] => [
  {
    id: 'villain',
    name: 'Rhino',
    type: 'villain',
    health: 14,
    maxHealth: 18,
    damage: 2,
    traits: ['Brute', 'Criminal'],
    hasGuard: false,
    hasTough: false,
    code: '01094',
  },
  {
    id: 'minion',
    name: 'Sandman',
    type: 'minion',
    instanceId: 'lab_sandman',
    health: 3,
    maxHealth: 5,
    damage: 1,
    traits: ['Elite'],
    hasGuard: true,
    hasTough: true,
    code: '01102',
  },
];

export const labSchemeTargets = (mainSchemeCode: string | undefined): SchemeTarget[] => [
  {
    id: 'main',
    name: 'The Break-In!',
    type: 'main_scheme',
    threat: 9,
    targetThreat: 15,
    hasCrisis: false,
    hasHazard: true,
    hasAcceleration: true,
    allowed: true,
    code: mainSchemeCode,
  },
  {
    id: 'side',
    name: 'Crisis at the Docks',
    type: 'side_scheme',
    instanceId: 'lab_side',
    threat: 4,
    hasCrisis: true,
    hasHazard: false,
    hasAcceleration: false,
    allowed: false,
    disabledReason: 'A crisis scheme must be thwarted first',
  },
];

export { instance as labInstance };
