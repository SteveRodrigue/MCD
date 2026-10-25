import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { GameBoard } from '../../src/ui/components/board/GameBoard';
import { GameSettingsProvider } from '../../src/ui/context/GameSettingsProvider';
import { newRhinoGame } from '../support/game-fixtures';
import { TestSession } from '../support/render-with-session';

/** The hero track's jump buttons (Issue #380): in view, and a click goes to the end of the track. */
const SCROLL_WIDTH = 2728;
const CLIENT_WIDTH = 1112;

describe('panoramic hero track jump buttons', () => {
  beforeEach(() => {
    localStorage.clear();
    Element.prototype.scrollTo = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      get: () => SCROLL_WIDTH,
    });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => CLIENT_WIDTH,
    });
  });

  afterEach(() => {
    delete (HTMLElement.prototype as { scrollWidth?: number }).scrollWidth;
    delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
  });

  const mountThreeHeroes = () => {
    const state = newRhinoGame({
      players: [{ hero: '01001a' }, { hero: '01029a' }, { hero: '01010b', alterEgo: '01010a' }],
    });
    return render(
      <GameSettingsProvider>
        <TestSession state={state}>
          <GameBoard onReset={vi.fn()} />
        </TestSession>
      </GameSettingsProvider>,
    );
  };

  it('Scroll Right jumps to the right end of the track, not 400 px', () => {
    mountThreeHeroes();
    fireEvent.click(screen.getByTitle('Scroll Right'));
    const scrollTo = Element.prototype.scrollTo as ReturnType<typeof vi.fn>;
    expect(scrollTo).toHaveBeenCalledWith({
      left: SCROLL_WIDTH - CLIENT_WIDTH,
      behavior: 'smooth',
    });
    expect((scrollTo.mock.contexts[0] as HTMLElement).className).toContain('overflow-x-auto');
  });

  it('keeps the buttons on screen: sticky at mid-viewport, outside the clipped track', () => {
    mountThreeHeroes();
    const button = screen.getByTitle('Scroll Right');
    const wrapper = button.closest('[data-testid="track-jump-buttons"]');
    expect(wrapper).not.toBeNull();
    expect(wrapper?.className).toContain('sticky');
    expect(wrapper?.className).toContain('top-1/2');
    expect(button.closest('.overflow-hidden')).toBeNull();
  });

  it('opts the buttons out of edge scrolling, which would cancel the smooth jump', () => {
    mountThreeHeroes();
    expect(screen.getByTitle('Scroll Right').hasAttribute('data-no-edge-scroll')).toBe(true);
  });
});
