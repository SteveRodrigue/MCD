import { TimingType, TriggerType } from './types';
import { AbilityStep, AbilityCost } from '../../data/supplemental/schema';

export interface TimingPattern {
  regex: RegExp;
  timing: TimingType;
}

export const TIMING_PATTERNS: TimingPattern[] = [
  { regex: /^Hero Action/i, timing: 'HERO_ACTION' },
  { regex: /^Alter-Ego Action/i, timing: 'ALTER_EGO_ACTION' },
  { regex: /^Action/i, timing: 'ACTION' },
  { regex: /^Forced Interrupt/i, timing: 'FORCED_INTERRUPT' },
  { regex: /^Hero Interrupt/i, timing: 'HERO_INTERRUPT' },
  { regex: /^Alter-Ego Interrupt/i, timing: 'ALTER_EGO_INTERRUPT' },
  { regex: /^Interrupt/i, timing: 'INTERRUPT' },
  { regex: /^Forced Response/i, timing: 'FORCED_RESPONSE' },
  { regex: /^Hero Response/i, timing: 'HERO_RESPONSE' },
  { regex: /^Alter-Ego Response/i, timing: 'ALTER_EGO_RESPONSE' },
  { regex: /^Response/i, timing: 'RESPONSE' },
  { regex: /^Hero Resource/i, timing: 'HERO_RESOURCE' },
  { regex: /^Alter-Ego Resource/i, timing: 'ALTER_EGO_RESOURCE' },
  { regex: /^Resource/i, timing: 'RESOURCE' },
  { regex: /^When Revealed/i, timing: 'WHEN_REVEALED' },
  { regex: /^Special/i, timing: 'SPECIAL' },
  { regex: /^Setup/i, timing: 'SETUP' },
];

export interface TriggerPattern {
  regex: RegExp;
  trigger: TriggerType;
}

export const TRIGGER_PATTERNS: TriggerPattern[] = [
  {
    regex: /when (?:the )?villain initiates an attack against you/i,
    trigger: 'VILLAIN_INITIATES_ATTACK',
  },
  {
    regex: /when you would take (?:any amount of )?damage from an attack/i,
    trigger: 'TAKE_ATTACK_DAMAGE',
  },
  { regex: /when you would take (?:any amount of )?damage/i, trigger: 'TAKE_DAMAGE' },
  {
    regex: /when a treachery card is revealed(?: from the encounter deck)?/i,
    trigger: 'WHEN_REVEALED',
  },
  { regex: /after you play ([A-Za-z0-9 '-]+)/i, trigger: 'CARD_PLAYED' },
  { regex: /after ([A-Za-z0-9 '-]+) attacks/i, trigger: 'ATTACK_RESOLVED' },
  { regex: /after ([A-Za-z0-9 '-]+) thwarts/i, trigger: 'THWART_RESOLVED' },
  { regex: /when attached minion is defeated/i, trigger: 'MINION_DEFEATED' },
  { regex: /after a minion is defeated/i, trigger: 'MINION_DEFEATED' },
  { regex: /after you change to this form/i, trigger: 'FORM_CHANGED_TO_HERO' },
  { regex: /when attached enemy would attack/i, trigger: 'VILLAIN_INITIATES_ATTACK' },
];

export interface LimitPattern {
  regex: RegExp;
  limit?: 'ONCE_PER_ROUND' | 'ONCE_PER_PHASE';
  maxPerRound?: number;
}

export const LIMIT_PATTERNS: LimitPattern[] = [
  { regex: /\(Limit once per round\.?\)/i, limit: 'ONCE_PER_ROUND', maxPerRound: 1 },
  { regex: /\(Limit once per phase\.?\)/i, limit: 'ONCE_PER_PHASE', maxPerRound: 1 },
  { regex: /\(Limit (\d+) times? per round\.?\)/i, limit: 'ONCE_PER_ROUND' },
];

export interface CostExtractorResult {
  cost: AbilityCost;
  matchedText: string;
}

export function extractCostClause(costText: string): AbilityCost | undefined {
  const cost: AbilityCost = {};
  let hasCost = false;

  // Exhaust Self
  if (/exhaust ([A-Za-z0-9 '-]+)/i.test(costText)) {
    cost.exhaustSelf = true;
    hasCost = true;
  }

  // Take Damage
  const damageMatch = costText.match(/take (\d+) damage/i);
  if (damageMatch) {
    cost.damageHero = parseInt(damageMatch[1], 10);
    hasCost = true;
  }

  // Discard card from hand
  const discardHandMatch = costText.match(/(?:choose and )?discard (\d+) cards? from your hand/i);
  if (discardHandMatch) {
    cost.discardCard = {
      from: 'HAND',
      count: parseInt(discardHandMatch[1], 10),
    };
    hasCost = true;
  }

  // Spend resources: spend a [mental] resource / spend 1 [energy] resource
  const resMatch = costText.match(
    /spend (?:a |an |)(\d*\s*)?\[(physical|energy|mental|wild)\] resource/i,
  );
  if (resMatch) {
    const resType = resMatch[2].toLowerCase() as 'physical' | 'energy' | 'mental' | 'wild';
    cost.resources = [resType];
    hasCost = true;
  }

  // Spend / remove counters
  const counterMatch = costText.match(/(?:remove|spend) (\d+) ([a-z]+) counters?(?: from it)?/i);
  if (counterMatch) {
    cost.spendCounters = {
      amount: parseInt(counterMatch[1], 10),
      counterType: counterMatch[2].toLowerCase(),
    };
    hasCost = true;
  }

  // Discard Self
  if (/^discard ([A-Za-z0-9 '-]+)$/i.test(costText.trim())) {
    cost.discardSelf = true;
    hasCost = true;
  }

  return hasCost ? cost : undefined;
}

export interface EffectPattern {
  regex: RegExp;
  handler: (match: RegExpMatchArray) => AbilityStep[];
}

export const EFFECT_PATTERNS: EffectPattern[] = [
  // Deal damage
  {
    regex: /deal (\d+) damage to (an enemy|the villain|each enemy|chosen enemy)/i,
    handler: (m) => {
      const amount = parseInt(m[1], 10);
      const targetStr = m[2].toLowerCase();
      let target: string = 'CHOSEN_ENEMY';
      let effect: any = 'DEAL_DAMAGE';
      if (targetStr.includes('each enemy')) {
        effect = 'DEAL_DAMAGE_ALL_ENEMIES';
        target = 'ALL_ENEMIES';
      } else if (targetStr.includes('villain')) {
        target = 'VILLAIN';
      }
      return [
        {
          effect,
          params: { amount, target },
        },
      ];
    },
  },
  // Remove threat
  {
    regex: /remove (\d+) threat from (a scheme|the main scheme|chosen scheme)/i,
    handler: (m) => {
      const amount = parseInt(m[1], 10);
      const targetStr = m[2].toLowerCase();
      const target = targetStr.includes('main') ? 'MAIN_SCHEME' : 'CHOSEN_SCHEME';
      return [
        {
          effect: 'REMOVE_THREAT',
          params: { amount, target },
        },
      ];
    },
  },
  // Draw cards
  {
    regex: /draw (\d+) cards?(?: \(draw (\d+) cards? instead if you are ([A-Za-z0-9 '-]+)\))?/i,
    handler: (m) => {
      const count = parseInt(m[1], 10);
      const params: Record<string, any> = { count };
      if (m[2] && m[3]) {
        const bonusTotal = parseInt(m[2], 10);
        const heroName = m[3].toLowerCase();
        if (heroName.includes('carol')) {
          params.carolBonus = bonusTotal - count;
        }
      }
      return [
        {
          effect: 'DRAW_CARDS',
          params,
        },
      ];
    },
  },
  // Choose a player to draw cards
  {
    regex: /choose a player to draw (\d+) cards?/i,
    handler: (m) => [
      {
        effect: 'DRAW_CARDS',
        params: {
          count: parseInt(m[1], 10),
          target: 'CHOSEN_PLAYER',
        },
      },
    ],
  },
  // Heal damage
  {
    regex: /heal (\d+) damage from ([A-Za-z0-9 '-]+)/i,
    handler: (m) => {
      const amount = parseInt(m[1], 10);
      const targetName = m[2].toLowerCase();
      let target = 'SELF_IDENTITY';
      if (
        targetName.includes('identity') ||
        targetName.includes('you') ||
        targetName.includes('hero')
      ) {
        target = 'SELF_IDENTITY';
      }
      return [
        {
          effect: 'HEAL_DAMAGE',
          params: { amount, target },
        },
      ];
    },
  },
  // Generate resources
  {
    regex: /generate (?:a |an |)(\d*\s*)?\[(physical|energy|mental|wild)\] resource/i,
    handler: (m) => {
      const resource = m[2].toLowerCase();
      const amount = m[1] ? parseInt(m[1].trim(), 10) || 1 : 1;
      return [
        {
          effect: 'GENERATE_RESOURCE',
          params: { resource, amount },
        },
      ];
    },
  },
  // Prevent damage
  {
    regex: /prevent all of that damage/i,
    handler: () => [
      {
        effect: 'PREVENT_DAMAGE',
        params: { amount: 'ALL' },
      },
    ],
  },
  {
    regex: /prevent (\d+) of that damage/i,
    handler: (m) => [
      {
        effect: 'PREVENT_DAMAGE',
        params: { amount: parseInt(m[1], 10) },
      },
    ],
  },
  // Cancel When Revealed
  {
    regex: /cancel its ["“]When Revealed["”] effects/i,
    handler: () => [
      {
        effect: 'CANCEL_WHEN_REVEALED',
        params: {},
      },
    ],
  },
  // Stun / Confuse / Tough status
  {
    regex: /(?:then, |)stun (that enemy|the attacked enemy|an enemy|the villain)/i,
    handler: (m) => {
      const targetStr = m[1].toLowerCase();
      let target = 'CHOSEN_ENEMY';
      if (targetStr.includes('attacked')) target = 'ATTACK_TARGET';
      else if (targetStr.includes('villain')) target = 'VILLAIN';
      return [
        {
          effect: 'ADD_STATUS',
          params: { status: 'STUNNED', target },
        },
      ];
    },
  },
  // Ready character
  {
    regex: /ready your hero/i,
    handler: () => [
      {
        effect: 'READY_IDENTITY',
        params: { target: 'SELF_IDENTITY' },
      },
    ],
  },
  // Attach to host
  {
    regex: /attach to (a minion|an enemy)/i,
    handler: (m) => {
      const target = m[1].toLowerCase().includes('minion') ? 'CHOSEN_MINION' : 'ENEMY';
      return [
        {
          effect: 'ATTACH_TO_HOST',
          params: { target },
        },
      ];
    },
  },
];
