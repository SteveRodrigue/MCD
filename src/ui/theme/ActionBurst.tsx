import React from 'react';
import { STAR_CLIP } from './comic-shapes';
import { useModalStyle } from './useModalStyle';
import type { BurstState } from './useActionBurst';

const KEYFRAMES = `
@keyframes mcd-pop {
  0% { transform: translate(-50%, -50%) scale(0.2) rotate(-14deg); opacity: 0; }
  22% { transform: translate(-50%, -50%) scale(1.25) rotate(6deg); opacity: 1; }
  55% { transform: translate(-50%, -50%) scale(1) rotate(-3deg); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(1.12) rotate(2deg); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .mcd-pop { animation-duration: 1ms !important; }
}`;

/** Sound-effect sticker that pops over the modal for a moment. Purely decorative. */
export const ActionBurst: React.FC<{ burst: BurstState | null }> = ({ burst }) => {
  const { style } = useModalStyle();
  if (!burst) return null;
  const isStar = style.fx.shape === 'star';

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 z-raised pointer-events-none overflow-hidden"
    >
      <style>{KEYFRAMES}</style>
      {isStar ? (
        <div
          key={burst.n}
          className="mcd-pop absolute left-1/2 top-[42%] w-72 h-72 bg-comic-black"
          style={{ animation: 'mcd-pop 1s ease-out forwards', clipPath: STAR_CLIP }}
        >
          <div
            className={`absolute inset-[8px] flex items-center justify-center text-center font-black text-3xl px-12 ${style.fx.className}`}
            style={{ clipPath: STAR_CLIP }}
          >
            {burst.word}
          </div>
        </div>
      ) : (
        <div
          key={burst.n}
          className={`mcd-pop absolute left-1/2 top-[42%] px-6 py-3 text-2xl font-black text-center ${style.fx.className}`}
          style={{ animation: 'mcd-pop 1s ease-out forwards' }}
        >
          {burst.word}
        </div>
      )}
    </div>
  );
};
