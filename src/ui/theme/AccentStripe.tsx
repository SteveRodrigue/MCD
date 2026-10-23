import React from 'react';
import { accentGradient } from './card-accents';
import { useCardAccent, useModalStyle } from './useModalStyle';

const BASE = 'absolute pointer-events-none';

/**
 * Card accent on a row, tile or slot (faction, hero or villain colours), drawn the way the active
 * theme draws it: ink stripe, corner flag, column rule, neon glow, sticker dot, index tab or HUD
 * brackets. Renders nothing when card accents are off. The parent must be `relative`.
 */
export const AccentStripe: React.FC<{ code: string }> = ({ code }) => {
  const accent = useCardAccent(code);
  const { style } = useModalStyle();
  if (!accent) return null;

  const [first, second = first] = accent.colors;
  const common = { 'aria-hidden': true, title: accent.label, 'data-accent': accent.kind } as const;

  switch (style.accent.edge) {
    case 'flag':
      return (
        <span
          {...common}
          className={`${BASE} left-0 top-0 w-8 h-8 rounded-tl-[inherit]`}
          style={{
            backgroundImage: accentGradient(accent.colors, '135deg'),
            clipPath: 'polygon(0 0, 100% 0, 0 100%)',
          }}
        />
      );
    case 'rule':
      return (
        <span {...common} className={`${BASE} inset-y-2 left-1.5 w-2`}>
          <span
            className="absolute inset-y-0 left-0 w-[3px]"
            style={{ backgroundImage: accentGradient(accent.colors, 'to bottom') }}
          />
          <span
            className="absolute inset-y-0 left-[6px] w-px opacity-70"
            style={{ backgroundColor: first }}
          />
        </span>
      );
    case 'glow':
      return (
        <span
          {...common}
          className={`${BASE} left-1 inset-y-2 w-[3px] rounded-full`}
          style={{
            backgroundImage: accentGradient(accent.colors, 'to bottom'),
            boxShadow: `0 0 10px 2px ${first}`,
          }}
        />
      );
    case 'dot':
      return (
        <span
          {...common}
          className={`${BASE} -top-2 -left-2 z-content w-5 h-5 rounded-full border-2 border-comic-black -rotate-12`}
          style={{ backgroundImage: accentGradient(accent.colors, '135deg') }}
        />
      );
    case 'tab':
      return (
        <span
          {...common}
          className={`${BASE} -top-2.5 left-4 z-content w-10 h-3 rounded-t-sm border border-b-0 border-black/50 overflow-hidden`}
          style={{ backgroundImage: accentGradient(accent.colors, 'to right') }}
        />
      );
    case 'bracket':
      return (
        <span {...common} className={`${BASE} inset-0`}>
          <span
            className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2"
            style={{ borderColor: first }}
          />
          <span
            className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2"
            style={{ borderColor: second }}
          />
        </span>
      );
    default:
      return (
        <span
          {...common}
          className={`${BASE} left-0 top-0 bottom-0 w-2 flex flex-col overflow-hidden rounded-l-[inherit]`}
        >
          {accent.colors.map((color) => (
            <span key={color} className="flex-1" style={{ backgroundColor: color }} />
          ))}
        </span>
      );
  }
};
