import type { CardZoomLevel } from '../../context/game-settings-context';

/** Gap between the zoomed card and the top right corner of the viewport, in px. */
export const CARD_ZOOM_MARGIN = 8;

// The zoom copy always renders at `sm`, so one factor per orientation gives one zoom size everywhere.
const BASE_SCALE = { portrait: 2.75, landscape: 2.5 };

const LEVEL_MULTIPLIER: Record<CardZoomLevel, number> = {
  small: 0.9,
  normal: 1,
  larger: 1.1,
};

interface Size {
  width: number;
  height: number;
}

/**
 * The scale of the zoom copy: the Card Zooming setting, shrunk when needed so the card always fits
 * the viewport. `card` is the copy's unscaled size. A size of 0 (not laid out) applies no limit.
 */
export function cardZoomScale(
  isLandscape: boolean,
  level: CardZoomLevel,
  card: Size,
  viewport: Size,
): number {
  const wanted = Number(
    (BASE_SCALE[isLandscape ? 'landscape' : 'portrait'] * LEVEL_MULTIPLIER[level]).toFixed(3),
  );
  if (card.width <= 0 || card.height <= 0) return wanted;
  const fit = Math.min(
    (viewport.width - 2 * CARD_ZOOM_MARGIN) / card.width,
    (viewport.height - 2 * CARD_ZOOM_MARGIN) / card.height,
  );
  return Math.min(wanted, Math.floor(fit * 1000) / 1000);
}
