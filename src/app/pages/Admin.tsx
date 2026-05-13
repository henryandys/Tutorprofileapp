// src/app/pages/Admin.tsx
//
// ── REQUIRED SUPABASE MIGRATIONS ─────────────────────────────────────────────
//
// Run these once in the Supabase SQL editor:
//
//   ALTER TABLE tutor_profiles
//     ADD COLUMN IF NOT EXISTS is_verified              boolean DEFAULT false,
//     ADD COLUMN IF NOT EXISTS verification_requested   boolean DEFAULT false,
//     ADD COLUMN IF NOT EXISTS verification_document_url text;
//
//   ALTER TABLE profiles
//     ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;
//
//   -- Grant yourself admin access (replace with your email):
//   UPDATE profiles SET is_admin = true WHERE email = 'henry.andy.s@gmail.com';
//
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react"
import { Link } from "react-router"
import { Navbar } from "../components/Navbar"
import { useAuth } from "../../context/AuthContext"
import { supabase } from "../../lib/supabase"
import { ShieldCheck, BadgeCheck, Clock, ExternalLink, FileText } from "lucide-react"
import { toast } from "sonner"

interface TutorRow {
  id:                          string
  full_name:                   string
  email:                       string
  avatar_url:                  string | null
  is_verified:                 boolean
  verification_requested:      boolean
  verification_document_url:   string | null
}

export function Admin() {
  const { profile } = useAuth()
  const [tutors, setTutors] = useState<TutorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')

  useEffect(() => {
    if (!profile?.is_admin) { setLoading(false); return }
    supabase
      .from('tutor_profiles')
      .select('id, is_verified, verification_requested, verification_document_url, profiles(full_name, email, avatar_url)')
      .then(({ data, error }) => {
        if (error) { toast.error('Failed to load instructor list'); setLoading(false); return }
        setTutors(
          (data ?? []).map((row: any) => ({
            id:                        row.id,
            full_name:                 row.profiles?.full_name ?? 'Unknown',
            email:                     row.profiles?.email     ?? '',
            avatar_url:                row.profiles?.avatar_url ?? null,
            is_verified:               row.is_verified                ?? false,
            verification_requested:    row.verification_requested     ?? false,
            verification_document_url: row.verification_document_url  ?? null,
          }))
        )
        setLoading(false)
      })
  }, [profile])

  async function toggleVerified(tutorId: string, value: boolean) {
    const { error } = await supabase
      .from('tutor_profiles')
      .update({ is_verified: value })
      .eq('id', tutorId)
    if (error) { toast.error('Update failed'); return }
    setTutors(prev => prev.map(t => t.id === tutorId ? { ...t, is_verified: value } : t))
    toast.success(value ? 'Instructor verified!' : 'Verification removed')
  }

  if (!profile?.is_admin) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <p className="text-gray-500 font-bold text-lg">Access denied.</p>
        </div>
      </div>
    )
  }

  const displayed = filter === 'pending'
    ? tutors.filter(t => t.verification_requested && !t.is_verified)
    : tutors

  const pendingCount = tutors.filter(t => t.verification_requested && !t.is_verified).length

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-10">

        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-7 h-7 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Admin — Instructor Verification</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilter('pending')}
              className={`px-4 py-1.5 rounded-full text-sm font-bold transition-colors ${
                filter === 'pending' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'
              }`}
            >
              Pending Review
              {pendingCount > 0 && (
                <span className="ml-2 px-1.5 py-0.5 bg-yellow-400 text-yellow-900 rounded-full text-xs font-black">{pendingCount}</span>
              )}
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-1.5 rounded-full text-sm font-bold transition-colors ${
                filter === 'all' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'
              }`}
            >
              All Instructors ({tutors.length})
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-gray-400 font-medium">Loading…</p>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <BadgeCheck className="w-12 h-12 text-gray-300" />
            <p className="text-gray-400 font-bold text-lg">
              {filter === 'pending' ? 'No pending verification requests.' : 'No instructors yet.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {displayed.map(t => (
              <div
                key={t.id}
                className={`flex items-center gap-4 p-5 bg-white rounded-2xl border shadow-sm transition-shadow hover:shadow-md ${
                  t.verification_requested && !t.is_verified ? 'border-yellow-200' : 'border-gray-100'
                }`}
              >
                {/* Avatar */}
                {t.avatar_url ? (
                  <img src={t.avatar_url} alt={t.full_name} className="w-12 h-12 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center shrink-0">
                    <span className="text-white font-black text-lg">{t.full_name.charAt(0).toUpperCase()}</span>
                  </div>
                )}

                {/* Name + status */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      to={`/tutor/${t.id}`}
                      className="font-bold text-gray-900 hover:text-blue-600 transition-colors"
                    >
                      {t.full_name}
                    </Link>
                    {t.is_verified && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                        <BadgeCheck className="w-3 h-3" /> Verified
                      </span>
                    )}
                    {t.verification_requested && !t.is_verified && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700">
                        <Clock className="w-3 h-3" /> Pending Review
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 truncate">{t.email}</p>
                </div>

                {/* Document link + verify checkbox */}
                <div className="flex items-center gap-5 shrink-0">
                  {t.verification_document_url ? (
                    <a
                      href={t.verification_document_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:underline"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      View Doc
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <span className="text-xs text-gray-300 font-medium">No document</span>
                  )}

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={t.is_verified}
                      onChange={e => toggleVerified(t.id, e.target.checked)}
                      className="w-4 h-4 accent-blue-600 cursor-pointer"
                    />
                    <span className="text-sm font-bold text-gray-700">Verified</span>
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
