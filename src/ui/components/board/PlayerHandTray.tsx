import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Layers, Sparkles, Skull, X, Eye, Filter, ArrowDownUp, Plus } from 'lucide-react';
import {
  CardInstance,
  NormalizedCard,
  PlayerState,
  GameState,
  GameAction,
} from '../../../engine/models';
import { CardView } from '../cards/CardView';
import { useGameSettings } from '../../context/useGameSettings';
import { CardPaymentModal } from './CardPaymentModal';
import { evaluateCardPlayability } from '../../../engine/pipeline/legality-checker';
import { useHandFanLayout } from '../../hooks/useHandFanLayout';

interface PlayerHandTrayProps {
  hand: CardInstance[];
  deck: CardInstance[];
  discard: CardInstance[];
  setAsideCards?: CardInstance[];
  heroName: string;
  handSizeLimit: number;
  seatNumber?: number;
  isFocused?: boolean;
  isMultiHero?: boolean;
  player?: PlayerState;
  gameState?: GameState;
  onFocus?: () => void;
  onCardClick?: (cardInst: CardInstance) => void;
  onDispatchAction?: (action: GameAction) => void;
}

type PlayerSortMode = 'deck_order' | 'card_type' | 'affinity' | 'cost';
type DeckDirection = 'top_to_bottom' | 'bottom_to_top';
type CostDirection = 'low_to_high' | 'high_to_low';

function getPlayerCardAffinity(card: NormalizedCard): string {
  const faction = (card.faction || (card as any).faction_code || '').toLowerCase();
  if (faction === 'justice') return 'Justice';
  if (faction === 'aggression') return 'Aggression';
  if (faction === 'leadership') return 'Leadership';
  if (faction === 'protection') return 'Protection';
  if (faction === 'basic') return 'Basic';
  if (
    faction === 'hero' ||
    card.setCode === 'spider_man' ||
    (card as any).set_code === 'spider_man'
  ) {
    return 'Hero Signature (Spider-Man)';
  }
  if (card.setCode) {
    return card.setCode
      .split('_')
      .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  return 'Basic';
}

function getPlayerCardTypeName(card: NormalizedCard): string {
  const type = card.type || (card as any).type_code || 'card';
  if (type === 'event') return 'Events';
  if (type === 'ally') return 'Allies';
  if (type === 'upgrade') return 'Upgrades';
  if (type === 'support') return 'Supports';
  if (type === 'resource') return 'Resources';
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function getPlayerCardCostGroup(card: NormalizedCard): string {
  const isNoCost =
    card.type === 'resource' ||
    (card as any).type_code === 'resource' ||
    card.cost === undefined ||
    card.cost === null;

  if (isNoCost) {
    return 'Resource Cards (No Cost)';
  }
  return 'Cards with Cost';
}

function getPlayerCardCostValue(card: NormalizedCard): number {
  if (
    card.type === 'resource' ||
    (card as any).type_code === 'resource' ||
    card.cost === undefined ||
    card.cost === null
  ) {
    return 999;
  }
  return card.cost;
}

export const PlayerHandTray: React.FC<PlayerHandTrayProps> = ({
  hand,
  deck,
  discard,
  setAsideCards = [],
  heroName,
  handSizeLimit = 6,
  seatNumber,
  isFocused = true,
  isMultiHero = false,
  player,
  gameState,
  onFocus,
  onCardClick,
  onDispatchAction,
}) => {
  const { devMode } = useGameSettings();
  const [showDeckModal, setShowDeckModal] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [showNemesisModal, setShowNemesisModal] = useState(false);
  const [playingCard, setPlayingCard] = useState<CardInstance | null>(null);
  const [turnWarning, setTurnWarning] = useState<string | null>(null);

  const activePlayer = gameState?.players[gameState?.activePlayerIndex ?? 0];
  const isActivePlayerTurn =
    gameState?.phase === 'PLAYER_PHASE' ? activePlayer?.id === player?.id : true;

  const handleCardClick = (cardInst: CardInstance) => {
    if (player && gameState) {
      const playability = evaluateCardPlayability(gameState, player.id, cardInst);
      if (!playability.isPlayable) {
        setTurnWarning(`Cannot play ${cardInst.card.name}: ${playability.reasons.join(' • ')}`);
        setTimeout(() => setTurnWarning(null), 4500);
        return;
      }
    }

    if (onCardClick) {
      onCardClick(cardInst);
    }
    if (onDispatchAction && player && gameState) {
      setPlayingCard(cardInst);
    }
  };

  const handleEndTurn = () => {
    if (onDispatchAction && player) {
      onDispatchAction({
        type: 'END_PLAYER_TURN',
        playerId: player.id,
      });
    }
  };

  const handleDevAddCard = (cardInstanceId: string) => {
    if (onDispatchAction && player) {
      onDispatchAction({
        type: 'DEV_ADD_CARD_TO_HAND',
        playerId: player.id,
        cardInstanceId,
      });
    }
  };

  // Dynamic Fan-Out Stack Layout Hook (size="hand" ~130px card width, +15% over sm)
  const handFan = useHandFanLayout({
    cardCount: hand.length,
    cardWidth: 130, // size="hand" portrait width (130px)
    defaultGap: 12,
    padding: 16,
  });

  const [hoveredHandCardId, setHoveredHandCardId] = useState<string | null>(null);

  // Inspector View Sort States
  const [sortMode, setSortMode] = useState<PlayerSortMode>('deck_order');
  const [deckDirection, setDeckDirection] = useState<DeckDirection>('top_to_bottom');
  const [costDirection, setCostDirection] = useState<CostDirection>('low_to_high');

  // Process and sort Player Deck for Inspector View
  const processedDeckItems = useMemo(() => {
    // Attach original deck index (0-based: 0 is top of deck)
    const items = deck.map((instance, originalIndex) => ({
      instance,
      originalIndex,
      affinity: getPlayerCardAffinity(instance.card),
      cardType: getPlayerCardTypeName(instance.card),
      costGroup: getPlayerCardCostGroup(instance.card),
      costValue: getPlayerCardCostValue(instance.card),
    }));

    if (sortMode === 'deck_order') {
      return deckDirection === 'top_to_bottom' ? items : [...items].reverse();
    }

    if (sortMode === 'card_type') {
      return [...items].sort((a, b) => {
        if (a.cardType !== b.cardType) return a.cardType.localeCompare(b.cardType);
        return a.originalIndex - b.originalIndex;
      });
    }

    if (sortMode === 'affinity') {
      return [...items].sort((a, b) => {
        if (a.affinity !== b.affinity) return a.affinity.localeCompare(b.affinity);
        return a.originalIndex - b.originalIndex;
      });
    }

    if (sortMode === 'cost') {
      return [...items].sort((a, b) => {
        // Keep Resource Cards (No Cost) always at the bottom
        const aIsNoCost = a.costGroup === 'Resource Cards (No Cost)';
        const bIsNoCost = b.costGroup === 'Resource Cards (No Cost)';
        if (aIsNoCost && !bIsNoCost) return 1;
        if (!aIsNoCost && bIsNoCost) return -1;

        if (a.costValue !== b.costValue) {
          return costDirection === 'low_to_high'
            ? a.costValue - b.costValue
            : b.costValue - a.costValue;
        }
        return a.originalIndex - b.originalIndex;
      });
    }

    return items;
  }, [deck, sortMode, deckDirection, costDirection]);

  // Group items by category if not in pure deck order
  const groupedDeckItems = useMemo(() => {
    if (sortMode === 'deck_order') return null;

    if (sortMode === 'cost') {
      const withCost = processedDeckItems.filter((i) => i.costGroup === 'Cards with Cost');
      const noCost = processedDeckItems.filter((i) => i.costGroup === 'Resource Cards (No Cost)');
      const groups: Record<string, typeof processedDeckItems> = {};
      if (withCost.length > 0) groups['Cards with Cost'] = withCost;
      if (noCost.length > 0) groups['Resource Cards (No Cost)'] = noCost;
      return groups;
    }

    const groupKey = sortMode === 'card_type' ? 'cardType' : 'affinity';
    const groups: Record<string, typeof processedDeckItems> = {};

    processedDeckItems.forEach((item) => {
      const key = item[groupKey];
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });

    return groups;
  }, [processedDeckItems, sortMode]);

  // Check if player has any playable cards remaining in hand
  const hasPlayableCardInHand = useMemo(() => {
    if (!player || !gameState || hand.length === 0) return false;
    return hand.some((cardInst) => {
      const playability = evaluateCardPlayability(gameState, player.id, cardInst);
      return playability.isPlayable;
    });
  }, [hand, player, gameState]);

  const shouldPulseEndTurn = isActivePlayerTurn && !hasPlayableCardInHand;

  return (
    <>
      <section
        className={`comic-panel px-3.5 pt-3 pb-2.5 bg-amber-100/95 relative shadow-comic transition-all overflow-visible ${
          !isFocused
            ? 'opacity-90 hover:opacity-100 ring-2 ring-slate-300'
            : 'ring-2 ring-comic-blue shadow-comic-lg'
        }`}
      >
        {/* Zone Title Ribbon */}
        <div className="absolute -top-3 left-4 right-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <div
              className={`text-white border border-comic-black font-comic text-xs px-3 py-0.5 tracking-wider shadow-comic-sm flex items-center gap-1 ${
                isActivePlayerTurn
                  ? 'bg-comic-red font-bold'
                  : isFocused
                    ? 'bg-comic-blue'
                    : 'bg-slate-700'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-comic-yellow" />
              <span>
                {seatNumber && isMultiHero ? `SEAT ${seatNumber}: ` : ''}
                {heroName}'s HAND ({hand.length} / {handSizeLimit})
                {isActivePlayerTurn ? ' • (ACTIVE TURN)' : ' • (WAITING)'}
              </span>
            </div>

            {!isFocused && onFocus && (
              <button
                onClick={onFocus}
                className="bg-amber-300 hover:bg-amber-400 text-slate-950 font-comic text-[11px] px-2.5 py-0.5 rounded border border-comic-black shadow-comic-sm cursor-pointer font-bold"
              >
                Focus Hand ➔
              </button>
            )}
          </div>

          {isActivePlayerTurn && (
            <button
              onClick={handleEndTurn}
              className={`bg-comic-yellow hover:bg-yellow-400 text-comic-black font-comic text-xs px-3 py-0.5 rounded border border-comic-black shadow-comic-sm cursor-pointer font-black flex items-center gap-1 transition-all hover:scale-105 ${
                shouldPulseEndTurn ? 'animate-pulse ring-2 ring-comic-yellow' : ''
              }`}
              title={
                shouldPulseEndTurn
                  ? 'No more playable cards in hand — Click to end your hero turn'
                  : "End your hero's turn and pass to the next hero (or begin Villain Phase)"
              }
            >
              <span>END TURN ➔</span>
            </button>
          )}
        </div>

        <div className="flex flex-col md:flex-row items-center gap-3 overflow-visible pt-1">
          {/* Turn Warning Toast (Mobile View) */}
          {turnWarning && (
            <div className="p-2 bg-rose-500 text-white font-comic text-xs rounded-lg border-2 border-comic-black shadow-comic-sm flex items-center justify-between animate-pulse md:hidden">
              <span>⚠️ {turnWarning}</span>
              <button
                onClick={() => setTurnWarning(null)}
                className="text-white hover:text-black font-bold ml-2"
              >
                ✕
              </button>
            </div>
          )}

          {/* Column 1: Vertical Piles & Utilities Sidebar */}
          <div className="w-full md:w-32 lg:w-36 shrink-0 flex flex-row md:flex-col items-stretch justify-center gap-1 bg-white/90 p-1.5 rounded-xl border-2 border-comic-black shadow-comic-sm">
            {/* Draw Pile & Tutor */}
            <div className="flex flex-col items-stretch w-full gap-0.5">
              <div
                onClick={() => devMode && setShowDeckModal(true)}
                className={`flex items-center justify-center gap-1.5 px-2 py-1 rounded bg-comic-blue text-white border border-comic-black shadow-comic-sm ${
                  devMode
                    ? 'cursor-pointer hover:bg-sky-600 transition-transform hover:scale-[1.02]'
                    : 'cursor-default'
                }`}
                title={
                  devMode
                    ? 'Inspect & Tutor from Player Deck (Dev Mode Active)'
                    : 'Player Draw Deck'
                }
              >
                <Layers className="w-3.5 h-3.5 text-comic-yellow shrink-0" />
                <span className="font-comic text-[11px] font-bold whitespace-nowrap">
                  DECK: {deck.length}
                </span>
              </div>

              {devMode && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeckModal(true);
                  }}
                  className="w-full px-2 py-0.5 rounded bg-comic-yellow text-comic-black hover:bg-amber-300 border border-comic-black shadow-comic-sm font-comic text-[9px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-transform hover:scale-[1.02]"
                  title="Dev Mode: Select card from deck and add to hand"
                >
                  <Plus className="w-3 h-3" />
                  <span>+ Add</span>
                </button>
              )}
            </div>

            {/* Discard Pile */}
            <div
              onClick={() => discard.length > 0 && setShowDiscardModal(true)}
              className={`w-full flex items-center justify-center gap-1.5 px-2 py-1 rounded bg-slate-100 text-slate-800 border border-comic-black shadow-comic-sm text-center ${
                discard.length > 0
                  ? 'cursor-pointer hover:bg-amber-100 transition-transform hover:scale-[1.02]'
                  : 'cursor-default opacity-60'
              }`}
              title="Inspect Discard Pile"
            >
              <span className="font-comic text-[11px] font-bold whitespace-nowrap">
                DISCARD: {discard.length}
              </span>
            </div>

            {/* Nemesis Set */}
            <div
              onClick={() => setAsideCards.length > 0 && setShowNemesisModal(true)}
              className={`w-full flex items-center justify-center gap-1.5 px-2 py-1 rounded bg-rose-50 text-rose-900 border border-comic-black shadow-comic-sm text-center ${
                setAsideCards.length > 0
                  ? 'cursor-pointer hover:bg-rose-100 transition-transform hover:scale-[1.02]'
                  : 'cursor-default opacity-60'
              }`}
              title="Inspect Nemesis Set (Out of Play)"
            >
              <Skull className="w-3.5 h-3.5 text-rose-700 shrink-0" />
              <span className="font-comic text-[11px] font-bold whitespace-nowrap">
                NEMESIS: {setAsideCards.length}
              </span>
            </div>
          </div>

          {/* Column 2: Cards in Hand (Fan-Out Stack • Leftmost Card on Top) */}
          <div className="flex-1 min-w-0 flex flex-col justify-center overflow-visible">
            {turnWarning && (
              <div className="hidden md:flex mb-1.5 p-1.5 bg-rose-500 text-white font-comic text-xs rounded-lg border-2 border-comic-black shadow-comic-sm items-center justify-between animate-pulse">
                <span>⚠️ {turnWarning}</span>
                <button
                  onClick={() => setTurnWarning(null)}
                  className="text-white hover:text-black font-bold ml-2"
                >
                  ✕
                </button>
              </div>
            )}

            <div
              ref={handFan.containerRef}
              className="flex items-center justify-start overflow-visible py-1 px-1 min-h-[188px] w-full"
            >
              {hand.map((cardInst, index) => {
                const isHovered = hoveredHandCardId === cardInst.instanceId;
                const playability =
                  player && gameState
                    ? evaluateCardPlayability(gameState, player.id, cardInst)
                    : { isPlayable: true, reasons: [], maxPotentialResources: 0 };

                return (
                  <div
                    key={cardInst.instanceId}
                    onMouseEnter={() => setHoveredHandCardId(cardInst.instanceId)}
                    onMouseLeave={() => setHoveredHandCardId(null)}
                    style={{
                      zIndex: isHovered ? 60 : 30 - index,
                      marginLeft: index === 0 ? 0 : `${handFan.overlapMargin}px`,
                    }}
                    className={`shrink-0 relative transition-transform duration-150 ease-out cursor-pointer ${
                      isHovered ? '-translate-y-8 z-[60]' : 'hover:-translate-y-2'
                    }`}
                  >
                    <CardView
                      card={cardInst.card}
                      instance={cardInst}
                      size="hand"
                      isPlayable={playability.isPlayable}
                      unplayableReason={playability.reasons[0]}
                      enableHoverZoom={true}
                      zoomOrigin="bottom"
                      onClick={() => handleCardClick(cardInst)}
                    />
                  </div>
                );
              })}

              {hand.length === 0 && (
                <div className="w-full py-6 text-center border-2 border-dashed border-slate-300 rounded-xl bg-white/60">
                  <span className="font-comic text-xs text-slate-400">
                    Hand is empty. (Cards will be drawn during Upkeep).
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Player Deck Inspector Modal (Dev Mode with Sorting & Card Names) */}
      {showDeckModal &&
        createPortal(
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white border-4 border-comic-black rounded-2xl shadow-comic-lg max-w-5xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b-2 border-comic-black pb-3">
                <div className="flex items-center gap-2">
                  <Eye className="w-6 h-6 text-comic-blue" />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-comic text-xl text-comic-black uppercase">
                        Player Deck Inspector ({deck.length} Cards)
                      </h3>
                      <span className="bg-comic-blue text-white border border-comic-black font-comic text-[10px] px-2 py-0.5 rounded font-bold">
                        DEV MODE
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">
                      Sort view by Deck Order, Card Type, Affinity (Aspect), or Cost. Cards display
                      their name below.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDeckModal(false)}
                  className="p-1.5 rounded-lg border-2 border-comic-black bg-rose-100 hover:bg-rose-200 text-comic-red transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Inspector View Sorting & Ordering Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-amber-50 p-3 rounded-xl border-2 border-comic-black text-xs font-comic shadow-comic-sm">
                {/* Left: Sort Category Selector */}
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-comic-blue" />
                  <span className="font-bold text-slate-700 uppercase">Sort By:</span>
                  <div className="flex flex-wrap gap-1">
                    {(
                      [
                        { id: 'deck_order', label: 'Deck Order' },
                        { id: 'card_type', label: 'Card Type' },
                        { id: 'affinity', label: 'Affinity (Aspect)' },
                        { id: 'cost', label: 'Resource Cost' },
                      ] as const
                    ).map((btn) => (
                      <button
                        key={btn.id}
                        onClick={() => setSortMode(btn.id)}
                        className={`px-2.5 py-1 rounded border transition-all cursor-pointer ${
                          sortMode === btn.id
                            ? 'bg-comic-blue text-white border-comic-black shadow-comic-sm font-bold'
                            : 'bg-white text-slate-700 border-slate-300 hover:border-comic-black'
                        }`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Right: Direction / Reverse Toggle */}
                <div className="flex items-center gap-2">
                  <ArrowDownUp className="w-4 h-4 text-comic-red" />
                  {sortMode === 'deck_order' && (
                    <button
                      onClick={() =>
                        setDeckDirection((prev) =>
                          prev === 'top_to_bottom' ? 'bottom_to_top' : 'top_to_bottom',
                        )
                      }
                      className="px-2.5 py-1 rounded border-2 border-comic-black bg-comic-yellow text-comic-black hover:bg-amber-300 font-bold transition-all shadow-comic-sm cursor-pointer"
                    >
                      {deckDirection === 'top_to_bottom'
                        ? '▼ Top to Bottom (Draw Order)'
                        : '▲ Bottom to Top'}
                    </button>
                  )}

                  {sortMode === 'cost' && (
                    <button
                      onClick={() =>
                        setCostDirection((prev) =>
                          prev === 'low_to_high' ? 'high_to_low' : 'low_to_high',
                        )
                      }
                      className="px-2.5 py-1 rounded border-2 border-comic-black bg-comic-yellow text-comic-black hover:bg-amber-300 font-bold transition-all shadow-comic-sm cursor-pointer"
                    >
                      {costDirection === 'low_to_high'
                        ? 'Low to High (0 ➔ 4)'
                        : 'High to Low (4 ➔ 0)'}
                    </button>
                  )}

                  {(sortMode === 'card_type' || sortMode === 'affinity') && (
                    <span className="text-slate-500 font-sans italic text-[11px]">
                      Grouped categorically
                    </span>
                  )}
                </div>
              </div>

              {/* Cards Grid Area */}
              {groupedDeckItems ? (
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                  {Object.entries(groupedDeckItems).map(([groupTitle, groupItems]) => (
                    <div
                      key={groupTitle}
                      className="bg-slate-50 p-3 rounded-xl border border-slate-300 space-y-2"
                    >
                      <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                        <span className="font-comic text-sm text-comic-blue font-bold uppercase tracking-wider">
                          {groupTitle} ({groupItems.length})
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center justify-start gap-4 pt-1">
                        {groupItems.map(({ instance, originalIndex }) => (
                          <div
                            key={instance.instanceId}
                            className="flex flex-col items-center gap-1"
                          >
                            <div className="relative">
                              <CardView
                                card={instance.card}
                                instance={instance}
                                size="sm"
                                enableHoverZoom={true}
                              />
                              <span className="absolute -top-2 -left-2 bg-slate-900 text-sky-300 font-comic text-[10px] px-1.5 py-0.5 rounded border border-comic-black shadow-comic-sm">
                                #{originalIndex + 1}
                              </span>
                            </div>
                            {/* Card Name as Bottom Label */}
                            <span className="bg-white/95 text-slate-900 border border-comic-black font-sans text-xs font-semibold px-2 py-0.5 rounded shadow-comic-sm truncate max-w-[120px] text-center">
                              {instance.card.name}
                            </span>
                            {devMode && (
                              <button
                                onClick={() => handleDevAddCard(instance.instanceId)}
                                className="w-full bg-comic-yellow hover:bg-amber-300 text-comic-black font-comic text-[10px] font-bold py-1 px-1.5 rounded border border-comic-black shadow-comic-sm transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                                title={`Dev Mode: Add ${instance.card.name} to hand`}
                              >
                                <Plus className="w-3 h-3" />
                                <span>+ Hand</span>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-center gap-4 py-4 max-h-[60vh] overflow-y-auto pr-1">
                  {processedDeckItems.map(({ instance, originalIndex }) => (
                    <div key={instance.instanceId} className="flex flex-col items-center gap-1">
                      <div className="relative">
                        <CardView
                          card={instance.card}
                          instance={instance}
                          size="sm"
                          enableHoverZoom={true}
                        />
                        <span className="absolute -top-2 -left-2 bg-slate-900 text-sky-300 font-comic text-[10px] px-1.5 py-0.5 rounded border border-comic-black shadow-comic-sm">
                          #{originalIndex + 1}
                        </span>
                      </div>
                      {/* Card Name as Bottom Label */}
                      <span className="bg-white/95 text-slate-900 border border-comic-black font-sans text-xs font-semibold px-2 py-0.5 rounded shadow-comic-sm truncate max-w-[120px] text-center">
                        {instance.card.name}
                      </span>
                      {devMode && (
                        <button
                          onClick={() => handleDevAddCard(instance.instanceId)}
                          className="w-full bg-comic-yellow hover:bg-amber-300 text-comic-black font-comic text-[10px] font-bold py-1 px-1.5 rounded border border-comic-black shadow-comic-sm transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                          title={`Dev Mode: Add ${instance.card.name} to hand`}
                        >
                          <Plus className="w-3 h-3" />
                          <span>+ Hand</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="text-center pt-2 border-t border-slate-200">
                <button
                  onClick={() => setShowDeckModal(false)}
                  className="comic-button-primary px-6 py-2 text-sm font-comic cursor-pointer"
                >
                  Close Inspector
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Player Discard Pile Modal */}
      {showDiscardModal &&
        createPortal(
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white border-4 border-comic-black rounded-2xl shadow-comic-lg max-w-5xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b-2 border-comic-black pb-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-6 h-6 text-comic-blue" />
                  <div>
                    <h3 className="font-comic text-xl text-comic-black uppercase">
                      Player Discard Pile ({discard.length} Cards)
                    </h3>
                    <p className="text-xs text-slate-600">
                      Discard piles are open information. Listed in discard order.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDiscardModal(false)}
                  className="p-1.5 rounded-lg border-2 border-comic-black bg-rose-100 hover:bg-rose-200 text-comic-red transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-4 py-4 max-h-[60vh] overflow-y-auto pr-1">
                {discard.map((cardInst, idx) => (
                  <div key={cardInst.instanceId} className="flex flex-col items-center gap-1">
                    <div className="relative">
                      <CardView
                        card={cardInst.card}
                        instance={cardInst}
                        size="sm"
                        enableHoverZoom={true}
                      />
                      <span className="absolute -top-2 -left-2 bg-slate-900 text-white font-comic text-[10px] px-1.5 py-0.5 rounded border border-comic-black">
                        #{idx + 1}
                      </span>
                    </div>
                    <span className="bg-white/95 text-slate-900 border border-comic-black font-sans text-xs font-semibold px-2 py-0.5 rounded shadow-comic-sm truncate max-w-[120px] text-center">
                      {cardInst.card.name}
                    </span>
                  </div>
                ))}
              </div>

              <div className="text-center pt-2 border-t border-slate-200">
                <button
                  onClick={() => setShowDiscardModal(false)}
                  className="comic-button-primary px-6 py-2 text-sm font-comic cursor-pointer"
                >
                  Close Discard Viewer
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Nemesis Set / Out of Play Modal */}
      {showNemesisModal &&
        createPortal(
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white border-4 border-comic-black rounded-2xl shadow-comic-lg max-w-4xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b-2 border-comic-black pb-3">
                <div className="flex items-center gap-2">
                  <Skull className="w-6 h-6 text-comic-red" />
                  <div>
                    <h3 className="font-comic text-xl text-comic-black uppercase">
                      Nemesis Set • Set Aside (Out of Play)
                    </h3>
                    <p className="text-xs text-slate-600">
                      These 5 cards are set aside at game start and enter play if "Shadow of the
                      Past" is revealed.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowNemesisModal(false)}
                  className="p-1.5 rounded-lg border-2 border-comic-black bg-rose-100 hover:bg-rose-200 text-comic-red transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-5 py-4 max-h-[60vh] overflow-y-auto pr-1">
                {setAsideCards.map((cardInst) => (
                  <div key={cardInst.instanceId} className="flex flex-col items-center gap-1">
                    <CardView
                      card={cardInst.card}
                      instance={cardInst}
                      size="md"
                      enableHoverZoom={true}
                    />
                    <span className="font-comic text-xs text-slate-600 uppercase">
                      {cardInst.card.name}
                    </span>
                  </div>
                ))}
              </div>

              <div className="text-center pt-2 border-t border-slate-200">
                <button
                  onClick={() => setShowNemesisModal(false)}
                  className="comic-button-primary px-6 py-2 text-sm font-comic cursor-pointer"
                >
                  Close Out of Play Viewer
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Card Payment & Action Modal */}
      {playingCard && player && gameState && onDispatchAction && (
        <CardPaymentModal
          isOpen={Boolean(playingCard)}
          onClose={() => setPlayingCard(null)}
          cardToPlay={playingCard}
          player={player}
          gameState={gameState}
          onConfirmPlay={(paymentHandCardIds, generatorCardIds, targetInstanceId) => {
            onDispatchAction({
              type: 'PLAY_CARD',
              playerId: player.id,
              cardInstanceId: playingCard.instanceId,
              paymentCardInstanceIds: paymentHandCardIds,
              generatorInstanceIds: generatorCardIds,
              targetInstanceId,
            });
            setPlayingCard(null);
          }}
        />
      )}
    </>
  );
};

export default PlayerHandTray;
