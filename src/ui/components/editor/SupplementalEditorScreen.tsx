import React, { useState, useEffect } from 'react';
import { useAsyncData } from '../../hooks/useAsyncData';
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
import { ArrowLeft, BookOpen, PanelLeftClose, PanelLeftOpen, RefreshCw } from 'lucide-react';

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

  const [page, setPage] = useState<number>(1);
  const PAGE_SIZE = 50;

  // Selected card code
  const [selectedCode, setSelectedCode] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('code') || initialCode || null;
  });

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  // 1. Fetch metadata on mount
  useEffect(() => {
    fetchPacksMetadata()
      .then((data) => setMetadata(data))
      .catch((err) => console.error('Failed to load metadata:', err));
  }, []);

  // 2. Fetch cards when filters or page change
  const cardList = useAsyncData(JSON.stringify({ ...filters, page }), () =>
    fetchCards({ ...filters, page, limit: PAGE_SIZE }),
  );
  const cards: CardSummary[] = cardList.data?.cards ?? [];
  const totalCards = cardList.data?.total ?? 0;
  const loadingList = cardList.loading;
  const reloadCards = cardList.reload;

  // If no card is selected, select the first available card
  const firstCode = cards.length > 0 ? cards[0].code : null;
  if (selectedCode === null && firstCode !== null) setSelectedCode(firstCode);

  // 3. Fetch card details when selectedCode changes
  const details = useAsyncData(selectedCode, () => fetchCardDetails(selectedCode as string));
  const cardDetails: CardDetailsResponse | null = details.data;
  const loadingDetails = details.loading;
  const reloadDetails = details.reload;

  useEffect(() => {
    if (cardList.error) console.error('Failed to load cards:', cardList.error);
  }, [cardList.error]);

  useEffect(() => {
    if (details.error) console.error(`Failed to load details for ${selectedCode}:`, details.error);
  }, [details.error, selectedCode]);

  useEffect(() => {
    if (!selectedCode) return;

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
        reloadCards();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to save supplemental:', err);
      return false;
    }
  };

  const handleFiltersChange = (newFilters: CardFilters) => {
    setFilters(newFilters);
    setPage(1);
  };

  return (
    <div className="min-h-screen w-full bg-comic-paper flex flex-col overflow-hidden font-sans select-none">
      {/* TOP HEADER BAR */}
      <header className="relative z-raised bg-comic-panel border-b-4 border-black px-4 py-2.5 flex items-center justify-between shadow-comic-md">
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
            type="button"
            data-testid="toggle-sidebar-btn"
            onClick={() => setIsSidebarCollapsed((prev) => !prev)}
            className="flex items-center gap-1.5 text-xs font-bold bg-white hover:bg-gray-100 text-black px-2.5 py-1.5 border-2 border-black shadow-comic-xs cursor-pointer active:scale-95 transition-transform"
            title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpen className="w-3.5 h-3.5" />
            ) : (
              <PanelLeftClose className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">
              {isSidebarCollapsed ? 'Show List' : 'Hide List'}
            </span>
          </button>

          <button
            onClick={() => {
              reloadCards();
              reloadDetails();
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
        onFiltersChange={handleFiltersChange}
        metadata={metadata}
        totalCards={totalCards}
        filteredCards={cards.length}
        loading={loadingList}
      />

      {/* MAIN WORKSPACE SPLIT (Left: Card Gallery List, Right: Dual Inspector) */}
      <div className="relative z-content flex-1 flex flex-col md:flex-row overflow-hidden border-t-2 border-black">
        {/* Edge toggle when collapsed */}
        {isSidebarCollapsed && (
          <button
            type="button"
            data-testid="toggle-sidebar-edge-btn"
            onClick={() => setIsSidebarCollapsed(false)}
            className="absolute left-0 top-3 z-zoom bg-comic-yellow hover:bg-yellow-400 text-black p-1.5 border-2 border-l-0 border-black shadow-comic-xs cursor-pointer active:scale-95 transition-transform"
            title="Expand Sidebar"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        )}

        {/* LEFT PANE: Card List */}
        <div
          data-testid="card-gallery-pane"
          className={`${
            isSidebarCollapsed
              ? 'hidden'
              : 'w-full md:w-80 lg:w-96 border-r-4 border-black h-48 md:h-auto overflow-hidden flex flex-col shrink-0 bg-white'
          }`}
        >
          <CardGalleryList
            cards={cards}
            selectedCode={selectedCode}
            onSelectCard={handleSelectCard}
            loading={loadingList}
            page={page}
            pageSize={PAGE_SIZE}
            totalCards={totalCards}
            onPageChange={setPage}
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
