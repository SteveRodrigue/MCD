import React, { useState } from 'react';
import { Newspaper } from 'lucide-react';
import { useCardArt } from '../../hooks/useCardArt';
import { getRemoteMarvelCdbUrl } from '../../services/card-cache-service';

export interface CardArtThumbnailProps {
  cardCode?: string;
  cardName?: string;
  fallbackIcon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const CardArtThumbnail: React.FC<CardArtThumbnailProps> = ({
  cardCode,
  cardName,
  fallbackIcon,
  size = 'md',
  className = '',
}) => {
  const { artUrl } = useCardArt(cardCode);
  const [imgFailed, setImgFailed] = useState(false);

  const src =
    !imgFailed && artUrl ? artUrl : cardCode && !imgFailed ? getRemoteMarvelCdbUrl(cardCode) : null;

  const sizeClasses = {
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
          onError={() => setImgFailed(true)}
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
