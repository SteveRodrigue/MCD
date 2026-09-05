import React, { useState } from 'react';
import {
  Newspaper,
  X,
  Zap,
  Shield,
  Heart,
  Swords,
  Target,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';
import {
  LegalActionReport,
  LegalActionItem,
} from '../../../engine/pipeline/legal-actions-generator';
import { useCardArt } from '../../hooks/useCardArt';
import { getRemoteMarvelCdbUrl } from '../../services/card-cache-service';

interface DailyBugleCardThumbnailProps {
  cardCode?: string;
  cardName?: string;
  fallbackIcon?: React.ReactNode;
}

const DailyBugleCardThumbnail: React.FC<DailyBugleCardThumbnailProps> = ({
  cardCode,
  cardName,
  fallbackIcon,
}) => {
  const { artUrl } = useCardArt(cardCode);
  const [imgFailed, setImgFailed] = useState(false);

  const src =
    !imgFailed && artUrl ? artUrl : cardCode && !imgFailed ? getRemoteMarvelCdbUrl(cardCode) : null;

  return (
    <div className="w-14 h-14 sm:w-16 sm:h-16 aspect-square shrink-0 rounded border-2 border-slate-900 bg-amber-100 overflow-hidden shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] relative flex items-center justify-center select-none group-hover:scale-105 transition-transform">
      {src ? (
        <img
          src={src}
          alt={cardName || cardCode || 'Card Art'}
          onError={() => setImgFailed(true)}
          className="w-full h-full object-cover object-top"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-[#f4ebd9] text-slate-800">
          {fallbackIcon || <Newspaper className="w-5 h-5 text-slate-700" />}
        </div>
      )}
    </div>
  );
};

interface DailyBugleActionNewspaperProps {
  report: LegalActionReport;
  isOpen: boolean;
  onClose: () => void;
  onSelectAction: (actionItem: LegalActionItem) => void;
}

export const DailyBugleActionNewspaper: React.FC<DailyBugleActionNewspaperProps> = ({
  report,
  isOpen,
  onClose,
  onSelectAction,
}) => {
  if (!isOpen) return null;

  const {
    identityActions,
    handCardActions,
    boardActions,
    turnAction,
    activeActionCount,
    playerName,
  } = report;

  const renderIcon = (iconType?: string) => {
    switch (iconType) {
      case 'flip':
        return <RefreshCw className="w-4 h-4 text-amber-700" />;
      case 'recover':
        return <Heart className="w-4 h-4 text-emerald-700 fill-emerald-100" />;
      case 'attack':
        return <Swords className="w-4 h-4 text-rose-700" />;
      case 'thwart':
        return <Target className="w-4 h-4 text-sky-700" />;
      case 'card':
        return <Zap className="w-4 h-4 text-amber-600" />;
      case 'ability':
        return <Shield className="w-4 h-4 text-indigo-700" />;
      default:
        return <ChevronRight className="w-4 h-4 text-slate-700" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      {/* 1960s Newsprint Broadsheet Container */}
      <div className="relative w-full max-w-2xl max-h-[85vh] bg-[#fbf7ee] text-slate-900 border-4 border-slate-900 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-sm overflow-hidden flex flex-col font-serif">
        {/* Top Woodblock Masthead */}
        <div className="bg-[#f4ebd9] border-b-2 border-slate-900 p-3 relative select-none">
          {/* Close Button (Solid non-transparent comic badge) */}
          <button
            onClick={onClose}
            className="absolute top-2 right-2 p-1 bg-slate-900 text-white hover:bg-comic-red hover:text-white rounded border-2 border-slate-950 shadow-comic-sm transition-all cursor-pointer z-10 flex items-center justify-center"
            title="Close Newspaper"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Newspaper Sub-Header Line (Padded right to never overlap close button) */}
          <div className="flex justify-between items-center text-[10px] uppercase tracking-widest text-slate-700 font-bold border-b border-slate-800 pb-1 mb-1 pr-8">
            <span>VOL. LXVIII NO. 142</span>
            <span className="font-comic tracking-normal text-comic-red font-black">
              ★ THE VOICE OF MARVELS ★
            </span>
            <span>PRICE: 10¢ IN COIN</span>
          </div>

          {/* Authentic Daily Bugle Title Banner */}
          <div className="text-center py-1">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight uppercase font-serif text-slate-950 leading-none">
              THE DAILY BUGLE
            </h1>
            <p className="text-[11px] italic text-slate-700 font-serif mt-0.5">
              "All the heroic dispatches & battle directives fit to print!"
            </p>
          </div>

          {/* Hero Banner Strip */}
          <div className="flex justify-between items-center bg-slate-900 text-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wider mt-1">
            <span className="flex items-center gap-1.5 font-comic">
              <Newspaper className="w-4 h-4 text-amber-300" />
              SPECIAL ACTION EDITION: {playerName.toUpperCase()}
            </span>
            <span className="font-mono text-[11px] text-amber-300">
              {activeActionCount} LEGAL PLAY{activeActionCount === 1 ? '' : 'S'} AVAILABLE
            </span>
          </div>
        </div>

        {/* Scrollable Columnar Newsprint Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 divide-y divide-slate-300 text-slate-900">
          {/* Section 1: FRONT PAGE (Identity Directives) */}
          {identityActions.length > 0 && (
            <div className="pt-2 first:pt-0">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 border-b-2 border-slate-900 pb-0.5 flex items-center gap-1 font-comic">
                  <span>📰 FRONT PAGE: IDENTITY DIRECTIVES</span>
                </h2>
                <span className="text-[10px] text-slate-600 font-bold uppercase">
                  Form & Basic Moves
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {identityActions.map((item) => {
                  const cardCode = item.cardCode || item.targetCardInstance?.card.code;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onSelectAction(item);
                        onClose();
                      }}
                      className="text-left bg-white/90 hover:bg-amber-100/90 border border-slate-800 p-2 rounded shadow-sm hover:shadow-md transition-all cursor-pointer flex items-start gap-2.5 group"
                    >
                      <DailyBugleCardThumbnail
                        cardCode={cardCode}
                        cardName={item.headline}
                        fallbackIcon={renderIcon(item.iconType)}
                      />
                      <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch">
                        <div>
                          <div className="flex items-start justify-between gap-1 mb-0.5">
                            <span className="font-bold font-comic text-xs text-slate-950 group-hover:text-comic-blue flex items-center gap-1 line-clamp-1">
                              {renderIcon(item.iconType)}
                              <span>{item.headline}</span>
                            </span>
                            {item.badge && (
                              <span className="bg-slate-900 text-amber-300 text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border border-slate-800 shrink-0">
                                {item.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-700 leading-tight font-serif line-clamp-2">
                            {item.subtext}
                          </p>
                        </div>
                        <div className="mt-1 text-right">
                          <span className="text-[10px] font-bold text-comic-blue uppercase group-hover:underline">
                            Execute ➔
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 2: SPECIAL DISPATCHES (Playable Cards in Hand) */}
          {handCardActions.length > 0 && (
            <div className="pt-3">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 border-b-2 border-slate-900 pb-0.5 flex items-center gap-1 font-comic">
                  <span>🃏 LATEST DISPATCHES: PLAYABLE HAND CARDS</span>
                </h2>
                <span className="text-[10px] text-slate-600 font-bold uppercase">
                  Ready from Hand
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {handCardActions.map((item) => {
                  const cardCode = item.cardCode || item.targetCardInstance?.card.code;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onSelectAction(item);
                        onClose();
                      }}
                      className="text-left bg-white/90 hover:bg-amber-100/90 border border-slate-800 p-2 rounded shadow-sm hover:shadow-md transition-all cursor-pointer flex items-start gap-2.5 group"
                    >
                      <DailyBugleCardThumbnail
                        cardCode={cardCode}
                        cardName={item.headline}
                        fallbackIcon={renderIcon(item.iconType)}
                      />
                      <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch">
                        <div>
                          <div className="flex items-start justify-between gap-1 mb-0.5">
                            <span className="font-bold font-comic text-xs text-slate-950 group-hover:text-comic-red flex items-center gap-1 line-clamp-1">
                              {renderIcon(item.iconType)}
                              <span>{item.headline}</span>
                            </span>
                            {item.badge && (
                              <span className="bg-amber-300 text-slate-950 text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border border-slate-800 shrink-0">
                                {item.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-700 leading-tight font-serif line-clamp-2">
                            {item.subtext}
                          </p>
                        </div>
                        <div className="mt-1 text-right">
                          <span className="text-[10px] font-bold text-comic-red uppercase group-hover:underline">
                            Play Card ➔
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 3: THE CLASSIFIEDS (In-Play Tableau & Allies) */}
          {boardActions.length > 0 && (
            <div className="pt-3">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 border-b-2 border-slate-900 pb-0.5 flex items-center gap-1 font-comic">
                  <span>⚡ THE CLASSIFIEDS: IN-PLAY ASSETS & ALLIES</span>
                </h2>
                <span className="text-[10px] text-slate-600 font-bold uppercase">
                  Tableau & Allies
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {boardActions.map((item) => {
                  const cardCode = item.cardCode || item.targetCardInstance?.card.code;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onSelectAction(item);
                        onClose();
                      }}
                      className="text-left bg-white/90 hover:bg-amber-100/90 border border-slate-800 p-2 rounded shadow-sm hover:shadow-md transition-all cursor-pointer flex items-start gap-2.5 group"
                    >
                      <DailyBugleCardThumbnail
                        cardCode={cardCode}
                        cardName={item.headline}
                        fallbackIcon={renderIcon(item.iconType)}
                      />
                      <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch">
                        <div>
                          <div className="flex items-start justify-between gap-1 mb-0.5">
                            <span className="font-bold font-comic text-xs text-slate-950 group-hover:text-emerald-700 flex items-center gap-1 line-clamp-1">
                              {renderIcon(item.iconType)}
                              <span>{item.headline}</span>
                            </span>
                            {item.badge && (
                              <span className="bg-emerald-200 text-slate-950 text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border border-slate-800 shrink-0">
                                {item.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-700 leading-tight font-serif line-clamp-2">
                            {item.subtext}
                          </p>
                        </div>
                        <div className="mt-1 text-right">
                          <span className="text-[10px] font-bold text-emerald-700 uppercase group-hover:underline">
                            Activate ➔
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* No Active Actions Banner */}
          {activeActionCount === 0 && (
            <div className="p-4 bg-amber-100/80 border-2 border-dashed border-slate-400 rounded text-center space-y-1">
              <h3 className="font-comic text-sm font-bold text-slate-900 uppercase">
                ★ PRESS RUN COMPLETE: NO ACTIONS REMAIN ★
              </h3>
              <p className="text-xs text-slate-600 font-serif">
                You have exhausted your character and played all available cards. You may now
                conclude your turn below.
              </p>
            </div>
          )}
        </div>

        {/* Bottom Turn Pass Action Bar */}
        {turnAction && (
          <div className="p-3 bg-[#f4ebd9] border-t-2 border-slate-900 flex items-center justify-between gap-3">
            <div className="text-left">
              <span className="text-[10px] font-bold text-slate-600 uppercase block font-comic">
                TURN FLOW MANAGEMENT
              </span>
              <span className="text-xs text-slate-900 font-serif italic">{turnAction.subtext}</span>
            </div>

            <button
              onClick={() => {
                onSelectAction(turnAction);
                onClose();
              }}
              className="bg-comic-red hover:bg-red-700 text-white font-comic text-xs px-4 py-2 rounded border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 font-bold cursor-pointer uppercase shrink-0 flex items-center gap-1.5"
            >
              <Newspaper className="w-4 h-4" />
              <span>{turnAction.headline}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyBugleActionNewspaper;
