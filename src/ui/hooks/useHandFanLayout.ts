import { useState, useEffect, useRef, useCallback } from 'react';

interface UseHandFanLayoutOptions {
  cardCount: number;
  cardWidth: number; // width in pixels (e.g. 176 for md, 128 for sm)
  defaultGap?: number; // default space between cards when unconstrained (e.g. 16px)
  padding?: number; // horizontal container padding to reserve
}

interface HandFanLayoutResult {
  containerRef: React.RefObject<HTMLDivElement>;
  overlapMargin: number; // negative number in px for cards index > 0 (or positive gap)
  isTightened: boolean;
}

export function useHandFanLayout({
  cardCount,
  cardWidth,
  defaultGap = 16,
  padding = 32,
}: UseHandFanLayoutOptions): HandFanLayoutResult {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(1000);

  const updateWidth = useCallback(() => {
    if (containerRef.current) {
      const width = containerRef.current.clientWidth;
      if (width > 0) {
        setContainerWidth(width);
      }
    }
  }, []);

  useEffect(() => {
    updateWidth();

    const element = containerRef.current;
    if (!element) return;

    // Use ResizeObserver for precise container monitoring
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        updateWidth();
      });
      observer.observe(element);
      return () => observer.disconnect();
    } else {
      window.addEventListener('resize', updateWidth);
      return () => window.removeEventListener('resize', updateWidth);
    }
  }, [updateWidth]);

  // Compute dynamic overlap margin
  // If (cardCount * cardWidth + (cardCount - 1) * defaultGap) <= usableWidth:
  //   no overlap needed, return defaultGap
  // Else:
  //   spacing = (usableWidth - cardWidth) / (cardCount - 1)
  //   overlapMargin = spacing - cardWidth (will be negative)
  const usableWidth = Math.max(cardWidth, containerWidth - padding);

  let overlapMargin = defaultGap;
  let isTightened = false;

  if (cardCount > 1) {
    const totalNaturalWidth = cardCount * cardWidth + (cardCount - 1) * defaultGap;
    if (totalNaturalWidth > usableWidth) {
      isTightened = true;
      const spacing = (usableWidth - cardWidth) / (cardCount - 1);
      overlapMargin = spacing - cardWidth;
    }
  }

  return {
    containerRef,
    overlapMargin,
    isTightened,
  };
}
