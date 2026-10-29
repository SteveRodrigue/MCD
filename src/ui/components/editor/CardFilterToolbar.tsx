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
  const sets = metadata?.sets;
  const availableSets = React.useMemo(() => {
    if (!sets) return [];
    if (!filters.pack) return sets;
    // Metadata from a server that predates pack enrichment carries no pack info; show every set
    // instead of an empty list.
    const hasPackInfo = sets.some((s) => s.pack_code || (s.pack_codes && s.pack_codes.length > 0));
    if (!hasPackInfo) return sets;
    return sets.filter((s) => {
      if (s.pack_codes && s.pack_codes.length > 0) {
        return s.pack_codes.includes(filters.pack!);
      }
      return s.pack_code === filters.pack;
    });
  }, [sets, filters.pack]);

  const handlePackChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const nextPack = val || undefined;

    let nextSet = filters.set;
    if (nextSet && nextPack) {
      const setObj = metadata?.sets.find((s) => s.code === nextSet);
      const setBelongsToPack =
        setObj &&
        (setObj.pack_codes && setObj.pack_codes.length > 0
          ? setObj.pack_codes.includes(nextPack)
          : setObj.pack_code === nextPack);
      if (!setBelongsToPack) {
        nextSet = undefined;
      }
    }

    onFiltersChange({
      ...filters,
      pack: nextPack,
      set: nextSet,
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
    <div className="bg-comic-panel border-b-4 border-black p-4 shadow-comic-pop relative z-raised">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Title & Count Badge */}
        <div className="flex items-center gap-3">
          <div className="bg-comic-accent text-white px-3 py-1 font-bangers text-lg border-2 border-black shadow-comic-sm flex items-center gap-2">
            <Filter className="w-4 h-4" />
            <span>CARD CATALOG FILTER</span>
          </div>
          <span className="font-comic text-xs font-bold bg-comic-paper px-2 py-1 border border-black rounded-sm">
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
          <label
            htmlFor="filter-pack"
            className="block text-[11px] font-bold uppercase tracking-wider text-comic-dark mb-1"
          >
            Zzorba Pack
          </label>
          <select
            id="filter-pack"
            value={filters.pack || ''}
            onChange={handlePackChange}
            className="w-full bg-white text-black text-xs font-medium border-2 border-black px-2 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-comic-red shadow-comic-xs"
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
          <label
            htmlFor="filter-set"
            className="block text-[11px] font-bold uppercase tracking-wider text-comic-dark mb-1"
          >
            Encounter / Set
          </label>
          <select
            id="filter-set"
            value={filters.set || ''}
            onChange={handleSetChange}
            className="w-full bg-white text-black text-xs font-medium border-2 border-black px-2 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-comic-red shadow-comic-xs"
          >
            <option value="">
              {filters.pack
                ? `All Sets in Pack (${availableSets.length})`
                : `All Sets (${metadata?.sets.length || 0})`}
            </option>
            {availableSets.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name} {s.card_set_type_code ? `[${s.card_set_type_code}]` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* 3. Faction / Affinity Filter */}
        <div>
          <label
            htmlFor="filter-faction"
            className="block text-[11px] font-bold uppercase tracking-wider text-comic-dark mb-1"
          >
            Affinity / Aspect
          </label>
          <select
            id="filter-faction"
            value={filters.faction || ''}
            onChange={handleFactionChange}
            className="w-full bg-white text-black text-xs font-medium border-2 border-black px-2 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-comic-red shadow-comic-xs capitalize"
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
          <label
            htmlFor="filter-status"
            className="block text-[11px] font-bold uppercase tracking-wider text-comic-dark mb-1"
          >
            Supplemental Status
          </label>
          <select
            id="filter-status"
            value={filters.status || ''}
            onChange={handleStatusChange}
            className="w-full bg-white text-black text-xs font-medium border-2 border-black px-2 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-comic-red shadow-comic-xs"
          >
            <option value="">All Statuses</option>
            <option value="has_supplemental">🟢 Defined Supplemental</option>
            <option value="missing_supplemental">⚪ Missing Supplemental</option>
            <option value="valid_supplemental">✓ Valid Schema</option>
            <option value="invalid_supplemental">🔴 Schema Error</option>
            <option value="vanilla_supplemental">🛡️ Vanilla (No Supplemental Needed)</option>
            <option value="has_multistep">⚡ Has Multi-Step Ability</option>
            <option value="missing_audit">📝 Missing Audit Metadata</option>
          </select>
        </div>

        {/* 5. Live Search Input */}
        <div>
          <label
            htmlFor="filter-search"
            className="block text-[11px] font-bold uppercase tracking-wider text-comic-dark mb-1"
          >
            Search Text / Code
          </label>
          <div className="relative">
            <input
              id="filter-search"
              type="text"
              placeholder="e.g. 01001a, Spider-Man..."
              value={filters.search || ''}
              onChange={handleSearchChange}
              className="w-full bg-white text-black text-xs font-medium border-2 border-black pl-7 pr-2 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-comic-red shadow-comic-xs"
            />
            <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-gray-500 pointer-events-none" />
          </div>
        </div>
      </div>
    </div>
  );
};
