import { supabase } from '../../lib/supabase'

export interface Tutor {
  id:               string
  name:             string
  subject:          string
  rating:           number
  reviewCount:      number
  hourlyRate:       number
  location:         string
  tutoringLocation: string
  bio:              string
  imageUrl:         string
  education:        string
  experience:       string
  coordinates:      { x: number; y: number }
  lat:              number | null
  lng:              number | null
}

// ── Geocoding ────────────────────────────────────────────────

const geocodeCache = new globalThis.Map<string, { lat: number; lng: number } | null>()

async function geocodeLocation(location: string): Promise<{ lat: number; lng: number } | null> {
  if (!location.trim()) return null
  if (geocodeCache.has(location)) return geocodeCache.get(location)!

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1&countrycodes=us`,
      { signal: controller.signal }
    )
    clearTimeout(timer)
    const data = await res.json()
    const result = data.length > 0
      ? { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
      : null
    geocodeCache.set(location, result)
    return result
  } catch {
    geocodeCache.set(location, null)
    return null
  }
}

// Geocodes tutors that lack coordinates, calling onUpdate after each one resolves.
// Run this in the background after the initial render so it never blocks the UI.
export async function geocodeTutors(
  tutors: Tutor[],
  onUpdate: (updated: Tutor[]) => void
): Promise<void> {
  // Always re-geocode tutors with a tutoring address (uses cache, so no extra network hits).
  // For tutors without one, only geocode if lat/lng is missing.
  const needsGeocode = tutors.filter(t =>
    t.tutoringLocation ? true : (t.lat == null && !!t.location)
  )
  if (needsGeocode.length === 0) return

  for (let i = 0; i < needsGeocode.length; i++) {
    const tutor  = needsGeocode[i]
    const coords = await geocodeLocation(tutor.tutoringLocation || tutor.location)
    if (coords) {
      tutor.lat = coords.lat
      tutor.lng = coords.lng
      onUpdate([...tutors])   // spread so React sees a new array reference
    }
    if (i < needsGeocode.length - 1) await new Promise(r => setTimeout(r, 300))
  }
}

// ── Internal helper ──────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToTutor(row: any): Tutor {
  return {
    id:          row.id,
    name:        row.full_name ?? 'Unknown',
    subject:     Array.isArray(row.subjects) && row.subjects.length > 0
                   ? row.subjects.join(' & ')
                   : 'General Tutoring',
    rating:      row.rating ?? 0,
    reviewCount: row.review_count ?? 0,
    hourlyRate:  row.hourly_rate ?? 0,
    location:         row.location ?? '',
    tutoringLocation: row.tutoring_location ?? '',
    bio:              row.bio ?? '',
    imageUrl:    row.avatar_url ?? '',
    education:   row.education ?? '',
    experience:  row.experience_yrs != null
                   ? `${row.experience_yrs} year${row.experience_yrs === 1 ? '' : 's'} experience`
                   : '',
    coordinates: {
      x: row.longitude != null ? Math.round(((row.longitude - (-122.44)) / 0.20) * 100) : 50,
      y: row.latitude  != null ? Math.round(((47.74 - row.latitude)      / 0.26) * 100) : 50,
    },
    lat: row.latitude  ?? null,
    lng: row.longitude ?? null,
  }
}

// ── Fetch all tutors (returns immediately, no geocoding) ─────

export async function fetchTutors(): Promise<Tutor[]> {
  const { data, error } = await supabase
    .from('tutors_view')
    .select('*')
    .order('rating', { ascending: false })

  if (error) {
    console.error('fetchTutors error:', error.message)
    return []
  }

  return (data ?? []).map(rowToTutor)
}

// ── Fetch a single tutor by id ───────────────────────────────

export async function fetchTutorById(id: string): Promise<Tutor | null> {
  const { data, error } = await supabase
    .from('tutors_view')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('fetchTutorById error:', error.message)
    return null
  }

  return rowToTutor(data)
}

// ── Search tutors by subject or name ────────────────────────

export async function searchTutors(query: string): Promise<Tutor[]> {
  if (!query.trim()) return fetchTutors()

  const { data, error } = await supabase
    .from('tutors_view')
    .select('*')
    .or(`full_name.ilike.%${query}%,subjects.cs.{${query}}`)
    .order('rating', { ascending: false })

  if (error) {
    console.error('searchTutors error:', error.message)
    return []
  }

  return (data ?? []).map(rowToTutor)
}
