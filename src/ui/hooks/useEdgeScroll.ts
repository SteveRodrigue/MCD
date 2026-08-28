import { useEffect, useRef, useState, useCallback } from 'react';

export interface UseEdgeScrollOptions {
  edgeThreshold?: number; // Distance in pixels from viewport edge to trigger scroll
  maxSpeed?: number; // Max scroll speed in pixels per frame
  enabled?: boolean;
}

export function useEdgeScroll<T extends HTMLElement>(options: UseEdgeScrollOptions = {}) {
  const { edgeThreshold = 75, maxSpeed = 22, enabled = true } = options;

  const containerRef = useRef<T | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const scrollVelocity = useRef<number>(0);

  const [canScrollLeft, setCanScrollLeft] = useState<boolean>(false);
  const [canScrollRight, setCanScrollRight] = useState<boolean>(false);

  // Check scroll boundary state
  const updateScrollBounds = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 5);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 5);
  }, []);

  // Animation frame loop for smooth edge scrolling
  const animateScroll = useCallback(() => {
    const el = containerRef.current;
    if (el && scrollVelocity.current !== 0) {
      el.scrollLeft += scrollVelocity.current;
      updateScrollBounds();
      animationFrameId.current = requestAnimationFrame(animateScroll);
    } else {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
    }
  }, [updateScrollBounds]);

  const startScrolling = useCallback(
    (velocity: number) => {
      scrollVelocity.current = velocity;
      if (!animationFrameId.current) {
        animationFrameId.current = requestAnimationFrame(animateScroll);
      }
    },
    [animateScroll],
  );

  const stopScrolling = useCallback(() => {
    scrollVelocity.current = 0;
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
  }, []);

  // Listen to pointer movements and drag-over events across the viewport
  useEffect(() => {
    if (!enabled) {
      stopScrolling();
      return;
    }

    const handlePointerMove = (e: MouseEvent | DragEvent) => {
      const el = containerRef.current;
      if (!el) return;

      // Only edge-scroll if container has overflow to scroll
      if (el.scrollWidth <= el.clientWidth) {
        stopScrolling();
        return;
      }

      const clientX = e.clientX;
      const windowWidth = window.innerWidth;

      if (clientX < edgeThreshold) {
        // Near Left Edge: Scroll Left
        const intensity = Math.max(0, 1 - clientX / edgeThreshold);
        startScrolling(-Math.ceil(maxSpeed * intensity));
      } else if (clientX > windowWidth - edgeThreshold) {
        // Near Right Edge: Scroll Right
        const intensity = Math.max(0, 1 - (windowWidth - clientX) / edgeThreshold);
        startScrolling(Math.ceil(maxSpeed * intensity));
      } else {
        stopScrolling();
      }
    };

    const handlePointerLeave = () => {
      stopScrolling();
    };

    window.addEventListener('mousemove', handlePointerMove, { passive: true });
    window.addEventListener('dragover', handlePointerMove, { passive: true });
    window.addEventListener('mouseleave', handlePointerLeave);
    window.addEventListener('blur', handlePointerLeave);

    return () => {
      stopScrolling();
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('dragover', handlePointerMove);
      window.removeEventListener('mouseleave', handlePointerLeave);
      window.removeEventListener('blur', handlePointerLeave);
    };
  }, [enabled, edgeThreshold, maxSpeed, startScrolling, stopScrolling]);

  // Monitor scroll and resize events on container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    updateScrollBounds();
    el.addEventListener('scroll', updateScrollBounds, { passive: true });
    window.addEventListener('resize', updateScrollBounds);

    return () => {
      el.removeEventListener('scroll', updateScrollBounds);
      window.removeEventListener('resize', updateScrollBounds);
    };
  }, [updateScrollBounds]);

  // Quick manual jump to a specific child element (e.g. Hero Seat)
  const scrollToChild = useCallback((targetElement: HTMLElement | null) => {
    const el = containerRef.current;
    if (!el || !targetElement) return;

    const containerRect = el.getBoundingClientRect();
    const targetRect = targetElement.getBoundingClientRect();

    const currentScroll = el.scrollLeft;
    const targetOffset = targetRect.left - containerRect.left;
    const desiredScroll = currentScroll + targetOffset - (containerRect.width - targetRect.width) / 2;

    el.scrollTo({
      left: Math.max(0, desiredScroll),
      behavior: 'smooth',
    });
  }, []);

  const scrollByAmount = useCallback(
    (amount: number) => {
      const el = containerRef.current;
      if (!el) return;
      el.scrollBy({ left: amount, behavior: 'smooth' });
    },
    [],
  );

  return {
    containerRef,
    canScrollLeft,
    canScrollRight,
    scrollToChild,
    scrollByAmount,
    updateScrollBounds,
  };
}
