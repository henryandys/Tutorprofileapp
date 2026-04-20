import { useState, useEffect, useRef, useMemo } from "react";
import { fetchTutors, geocodeTutors } from "../data/tutors";
import type { Tutor } from "../data/tutors";
import { Navbar } from "../components/Navbar";
import { FilterBar } from "../components/FilterBar";
import type { FilterState } from "../components/FilterBar";
import { TutorCard } from "../components/TutorCard";
import { Map } from "../components/Map";
import { motion, AnimatePresence } from "motion/react";
import { X, Loader2, List, Map as MapIcon } from "lucide-react";
import { useSearchParams } from "react-router";

export function Search() {
  const [allTutors, setAllTutors]             = useState<Tutor[]>([])
  const [loading, setLoading]                 = useState(true)
  const [selectedTutorId, setSelectedTutorId] = useState<string | undefined>(undefined)
  const [mobileView, setMobileView]           = useState<"list" | "map">("map")
  const [filters, setFilters]                 = useState<FilterState>({
    query: '', location: '', minRate: 0, maxRate: 300, minRating: 0
  })

  // Pick up ?q= and ?location= from home/navbar search
  const [searchParams] = useSearchParams()
  useEffect(() => {
    const q   = searchParams.get('q') ?? ''
    const loc = searchParams.get('location') ?? ''
    setFilters(f => ({ ...f, query: q, location: loc }))
  }, [searchParams])

  // Load tutors immediately, geocode coords in the background
  useEffect(() => {
    fetchTutors().then(data => {
      console.log('[TutorFind] loaded', data.length, 'tutors')
      setAllTutors(data)
      setLoading(false)
      geocodeTutors(data, updated => setAllTutors(updated))
    }).catch(err => {
      console.error('[TutorFind] fetchTutors error:', err)
      setLoading(false)
    })
  }, [])

  // Geocode location field → fly map there (debounced)
  const [flyTo, setFlyTo]           = useState<[number, number] | undefined>(undefined)
  const locationDebounce            = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (locationDebounce.current) clearTimeout(locationDebounce.current)
    const loc = filters.location.trim()
    if (!loc) { setFlyTo(undefined); return }
    locationDebounce.current = setTimeout(async () => {
      try {
        const res  = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(loc)}&format=json&limit=1&countrycodes=us`)
        const data = await res.json()
        if (data.length > 0) setFlyTo([parseFloat(data[0].lat), parseFloat(data[0].lon)])
      } catch { /* ignore */ }
    }, 600)
  }, [filters.location])

  const tutors = useMemo(() => {
    return allTutors.filter(t => {
      const q = filters.query.toLowerCase()
      const matchesQuery = !q ||
        t.name.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.location.toLowerCase().includes(q)
      const matchesRate   = t.hourlyRate >= filters.minRate && (filters.maxRate >= 300 || t.hourlyRate <= filters.maxRate)
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

        {/* ── Left panel: tutor list (always visible on desktop) ── */}
        <section className={`
          flex-shrink-0 w-full md:w-[380px] lg:w-[420px]
          bg-white border-r border-gray-100 flex flex-col overflow-hidden
          ${mobileView === "map" ? "hidden md:flex" : "flex"}
        `}>
          <div className="px-4 pt-4 pb-2 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-bold text-gray-500">
              {tutors.length} tutor{tutors.length !== 1 ? "s" : ""} found
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {tutors.length === 0 && !loading ? (
              <div className="text-center py-20 text-gray-400 font-medium text-sm">
                No tutors match your filters.
              </div>
            ) : (
              tutors.map(tutor => (
                <div
                  key={tutor.id}
                  onClick={() => { setSelectedTutorId(tutor.id); setMobileView("map") }}
                  className={`cursor-pointer rounded-xl border transition-all ${
                    selectedTutorId === tutor.id
                      ? "border-blue-400 ring-2 ring-blue-100"
                      : "border-gray-100 hover:border-gray-300"
                  }`}
                >
                  <TutorCard tutor={tutor} isSelected={selectedTutorId === tutor.id} />
                </div>
              ))
            )}
          </div>
        </section>

        {/* ── Right panel: map ── */}
        <section className={`
          flex-1 relative
          ${mobileView === "list" ? "hidden md:block" : "block"}
        `}>
          <Map
            tutors={tutors}
            selectedId={selectedTutorId}
            onSelect={id => setSelectedTutorId(id)}
            flyTo={flyTo}
          />

          {/* Selected tutor detail card — floats over map */}
          <AnimatePresence>
            {selectedTutor && (
              <motion.div
                key={selectedTutor.id}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[340px] bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 z-20"
              >
                <button
                  onClick={() => setSelectedTutorId(undefined)}
                  className="absolute top-3 right-3 p-1 hover:bg-gray-100 rounded-full text-gray-400"
                >
                  <X className="w-4 h-4" />
                </button>
                <TutorCard tutor={selectedTutor} isSelected />
                <button
                  className="mt-3 w-full h-10 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all"
                  onClick={() => window.location.href = `/tutor/${selectedTutor.id}`}
                >
                  View Full Profile
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Mobile toggle — visible only on small screens */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 md:hidden flex bg-white rounded-full shadow-xl border border-gray-100 p-1">
          <button
            onClick={() => setMobileView("map")}
            className={`px-5 py-2 rounded-full text-sm font-bold flex items-center gap-2 transition-all ${
              mobileView === "map" ? "bg-blue-600 text-white" : "text-gray-600"
            }`}
          >
            <MapIcon className="w-4 h-4" /> Map
          </button>
          <button
            onClick={() => setMobileView("list")}
            className={`px-5 py-2 rounded-full text-sm font-bold flex items-center gap-2 transition-all ${
              mobileView === "list" ? "bg-blue-600 text-white" : "text-gray-600"
            }`}
          >
            <List className="w-4 h-4" /> List ({tutors.length})
          </button>
        </div>
      </main>
    </div>
  )
}
