import React from 'react';
import { Sparkles } from 'lucide-react';
import { CardRef } from '../../theme/CardRef';
import { ModalScaffold } from '../../theme/ModalScaffold';
import type { VerbColor } from '../../theme/modal-styles';
import { useModalStyle } from '../../theme/useModalStyle';
import { ActionRow } from './ActionRow';

export type BadgeTone = 'danger' | 'info' | 'warn' | 'alert';

const BADGE_TONES: Record<BadgeTone, string> = {
  danger: 'bg-comic-red text-white',
  info: 'bg-comic-blue text-white',
  warn: 'bg-amber-400 text-slate-950',
  alert: 'bg-rose-500 text-white',
};

export interface TargetBadge {
  label: string;
  tone: BadgeTone;
  icon?: React.ReactNode;
  pulse?: boolean;
}

export interface TargetRow {
  id: string;
  name: string;
  /** Card code of the target, for its thumbnail and accent. */
  code?: string;
  /** Icon in the leading box. */
  icon: React.ReactNode;
  /** Strong rows (villain, main scheme) get the strong badge colour. */
  strong: boolean;
  kindLabel: string;
  badges: TargetBadge[];
  /** Detail line under the name (hit points, threat, reason it is blocked). */
  details: React.ReactNode;
  disabled?: boolean;
  actionLabel: string;
}

export interface TargetSelectionModalProps {
  title: string;
  verb: VerbColor;
  headerIcon: React.ReactNode;
  /** Small line above the title, e.g. "Hero Strike • 3 DMG". */
  kicker: string;
  headerRight?: React.ReactNode;
  /** The acting card; shown with its thumbnail in the header and the banner. */
  actor: { name: string; code?: string };
  /** Text after the actor's name in the banner, e.g. "is ready to strike!". */
  actorLine: string;
  /** Value chip in the banner, e.g. "3 ATK". */
  actorChip: string;
  prompt: string;
  rows: TargetRow[];
  cancelLabel: string;
  onPick: (id: string) => void;
  onClose: () => void;
  testId?: string;
}

/**
 * One modal for "pick a card to act on" prompts (attack targets, thwart targets): header with the
 * acting card, a banner, one row per target with its thumbnail and accent, and a cancel button.
 */
export const TargetSelectionModal: React.FC<TargetSelectionModalProps> = ({
  title,
  verb,
  headerIcon,
  kicker,
  headerRight,
  actor,
  actorLine,
  actorChip,
  prompt,
  rows,
  cancelLabel,
  onPick,
  onClose,
  testId,
}) => {
  const { style } = useModalStyle();

  return (
    <ModalScaffold
      title={title}
      kicker={kicker}
      verb={verb}
      trigger={actor}
      icon={headerIcon}
      headerRight={headerRight}
      onClose={onClose}
      maxWidthClass="max-w-lg"
      testId={testId}
      footer={
        <button
          type="button"
          onClick={onClose}
          className={`ml-auto font-comic text-xs font-black py-2 px-4 uppercase cursor-pointer ${style.btnMove}`}
        >
          {cancelLabel}
        </button>
      }
    >
      <div className={`flex items-center justify-between gap-2 px-3 py-2 ${style.inset}`}>
        <div className="flex items-center gap-2 min-w-0 text-xs sm:text-sm font-bold">
          <Sparkles className={`w-4 h-4 shrink-0 ${style.emphasis}`} />
          <span className="min-w-0">
            <CardRef code={actor.code} name={actor.name} size="xs" /> {actorLine}
          </span>
        </div>
        <span className={`font-mono text-xs font-black px-2 py-0.5 shrink-0 ${style.chip}`}>
          {actorChip}
        </span>
      </div>

      <p className={`text-xs font-bold uppercase tracking-wider ${style.muted}`}>{prompt}</p>

      <div className="grid grid-cols-1 gap-2.5">
        {rows.map((row) => (
          <ActionRow
            key={row.id}
            icon={row.icon}
            tone={row.strong ? 'danger' : 'warn'}
            disabled={row.disabled}
            anchorCode={row.code ?? ''}
            actionLabel={row.actionLabel}
            onClick={() => onPick(row.id)}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <CardRef
                code={row.code}
                name={row.name}
                size="sm"
                className={`text-sm sm:text-base ${style.optionTitleHover}`}
              />
              <span
                className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border border-comic-black ${
                  row.strong ? 'bg-comic-red text-white' : 'bg-comic-yellow text-slate-950'
                }`}
              >
                {row.kindLabel}
              </span>
              {row.badges.map((badge) => (
                <span
                  key={badge.label}
                  className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border border-comic-black flex items-center gap-1 ${
                    BADGE_TONES[badge.tone]
                  } ${badge.pulse ? 'animate-pulse' : ''}`}
                >
                  {badge.icon}
                  {badge.label}
                </span>
              ))}
            </div>
            <div className={`flex items-center gap-2 mt-0.5 text-xs ${style.muted}`}>
              {row.details}
            </div>
          </ActionRow>
        ))}
      </div>
    </ModalScaffold>
  );
};
