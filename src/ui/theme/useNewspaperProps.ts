import type { CSSProperties } from 'react';
import { newspaperFontVars } from './modal-styles';
import { useModalStyle } from './useModalStyle';

/**
 * What a newspaper surface spreads on its root element: the `data-newspaper` mark the lab and the
 * theme's newspaper rules look for, and the Newspaper font and text size variables (`font-news-headline`,
 * `font-news-body`) of the active theme. Used by the Daily Bugle sheet, its end-turn flash and its buttons.
 */
export const useNewspaperProps = (): { 'data-newspaper': string; style: CSSProperties } => {
  const { style } = useModalStyle();
  return { 'data-newspaper': '', style: newspaperFontVars(style) };
};
