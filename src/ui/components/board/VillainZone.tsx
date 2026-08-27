import React from 'react';
import { Skull, AlertTriangle, Layers, Flame } from 'lucide-react';
import { VillainState, MainSchemeState, SideSchemeState, CardInstance, StatusCard } from '../../../engine/models';
import { CardView } from '../cards/CardView';

interface VillainZoneProps {
  villain: VillainState;
  mainScheme: MainSchemeState;
  sideSchemes: SideSchemeState[];
  encounterDeckCount: number;
  encounterDiscard: CardInstance[];
  accelerationTokens: number;
}

export const VillainZone: React.FC<VillainZoneProps> = ({
  villain,
  mainScheme,
  sideSchemes,
  encounterDeckCount,
  encounterDiscard,
  accelerationTokens,
}) => {
  const threatPercent = Math.min(100, (mainScheme.threat / mainScheme.targetThreat) * 100);
  const healthPercent = Math.max(0, (villain.health / villain.maxHealth) * 100);

  const topDiscard = encounterDiscard[encounterDiscard.length - 1];

  return (
    <section className="comic-panel p-4 bg-white/95 relative shadow-comic">
      {/* Zone Title Ribbon */}
      <div className="absolute -top-3 left-4 bg-comic-red text-white border border-comic-black font-comic text-xs px-3 py-0.5 tracking-wider shadow-comic-sm flex items-center gap-1">
        <Skull className="w-3.5 h-3.5" />
        <span>VILLAIN & SCENARIO ZONE</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start pt-2">
        {/* 1. Encounter Deck & Discard Piles (Left of Villain: 2 cols) */}
        <div className="md:col-span-2 flex md:flex-col items-center justify-center gap-3">
          {/* Encounter Draw Pile */}
          <div className="flex flex-col items-center">
            <div className="w-20 h-28 bg-slate-900 border-2 border-comic-black rounded-lg shadow-comic-sm flex flex-col items-center justify-center p-2 text-center relative overflow-hidden bg-bendy-dots">
              <Layers className="w-6 h-6 text-comic-yellow mb-1" />
              <span className="font-comic text-lg text-white leading-none">{encounterDeckCount}</span>
              <span className="text-[9px] font-bold text-slate-400 uppercase">DECK</span>
            </div>
          </div>

          {/* Encounter Discard Pile */}
          <div className="flex flex-col items-center">
            {topDiscard ? (
              <div className="relative">
                <CardView card={topDiscard.card} size="sm" showTokens={false} enableHoverZoom={true} />
                <span className="absolute -bottom-2 -right-2 bg-slate-900 text-white font-comic text-xs px-1.5 py-0.5 rounded-full border border-comic-black">
                  {encounterDiscard.length}
                </span>
              </div>
            ) : (
              <div className="w-20 h-28 bg-slate-100 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center text-center p-1">
                <span className="font-comic text-xs text-slate-400">DISCARD</span>
                <span className="text-[10px] text-slate-400 font-bold">EMPTY</span>
              </div>
            )}
          </div>
        </div>

        {/* 2. Villain Panel & Attachments (Center-Left: 4 cols) */}
        <div className="md:col-span-4 flex flex-col items-center sm:items-start gap-2.5 bg-rose-50/70 p-3 rounded-lg border border-comic-black">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-1.5">
              <Skull className="w-4 h-4 text-comic-red" />
              <span className="font-comic text-base text-comic-black">{villain.card.name}</span>
            </div>
            <span className="bg-slate-950 text-white font-comic text-xs px-2 py-0.5 rounded border border-comic-black">
              {villain.card.stage ? `STAGE ${villain.card.stage}` : 'VILLAIN'}
            </span>
          </div>

          {/* Villain Health Bar & Dial */}
          <div className="w-full space-y-1">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-slate-600">Health:</span>
              <span className="text-comic-red font-comic text-sm">
                {villain.health} / {villain.maxHealth} HP
              </span>
            </div>
            <div className="w-full bg-slate-200 h-3.5 rounded-full overflow-hidden border-2 border-comic-black shadow-comic-sm">
              <div
                className="bg-comic-red h-full transition-all duration-300"
                style={{ width: `${healthPercent}%` }}
              />
            </div>
          </div>

          {/* Status Overlay Badges */}
          {villain.statusCards.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {villain.statusCards.map((st, i) => (
                <span
                  key={i}
                  className={`font-comic text-xs px-2 py-0.5 rounded border border-comic-black uppercase shadow-comic-sm font-bold ${
                    st === StatusCard.TOUGH
                      ? 'bg-sky-400 text-slate-950'
                      : st === StatusCard.STUNNED
                        ? 'bg-amber-300 text-slate-950'
                        : 'bg-fuchsia-300 text-slate-950'
                  }`}
                >
                  {st}
                </span>
              ))}
            </div>
          )}

          {/* Villain Card & Attachments */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1 mx-auto sm:mx-0">
            <CardView card={villain.card} size="sm" showTokens={false} enableHoverZoom={true} />

            {/* Attachments */}
            {villain.attachments.map((att) => (
              <div key={att.instanceId} className="flex flex-col items-center">
                <CardView card={att.card} instance={att} size="sm" enableHoverZoom={true} />
                <span className="text-[10px] font-bold uppercase text-comic-red mt-0.5">Attachment</span>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Main Scheme Panel (Right of Villain: 4 cols) */}
        <div className="md:col-span-4 flex flex-col items-center sm:items-start gap-2.5 bg-amber-50/70 p-3 rounded-lg border border-comic-black">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-comic-red" />
              <span className="font-comic text-base text-comic-black">{mainScheme.card.name}</span>
            </div>
            {accelerationTokens > 0 && (
              <span className="bg-comic-yellow text-comic-black border border-comic-black font-comic text-[10px] px-2 py-0.5 rounded-full shadow-comic-sm animate-pulse">
                ⚡ +{accelerationTokens} ACCELERATION
              </span>
            )}
          </div>

          {/* Threat Meter Gauge */}
          <div className="w-full space-y-1">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-slate-600">Threat Limit:</span>
              <span className="text-comic-blue font-comic text-sm">
                {mainScheme.threat} / {mainScheme.targetThreat} THREAT
              </span>
            </div>
            <div className="w-full bg-slate-200 h-3.5 rounded-full overflow-hidden border-2 border-comic-black shadow-comic-sm">
              <div
                className={`h-full transition-all duration-300 ${
                  threatPercent > 75 ? 'bg-comic-red' : threatPercent > 40 ? 'bg-comic-yellow' : 'bg-comic-blue'
                }`}
                style={{ width: `${threatPercent}%` }}
              />
            </div>
          </div>

          {/* Main Scheme Card in Landscape */}
          <div className="mx-auto sm:mx-0 pt-1">
            <CardView card={mainScheme.card} size="md" showTokens={false} enableHoverZoom={true} />
          </div>
        </div>

        {/* 4. Active Side Schemes & Player Schemes (Right of Main Scheme: 2 cols) */}
        <div className="md:col-span-2 flex flex-col gap-2 bg-slate-50/90 p-2.5 rounded-lg border border-comic-black min-h-[220px]">
          <div className="flex items-center gap-1 text-[11px] font-bold uppercase text-slate-600 border-b border-slate-200 pb-1">
            <Flame className="w-3.5 h-3.5 text-comic-red" />
            <span>Side Schemes ({sideSchemes.length})</span>
          </div>

          {sideSchemes.length > 0 ? (
            <div className="flex flex-col gap-3 items-center overflow-y-auto max-h-[260px] p-1">
              {sideSchemes.map((scheme) => (
                <div key={scheme.instanceId} className="flex flex-col items-center gap-1">
                  <CardView card={scheme.card} size="sm" enableHoverZoom={true} />
                  <span className="bg-comic-yellow text-comic-black border border-comic-black font-comic text-[10px] px-1.5 py-0.5 rounded-full shadow-comic-sm">
                    ⚠️ {scheme.threat} THREAT
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-2 text-center text-[11px] text-slate-400 font-semibold border border-dashed border-slate-300 rounded">
              <span>No side schemes active</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default VillainZone;
