import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GamePhase, GameState, HeroCard, AlterEgoCard } from '../../src/engine/models';
import { setupGame } from '../../src/engine/state/game-setup';
import { TopBar } from '../../src/ui/components/board/TopBar';
import { DailyBugleActionNewspaper } from '../../src/ui/components/board/DailyBugleActionNewspaper';
import { LegalActionReport } from '../../src/engine/pipeline/legal-actions-generator';
import { GameSettingsProvider } from '../../src/ui/context/GameSettingsProvider';
import { TestSession } from '../support/render-with-session';

vi.mock('../../src/ui/hooks/useCardArt', () => ({
  useCardArt: vi.fn().mockReturnValue({
    artUrl: 'https://cdn.example.com/test.jpg',
    loading: false,
    error: null,
  }),
}));

describe('Daily Bugle & TopBar Call for Action & Villain Actions UI (Issue #314)', () => {
  let state: GameState;
  let spiderManHero: HeroCard;
  let peterParkerAlterEgo: AlterEgoCard;
  let ironManHero: HeroCard;
  let tonyStarkAlterEgo: AlterEgoCard;

  beforeEach(() => {
    spiderManHero = cardCatalog.getCard('01001a') as HeroCard;
    peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;
    ironManHero = cardCatalog.getCard('01029a') as HeroCard;
    tonyStarkAlterEgo = cardCatalog.getCard('01029b') as AlterEgoCard;

    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Peter Parker',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(15).fill(cardCatalog.getCard('01005')!),
        },
        {
          id: 'p2',
          name: 'Tony Stark',
          hero: ironManHero,
          alterEgo: tonyStarkAlterEgo,
          deckCards: Array(15).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    state.phase = GamePhase.PLAYER_PHASE;
    state.activePlayerIndex = 0;
  });

  it('1. TopBar does not render "CALL FOR ACTION!" button (moved to GameBoard hover pill)', () => {
    const onOpenNewspaper = vi.fn();

    render(
      <GameSettingsProvider>
        <TestSession state={state}>
          <TopBar
            activeSeatIndex={0}
            legalActionCount={3}
            onSelectSeat={vi.fn()}
            onToggleLog={vi.fn()}
            isLogOpen={false}
            onReset={vi.fn()}
            onOpenNewspaper={onOpenNewspaper}
          />
        </TestSession>
      </GameSettingsProvider>,
    );

    const callBtn = screen.queryByRole('button', { name: /call for action/i });
    expect(callBtn).toBeNull();
  });

  it('2. TopBar keeps clean without separate villain action button (bundled into EXTRA! hover button)', () => {
    const onOpenNewspaper = vi.fn();

    render(
      <GameSettingsProvider>
        <TestSession state={state}>
          <TopBar
            activeSeatIndex={0}
            legalActionCount={3}
            onSelectSeat={vi.fn()}
            onToggleLog={vi.fn()}
            isLogOpen={false}
            onReset={vi.fn()}
            onOpenNewspaper={onOpenNewspaper}
          />
        </TestSession>
      </GameSettingsProvider>,
    );

    const villainBtn = screen.queryByRole('button', { name: /villain actions/i });
    expect(villainBtn).toBeNull();
  });

  it('3. Daily Bugle displays distinct sections including Villain Dispatches and Call for Action', () => {
    const mockReport: LegalActionReport = {
      playerId: 'p1',
      playerName: 'Spider-Man',
      isPlayerTurn: true,
      activeActionCount: 4,
      callForActionCount: 1,
      villainActionCount: 1,
      identityActions: [
        {
          id: 'action_basic_atk',
          category: 'identity',
          headline: 'Basic Attack (Hero)',
          subtext: 'Attack enemy',
          action: { type: 'BASIC_ATTACK', playerId: 'p1', targetType: 'villain' },
          badge: '2 ATK',
        },
      ],
      handCardActions: [
        {
          id: 'action_play_card',
          category: 'hand',
          headline: 'Play Web-Shooter',
          subtext: 'Put into play',
          action: {
            type: 'PLAY_CARD',
            playerId: 'p1',
            cardInstanceId: 'c1',
            paymentCardInstanceIds: [],
          },
          badge: '1 RESOURCE',
        },
      ],
      boardActions: [
        {
          id: 'action_ally_atk',
          category: 'board',
          headline: 'Ally Attack: Daredevil',
          subtext: 'Exhaust Daredevil to attack',
          action: {
            type: 'ALLY_ATTACK',
            playerId: 'p1',
            allyInstanceId: 'a1',
            targetType: 'villain',
          },
          badge: '2 ATK',
        },
      ],
      villainActionItems: [
        {
          id: 'action_attachment_ivory_horn',
          category: 'villain',
          headline: 'Discard: Ivory Horn',
          subtext: 'Spend 3 physical resources to discard Ivory Horn from Rhino',
          action: {
            type: 'USE_CARD_ABILITY',
            playerId: 'p1',
            cardInstanceId: 'horn_1',
            abilityId: 'ivory_horn_discard_action',
          },
          badge: '3 PHYSICAL',
          requiresModal: 'payment',
        },
      ],
      callForActionItems: [
        {
          id: 'action_call_mansion',
          category: 'call_for_action',
          headline: 'Activate Avengers Mansion',
          subtext: 'Draw 1 card',
          ownerName: 'Tony Stark',
          action: {
            type: 'USE_CARD_ABILITY',
            playerId: 'p2',
            cardInstanceId: 'mansion_1',
            abilityId: 'mansion_ab',
          },
          badge: 'ACTION',
        },
      ],
      allActions: [],
    };

    const onSelectAction = vi.fn();
    const onClose = vi.fn();

    render(
      <DailyBugleActionNewspaper
        report={mockReport}
        isOpen={true}
        onClose={onClose}
        onSelectAction={onSelectAction}
      />,
    );

    // Section 1: Front Page
    expect(screen.getByText(/FRONT PAGE: IDENTITY DIRECTIVES/i)).toBeDefined();
    // Section 2: Hand Cards
    expect(screen.getByText(/LATEST DISPATCHES: PLAYABLE HAND CARDS/i)).toBeDefined();
    // Section 3: Classifieds
    expect(screen.getByText(/THE CLASSIFIEDS: IN-PLAY ASSETS & ALLIES/i)).toBeDefined();
    // Section 4: Villain Dispatches
    expect(screen.getByText(/VILLAIN DISPATCHES: ENCOUNTER & SCHEME ACTIONS/i)).toBeDefined();
    // Section 5: Call for Action in dedicated 3rd column container
    const cfaCol = screen.getByTestId('daily-bugle-call-for-action-column');
    expect(cfaCol).toBeDefined();
    expect(cfaCol.textContent).toContain('CALL FOR ACTION: TEAM TABLEAU ASSETS');

    // Teammate header must be shown
    expect(screen.getByText('TONY STARK')).toBeDefined();

    // Clicking Discard / Pay on encounter action dispatches action
    const discardBtn = screen.getByRole('button', { name: /Discard: Ivory Horn/i });
    expect(discardBtn).toBeDefined();
    fireEvent.click(discardBtn);

    expect(onSelectAction).toHaveBeenCalledWith(mockReport.villainActionItems[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it('4. Daily Bugle displays teammate identity actions (e.g. Carol Danvers Commander) in CALL FOR ACTION and allows triggering', () => {
    const mockReport: LegalActionReport = {
      playerId: 'p1',
      playerName: 'Spider-Man',
      isPlayerTurn: true,
      activeActionCount: 1,
      callForActionCount: 1,
      villainActionCount: 0,
      identityActions: [],
      handCardActions: [],
      boardActions: [],
      villainActionItems: [],
      callForActionItems: [
        {
          id: 'action_call_id_p2_commander',
          category: 'call_for_action',
          headline: 'Carol Danvers: COMMANDER',
          subtext: 'Choose a player to draw 1 card.',
          ownerName: 'Carol Danvers',
          action: {
            type: 'USE_CARD_ABILITY',
            playerId: 'p2',
            cardInstanceId: '01010b',
            abilityId: 'commander',
          },
          badge: 'ACTION',
          cardCode: '01010b',
        },
      ],
      allActions: [],
    };

    const onSelectAction = vi.fn();
    const onClose = vi.fn();

    render(
      <DailyBugleActionNewspaper
        report={mockReport}
        isOpen={true}
        onClose={onClose}
        onSelectAction={onSelectAction}
      />,
    );

    // Call for Action section should be displayed in dedicated column container
    const cfaCol = screen.getByTestId('daily-bugle-call-for-action-column');
    expect(cfaCol).toBeDefined();
    expect(cfaCol.textContent).toContain('CALL FOR ACTION: TEAM TABLEAU ASSETS');

    // Teammate header and headline
    expect(screen.getByText('CAROL DANVERS')).toBeDefined();
    expect(screen.getByText('Carol Danvers: COMMANDER')).toBeDefined();

    // Clicking the item triggers onSelectAction and closes modal
    const actionBtn = screen.getByRole('button', {
      name: /Carol Danvers: COMMANDER/i,
    });
    expect(actionBtn).toBeDefined();
    fireEvent.click(actionBtn);

    expect(onSelectAction).toHaveBeenCalledWith(mockReport.callForActionItems[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it('5. Dynamic column distribution: when active player has Identity + Hand cards and no board/villain actions, Col 1 has Identity and Col 2 has Hand cards', () => {
    const mockReport: LegalActionReport = {
      playerId: 'p1',
      playerName: 'Spider-Man',
      isPlayerTurn: true,
      activeActionCount: 2,
      callForActionCount: 0,
      villainActionCount: 0,
      identityActions: [
        {
          id: 'action_basic_atk',
          category: 'identity',
          headline: 'Basic Attack (Hero)',
          subtext: 'Attack enemy',
          action: { type: 'BASIC_ATTACK', playerId: 'p1', targetType: 'villain' },
          badge: '2 ATK',
        },
      ],
      handCardActions: [
        {
          id: 'action_play_card',
          category: 'hand',
          headline: 'Play Web-Shooter',
          subtext: 'Put into play',
          action: {
            type: 'PLAY_CARD',
            playerId: 'p1',
            cardInstanceId: 'c1',
            paymentCardInstanceIds: [],
          },
          badge: '1 RESOURCE',
        },
      ],
      boardActions: [],
      villainActionItems: [],
      callForActionItems: [],
      allActions: [],
    };

    render(
      <DailyBugleActionNewspaper
        report={mockReport}
        isOpen={true}
        onClose={vi.fn()}
        onSelectAction={vi.fn()}
      />,
    );

    // Verify grid layout uses 2 columns
    const grid = screen.getByTestId('daily-bugle-grid');
    expect(grid).toBeDefined();
    expect(grid.className).toContain('lg:grid-cols-2');
    expect(grid.children.length).toBe(2);

    // Col 1 should have identity directives and NOT playable hand cards
    const col1 = grid?.children[0];
    expect(col1?.textContent).toContain('FRONT PAGE: IDENTITY DIRECTIVES');
    expect(col1?.textContent).not.toContain('LATEST DISPATCHES: PLAYABLE HAND CARDS');

    // Col 2 should have playable hand cards and NOT identity directives
    const col2 = grid?.children[1];
    expect(col2?.textContent).toContain('LATEST DISPATCHES: PLAYABLE HAND CARDS');
    expect(col2?.textContent).not.toContain('FRONT PAGE: IDENTITY DIRECTIVES');
  });

  it('6. Teammate grouping with header CAPTAIN MARVEL (Hero Seat 2) and compact card layout', () => {
    const mockReport: LegalActionReport = {
      playerId: 'p1',
      playerName: 'Spider-Man',
      isPlayerTurn: true,
      activeActionCount: 1,
      callForActionCount: 2,
      villainActionCount: 0,
      identityActions: [
        {
          id: 'action_basic_atk',
          category: 'identity',
          headline: 'Basic Attack (Hero)',
          subtext: 'Attack enemy',
          action: { type: 'BASIC_ATTACK', playerId: 'p1', targetType: 'villain' },
          badge: '2 ATK',
        },
      ],
      handCardActions: [],
      boardActions: [],
      villainActionItems: [],
      callForActionItems: [
        {
          id: 'action_call_mansion',
          category: 'call_for_action',
          headline: 'Avengers Mansion',
          subtext: 'Draw 1 card',
          ownerName: 'Hero Seat 2 (Captain Marvel)',
          action: {
            type: 'USE_CARD_ABILITY',
            playerId: 'p2',
            cardInstanceId: 'mansion_1',
            abilityId: 'mansion_ab',
          },
          badge: 'ACTION',
        },
        {
          id: 'action_call_alpha_flight',
          category: 'call_for_action',
          headline: 'Alpha Flight Station',
          subtext: 'Shuffle card into deck',
          ownerName: 'Hero Seat 2 (Captain Marvel)',
          action: {
            type: 'USE_CARD_ABILITY',
            playerId: 'p2',
            cardInstanceId: 'afs_1',
            abilityId: 'afs_ab',
          },
          badge: 'ACTION',
        },
      ],
      allActions: [],
    };

    render(
      <DailyBugleActionNewspaper
        report={mockReport}
        isOpen={true}
        onClose={vi.fn()}
        onSelectAction={vi.fn()}
      />,
    );

    // Formatted teammate header
    expect(screen.getByText('CAPTAIN MARVEL (Hero Seat 2)')).toBeDefined();
    expect(screen.getByText('2 ACTIONS')).toBeDefined();

    // Verify both cards are present under that group
    expect(screen.getByText('Avengers Mansion')).toBeDefined();
    expect(screen.getByText('Alpha Flight Station')).toBeDefined();
    expect(screen.getAllByText('Ask Teammate ➔').length).toBe(2);
  });

  it('8. Call for Action dispatches render full card.text via FormattedCardText without truncation', () => {
    const mockReport: LegalActionReport = {
      playerId: 'p1',
      playerName: 'Spider-Man',
      isPlayerTurn: true,
      activeActionCount: 0,
      callForActionCount: 1,
      villainActionCount: 0,
      identityActions: [],
      handCardActions: [],
      boardActions: [],
      villainActionItems: [],
      callForActionItems: [
        {
          id: 'action_call_mansion',
          category: 'call_for_action',
          headline: 'Avengers Mansion',
          subtext: 'Draw 1 card fallback',
          ownerName: 'Tony Stark',
          action: {
            type: 'USE_CARD_ABILITY',
            playerId: 'p2',
            cardInstanceId: 'mansion_1',
            abilityId: 'mansion_ab',
          },
          badge: 'ACTION',
          targetCardInstance: {
            instanceId: 'mansion_1',
            card: {
              id: '01091',
              code: '01091',
              name: 'Avengers Mansion',
              type: 'support',
              text: '<b>Action</b>: Exhaust Avengers Mansion -> choose a player. That player draws 1 card.',
            } as any,
          } as any,
        },
      ],
      allActions: [],
    };

    render(
      <DailyBugleActionNewspaper
        report={mockReport}
        isOpen={true}
        onClose={vi.fn()}
        onSelectAction={vi.fn()}
      />,
    );

    // FormattedCardText converts <b>Action</b> and arrow into HTML/formatted elements
    expect(
      screen.getByText(/Exhaust Avengers Mansion -> choose a player\. That player draws 1 card\./i),
    ).toBeDefined();
  });

  it('9. Daily Bugle container dynamically adapts width based on column count (max-w-xl, max-w-4xl, max-w-6xl)', () => {
    // Test 1: 1 column (only Call for Action) -> max-w-xl
    const oneColReport: LegalActionReport = {
      playerId: 'p1',
      playerName: 'Spider-Man',
      isPlayerTurn: true,
      activeActionCount: 0,
      callForActionCount: 1,
      villainActionCount: 0,
      identityActions: [],
      handCardActions: [],
      boardActions: [],
      villainActionItems: [],
      callForActionItems: [
        {
          id: 'cfa_1',
          category: 'call_for_action',
          headline: 'Avengers Mansion',
          subtext: 'Draw 1 card',
          action: { type: 'USE_CARD_ABILITY', playerId: 'p2' } as any,
        },
      ],
      allActions: [],
    };

    const { rerender } = render(
      <DailyBugleActionNewspaper
        report={oneColReport}
        isOpen={true}
        onClose={vi.fn()}
        onSelectAction={vi.fn()}
      />,
    );

    const broadsheet1 = screen.getByTestId('daily-bugle-container');
    expect(broadsheet1.className).toContain('max-w-xl');
    expect(broadsheet1.className).not.toContain('max-w-4xl');
    expect(broadsheet1.className).not.toContain('max-w-6xl');

    // Test 2: 2 columns (e.g. Identity + Call for Action) -> max-w-4xl
    const twoColReport: LegalActionReport = {
      ...oneColReport,
      activeActionCount: 1,
      identityActions: [
        {
          id: 'id_1',
          category: 'identity',
          headline: 'Basic Attack',
          subtext: 'Attack villain',
          action: { type: 'BASIC_ATTACK', playerId: 'p1' } as any,
        },
      ],
    };

    rerender(
      <DailyBugleActionNewspaper
        report={twoColReport}
        isOpen={true}
        onClose={vi.fn()}
        onSelectAction={vi.fn()}
      />,
    );

    const broadsheet2 = screen.getByTestId('daily-bugle-container');
    expect(broadsheet2.className).toContain('max-w-4xl');
    expect(broadsheet2.className).not.toContain('max-w-6xl');

    // Test 3: 3 columns (Identity + Board/Villain + Call for Action) -> max-w-6xl
    const threeColReport: LegalActionReport = {
      ...twoColReport,
      activeActionCount: 2,
      boardActions: [
        {
          id: 'board_1',
          category: 'board',
          headline: 'Daredevil',
          subtext: 'Ally attack',
          action: { type: 'ALLY_ATTACK', playerId: 'p1' } as any,
        },
      ],
    };

    rerender(
      <DailyBugleActionNewspaper
        report={threeColReport}
        isOpen={true}
        onClose={vi.fn()}
        onSelectAction={vi.fn()}
      />,
    );

    const broadsheet3 = screen.getByTestId('daily-bugle-container');
    expect(broadsheet3.className).toContain('max-w-6xl');
  });
});
