import React from 'react';
import { Search, Filter, RotateCcw } from 'lucide-react';
import { PackMetadataResponse } from '../../../tools/editor/api-middleware';
import { CardFilters } from '../../services/supplemental-editor-service';

interface CardFilterToolbarProps {
  filters: CardFilters;
  onFiltersChange: (newFilters: CardFilters) => void;
  metadata: PackMetadataResponse | null;
  totalCards: number;
  filteredCards: number;
  loading: boolean;
}

export const CardFilterToolbar: React.FC<CardFilterToolbarProps> = ({
  filters,
  onFiltersChange,
  metadata,
  totalCards,
  filteredCards,
  loading,
}) => {
  const handlePackChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    onFiltersChange({
      ...filters,
      pack: val || undefined,
      packFile: undefined, // reset specific file when pack changes
    });
  };

  const handleSetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    onFiltersChange({
      ...filters,
      set: val || undefined,
    });
  };

  const handleFactionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    onFiltersChange({
      ...filters,
      faction: val || undefined,
    });
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    onFiltersChange({
      ...filters,
      status: val || undefined,
    });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onFiltersChange({
      ...filters,
      search: val || undefined,
    });
  };

  const handleReset = () => {
    onFiltersChange({});
  };

  const hasActiveFilters = Boolean(
    filters.pack ||
    filters.set ||
    filters.faction ||
    filters.status ||
    filters.search ||
    filters.hero,
  );

  return (
    <div className="bg-comic-panel border-b-4 border-black p-4 shadow-comic-pop relative z-20">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Title & Count Badge */}
        <div className="flex items-center gap-3">
          <div className="bg-comic-accent text-white px-3 py-1 font-bangers text-lg border-2 border-black shadow-comic-sm flex items-center gap-2">
            <Filter className="w-4 h-4" />
            <span>CARD CATALOG FILTER</span>
          </div>
          <span className="font-comic text-xs font-bold bg-comic-paper px-2 py-1 border border-black rounded">
            Showing {loading ? '...' : filteredCards} of {totalCards} cards
          </span>
        </div>

        {/* Reset Filter Action */}
        {hasActiveFilters && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-xs font-bold bg-comic-yellow hover:bg-yellow-400 text-black px-2.5 py-1 border-2 border-black shadow-comic-sm transition-transform active:scale-95 cursor-pointer"
            title="Clear all filters"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Filters</span>
          </button>
        )}
      </div>

      {/* Filter Selectors Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5 mt-3">
        {/* 1. Pack Filter */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-comic-dark mb-1">
            Zzorba Pack
          </label>
          <select
            value={filters.pack || ''}
            onChange={handlePackChange}
            className="w-full bg-white text-black text-xs font-medium border-2 border-black px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-comic-red shadow-comic-xs"
          >
            <option value="">All Packs ({metadata?.packs.length || 0})</option>
            {metadata?.packs.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name} {p.size ? `(${p.size})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* 2. Encounter / Card Set Filter */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-comic-dark mb-1">
            Encounter / Set
          </label>
          <select
            value={filters.set || ''}
            onChange={handleSetChange}
            className="w-full bg-white text-black text-xs font-medium border-2 border-black px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-comic-red shadow-comic-xs"
          >
            <option value="">All Sets ({metadata?.sets.length || 0})</option>
            {metadata?.sets.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name} {s.card_set_type_code ? `[${s.card_set_type_code}]` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* 3. Faction / Affinity Filter */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-comic-dark mb-1">
            Affinity / Aspect
          </label>
          <select
            value={filters.faction || ''}
            onChange={handleFactionChange}
            className="w-full bg-white text-black text-xs font-medium border-2 border-black px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-comic-red shadow-comic-xs capitalize"
          >
            <option value="">All Affinities</option>
            {metadata?.factions.map((f) => (
              <option key={f.code} value={f.code} className="capitalize">
                {f.name}
              </option>
            ))}
          </select>
        </div>

        {/* 4. Supplemental Status Filter */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-comic-dark mb-1">
            Supplemental Status
          </label>
          <select
            value={filters.status || ''}
            onChange={handleStatusChange}
            className="w-full bg-white text-black text-xs font-medium border-2 border-black px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-comic-red shadow-comic-xs"
          >
            <option value="">All Statuses</option>
            <option value="has_supplemental">🟢 Defined Supplemental</option>
            <option value="missing_supplemental">⚪ Missing Supplemental</option>
            <option value="valid_supplemental">✓ Valid Schema</option>
            <option value="invalid_supplemental">🔴 Schema Error</option>
          </select>
        </div>

        {/* 5. Live Search Input */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-comic-dark mb-1">
            Search Text / Code
          </label>
          <div className="relative">
            <input
              type="text"
              placeholder="e.g. 01001a, Spider-Man..."
              value={filters.search || ''}
              onChange={handleSearchChange}
              className="w-full bg-white text-black text-xs font-medium border-2 border-black pl-7 pr-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-comic-red shadow-comic-xs"
            />
            <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-gray-500 pointer-events-none" />
          </div>
        </div>
      </div>
    </div>
  );
};
