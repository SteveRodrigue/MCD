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
