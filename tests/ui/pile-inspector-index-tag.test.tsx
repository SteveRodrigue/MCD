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

  it.each([
    ['src/ui/components/board/VillainZone.tsx', 3],
    ['src/ui/components/board/PlayerHandTray.tsx', 3],
    ['src/ui/components/board/RemovedFromGameBox.tsx', 1],
    ['src/ui/components/cards/FacedownEncounterCard.tsx', 1],
  ])('places every #N tag in %s on the top-right corner', (file, count) => {
    const source = readFileSync(join(__dirname, '..', '..', file), 'utf8');
    expect(source.match(/absolute -top-2 -right-2 bg-slate-900/g)?.length ?? 0).toBe(count);
    expect(source).not.toContain('absolute -top-2 -left-2 bg-slate-900');
  });
});
