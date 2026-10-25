import React from 'react';
import { STAR_CLIP } from '../../theme/comic-shapes';
import { useModalStyle } from '../../theme/useModalStyle';

export interface ComicDamageSplashProps {
  amount: number;
  onomatopoeia?: string;
  className?: string;
}

/** The burst that lands on a card when it takes damage: the theme's sound-effect look (star or panel), with the engine's word. */
export const ComicDamageSplash: React.FC<ComicDamageSplashProps> = ({
  amount,
  onomatopoeia = 'BANG!',
  className = '',
}) => {
  const { style } = useModalStyle();
  if (amount <= 0) return null;
  const isStar = style.fx.shape === 'star';

  return (
    <div
      data-testid="comic-damage-splash"
      className={`absolute inset-0 z-raised flex items-center justify-center pointer-events-none animate-in zoom-in-75 duration-300 ${className}`}
    >
      <div
        className={`flex flex-col items-center justify-center text-center -rotate-6 transition-transform ${
          isStar ? 'w-36 h-36 px-4' : 'px-4 py-3'
        } ${style.fx.className}`}
        style={isStar ? { clipPath: STAR_CLIP } : undefined}
      >
        <span className="font-comic font-black text-xl md:text-2xl tracking-wider uppercase">
          {onomatopoeia}
        </span>
        <span className="font-comic font-black text-sm md:text-base tracking-wide">
          -{amount} HP
        </span>
        <span className="text-micro font-bold">({amount} dmg taken)</span>
      </div>
    </div>
  );
};

export default ComicDamageSplash;
