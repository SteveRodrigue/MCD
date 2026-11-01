import { describe, it, expect } from 'vitest';
import { defaultScenarioId } from '@engine/scenarios';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { CardType, type HeroCard } from '@engine/models';
import { drainPrompts } from '@engine/simulation/match-simulator';
import {
  createStage,
  logKeysOf,
  player1,
  revealFixture,
  setForm,
} from '@engine/simulation/ability-stage-setter';

// Quickstrike (RR v1.8): a revealed minion attacks a hero-form player after it engages
describe('Quickstrike on a revealed minion', () => {
  const allCards = cardCatalog.getAllCards();
  const options = { catalog: cardCatalog, allCards, scenarioId: defaultScenarioId() };
  const quickstrike = allCards.find(
    (c) =>
      c.type === CardType.MINION && (c.keywords ?? []).some((k) => String(k) === 'Quickstrike'),
  );

  const reveal = (form: 'hero' | 'alter_ego') => {
    const hero = cardCatalog
      .getCardsBySet('spider_man')
      .find((c): c is HeroCard => c.type === CardType.HERO);
    if (!hero || !quickstrike) throw new Error('missing fixtures');
    const stage = createStage({ card: hero, seed: 'quickstrike', setup: false }, options);
    setForm(player1(stage), form);
    const state = drainPrompts(
      revealFixture(stage, quickstrike),
      'quickstrike',
      (prompt) => prompt.options.find((o) => !o.disabled && /^(pass|undefended)/.test(o.id))?.id,
    );
    return logKeysOf(state);
  };

  it('attacks the hero it engages', () => {
    expect(reveal('hero')).toContain('minion.attack.hit');
  });

  it('does not attack an alter-ego', () => {
    const keys = reveal('alter_ego');
    expect(keys).toContain('encounter.reveal.minion');
    expect(keys).not.toContain('minion.attack.hit');
  });
});
