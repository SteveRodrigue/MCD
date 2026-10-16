import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GamePhase, GameState, HeroCard, AlterEgoCard } from '../../src/engine/models';
import { setupGame } from '../../src/engine/state/game-setup';
import { TopBar } from '../../src/ui/components/board/TopBar';
import { DailyBugleActionNewspaper } from '../../src/ui/components/board/DailyBugleActionNewspaper';
import { LegalActionReport } from '../../src/engine/pipeline/legal-actions-generator';
import { GameSettingsProvider } from '../../src/ui/context/GameSettingsProvider';

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

  it('1. TopBar renders "CALL FOR ACTION! [N]" button when multiplayer game has available teammate actions', () => {
    const onOpenNewspaper = vi.fn();

    render(
      <GameSettingsProvider>
        <TopBar
          gameState={state}
          activeSeatIndex={0}
          legalActionCount={3}
          callForActionCount={2}
          villainActionCount={0}
          onSelectSeat={vi.fn()}
          onToggleLog={vi.fn()}
          isLogOpen={false}
          onReset={vi.fn()}
          onOpenNewspaper={onOpenNewspaper}
        />
      </GameSettingsProvider>,
    );

    const callBtn = screen.getByRole('button', { name: /call for action/i });
    expect(callBtn).toBeDefined();
    expect(callBtn.textContent).toContain('2');

    fireEvent.click(callBtn);
    expect(onOpenNewspaper).toHaveBeenCalled();
  });

  it('2. TopBar renders "VILLAIN ACTIONS! [N]" button when encounter actions are available', () => {
    const onOpenNewspaper = vi.fn();

    render(
      <GameSettingsProvider>
        <TopBar
          gameState={state}
          activeSeatIndex={0}
          legalActionCount={3}
          callForActionCount={0}
          villainActionCount={1}
          onSelectSeat={vi.fn()}
          onToggleLog={vi.fn()}
          isLogOpen={false}
          onReset={vi.fn()}
          onOpenNewspaper={onOpenNewspaper}
        />
      </GameSettingsProvider>,
    );

    const villainBtn = screen.getByRole('button', { name: /villain actions/i });
    expect(villainBtn).toBeDefined();
    expect(villainBtn.textContent).toContain('1');

    fireEvent.click(villainBtn);
    expect(onOpenNewspaper).toHaveBeenCalled();
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
    // Section 5: Call for Action
    expect(screen.getByText(/CALL FOR ACTION: TEAM TABLEAU ASSETS/i)).toBeDefined();

    // Teammate owner name badge must be shown
    expect(screen.getByText('Tony Stark')).toBeDefined();

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
          headline: 'Ask Carol Danvers: Carol Danvers (ACTION)',
          subtext: 'Choose a player to draw 1 card.',
          ownerName: 'Carol Danvers',
          action: {
            type: 'USE_CARD_ABILITY',
            playerId: 'p2',
            cardInstanceId: '01010b',
            abilityId: 'commander',
          },
          badge: 'CAROL DANVERS • ACTION',
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

    // Call for Action section should be displayed
    expect(screen.getByText(/CALL FOR ACTION: TEAM TABLEAU ASSETS/i)).toBeDefined();

    // Owner name badge and headline
    expect(screen.getByText('Carol Danvers')).toBeDefined();
    expect(screen.getByText(/Ask Carol Danvers: Carol Danvers \(ACTION\)/i)).toBeDefined();

    // Clicking the item triggers onSelectAction and closes modal
    const actionBtn = screen.getByRole('button', {
      name: /Ask Carol Danvers: Carol Danvers \(ACTION\)/i,
    });
    expect(actionBtn).toBeDefined();
    fireEvent.click(actionBtn);

    expect(onSelectAction).toHaveBeenCalledWith(mockReport.callForActionItems[0]);
    expect(onClose).toHaveBeenCalled();
  });
});
