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
//   UPDATE profiles SET is_admin = true
//     WHERE id = (SELECT id FROM auth.users WHERE email = 'henry.andy.s@gmail.com');
//
//   -- Allow admins to read and update all tutor_profiles rows (bypasses RLS):
//   CREATE POLICY "admins_read_tutor_profiles" ON tutor_profiles
//     FOR SELECT TO authenticated
//     USING (EXISTS (
//       SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true
//     ));
//
//   CREATE POLICY "admins_update_tutor_profiles" ON tutor_profiles
//     FOR UPDATE TO authenticated
//     USING (EXISTS (
//       SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true
//     ));
//
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react"
import { Link } from "react-router"
import { Navbar } from "../components/Navbar"
import { useAuth } from "../../context/AuthContext"
import { supabase } from "../../lib/supabase"
import { ShieldCheck, BadgeCheck, Clock, ExternalLink, FileText, Search, X, AlertTriangle } from "lucide-react"
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
  const { user } = useAuth()
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [tutors, setTutors] = useState<TutorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'pending' | 'all'>('all')
  const [search, setSearch] = useState('')
  const [rlsWarning, setRlsWarning] = useState(false)

  // Query is_admin directly — don't rely on the cached AuthContext profile
  useEffect(() => {
    if (!user) { setIsAdmin(false); setLoading(false); return }
    supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()
      .then(({ data }) => setIsAdmin(data?.is_admin ?? false))
  }, [user])

  useEffect(() => {
    if (isAdmin === null) return
    if (!isAdmin) { setLoading(false); return }

    Promise.all([
      supabase.from('tutors_view').select('id, full_name, avatar_url'),
      supabase.from('tutor_profiles').select('id, is_verified, verification_requested, verification_document_url'),
    ]).then(([viewRes, tpRes]) => {
      console.log('tutors_view:', viewRes.data?.length, viewRes.error)
      console.log('tutor_profiles:', tpRes.data?.length, tpRes.error)

      if (viewRes.error) {
        toast.error('Failed to load instructor list: ' + viewRes.error.message)
        setLoading(false)
        return
      }

      if (tpRes.error) {
        console.error('tutor_profiles error:', tpRes.error)
        setRlsWarning(true)
      } else if ((viewRes.data ?? []).length > 0 && (tpRes.data ?? []).length === 0) {
        setRlsWarning(true)
      }

      const tpMap: Record<string, any> = {}
      for (const row of tpRes.data ?? []) tpMap[row.id] = row

      setTutors(
        (viewRes.data ?? []).map((row: any) => ({
          id:                        row.id,
          full_name:                 row.full_name  ?? 'Unknown',
          email:                     '',
          avatar_url:                row.avatar_url ?? null,
          is_verified:               tpMap[row.id]?.is_verified               ?? false,
          verification_requested:    tpMap[row.id]?.verification_requested     ?? false,
          verification_document_url: tpMap[row.id]?.verification_document_url ?? null,
        }))
      )
      setLoading(false)
    })
  }, [isAdmin])

  async function toggleVerified(tutorId: string, value: boolean) {
    const { error } = await supabase
      .from('tutor_profiles')
      .update({ is_verified: value })
      .eq('id', tutorId)
    if (error) { toast.error('Update failed'); return }
    setTutors(prev => prev.map(t => t.id === tutorId ? { ...t, is_verified: value } : t))
    toast.success(value ? 'Instructor verified!' : 'Verification removed')
  }

  if (isAdmin === null) return null

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <p className="text-gray-500 font-bold text-lg">Access denied.</p>
        </div>
      </div>
    )
  }

  const q = search.trim().toLowerCase()
  const displayed = tutors
    .filter(t => filter === 'pending' ? (t.verification_requested && !t.is_verified) : true)
    .filter(t => !q || t.full_name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q))

  const pendingCount = tutors.filter(t => t.verification_requested && !t.is_verified).length

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-10">

        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-7 h-7 text-blue-600 shrink-0" />
            <h1 className="text-2xl font-bold text-gray-900">Admin — Instructor Verification</h1>
          </div>
          {!loading && tutors.length > 0 && (
            <div className="flex items-center gap-3 text-sm font-bold">
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 rounded-full">
                <BadgeCheck className="w-4 h-4" />
                {tutors.filter(t => t.is_verified).length} verified
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full">
                {tutors.filter(t => !t.is_verified).length} not verified
              </span>
            </div>
          )}
        </div>

        {rlsWarning && (
          <div className="mb-6 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="font-bold text-red-700 text-sm">Verification columns missing — run this migration in the Supabase SQL editor, then reload:</p>
              <pre className="mt-2 text-xs bg-red-100 text-red-800 rounded-lg px-3 py-2 overflow-x-auto whitespace-pre-wrap">{`ALTER TABLE tutor_profiles
  ADD COLUMN IF NOT EXISTS is_verified               boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_requested    boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_document_url text;`}</pre>
              <p className="font-bold text-red-700 text-sm mt-3">Then ensure the admin read policy exists:</p>
              <pre className="mt-2 text-xs bg-red-100 text-red-800 rounded-lg px-3 py-2 overflow-x-auto whitespace-pre-wrap">{`DROP POLICY IF EXISTS "admins_read_tutor_profiles" ON tutor_profiles;
CREATE POLICY "admins_read_tutor_profiles" ON tutor_profiles
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.is_admin = true
  ));`}</pre>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name…"
              className="w-full h-10 pl-9 pr-9 border border-gray-200 rounded-xl text-sm font-medium text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-2 shrink-0">
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
              All ({tutors.length})
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-gray-400 font-medium">Loading…</p>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <BadgeCheck className="w-12 h-12 text-gray-300" />
            <p className="text-gray-400 font-bold text-lg">
              {q
                ? `No instructors found matching "${search}".`
                : filter === 'pending'
                  ? 'No pending verification requests.'
                  : 'No instructors yet.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {displayed.map(t => (
              <div
                key={t.id}
                className={`flex items-center gap-4 p-5 rounded-2xl border shadow-sm transition-shadow hover:shadow-md ${
                  t.is_verified
                    ? 'bg-green-50 border-green-200'
                    : t.verification_requested
                    ? 'bg-yellow-50 border-yellow-200'
                    : 'bg-white border-gray-100'
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
                    {t.is_verified ? (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-green-600 text-white">
                        <BadgeCheck className="w-3 h-3" /> Verified
                      </span>
                    ) : t.verification_requested ? (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700">
                        <Clock className="w-3 h-3" /> Pending Review
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-500">
                        Not verified
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
