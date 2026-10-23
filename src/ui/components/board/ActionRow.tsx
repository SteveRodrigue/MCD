import React from 'react';
import { AccentStripe } from '../../theme/AccentStripe';
import { useModalStyle } from '../../theme/useModalStyle';

export type ActionTone = 'danger' | 'info' | 'warn';

const ICON_TONES: Record<ActionTone, string> = {
  danger: 'bg-comic-red text-white',
  info: 'bg-comic-blue text-white',
  warn: 'bg-amber-400 text-slate-950',
};

export interface ActionRowProps {
  icon: React.ReactNode;
  tone: ActionTone;
  disabled?: boolean;
  /** Card the row is about: its accent stripe is drawn and the row counts as showing its thumbnail. */
  anchorCode?: string;
  /** Right-hand chip, e.g. "STRIKE ➔". */
  actionLabel: string;
  /** Extra content before the chip (consequential damage and the like). */
  accessory?: React.ReactNode;
  onClick: () => void;
  testId?: string;
  /** The row's own content: title, badges and detail lines. */
  children: React.ReactNode;
}

/**
 * One choice in an action list (attack, thwart, use an ability, pick a target): coloured icon box,
 * content, action chip. Disabled rows are dashed and dimmed. Styling comes from the active theme.
 */
export const ActionRow: React.FC<ActionRowProps> = ({
  icon,
  tone,
  disabled = false,
  anchorCode,
  actionLabel,
  accessory,
  onClick,
  testId,
  children,
}) => {
  const { style } = useModalStyle();

  return (
    <button
      type="button"
      disabled={disabled}
      data-testid={testId}
      data-card-anchor={anchorCode}
      onClick={onClick}
      className={`group relative w-full p-3 pl-4 flex items-center justify-between gap-3 text-left transition-all ${
        style.option
      } ${disabled ? 'opacity-60 cursor-not-allowed border-dashed' : 'cursor-pointer active:translate-y-0.5'}`}
    >
      {anchorCode !== undefined && <AccentStripe code={anchorCode} />}
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`p-2 rounded-lg border-2 border-comic-black shrink-0 ${
            disabled ? 'bg-slate-300 text-slate-500' : ICON_TONES[tone]
          }`}
        >
          {icon}
        </div>
        <div className="min-w-0">{children}</div>
      </div>

      <div className="shrink-0 flex items-center gap-1.5">
        {accessory}
        <span
          className={`font-comic text-xs font-black uppercase px-2.5 py-1 ${style.chip} ${
            disabled ? 'opacity-60' : ''
          }`}
        >
          {actionLabel}
        </span>
      </div>
    </button>
  );
};
