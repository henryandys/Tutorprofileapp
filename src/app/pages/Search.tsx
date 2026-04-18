// src/app/pages/Search.tsx

import { useState, useEffect, useMemo } from "react";
import { fetchTutors } from "../data/tutors";
import type { Tutor } from "../data/tutors";
import { Navbar } from "../components/Navbar";
import { FilterBar } from "../components/FilterBar";
import type { FilterState } from "../components/FilterBar";
import { TutorCard } from "../components/TutorCard";
import { Map } from "../components/Map";
import { motion, AnimatePresence } from "motion/react";
import { List, Map as MapIcon, X, Loader2 } from "lucide-react";
import { useSearchParams } from "react-router";

export function Search() {
  const [allTutors, setAllTutors]             = useState<Tutor[]>([])
  const [loading, setLoading]                 = useState(true)
  const [selectedTutorId, setSelectedTutorId] = useState<string | undefined>(undefined)
  const [viewMode, setViewMode]               = useState<"map" | "list">("map")
  const [filters, setFilters]                 = useState<FilterState>({
    query: '', minRate: 0, maxRate: 300, minRating: 0
  })

  // Pick up ?q= from navbar search
  const [searchParams] = useSearchParams()
  useEffect(() => {
    const q = searchParams.get('q') ?? ''
    setFilters(f => ({ ...f, query: q }))
  }, [searchParams])

  // Load all tutors once on mount
  useEffect(() => {
    fetchTutors().then(data => {
      setAllTutors(data)
      setLoading(false)
    })
  }, [])

  // Filter in-memory (fast, no extra DB round trips)
  const tutors = useMemo(() => {
    return allTutors.filter(t => {
      const q = filters.query.toLowerCase()
      const matchesQuery = !q ||
        t.name.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.location.toLowerCase().includes(q)

      const matchesRate =
        t.hourlyRate >= filters.minRate &&
        (filters.maxRate >= 300 || t.hourlyRate <= filters.maxRate)

      const matchesRating = t.rating >= filters.minRating

      return matchesQuery && matchesRate && matchesRating
    })
  }, [allTutors, filters])

  const selectedTutor = tutors.find(t => t.id === selectedTutorId)

  return (
    <div className="flex flex-col h-screen bg-white">
      <Navbar />
      <FilterBar onFilter={setFilters} />

      <main className="flex-1 flex overflow-hidden relative">

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        )}

        {/* Tutor Sidebar */}
        <AnimatePresence>
          {selectedTutor && (
            <motion.section
              initial={{ x: -400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -400, opacity: 0 }}
              transition={{ type: "spring", damping: 20, stiffness: 100 }}
              className="absolute lg:relative z-40 h-full w-[90%] sm:w-[400px] lg:w-[450px] bg-white border-r border-gray-200 shadow-2xl lg:shadow-none overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900">Tutor Profile</h2>
                  <button
                    onClick={() => setSelectedTutorId(undefined)}
                    className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <TutorCard tutor={selectedTutor} isSelected={true} />

                <div className="mt-8 pt-8 border-t border-gray-100">
                  <h3 className="font-bold text-gray-900 mb-4">Why choose {selectedTutor.name}?</h3>
                  <p className="text-sm text-gray-600 leading-relaxed mb-6">{selectedTutor.bio}</p>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm font-medium text-gray-700">
                      <div className="w-2 h-2 bg-blue-600 rounded-full" />
                      {selectedTutor.education}
                    </div>
                    <div className="flex items-center gap-3 text-sm font-medium text-gray-700">
                      <div className="w-2 h-2 bg-blue-600 rounded-full" />
                      {selectedTutor.experience}
                    </div>
                  </div>
                </div>

                <div className="mt-8">
                  <button
                    className="w-full h-12 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                    onClick={() => window.location.href = `/tutor/${selectedTutor.id}`}
                  >
                    View Full Profile
                  </button>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* List View */}
        {viewMode === "list" && (
          <section className="absolute inset-0 z-30 bg-gray-50 overflow-y-auto">
            <div className="p-6 max-w-5xl mx-auto">
              <div className="flex items-center justify-between mb-8">
                <h1 className="text-2xl font-bold text-gray-900">
                  {tutors.length} Tutor{tutors.length !== 1 ? 's' : ''} Found
                </h1>
                <button
                  onClick={() => setViewMode("map")}
                  className="px-4 py-2 bg-white border border-gray-200 rounded-lg font-bold text-sm shadow-sm hover:bg-gray-50"
                >
                  Back to Map
                </button>
              </div>
              {tutors.length === 0 ? (
                <div className="text-center py-20 text-gray-400 font-medium">
                  No tutors match your filters. Try adjusting your search.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {tutors.map(tutor => (
                    <TutorCard
                      key={tutor.id}
                      tutor={tutor}
                      onClick={() => {
                        setSelectedTutorId(tutor.id)
                        setViewMode("map")
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Map */}
        <section className="flex-1 h-full relative z-10">
          <Map
            tutors={tutors}
            selectedId={selectedTutorId}
            onSelect={(id) => setSelectedTutorId(id)}
          />

          {/* View Toggles */}
          <div className="absolute top-6 left-6 z-20 flex bg-white rounded-xl shadow-xl border border-gray-100 p-1">
            <button
              onClick={() => setViewMode("map")}
              className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${
                viewMode === "map" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <MapIcon className="w-4 h-4" />
              Map
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${
                viewMode === "list" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <List className="w-4 h-4" />
              List ({tutors.length})
            </button>
          </div>

          {/* No results overlay on map */}
          {!loading && tutors.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
              <div className="bg-white rounded-2xl shadow-xl px-8 py-6 text-center border border-gray-100">
                <p className="text-lg font-bold text-gray-900 mb-1">No tutors found</p>
                <p className="text-sm text-gray-500">Try adjusting your filters</p>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

