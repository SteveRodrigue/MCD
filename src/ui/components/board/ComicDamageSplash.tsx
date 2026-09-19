import React from 'react';

export interface ComicDamageSplashProps {
  amount: number;
  onomatopoeia?: string;
  className?: string;
}

export const ComicDamageSplash: React.FC<ComicDamageSplashProps> = ({
  amount,
  onomatopoeia = 'BANG!',
  className = '',
}) => {
  if (amount <= 0) return null;

  return (
    <div
      data-testid="comic-damage-splash"
      className={`absolute inset-0 z-30 flex items-center justify-center pointer-events-none animate-in zoom-in-75 duration-300 ${className}`}
    >
      {/* Explosive Jagged Starburst Container */}
      <div className="relative flex flex-col items-center justify-center -rotate-6 transition-transform hover:scale-105">
        {/* Comic Starburst Backing Layer */}
        <div className="absolute -inset-3 bg-comic-yellow border-3 border-comic-black rounded-2xl shadow-comic-lg rotate-12 scale-105" />

        {/* Comic Starburst Front Layer */}
        <div className="relative px-3 py-2 bg-comic-red border-3 border-comic-black rounded-xl shadow-comic flex flex-col items-center text-center">
          <span className="font-comic font-black text-xl md:text-2xl text-comic-yellow tracking-wider drop-shadow-[2px_2px_0px_rgba(0,0,0,1)] uppercase">
            {onomatopoeia}
          </span>
          <span className="font-comic font-black text-sm md:text-base text-white tracking-wide bg-comic-black px-2 py-0.5 rounded border border-white/50 -rotate-3 mt-0.5">
            -{amount} HP
          </span>
          <span className="text-[10px] font-comic font-bold text-comic-yellow drop-shadow-sm">
            ({amount} dmg taken)
          </span>
        </div>
      </div>
    </div>
  );
};

export default ComicDamageSplash;
