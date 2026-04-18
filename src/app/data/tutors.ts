// src/app/data/tutors.ts
// ─────────────────────────────────────────────────────────────
// All tutor data now comes from Supabase via the tutors_view.
// The Tutor interface is kept identical to before so TutorCard,
// Map, and other components need zero changes.
// ─────────────────────────────────────────────────────────────

import { supabase } from '../../lib/supabase'

export interface Tutor {
  id:          string
  name:        string
  subject:     string      // mapped from subjects[0]
  rating:      number
  reviewCount: number
  hourlyRate:  number
  location:    string
  bio:         string
  imageUrl:    string      // mapped from avatar_url
  education:   string
  experience:  string      // mapped from experience_yrs
  coordinates: { x: number; y: number }  // mapped from latitude/longitude
}

// ── Internal helper: map a tutors_view row → Tutor ───────────

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
    location:    row.location ?? '',
    bio:         row.bio ?? '',
    imageUrl:    row.avatar_url ?? '',
    education:   row.education ?? '',
    experience:  row.experience_yrs != null
                   ? `${row.experience_yrs} year${row.experience_yrs === 1 ? '' : 's'} experience`
                   : '',
    // Convert real lat/lng to percentage coordinates for the map overlay.
    // Seattle bounding box: lat 47.48–47.74, lng -122.44 – -122.24
    coordinates: {
      x: row.longitude != null
           ? Math.round(((row.longitude - (-122.44)) / 0.20) * 100)
           : 50,
      y: row.latitude != null
           ? Math.round(((47.74 - row.latitude) / 0.26) * 100)
           : 50,
    },
  }
}

// ── Fetch all tutors ─────────────────────────────────────────

export async function fetchTutors(): Promise<Tutor[]> {
  const { data, error } = await supabase
    .from('tutors_view')
    .select('*')
    .eq('is_available', true)
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
    .eq('is_available', true)
    .order('rating', { ascending: false })

  if (error) {
    console.error('searchTutors error:', error.message)
    return []
  }

  return (data ?? []).map(rowToTutor)
}
