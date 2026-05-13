// SQL migration — run once in Supabase SQL editor:
//
// -- 1. parent_links table
// CREATE TABLE IF NOT EXISTS parent_links (
//   id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//   parent_id     uuid REFERENCES profiles(id) ON DELETE CASCADE,
//   student_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
//   invite_token  text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
//   status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active')),
//   created_at    timestamptz DEFAULT now()
// );
// ALTER TABLE parent_links ENABLE ROW LEVEL SECURITY;
//
// -- Students manage their own links
// CREATE POLICY "pl_student_all" ON parent_links FOR ALL TO authenticated
//   USING  (auth.uid() = student_id)
//   WITH CHECK (auth.uid() = student_id);
//
// -- Parents read their active links
// CREATE POLICY "pl_parent_read" ON parent_links FOR SELECT TO authenticated
//   USING  (auth.uid() = parent_id AND status = 'active');
//
// -- 2. SECURITY DEFINER function for accepting invites (bypasses RLS for the update)
// CREATE OR REPLACE FUNCTION accept_parent_invite(p_token text)
// RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
// DECLARE link parent_links%ROWTYPE;
// BEGIN
//   SELECT * INTO link FROM parent_links WHERE invite_token = p_token AND status = 'pending' AND parent_id IS NULL;
//   IF NOT FOUND THEN RETURN json_build_object('error', 'This invite link is invalid or has already been used.'); END IF;
//   IF link.student_id = auth.uid() THEN RETURN json_build_object('error', 'You cannot accept your own invite link.'); END IF;
//   UPDATE parent_links SET parent_id = auth.uid(), status = 'active' WHERE id = link.id;
//   RETURN json_build_object('success', true);
// END; $$;
//
// -- 3. Parents can read linked students' bookings
// CREATE POLICY "bookings_parent_read" ON bookings FOR SELECT TO authenticated
//   USING (EXISTS (
//     SELECT 1 FROM parent_links
//     WHERE parent_id = auth.uid() AND student_id = bookings.student_id AND status = 'active'
//   ));
//
// -- 4. Parents can read session notes for linked students
// CREATE POLICY "session_notes_parent_read" ON session_notes FOR SELECT TO authenticated
//   USING (EXISTS (
//     SELECT 1 FROM parent_links pl JOIN bookings b ON b.id = session_notes.booking_id
//     WHERE pl.parent_id = auth.uid() AND pl.student_id = b.student_id AND pl.status = 'active'
//   ));

import { useState, useEffect } from "react"
import { Link, useNavigate } from "react-router"
import { Navbar } from "../components/Navbar"
import { useAuth } from "../../context/AuthContext"
import { supabase } from "../../lib/supabase"
import {
  Calendar, BookOpen, StickyNote, GraduationCap, User,
  ChevronRight, Loader2, Users, Shield, Star,
} from "lucide-react"

// ── Types ─────────────────────────────────────────────────────────────────────

interface Child {
  id:         string
  name:       string
  avatar_url: string | null
  link_id:    string
}

interface ChildLesson {
  id:           string
  subject:      string
  scheduled_at: string
  tutor_name:   string
  tutor_id:     string
  tutor_avatar: string | null
}

interface ChildNote {
  booking_id:   string
  subject:      string
  tutor_name:   string
  content:      string
  updated_at:   string
  scheduled_at: string | null
}

interface ChildInstructor {
  id:           string
  name:         string
  avatar_url:   string | null
  subjects:     string[]
  sessions:     number
}

interface ChildStats {
  upcoming:  number
  completed: number
  tutors:    number
}

interface ChildData {
  lessons:     ChildLesson[]
  notes:       ChildNote[]
  instructors: ChildInstructor[]
  stats:       ChildStats
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Avatar({ name, url, sm }: { name: string; url: string | null; sm?: boolean }) {
  const cls = sm ? 'w-8 h-8 rounded-lg text-xs' : 'w-10 h-10 rounded-xl text-sm'
  if (url) return <img src={url} alt={name} className={`${cls} object-cover shrink-0 bg-gray-100`} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
  return (
    <div className={`${cls} bg-gradient-to-br from-green-400 to-teal-500 flex items-center justify-center shrink-0`}>
      <span className="text-white font-black select-none">{name.charAt(0).toUpperCase()}</span>
    </div>
  )
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const tom = new Date(now); tom.setDate(now.getDate() + 1)
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  if (d.toDateString() === now.toDateString()) return `Today · ${time}`
  if (d.toDateString() === tom.toDateString()) return `Tomorrow · ${time}`
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ` · ${time}`
}

function timeAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Main component ─────────────────────────────────────────────────────────────

export function GuardianDashboard() {
  const { user, profile, loading } = useAuth()
  const navigate = useNavigate()

  const [children,     setChildren]     = useState<Child[]>([])
  const [childData,    setChildData]    = useState<Record<string, ChildData>>({})
  const [fetching,     setFetching]     = useState(true)
  const [selectedId,   setSelectedId]   = useState<string | null>(null)

  // Invite link input
  const [inviteInput,   setInviteInput]   = useState('')
  const [connecting,    setConnecting]    = useState(false)
  const [connectError,  setConnectError]  = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    loadData()
  }, [user])

  async function loadData() {
    if (!user) return
    setFetching(true)
    const now = new Date().toISOString()

    // 1. Linked children
    const { data: links } = await supabase
      .from('parent_links')
      .select('id, student_id, profiles:student_id(id, full_name, avatar_url)')
      .eq('parent_id', user.id)
      .eq('status', 'active')

    const kids: Child[] = (links ?? []).map((l: any) => ({
      id:         l.student_id,
      name:       l.profiles?.full_name ?? 'Student',
      avatar_url: l.profiles?.avatar_url ?? null,
      link_id:    l.id,
    }))

    setChildren(kids)
    if (kids.length === 0) { setFetching(false); return }

    const defaultId = kids[0].id
    setSelectedId(defaultId)

    const childIds = kids.map(k => k.id)

    // 2. Upcoming + all bookings
    const [upcomingRes, allRes] = await Promise.all([
      supabase
        .from('bookings')
        .select('id, subject, scheduled_at, student_id, tutor:tutor_id(id, full_name, avatar_url)')
        .in('student_id', childIds)
        .eq('status', 'accepted')
        .gte('scheduled_at', now)
        .order('scheduled_at', { ascending: true })
        .limit(30),

      supabase
        .from('bookings')
        .select('id, subject, scheduled_at, status, student_id, tutor:tutor_id(id, full_name, avatar_url)')
        .in('student_id', childIds)
        .in('status', ['accepted', 'completed'])
        .order('scheduled_at', { ascending: false })
        .limit(60),
    ])

    const allBookings = (allRes.data ?? []) as any[]
    const upcoming    = (upcomingRes.data ?? []) as any[]

    // 3. Session notes for completed lessons
    const completedIds = allBookings.filter(b => b.status === 'completed').map(b => b.id)
    const notesData = completedIds.length > 0
      ? (await supabase
          .from('session_notes')
          .select('booking_id, content, updated_at')
          .in('booking_id', completedIds)
          .order('updated_at', { ascending: false })
          .limit(50)
        ).data ?? []
      : []

    // 4. Build per-child data map
    const dataMap: Record<string, ChildData> = {}
    for (const kid of kids) {
      const kidUpcoming  = upcoming.filter(b => b.student_id === kid.id)
      const kidAll       = allBookings.filter(b => b.student_id === kid.id)
      const kidCompleted = kidAll.filter(b => b.status === 'completed')
      const completedSet = new Set(kidCompleted.map(b => b.id))

      // Instructors map
      const instrMap: Record<string, { name: string; avatar: string | null; subjects: Set<string>; sessions: number }> = {}
      for (const b of kidAll) {
        if (!b.tutor?.id) continue
        if (!instrMap[b.tutor.id]) instrMap[b.tutor.id] = { name: b.tutor.full_name ?? 'Instructor', avatar: b.tutor.avatar_url ?? null, subjects: new Set(), sessions: 0 }
        instrMap[b.tutor.id].sessions++
        if (b.subject) instrMap[b.tutor.id].subjects.add(b.subject)
      }

      // Notes with booking context
      const kidNotes: ChildNote[] = notesData
        .filter(n => completedSet.has(n.booking_id))
        .slice(0, 5)
        .map((n: any) => {
          const booking = kidCompleted.find(b => b.id === n.booking_id)
          return {
            booking_id:   n.booking_id,
            subject:      booking?.subject ?? '',
            tutor_name:   booking?.tutor?.full_name ?? 'Instructor',
            content:      n.content,
            updated_at:   n.updated_at,
            scheduled_at: booking?.scheduled_at ?? null,
          }
        })

      dataMap[kid.id] = {
        lessons: kidUpcoming.slice(0, 6).map((b: any) => ({
          id: b.id, subject: b.subject, scheduled_at: b.scheduled_at,
          tutor_name: b.tutor?.full_name ?? 'Instructor',
          tutor_id:   b.tutor?.id ?? '',
          tutor_avatar: b.tutor?.avatar_url ?? null,
        })),
        notes: kidNotes,
        instructors: Object.entries(instrMap)
          .map(([id, v]) => ({ id, name: v.name, avatar_url: v.avatar, subjects: Array.from(v.subjects), sessions: v.sessions }))
          .sort((a, b) => b.sessions - a.sessions)
          .slice(0, 8),
        stats: {
          upcoming:  kidUpcoming.length,
          completed: kidCompleted.length,
          tutors:    Object.keys(instrMap).length,
        },
      }
    }

    setChildData(dataMap)
    setFetching(false)
  }

  function extractToken(raw: string): string {
    const trimmed = raw.trim()
    // Accept full URL or bare token
    const match = trimmed.match(/\/join-family\/([^/?#\s]+)/)
    return match ? match[1] : trimmed
  }

  async function connectViaLink() {
    const token = extractToken(inviteInput)
    if (!token) { setConnectError('Please paste a valid invite link or token.'); return }
    setConnecting(true)
    setConnectError(null)
    const { data, error } = await supabase.rpc('accept_parent_invite', { p_token: token })
    if (error || (data as any)?.error) {
      setConnectError((data as any)?.error ?? error?.message ?? 'Something went wrong.')
      setConnecting(false)
      return
    }
    setInviteInput('')
    setConnecting(false)
    await loadData()
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  )

  const firstName  = profile?.full_name?.split(' ')[0] ?? 'there'
  const child      = children.find(c => c.id === selectedId) ?? null
  const data       = selectedId ? childData[selectedId] : null

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 md:px-8 py-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-black text-gray-900">Hey, {firstName}!</h1>
            <p className="text-gray-500 font-medium mt-1">Guardian Overview</p>
          </div>

          {/* Child tabs */}
          {children.length > 1 && (
            <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 self-start sm:self-auto flex-wrap">
              {children.map(kid => (
                <button
                  key={kid.id}
                  onClick={() => setSelectedId(kid.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                    selectedId === kid.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {kid.avatar_url
                    ? <img src={kid.avatar_url} alt={kid.name} className="w-5 h-5 rounded-full object-cover" />
                    : <div className="w-5 h-5 rounded-full bg-green-200 flex items-center justify-center text-[10px] font-black text-green-700">{kid.name.charAt(0)}</div>
                  }
                  {kid.name.split(' ')[0]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Connect via invite link (always visible) ───────────────────── */}
        {!fetching && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-green-600" />
              <h2 className="font-black text-gray-900 text-sm">
                {children.length === 0 ? 'Connect to a child' : 'Add another child'}
              </h2>
            </div>
            {children.length === 0 && (
              <p className="text-sm text-gray-500 font-medium mb-4">
                Ask your child to go to their profile → "Family Access" → "Generate Invite Link", then paste it here.
              </p>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={inviteInput}
                onChange={e => { setInviteInput(e.target.value); setConnectError(null) }}
                onKeyDown={e => e.key === 'Enter' && connectViaLink()}
                placeholder="Paste invite link or token…"
                className="flex-1 h-10 px-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-400"
              />
              <button
                onClick={connectViaLink}
                disabled={connecting || !inviteInput.trim()}
                className="flex items-center gap-1.5 px-4 h-10 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                Connect
              </button>
            </div>
            {connectError && (
              <p className="mt-2 text-xs font-bold text-red-600">{connectError}</p>
            )}
          </div>
        )}

        {/* ── Loading ────────────────────────────────────────────────────── */}
        {fetching && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-green-500" />
          </div>
        )}

        {/* ── Child overview ─────────────────────────────────────────────── */}
        {!fetching && child && data && (
          <>
            {/* Child identity + stats */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <Avatar name={child.name} url={child.avatar_url} />
                <div className="min-w-0">
                  <h2 className="text-xl font-black text-gray-900 truncate">{child.name}</h2>
                  <p className="text-sm text-gray-400 font-medium">Student</p>
                </div>
              </div>
              <div className="flex items-center gap-6 shrink-0">
                <div className="text-center">
                  <p className="text-2xl font-black text-blue-600">{data.stats.upcoming}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Upcoming</p>
                </div>
                <div className="w-px h-10 bg-gray-100" />
                <div className="text-center">
                  <p className="text-2xl font-black text-green-600">{data.stats.completed}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Completed</p>
                </div>
                <div className="w-px h-10 bg-gray-100" />
                <div className="text-center">
                  <p className="text-2xl font-black text-purple-600">{data.stats.tutors}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tutors</p>
                </div>
              </div>
            </div>

            {/* Main grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Left 2/3 */}
              <div className="lg:col-span-2 flex flex-col gap-6">

                {/* Upcoming Lessons */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-blue-600" />
                      <h2 className="font-black text-gray-900">Upcoming Lessons</h2>
                    </div>
                  </div>
                  {data.lessons.length === 0 ? (
                    <div className="px-6 py-12 flex flex-col items-center gap-2 text-center">
                      <Calendar className="w-10 h-10 text-gray-200" />
                      <p className="text-gray-400 font-bold">No upcoming lessons</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {data.lessons.map(l => (
                        <Link key={l.id} to={`/tutor/${l.tutor_id}`} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors group">
                          <Avatar name={l.tutor_name} url={l.tutor_avatar} />
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-gray-900 truncate">{l.subject}</p>
                            <p className="text-sm text-gray-500 font-medium">with {l.tutor_name}</p>
                          </div>
                          <p className="text-sm font-bold text-blue-600 whitespace-nowrap shrink-0">{formatDate(l.scheduled_at)}</p>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                {/* Session Notes */}
                {data.notes.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
                      <StickyNote className="w-4 h-4 text-amber-500" />
                      <h2 className="font-black text-gray-900">Session Notes from Instructors</h2>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {data.notes.map(n => (
                        <div key={n.booking_id} className="px-6 py-4">
                          <div className="flex items-center justify-between mb-1.5">
                            <p className="text-sm font-bold text-gray-900">{n.subject} · {n.tutor_name}</p>
                            {n.scheduled_at && (
                              <p className="text-xs text-gray-400 shrink-0 ml-2">{timeAgo(n.updated_at)}</p>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 font-medium leading-relaxed">{n.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty notes state */}
                {data.notes.length === 0 && data.stats.completed > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
                      <StickyNote className="w-4 h-4 text-amber-500" />
                      <h2 className="font-black text-gray-900">Session Notes from Instructors</h2>
                    </div>
                    <div className="px-6 py-10 text-center">
                      <p className="text-gray-400 font-medium text-sm">No notes written yet.</p>
                      <p className="text-gray-400 text-xs mt-1">Instructors write notes after completed sessions.</p>
                    </div>
                  </div>
                )}

              </div>

              {/* Right 1/3 */}
              <div className="flex flex-col gap-6">

                {/* Instructors */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
                    <GraduationCap className="w-4 h-4 text-purple-600" />
                    <h2 className="font-black text-gray-900 text-sm">Instructors</h2>
                    {data.instructors.length > 0 && (
                      <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs font-bold rounded-full ml-auto">
                        {data.instructors.length}
                      </span>
                    )}
                  </div>
                  {data.instructors.length === 0 ? (
                    <div className="px-5 py-8 text-center">
                      <p className="text-gray-400 font-medium text-sm">No instructors yet.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {data.instructors.map(t => (
                        <Link key={t.id} to={`/tutor/${t.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors group">
                          <Avatar name={t.name} url={t.avatar_url} sm />
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-gray-900 text-sm truncate">{t.name}</p>
                            {t.subjects.length > 0 && (
                              <p className="text-xs text-gray-500 truncate">{t.subjects.join(', ')}</p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-black text-purple-600">{t.sessions}</p>
                            <p className="text-[10px] text-gray-400 leading-none">{t.sessions === 1 ? 'session' : 'sessions'}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quick actions */}
                <div className="bg-gradient-to-br from-green-600 to-teal-600 rounded-2xl p-5 text-white">
                  <p className="font-black text-xs mb-4 text-green-200 uppercase tracking-widest">Guardian Actions</p>
                  <div className="flex flex-col gap-3">
                    <Link to="/search" className="flex items-center gap-2.5 text-sm font-bold hover:text-green-200 transition-colors">
                      <Star        className="w-4 h-4 shrink-0" /> Browse Instructors
                    </Link>
                    <Link to="/profile" className="flex items-center gap-2.5 text-sm font-bold hover:text-green-200 transition-colors">
                      <User        className="w-4 h-4 shrink-0" /> My Profile
                    </Link>
                    <Link to="/needed-courses" className="flex items-center gap-2.5 text-sm font-bold hover:text-green-200 transition-colors">
                      <BookOpen    className="w-4 h-4 shrink-0" /> Request a Course
                    </Link>
                  </div>
                </div>

                {/* Switch child (mobile-only helper when multiple children) */}
                {children.length > 1 && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
                      <Users className="w-4 h-4 text-gray-500" />
                      <h2 className="font-black text-gray-900 text-sm">Switch Child</h2>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {children.map(kid => (
                        <button
                          key={kid.id}
                          onClick={() => setSelectedId(kid.id)}
                          className={`w-full flex items-center gap-3 px-5 py-3 transition-colors ${selectedId === kid.id ? 'bg-green-50' : 'hover:bg-gray-50'}`}
                        >
                          <Avatar name={kid.name} url={kid.avatar_url} sm />
                          <p className={`font-bold text-sm ${selectedId === kid.id ? 'text-green-700' : 'text-gray-800'}`}>{kid.name}</p>
                          {selectedId === kid.id && <ChevronRight className="w-3.5 h-3.5 text-green-500 ml-auto" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
