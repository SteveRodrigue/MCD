import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, fireEvent } from '@testing-library/react';
import { RemovedFromGameBox } from '../../src/ui/components/board/RemovedFromGameBox';
import { GameSettingsProvider } from '../../src/ui/context/GameSettingsProvider';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { createCardInstance } from '../../src/engine/state/game-setup';

vi.mock('../../src/ui/hooks/useCardArt', () => ({
  useCardArt: vi.fn().mockReturnValue({
    artUrl: 'https://cdn.example.com/test.jpg',
    loading: false,
    error: null,
  }),
}));

// The #N position tag sits on the card's top-right corner so it never covers the cost (top-left).
describe('Pile inspector #N tag position', () => {
  it('renders the #N tag on the top-right corner in the Removed from Game inspector', () => {
    const card = createCardInstance(cardCatalog.getCard('01165')!);
    render(
      <GameSettingsProvider>
        <RemovedFromGameBox cards={[card]} />
      </GameSettingsProvider>,
    );

    fireEvent.click(screen.getByTestId('removed-from-game-pile'));
    const tag = screen.getByText('#1');
    expect(tag.className).toContain('-top-2');
    expect(tag.className).toContain('-right-2');
    expect(tag.className).not.toContain('-left-2');
  });

  // One shared tile draws every #N tag (PileCardTile); the viewers must not draw their own.
  it('draws the #N tag once, on the top-right corner, in the shared pile tile', () => {
    const source = readFileSync(
      join(__dirname, '..', '..', 'src/ui/components/board/PileViewerModal.tsx'),
      'utf8',
    );
    expect(source.match(/absolute -top-2 -right-2/g)?.length ?? 0).toBe(1);
    expect(source).not.toContain('absolute -top-2 -left-2');
  });

  it.each([
    'src/ui/components/board/VillainZone.tsx',
    'src/ui/components/board/PlayerHandTray.tsx',
    'src/ui/components/board/RemovedFromGameBox.tsx',
    'src/ui/components/cards/FacedownEncounterCard.tsx',
  ])('%s uses the shared tile instead of its own #N tag', (file) => {
    const source = readFileSync(join(__dirname, '..', '..', file), 'utf8');
    expect(source).not.toMatch(/absolute -top-2 -(left|right)-2 bg-slate-900/);
    expect(source).toContain('PileCardTile');
  });
});
