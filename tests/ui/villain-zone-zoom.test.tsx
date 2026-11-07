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

describe('VillainZone Side Scheme stacking (Issue #148, #653)', () => {
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
          outOfPlayEmpty={false}
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

  it('does not raise the zone on hover: the zoom floats in its own corner layer', () => {
    const { container } = renderVillainZone();
    const rootSection = container.querySelector('[data-testid="villain-zone"]');
    expect(rootSection).not.toBeNull();
    expect(rootSection?.className).not.toContain('hover:z-');
  });

  it('renders side schemes column wrapper with relative z-content and no hover raise', () => {
    renderVillainZone();
    const threatBadge = screen.getByText(/⚠️/i);
    const itemWrapper = threatBadge.parentElement!;
    const listContainer = itemWrapper.parentElement!;
    const columnWrapper = listContainer.parentElement!;

    expect(columnWrapper.className).toContain('relative');
    expect(columnWrapper.className).toContain('z-content');
    expect(columnWrapper.className).not.toContain('hover:z-');
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

  it('renders each active side scheme card item wrapper with relative z-content and no hover raise', () => {
    renderVillainZone();
    const threatBadge = screen.getByText(/⚠️/i);
    const itemWrapper = threatBadge.parentElement!;

    expect(itemWrapper.className).toContain('relative');
    expect(itemWrapper.className).toContain('z-content');
    expect(itemWrapper.className).not.toContain('hover:z-');
  });
});
