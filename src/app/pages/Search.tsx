import { useState, useEffect, useRef, useMemo } from "react";
import { fetchTutors, geocodeTutors } from "../data/tutors";
import type { Tutor } from "../data/tutors";
import { Navbar } from "../components/Navbar";
import { FilterBar } from "../components/FilterBar";
import type { FilterState } from "../components/FilterBar";
import { TutorCard } from "../components/TutorCard";
import { Map } from "../components/Map";
import { motion, AnimatePresence } from "motion/react";
import { X, Loader2, List, Map as MapIcon, Star, MapPin, ChevronRight } from "lucide-react";
import { useSearchParams, useNavigate } from "react-router";
import { useAuth } from "../../context/AuthContext";

export function Search() {
  const { profile } = useAuth()
  const navigate = useNavigate()
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

  // Geocode location field → fly map there (debounced).
  // When cleared, fall back to the user's geocoded home coords (if available).
  const cachedHome = (() => { try { const s = sessionStorage.getItem('userHomeCoords'); return s ? JSON.parse(s) as [number, number] : undefined } catch { return undefined } })()
  const [flyTo, setFlyTo]   = useState<[number, number] | undefined>(cachedHome)
  const homeCoords          = useRef<[number, number] | undefined>(cachedHome)
  const locationDebounce    = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (locationDebounce.current) clearTimeout(locationDebounce.current)
    const loc = filters.location.trim()
    if (!loc) { setFlyTo(homeCoords.current); return }
    locationDebounce.current = setTimeout(async () => {
      try {
        const res  = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(loc)}&format=json&limit=1&countrycodes=us`)
        const data = await res.json()
        if (data.length > 0) setFlyTo([parseFloat(data[0].lat), parseFloat(data[0].lon)])
      } catch { /* ignore */ }
    }, 600)
  }, [filters.location])

  // Geocode the user's profile location once it loads; use it as the default map center.
  useEffect(() => {
    if (!profile?.location) return
    if (searchParams.get('location') || filters.location) return
    // If we already have a cached value for this session, skip the fetch
    if (homeCoords.current) return
    fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(profile.location)}&format=json&limit=1&countrycodes=us`)
      .then(r => r.json())
      .then(data => {
        if (data.length > 0) {
          const coords: [number, number] = [parseFloat(data[0].lat), parseFloat(data[0].lon)]
          homeCoords.current = coords
          try { sessionStorage.setItem('userHomeCoords', JSON.stringify(coords)) } catch { /* ignore */ }
          setFlyTo(coords)
        }
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.location])

  const tutors = useMemo(() => {
    return allTutors.filter(t => {
      const q = filters.query.toLowerCase()
      const effectiveLocation = (t.tutoringLocation || t.location).toLowerCase()
      const matchesQuery = !q ||
        t.name.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        effectiveLocation.includes(q)
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

          <div className="flex-1 overflow-y-auto p-3 pb-24 md:pb-3 space-y-3">
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
          flex-1 relative isolate
          ${mobileView === "list" ? "hidden md:block" : "block"}
        `}>
          <Map
            tutors={tutors}
            selectedId={selectedTutorId}
            onSelect={id => setSelectedTutorId(id)}
            flyTo={flyTo}
            initialCenter={homeCoords.current}
          />

          {/* Pin popup — compact summary, click anywhere to open full profile */}
          <AnimatePresence>
            {selectedTutor && (
              <motion.div
                key={selectedTutor.id}
                initial={{ y: 16, opacity: 0, scale: 0.97 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 16, opacity: 0, scale: 0.97 }}
                transition={{ type: "spring", damping: 28, stiffness: 260 }}
                className="absolute bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-[900] w-[300px]"
              >
                <div
                  onClick={() => navigate(`/tutor/${selectedTutor.id}`)}
                  className="cursor-pointer bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden hover:shadow-[0_8px_32px_rgba(37,99,235,0.18)] hover:border-blue-200 transition-all group"
                >
                  {/* Avatar + core info */}
                  <div className="flex items-center gap-3 p-4">
                    <img
                      src={selectedTutor.imageUrl || '/placeholder-avatar.png'}
                      alt={selectedTutor.name}
                      className="w-14 h-14 rounded-xl object-cover shrink-0 bg-gray-100"
                      onError={e => { (e.target as HTMLImageElement).src = '/placeholder-avatar.png' }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-black text-gray-900 truncate">{selectedTutor.name}</p>
                      <p className="text-sm text-gray-500 font-medium truncate">{selectedTutor.subject}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="flex items-center gap-0.5 text-xs font-bold text-blue-600">
                          <Star className="w-3 h-3 fill-blue-600" />{selectedTutor.rating}
                        </span>
                        <span className="text-xs text-gray-400">·</span>
                        <span className="text-xs font-bold text-gray-700">${selectedTutor.hourlyRate}/hr</span>
                      </div>
                    </div>
                  </div>

                  {/* Location + CTA strip */}
                  <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-t border-gray-100">
                    <div className="flex items-center gap-1 text-xs text-gray-500 font-medium min-w-0">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="truncate">{selectedTutor.location}</span>
                    </div>
                    <span className="flex items-center gap-0.5 text-xs font-bold text-blue-600 shrink-0 group-hover:gap-1.5 transition-all">
                      View profile <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>

                {/* Dismiss button */}
                <button
                  onClick={e => { e.stopPropagation(); setSelectedTutorId(undefined) }}
                  className="absolute -top-2.5 -right-2.5 w-6 h-6 bg-white rounded-full shadow-md border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Mobile toggle — fixed so it always floats above Leaflet's z-index stack */}
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 md:hidden flex bg-white rounded-full shadow-xl border border-gray-100 p-1">
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
