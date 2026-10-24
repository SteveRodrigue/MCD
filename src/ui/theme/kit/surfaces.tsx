import React from 'react';
import { STAR_CLIP } from '../comic-shapes';
import { themeFontVars } from '../modal-styles';
import { useModalStyle } from '../useModalStyle';
import { useThemeExtras } from '../useThemeExtras';

export interface ZonePanelProps {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/** A named area of the table (hero zone, villain zone, hand tray, threat zone). */
export const ZonePanel: React.FC<ZonePanelProps> = ({ title, right, children, className = '' }) => {
  const { style } = useModalStyle();
  return (
    <section className={`${style.panel} ${style.text} ${className}`}>
      <header className={`flex items-center justify-between gap-2 px-3 py-1.5 ${style.panelHead}`}>
        <h3 className="text-xs font-black uppercase tracking-wide">{title}</h3>
        {right}
      </header>
      <div className="p-3">{children}</div>
    </section>
  );
};

export interface MenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  onSelect?: () => void;
}

/** Context menu on a card or zone: a short list of actions. */
export const ThemedMenu: React.FC<{ title?: string; items: readonly MenuItem[] }> = ({
  title,
  items,
}) => {
  const { style } = useModalStyle();
  return (
    <div role="menu" aria-label={title} className={`min-w-48 ${style.panel} ${style.text}`}>
      {title && (
        <div className={`px-3 py-1.5 text-mini font-black uppercase ${style.panelHead}`}>
          {title}
        </div>
      )}
      <ul className="p-1.5 space-y-1">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={item.onSelect}
              className={`group w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-sm font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${style.option}`}
            >
              {item.icon}
              <span className={style.optionTitleHover}>{item.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export interface ToastProps {
  title: string;
  children?: React.ReactNode;
  tone?: 'info' | 'good' | 'bad';
}

const TONE_RULE: Record<NonNullable<ToastProps['tone']>, string> = {
  info: 'border-l-comic-blue',
  good: 'border-l-comic-green',
  bad: 'border-l-comic-red',
};

/** Short notice. The left edge carries the meaning, the words always say it too. */
export const ThemedToast: React.FC<ToastProps> = ({ title, children, tone = 'info' }) => {
  const { style } = useModalStyle();
  return (
    <div
      role="status"
      className={`max-w-sm border-l-[6px] px-3 py-2 ${style.panel} ${style.text} ${TONE_RULE[tone]}`}
    >
      <div className="text-xs font-black uppercase">{title}</div>
      {children && <div className={`text-sm ${style.muted}`}>{children}</div>}
    </div>
  );
};

export interface SplashProps {
  amount: number;
  kind: 'damage' | 'heal' | 'threat';
}

const SPLASH_WORD: Record<SplashProps['kind'], string> = {
  damage: 'damage',
  heal: 'healed',
  threat: 'threat',
};

/** Floating number that appears when damage, healing or threat lands. Uses the theme's sound-effect look. */
export const ThemedSplash: React.FC<SplashProps> = ({ amount, kind }) => {
  const { style } = useModalStyle();
  const tone =
    kind === 'heal'
      ? 'bg-comic-green text-white'
      : kind === 'threat'
        ? 'bg-purple-800 text-amber-300'
        : style.fx.className;
  return (
    <div
      role="status"
      aria-label={`${amount} ${SPLASH_WORD[kind]}`}
      className={`inline-flex flex-col items-center justify-center w-24 h-24 font-black rotate-6 ${
        style.fx.shape === 'star' ? '' : 'border-4 border-black rounded-lg'
      } ${tone}`}
      style={style.fx.shape === 'star' ? { clipPath: STAR_CLIP } : undefined}
    >
      <span className="font-comic text-3xl leading-none">
        {kind === 'heal' ? `+${amount}` : `-${amount}`}
      </span>
      <span className="text-micro uppercase">{SPLASH_WORD[kind]}</span>
    </div>
  );
};

/** The table the board sits on: background colour, texture, type colour. */
export const ThemedTable: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => {
  const { table } = useThemeExtras();
  const { style } = useModalStyle();
  return (
    <div
      className={`relative isolate overflow-hidden ${table.bg} ${table.text} font-body ${className}`}
      style={themeFontVars(style)}
    >
      <div
        aria-hidden="true"
        className={`absolute inset-0 pointer-events-none ${table.textureClass}`}
        style={table.texture}
      />
      <div className="relative">{children}</div>
    </div>
  );
};
