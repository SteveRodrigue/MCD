import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { HeroZone } from '../../src/ui/components/board/HeroZone';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { createCardInstance } from '../../src/engine/state/game-setup';
import type { GameState } from '../../src/engine/models';
import { newRhinoGame } from '../support/game-fixtures';
import { TestSession } from '../support/render-with-session';

vi.mock('../../src/ui/hooks/useCardArt', () => ({
  useCardArt: vi.fn().mockReturnValue({
    artUrl: 'https://cdn.example.com/test.jpg',
    loading: false,
    error: null,
  }),
}));

/**
 * An empty Threat Zone or Tableau is not drawn: its count is a badge in the seat ribbon (Issue #379).
 * "Empty" reads the zone's data: the Threat Zone also holds dealt facedown cards and obligations.
 */
const instance = (code: string) => createCardInstance(cardCatalog.getCard(code)!);

const renderSeat = (state: GameState, isMultiHero = false) =>
  render(
    <TestSession state={state}>
      <HeroZone
        player={state.players[0]}
        seatNumber={1}
        isFocused={true}
        isMultiHero={isMultiHero}
      />
    </TestSession>,
  );

/** The ribbon row: the seat title and, beside it, the badges of the zones that are not drawn. */
const ribbon = () => screen.getByTestId('hero-zone-ribbon').parentElement as HTMLElement;

describe('HeroZone empty zones (Issue #379)', () => {
  it('draws neither the Threat Zone nor the Tableau of an empty seat, and badges both in the ribbon', () => {
    const state = newRhinoGame();
    renderSeat(state);

    expect(screen.queryByTestId('threat-zone')).toBeNull();
    expect(screen.queryByTestId('tableau-section')).toBeNull();
    expect(within(ribbon()).getByTestId('empty-zone-badge-minions').textContent).toMatch(
      /minions 0/i,
    );
    expect(within(ribbon()).getByTestId('empty-zone-badge-tableau').textContent).toMatch(
      /tableau 0/i,
    );
  });

  it('keeps "Perimeter secure" in the minions badge title and accessible name', () => {
    const state = newRhinoGame();
    renderSeat(state);
    const badge = screen.getByTestId('empty-zone-badge-minions');
    const expected = `No minions engaged with ${state.players[0].name} (Perimeter secure)`;
    expect(badge.getAttribute('title')).toBe(expected);
    expect(badge.getAttribute('aria-label')).toBe(expected);
  });

  it('brings the Threat Zone back, and drops its badge, once a minion is engaged', () => {
    const state = newRhinoGame();
    state.players[0].engagedMinions = [instance('01110')];
    renderSeat(state);

    expect(screen.getByTestId('threat-zone')).toBeDefined();
    expect(screen.queryByTestId('empty-zone-badge-minions')).toBeNull();
    expect(screen.getByTestId('empty-zone-badge-tableau')).toBeDefined();
  });

  it('keeps the Threat Zone for a dealt facedown card alone', () => {
    const state = newRhinoGame();
    state.players[0].dealtEncounterCards = [instance('01005')];
    renderSeat(state);

    expect(screen.getByTestId('threat-zone')).toBeDefined();
    expect(screen.queryByTestId('empty-zone-badge-minions')).toBeNull();
  });

  it('keeps the Threat Zone for an obligation alone', () => {
    const state = newRhinoGame();
    state.players[0].obligations = [instance('01175')];
    renderSeat(state);

    expect(screen.getByTestId('threat-zone')).toBeDefined();
    expect(screen.queryByTestId('empty-zone-badge-minions')).toBeNull();
  });

  it('brings the Tableau back, and drops its badge, once a card is in it', () => {
    const state = newRhinoGame({ players: [{ tableau: ['01008'] }] });
    renderSeat(state);

    expect(within(screen.getByTestId('tableau-section')).getByAltText('Web-Shooter')).toBeDefined();
    expect(screen.queryByTestId('empty-zone-badge-tableau')).toBeNull();
    expect(screen.getByTestId('empty-zone-badge-minions')).toBeDefined();
  });

  it('behaves the same at a multi-hero table', () => {
    const state = newRhinoGame({ players: 2 });
    renderSeat(state, true);

    expect(screen.queryByTestId('threat-zone')).toBeNull();
    expect(screen.queryByTestId('tableau-section')).toBeNull();
    expect(screen.getByTestId('empty-zone-badge-minions')).toBeDefined();
    expect(screen.getByTestId('empty-zone-badge-tableau')).toBeDefined();
  });

  it('does not touch the Allies panel: it stays when empty', () => {
    renderSeat(newRhinoGame());
    expect(screen.getByTestId('nested-allies-section').textContent).toContain('No allies in play');
  });
});
