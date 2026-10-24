import React from 'react';
import { Search } from 'lucide-react';
import { useModalStyle } from '../../theme/useModalStyle';

/** One boost icon, drawn large enough to read: the winged chevron printed in the corner of a card. */
const BoostIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" data-boost-icon className="w-6 h-6 shrink-0" aria-hidden="true">
    <path
      d="M2.5 2.5h6.4L12 8.4l3.1-5.9h6.4L14 13v8.5h-4V13z"
      fill="#E0457B"
      stroke="#FFFFFF"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
);

export interface BoostIconsPillProps {
  /** Number of boost icons printed on the card. */
  icons: number;
  /** The card has a boost star effect. */
  star?: boolean;
  className?: string;
}

/**
 * A magnifier pill for the boost icons printed small in the bottom-right corner of a card: the same
 * icons, enlarged. Put it on the corner of the card in a parent that is `relative` and `group/boost`;
 * it fades out while the pointer is over the card, so the card itself can be read and never moves.
 */
export const BoostIconsPill: React.FC<BoostIconsPillProps> = ({
  icons,
  star = false,
  className = '',
}) => {
  const { style } = useModalStyle();
  const label = `${icons} boost ${icons === 1 ? 'icon' : 'icons'}${star ? ', boost star effect' : ''}`;

  return (
    <span
      role="img"
      aria-label={label}
      data-boost-icons={icons}
      className={`absolute bottom-1.5 right-1.5 z-raised pointer-events-none transition-opacity duration-150 group-hover/boost:opacity-0 inline-flex items-center gap-1 px-2 py-1 rounded-full shadow-lg ${style.chip} ${className}`}
    >
      <Search aria-hidden="true" className="w-3.5 h-3.5 shrink-0 opacity-80" />
      {icons > 0 ? (
        Array.from({ length: icons }, (_, i) => <BoostIcon key={i} />)
      ) : (
        <span className="text-[10px] font-black uppercase">none</span>
      )}
      {star && (
        <span aria-hidden="true" className="text-sm font-black leading-none">
          ★
        </span>
      )}
    </span>
  );
};
