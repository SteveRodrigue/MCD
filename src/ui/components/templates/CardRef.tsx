import React from 'react';
import { CardArtThumbnail } from '../cards/CardArtThumbnail';
import { accentGradient } from './card-accents';
import { useCardAccent, useModalStyle } from './useModalStyle';

export interface CardReference {
  code: string;
  name: string;
}

export interface CardRefProps extends CardReference {
  size?: 'xs' | 'sm' | 'lg';
  /** Name under the thumbnail instead of beside it (tiles). */
  stacked?: boolean;
  className?: string;
}

/**
 * The only way a modal template writes a card name (Card Anchoring Rule): the name always
 * travels with its thumbnail. Never interpolate a card name as plain text in modal JSX.
 * When card accents are on, the name is marked the way the active theme marks it.
 */
export const CardRef: React.FC<CardRefProps> = ({
  code,
  name,
  size = 'xs',
  stacked = false,
  className = '',
}) => {
  const accent = useCardAccent(code);
  const { style } = useModalStyle();
  const mode = style.accent.name;

  let nameStyle: React.CSSProperties | undefined;
  if (accent && mode === 'marker') {
    nameStyle = {
      backgroundImage: `linear-gradient(transparent 52%, ${accent.colors[0]}66 52%)`,
      padding: '0 3px',
    };
  } else if (accent && mode === 'underline') {
    nameStyle = {
      backgroundImage: accentGradient(accent.colors, 'to right'),
      backgroundSize: '100% 3px',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'bottom',
      paddingBottom: 2,
    };
  }

  return (
    <span
      data-card-ref={code}
      className={`inline-flex items-center gap-1.5 align-middle max-w-full ${
        stacked ? 'flex-col' : ''
      } ${className}`}
    >
      <CardArtThumbnail cardCode={code} cardName={name} size={size} />
      {accent && mode === 'dot' && (
        <span
          aria-hidden="true"
          className="inline-block w-2.5 h-2.5 rounded-full shrink-0 border border-black/40"
          style={{ backgroundImage: accentGradient(accent.colors, '135deg') }}
        />
      )}
      <span
        data-accent={accent?.kind}
        className={`font-black ${stacked ? 'text-center leading-tight' : 'truncate'}`}
        style={nameStyle}
      >
        {name}
      </span>
    </span>
  );
};
