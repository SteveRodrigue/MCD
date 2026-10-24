import React from 'react';
import { AccentStripe } from '../AccentStripe';
import { useModalStyle } from '../useModalStyle';

export type CardSelection = 'idle' | 'keep' | 'discard';

export interface CardSelectFrameProps {
  /** Card code, for the faction or hero accent edge. */
  code: string;
  selection: CardSelection;
  children: React.ReactNode;
  className?: string;
}

/**
 * Selection around a full card (mulligan keep or discard, a card picked from a list). The frame,
 * the tag and the discard stamp come from the theme; the meaning never changes: keep reads green,
 * discard reads red, and both are always written out as words. The zoom on hover is done by
 * the frame, so the dimming, tag and stamp scale with the card and stay visible; the card inside
 * must not zoom itself (`enableHoverZoom={false}`).
 */
export const CardSelectFrame: React.FC<CardSelectFrameProps> = ({
  code,
  selection,
  children,
  className = '',
}) => {
  const { style } = useModalStyle();
  const frame =
    selection === 'keep'
      ? style.tileSelected
      : selection === 'discard'
        ? style.slotFinal
        : style.tile;
  const keep = style.verbs.green;
  const discard = style.verbs.red;

  return (
    <div
      data-selection={selection}
      className={`relative hover:z-zoom hover:scale-[1.7] hover:-translate-y-2 p-2 transition-transform duration-200 ${frame} ${className}`}
    >
      <AccentStripe code={code} />
      {children}
      {selection === 'discard' && (
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-black/45 pointer-events-none z-zoom"
        />
      )}
      {selection === 'keep' && (
        <span
          className={`absolute top-3 right-3 px-2 py-0.5 text-micro font-black uppercase tracking-wider pointer-events-none z-zoom border-2 ${keep.banner} ${keep.rule}`}
        >
          Keep
        </span>
      )}
      {selection === 'discard' && (
        <span
          className={`absolute inset-x-0 top-1/2 -translate-y-1/2 mx-auto w-fit -rotate-6 px-3 py-1 text-xs font-black uppercase tracking-wider pointer-events-none z-zoom border-2 border-black ${discard.banner} ${style.fx.className}`}
        >
          Discard
        </span>
      )}
    </div>
  );
};
