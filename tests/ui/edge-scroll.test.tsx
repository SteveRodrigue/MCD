import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, renderHook } from '@testing-library/react';
import { useEdgeScroll } from '../../src/ui/hooks/useEdgeScroll';

/**
 * The hero track hook (ADR-0017, Issue #380): edge zones are the track's own edges, the jump buttons
 * go to the real end of the track, and a pointer over an opted-out control never edge-scrolls.
 */
const TRACK = { left: 0, right: 1112, width: 1112 };
const SCROLL_WIDTH = 2728;

let frames: FrameRequestCallback[] = [];
const flushFrame = () => {
  const pending = frames;
  frames = [];
  pending.forEach((callback) => callback(0));
};

const mountTrack = () => {
  const hook = renderHook(() => useEdgeScroll<HTMLDivElement>({ edgeThreshold: 95, maxSpeed: 40 }));
  const track = document.createElement('div');
  document.body.appendChild(track);
  let scrollLeft = 500;
  Object.defineProperties(track, {
    scrollWidth: { value: SCROLL_WIDTH, configurable: true },
    clientWidth: { value: TRACK.width, configurable: true },
    scrollLeft: {
      get: () => scrollLeft,
      set: (value: number) => {
        scrollLeft = value;
      },
    },
  });
  track.getBoundingClientRect = () =>
    ({ ...TRACK, top: 0, bottom: 800, height: 800, x: 0, y: 0 }) as DOMRect;
  track.scrollTo = vi.fn();
  hook.result.current.containerRef.current = track;
  return { hook, track, scrollLeft: () => scrollLeft };
};

describe('useEdgeScroll', () => {
  beforeEach(() => {
    frames = [];
    vi.stubGlobal('innerWidth', 1600);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {
      frames = [];
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  describe('scrollToEdge', () => {
    it('jumps completely to the right end of the track', () => {
      const { hook, track } = mountTrack();
      hook.result.current.scrollToEdge('right');
      expect(track.scrollTo).toHaveBeenCalledWith({
        left: SCROLL_WIDTH - TRACK.width,
        behavior: 'smooth',
      });
    });

    it('jumps completely to the left end of the track', () => {
      const { hook, track } = mountTrack();
      hook.result.current.scrollToEdge('left');
      expect(track.scrollTo).toHaveBeenCalledWith({ left: 0, behavior: 'smooth' });
    });
  });

  describe('scrollToChild (Issue #382)', () => {
    /** A seat laid out inside the track: `offset` px from the track's left border edge. */
    const seatAt = (offset: number, width: number) => {
      const seat = document.createElement('div');
      seat.getBoundingClientRect = () =>
        ({
          left: TRACK.left + offset,
          right: TRACK.left + offset + width,
          width,
          top: 0,
          bottom: 600,
          height: 600,
          x: 0,
          y: 0,
        }) as DOMRect;
      return seat;
    };

    it('aligns a seat wider than the track to its left edge, so its first pixels stay visible', () => {
      const { hook, track } = mountTrack();
      track.style.paddingLeft = '16px';
      hook.result.current.scrollToChild(seatAt(16, 1200));
      // The seat starts at the track padding, so it is already aligned: scrollLeft stays at 500.
      expect(track.scrollTo).toHaveBeenCalledWith({ left: 500, behavior: 'smooth' });
    });

    it('still centers a seat narrower than the track', () => {
      const { hook, track } = mountTrack();
      track.style.paddingLeft = '16px';
      hook.result.current.scrollToChild(seatAt(300, 600));
      // 500 + 300 - (1112 - 600) / 2
      expect(track.scrollTo).toHaveBeenCalledWith({ left: 544, behavior: 'smooth' });
    });
  });

  describe('edge zones', () => {
    it('scrolls right while the pointer is in the right edge zone of the track', () => {
      const { scrollLeft } = mountTrack();
      fireEvent.mouseMove(document.body, { clientX: TRACK.right - 20 });
      flushFrame();
      expect(scrollLeft()).toBeGreaterThan(500);
    });

    it('scrolls left while the pointer is in the left edge zone of the track', () => {
      const { scrollLeft } = mountTrack();
      fireEvent.mouseMove(document.body, { clientX: TRACK.left + 20 });
      flushFrame();
      expect(scrollLeft()).toBeLessThan(500);
    });

    it('does not scroll when the pointer is beside the track, over the side dock', () => {
      const { scrollLeft } = mountTrack();
      fireEvent.mouseMove(document.body, { clientX: 1580 });
      flushFrame();
      expect(scrollLeft()).toBe(500);
    });

    it('does not scroll while the pointer is over a control that opts out', () => {
      const { scrollLeft } = mountTrack();
      const jump = document.createElement('button');
      jump.setAttribute('data-no-edge-scroll', '');
      document.body.appendChild(jump);
      fireEvent.mouseMove(jump, { clientX: TRACK.right - 20 });
      flushFrame();
      expect(scrollLeft()).toBe(500);
    });
  });
});
