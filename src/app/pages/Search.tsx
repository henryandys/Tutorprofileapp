import { useState, useEffect, useRef, useMemo } from "react";
import { fetchTutors, geocodeTutors } from "../data/tutors";
import type { Tutor } from "../data/tutors";
import { Navbar } from "../components/Navbar";
import { FilterBar } from "../components/FilterBar";
import type { FilterState } from "../components/FilterBar";
import { TutorCard } from "../components/TutorCard";
import { Map } from "../components/Map";
import type { GroupLessonPin } from "../components/Map";
import { motion, AnimatePresence } from "motion/react";
import { X, Loader2, List, Map as MapIcon, Star, MapPin, ChevronRight, Users, Clock, Calendar } from "lucide-react";
import { useSearchParams, useNavigate } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";

export function Search() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [allTutors, setAllTutors]             = useState<Tutor[]>([])
  const [loading, setLoading]                 = useState(true)
  const [selectedTutorId, setSelectedTutorId]   = useState<string | undefined>(undefined)
  const [groupLessons, setGroupLessons]         = useState<GroupLessonPin[]>([])
  const [selectedGroupId, setSelectedGroupId]   = useState<string | undefined>(undefined)
  const [mapMode, setMapMode]                   = useState<'all' | 'tutors' | 'groups'>('all')
  const [mobileView, setMobileView]             = useState<"list" | "map">("map")
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

  // Fetch open upcoming group lessons with tutor coordinates
  useEffect(() => {
    async function loadGroupLessons() {
      const { data: glData } = await supabase
        .from('group_lessons')
        .select('id, title, subject, scheduled_at, price, max_students, tutor_id, group_lesson_enrollments(count)')
        .eq('status', 'open')
        .gte('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true })
      if (!glData || glData.length === 0) return

      const tutorIds = [...new Set(glData.map((g: any) => g.tutor_id as string))]
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, latitude, longitude')
        .in('id', tutorIds)

      const profileMap: Record<string, { full_name: string; lat: number | null; lng: number | null }> = {}
      for (const p of profiles ?? []) {
        profileMap[p.id] = { full_name: p.full_name, lat: p.latitude ?? null, lng: p.longitude ?? null }
      }

      setGroupLessons(glData.map((g: any) => ({
        id:               g.id,
        title:            g.title,
        subject:          g.subject,
        scheduled_at:     g.scheduled_at,
        price:            g.price,
        max_students:     g.max_students,
        enrollment_count: g.group_lesson_enrollments?.[0]?.count ?? 0,
        tutor_id:         g.tutor_id,
        tutor_name:       profileMap[g.tutor_id]?.full_name ?? 'Tutor',
        lat:              profileMap[g.tutor_id]?.lat ?? null,
        lng:              profileMap[g.tutor_id]?.lng ?? null,
      })))
    }
    loadGroupLessons()
  }, [])

  // Whenever allTutors gets geocoded coordinates, push them into groupLessons too.
  // The profiles table stores null lat/lng until geocoded client-side, so we sync
  // from the already-resolved allTutors instead of relying on the DB columns.
  useEffect(() => {
    if (allTutors.length === 0) return
    setGroupLessons(prev => {
      if (prev.length === 0) return prev
      const next = prev.map(gl => {
        if (gl.lat !== null && gl.lng !== null) return gl
        const tutor = allTutors.find(t => t.id === gl.tutor_id)
        return tutor?.lat != null ? { ...gl, lat: tutor.lat, lng: tutor.lng } : gl
      })
      return next.every((g, i) => g === prev[i]) ? prev : next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allTutors])

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

        {/* ── Left panel: tutor + group session list ── */}
        <section className={`
          flex-shrink-0 w-full md:w-[380px] lg:w-[420px]
          bg-white border-r border-gray-100 flex flex-col overflow-hidden
          ${mobileView === "map" ? "hidden md:flex" : "flex"}
        `}>
          <div className="px-4 pt-4 pb-2 border-b border-gray-100">
            <span className="text-sm font-bold text-gray-500">
              {mapMode === 'groups'
                ? `${groupLessons.length} group session${groupLessons.length !== 1 ? 's' : ''}`
                : mapMode === 'tutors'
                  ? `${tutors.length} tutor${tutors.length !== 1 ? 's' : ''}`
                  : `${tutors.length} tutor${tutors.length !== 1 ? 's' : ''} · ${groupLessons.length} group session${groupLessons.length !== 1 ? 's' : ''}`}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 pb-24 md:pb-3 space-y-3">
            {/* Group sessions — shown in 'all' and 'groups' mode */}
            {mapMode !== 'tutors' && groupLessons.map(gl => {
              const spotsLeft = gl.max_students - gl.enrollment_count
              const isSelected = selectedGroupId === gl.id
              return (
                <div
                  key={gl.id}
                  onClick={() => { setSelectedGroupId(gl.id); setSelectedTutorId(undefined); setMobileView("map") }}
                  className={`cursor-pointer rounded-xl border transition-all p-4 ${
                    isSelected
                      ? "border-purple-400 ring-2 ring-purple-100 bg-purple-50"
                      : "border-gray-100 hover:border-purple-200 bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-black text-gray-900 leading-snug">{gl.title}</p>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700 shrink-0">Group</span>
                  </div>
                  <p className="text-sm font-bold text-purple-600 mb-1">{gl.subject}</p>
                  <p className="text-xs text-gray-500 font-medium flex items-center gap-1 mb-2">
                    <Users className="w-3 h-3 shrink-0" /> {gl.tutor_name}
                  </p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
                      <Calendar className="w-3 h-3 shrink-0" />
                      {new Date(gl.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {' · '}
                      {new Date(gl.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </span>
                    <span className={`text-xs font-bold ${spotsLeft > 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {spotsLeft > 0 ? `${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''} left` : 'Full'}
                    </span>
                    {gl.price > 0 && (
                      <span className="text-xs font-bold text-gray-700">${gl.price}/student</span>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Tutor cards — shown in 'all' and 'tutors' mode */}
            {mapMode !== 'groups' && (tutors.length === 0 && !loading ? (
              <div className="text-center py-20 text-gray-400 font-medium text-sm">
                No tutors match your filters.
              </div>
            ) : (
              tutors.map(tutor => (
                <div
                  key={tutor.id}
                  onClick={() => { setSelectedTutorId(tutor.id); setSelectedGroupId(undefined); setMobileView("map") }}
                  className={`cursor-pointer rounded-xl border transition-all ${
                    selectedTutorId === tutor.id
                      ? "border-blue-400 ring-2 ring-blue-100"
                      : "border-gray-100 hover:border-gray-300"
                  }`}
                >
                  <TutorCard tutor={tutor} isSelected={selectedTutorId === tutor.id} />
                </div>
              ))
            ))}

            {/* Empty state for groups-only mode */}
            {mapMode === 'groups' && groupLessons.length === 0 && !loading && (
              <div className="text-center py-20 text-gray-400 font-medium text-sm">
                No group sessions available.
              </div>
            )}
          </div>
        </section>

        {/* ── Right panel: map ── */}
        <section className={`
          flex-1 relative isolate
          ${mobileView === "list" ? "hidden md:block" : "block"}
        `}>
          <Map
            tutors={mapMode === 'groups' ? [] : tutors}
            selectedId={selectedTutorId}
            onSelect={id => { setSelectedTutorId(id); setSelectedGroupId(undefined) }}
            flyTo={flyTo}
            initialCenter={homeCoords.current}
            groupLessons={mapMode === 'tutors' ? [] : groupLessons}
            selectedGroupId={selectedGroupId}
            onSelectGroup={id => { setSelectedGroupId(id); setSelectedTutorId(undefined) }}
          />

          {/* Map mode switcher */}
          <div className="absolute top-3 right-3 z-[900] flex bg-white rounded-full shadow-md border border-gray-200 p-0.5">
            {([
              { key: 'all',    label: 'All' },
              { key: 'tutors', label: 'Tutors' },
              { key: 'groups', label: `Groups${groupLessons.length > 0 ? ` (${groupLessons.length})` : ''}` },
            ] as const).map(opt => (
              <button
                key={opt.key}
                onClick={() => {
                  setMapMode(opt.key)
                  if (opt.key === 'groups') setSelectedTutorId(undefined)
                  if (opt.key === 'tutors') setSelectedGroupId(undefined)
                }}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                  mapMode === opt.key
                    ? opt.key === 'groups'
                      ? 'bg-purple-600 text-white'
                      : 'bg-blue-600 text-white'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

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

          {/* Group lesson popup */}
          <AnimatePresence>
            {(() => {
              const gl = groupLessons.find(g => g.id === selectedGroupId)
              if (!gl) return null
              const spotsLeft = gl.max_students - gl.enrollment_count
              return (
                <motion.div
                  key={gl.id}
                  initial={{ y: 16, opacity: 0, scale: 0.97 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  exit={{ y: 16, opacity: 0, scale: 0.97 }}
                  transition={{ type: "spring", damping: 28, stiffness: 260 }}
                  className="absolute bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-[900] w-[320px]"
                >
                  <div
                    onClick={() => navigate(`/tutor/${gl.tutor_id}`)}
                    className="cursor-pointer bg-white rounded-2xl shadow-2xl border border-purple-100 overflow-hidden hover:shadow-[0_8px_32px_rgba(124,58,237,0.18)] hover:border-purple-300 transition-all group"
                  >
                    {/* Header */}
                    <div className="px-4 pt-4 pb-3">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="font-black text-gray-900 leading-snug">{gl.title}</p>
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700 shrink-0">Group</span>
                      </div>
                      <p className="text-sm font-bold text-purple-600">{gl.subject}</p>
                      <p className="text-xs text-gray-500 font-medium mt-0.5 flex items-center gap-1">
                        <Users className="w-3 h-3 shrink-0" /> {gl.tutor_name}
                      </p>
                    </div>

                    {/* Details strip */}
                    <div className="px-4 py-2.5 bg-purple-50 border-t border-purple-100 flex items-center justify-between gap-2 flex-wrap">
                      <span className="flex items-center gap-1 text-xs text-purple-700 font-medium">
                        <Calendar className="w-3 h-3 shrink-0" />
                        {new Date(gl.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {' · '}
                        {new Date(gl.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-purple-700 font-medium">
                        <Clock className="w-3 h-3 shrink-0" />
                        {spotsLeft > 0 ? `${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''} left` : 'Full'}
                        {gl.price > 0 && <> · <span className="font-bold">${gl.price}/student</span></>}
                      </span>
                    </div>

                    {/* CTA */}
                    <div className="flex items-center justify-end px-4 py-2.5 border-t border-purple-50">
                      <span className="flex items-center gap-0.5 text-xs font-bold text-purple-600 group-hover:gap-1.5 transition-all">
                        View tutor <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={e => { e.stopPropagation(); setSelectedGroupId(undefined) }}
                    className="absolute -top-2.5 -right-2.5 w-6 h-6 bg-white rounded-full shadow-md border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </motion.div>
              )
            })()}
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
