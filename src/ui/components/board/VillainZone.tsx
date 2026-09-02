import React, { useState, useMemo } from 'react';
import { Skull, AlertTriangle, Layers, Flame, X, Eye, ArrowDownUp, Filter } from 'lucide-react';
import {
  VillainState,
  MainSchemeState,
  SideSchemeState,
  CardInstance,
  StatusCard,
  NormalizedCard,
} from '../../../engine/models';
import { CardView } from '../cards/CardView';
import { CardAttachmentFan } from '../cards/CardAttachmentFan';
import { useGameSettings } from '../../context/useGameSettings';
import { getEncounterSetName } from './villain-zone-utils';

interface VillainZoneProps {
  villain: VillainState;
  mainScheme: MainSchemeState;
  sideSchemes: SideSchemeState[];
  encounterDeck: CardInstance[];
  encounterDiscard: CardInstance[];
  accelerationTokens: number;
}

type SortMode = 'deck_order' | 'card_type' | 'encounter_set';
type DeckDirection = 'top_to_bottom' | 'bottom_to_top';

function getCardTypeName(card: NormalizedCard): string {
  const type = card.type || (card as any).type_code || 'encounter';
  if (type === 'minion') return 'Minions';
  if (type === 'treachery') return 'Treacheries';
  if (type === 'side_scheme' || type === 'player_side_scheme') return 'Side Schemes';
  if (type === 'attachment') return 'Attachments';
  if (type === 'obligation') return 'Obligations';
  if (type === 'main_scheme') return 'Main Schemes';
  if (type === 'villain') return 'Villains';
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export const VillainZone: React.FC<VillainZoneProps> = ({
  villain,
  mainScheme,
  sideSchemes,
  encounterDeck,
  encounterDiscard,
  accelerationTokens,
}) => {
  const { devMode } = useGameSettings();
  const [showDeckModal, setShowDeckModal] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);

  // Inspector View Sort States
  const [sortMode, setSortMode] = useState<SortMode>('deck_order');
  const [deckDirection, setDeckDirection] = useState<DeckDirection>('top_to_bottom');

  const threatPercent = Math.min(100, (mainScheme.threat / mainScheme.targetThreat) * 100);
  const healthPercent = Math.max(0, (villain.health / villain.maxHealth) * 100);

  const topDiscard = encounterDiscard[encounterDiscard.length - 1];

  // Process and sort Encounter Deck for Inspector View
  const processedDeckItems = useMemo(() => {
    // Attach original deck index (0-based: 0 is top of deck)
    const items = encounterDeck.map((instance, originalIndex) => ({
      instance,
      originalIndex,
      encounterSet: getEncounterSetName(instance.card),
      cardType: getCardTypeName(instance.card),
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

    if (sortMode === 'encounter_set') {
      return [...items].sort((a, b) => {
        if (a.encounterSet !== b.encounterSet) return a.encounterSet.localeCompare(b.encounterSet);
        return a.originalIndex - b.originalIndex;
      });
    }

    return items;
  }, [encounterDeck, sortMode, deckDirection]);

  // Group items by category if not in pure deck order
  const groupedDeckItems = useMemo(() => {
    if (sortMode === 'deck_order') return null;

    const groupKey = sortMode === 'card_type' ? 'cardType' : 'encounterSet';
    const groups: Record<string, typeof processedDeckItems> = {};

    processedDeckItems.forEach((item) => {
      const key = item[groupKey];
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });

    return groups;
  }, [processedDeckItems, sortMode]);

  return (
    <>
      <section className="comic-panel p-4 bg-white/95 relative shadow-comic">
        {/* Zone Title Ribbon */}
        <div className="absolute -top-3 left-4 bg-comic-red text-white border border-comic-black font-comic text-xs px-3 py-0.5 tracking-wider shadow-comic-sm flex items-center gap-1">
          <Skull className="w-3.5 h-3.5" />
          <span>VILLAIN & SCENARIO ZONE</span>
        </div>

        <div className="flex flex-wrap items-start gap-4 pt-2">
          {/* 1. Encounter Deck & Discard Piles (Left of Villain) */}
          <div className="flex md:flex-col items-center justify-center gap-3 shrink-0">
            {/* Encounter Draw Pile (Face-Down Default • Click to Inspect in Dev Mode) */}
            <div
              onClick={() => devMode && setShowDeckModal(true)}
              className={`flex flex-col items-center group ${devMode ? 'cursor-pointer' : 'cursor-default'}`}
              title={
                devMode
                  ? 'Inspect Encounter Deck (Dev Mode Active)'
                  : 'Encounter Draw Deck (Hidden Information • Enable Dev Mode to inspect)'
              }
            >
              <div
                className={`w-18 h-26 sm:w-20 sm:h-28 bg-slate-900 border-2 border-comic-black rounded-lg shadow-comic-sm flex flex-col items-center justify-center p-2 text-center relative overflow-hidden bg-bendy-dots transition-all ${
                  devMode ? 'group-hover:border-comic-yellow' : ''
                }`}
              >
                <Layers className="w-5 h-5 text-comic-yellow mb-1 group-hover:scale-110 transition-transform" />
                <span className="font-comic text-lg text-white leading-none">
                  {encounterDeck.length}
                </span>
                <span className="text-[9px] font-bold text-slate-400 uppercase">DECK</span>
              </div>
            </div>

            {/* Encounter Discard Pile (Open Information • Click to Inspect) */}
            <div className="flex flex-col items-center">
              {topDiscard ? (
                <div
                  onClick={() => setShowDiscardModal(true)}
                  className="relative cursor-pointer group"
                  title="Inspect Encounter Discard Pile"
                >
                  <CardView
                    card={topDiscard.card}
                    size="sm"
                    showTokens={false}
                    enableHoverZoom={true}
                  />
                  <span className="absolute -bottom-2 -right-2 bg-slate-900 text-white font-comic text-xs px-1.5 py-0.5 rounded-full border border-comic-black shadow-comic-sm">
                    {encounterDiscard.length}
                  </span>
                </div>
              ) : (
                <div className="w-18 h-26 sm:w-20 sm:h-28 bg-slate-100 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center text-center p-1">
                  <span className="font-comic text-xs text-slate-400">DISCARD</span>
                  <span className="text-[10px] text-slate-400 font-bold">EMPTY</span>
                </div>
              )}
            </div>
          </div>

          {/* 2. Villain Panel & Attachments (Shrunk to exact width of card + borders) */}
          <div className="w-fit flex flex-col gap-2 bg-rose-50/80 p-3 rounded-xl border-2 border-comic-black shadow-comic-sm shrink-0">
            {/* Header */}
            <div className="flex items-center justify-between gap-2 w-full">
              <div className="flex items-center gap-1">
                <Skull className="w-4 h-4 text-comic-red shrink-0" />
                <span className="font-comic text-sm text-comic-black truncate max-w-[130px]">
                  {villain.card.name}
                </span>
              </div>
              <span className="bg-slate-950 text-white font-comic text-[10px] px-1.5 py-0.5 rounded border border-comic-black shrink-0">
                {villain.card.stage ? `STAGE ${villain.card.stage}` : 'VILLAIN'}
              </span>
            </div>

            {/* Health Bar (Exact width of card) */}
            <div className="w-full space-y-0.5">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-slate-600">Health:</span>
                <span className="text-comic-red font-comic text-xs">
                  {villain.health} / {villain.maxHealth} HP
                </span>
              </div>
              <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden border border-comic-black shadow-comic-sm">
                <div
                  className="bg-comic-red h-full transition-all duration-300"
                  style={{ width: `${healthPercent}%` }}
                />
              </div>
            </div>

            {/* Status Overlay Badges */}
            {villain.statusCards.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {villain.statusCards.map((st, i) => (
                  <span
                    key={i}
                    className={`font-comic text-[10px] px-1.5 py-0.5 rounded border border-comic-black uppercase shadow-comic-sm font-bold ${
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
            <div className="flex flex-col items-center w-full pt-0.5">
              <CardView card={villain.card} size="sm" showTokens={false} enableHoverZoom={true} />
              <CardAttachmentFan
                attachments={villain.attachments}
                cardsUnderneath={villain.cardsUnderneath}
              />
            </div>
          </div>

          {/* 3. Main Scheme Panel (Landscape Card + Vertical Threat Meter on the Right) */}
          <div className="w-fit flex flex-col gap-2 bg-amber-50/80 p-3 rounded-xl border-2 border-comic-black shadow-comic-sm shrink-0">
            {/* Header: Title on Left, Text Version Threat Limit on Top Right */}
            <div className="flex items-center justify-between gap-3 w-full">
              <div className="flex items-center gap-1.5 min-w-0">
                <AlertTriangle className="w-4 h-4 text-comic-red shrink-0" />
                <span className="font-comic text-sm text-comic-black truncate">
                  {mainScheme.card.name}
                </span>
                {accelerationTokens > 0 && (
                  <span className="bg-comic-yellow text-comic-black border border-comic-black font-comic text-[10px] px-1.5 py-0.5 rounded-full shadow-comic-sm animate-pulse shrink-0">
                    ⚡ +{accelerationTokens}
                  </span>
                )}
              </div>

              {/* Text version of threat on the top right */}
              <div className="shrink-0">
                <span
                  className={`font-comic text-xs px-2 py-0.5 rounded-md border border-comic-black shadow-comic-sm tracking-wide ${
                    threatPercent > 75
                      ? 'bg-comic-red text-white'
                      : threatPercent > 40
                        ? 'bg-comic-yellow text-comic-black'
                        : 'bg-comic-blue text-white'
                  }`}
                >
                  {mainScheme.threat} / {mainScheme.targetThreat} THREAT
                </span>
              </div>
            </div>

            {/* Main Scheme Card with Vertical Threat Meter on the Right */}
            <div className="flex items-stretch gap-2.5 pt-0.5">
              <CardView
                card={mainScheme.card}
                size="md"
                showTokens={false}
                enableHoverZoom={true}
              />

              {/* Vertical Threat Meter Gauge on the Right */}
              <div className="flex flex-col items-center justify-between h-[176px] py-0.5 shrink-0">
                <div
                  className="relative w-5 h-full bg-slate-200 rounded-full border-2 border-comic-black shadow-comic-sm overflow-hidden flex flex-col justify-end"
                  title={`Threat: ${mainScheme.threat} / {mainScheme.targetThreat} (${Math.round(threatPercent)}%)`}
                >
                  {/* Dynamic Vertical Fill Bar (Bottom to Top) with color transition from Blue -> Yellow -> Red */}
                  <div
                    className={`w-full transition-all duration-300 ${
                      threatPercent > 75
                        ? 'bg-gradient-to-t from-amber-400 via-orange-500 to-comic-red'
                        : threatPercent > 40
                          ? 'bg-gradient-to-t from-comic-blue via-sky-400 to-amber-400'
                          : 'bg-gradient-to-t from-sky-600 to-comic-blue'
                    }`}
                    style={{ height: `${threatPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 4. Active Side Schemes & Player Schemes (Takes remaining width) */}
          <div className="flex-1 min-w-[200px] flex flex-col gap-2 bg-slate-50/90 p-3 rounded-xl border-2 border-comic-black shadow-comic-sm min-h-[220px]">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-slate-600 border-b border-slate-200 pb-1.5">
              <Flame className="w-4 h-4 text-comic-red" />
              <span>Active Side Schemes ({sideSchemes.length})</span>
            </div>

            {sideSchemes.length > 0 ? (
              <div className="flex flex-wrap gap-3 items-center overflow-y-auto max-h-[260px] pt-1">
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
              <div className="flex-1 flex flex-col items-center justify-center p-3 text-center text-xs text-slate-400 font-semibold border-2 border-dashed border-slate-300 rounded-lg">
                <span>No side schemes active</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Encounter Deck Inspector Modal (Dev Mode with Sorting & Set Labels) */}
      {showDeckModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border-4 border-comic-black rounded-2xl shadow-comic-lg max-w-5xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b-2 border-comic-black pb-3">
              <div className="flex items-center gap-2">
                <Eye className="w-6 h-6 text-comic-yellow" />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-comic text-xl text-comic-black uppercase">
                      Encounter Deck Inspector ({encounterDeck.length} Cards)
                    </h3>
                    <span className="bg-comic-yellow text-comic-black border border-comic-black font-comic text-[10px] px-2 py-0.5 rounded font-bold">
                      DEV MODE
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Sort view by Deck Order, Card Type, or Encounter Set. Each card displays its
                    Encounter Set label below.
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

            {/* Sorting Controls Bar */}
            <div className="bg-slate-100 p-3 rounded-xl border-2 border-comic-black shadow-comic-sm flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-comic-blue" />
                <span className="font-comic text-xs text-slate-700 uppercase">Sort View By:</span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setSortMode('deck_order')}
                    className={`font-comic text-xs px-3 py-1 rounded border border-comic-black transition-all cursor-pointer ${
                      sortMode === 'deck_order'
                        ? 'bg-comic-blue text-white shadow-comic-sm font-bold'
                        : 'bg-white text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Deck Order
                  </button>
                  <button
                    onClick={() => setSortMode('card_type')}
                    className={`font-comic text-xs px-3 py-1 rounded border border-comic-black transition-all cursor-pointer ${
                      sortMode === 'card_type'
                        ? 'bg-comic-blue text-white shadow-comic-sm font-bold'
                        : 'bg-white text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Card Type
                  </button>
                  <button
                    onClick={() => setSortMode('encounter_set')}
                    className={`font-comic text-xs px-3 py-1 rounded border border-comic-black transition-all cursor-pointer ${
                      sortMode === 'encounter_set'
                        ? 'bg-comic-blue text-white shadow-comic-sm font-bold'
                        : 'bg-white text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Encounter Set
                  </button>
                </div>
              </div>

              {sortMode === 'deck_order' && (
                <div className="flex items-center gap-2">
                  <ArrowDownUp className="w-4 h-4 text-slate-600" />
                  <button
                    onClick={() =>
                      setDeckDirection((prev) =>
                        prev === 'top_to_bottom' ? 'bottom_to_top' : 'top_to_bottom',
                      )
                    }
                    className="font-comic text-xs px-3 py-1 rounded border border-comic-black bg-white hover:bg-slate-200 shadow-comic-sm font-bold transition-all cursor-pointer"
                  >
                    {deckDirection === 'top_to_bottom'
                      ? '⬆️ Top to Bottom (#1 ⟶ #N)'
                      : '⬇️ Bottom to Top (#N ⟶ #1)'}
                  </button>
                </div>
              )}
            </div>

            {/* Cards Display Grid (Grouped or Flat) */}
            {groupedDeckItems ? (
              <div className="space-y-6 py-2">
                {Object.entries(groupedDeckItems).map(([groupName, groupItems]) => (
                  <div
                    key={groupName}
                    className="space-y-2 bg-slate-50 p-3.5 rounded-xl border border-slate-300"
                  >
                    <div className="flex items-center justify-between border-b border-slate-300 pb-1.5">
                      <span className="font-comic text-sm text-comic-black uppercase">
                        {groupName} ({groupItems.length} Cards)
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 pt-2">
                      {groupItems.map(({ instance, originalIndex, encounterSet }) => (
                        <div key={instance.instanceId} className="flex flex-col items-center gap-1">
                          <div className="relative">
                            <CardView
                              card={instance.card}
                              instance={instance}
                              size="sm"
                              enableHoverZoom={true}
                            />
                            <span className="absolute -top-2 -left-2 bg-slate-900 text-comic-yellow font-comic text-[10px] px-1.5 py-0.5 rounded border border-comic-black shadow-comic-sm">
                              #{originalIndex + 1}
                            </span>
                          </div>
                          {/* Only show Encounter Set Label if NOT sorting by Encounter Set */}
                          {sortMode !== 'encounter_set' && (
                            <span className="bg-white/95 text-slate-900 border border-comic-black font-sans text-xs font-semibold px-2 py-0.5 rounded shadow-comic-sm truncate max-w-[120px] text-center">
                              {encounterSet}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-center gap-4 py-4">
                {processedDeckItems.map(({ instance, originalIndex, encounterSet }) => (
                  <div key={instance.instanceId} className="flex flex-col items-center gap-1">
                    <div className="relative">
                      <CardView
                        card={instance.card}
                        instance={instance}
                        size="sm"
                        enableHoverZoom={true}
                      />
                      <span className="absolute -top-2 -left-2 bg-slate-900 text-comic-yellow font-comic text-[10px] px-1.5 py-0.5 rounded border border-comic-black shadow-comic-sm">
                        #{originalIndex + 1}
                      </span>
                    </div>
                    {/* Legible Encounter Set Label at the Bottom */}
                    <span className="bg-white/95 text-slate-900 border border-comic-black font-sans text-xs font-semibold px-2 py-0.5 rounded shadow-comic-sm truncate max-w-[120px] text-center">
                      {encounterSet}
                    </span>
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
        </div>
      )}

      {/* Encounter Discard Pile Modal */}
      {showDiscardModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border-4 border-comic-black rounded-2xl shadow-comic-lg max-w-5xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b-2 border-comic-black pb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-6 h-6 text-comic-red" />
                <div>
                  <h3 className="font-comic text-xl text-comic-black uppercase">
                    Encounter Discard Pile ({encounterDiscard.length} Cards)
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

            <div className="flex flex-wrap items-center justify-center gap-4 py-4">
              {encounterDiscard.map((cardInst, idx) => (
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
                    {getEncounterSetName(cardInst.card)}
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
        </div>
      )}
    </>
  );
};

export default VillainZone;
