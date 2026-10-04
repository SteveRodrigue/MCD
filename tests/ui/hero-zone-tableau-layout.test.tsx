import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';
import { HeroZone } from '../../src/ui/components/board/HeroZone';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { setupGame, createCardInstance } from '../../src/engine/state/game-setup';
import { HeroCard, AlterEgoCard, AllyCard } from '../../src/engine/models';

vi.mock('../../src/ui/hooks/useCardArt', () => ({
  useCardArt: vi.fn().mockReturnValue({
    artUrl: 'https://cdn.example.com/test.jpg',
    loading: false,
    error: null,
  }),
}));

describe('HeroZone Nested Allies & 2-Tier Tableau Architecture (Issue #156)', () => {
  const spiderManHero = cardCatalog.getCard('01001a') as HeroCard;
  const peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;

  function createTestGame() {
    return setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      skipMulligan: true,
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Renders Hero & Allies in a unified top-row container (hero-allies-roster)', () => {
    const gameState = createTestGame();
    const player = gameState.players[0];

    render(
      <HeroZone
        player={player}
        gameState={gameState}
        seatNumber={1}
        isFocused={true}
        isMultiHero={false}
      />,
    );

    const rosterContainer = screen.getByTestId('hero-allies-roster');
    expect(rosterContainer).toBeDefined();

    // Identity station and nested allies must be nested inside hero-allies-roster
    const identityStation = screen.getByTestId('identity-station');
    const nestedAllies = screen.getByTestId('nested-allies-section');

    expect(rosterContainer.contains(identityStation)).toBe(true);
    expect(rosterContainer.contains(nestedAllies)).toBe(true);
  });

  it('2. Renders Tableau (Upgrades & Supports) in a separate second-tier container (tableau-section)', () => {
    const gameState = createTestGame();
    const player = gameState.players[0];

    render(
      <HeroZone
        player={player}
        gameState={gameState}
        seatNumber={1}
        isFocused={true}
        isMultiHero={false}
      />,
    );

    const rosterContainer = screen.getByTestId('hero-allies-roster');
    const tableauSection = screen.getByTestId('tableau-section');

    expect(tableauSection).toBeDefined();
    // Tableau must NOT be nested inside the hero-allies-roster
    expect(rosterContainer.contains(tableauSection)).toBe(false);
  });

  it('3. Renders empty ally state when 0 allies are in play', () => {
    const gameState = createTestGame();
    const player = gameState.players[0];
    player.allies = [];

    render(
      <HeroZone
        player={player}
        gameState={gameState}
        seatNumber={1}
        isFocused={true}
        isMultiHero={false}
      />,
    );

    const nestedAllies = screen.getByTestId('nested-allies-section');
    expect(nestedAllies.textContent).toContain('No allies in play');
    expect(nestedAllies.textContent).toContain('Allies in Play (0 / 3)');
  });

  it('4. Renders allies inside nested-allies-section when allies are in play', () => {
    const gameState = createTestGame();
    const player = gameState.players[0];

    const blackCatCard = cardCatalog.getCard('01002') as AllyCard;
    const daredevilCard = cardCatalog.getCard('01011') as AllyCard;

    player.allies = [createCardInstance(blackCatCard), createCardInstance(daredevilCard)];

    render(
      <HeroZone
        player={player}
        gameState={gameState}
        seatNumber={1}
        isFocused={true}
        isMultiHero={false}
      />,
    );

    const nestedAllies = screen.getByTestId('nested-allies-section');
    expect(nestedAllies.textContent).toContain('Allies in Play (2 / 3)');
    expect(within(nestedAllies).getByAltText('Black Cat')).toBeDefined();
    expect(within(nestedAllies).getByAltText('Spider-Woman')).toBeDefined();
  });

  it('5. Renders tableau cards and action buttons in tableau-section', () => {
    const gameState = createTestGame();
    const player = gameState.players[0];

    const webShooter = createCardInstance(cardCatalog.getCard('01008')!);
    webShooter.tokens = { damage: 0, threat: 0, counters: 3 };
    player.tableau = [webShooter];

    render(
      <HeroZone
        player={player}
        gameState={gameState}
        seatNumber={1}
        isFocused={true}
        isMultiHero={false}
      />,
    );

    const tableauSection = screen.getByTestId('tableau-section');
    expect(tableauSection.textContent).toContain('Tableau: Upgrades & Supports (1)');
    expect(within(tableauSection).getByAltText('Web-Shooter')).toBeDefined();
  });

  it('6. Ally action button is clickable and opens Attack Target Modal', () => {
    const gameState = createTestGame();
    const player = gameState.players[0];
    const onDispatchAction = vi.fn();

    const blackCatCard = cardCatalog.getCard('01002') as AllyCard;
    const catInst = createCardInstance(blackCatCard);
    player.allies = [catInst];

    render(
      <HeroZone
        player={player}
        gameState={gameState}
        seatNumber={1}
        isFocused={true}
        isMultiHero={false}
        onDispatchAction={onDispatchAction}
      />,
    );

    const nestedAllies = screen.getByTestId('nested-allies-section');
    const attackBtn = within(nestedAllies).getByTitle(/Attack for/);
    expect(attackBtn).toBeDefined();
    act(() => {
      attackBtn.click();
    });
    expect(screen.getByText(/Ally Strike/i)).toBeDefined();
  });

  it('7. Tableau card action button triggers ability dispatch', () => {
    const gameState = createTestGame();
    const player = gameState.players[0];
    const onDispatchAction = vi.fn();

    // Use Avengers Mansion (01091) which is legal in both forms
    const mansion = createCardInstance(cardCatalog.getCard('01091')!);
    player.tableau = [mansion];

    render(
      <HeroZone
        player={player}
        gameState={gameState}
        seatNumber={1}
        isFocused={true}
        isMultiHero={false}
        onDispatchAction={onDispatchAction}
      />,
    );

    const tableauSection = screen.getByTestId('tableau-section');
    const useBtn = within(tableauSection).getByText(/USE/);
    expect(useBtn).toBeDefined();
    useBtn.click();
    expect(onDispatchAction).toHaveBeenCalledTimes(1);
    expect(onDispatchAction.mock.calls[0][0].type).toBe('USE_CARD_ABILITY');
  });

  it.each(['hero', 'alter_ego'] as const)(
    '8b. Stat and HP columns stack above the rotated exhausted identity card in %s form (#161)',
    (form) => {
      const gameState = createTestGame();
      const player = gameState.players[0];
      player.currentForm = form;
      player.activeFormCard = form === 'hero' ? player.hero : player.alterEgo;
      player.exhausted = true;

      render(
        <HeroZone
          player={player}
          gameState={gameState}
          seatNumber={1}
          isFocused={true}
          isMultiHero={false}
          onDispatchAction={vi.fn()}
        />,
      );

      const identityStation = screen.getByTestId('identity-station');
      for (const testId of ['identity-stats-column', 'identity-hp-column']) {
        const column = within(identityStation).getByTestId(testId);
        expect(column.className).toContain('relative');
        expect(column.className).toContain('z-10');
      }
    },
  );

  it('8. Renders Identity Station in compact tri-column layout with Hero stats, CardView, vertical HP gauge, and single-row action buttons', () => {
    const gameState = createTestGame();
    const player = gameState.players[0];
    player.currentForm = 'hero';
    player.activeFormCard = player.hero;
    const onDispatchAction = vi.fn();

    render(
      <HeroZone
        player={player}
        gameState={gameState}
        seatNumber={1}
        isFocused={true}
        isMultiHero={false}
        onDispatchAction={onDispatchAction}
      />,
    );

    const identityStation = screen.getByTestId('identity-station');
    expect(identityStation).toBeDefined();

    // 1. Stats column in Hero form (THW, ATK, DEF, HS)
    const statsColumn = within(identityStation).getByTestId('identity-stats-column');
    expect(statsColumn).toBeDefined();
    expect(statsColumn.textContent).toContain('THW');
    expect(statsColumn.textContent).toContain('ATK');
    expect(statsColumn.textContent).toContain('DEF');
    expect(statsColumn.textContent).toContain('HS');
    const defPill = within(statsColumn).getByText('DEF').closest('div');
    expect(defPill?.className).toContain('bg-emerald-50');
    const hsPill = within(statsColumn).getByText('HS').closest('div');
    expect(hsPill?.className).toContain('bg-slate-100');

    // 2. CardView in Center column
    expect(within(identityStation).getByAltText('Spider-Man')).toBeDefined();

    // 3. Vertical HP gauge in Right column
    const hpColumn = within(identityStation).getByTestId('identity-hp-column');
    expect(hpColumn).toBeDefined();
    const progressBar = within(hpColumn).getByRole('progressbar');
    expect(progressBar).toBeDefined();
    expect(progressBar.getAttribute('aria-valuenow')).toBe(String(player.health));
    expect(progressBar.getAttribute('aria-valuemax')).toBe(String(player.maxHealth));

    // 4. Single-row Action Buttons in Hero form (Flip, Attack, Thwart)
    const actionRow = within(identityStation).getByTestId('identity-action-row');
    expect(actionRow).toBeDefined();
    expect(within(actionRow).getByText(/Flip/i)).toBeDefined();
    expect(within(actionRow).getByText(/Attack/i)).toBeDefined();
    expect(within(actionRow).getByText(/Thwart/i)).toBeDefined();
  });

  it('9. Renders Identity Station in compact tri-column layout for Alter-Ego with REC, HS, vertical HP gauge, and single-row buttons (Suit Up, Recover)', () => {
    const gameState = createTestGame();
    const player = gameState.players[0];
    player.currentForm = 'alter_ego';
    player.activeFormCard = player.alterEgo;
    const onDispatchAction = vi.fn();

    render(
      <HeroZone
        player={player}
        gameState={gameState}
        seatNumber={1}
        isFocused={true}
        isMultiHero={false}
        onDispatchAction={onDispatchAction}
      />,
    );

    const identityStation = screen.getByTestId('identity-station');
    expect(identityStation).toBeDefined();

    // 1. Stats column in Alter-Ego form (REC, HS)
    const statsColumn = within(identityStation).getByTestId('identity-stats-column');
    expect(statsColumn).toBeDefined();
    expect(statsColumn.textContent).toContain('REC');
    expect(statsColumn.textContent).toContain('HS');
    expect(statsColumn.textContent).not.toContain('THW');
    const recPill = within(statsColumn).getByText('REC').closest('div');
    expect(recPill?.className).toContain('bg-amber-50');
    const hsPill = within(statsColumn).getByText('HS').closest('div');
    expect(hsPill?.className).toContain('bg-slate-100');

    // 2. CardView in Center column
    expect(within(identityStation).getByAltText('Peter Parker')).toBeDefined();

    // 3. Vertical HP gauge in Right column
    const hpColumn = within(identityStation).getByTestId('identity-hp-column');
    expect(hpColumn).toBeDefined();
    const progressBar = within(hpColumn).getByRole('progressbar');
    expect(progressBar).toBeDefined();
    expect(progressBar.getAttribute('aria-valuenow')).toBe(String(player.health));
    expect(progressBar.getAttribute('aria-valuemax')).toBe(String(player.maxHealth));

    // 4. Single-row Action Buttons in Alter-Ego form (Suit Up, Recover)
    const actionRow = within(identityStation).getByTestId('identity-action-row');
    expect(actionRow).toBeDefined();
    expect(within(actionRow).getByText(/Suit Up/i)).toBeDefined();
    expect(within(actionRow).getByText(/Recover/i)).toBeDefined();
  });
});
