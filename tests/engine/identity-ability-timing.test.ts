import { describe, it, expect } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { HeroCard, AlterEgoCard } from '../../src/engine/models';
import { setupGame } from '../../src/engine/state/game-setup';
import { getLegalActionsForPlayer } from '../../src/engine/pipeline/legal-actions-generator';
import { triggersAreEquivalent } from '../../src/engine/triggers/trigger-dispatcher';

/** Identity timing convention and the single defeat trigger (#261). */
describe('identity ability timings (#261)', () => {
  it('no identity card declares a HERO_* / ALTER_EGO_* timing (the card side gates the form)', () => {
    const offenders: string[] = [];
    for (const card of cardCatalog.getAllCards()) {
      if (card.type !== 'hero' && card.type !== 'alter_ego') continue;
      for (const ab of card.enrichment?.abilities ?? []) {
        if (/^(HERO|ALTER_EGO)_/.test(ab.timing))
          offenders.push(`${card.code} ${ab.id} ${ab.timing}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('declares the printed timing on the five normalised abilities', () => {
    const timing = (code: string, id: string) =>
      cardCatalog.getCard(code)!.enrichment!.abilities!.find((a) => a.id === id)!.timing;
    expect(timing('01010a', 'rechannel')).toBe('ACTION');
    expect(timing('01010b', 'commander')).toBe('ACTION');
    expect(timing('01019a', 'she_hulk_form_change')).toBe('RESPONSE');
    expect(timing('01019b', 'i_object')).toBe('INTERRUPT');
    expect(timing('01029b', 'futurist')).toBe('ACTION');
  });

  function carolState(form: 'hero' | 'alter_ego') {
    const hero = cardCatalog.getCard('01010a') as HeroCard;
    const alterEgo = cardCatalog.getCard('01010b') as AlterEgoCard;
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Carol',
          hero,
          alterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
    const p = state.players[0];
    p.currentForm = form;
    p.activeFormCard = form === 'hero' ? hero : alterEgo;
    p.health = 1;
    p.hand = [
      { instanceId: 'en', card: cardCatalog.getCard('01002')!, exhausted: false },
      { instanceId: 'en2', card: cardCatalog.getCard('01002')!, exhausted: false },
    ] as any;
    return state;
  }

  it('an identity ACTION is offered only for the faceup side', () => {
    const ids = (form: 'hero' | 'alter_ego') =>
      getLegalActionsForPlayer(carolState(form), 'p1')
        .identityActions.map((a) => a.id)
        .sort();
    const hero = ids('hero');
    const alterEgo = ids('alter_ego');
    expect(hero).toContain('action_id_ability_rechannel');
    expect(hero).not.toContain('action_id_ability_commander');
    expect(alterEgo).toContain('action_id_ability_commander');
    expect(alterEgo).not.toContain('action_id_ability_rechannel');
  });

  it('DEFEATED has no trigger alias; Chase Them Down filters instead of a specific trigger name', () => {
    expect(triggersAreEquivalent('DEFEATED', 'ENEMY_DEFEATED_BY_HERO_ATTACK')).toBe(false);
    const a = cardCatalog.getCard('01052')!.enrichment!.abilities![0];
    expect(a.trigger).toBe('DEFEATED');
    expect(a.triggerFilter).toMatchObject({ targetType: 'ENEMY', defeatedByAttackOf: 'YOUR_HERO' });
  });
});
