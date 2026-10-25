import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { VillainZone } from '../../src/ui/components/board/VillainZone';
import { GameSettingsProvider } from '../../src/ui/context/GameSettingsProvider';
import { cardCatalog } from '../../src/data/importer/card-loader';
import {
  SideSchemeState,
  VillainState,
  MainSchemeState,
  VillainCard,
  MainSchemeCard,
  SideSchemeCard,
  StatusCard,
  CardInstance,
  CardType,
} from '../../src/engine/models';

vi.mock('../../src/ui/hooks/useCardArt', () => ({
  useCardArt: vi.fn().mockReturnValue({
    artUrl: 'https://cdn.example.com/test.jpg',
    loading: false,
    error: null,
  }),
}));

describe('VillainZone Compact Tri-Column Layout', () => {
  const villainCard = cardCatalog.getCard('01094') as VillainCard; // Rhino Stage I (SCH 1, ATK 2, HP 14)
  const mainSchemeCard = cardCatalog.getCard('01097b') as MainSchemeCard;
  const sideSchemeCard = cardCatalog.getCard('01107') as SideSchemeCard;

  const createMockVillain = (overrides: Partial<VillainState> = {}): VillainState => ({
    card: villainCard,
    health: 14,
    maxHealth: 14,
    exhausted: false,
    statusCards: [],
    attachments: [],
    ...overrides,
  });

  const mockMainScheme: MainSchemeState = {
    card: mainSchemeCard,
    stage: '1',
    threat: 3,
    targetThreat: 7,
  };

  const mockSideSchemes: SideSchemeState[] = [
    {
      instanceId: 'scheme-inst-1',
      card: sideSchemeCard,
      threat: 2,
    },
  ];

  function renderVillainZone(
    villain: VillainState = createMockVillain(),
    sideSchemes: SideSchemeState[] = mockSideSchemes,
    outOfPlayEmpty = false,
  ) {
    return render(
      <GameSettingsProvider>
        <VillainZone
          villain={villain}
          mainScheme={mockMainScheme}
          sideSchemes={sideSchemes}
          outOfPlayEmpty={outOfPlayEmpty}
          encounterDeck={[]}
          encounterDiscard={[]}
          accelerationTokens={0}
        />
      </GameSettingsProvider>,
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('empty side schemes and out-of-play badges (Issue #379)', () => {
    it('puts the side-scheme panel right after the main scheme, in the same row', () => {
      renderVillainZone();
      const panel = screen.getByTestId('side-schemes-panel');
      const row = screen.getByTestId('villain-main-panel').parentElement;
      expect(panel.parentElement).toBe(row);
      expect(panel.previousElementSibling?.textContent).toContain(mainSchemeCard.name);
      expect(screen.queryByTestId('empty-zone-badge-side-schemes')).toBeNull();
    });

    it('draws no panel without a side scheme, and badges the count in the header', () => {
      renderVillainZone(createMockVillain(), []);
      expect(screen.queryByTestId('side-schemes-panel')).toBeNull();
      expect(screen.queryByText(/No side schemes active/)).toBeNull();
      const header = screen.getByTestId('villain-zone');
      expect(within(header).getByTestId('empty-zone-badge-side-schemes').textContent).toMatch(
        /side schemes 0/i,
      );
    });

    it('badges Out of Play only when the board has no box for it', () => {
      const { unmount } = renderVillainZone(createMockVillain(), mockSideSchemes, true);
      expect(screen.getByTestId('empty-zone-badge-out-of-play').textContent).toMatch(
        /out of play 0/i,
      );
      unmount();
      renderVillainZone(createMockVillain(), mockSideSchemes, false);
      expect(screen.queryByTestId('empty-zone-badge-out-of-play')).toBeNull();
    });
  });

  it('renders tri-column structure with stats column, card, and vertical HP column', () => {
    renderVillainZone();

    // 1. Stats Column
    const statsColumn = screen.getByTestId('villain-stats-column');
    expect(statsColumn).toBeDefined();

    // 2. Center Card
    expect(screen.getByAltText(villainCard.name)).toBeDefined();

    // 3. HP Column
    const hpColumn = screen.getByTestId('villain-hp-column');
    expect(hpColumn).toBeDefined();
  });

  it('renders SCH and ATK stat pills with base values', () => {
    renderVillainZone();

    const statsColumn = screen.getByTestId('villain-stats-column');
    expect(statsColumn.textContent).toContain('SCH');
    expect(statsColumn.textContent).toContain(String(villainCard.scheme));
    expect(statsColumn.textContent).toContain('ATK');
    expect(statsColumn.textContent).toContain(String(villainCard.attack));
    expect(statsColumn.textContent).not.toContain('+');
  });

  it('renders SCH and ATK stat pills with buffed bonus values when attachments are present', () => {
    const ivoryHornCard = cardCatalog.getCard('01100')!; // +1 ATK attachment
    const mockHornAttachment: CardInstance = {
      instanceId: 'att-horn',
      card: ivoryHornCard,
      exhausted: false,
    };

    const mockSchemeAttachment: CardInstance = {
      instanceId: 'att-scheme',
      card: {
        ...villainCard,
        code: 'mock-scheme-att',
        name: 'Scheme Buff Attachment',
        type: CardType.ATTACHMENT,
        enrichment: {
          abilities: [
            {
              id: 'buff_sch',
              timing: 'CONSTANT',
              steps: [
                {
                  effect: 'MODIFY_STAT',
                  effectParams: {
                    stat: 'SCHEME',
                    amount: 2,
                  },
                },
              ],
            },
          ],
        },
      } as any,
      exhausted: false,
    };

    const buffedVillain = createMockVillain({
      attachments: [mockHornAttachment, mockSchemeAttachment],
    });

    renderVillainZone(buffedVillain);

    const statsColumn = screen.getByTestId('villain-stats-column');
    // Base SCH (1) + 2 = 3 (+2)
    expect(statsColumn.textContent).toContain('SCH');
    expect(statsColumn.textContent).toContain('3');
    expect(statsColumn.textContent).toContain('+2');

    // Base ATK (2) + 1 = 3 (+1)
    expect(statsColumn.textContent).toContain('ATK');
    expect(statsColumn.textContent).toContain('3');
    expect(statsColumn.textContent).toContain('+1');
  });

  it('renders vertical HP meter with progressbar role and correct accessibility attributes', () => {
    const villain = createMockVillain({ health: 10, maxHealth: 14 });
    renderVillainZone(villain);

    const hpColumn = screen.getByTestId('villain-hp-column');
    // Heart at the top, health number as the bottom label (no redundant "HP" text)
    expect(hpColumn.firstElementChild!.querySelector('svg')).not.toBeNull();
    expect(hpColumn.firstElementChild!.textContent).toBe('');
    expect(hpColumn.lastElementChild!.textContent).toBe('10/14');
    expect(hpColumn.textContent).not.toContain('HP');

    const progressBar = within(hpColumn).getByRole('progressbar');
    expect(progressBar).toBeDefined();
    expect(progressBar.getAttribute('aria-valuenow')).toBe('10');
    expect(progressBar.getAttribute('aria-valuemin')).toBe('0');
    expect(progressBar.getAttribute('aria-valuemax')).toBe('14');
    expect(progressBar.getAttribute('aria-label')).toBe('Villain Health');
  });

  it('renders status badges (Tough, Stunned, Confused) properly in the badge row', () => {
    const villainWithStatuses = createMockVillain({
      statusCards: [StatusCard.TOUGH, StatusCard.STUNNED, StatusCard.CONFUSED],
    });

    renderVillainZone(villainWithStatuses);

    expect(screen.getByText('Tough')).toBeDefined();
    expect(screen.getByText('Stunned')).toBeDefined();
    expect(screen.getByText('Confused')).toBeDefined();
  });

  it('keeps SCH / ATK stats and HP bar on top (relative z-content) and renders attachments in staircase fan mode', () => {
    const ivoryHornCard = cardCatalog.getCard('01100')!; // Armored Rhino / Ivory Horn
    const mockHornAttachment: CardInstance = {
      instanceId: 'att-horn',
      card: ivoryHornCard,
      exhausted: false,
    };

    const villainWithAtt = createMockVillain({
      attachments: [mockHornAttachment],
    });

    renderVillainZone(villainWithAtt);

    // 1. Stats and HP columns have relative z-content so they sit above the villain fan at rest; the fan raises itself to z-zoom when hovered (Issue #312)
    const statsColumn = screen.getByTestId('villain-stats-column');
    expect(statsColumn.className).toContain('relative');
    expect(statsColumn.className).toContain('z-content');

    const hpColumn = screen.getByTestId('villain-hp-column');
    expect(hpColumn.className).toContain('relative');
    expect(hpColumn.className).toContain('z-content');

    // 2. Attachment card is rendered via staircase fan
    expect(screen.getByAltText(ivoryHornCard.name)).toBeDefined();

    // 3. Center card column gets ml-4 separation so staircase fan does not overlap stats column
    const centerCardCol = screen.getByTestId('villain-center-card-column');
    expect(centerCardCol.className).toContain('ml-4');

    // 4. Villain main panel expands padding to accommodate the staircase fan
    const mainPanel = screen.getByTestId('villain-main-panel');
    expect(mainPanel.style.paddingBottom).toBe('82px'); // 1 * 70px + 12px
  });

  it('stretches villain, main scheme and side scheme panels to one row height (Issue #312 follow-up)', () => {
    renderVillainZone(createMockVillain());

    const panelRow = screen.getByTestId('villain-main-panel').parentElement!;
    expect(panelRow.className).toContain('items-stretch');
    expect(panelRow.className).not.toContain('items-start');

    // Encounter piles stay top-aligned
    const pilesColumn = screen.getByTestId('encounter-deck-pile').parentElement!;
    expect(pilesColumn.className).toContain('self-start');

    // Villain card and gauges stay vertically centred in the taller panel
    const triColumnRow = screen.getByTestId('villain-stats-column').parentElement!;
    expect(triColumnRow.className).toContain('flex-1');
  });
});
