import React from 'react';
import { Shield, Heart, Users, Layers, Zap } from 'lucide-react';
import { PlayerState, StatusCard } from '../../../engine/models';
import { CardView } from '../cards/CardView';

interface HeroZoneProps {
  player: PlayerState;
}

export const HeroZone: React.FC<HeroZoneProps> = ({ player }) => {
  const healthPercent = Math.max(0, (player.health / player.maxHealth) * 100);
  const topDiscard = player.discard[player.discard.length - 1];

  return (
    <section className="comic-panel p-4 bg-white/95 relative">
      {/* Zone Title Ribbon */}
      <div className="absolute -top-3 left-4 bg-comic-blue text-white border border-comic-black font-comic text-xs px-3 py-0.5 tracking-wider shadow-comic-sm flex items-center gap-1">
        <Shield className="w-3.5 h-3.5" />
        <span>HERO PLAY AREA • {player.name}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pt-2">
        {/* 1. Player Deck & Discard Piles (Left: 2 cols) */}
        <div className="lg:col-span-2 flex lg:flex-col items-center justify-center gap-4">
          {/* Player Draw Pile */}
          <div className="flex flex-col items-center">
            <div className="w-20 h-28 bg-comic-blue border-2 border-comic-black rounded-lg shadow-comic-sm flex flex-col items-center justify-center p-2 text-center relative overflow-hidden bg-bendy-dots">
              <Layers className="w-6 h-6 text-white mb-1" />
              <span className="font-comic text-lg text-white leading-none">{player.deck.length}</span>
              <span className="text-[9px] font-bold text-sky-200 uppercase">DECK</span>
            </div>
          </div>

          {/* Player Discard Pile */}
          <div className="flex flex-col items-center">
            {topDiscard ? (
              <div className="relative">
                <CardView card={topDiscard.card} size="sm" showTokens={false} enableHoverZoom={true} />
                <span className="absolute -bottom-2 -right-2 bg-slate-900 text-white font-comic text-xs px-1.5 py-0.5 rounded-full border border-comic-black">
                  {player.discard.length}
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

        {/* 2. Identity Card & Health Dial (Middle-Left: 4 cols) */}
        <div className="lg:col-span-4 flex flex-col items-center sm:items-start gap-3 bg-sky-50/70 p-3 rounded-lg border border-comic-black">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-comic-blue" />
              <span className="font-comic text-base text-comic-black">
                {player.activeFormCard.name}
              </span>
            </div>
            <span
              className={`font-comic text-xs px-2 py-0.5 rounded border border-comic-black uppercase shadow-comic-sm ${
                player.currentForm === 'hero'
                  ? 'bg-comic-red text-white'
                  : 'bg-amber-300 text-slate-950'
              }`}
            >
              {player.currentForm === 'hero' ? 'HERO' : 'ALTER-EGO'}
            </span>
          </div>

          {/* Health Bar & Dial */}
          <div className="w-full space-y-1">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-slate-600 flex items-center gap-1">
                <Heart className="w-3.5 h-3.5 text-comic-red fill-comic-red" />
                Hero Health:
              </span>
              <span className="text-comic-blue font-comic text-sm">
                {player.health} / {player.maxHealth} HP
              </span>
            </div>
            <div className="w-full bg-slate-200 h-3.5 rounded-full overflow-hidden border-2 border-comic-black shadow-comic-sm">
              <div
                className="bg-comic-blue h-full transition-all duration-300"
                style={{ width: `${healthPercent}%` }}
              />
            </div>
          </div>

          {/* Status Overlay Badges */}
          {player.statusCards.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {player.statusCards.map((st, i) => (
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

          {/* Identity Card */}
          <div className="mx-auto sm:mx-0 pt-1">
            <CardView
              card={player.activeFormCard}
              isExhausted={player.exhausted}
              size="sm"
              showTokens={false}
              enableHoverZoom={true}
            />
          </div>
        </div>

        {/* 3. Allies Row & Tableau Supports / Upgrades (Right: 6 cols) */}
        <div className="lg:col-span-6 space-y-4">
          {/* Allies Sub-Zone */}
          <div className="bg-amber-50/50 p-3 rounded-lg border border-comic-black space-y-2">
            <div className="flex items-center justify-between text-xs font-bold uppercase text-slate-600">
              <span className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-comic-blue" />
                Allies in Play ({player.allies.length} / 3)
              </span>
            </div>

            {player.allies.length > 0 ? (
              <div className="flex flex-wrap gap-3 items-center">
                {player.allies.map((ally) => (
                  <div key={ally.instanceId} className="flex flex-col items-center gap-1">
                    <CardView card={ally.card} instance={ally} size="sm" enableHoverZoom={true} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-2.5 border-2 border-dashed border-slate-300 rounded-lg text-center text-xs text-slate-400 font-semibold bg-white/50">
                No allies in play.
              </div>
            )}
          </div>

          {/* Tableau (Upgrades & Supports) Sub-Zone */}
          <div className="bg-slate-50 p-3 rounded-lg border border-comic-black space-y-2">
            <div className="flex items-center justify-between text-xs font-bold uppercase text-slate-600">
              <span className="flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-comic-yellow" />
                Tableau: Supports & Upgrades ({player.tableau.length})
              </span>
            </div>

            {player.tableau.length > 0 ? (
              <div className="flex flex-wrap gap-3 items-center">
                {player.tableau.map((cardInst) => (
                  <div key={cardInst.instanceId} className="flex flex-col items-center gap-1">
                    <CardView card={cardInst.card} instance={cardInst} size="sm" enableHoverZoom={true} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-2.5 border-2 border-dashed border-slate-300 rounded-lg text-center text-xs text-slate-400 font-semibold bg-white/50">
                No supports or upgrades in play.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroZone;
