import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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
} from '../../src/engine/models';

describe('VillainZone Side Scheme Zoom & Stacking Context (Issue #148)', () => {
  const villainCard = cardCatalog.getCard('01094') as VillainCard;
  const mainSchemeCard = cardCatalog.getCard('01097b') as MainSchemeCard;
  const sideSchemeCard = cardCatalog.getCard('01107') as SideSchemeCard;

  const mockVillain: VillainState = {
    card: villainCard,
    health: 14,
    maxHealth: 14,
    exhausted: false,
    statusCards: [],
    attachments: [],
  };

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

  function renderVillainZone(sideSchemes = mockSideSchemes) {
    return render(
      <GameSettingsProvider>
        <VillainZone
          villain={mockVillain}
          mainScheme={mockMainScheme}
          sideSchemes={sideSchemes}
          encounterDeck={[]}
          encounterDiscard={[]}
          accelerationTokens={0}
        />
      </GameSettingsProvider>,
    );
  }

  it('renders root section with hover:z-30 focus-within:z-30 stacking classes', () => {
    const { container } = renderVillainZone();
    const rootSection = container.querySelector('section.comic-panel');
    expect(rootSection).not.toBeNull();
    expect(rootSection?.className).toContain('hover:z-30');
    expect(rootSection?.className).toContain('focus-within:z-30');
  });

  it('renders side schemes column wrapper with relative z-10 hover:z-40 focus-within:z-40', () => {
    renderVillainZone();
    const threatBadge = screen.getByText(/⚠️/i);
    const itemWrapper = threatBadge.parentElement!;
    const listContainer = itemWrapper.parentElement!;
    const columnWrapper = listContainer.parentElement!;

    expect(columnWrapper.className).toContain('relative');
    expect(columnWrapper.className).toContain('z-10');
    expect(columnWrapper.className).toContain('hover:z-40');
    expect(columnWrapper.className).toContain('focus-within:z-40');
  });

  it('renders active side schemes container with overflow-visible and without overflow-y-auto or max-h-', () => {
    renderVillainZone();
    const threatBadge = screen.getByText(/⚠️/i);
    const itemWrapper = threatBadge.parentElement!;
    const listContainer = itemWrapper.parentElement!;

    expect(listContainer.className).toContain('overflow-visible');
    expect(listContainer.className).not.toContain('overflow-y-auto');
    expect(listContainer.className).not.toContain('max-h-');
  });

  it('renders each active side scheme card item wrapper with relative z-10 hover:z-50 focus-within:z-50', () => {
    renderVillainZone();
    const threatBadge = screen.getByText(/⚠️/i);
    const itemWrapper = threatBadge.parentElement!;

    expect(itemWrapper.className).toContain('relative');
    expect(itemWrapper.className).toContain('z-10');
    expect(itemWrapper.className).toContain('hover:z-50');
    expect(itemWrapper.className).toContain('focus-within:z-50');
  });
});
