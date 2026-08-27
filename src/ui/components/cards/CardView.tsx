import React, { useState } from 'react';
import { NormalizedCard, CardInstance, StatusCard, CardType } from '../../../engine/models';
import { useCardArt } from '../../hooks/useCardArt';

export interface CardViewProps {
  card: NormalizedCard;
  instance?: CardInstance;
  isExhausted?: boolean;
  isPlayable?: boolean;
  isSelected?: boolean;
  isMulliganSelected?: boolean;
  isKeepSelected?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  onClick?: () => void;
  showTokens?: boolean;
  enableHoverZoom?: boolean;
  className?: string;
}

export const CardView: React.FC<CardViewProps> = ({
  card,
  instance,
  isExhausted = false,
  isPlayable = false,
  isSelected = false,
  isMulliganSelected = false,
  isKeepSelected = false,
  size = 'md',
  onClick,
  showTokens = true,
  enableHoverZoom = true,
  className = '',
}) => {
  const { artUrl, loading, error } = useCardArt(card.code);
  const [imageFailed, setImageFailed] = useState(false);

  const isLandscape =
    card.isLandscape === true ||
    card.orientation === 'landscape' ||
    card.type === CardType.MAIN_SCHEME ||
    card.type === CardType.SIDE_SCHEME ||
    (card.type as string) === 'main_scheme' ||
    (card.type as string) === 'side_scheme' ||
    (card.type as string) === 'player_side_scheme' ||
    card.code === '01097a' ||
    card.code === '01097b';

  // Size Dimension Classes for Portrait vs Landscape Cards (3.5:2.5 vs 2.5:3.5)
  const sizeClasses = isLandscape
    ? {
        sm: 'w-44 h-32 text-xs',
        md: 'w-64 h-44 text-sm',
        lg: 'w-80 h-56 text-base',
        xl: 'w-[410px] h-72 text-lg',
      }[size]
    : {
        sm: 'w-28 h-40 text-xs',
        md: 'w-44 h-64 text-sm',
        lg: 'w-56 h-80 text-base',
        xl: 'w-72 h-[410px] text-lg',
      }[size];

  const exhaustedState = instance?.exhausted || isExhausted;
  const showFallback = imageFailed || error || (!artUrl && !loading);

  return (
    <div
      onClick={onClick}
      className={`relative inline-block transition-all duration-200 select-none group cursor-pointer z-0 hover:z-50 ${
        exhaustedState ? 'rotate-90 my-6 mx-4' : 'rotate-0'
      } ${className}`}
    >
      {/* Outer Comic Card Container with Dynamic Hover Zoom */}
      <div
        className={`relative rounded-xl overflow-hidden border-3 border-comic-black shadow-comic transition-all duration-200 ease-out transform ${
          enableHoverZoom
            ? 'group-hover:scale-[1.9] group-hover:-translate-y-8 group-hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7)] group-hover:border-4'
            : 'group-hover:-translate-y-1'
        } ${sizeClasses} ${
          isMulliganSelected
            ? 'border-comic-red shadow-comic-lg ring-4 ring-rose-500'
            : isKeepSelected
              ? 'border-emerald-600 ring-4 ring-emerald-400'
              : isPlayable
                ? 'ring-4 ring-comic-yellow animate-pulse'
                : isSelected
                  ? 'border-comic-blue ring-4 ring-sky-400'
                  : 'hover:shadow-comic-lg'
        }`}
      >
        {/* 1. Real Card Art Image */}
        {!showFallback && (
          <div className="relative w-full h-full bg-slate-900 flex items-center justify-center">
            {loading && (
              <div className="absolute inset-0 bg-amber-50 flex flex-col items-center justify-center p-2 text-center bg-bendy-dots animate-pulse">
                <span className="font-comic text-xs text-comic-black">LOADING ART...</span>
              </div>
            )}

            {artUrl && (
              <img
                src={artUrl}
                alt={card.name}
                loading="lazy"
                onError={() => setImageFailed(true)}
                className={`w-full h-full object-cover transition-opacity duration-300 ${
                  loading ? 'opacity-0' : 'opacity-100'
                }`}
              />
            )}
          </div>
        )}

        {/* 2. Fallback 60s Comic Pop-Art Vector Card Layout */}
        {showFallback && (
          <div className="w-full h-full bg-white flex flex-col justify-between p-3 relative bg-bendy-dots">
            {/* Top Bar: Cost & Type */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="w-6 h-6 rounded-full bg-slate-950 text-comic-yellow font-comic text-sm flex items-center justify-center font-bold border border-comic-black">
                  {card.cost ?? 0}
                </span>
                <span className="text-[10px] font-bold uppercase text-slate-500 bg-white/90 px-1 rounded border border-slate-300">
                  {card.type}
                </span>
              </div>
              <h4 className="font-comic text-sm text-comic-black leading-tight line-clamp-2">
                {card.name}
              </h4>
              {card.subname && (
                <p className="text-[10px] font-bold text-comic-red italic">{card.subname}</p>
              )}
            </div>

            {/* Card Body Text */}
            <div className="my-1 text-[10px] text-slate-700 line-clamp-5 leading-tight bg-white/80 p-1 rounded border border-slate-200">
              {card.text || 'No special text.'}
            </div>

            {/* Bottom Bar: Faction & Resources */}
            <div className="border-t border-slate-300 pt-1 flex items-center justify-between text-[9px] font-semibold text-slate-600 bg-white/90">
              <span className="capitalize">{card.faction}</span>
              <span className="font-bold text-comic-black uppercase">
                {card.resources.total > 0
                  ? `${card.resources.total} ${
                      card.resources.physical > 0
                        ? 'PHY'
                        : card.resources.energy > 0
                          ? 'NRG'
                          : card.resources.mental > 0
                            ? 'MNT'
                            : 'WLD'
                    }`
                  : ''}
              </span>
            </div>
          </div>
        )}

        {/* 3. Mulligan / Keep Status Ribbons */}
        {isMulliganSelected && (
          <div className="absolute inset-0 bg-rose-950/40 flex flex-col items-center justify-center pointer-events-none">
            <div className="bg-comic-red text-white border-2 border-comic-black font-comic text-xs px-3 py-1 tracking-wider shadow-comic transform -rotate-6">
              MULLIGAN (DISCARD)
            </div>
          </div>
        )}

        {isKeepSelected && (
          <div className="absolute top-2 right-2 pointer-events-none">
            <div className="bg-emerald-500 text-slate-950 border border-comic-black font-comic text-[10px] px-2 py-0.5 font-bold tracking-wider rounded shadow-comic-sm">
              KEEP
            </div>
          </div>
        )}

        {/* 4. Active Token & Status Badges Overlay */}
        {showTokens && instance && (
          <div className="absolute bottom-2 left-2 right-2 flex flex-wrap gap-1 pointer-events-none">
            {/* Damage Tokens */}
            {(instance.tokens?.damage ?? 0) > 0 && (
              <span className="bg-comic-red text-white font-comic text-xs px-2 py-0.5 rounded-full border border-comic-black shadow-comic-sm">
                💥 {instance.tokens?.damage}
              </span>
            )}

            {/* Threat Tokens */}
            {(instance.tokens?.threat ?? 0) > 0 && (
              <span className="bg-comic-yellow text-comic-black font-comic text-xs px-2 py-0.5 rounded-full border border-comic-black shadow-comic-sm">
                ⚠️ {instance.tokens?.threat}
              </span>
            )}

            {/* General Counters (e.g. Snoop / Web Counters) */}
            {(instance.tokens?.counters ?? 0) > 0 && (
              <span className="bg-comic-blue text-white font-comic text-xs px-2 py-0.5 rounded-full border border-comic-black shadow-comic-sm">
                ⚡ {instance.tokens?.counters}
              </span>
            )}

            {/* Status Cards (Tough, Stunned, Confused) */}
            {instance.statusCards &&
              instance.statusCards.map((st, i) => (
                <span
                  key={i}
                  className={`font-comic text-[10px] px-1.5 py-0.5 rounded border border-comic-black uppercase shadow-comic-sm ${
                    st === StatusCard.TOUGH
                      ? 'bg-sky-300 text-slate-950'
                      : st === StatusCard.STUNNED
                        ? 'bg-amber-300 text-slate-950'
                        : 'bg-fuchsia-300 text-slate-950'
                  }`}
                >
                  {st}
                </span>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CardView;
