import type { PendingDecisionPrompt } from '../../../engine/models';
import type { CardReference } from '../../theme/CardRef';

/**
 * Sample prompts the lab feeds to the real game modals, so what you see at `/templates/` is exactly
 * what the game renders. Codes are real core-set cards, one per accent kind.
 */

export const WAKANDA_FOREVER: CardReference = { code: '01043a', name: 'Wakanda Forever!' };
export const ATTACKER: CardReference = { code: '01094', name: 'Rhino' };
export const SANDMAN: CardReference = { code: '01102', name: 'Sandman' };
export const SPIDER_MAN: CardReference = { code: '01001a', name: 'Spider-Man' };
export const BLACK_WIDOW: CardReference = { code: '01075', name: 'Black Widow' };
export const HULK: CardReference = { code: '01050', name: 'Hulk' };

interface UpgradeSample extends CardReference {
  id: string;
  specialEffect: string;
  amount: number;
  finisherAmount: number;
  text: string;
}

export const WAKANDA_UPGRADES: readonly UpgradeSample[] = [
  {
    id: 'wf_daggers',
    code: '01046',
    name: 'Energy Daggers',
    specialEffect: 'DEAL_DAMAGE',
    amount: 1,
    finisherAmount: 2,
    text: '<b>Special</b>: Deal 1 damage to the villain and each minion engaged with you.',
  },
  {
    id: 'wf_claws',
    code: '01047',
    name: 'Panther Claws',
    specialEffect: 'DEAL_DAMAGE',
    amount: 2,
    finisherAmount: 4,
    text: '<b>Special</b>: Deal 2 damage to an enemy.',
  },
  {
    id: 'wf_genius',
    code: '01048',
    name: 'Tactical Genius',
    specialEffect: 'REMOVE_THREAT',
    amount: 1,
    finisherAmount: 2,
    text: '<b>Special</b>: Remove 1 threat from a scheme.',
  },
  {
    id: 'wf_suit',
    code: '01049',
    name: 'Vibranium Suit',
    specialEffect: 'TRANSFER_DAMAGE',
    amount: 1,
    finisherAmount: 2,
    text: '<b>Special</b>: Move 1 damage from Black Panther to an enemy.',
  },
];

export const WAKANDA_PROMPT: PendingDecisionPrompt = {
  promptId: 'lab_wakanda_forever',
  playerId: 'p1',
  title: 'Wakanda Forever! Sequence Order',
  description: 'Select the resolution order for your Black Panther upgrades.',
  sourceCardName: WAKANDA_FOREVER.name,
  sourceCardCode: WAKANDA_FOREVER.code,
  isVoluntary: false,
  options: WAKANDA_UPGRADES.map((u) => ({
    id: u.id,
    cardCode: u.code,
    label: u.name,
    description: u.text,
    effect: 'SELECT_WAKANDA_UPGRADE',
    params: {
      specialEffect: u.specialEffect,
      amount: u.amount,
      finisherAmount: u.finisherAmount,
    },
  })),
};

/** A defense prompt: Rhino attacks Spider-Man; forced prompts cannot be passed. */
export const decisionPrompt = (forced: boolean): PendingDecisionPrompt => ({
  promptId: 'lab_defend_decision',
  playerId: 'p1',
  title: 'Choose your defense',
  description: 'Pick how to answer this attack before damage is dealt.',
  sourceCardName: SPIDER_MAN.name,
  sourceCardCode: SPIDER_MAN.code,
  triggerSourceName: ATTACKER.name,
  triggerSourceCode: ATTACKER.code,
  attackerCardCode: ATTACKER.code,
  attackerName: ATTACKER.name,
  defenderCardCode: SPIDER_MAN.code,
  defenderName: SPIDER_MAN.name,
  defenderType: 'HERO',
  incomingDamage: 3,
  targetCurrentHp: 10,
  targetMaxHp: 10,
  isVoluntary: !forced,
  options: [
    {
      id: 'defend',
      label: 'Defend with Spider-Man',
      description: 'Exhaust to take the hit (DEF 3).',
      cardCode: SPIDER_MAN.code,
      effect: 'DEFEND',
    },
    {
      id: 'block',
      label: 'Block with Black Widow',
      description: 'Exhaust to intercept all incoming damage.',
      cardCode: BLACK_WIDOW.code,
      effect: 'DEFEND',
    },
    {
      id: 'strike',
      label: 'Strike first with Hulk',
      description: 'Exhaust to smash the attacker before it lands.',
      cardCode: HULK.code,
      effect: 'ATTACK',
    },
    {
      id: 'undefended',
      label: 'Take undefended damage',
      description: 'The attacker deals its damage directly to your hero.',
      icon: 'punch',
      effect: 'UNDEFENDED',
    },
  ],
});

export const SELECT_POOL: readonly (CardReference & { id: string })[] = [
  { id: 'c1', code: '01050', name: 'Hulk' },
  { id: 'c2', code: '01059', name: 'Jessica Jones' },
  { id: 'c3', code: '01066', name: 'Hawkeye' },
  { id: 'c4', code: '01075', name: 'Black Widow' },
  { id: 'c5', code: '01083', name: 'Mockingbird' },
  { id: 'c6', code: '01041', name: 'Shuri' },
];

export const SELECT_PROMPT: PendingDecisionPrompt = {
  promptId: 'lab_select_cards',
  playerId: 'p1',
  title: 'Search your deck for an ally',
  description: 'Select 1 or 2 cards to add to your hand.',
  sourceCardName: SPIDER_MAN.name,
  sourceCardCode: SPIDER_MAN.code,
  isVoluntary: false,
  selection: { min: 1, max: 2 },
  options: SELECT_POOL.map((c) => ({
    id: c.id,
    label: c.name,
    effect: 'SEARCH_AND_SELECT_RESOLUTION',
    params: { cardName: c.name, cardCode: c.code },
  })),
};
