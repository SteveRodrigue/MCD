import React, { useState, useEffect, useCallback } from 'react';
import {
  CardFilters,
  fetchPacksMetadata,
  fetchCards,
  fetchCardDetails,
  saveCardSupplemental,
} from '../../services/supplemental-editor-service';
import {
  CardSummary,
  PackMetadataResponse,
  CardDetailsResponse,
} from '../../../tools/editor/api-middleware';
import { CardFilterToolbar } from './CardFilterToolbar';
import { CardGalleryList } from './CardGalleryList';
import { DualCardInspector } from './DualCardInspector';
import { ArrowLeft, BookOpen, RefreshCw } from 'lucide-react';

interface SupplementalEditorScreenProps {
  initialCode?: string;
  onBackToGame?: () => void;
}

export const SupplementalEditorScreen: React.FC<SupplementalEditorScreenProps> = ({
  initialCode,
  onBackToGame,
}) => {
  const [metadata, setMetadata] = useState<PackMetadataResponse | null>(null);
  const [filters, setFilters] = useState<CardFilters>(() => {
    // Read initial filters or code from window location search
    const params = new URLSearchParams(window.location.search);
    return {
      pack: params.get('pack') || undefined,
      set: params.get('set') || undefined,
      faction: params.get('faction') || undefined,
      hero: params.get('hero') || undefined,
      status: params.get('status') || undefined,
      search: params.get('search') || undefined,
    };
  });

  const [cards, setCards] = useState<CardSummary[]>([]);
  const [totalCards, setTotalCards] = useState<number>(0);
  const [loadingList, setLoadingList] = useState<boolean>(true);

  // Selected card code
  const [selectedCode, setSelectedCode] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('code') || initialCode || null;
  });

  const [cardDetails, setCardDetails] = useState<CardDetailsResponse | null>(null);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);

  // 1. Fetch metadata on mount
  useEffect(() => {
    fetchPacksMetadata()
      .then((data) => setMetadata(data))
      .catch((err) => console.error('Failed to load metadata:', err));
  }, []);

  // 2. Fetch cards when filters change
  const loadCards = useCallback(() => {
    setLoadingList(true);
    fetchCards(filters)
      .then((res) => {
        setCards(res.cards);
        setTotalCards(res.total);
        // If selected card not in list, select first available card
        if (!selectedCode && res.cards.length > 0) {
          setSelectedCode(res.cards[0].code);
        }
      })
      .catch((err) => console.error('Failed to load cards:', err))
      .finally(() => setLoadingList(false));
  }, [filters, selectedCode]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  // 3. Fetch card details when selectedCode changes
  useEffect(() => {
    if (!selectedCode) {
      setCardDetails(null);
      return;
    }

    setLoadingDetails(true);
    fetchCardDetails(selectedCode)
      .then((data) => {
        setCardDetails(data);
      })
      .catch((err) => {
        console.error(`Failed to load details for ${selectedCode}:`, err);
        setCardDetails(null);
      })
      .finally(() => setLoadingDetails(false));

    // Synchronize browser URL query param (?code=01001a)
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('code', selectedCode);
      window.history.replaceState({}, '', url.toString());
    } catch {
      // ignore
    }
  }, [selectedCode]);

  const handleSelectCard = (code: string) => {
    setSelectedCode(code);
  };

  const handleBack = () => {
    if (onBackToGame) {
      onBackToGame();
    } else {
      // If opened in separate window/tab, navigate to root or close
      window.location.href = '/';
    }
  };

  const handleSaveSupplemental = async (
    code: string,
    payload: { packFile: string; supplemental: any },
  ): Promise<boolean> => {
    try {
      const res = await saveCardSupplemental(code, payload);
      if (res.success) {
        loadCards();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to save supplemental:', err);
      return false;
    }
  };

  return (
    <div className="min-h-screen w-full bg-comic-paper flex flex-col overflow-hidden font-sans select-none">
      {/* Halftone Dot Overlay */}
      <div className="fixed inset-0 bg-bendy-dots pointer-events-none z-0" />

      {/* TOP HEADER BAR */}
      <header className="relative z-20 bg-comic-panel border-b-4 border-black px-4 py-2.5 flex items-center justify-between shadow-comic-md">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="flex items-center gap-1 text-xs font-bold bg-white hover:bg-gray-100 text-black px-3 py-1.5 border-2 border-black shadow-comic-xs cursor-pointer active:scale-95 transition-transform"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Game</span>
          </button>

          <div className="flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-comic-red" />
            <h1 className="font-bangers text-2xl tracking-wider text-black">
              CARD SUPPLEMENTAL REVIEWER & EDITOR
            </h1>
          </div>
          <span className="hidden sm:inline-block text-xs font-comic font-bold bg-comic-yellow text-black px-2 py-0.5 border border-black rounded shadow-comic-xs">
            Phase 2.5 Tooling
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              loadCards();
              if (selectedCode) {
                setLoadingDetails(true);
                fetchCardDetails(selectedCode)
                  .then(setCardDetails)
                  .finally(() => setLoadingDetails(false));
              }
            }}
            className="flex items-center gap-1.5 text-xs font-bold bg-white hover:bg-gray-100 text-black px-2.5 py-1.5 border-2 border-black shadow-comic-xs cursor-pointer active:scale-95 transition-transform"
            title="Refresh catalog from disk"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loadingList || loadingDetails ? 'animate-spin' : ''}`}
            />
            <span>Reload</span>
          </button>
        </div>
      </header>

      {/* FILTER TOOLBAR */}
      <CardFilterToolbar
        filters={filters}
        onFiltersChange={setFilters}
        metadata={metadata}
        totalCards={totalCards}
        filteredCards={cards.length}
        loading={loadingList}
      />

      {/* MAIN WORKSPACE SPLIT (Left: Card Gallery List, Right: Dual Inspector) */}
      <div className="relative z-10 flex-1 flex flex-col md:flex-row overflow-hidden border-t-2 border-black">
        {/* LEFT PANE: Card List */}
        <div className="w-full md:w-80 lg:w-96 border-r-4 border-black h-48 md:h-auto overflow-hidden flex flex-col shrink-0 bg-white">
          <CardGalleryList
            cards={cards}
            selectedCode={selectedCode}
            onSelectCard={handleSelectCard}
            loading={loadingList}
          />
        </div>

        {/* RIGHT PANE: Dual Inspector */}
        <div className="flex-1 h-full overflow-hidden flex flex-col">
          <DualCardInspector
            cardDetails={cardDetails}
            loading={loadingDetails}
            onSaveSupplemental={handleSaveSupplemental}
          />
        </div>
      </div>
    </div>
  );
};
