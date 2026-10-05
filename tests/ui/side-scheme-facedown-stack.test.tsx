import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VillainZone } from '../../src/ui/components/board/VillainZone';
import { CardAttachmentFan } from '../../src/ui/components/cards/CardAttachmentFan';
import { GameSettingsProvider } from '../../src/ui/context/GameSettingsProvider';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { createCardInstance } from '../../src/engine/state/game-setup';
import {
  SideSchemeState,
  VillainCard,
  MainSchemeCard,
  SideSchemeCard,
} from '../../src/engine/models';

vi.mock('../../src/ui/hooks/useCardArt', () => ({
  useCardArt: vi.fn().mockReturnValue({
    artUrl: 'https://cdn.example.com/test.jpg',
    loading: false,
    error: null,
  }),
}));

// #238: facedown cards under a side scheme stack like attachments and show only the card back.
describe('Facedown cards underneath a side scheme (#238)', () => {
  const secret = (name: string, ownerId: string) => {
    const inst = createCardInstance({
      code: `secret-${name}`,
      name,
      type: 'event',
      faction: 'justice',
    } as any);
    inst.ownerId = ownerId;
    return inst;
  };

  it('VillainZone renders each facedown card as a card back and leaks no front face', () => {
    const scheme: SideSchemeState = {
      instanceId: 'scheme-1',
      card: cardCatalog.getCard('01166') as SideSchemeCard,
      threat: 3,
      cardsUnderneath: [secret('Hidden Alpha', 'p1'), secret('Hidden Beta', 'p2')],
    };

    const { container } = render(
      <GameSettingsProvider>
        <VillainZone
          villain={{
            card: cardCatalog.getCard('01094') as VillainCard,
            health: 14,
            maxHealth: 14,
            exhausted: false,
            statusCards: [],
            attachments: [],
          }}
          mainScheme={{
            card: cardCatalog.getCard('01097b') as MainSchemeCard,
            stage: '1',
            threat: 3,
            targetThreat: 7,
          }}
          sideSchemes={[scheme]}
          encounterDeck={[]}
          encounterDiscard={[]}
          accelerationTokens={0}
        />
      </GameSettingsProvider>,
    );

    expect(screen.getAllByTestId('underneath-facedown-card')).toHaveLength(2);
    expect(screen.getAllByTestId('card-view-facedown').length).toBeGreaterThanOrEqual(2);
    expect(container.textContent).not.toContain('Hidden Alpha');
    expect(container.textContent).not.toContain('Hidden Beta');
    expect(container.textContent).not.toContain('Underneath');
  });

  it.each(['staircase', 'vertical'] as const)(
    'CardAttachmentFan (%s) draws attachments and facedown cards together',
    (mode) => {
      const attachment = createCardInstance(cardCatalog.getCard('01099')!);
      render(
        <CardAttachmentFan
          mode={mode}
          attachments={[attachment]}
          cardsUnderneath={[secret('Hidden Gamma', 'p1')]}
        />,
      );
      expect(screen.getAllByTestId('underneath-facedown-card')).toHaveLength(1);
      expect(screen.queryByText('Hidden Gamma')).toBeNull();
    },
  );
});
