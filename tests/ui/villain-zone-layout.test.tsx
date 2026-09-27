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

  function renderVillainZone(villain: VillainState = createMockVillain()) {
    return render(
      <GameSettingsProvider>
        <VillainZone
          villain={villain}
          mainScheme={mockMainScheme}
          sideSchemes={mockSideSchemes}
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
    expect(hpColumn.textContent).toContain('10/14');
    expect(hpColumn.textContent).toContain('HP');

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
});
