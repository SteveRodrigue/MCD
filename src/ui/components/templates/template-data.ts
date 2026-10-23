import type { CardReference } from '../../theme/CardRef';

/** Sample content shared by the lab templates. Codes are real core-set cards. */

export const WAKANDA_FOREVER: CardReference = { code: '01043a', name: 'Wakanda Forever!' };

export interface UpgradeItem extends CardReference {
  id: string;
  baseBadge: string;
  finisherBadge: string;
  effectText: string;
}

export const WAKANDA_UPGRADES: readonly UpgradeItem[] = [
  {
    id: 'wf_daggers',
    code: '01046',
    name: 'Energy Daggers',
    baseBadge: '1 DMG',
    finisherBadge: '💥 2 DMG',
    effectText: 'Deal 1 damage to the villain and each minion engaged with you.',
  },
  {
    id: 'wf_claws',
    code: '01047',
    name: 'Panther Claws',
    baseBadge: '2 DMG',
    finisherBadge: '💥 4 DMG',
    effectText: 'Deal 2 damage to an enemy.',
  },
  {
    id: 'wf_genius',
    code: '01048',
    name: 'Tactical Genius',
    baseBadge: '1 THW',
    finisherBadge: '💥 2 THW',
    effectText: 'Remove 1 threat from a scheme.',
  },
  {
    id: 'wf_suit',
    code: '01049',
    name: 'Vibranium Suit',
    baseBadge: '1 MOVE',
    finisherBadge: '💥 2 MOVE',
    effectText: 'Move 1 damage from Black Panther to an enemy.',
  },
];

/** One card per accent kind, so the lab shows hero, aspect, villain and encounter colours. */
export const ATTACKER: CardReference = { code: '01094', name: 'Rhino' };
export const SANDMAN: CardReference = { code: '01102', name: 'Sandman' };
export const SPIDER_MAN: CardReference = { code: '01001a', name: 'Spider-Man' };
export const BLACK_WIDOW: CardReference = { code: '01075', name: 'Black Widow' };
export const HULK: CardReference = { code: '01050', name: 'Hulk' };

export const SEARCH_SOURCE: CardReference = SPIDER_MAN;

export const SELECT_POOL: readonly (CardReference & { id: string })[] = [
  { id: 'c1', code: '01050', name: 'Hulk' },
  { id: 'c2', code: '01059', name: 'Jessica Jones' },
  { id: 'c3', code: '01066', name: 'Hawkeye' },
  { id: 'c4', code: '01075', name: 'Black Widow' },
  { id: 'c5', code: '01083', name: 'Mockingbird' },
  { id: 'c6', code: '01041', name: 'Shuri' },
];
