import React from 'react';
import { useModalStyle } from '../useModalStyle';

export interface StatCounterProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  className?: string;
}

/** Icon plus number, the stat readout used on zones and cards (ATK, THW, DEF, resources). */
export const StatCounter: React.FC<StatCounterProps> = ({ icon, label, value, className = '' }) => {
  const { style } = useModalStyle();
  return (
    <span
      role="group"
      aria-label={`${label}: ${value}`}
      className={`inline-flex items-center gap-1.5 px-2 py-1 ${style.chip} ${className}`}
    >
      <span aria-hidden="true" className="flex items-center">
        {icon}
      </span>
      <span className="text-sm font-black leading-none tabular-nums">{value}</span>
    </span>
  );
};

export interface GaugeProps {
  label: string;
  value: number;
  max: number;
  /** hp reads green, threat reads red. The meaning never changes between themes. */
  kind: 'hp' | 'threat';
  className?: string;
}

const FILL: Record<GaugeProps['kind'], string> = {
  hp: 'bg-comic-green',
  threat: 'bg-comic-red',
};

/** Hit points or threat as a bar. The number is always printed so colour is never the only cue. */
export const Gauge: React.FC<GaugeProps> = ({ label, value, max, kind, className = '' }) => {
  const { style } = useModalStyle();
  const pct = max > 0 ? Math.min(100, Math.max(0, Math.round((value / max) * 100))) : 0;
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div
        className={`flex items-baseline justify-between text-mini font-black uppercase ${style.text}`}
      >
        <span>{label}</span>
        <span className="tabular-nums">
          {value}/{max}
        </span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        className={`h-3 overflow-hidden ${style.inset}`}
      >
        <div className={`h-full ${FILL[kind]}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

export interface RibbonProps {
  children: React.ReactNode;
  active?: boolean;
  className?: string;
}

/** Banner label: phase name, whose turn it is, the villain's name plate. */
export const Ribbon: React.FC<RibbonProps> = ({ children, active = false, className = '' }) => {
  const { style } = useModalStyle();
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-black uppercase tracking-wide ${
        active ? style.btnGo : style.chip
      } ${className}`}
    >
      {children}
    </span>
  );
};

export type StatTone = 'sky' | 'rose' | 'emerald' | 'slate' | 'indigo' | 'amber';

/** The colour of each stat is a game meaning (thwart blue, attack red, defense green...) and never changes with the theme. */
const STAT_TONE: Record<StatTone, { box: string; label: string; accent: string; suffix: string }> =
  {
    sky: {
      box: 'bg-sky-50',
      label: 'text-sky-800',
      accent: 'text-comic-blue',
      suffix: 'text-sky-600',
    },
    rose: {
      box: 'bg-rose-50',
      label: 'text-rose-800',
      accent: 'text-comic-red',
      suffix: 'text-rose-500',
    },
    emerald: {
      box: 'bg-emerald-50',
      label: 'text-emerald-800',
      accent: 'text-emerald-600',
      suffix: 'text-emerald-500',
    },
    slate: {
      box: 'bg-slate-100',
      label: 'text-slate-600',
      accent: 'text-slate-800',
      suffix: 'text-slate-600',
    },
    indigo: {
      box: 'bg-indigo-50',
      label: 'text-indigo-700',
      accent: 'text-indigo-950',
      suffix: 'text-indigo-950',
    },
    amber: {
      box: 'bg-amber-50',
      label: 'text-amber-800',
      accent: 'text-amber-600',
      suffix: 'text-amber-500',
    },
  };

export interface StatBoxProps {
  label: string;
  value: number | string;
  /** A positive bonus turns the value to the stat's colour and prints it after the value. */
  bonus?: number;
  tone: StatTone;
  title?: string;
  testId?: string;
  /** A little more height (the identity column of an alter-ego). */
  roomy?: boolean;
  /** Always draw the value in the stat's colour (the villain's stats). */
  alwaysAccent?: boolean;
}

/** One stat on a zone (THW, ATK, DEF, SCH, HS, RES, REC): a small labelled box whose shape follows the theme. */
export const StatBox: React.FC<StatBoxProps> = ({
  label,
  value,
  bonus = 0,
  tone,
  title,
  testId,
  roomy = false,
  alwaysAccent = false,
}) => {
  const { style } = useModalStyle();
  const t = STAT_TONE[tone];
  return (
    <div
      title={title}
      data-testid={testId}
      className={`flex flex-col items-center justify-center w-full px-1 ${roomy ? 'py-1' : 'py-0.5'} text-center ${style.badge} ${t.box}`}
    >
      <span className={`text-nano font-bold uppercase leading-none ${t.label}`}>{label}</span>
      <span
        className={`text-xs font-black leading-tight ${bonus > 0 || alwaysAccent ? t.accent : 'text-slate-900'}`}
      >
        {value}
        {bonus > 0 && <span className={`text-nano font-bold ml-0.5 ${t.suffix}`}>+{bonus}</span>}
      </span>
    </div>
  );
};

export interface StatStripItem {
  label: string;
  value: number | string;
  bonus?: number;
  /** The colour of the stat when it has a bonus: thwart green, attack red. */
  tone: 'emerald' | 'rose';
}

const STRIP_TONE: Record<StatStripItem['tone'], { accent: string; suffix: string }> = {
  emerald: { accent: 'text-emerald-600', suffix: 'text-emerald-600' },
  rose: { accent: 'text-comic-red', suffix: 'text-rose-500' },
};

/** A thin line of stats over a card (an ally's THW and ATK). Its colours are fixed: it sits on a light strip. */
export const StatStrip: React.FC<{ items: readonly StatStripItem[] }> = ({ items }) => {
  const { style } = useModalStyle();
  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-0.5 bg-white/95 text-nano font-bold mb-1 z-raised ${style.badge}`}
    >
      {items.map((item, i) => {
        const bonus = item.bonus ?? 0;
        return (
          <React.Fragment key={item.label}>
            {i > 0 && <div className="h-3 w-px bg-slate-300" />}
            <div className="flex items-center gap-0.5">
              <span className="text-slate-500 uppercase text-nano">{item.label}</span>
              <span
                className={`flex items-center ${bonus > 0 ? `${STRIP_TONE[item.tone].accent} font-black` : 'text-slate-900'}`}
              >
                {item.value}
                {bonus > 0 && (
                  <span className={`text-nano ml-0.5 ${STRIP_TONE[item.tone].suffix}`}>
                    +{bonus}
                  </span>
                )}
              </span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};
