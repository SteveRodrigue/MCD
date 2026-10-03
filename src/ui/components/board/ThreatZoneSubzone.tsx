import React from 'react';

interface ThreatZoneSubzoneProps {
  /** Stable test id, e.g. `threat-zone-obligations` */
  testId: string;
  label: string;
  count?: number;
  /** Let the sub-zone grow to fill remaining row width (used for the Minions placeholder) */
  grow?: boolean;
  children: React.ReactNode;
}

/**
 * One ordered sub-zone of a hero seat's Threat Zone (Encounter Facedown, Obligations, Minions
 * Engaged, and future persistent encounter cards). Presentational only: each sub-zone reads its
 * own PlayerState array in HeroZone, so adding a sub-zone is one more entry in that ordered list.
 */
export const ThreatZoneSubzone: React.FC<ThreatZoneSubzoneProps> = ({
  testId,
  label,
  count,
  grow,
  children,
}) => (
  <section data-testid={testId} className={`flex flex-col gap-1 ${grow ? 'flex-1' : ''}`}>
    <span className="self-start bg-slate-900 text-comic-yellow border border-comic-black font-comic text-[9px] px-1.5 py-0.5 rounded font-bold uppercase shadow-comic-xs">
      {label}
      {count !== undefined ? ` (${count})` : ''}
    </span>
    <div className="flex flex-wrap items-center gap-4">{children}</div>
  </section>
);

export default ThreatZoneSubzone;
