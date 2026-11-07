import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { NormalizedCard, CardInstance, StatusCard, CardType } from '../../../engine/models';
import { getEffectiveCardTraitsDetails } from '../../../engine/pipeline/stat-calculator';
import { useCardArt } from '../../hooks/useCardArt';
import { useOnChange } from '../../hooks/useOnChange';
import {
  getCardBackFallbackColor,
  getCardBackTypeForCard,
} from '../../services/card-cache-service';
import {
  artPackArt,
  CardArtStats,
  CardBackType,
  cardBackUrl,
  remoteArtUrl,
} from '../../../data/content/card-art';
import { FormattedCardText } from './FormattedCardText';
import { useOptionalGameSettings } from '../../context/useGameSettings';
import { CardContextMenu } from './CardContextMenu';
import { CARD_ZOOM_MARGIN, cardZoomScale } from './card-zoom';
import { Z_CLASS } from '../../styles/z-layers';
import { useModalStyle } from '../../theme/useModalStyle';

export interface CardViewProps {
  card: NormalizedCard;
  instance?: CardInstance;
  isFacedown?: boolean;
  cardBackType?: CardBackType;
  /** The card's current stats, which select among an art pack's stat images. */
  artStats?: CardArtStats;
  /** Always show the official art, never an art pack image (the Card Editor). */
  officialArtOnly?: boolean;
  dynamicTraits?: string[];
  effectiveTraits?: string[];
  isExhausted?: boolean;
  isPlayable?: boolean;
  unplayableReason?: string;
  isUsable?: boolean;
  unusableBadge?: string;
  unusableReason?: string;
  isSelected?: boolean;
  isMulliganSelected?: boolean;
  isKeepSelected?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'hand';
  onClick?: () => void;
  showTokens?: boolean;
  enableHoverZoom?: boolean;
  enableContextMenu?: boolean;
  className?: string;
}

const isLandscapeCard = (card: NormalizedCard): boolean =>
  card.isLandscape === true ||
  card.orientation === 'landscape' ||
  card.type === CardType.MAIN_SCHEME ||
  card.type === CardType.SIDE_SCHEME ||
  (card.type as string) === 'player_side_scheme';

const CardViewImpl: React.FC<CardViewProps> = ({
  card,
  instance,
  isFacedown: isFacedownProp,
  cardBackType,
  artStats,
  officialArtOnly = false,
  dynamicTraits,
  effectiveTraits: _effectiveTraits,
  isExhausted,
  isPlayable,
  unplayableReason,
  isUsable,
  unusableBadge,
  unusableReason,
  isSelected = false,
  isMulliganSelected = false,
  isKeepSelected = false,
  size = 'md',
  onClick,
  showTokens = true,
  enableHoverZoom = true,
  enableContextMenu = true,
  className = '',
}) => {
  const [isZoomed, setIsZoomed] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);

  const { style } = useModalStyle();
  const [failedArtPackUrl, setFailedArtPackUrl] = useState<string | null>(null);
  const art = officialArtOnly ? undefined : artPackArt(card.code, artStats);
  const usesArtPack = art !== undefined && art.url !== failedArtPackUrl;

  // A shell's only face is its own card, so its art may show. Any other facedown card hides itself.
  const isFacedown = Boolean(isFacedownProp) && !(instance?.isShell && usesArtPack);
  const resolvedBackType = cardBackType || getCardBackTypeForCard(card);
  const [cardBackError, setCardBackError] = useState(false);

  const { artUrl, loading, error } = useCardArt(card, {
    artStats,
    officialArt: !usesArtPack || isFacedown,
  });
  const [imageSrc, setImageSrc] = useState<string | null>(artUrl);
  const [imageFailed, setImageFailed] = useState(false);

  useOnChange(artUrl, (url) => {
    setImageSrc(url);
    setImageFailed(false);
  });

  const handleImageError = () => {
    if (usesArtPack) {
      setFailedArtPackUrl(art.url);
      return;
    }
    const remoteUrl = remoteArtUrl(card);
    if (imageSrc && !imageSrc.startsWith('http') && remoteUrl) {
      // Local image failed, attempt remote MarvelCDB CDN fallback (official packs only)
      setImageSrc(remoteUrl);
    } else {
      setImageFailed(true);
    }
  };

  const isLandscape = isLandscapeCard(card);

  const activeDynamicTraits =
    dynamicTraits ??
    (instance?.attachments && instance.attachments.length > 0
      ? getEffectiveCardTraitsDetails(card, instance).dynamicTraits
      : []);

  // Size Dimension Classes for Portrait vs Landscape Cards (3.5:2.5 vs 2.5:3.5)
  const sizeClasses = isLandscape
    ? {
        sm: 'w-44 h-32 text-xs',
        hand: 'w-[202px] h-[148px] text-xs',
        md: 'w-64 h-44 text-sm',
        lg: 'w-80 h-56 text-base font-body',
        xl: 'w-[410px] h-72 text-lg font-body',
      }[size]
    : {
        sm: 'w-28 h-40 text-xs',
        hand: 'w-[130px] h-[184px] text-xs',
        md: 'w-44 h-64 text-sm',
        lg: 'w-56 h-80 text-base font-body',
        xl: 'w-72 h-[410px] text-lg font-body',
      }[size];

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!enableContextMenu) return;
    e.preventDefault();
    e.stopPropagation();
    setIsZoomed(false);
    setContextMenuPos({ x: e.clientX, y: e.clientY });
  };

  const exhaustedState = isExhausted !== undefined ? isExhausted : Boolean(instance?.exhausted);
  const showFallback = imageFailed || error || (!artUrl && !loading);

  return (
    <div
      data-card-view={card.code}
      onClick={onClick}
      onMouseEnter={() => setIsZoomed(true)}
      onMouseLeave={() => setIsZoomed(false)}
      onContextMenu={handleContextMenu}
      className={`relative inline-block transition-all duration-200 select-none cursor-pointer z-table ${
        exhaustedState ? 'rotate-30 filter brightness-95 hover:brightness-100' : 'rotate-0'
      } ${className}`}
    >
      {/* Outer Comic Card Container */}
      <div
        className={`relative rounded-xl overflow-hidden border-comic border-comic-black shadow-comic transition-all duration-200 ease-out ${sizeClasses} ${
          isPlayable === false || isUsable === false
            ? 'filter grayscale contrast-75 brightness-90'
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
          <div className="absolute top-1.5 left-1.5 z-content bg-slate-950/90 text-amber-300 text-nano px-1.5 py-0.5 rounded-sm border border-comic-black shadow-xs font-bold uppercase pointer-events-none">
            EXHAUSTED
          </div>
        )}

        {/* Unplayable / Inactive Form Indicator Tag */}
        {!isFacedown && (isPlayable === false || isUsable === false) && (
          <div
            className="absolute top-1.5 right-1.5 z-content bg-slate-900/90 text-white text-nano px-1.5 py-0.5 rounded-sm border border-comic-black shadow-xs font-bold uppercase pointer-events-none"
            title={
              unusableReason || unplayableReason
                ? `Cannot use: ${unusableReason || unplayableReason}`
                : undefined
            }
          >
            {unusableBadge || (isPlayable === false ? 'CANNOT PLAY' : 'UNUSABLE')}
          </div>
        )}

        {/* Dynamic Traits Pop-Art Badge Row */}
        {!isFacedown && activeDynamicTraits.length > 0 && (
          <div
            data-testid="dynamic-traits-row"
            className="absolute top-1.5 left-1/2 -translate-x-1/2 z-content flex flex-wrap justify-center items-center gap-1 pointer-events-none max-w-[95%]"
          >
            {activeDynamicTraits.map((trait, idx) => (
              <span
                key={idx}
                data-testid={`dynamic-trait-badge-${trait.toLowerCase()}`}
                className="bg-cyan-300 text-slate-950 text-nano px-2 py-0.5 rounded-full border-2 border-comic-black shadow-comic-sm font-black uppercase tracking-wider flex items-center gap-1"
              >
                <span>✨</span>
                <span>{trait}</span>
              </span>
            ))}
          </div>
        )}

        {/* Facedown Card Back */}
        {isFacedown && (
          <div
            className="w-full h-full relative overflow-hidden flex items-center justify-center"
            style={{ backgroundColor: getCardBackFallbackColor(resolvedBackType) }}
            data-testid="card-view-facedown"
          >
            {!cardBackError ? (
              <img
                src={cardBackUrl(resolvedBackType)}
                alt={`${resolvedBackType} card back`}
                onError={() => setCardBackError(true)}
                className="w-full h-full object-cover"
                data-testid="card-back-image"
              />
            ) : (
              <div
                className="w-full h-full flex flex-col items-center justify-center p-2 text-center"
                style={{ backgroundColor: getCardBackFallbackColor(resolvedBackType) }}
                data-testid="card-back-fallback"
              >
                <span className="text-xs uppercase tracking-wider text-white bg-slate-950/70 px-2 py-0.5 rounded-sm border border-comic-black shadow-comic-xs">
                  {resolvedBackType}
                </span>
              </div>
            )}
            {instance?.isShell && (
              <span
                data-testid="drone-shell-label"
                className={`absolute inset-x-0 top-1/2 -translate-y-1/2 mx-auto w-fit -rotate-6 bg-comic-yellow text-comic-black text-xs font-black uppercase tracking-wider px-1.5 py-0.5 pointer-events-none ${style.badge}`}
              >
                {card.name}
              </span>
            )}
          </div>
        )}

        {/* 1. Real Card Art Image */}
        {!isFacedown && !showFallback && (
          <div className="relative w-full h-full bg-slate-900 flex items-center justify-center">
            {loading && (
              <div className="absolute inset-0 bg-amber-50 flex flex-col items-center justify-center p-2 text-center bg-bendy-dots animate-pulse">
                <span className="text-xs text-comic-black">LOADING ART...</span>
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
        {!isFacedown && showFallback && (
          <div className="w-full h-full bg-white flex flex-col justify-between p-3 relative bg-bendy-dots">
            {/* Top Bar: Cost & Type */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="w-6 h-6 rounded-full bg-slate-950 text-comic-yellow text-sm flex items-center justify-center font-bold border border-comic-black">
                  {card.cost ?? 0}
                </span>
                <span className="text-micro font-bold uppercase text-slate-500 bg-white/90 px-1 rounded-sm border border-slate-300">
                  {card.type}
                </span>
              </div>
              <h4 className="text-sm text-comic-black leading-tight line-clamp-2">{card.name}</h4>
              {card.subname && (
                <p className="text-micro font-bold text-comic-red italic">{card.subname}</p>
              )}
              {(card.printedTraits ||
                (card.traits && card.traits.length > 0) ||
                activeDynamicTraits.length > 0) && (
                <div className="text-nano font-semibold text-slate-600 italic flex items-center flex-wrap gap-1">
                  <span>{card.printedTraits || (card.traits || []).join('. ')}</span>
                  {activeDynamicTraits.map((trait, idx) => (
                    <span
                      key={idx}
                      data-testid={`fallback-dynamic-trait-${trait.toLowerCase()}`}
                      className="bg-cyan-300 text-slate-950 text-nano not-italic px-1.5 py-px rounded-full border border-comic-black font-black uppercase tracking-wide"
                    >
                      +{trait}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Card Body Text */}
            <div className="my-1 text-micro text-slate-700 line-clamp-5 leading-tight bg-white/80 p-1 rounded-sm border border-slate-200">
              <FormattedCardText text={card.text} />
            </div>

            {/* Bottom Bar: Faction & Resources */}
            <div className="border-t border-slate-300 pt-1 flex items-center justify-between text-nano font-semibold text-slate-600 bg-white/90">
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
            <div className="bg-comic-red text-white border-2 border-comic-black text-xs px-3 py-1 tracking-wider shadow-comic transform -rotate-6">
              MULLIGAN (DISCARD)
            </div>
          </div>
        )}

        {isKeepSelected && (
          <div className="absolute top-2 right-2 pointer-events-none">
            <div className="bg-emerald-500 text-slate-950 border border-comic-black text-micro px-2 py-0.5 font-bold tracking-wider rounded-sm shadow-comic-sm">
              KEEP
            </div>
          </div>
        )}

        {/* 4. Active Token & Status Badges Overlay */}
        {showTokens && instance && (
          <>
            {/* Left Badges: Damage, Threat, Status Cards */}
            <div className="absolute bottom-1.5 left-1.5 flex flex-wrap items-center gap-1 pointer-events-none z-content">
              {/* Damage Tokens */}
              {(instance.tokens?.damage ?? 0) > 0 && (
                <span className="bg-comic-red text-white text-xs px-2 py-0.5 rounded-full border border-comic-black shadow-comic-sm">
                  💥 {instance.tokens?.damage}
                </span>
              )}

              {/* Threat Tokens */}
              {(instance.tokens?.threat ?? 0) > 0 && (
                <span className="bg-comic-yellow text-comic-black text-xs px-2 py-0.5 rounded-full border border-comic-black shadow-comic-sm">
                  ⚠️ {instance.tokens?.threat}
                </span>
              )}

              {/* Status Cards (Tough, Stunned, Confused) */}
              {instance.statusCards &&
                instance.statusCards.map((st, i) => (
                  <span
                    key={i}
                    className={`text-micro px-1.5 py-0.5 rounded border border-comic-black uppercase shadow-comic-sm font-bold ${
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
              <div className="absolute bottom-1.5 right-1.5 z-content pointer-events-none">
                <div className="bg-emerald-600 text-white text-xs font-black min-w-[22px] h-[22px] px-1 rounded-md border-2 border-comic-black shadow-comic-sm flex items-center justify-center">
                  {instance.tokens?.counters}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {enableHoverZoom && isZoomed && (
        <CardHoverZoom
          card={card}
          instance={instance}
          isFacedown={isFacedownProp}
          cardBackType={cardBackType}
          artStats={artStats}
          officialArtOnly={officialArtOnly}
          dynamicTraits={dynamicTraits}
          showTokens={showTokens}
        />
      )}

      {/* Tabletop Right-Click Context Menu */}
      {contextMenuPos && (
        <CardContextMenu
          card={card}
          position={contextMenuPos}
          onClose={() => setContextMenuPos(null)}
        />
      )}
    </div>
  );
};

type CardHoverZoomProps = Pick<
  CardViewProps,
  | 'card'
  | 'instance'
  | 'isFacedown'
  | 'cardBackType'
  | 'artStats'
  | 'officialArtOnly'
  | 'dynamicTraits'
  | 'showTokens'
>;

/**
 * The one hover zoom (ADR-0082): an upright copy of the card pinned to the top right corner, in a
 * body-level portal above every layer. It ignores the pointer, so whatever is underneath stays usable.
 */
export const CardHoverZoom: React.FC<CardHoverZoomProps> = (props) => {
  const level = useOptionalGameSettings()?.cardZoomLevel ?? 'normal';
  const isLandscape = isLandscapeCard(props.card);

  // Runs before paint: the copy's unscaled size is only known once it is laid out.
  const fitToViewport = (el: HTMLDivElement | null) => {
    if (!el) return;
    const scale = cardZoomScale(
      isLandscape,
      level,
      { width: el.offsetWidth, height: el.offsetHeight },
      { width: window.innerWidth, height: window.innerHeight },
    );
    el.style.transform = `scale(${scale})`;
  };

  return createPortal(
    <div
      ref={fitToViewport}
      aria-hidden="true"
      data-card-zoom-layer={props.card.code}
      className={`fixed flex pointer-events-none ${Z_CLASS.zoom}`}
      style={{ top: CARD_ZOOM_MARGIN, right: CARD_ZOOM_MARGIN, transformOrigin: 'top right' }}
    >
      <CardViewImpl
        {...props}
        isExhausted={false}
        size="sm"
        enableHoverZoom={false}
        enableContextMenu={false}
        className="shadow-[0_25px_50px_-12px_rgba(0,0,0,0.85)]"
      />
    </div>,
    document.body,
  );
};

/** Skips re-rendering when a state update leaves its props identical (ADR-0089). */
export const CardView = React.memo(CardViewImpl);

export default CardView;
