import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { GameBoard } from '../../src/ui/components/board/GameBoard';
import { GameSettingsProvider } from '../../src/ui/context/GameSettingsProvider';
import { newRhinoGame } from '../support/game-fixtures';
import { TestSession } from '../support/render-with-session';

/** The hero track's jump buttons (Issue #380): in view, and a click goes to the end of the track. */
const SCROLL_WIDTH = 2728;
const CLIENT_WIDTH = 1112;

let scrollWidth = SCROLL_WIDTH;
let resizeCallbacks: ResizeObserverCallback[] = [];

describe('panoramic hero track jump buttons', () => {
  beforeEach(() => {
    localStorage.clear();
    scrollWidth = SCROLL_WIDTH;
    resizeCallbacks = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: ResizeObserverCallback) {
          resizeCallbacks.push(callback);
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    Element.prototype.scrollTo = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      get: () => scrollWidth,
    });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => CLIENT_WIDTH,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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

  it('hides Scroll Right once the track no longer overflows, without a scroll or window resize (Issue #396)', () => {
    mountThreeHeroes();
    expect(screen.getByTitle('Scroll Right')).toBeTruthy();
    // The content shrinks to fit when a seat narrows or images settle; a size observer must notice.
    scrollWidth = CLIENT_WIDTH;
    act(() => {
      resizeCallbacks.forEach((callback) => callback([], {} as ResizeObserver));
    });
    expect(screen.queryByTitle('Scroll Right')).toBeNull();
  });

  it('opts the buttons out of edge scrolling, which would cancel the smooth jump', () => {
    mountThreeHeroes();
    expect(screen.getByTitle('Scroll Right').hasAttribute('data-no-edge-scroll')).toBe(true);
  });

  it('leaves the track as much room above the seats as the ribbon sticks out (Issue #383)', () => {
    mountThreeHeroes();
    const track = screen.getAllByTestId('hero-zone')[0].closest('.overflow-x-auto') as HTMLElement;
    // The ribbon is `-top-N` above the seat; the track clips whatever lies above its top padding.
    const ribbon = screen.getAllByTestId('hero-zone-ribbon')[0].parentElement as HTMLElement;
    const overhang = Number(/(?:^|\s)-top-(\d+)(?:\s|$)/.exec(ribbon.className)?.[1]);
    const padding = Number(/(?:^|\s)pt-(\d+)(?:\s|$)/.exec(track.className)?.[1]);
    expect(overhang).toBeGreaterThan(0);
    expect(padding).toBeGreaterThanOrEqual(overhang);
  });
});
