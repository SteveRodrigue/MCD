import React, { useState, useRef, useEffect } from 'react';
import { NormalizedCard, CardInstance, StatusCard, CardType } from '../../../engine/models';
import { useCardArt } from '../../hooks/useCardArt';
import { getRemoteMarvelCdbUrl } from '../../services/card-cache-service';
import { FormattedCardText } from './FormattedCardText';
import { useGameSettings } from '../../context/useGameSettings';

export interface CardViewProps {
  card: NormalizedCard;
  instance?: CardInstance;
  isExhausted?: boolean;
  isPlayable?: boolean;
  unplayableReason?: string;
  isSelected?: boolean;
  isMulliganSelected?: boolean;
  isKeepSelected?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'hand';
  onClick?: () => void;
  showTokens?: boolean;
  enableHoverZoom?: boolean;
  zoomOrigin?:
    | 'bottom'
    | 'top'
    | 'center'
    | 'left'
    | 'right'
    | 'bottom-left'
    | 'bottom-right'
    | 'top-left'
    | 'top-right';
  className?: string;
}

export const CardView: React.FC<CardViewProps> = ({
  card,
  instance,
  isExhausted = false,
  isPlayable,
  unplayableReason,
  isSelected = false,
  isMulliganSelected = false,
  isKeepSelected = false,
  size = 'md',
  onClick,
  showTokens = true,
  enableHoverZoom = true,
  zoomOrigin = 'center',
  className = '',
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [dynamicOrigin, setDynamicOrigin] = useState<string | null>(null);

  const { artUrl, loading, error } = useCardArt(card);
  const [imageSrc, setImageSrc] = useState<string | null>(artUrl);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageSrc(artUrl);
    setImageFailed(false);
  }, [artUrl]);

  const handleImageError = () => {
    if (imageSrc && !imageSrc.startsWith('http')) {
      // Local image failed, attempt remote MarvelCDB CDN fallback
      setImageSrc(getRemoteMarvelCdbUrl(card));
    } else {
      setImageFailed(true);
    }
  };

  let cardZoomLevel: 'small' | 'normal' | 'larger' = 'normal';
  try {
    const settings = useGameSettings();
    if (settings && settings.cardZoomLevel) {
      cardZoomLevel = settings.cardZoomLevel;
    }
  } catch {
    cardZoomLevel = 'normal';
  }

  const isLandscape =
    card.isLandscape === true ||
    card.orientation === 'landscape' ||
    card.type === CardType.MAIN_SCHEME ||
    card.type === CardType.SIDE_SCHEME ||
    (card.type as string) === 'player_side_scheme';

  // Size Dimension Classes for Portrait vs Landscape Cards (3.5:2.5 vs 2.5:3.5)
  const sizeClasses = isLandscape
    ? {
        sm: 'w-44 h-32 text-xs',
        hand: 'w-[202px] h-[148px] text-xs',
        md: 'w-64 h-44 text-sm',
        lg: 'w-80 h-56 text-base',
        xl: 'w-[410px] h-72 text-lg',
      }[size]
    : {
        sm: 'w-28 h-40 text-xs',
        hand: 'w-[130px] h-[184px] text-xs',
        md: 'w-44 h-64 text-sm',
        lg: 'w-56 h-80 text-base',
        xl: 'w-72 h-[410px] text-lg',
      }[size];

  // Scale Factors to achieve a UNIFIED CONSTANT ZOOM SIZE across all UI locations (~308px portrait width, ~440px landscape width at 100%)
  const zoomScaleFactors: Record<
    'portrait' | 'landscape',
    Record<'sm' | 'md' | 'lg' | 'xl' | 'hand', number>
  > = {
    portrait: {
      sm: 2.75, // 112px * 2.75 = 308px
      hand: 2.37, // 130px * 2.37 = 308px
      md: 1.75, // 176px * 1.75 = 308px
      lg: 1.375, // 224px * 1.375 = 308px
      xl: 1.07, // 288px * 1.07 = 308px
    },
    landscape: {
      sm: 2.5, // 176px * 2.5 = 440px
      hand: 2.18, // 202px * 2.18 = 440px
      md: 1.72, // 256px * 1.72 = 440px
      lg: 1.375, // 320px * 1.375 = 440px
      xl: 1.07, // 410px * 1.07 = 438px
    },
  };

  const baseZoomScale = zoomScaleFactors[isLandscape ? 'landscape' : 'portrait'][size];
  const zoomMultiplier = cardZoomLevel === 'small' ? 0.9 : cardZoomLevel === 'larger' ? 1.1 : 1.0;
  const effectiveZoomScale = Number((baseZoomScale * zoomMultiplier).toFixed(3));

  // Dynamic Viewport Boundary Detection on Hover
  const handleMouseEnter = () => {
    if (!enableHoverZoom || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const scale = effectiveZoomScale;
    const scaledWidth = rect.width * scale;
    const scaledHeight = rect.height * scale;

    const overflowLeft = rect.left - (scaledWidth - rect.width) / 2 < 16;
    const overflowRight = rect.right + (scaledWidth - rect.width) / 2 > viewportWidth - 16;
    const overflowTop = rect.top - (scaledHeight - rect.height) / 2 < 55;
    const overflowBottom = rect.bottom + (scaledHeight - rect.height) / 2 > viewportHeight - 16;

    let vAlign = 'center';
    let hAlign = 'center';

    if (overflowTop) vAlign = 'top';
    else if (overflowBottom) vAlign = 'bottom';

    if (overflowLeft) hAlign = 'left';
    else if (overflowRight) hAlign = 'right';

    if (vAlign === 'center' && hAlign === 'center') {
      setDynamicOrigin(zoomOrigin);
    } else if (vAlign === 'center') {
      setDynamicOrigin(hAlign);
    } else if (hAlign === 'center') {
      setDynamicOrigin(vAlign);
    } else {
      setDynamicOrigin(`${vAlign}-${hAlign}`);
    }
  };

  const activeOrigin = dynamicOrigin || zoomOrigin;
  const originClass =
    {
      bottom: 'origin-bottom',
      top: 'origin-top',
      center: 'origin-center',
      left: 'origin-left',
      right: 'origin-right',
      'bottom-left': 'origin-bottom-left',
      'bottom-right': 'origin-bottom-right',
      'top-left': 'origin-top-left',
      'top-right': 'origin-top-right',
    }[activeOrigin] || 'origin-center';

  const exhaustedState = instance?.exhausted || isExhausted;
  const showFallback = imageFailed || error || (!artUrl && !loading);

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      className={`relative inline-block transition-all duration-200 select-none group cursor-pointer z-0 hover:z-50 ${
        exhaustedState
          ? 'rotate-[30deg] filter brightness-95 hover:rotate-0 hover:brightness-100'
          : 'rotate-0'
      } ${className}`}
    >
      {/* Outer Comic Card Container with Dynamic Hover Zoom */}
      <div
        style={
          {
            '--card-zoom-scale': effectiveZoomScale,
          } as React.CSSProperties
        }
        className={`relative rounded-xl overflow-hidden border-3 border-comic-black shadow-comic transition-all duration-200 ease-out transform ${originClass} ${
          enableHoverZoom
            ? 'group-hover:scale-[var(--card-zoom-scale)] group-hover:-translate-y-4 group-hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.85)] group-hover:border-4'
            : 'group-hover:-translate-y-1'
        } ${sizeClasses} ${
          isPlayable === false
            ? 'filter grayscale contrast-75 brightness-90 group-hover:grayscale-0 group-hover:contrast-100 group-hover:brightness-100'
            : ''
        } ${
          isMulliganSelected
            ? 'border-comic-red shadow-comic-lg ring-4 ring-rose-500'
            : isKeepSelected
              ? 'border-emerald-600 ring-4 ring-emerald-400'
              : isSelected
                ? 'border-comic-blue ring-4 ring-sky-400'
                : 'hover:shadow-comic-lg'
        }`}
      >
        {/* Exhausted Indicator Tag */}
        {exhaustedState && (
          <div className="absolute top-1.5 left-1.5 z-20 bg-slate-950/90 text-amber-300 font-comic text-[8px] px-1.5 py-0.5 rounded border border-comic-black shadow-sm font-bold uppercase pointer-events-none">
            EXHAUSTED
          </div>
        )}

        {/* Unplayable Indicator Tag */}
        {isPlayable === false && (
          <div
            className="absolute top-1.5 right-1.5 z-20 bg-slate-900/90 text-white font-comic text-[8px] px-1.5 py-0.5 rounded border border-comic-black shadow-sm font-bold uppercase pointer-events-none group-hover:hidden"
            title={unplayableReason ? `Cannot play: ${unplayableReason}` : undefined}
          >
            CANNOT PLAY
          </div>
        )}
        {/* 1. Real Card Art Image */}
        {!showFallback && (
          <div className="relative w-full h-full bg-slate-900 flex items-center justify-center">
            {loading && (
              <div className="absolute inset-0 bg-amber-50 flex flex-col items-center justify-center p-2 text-center bg-bendy-dots animate-pulse">
                <span className="font-comic text-xs text-comic-black">LOADING ART...</span>
              </div>
            )}

            {imageSrc && (
              <img
                src={imageSrc}
                alt={card.name}
                loading="lazy"
                onError={handleImageError}
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
              <FormattedCardText text={card.text} />
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
          <>
            {/* Left Badges: Damage, Threat, Status Cards */}
            <div className="absolute bottom-1.5 left-1.5 flex flex-wrap items-center gap-1 pointer-events-none z-20">
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

              {/* Status Cards (Tough, Stunned, Confused) */}
              {instance.statusCards &&
                instance.statusCards.map((st, i) => (
                  <span
                    key={i}
                    className={`font-comic text-[10px] px-1.5 py-0.5 rounded border border-comic-black uppercase shadow-comic-sm font-bold ${
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

            {/* Right Badge: General Counter Tokens (All-Purpose Green Game Counter: Tac Team, Web-Shooter) */}
            {(instance.tokens?.counters ?? 0) > 0 && (
              <div className="absolute bottom-1.5 right-1.5 z-20 pointer-events-none">
                <div className="bg-emerald-600 text-white font-comic text-xs font-black min-w-[22px] h-[22px] px-1 rounded-md border-2 border-comic-black shadow-comic-sm flex items-center justify-center">
                  {instance.tokens?.counters}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CardView;
