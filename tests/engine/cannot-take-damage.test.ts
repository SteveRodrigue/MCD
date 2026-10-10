import { describe, it, expect } from 'vitest';
import { createCardInstance } from '@engine/state/game-setup';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { applyDamageToTarget } from '@engine/pipeline/damage-pipeline';
import { StatusCard, CardInstance } from '@engine/models';
import { setupGame } from '@engine/state/game-setup';
import { getValidStepTargets } from '@engine/effects/target-choice';

/**
 * CANNOT_TAKE_DAMAGE (#297): a constant restriction on the host. With a source filter it ignores
 * damage from matching cards only; it consumes no Tough, no shield and provokes no Retaliate.
 */
function build() {
  const state = setupGame({
    scenarioId: 'rhino',
    players: [
      {
        id: 'p1',
        name: 'Black Panther',
        hero: cardCatalog.getCard('01040a')!,
        alterEgo: cardCatalog.getCard('01040b')!,
        deckCards: [cardCatalog.getCard('01044')!],
      },
    ] as any,
    villain: cardCatalog.getCard('01094')! as any,
    mainScheme: cardCatalog.getCard('01097')! as any,
    encounterCards: cardCatalog.getCardsBySet('rhino'),
    skipMulligan: true,
  });
  const killmonger = createCardInstance(cardCatalog.getCard('01157')!);
  state.players[0].engagedMinions = [killmonger];
  return { state, killmonger };
}

const refOf = (m: CardInstance) => ({
  type: 'minion' as const,
  entity: m,
  instanceId: m.instanceId,
  name: m.card.name,
  targetPlayerId: 'p1',
  statusCards: m.statusCards,
  attachments: m.attachments,
});

const hit = (
  state: ReturnType<typeof build>['state'],
  m: CardInstance,
  extra: Record<string, unknown>,
) =>
  applyDamageToTarget(state, {
    target: refOf(m),
    amount: 3,
    sourcePlayerId: 'p1',
    ...extra,
  } as any);

describe('CANNOT_TAKE_DAMAGE on Killmonger 01157 (#297)', () => {
  it('1. a Black Panther upgrade deals 0 damage', () => {
    const { state, killmonger } = build();
    const res = hit(state, killmonger, {
      sourceType: 'CARD_EFFECT',
      sourceCardInstance: createCardInstance(cardCatalog.getCard('01047')!),
    });
    expect(killmonger.tokens?.damage ?? 0).toBe(0);
    expect(res.result.damageTaken ?? 0).toBe(0);
  });

  it('2. an upgrade without the trait, an event and a basic attack all deal damage', () => {
    for (const extra of [
      {
        sourceType: 'CARD_EFFECT',
        sourceCardInstance: createCardInstance(cardCatalog.getCard('01057')!),
      },
      {
        sourceType: 'CARD_EFFECT',
        sourceCardInstance: createCardInstance(cardCatalog.getCard('01054')!),
      },
      { sourceType: 'HERO', isAttack: true },
    ]) {
      const { state, killmonger } = build();
      hit(state, killmonger, extra);
      expect(killmonger.tokens?.damage).toBe(3);
    }
  });

  it('3. an immune hit does not consume a Tough status card', () => {
    const { state, killmonger } = build();
    killmonger.statusCards = [StatusCard.TOUGH];
    hit(state, killmonger, {
      sourceType: 'CARD_EFFECT',
      sourceCardInstance: createCardInstance(cardCatalog.getCard('01046')!),
    });
    expect(killmonger.statusCards).toContain(StatusCard.TOUGH);
  });

  it('4. an immune hit never defeats him, even for lethal damage', () => {
    const { state, killmonger } = build();
    const res = applyDamageToTarget(state, {
      target: refOf(killmonger),
      amount: 99,
      sourceType: 'CARD_EFFECT',
      sourcePlayerId: 'p1',
      sourceCardInstance: createCardInstance(cardCatalog.getCard('01047')!),
    } as any);
    expect(res.state.players[0].engagedMinions.length).toBe(1);
    expect(res.result.targetDefeated).toBeFalsy();
  });

  it('5. a damage-only ability from a Black Panther upgrade has no valid target on him', () => {
    const { state, killmonger } = build();
    const claws = createCardInstance(cardCatalog.getCard('01047')!);
    const step = {
      effect: 'DEAL_DAMAGE',
      effectParams: { amount: 2, target: 'CHOSEN_ENEMY' },
    } as any;
    const ids = getValidStepTargets(state, state.players[0], step, {
      sourceCardInstance: claws,
    }).map((t) => t.id);
    expect(ids).not.toContain(killmonger.instanceId);
    const otherIds = getValidStepTargets(state, state.players[0], step, {
      sourceCardInstance: createCardInstance(cardCatalog.getCard('01057')!),
    }).map((t) => t.id);
    expect(otherIds).toContain(killmonger.instanceId);
  });

  it('6. data: 01157 declares the immunity, has no When Revealed tough, confidence 95', () => {
    const card = cardCatalog.getCard('01157')! as any;
    const abilities = card.enrichment.abilities;
    expect(abilities.some((a: any) => a.trigger === 'WHEN_REVEALED')).toBe(false);
    const step = abilities[0].steps[0];
    expect(abilities[0].timing).toBe('CONSTANT');
    expect(step.effect).toBe('CANNOT_TAKE_DAMAGE');
    expect(step.effectParams).toMatchObject({
      target: 'SELF',
      sourceCardType: 'UPGRADE',
      sourceTrait: 'Black Panther',
    });
    expect(card.enrichment.audit.confidence).toBe(95);
  });
});
