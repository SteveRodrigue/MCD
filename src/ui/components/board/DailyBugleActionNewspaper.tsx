import React, { useState } from 'react';
import { ModalLayer } from '../layout/ModalLayer';
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
  Skull,
  Users,
} from 'lucide-react';
import {
  LegalActionReport,
  LegalActionItem,
} from '../../../engine/pipeline/legal-actions-generator';
import { useCardArt } from '../../hooks/useCardArt';
import { getRemoteMarvelCdbUrl } from '../../services/card-cache-service';
import { FormattedCardText } from '../cards/FormattedCardText';
import { useNewspaperProps } from '../../theme/useNewspaperProps';

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

function formatTeammateHeader(ownerName?: string): string {
  if (!ownerName) return 'TEAMMATE ACTIONS';
  const match = ownerName.match(/^(Hero Seat \d+)\s*\(([^)]+)\)$/);
  if (match) {
    const seat = match[1];
    const hero = match[2];
    return `${hero.toUpperCase()} (${seat})`;
  }
  return ownerName.toUpperCase();
}

export const DailyBugleActionNewspaper: React.FC<DailyBugleActionNewspaperProps> = ({
  report,
  isOpen,
  onClose,
  onSelectAction,
}) => {
  const newspaperProps = useNewspaperProps();
  if (!isOpen) return null;

  const {
    identityActions = [],
    handCardActions = [],
    boardActions = [],
    villainActionItems = [],
    callForActionItems = [],
    turnAction,
    activeActionCount = 0,
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

  const hasIdentity = identityActions.length > 0;
  const hasHand = handCardActions.length > 0;
  const hasBoard = boardActions.length > 0;
  const hasVillain = villainActionItems.length > 0;
  const hasCallForAction = callForActionItems.length > 0;

  const hasIdentityOrHand = hasIdentity || hasHand;
  const hasBoardOrVillain = hasBoard || hasVillain;

  let activePlayerColumns: Array<{
    showIdentity?: boolean;
    showHand?: boolean;
    showBoard?: boolean;
    showVillain?: boolean;
  }> = [];

  if (hasIdentityOrHand && hasBoardOrVillain) {
    activePlayerColumns = [
      { showIdentity: hasIdentity, showHand: hasHand },
      { showBoard: hasBoard, showVillain: hasVillain },
    ];
  } else if (!hasBoardOrVillain && hasIdentity && hasHand) {
    activePlayerColumns = [{ showIdentity: true }, { showHand: true }];
  } else if (hasIdentityOrHand || hasBoardOrVillain) {
    activePlayerColumns = [
      {
        showIdentity: hasIdentity,
        showHand: hasHand,
        showBoard: hasBoard,
        showVillain: hasVillain,
      },
    ];
  }

  const totalColumns = activePlayerColumns.length + (hasCallForAction ? 1 : 0);

  const containerWidthClass =
    totalColumns >= 3 ? 'max-w-6xl' : totalColumns === 2 ? 'max-w-4xl' : 'max-w-xl';

  const gridClass =
    totalColumns === 3 ? 'lg:grid-cols-3' : totalColumns === 2 ? 'lg:grid-cols-2' : '';

  // Group call for action items by teammate owner
  const callForActionByOwner: Record<string, LegalActionItem[]> = {};
  for (const item of callForActionItems) {
    const key = item.ownerName || 'Unknown Teammate';
    if (!callForActionByOwner[key]) {
      callForActionByOwner[key] = [];
    }
    callForActionByOwner[key].push(item);
  }

  const renderIdentitySection = () => (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 border-b-2 border-slate-900 pb-0.5 flex items-center gap-1 font-news-headline">
          <span>📰 FRONT PAGE: IDENTITY DIRECTIVES</span>
        </h2>
        <span className="text-micro text-slate-600 font-bold uppercase">Form & Basic Moves</span>
      </div>

      <div className="flex flex-col gap-2">
        {identityActions.map((item) => {
          const cardCode = item.cardCode || item.targetCardInstance?.card.code;
          return (
            <button
              key={item.id}
              onClick={() => {
                onSelectAction(item);
                onClose();
              }}
              className="w-full text-left bg-white/90 hover:bg-amber-100/90 border border-slate-800 p-2 rounded shadow-sm hover:shadow-md transition-all cursor-pointer flex items-start gap-2.5 group"
            >
              <DailyBugleCardThumbnail
                cardCode={cardCode}
                cardName={item.headline}
                fallbackIcon={renderIcon(item.iconType)}
              />
              <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch">
                <div>
                  <div className="flex items-start justify-between gap-1 mb-0.5">
                    <span className="font-bold font-news-headline text-xs text-slate-950 group-hover:text-comic-blue flex items-center gap-1 line-clamp-1">
                      {renderIcon(item.iconType)}
                      <span>{item.headline}</span>
                    </span>
                    {item.badge && (
                      <span className="bg-slate-900 text-amber-300 text-nano font-mono font-bold px-1.5 py-0.2 rounded border border-slate-800 shrink-0">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-mini text-slate-700 leading-tight font-news-body line-clamp-2">
                    {item.subtext}
                  </p>
                </div>
                <div className="mt-1 text-right">
                  <span className="text-micro font-bold text-comic-blue uppercase group-hover:underline">
                    Execute ➔
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderHandSection = (hasPrevSection: boolean) => (
    <div className={hasPrevSection ? 'pt-3 border-t border-slate-300' : ''}>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 border-b-2 border-slate-900 pb-0.5 flex items-center gap-1 font-news-headline">
          <span>🃏 LATEST DISPATCHES: PLAYABLE HAND CARDS</span>
        </h2>
        <span className="text-micro text-slate-600 font-bold uppercase">Ready from Hand</span>
      </div>

      <div className="flex flex-col gap-2">
        {handCardActions.map((item) => {
          const cardCode = item.cardCode || item.targetCardInstance?.card.code;
          return (
            <button
              key={item.id}
              onClick={() => {
                onSelectAction(item);
                onClose();
              }}
              className="w-full text-left bg-white/90 hover:bg-amber-100/90 border border-slate-800 p-2 rounded shadow-sm hover:shadow-md transition-all cursor-pointer flex items-start gap-2.5 group"
            >
              <DailyBugleCardThumbnail
                cardCode={cardCode}
                cardName={item.headline}
                fallbackIcon={renderIcon(item.iconType)}
              />
              <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch">
                <div>
                  <div className="flex items-start justify-between gap-1 mb-0.5">
                    <span className="font-bold font-news-headline text-xs text-slate-950 group-hover:text-comic-red flex items-center gap-1 line-clamp-1">
                      {renderIcon(item.iconType)}
                      <span>{item.headline}</span>
                    </span>
                    {item.badge && (
                      <span className="bg-amber-300 text-slate-950 text-nano font-mono font-bold px-1.5 py-0.2 rounded border border-slate-800 shrink-0">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-mini text-slate-700 leading-tight font-news-body line-clamp-2">
                    {item.subtext}
                  </p>
                </div>
                <div className="mt-1 text-right">
                  <span className="text-micro font-bold text-comic-red uppercase group-hover:underline">
                    Play Card ➔
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderBoardSection = () => (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 border-b-2 border-slate-900 pb-0.5 flex items-center gap-1 font-news-headline">
          <span>⚡ THE CLASSIFIEDS: IN-PLAY ASSETS & ALLIES</span>
        </h2>
        <span className="text-micro text-slate-600 font-bold uppercase">Tableau & Allies</span>
      </div>

      <div className="flex flex-col gap-2">
        {boardActions.map((item) => {
          const cardCode = item.cardCode || item.targetCardInstance?.card.code;
          return (
            <button
              key={item.id}
              onClick={() => {
                onSelectAction(item);
                onClose();
              }}
              className="w-full text-left bg-white/90 hover:bg-amber-100/90 border border-slate-800 p-2 rounded shadow-sm hover:shadow-md transition-all cursor-pointer flex items-start gap-2.5 group"
            >
              <DailyBugleCardThumbnail
                cardCode={cardCode}
                cardName={item.headline}
                fallbackIcon={renderIcon(item.iconType)}
              />
              <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch">
                <div>
                  <div className="flex items-start justify-between gap-1 mb-0.5">
                    <span className="font-bold font-news-headline text-xs text-slate-950 group-hover:text-emerald-700 flex items-center gap-1 line-clamp-1">
                      {renderIcon(item.iconType)}
                      <span>{item.headline}</span>
                    </span>
                    {item.badge && (
                      <span className="bg-emerald-200 text-slate-950 text-nano font-mono font-bold px-1.5 py-0.2 rounded border border-slate-800 shrink-0">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-mini text-slate-700 leading-tight font-news-body line-clamp-2">
                    {item.subtext}
                  </p>
                </div>
                <div className="mt-1 text-right">
                  <span className="text-micro font-bold text-emerald-700 uppercase group-hover:underline">
                    Activate ➔
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderVillainSection = (hasPrevSection: boolean) => (
    <div className={hasPrevSection ? 'pt-3 border-t border-slate-300' : ''}>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 border-b-2 border-slate-900 pb-0.5 flex items-center gap-1 font-news-headline">
          <Skull className="w-3.5 h-3.5 text-rose-700" />
          <span>🚨 VILLAIN DISPATCHES: ENCOUNTER & SCHEME ACTIONS</span>
        </h2>
        <span className="text-micro text-slate-600 font-bold uppercase">Encounter & Schemes</span>
      </div>

      <div className="flex flex-col gap-2">
        {villainActionItems.map((item) => {
          const cardCode = item.cardCode || item.targetCardInstance?.card.code;
          return (
            <button
              key={item.id}
              onClick={() => {
                onSelectAction(item);
                onClose();
              }}
              className="w-full text-left bg-white/90 hover:bg-rose-50 border border-slate-800 p-2 rounded shadow-sm hover:shadow-md transition-all cursor-pointer flex items-start gap-2.5 group"
            >
              <DailyBugleCardThumbnail
                cardCode={cardCode}
                cardName={item.headline}
                fallbackIcon={<Skull className="w-5 h-5 text-rose-700" />}
              />
              <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch">
                <div>
                  <div className="flex items-start justify-between gap-1 mb-0.5">
                    <span className="font-bold font-news-headline text-xs text-slate-950 group-hover:text-rose-700 flex items-center gap-1 line-clamp-1">
                      {renderIcon(item.iconType)}
                      <span>{item.headline}</span>
                    </span>
                    {item.badge && (
                      <span className="bg-rose-200 text-slate-950 text-nano font-mono font-bold px-1.5 py-0.2 rounded border border-slate-800 shrink-0">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-mini text-slate-700 leading-tight font-news-body line-clamp-2">
                    {item.subtext}
                  </p>
                </div>
                <div className="mt-1 text-right">
                  <span className="text-micro font-bold text-rose-700 uppercase group-hover:underline">
                    Discard / Pay ➔
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <ModalLayer className="inset-0 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      {/* 1960s Newsprint Broadsheet Container */}
      <div
        data-testid="daily-bugle-container"
        {...newspaperProps}
        className={`relative w-full ${containerWidthClass} max-h-[85vh] bg-[#fbf7ee] text-slate-900 border-4 border-slate-900 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-sm overflow-hidden flex flex-col font-news-body transition-all duration-300`}
      >
        {/* Top Woodblock Masthead */}
        <div className="bg-[#f4ebd9] border-b-2 border-slate-900 p-3 relative select-none">
          {/* Close Button (Solid non-transparent comic badge) */}
          <button
            onClick={onClose}
            className="absolute top-2 right-2 p-1 bg-slate-900 text-white hover:bg-comic-red hover:text-white rounded border-2 border-slate-950 shadow-comic-sm transition-all cursor-pointer z-content flex items-center justify-center"
            title="Close Newspaper"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Newspaper Sub-Header Line (Padded right to never overlap close button) */}
          <div className="flex justify-between items-center text-micro uppercase tracking-widest text-slate-700 font-bold border-b border-slate-800 pb-1 mb-1 pr-8">
            <span>VOL. LXVIII NO. 142</span>
            <span className="font-news-headline tracking-normal text-comic-red font-black">
              ★ THE VOICE OF MARVELS ★
            </span>
            <span>PRICE: 10¢ IN COIN</span>
          </div>

          {/* Authentic Daily Bugle Title Banner */}
          <div className="text-center py-1">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight uppercase font-news-headline text-slate-950 leading-none">
              THE DAILY BUGLE
            </h1>
            <p className="text-mini italic text-slate-700 font-news-body mt-0.5">
              "All the heroic dispatches & battle directives fit to print!"
            </p>
          </div>

          {/* Hero Banner Strip */}
          <div className="flex justify-between items-center bg-slate-900 text-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wider mt-1">
            <span className="flex items-center gap-1.5 font-news-headline">
              <Newspaper className="w-4 h-4 text-amber-300" />
              SPECIAL ACTION EDITION: {playerName.toUpperCase()}
            </span>
            <span className="font-mono text-mini text-amber-300">
              {activeActionCount} LEGAL PLAY{activeActionCount === 1 ? '' : 'S'} AVAILABLE
            </span>
          </div>
        </div>

        {/* Scrollable Columnar Newsprint Content */}
        <div className="flex-1 overflow-y-auto p-4 text-slate-900">
          {activeActionCount === 0 && callForActionItems.length === 0 ? (
            <div className="p-8 bg-amber-100/80 border-2 border-dashed border-slate-400 rounded text-center space-y-1 my-4">
              <h3 className="font-news-headline text-base font-bold text-slate-900 uppercase">
                ★ PRESS RUN COMPLETE: NO ACTIONS REMAIN ★
              </h3>
              <p className="text-xs text-slate-600 font-news-body">
                You have exhausted your character and played all available cards. You may now
                conclude your turn below.
              </p>
            </div>
          ) : (
            <div
              data-testid="daily-bugle-grid"
              className={`grid grid-cols-1 ${gridClass} gap-6 ${
                totalColumns > 1 ? 'lg:divide-x-2 lg:divide-slate-400' : ''
              }`}
            >
              {activePlayerColumns.map((col, idx) => (
                <div key={`col_${idx}`} className={`space-y-4 ${idx > 0 ? 'lg:pl-6' : ''}`}>
                  {col.showIdentity && renderIdentitySection()}
                  {col.showHand && renderHandSection(!!col.showIdentity)}
                  {col.showBoard && renderBoardSection()}
                  {col.showVillain && renderVillainSection(!!col.showBoard)}
                </div>
              ))}

              {/* CALL FOR ACTION (Teammate Tableau Assets & Identities) */}
              {hasCallForAction && (
                <div
                  className={`space-y-4 ${activePlayerColumns.length > 0 ? 'lg:pl-6' : ''}`}
                  data-testid="daily-bugle-call-for-action-column"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 border-b-2 border-indigo-700 pb-0.5 flex items-center gap-1 font-news-headline">
                        <Users className="w-3.5 h-3.5 text-indigo-700" />
                        <span>🤝 CALL FOR ACTION: TEAM TABLEAU ASSETS</span>
                      </h2>
                      <span className="text-micro text-indigo-700 font-bold uppercase">
                        Teammate Tableau
                      </span>
                    </div>

                    <div className="space-y-4">
                      {Object.entries(callForActionByOwner).map(([ownerKey, items]) => (
                        <div
                          key={ownerKey}
                          className="border border-slate-900 rounded overflow-hidden shadow-sm"
                        >
                          <div className="bg-slate-900 text-amber-300 px-2.5 py-1 font-news-headline font-black text-xs uppercase tracking-wide border border-slate-900 rounded-t flex items-center justify-between">
                            <span>{formatTeammateHeader(ownerKey)}</span>
                            <span className="text-micro font-mono text-amber-200">
                              {items.length} ACTION{items.length === 1 ? '' : 'S'}
                            </span>
                          </div>
                          <div className="p-2 bg-[#f4ebd9]/40 flex flex-col gap-2">
                            {items.map((item) => {
                              const cardCode = item.cardCode || item.targetCardInstance?.card.code;
                              const cardText = item.targetCardInstance?.card?.text || item.subtext;
                              return (
                                <button
                                  key={item.id}
                                  onClick={() => {
                                    onSelectAction(item);
                                    onClose();
                                  }}
                                  className="w-full text-left bg-white/90 hover:bg-indigo-50 border border-slate-800 p-2 rounded shadow-sm hover:shadow-md transition-all cursor-pointer flex items-start gap-2.5 group"
                                >
                                  <DailyBugleCardThumbnail
                                    cardCode={cardCode}
                                    cardName={item.headline}
                                    fallbackIcon={<Users className="w-5 h-5 text-indigo-700" />}
                                  />
                                  <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch">
                                    <div>
                                      <div className="flex items-start justify-between gap-1 mb-0.5">
                                        <span className="font-bold font-news-headline text-xs text-slate-950 group-hover:text-indigo-700 flex items-center gap-1 line-clamp-1">
                                          {renderIcon(item.iconType)}
                                          <span>{item.headline}</span>
                                        </span>
                                        {item.badge && (
                                          <span className="bg-amber-300 text-slate-950 text-nano font-mono font-bold px-1.5 py-0.2 rounded border border-slate-800 shrink-0">
                                            {item.badge}
                                          </span>
                                        )}
                                      </div>
                                      <FormattedCardText
                                        text={cardText}
                                        className="text-mini text-slate-800 leading-snug font-news-body"
                                      />
                                    </div>
                                    <div className="mt-1 text-right">
                                      <span className="text-micro font-bold text-indigo-700 uppercase group-hover:underline">
                                        Ask Teammate ➔
                                      </span>
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Turn Pass Action Bar */}
        {turnAction && (
          <div className="p-3 bg-[#f4ebd9] border-t-2 border-slate-900 flex items-center justify-between gap-3">
            <div className="text-left">
              <span className="text-micro font-bold text-slate-600 uppercase block font-news-headline">
                TURN FLOW MANAGEMENT
              </span>
              <span className="text-xs text-slate-900 font-news-body italic">
                {turnAction.subtext}
              </span>
            </div>

            <button
              onClick={() => {
                onSelectAction(turnAction);
                onClose();
              }}
              className="bg-comic-red hover:bg-red-700 text-white font-news-headline text-xs px-4 py-2 rounded border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 font-bold cursor-pointer uppercase shrink-0 flex items-center gap-1.5"
            >
              <Newspaper className="w-4 h-4" />
              <span>{turnAction.headline}</span>
            </button>
          </div>
        )}
      </div>
    </ModalLayer>
  );
};

export default DailyBugleActionNewspaper;
