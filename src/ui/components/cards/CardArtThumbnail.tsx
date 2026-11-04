import React, { useState } from 'react';
import { Newspaper } from 'lucide-react';
import { useCardArt } from '../../hooks/useCardArt';
import { useOptionalGameSession } from '../../context/GameStateContext';
import { firstInPlayArtStats } from '../../services/card-art-stats';
import {
  artPackArt,
  artPackHasStatImages,
  CardArtStats,
  remoteArtUrl,
} from '../../../data/content/card-art';

export interface CardArtThumbnailProps {
  cardCode?: string;
  cardName?: string;
  fallbackIcon?: React.ReactNode;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const CardArtThumbnailView: React.FC<CardArtThumbnailProps & { artStats?: CardArtStats }> = ({
  cardCode,
  cardName,
  fallbackIcon,
  size = 'md',
  className = '',
  artStats,
}) => {
  const [failedArtPackUrl, setFailedArtPackUrl] = useState<string | null>(null);
  const art = cardCode ? artPackArt(cardCode, artStats) : undefined;
  const usesArtPack = art !== undefined && art.url !== failedArtPackUrl;
  const { artUrl } = useCardArt(cardCode, { artStats, officialArt: !usesArtPack });
  const [imgFailed, setImgFailed] = useState(false);

  const remoteUrl = cardCode ? remoteArtUrl(cardCode) : '';
  const src = !imgFailed && artUrl ? artUrl : remoteUrl && !imgFailed ? remoteUrl : null;

  const sizeClasses = {
    xs: 'w-6 h-6',
    sm: 'w-10 h-10',
    md: 'w-14 h-14 sm:w-16 sm:h-16',
    lg: 'w-20 h-20 sm:w-24 sm:h-24',
  }[size];

  return (
    <div
      className={`${sizeClasses} aspect-square shrink-0 rounded-lg border-2 border-comic-black bg-amber-100 overflow-hidden shadow-comic-sm relative flex items-center justify-center select-none ${className}`}
    >
      {src ? (
        <img
          src={src}
          alt={cardName || cardCode || 'Card Art'}
          onError={() => (usesArtPack ? setFailedArtPackUrl(art.url) : setImgFailed(true))}
          className="w-full h-full object-cover object-top"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-[#f4ebd9] text-slate-800">
          {fallbackIcon || <Newspaper className="w-5 h-5 text-slate-700" />}
        </div>
      )}
    </div>
  );
};

/** A prompt only knows the card's code, so a stat image reads the stats of its in-play copy. */
const StatImageThumbnail: React.FC<CardArtThumbnailProps> = (props) => {
  const state = useOptionalGameSession()?.state;
  const artStats = state && props.cardCode ? firstInPlayArtStats(state, props.cardCode) : undefined;
  return <CardArtThumbnailView {...props} artStats={artStats} />;
};

/** Only stat images subscribe to game state, so other thumbnails keep their render cost. */
const CardArtThumbnailImpl: React.FC<CardArtThumbnailProps> = (props) =>
  props.cardCode && artPackHasStatImages(props.cardCode) ? (
    <StatImageThumbnail {...props} />
  ) : (
    <CardArtThumbnailView {...props} />
  );

/** Skips re-rendering when a state update leaves its props identical (ADR-0089). */
export const CardArtThumbnail = React.memo(CardArtThumbnailImpl);
