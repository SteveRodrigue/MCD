import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from '../../src/ui/App';

// Gate 1 release path for each Core hero: scenario selection -> Rhino -> mulligan -> board -> end
// turn (AUD-20261017-232534 F007). Each step goes through the real App and engine.
const HEROES = [
  { deckId: 'spider_man_justice', name: 'Spider-Man', difficulty: 'STANDARD' },
  { deckId: 'captain_marvel_leadership', name: 'Captain Marvel', difficulty: 'EXPERT' },
  { deckId: 'she_hulk_aggression', name: 'She-Hulk', difficulty: 'STANDARD' },
  { deckId: 'iron_man_aggression', name: 'Iron Man', difficulty: 'EXPERT' },
  {
    deckId: 'black_panther_protection',
    name: 'Black Panther',
    difficulty: 'STANDARD',
    // Foresight: the Setup ability waits for an upgrade choice on the mulligan screen. The App
    // seeds each game at random, so the offered upgrades vary: take the first one.
    setupChoice: '(upgrade, Cost',
  },
] as const;

const LOAD = { timeout: 10000 };

describe('Rhino release smoke: setup to first end of turn', () => {
  it.each(HEROES)(
    '$name vs Rhino ($difficulty)',
    async (hero) => {
      const { deckId, difficulty } = hero;
      render(<App />);

      fireEvent.change(await screen.findByDisplayValue(/Spider-Man/, {}, LOAD), {
        target: { value: deckId },
      });
      fireEvent.click(screen.getByText(difficulty));
      fireEvent.click(screen.getByText('START MISSION'));

      fireEvent.click(await screen.findByText(/CONFIRM ALL & START SCENARIO/, {}, LOAD));
      if ('setupChoice' in hero) {
        // A text query: role queries scan the accessible names of the whole board and are slow
        fireEvent.click((await screen.findAllByText(hero.setupChoice, { exact: false }, LOAD))[0]);
        fireEvent.click(await screen.findByText(/START THE SCENARIO & BEGIN ROUND 1/, {}, LOAD));
      }

      fireEvent.click(await screen.findByText('END TURN ➔', {}, LOAD));

      expect(
        await screen.findByText('End of Player Phase: Voluntary Discard', {}, LOAD),
      ).toBeTruthy();
    },
    30000,
  );
});
