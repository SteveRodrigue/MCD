import { describe, it, expect } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { StatusCard } from '@engine/models';
import { createCardInstance } from '@engine/state/game-setup';
import { peekDecisionPrompt } from '@engine/pipeline';
import { step4_revealEncounterCards } from '@engine/pipeline/villain-phase';
import { newRhinoGame } from '../support/game-fixtures';

const FAMILY_EMERGENCY = '01175';

/**
 * Found by the #431 Gauntlet: a hero already stunned and exhausted revealed Family Emergency, whose
 * two options were then both disabled ("Identity is already exhausted", "No valid target"), and the
 * game could not go on. A forced choice always keeps an option the player can take.
 */
describe('a forced choice always has an option to take (#431)', () => {
  function revealFamilyEmergency(
    setup: (hero: ReturnType<typeof newRhinoGame>['players'][0]) => void,
  ) {
    const state = newRhinoGame({ players: [{ hero: '01010a', form: 'alter-ego' }] });
    const player = state.players[0];
    setup(player);
    player.dealtEncounterCards.push(createCardInstance(cardCatalog.getCard(FAMILY_EMERGENCY)!));
    step4_revealEncounterCards(state);
    const prompt = peekDecisionPrompt(state);
    expect(prompt, 'Family Emergency asks the player to choose').toBeDefined();
    return prompt!;
  }

  it('keeps "you are stunned, this gains surge" when the identity is already stunned and exhausted', () => {
    const prompt = revealFamilyEmergency((hero) => {
      hero.exhausted = true;
      hero.statusCards = [StatusCard.STUNNED];
    });
    const enabled = prompt.options.filter((o) => !o.disabled).map((o) => o.id);
    expect(enabled).toContain('take_effect');
  });

  it('still offers both options to a healthy alter-ego', () => {
    const prompt = revealFamilyEmergency(() => undefined);
    expect(prompt.options.filter((o) => !o.disabled).map((o) => o.id)).toEqual([
      'exhaust_identity',
      'take_effect',
    ]);
  });

  it('still disables an option with no valid target while another one can resolve', () => {
    // Exhausted but not stunned: stunning is possible, exhausting the identity is not
    const prompt = revealFamilyEmergency((hero) => {
      hero.exhausted = true;
    });
    const byId = Object.fromEntries(prompt.options.map((o) => [o.id, Boolean(o.disabled)]));
    expect(byId).toMatchObject({ exhaust_identity: true, take_effect: false });
  });
});
