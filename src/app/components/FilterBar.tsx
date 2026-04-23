// src/app/components/FilterBar.tsx

import { useState } from "react";
import { Search, MapPin, SlidersHorizontal, X } from "lucide-react";
// MapPin used for location input below

export interface FilterState {
  query:     string;
  location:  string;
  minRate:   number;
  maxRate:   number;
  minRating: number;
}

interface FilterBarProps {
  onFilter: (filters: FilterState) => void;
}

const DEFAULT_FILTERS: FilterState = {
  query:     '',
  location:  '',
  minRate:   0,
  maxRate:   300,
  minRating: 0,
}

export function FilterBar({ onFilter }: FilterBarProps) {
  const [filters, setFilters]       = useState<FilterState>(DEFAULT_FILTERS)
  const [showPanel, setShowPanel]   = useState(false)

  function update(patch: Partial<FilterState>) {
    const next = { ...filters, ...patch }
    setFilters(next)
    onFilter(next)
  }

  function reset() {
    setFilters(DEFAULT_FILTERS)
    onFilter(DEFAULT_FILTERS)
  }

  const isFiltered =
    filters.query !== '' ||
    filters.location !== '' ||
    filters.minRate > 0 ||
    filters.maxRate < 300 ||
    filters.minRating > 0

  return (
    <div className="border-b border-gray-100 bg-white px-4 md:px-8 py-3 flex flex-col gap-3 z-30 relative">
      <div className="flex items-center gap-3">

        {/* Subject/keyword input */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={filters.query}
            onChange={e => update({ query: e.target.value })}
            placeholder="Subject, name…"
            className="w-full h-9 pl-9 pr-4 border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
          />
          {filters.query && (
            <button onClick={() => update({ query: '' })} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Location input */}
        <div className="relative flex-1 max-w-xs">
          <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={filters.location}
            onChange={e => update({ location: e.target.value })}
            placeholder="City or zip code…"
            className="w-full h-9 pl-9 pr-4 border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
          />
          {filters.location && (
            <button onClick={() => update({ location: '' })} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowPanel(p => !p)}
          className={`flex items-center gap-2 px-4 h-9 rounded-lg border text-sm font-bold transition-colors ${
            showPanel || isFiltered
              ? 'border-blue-500 bg-blue-50 text-blue-600'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filters
          {isFiltered && (
            <span className="w-2 h-2 rounded-full bg-blue-600" />
          )}
        </button>

        {/* Reset */}
        {isFiltered && (
          <button
            onClick={reset}
            className="text-sm font-bold text-red-500 hover:text-red-600 transition-colors"
          >
            Reset
          </button>
        )}
      </div>

      {/* Expanded filter panel */}
      {showPanel && (
        <div className="flex flex-wrap gap-6 pt-2 pb-1">

          {/* Price range */}
          <div className="flex flex-col gap-1.5 min-w-[200px]">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Rate / Price: ${filters.minRate} – ${filters.maxRate === 300 ? '300+' : filters.maxRate}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={300}
                step={5}
                value={filters.minRate}
                onChange={e => update({ minRate: Number(e.target.value) })}
                className="flex-1 accent-blue-600"
              />
              <span className="text-xs font-bold text-gray-500 w-8">Max</span>
              <input
                type="range"
                min={0}
                max={300}
                step={5}
                value={filters.maxRate}
                onChange={e => update({ maxRate: Number(e.target.value) })}
                className="flex-1 accent-blue-600"
              />
            </div>
          </div>

          {/* Min rating */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Minimum Rating
            </label>
            <div className="flex items-center gap-2">
              {[0, 3, 4, 4.5].map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => update({ minRating: r })}
                  className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-colors ${
                    filters.minRating === r
                      ? 'border-blue-500 bg-blue-50 text-blue-600'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {r === 0 ? 'Any' : `${r}★`}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
