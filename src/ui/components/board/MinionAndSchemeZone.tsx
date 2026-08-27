import React from 'react';
import { ShieldAlert, Flame, AlertOctagon } from 'lucide-react';
import { SideSchemeState, CardInstance, StatusCard } from '../../../engine/models';
import { CardView } from '../cards/CardView';

interface MinionAndSchemeZoneProps {
  sideSchemes: SideSchemeState[];
  engagedMinions: CardInstance[];
}

export const MinionAndSchemeZone: React.FC<MinionAndSchemeZoneProps> = ({
  sideSchemes,
  engagedMinions,
}) => {

  return (
    <section className="comic-panel p-4 bg-amber-50/50 relative">
      {/* Zone Title Ribbon */}
      <div className="absolute -top-3 left-4 bg-comic-yellow text-comic-black border border-comic-black font-comic text-xs px-3 py-0.5 tracking-wider shadow-comic-sm flex items-center gap-1">
        <ShieldAlert className="w-3.5 h-3.5 text-comic-red" />
        <span>ACTIVE SIDE SCHEMES & ENGAGED MINIONS</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        {/* 1. Side Schemes Row */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-slate-600">
            <Flame className="w-4 h-4 text-comic-red" />
            <span>Active Side Schemes ({sideSchemes.length})</span>
          </div>

          {sideSchemes.length > 0 ? (
            <div className="flex flex-wrap gap-4 items-center">
              {sideSchemes.map((scheme) => (
                <div key={scheme.instanceId} className="flex flex-col items-center gap-1">
                  <CardView card={scheme.card} size="sm" enableHoverZoom={true} />
                  <div className="bg-comic-yellow text-comic-black border border-comic-black font-comic text-xs px-2 py-0.5 rounded-full shadow-comic-sm">
                    ⚠️ {scheme.threat} THREAT
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-3 border-2 border-dashed border-slate-300 rounded-lg text-center text-xs text-slate-400 font-semibold bg-white/50">
              No active side schemes.
            </div>
          )}
        </div>

        {/* 2. Engaged Minions Row */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-slate-600">
            <AlertOctagon className="w-4 h-4 text-comic-red" />
            <span>Engaged Minions ({engagedMinions.length})</span>
          </div>

          {engagedMinions.length > 0 ? (
            <div className="flex flex-wrap gap-4 items-center">
              {engagedMinions.map((minion) => {
                const isGuard = minion.card.traits?.includes('Guard') || minion.card.text?.includes('Guard');
                const isTough = minion.statusCards?.includes(StatusCard.TOUGH) ?? false;

                return (
                  <div key={minion.instanceId} className="flex flex-col items-center gap-1">
                    <CardView card={minion.card} instance={minion} size="sm" enableHoverZoom={true} />
                    <div className="flex items-center gap-1">
                      {isGuard && (
                        <span className="bg-slate-900 text-comic-yellow border border-comic-black font-comic text-[10px] px-1.5 py-0.5 rounded font-bold">
                          GUARD
                        </span>
                      )}
                      {isTough && (
                        <span className="bg-sky-400 text-slate-950 border border-comic-black font-comic text-[10px] px-1.5 py-0.5 rounded font-bold">
                          TOUGH
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-3 border-2 border-dashed border-slate-300 rounded-lg text-center text-xs text-slate-400 font-semibold bg-white/50">
              No minions engaged. Perimeter clear!
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default MinionAndSchemeZone;
