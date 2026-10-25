import React from 'react';
import { useModalStyle } from '../../theme/useModalStyle';

interface EmptyZoneBadgeProps {
  /** Which zone: `minions`, `tableau`, `side-schemes`, `out-of-play`. Names the test id. */
  zone: string;
  icon: React.ReactNode;
  label: string;
  /** The full sentence, for hover and screen readers. */
  title: string;
}

/**
 * What an empty zone leaves on the board: its name and a zero, in the title of the zone that owns it.
 * The zone itself is not drawn while it is empty (Issue #379).
 */
export const EmptyZoneBadge: React.FC<EmptyZoneBadgeProps> = ({ zone, icon, label, title }) => {
  const { style } = useModalStyle();
  return (
    <span
      role="note"
      data-testid={`empty-zone-badge-${zone}`}
      title={title}
      aria-label={title}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-micro font-black uppercase border-dashed ${style.inset} ${style.muted}`}
    >
      {icon}
      <span>{label} 0</span>
    </span>
  );
};

export default EmptyZoneBadge;
