// SQL migration — run once in Supabase SQL editor (Progress Tracking / Learning Goals):
//
// CREATE TABLE IF NOT EXISTS learning_goals (
//   id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//   student_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
//   title       text NOT NULL,
//   subject     text,
//   target_date date,
//   status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
//   created_at  timestamptz DEFAULT now()
// );
// CREATE TABLE IF NOT EXISTS goal_milestones (
//   id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//   goal_id    uuid NOT NULL REFERENCES learning_goals(id) ON DELETE CASCADE,
//   marked_by  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
//   title      text NOT NULL,
//   created_at timestamptz DEFAULT now()
// );
// ALTER TABLE learning_goals ENABLE ROW LEVEL SECURITY;
// ALTER TABLE goal_milestones  ENABLE ROW LEVEL SECURITY;
// -- Students manage their own goals
// CREATE POLICY "goals_student_all" ON learning_goals FOR ALL TO authenticated
//   USING (auth.uid() = student_id) WITH CHECK (auth.uid() = student_id);
// -- Tutors with an accepted/completed booking can read student goals
// CREATE POLICY "goals_tutor_read" ON learning_goals FOR SELECT TO authenticated
//   USING (EXISTS (SELECT 1 FROM bookings WHERE tutor_id = auth.uid() AND student_id = learning_goals.student_id AND status IN ('accepted','completed')));
// -- Parents can read linked children's goals
// CREATE POLICY "goals_parent_read" ON learning_goals FOR SELECT TO authenticated
//   USING (EXISTS (SELECT 1 FROM parent_links WHERE parent_id = auth.uid() AND student_id = learning_goals.student_id AND status = 'active'));
// -- Tutors can insert milestones for students they've worked with
// CREATE POLICY "milestones_tutor_insert" ON goal_milestones FOR INSERT TO authenticated
//   WITH CHECK (marked_by = auth.uid() AND EXISTS (
//     SELECT 1 FROM learning_goals g JOIN bookings b ON b.student_id = g.student_id
//     WHERE g.id = goal_id AND b.tutor_id = auth.uid() AND b.status IN ('accepted','completed')
//   ));
// -- Anyone who can see the goal can see its milestones
// CREATE POLICY "milestones_read" ON goal_milestones FOR SELECT TO authenticated
//   USING (EXISTS (
//     SELECT 1 FROM learning_goals g WHERE g.id = goal_id AND (
//       g.student_id = auth.uid()
//       OR EXISTS (SELECT 1 FROM parent_links WHERE parent_id = auth.uid() AND student_id = g.student_id AND status = 'active')
//       OR EXISTS (SELECT 1 FROM bookings WHERE tutor_id = auth.uid() AND student_id = g.student_id AND status IN ('accepted','completed'))
//     )
//   ));

import { useState, useEffect } from "react"
import { Link, Navigate, useSearchParams } from "react-router"
import { Navbar } from "../components/Navbar"
import { useAuth } from "../../context/AuthContext"
import { supabase } from "../../lib/supabase"
import { toast } from "sonner"
import {
  Calendar, Clock, BookOpen, Heart, Search, ChevronRight, Star,
  User, CheckCircle, XCircle, Loader2, TrendingUp, Lightbulb, Ban, StickyNote,
  Target, Plus, X, Flag, PenLine, GraduationCap, CreditCard,
} from "lucide-react"

interface UpcomingLesson {
  id:             string
  subject:        string
  scheduled_at:   string
  tutor_name:     string
  tutor_avatar:   string | null
  tutor_id:       string
  price_cents:    number | null
  payment_status: 'pending' | 'paid' | 'refunded' | null
}

interface PendingPayment {
  id:           string
  subject:      string
  scheduled_at: string | null
  tutor_name:   string
  price_cents:  number
}

interface PendingRequest {
  id:           string
  subject:      string
  created_at:   string
  tutor_name:   string
  tutor_avatar: string | null
  tutor_id:     string
}

interface RecentActivity {
  id:         string
  type:       'accepted' | 'declined' | 'cancelled'
  subject:    string
  tutor_name: string
  created_at: string
}

interface NoteEntry {
  booking_id:   string
  content:      string
  updated_at:   string
  subject:      string
  tutor_name:   string
  scheduled_at: string | null
}

interface SavedTutor {
  tutor_id:    string
  tutor_name:  string
  avatar_url:  string | null
  hourly_rate: number | null
  subject:     string | null
  rating:      number | null
}

interface MyInstructor {
  id:            string
  name:          string
  avatar_url:    string | null
  subjects:      string[]
  session_count: number
  last_session:  string | null
}

interface LearningGoal {
  id:              string
  title:           string
  subject:         string | null
  target_date:     string | null
  status:          'active' | 'completed' | 'paused'
  created_at:      string
  milestone_count: number
}

interface GoalMilestone {
  id:          string
  title:       string
  created_at:  string
  marker_name: string | null
}

function Avatar({ name, url, sm }: { name: string; url: string | null; sm?: boolean }) {
  const cls = sm ? 'w-8 h-8 rounded-lg text-xs' : 'w-10 h-10 rounded-xl text-sm'
  if (url) {
    return (
      <img
        src={url} alt={name}
        className={`${cls} object-cover shrink-0 bg-gray-100`}
        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
      />
    )
  }
  return (
    <div className={`${cls} bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center shrink-0`}>
      <span className="text-white font-black select-none">{name.charAt(0).toUpperCase()}</span>
    </div>
  )
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1)
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  if (d.toDateString() === now.toDateString())       return `Today · ${time}`
  if (d.toDateString() === tomorrow.toDateString())  return `Tomorrow · ${time}`
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ` · ${time}`
}

function timeAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7)  return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function StudentDashboard() {
  const { user, profile, role, loading } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const [upcoming,        setUpcoming]        = useState<UpcomingLesson[]>([])
  const [pending,         setPending]         = useState<PendingRequest[]>([])
  const [activity,        setActivity]        = useState<RecentActivity[]>([])
  const [saved,           setSaved]           = useState<SavedTutor[]>([])
  const [notes,           setNotes]           = useState<NoteEntry[]>([])
  const [instructors,     setInstructors]     = useState<MyInstructor[]>([])
  const [stats,           setStats]           = useState({ upcoming: 0, pending: 0, completed: 0 })
  const [fetching,        setFetching]        = useState(true)
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([])
  const [payingId,        setPayingId]        = useState<string | null>(null)

  // Per-session notes (upcoming sessions)
  const [mySessionNotes,  setMySessionNotes]  = useState<Record<string, string>>({})
  const [writingNoteFor,  setWritingNoteFor]  = useState<string | null>(null)
  const [noteText,        setNoteText]        = useState('')
  const [savingNote,      setSavingNote]      = useState(false)

  // Goal state
  const [goals,             setGoals]             = useState<LearningGoal[]>([])
  const [addingGoal,        setAddingGoal]        = useState(false)
  const [goalTitle,         setGoalTitle]         = useState('')
  const [goalSubject,       setGoalSubject]       = useState('')
  const [goalDate,          setGoalDate]          = useState('')
  const [savingGoal,        setSavingGoal]        = useState(false)
  const [expandedGoal,      setExpandedGoal]      = useState<string | null>(null)
  const [goalMilestones,    setGoalMilestones]    = useState<Record<string, GoalMilestone[]>>({})
  const [loadingMilestones, setLoadingMilestones] = useState<string | null>(null)

  useEffect(() => {
    if (user) loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // Handle Stripe redirect back
  useEffect(() => {
    const result = searchParams.get('payment')
    if (!result) return
    if (result === 'success') { toast.success('Payment successful! Your session is confirmed.'); loadData() }
    if (result === 'cancelled') toast.info('Payment cancelled.')
    setSearchParams({}, { replace: true })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handlePay(lesson: { id: string; subject: string; price_cents: number | null; tutor_name: string }) {
    if (!user) return
    setPayingId(lesson.id)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) { toast.error('Please sign in to pay.'); setPayingId(null); return }
    try {
      const res = await fetch('/api/create-checkout-session', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({
          bookingId:   lesson.id,
          amountCents: lesson.price_cents,
          subject:     lesson.subject,
          studentName: profile?.full_name ?? 'Student',
          tutorName:   lesson.tutor_name,
          successUrl:  `${window.location.origin}/dashboard?payment=success`,
          cancelUrl:   `${window.location.origin}/dashboard?payment=cancelled`,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) { toast.error(data.error ?? 'Could not start checkout.'); setPayingId(null); return }
      window.location.href = data.url
    } catch {
      toast.error('Network error starting checkout.')
      setPayingId(null)
    }
  }

  async function loadData() {
    if (!user) return
    setFetching(true)
    const now = new Date().toISOString()

    const [upcomingRes, pendingRes, allRes, activityRes, savedRes, notesRes, goalsRes, unpaidRes] = await Promise.all([
      supabase
        .from('bookings')
        .select('id, subject, scheduled_at, price_cents, payment_status, tutor:tutor_id(id, full_name, avatar_url)')
        .eq('student_id', user.id)
        .eq('status', 'accepted')
        .gte('scheduled_at', now)
        .order('scheduled_at', { ascending: true })
        .limit(5),

      supabase
        .from('bookings')
        .select('id, subject, created_at, tutor:tutor_id(id, full_name, avatar_url)')
        .eq('student_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(6),

      supabase
        .from('bookings')
        .select('status, scheduled_at')
        .eq('student_id', user.id),

      supabase
        .from('bookings')
        .select('id, subject, status, created_at, tutor:tutor_id(full_name)')
        .eq('student_id', user.id)
        .in('status', ['accepted', 'declined', 'cancelled'])
        .order('created_at', { ascending: false })
        .limit(6),

      supabase
        .from('saved_tutors')
        .select('tutor_id')
        .eq('student_id', user.id)
        .order('created_at', { ascending: false })
        .limit(6),

      // Instructor notes written about me (RLS allows via booking.student_id = me)
      supabase
        .from('session_notes')
        .select('booking_id, content, updated_at, booking:booking_id(subject, scheduled_at, tutor:tutor_id(full_name))')
        .neq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(4),

      supabase
        .from('learning_goals')
        .select('id, title, subject, target_date, status, created_at')
        .eq('student_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(10),

      supabase
        .from('bookings')
        .select('id, subject, scheduled_at, price_cents, payment_status, tutor:tutor_id(full_name)')
        .eq('student_id', user.id)
        .in('status', ['accepted', 'completed'])
        .gt('price_cents', 0)
        .or('payment_status.is.null,payment_status.neq.paid')
        .order('scheduled_at', { ascending: false })
        .limit(20),
    ])

    setUpcoming(
      (upcomingRes.data ?? []).map((b: any) => ({
        id:             b.id,
        subject:        b.subject,
        scheduled_at:   b.scheduled_at,
        tutor_name:     b.tutor?.full_name  ?? 'Instructor',
        tutor_avatar:   b.tutor?.avatar_url ?? null,
        tutor_id:       b.tutor?.id         ?? '',
        price_cents:    b.price_cents    ?? null,
        payment_status: b.payment_status ?? null,
      }))
    )

    setPendingPayments(
      (unpaidRes.data ?? []).map((b: any) => ({
        id:           b.id,
        subject:      b.subject ?? '',
        scheduled_at: b.scheduled_at ?? null,
        tutor_name:   b.tutor?.full_name ?? 'Instructor',
        price_cents:  b.price_cents as number,
      }))
    )

    setPending(
      (pendingRes.data ?? []).map((b: any) => ({
        id:           b.id,
        subject:      b.subject,
        created_at:   b.created_at,
        tutor_name:   b.tutor?.full_name  ?? 'Instructor',
        tutor_avatar: b.tutor?.avatar_url ?? null,
        tutor_id:     b.tutor?.id         ?? '',
      }))
    )

    const all = allRes.data ?? []
    setStats({
      upcoming:  all.filter(b => b.status === 'accepted' && b.scheduled_at && b.scheduled_at >= now).length,
      pending:   all.filter(b => b.status === 'pending').length,
      completed: all.filter(b => b.status === 'completed').length,
    })

    setActivity(
      (activityRes.data ?? []).map((b: any) => ({
        id:         b.id,
        type:       b.status as 'accepted' | 'declined' | 'cancelled',
        subject:    b.subject,
        tutor_name: (b.tutor as any)?.full_name ?? 'Instructor',
        created_at: b.created_at,
      }))
    )

    const savedIds = (savedRes.data ?? []).map((r: any) => r.tutor_id as string)
    if (savedIds.length > 0) {
      const [{ data: profiles }, { data: tProfiles }, { data: reviews }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, avatar_url').in('id', savedIds),
        supabase.from('tutor_profiles').select('id, hourly_rate, subjects').in('id', savedIds),
        supabase.from('reviews').select('tutor_id, rating').in('tutor_id', savedIds),
      ])
      const pMap: Record<string, any>  = {}
      for (const p of profiles  ?? []) pMap[p.id]  = p
      const tpMap: Record<string, any> = {}
      for (const tp of tProfiles ?? []) tpMap[tp.id] = tp
      const rMap: Record<string, { sum: number; count: number }> = {}
      for (const r of reviews ?? []) {
        if (!rMap[r.tutor_id]) rMap[r.tutor_id] = { sum: 0, count: 0 }
        rMap[r.tutor_id].sum   += r.rating
        rMap[r.tutor_id].count += 1
      }
      setSaved(savedIds.map(id => ({
        tutor_id:    id,
        tutor_name:  pMap[id]?.full_name  ?? 'Instructor',
        avatar_url:  pMap[id]?.avatar_url ?? null,
        hourly_rate: tpMap[id]?.hourly_rate ?? null,
        subject:     Array.isArray(tpMap[id]?.subjects) ? tpMap[id].subjects[0] : (tpMap[id]?.subjects ?? null),
        rating:      rMap[id] ? Math.round((rMap[id].sum / rMap[id].count) * 10) / 10 : null,
      })))
    }

    setNotes(
      (notesRes.data ?? []).map((n: any) => ({
        booking_id:   n.booking_id,
        content:      n.content,
        updated_at:   n.updated_at,
        subject:      (n.booking as any)?.subject     ?? '',
        tutor_name:   (n.booking as any)?.tutor?.full_name ?? 'Instructor',
        scheduled_at: (n.booking as any)?.scheduled_at ?? null,
      }))
    )

    const goalsList = (goalsRes.data ?? []) as any[]
    if (goalsList.length > 0) {
      const goalIds = goalsList.map(g => g.id)
      const { data: mData } = await supabase
        .from('goal_milestones')
        .select('goal_id')
        .in('goal_id', goalIds)
      const cMap: Record<string, number> = {}
      for (const m of mData ?? []) cMap[(m as any).goal_id] = (cMap[(m as any).goal_id] ?? 0) + 1
      setGoals(goalsList.map(g => ({ ...g, milestone_count: cMap[g.id] ?? 0 })))
    } else {
      setGoals([])
    }

    // Load my notes for upcoming sessions
    const upcomingIds = (upcomingRes.data ?? []).map((b: any) => b.id as string)
    if (upcomingIds.length > 0) {
      const { data: snData } = await supabase
        .from('session_notes')
        .select('booking_id, content')
        .eq('user_id', user.id)
        .in('booking_id', upcomingIds)
      const snMap: Record<string, string> = {}
      for (const n of snData ?? []) snMap[(n as any).booking_id] = (n as any).content
      setMySessionNotes(snMap)
    }

    // Load my instructors (distinct tutors from accepted/completed bookings)
    const { data: instrBkData } = await supabase
      .from('bookings')
      .select('tutor_id, subject, scheduled_at')
      .eq('student_id', user.id)
      .in('status', ['accepted', 'completed'])
      .order('scheduled_at', { ascending: false })

    const bkRows = instrBkData ?? []
    const tutorIds = [...new Set(bkRows.map((b: any) => b.tutor_id as string))]
    if (tutorIds.length > 0) {
      const [{ data: instrProfiles }, { data: instrTpData }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, avatar_url').in('id', tutorIds),
        supabase.from('tutor_profiles').select('id, subjects').in('id', tutorIds),
      ])
      const pMap: Record<string, any>  = {}
      for (const p of instrProfiles ?? []) pMap[(p as any).id] = p
      const tpMap: Record<string, any> = {}
      for (const tp of instrTpData ?? []) tpMap[(tp as any).id] = tp
      const countMap: Record<string, number> = {}
      const lastMap:  Record<string, string> = {}
      for (const b of bkRows as any[]) {
        countMap[b.tutor_id] = (countMap[b.tutor_id] ?? 0) + 1
        if (b.scheduled_at && (!lastMap[b.tutor_id] || b.scheduled_at > lastMap[b.tutor_id])) {
          lastMap[b.tutor_id] = b.scheduled_at
        }
      }
      const rawSubjects = (tp: any) => {
        const s = tpMap[tp]?.subjects
        return Array.isArray(s) ? s : (s ? [s] : [])
      }
      setInstructors(tutorIds.map(id => ({
        id,
        name:          pMap[id]?.full_name  ?? 'Instructor',
        avatar_url:    pMap[id]?.avatar_url ?? null,
        subjects:      rawSubjects(id),
        session_count: countMap[id] ?? 0,
        last_session:  lastMap[id]  ?? null,
      })))
    }

    setFetching(false)
  }

  async function handleAddGoal() {
    if (!goalTitle.trim() || !user) return
    setSavingGoal(true)
    const { data, error } = await supabase
      .from('learning_goals')
      .insert({ student_id: user.id, title: goalTitle.trim(), subject: goalSubject.trim() || null, target_date: goalDate || null })
      .select('id, title, subject, target_date, status, created_at')
      .single()
    if (error || !data) {
      console.error('Goal insert error:', error)
      toast.error(error?.message ?? 'Failed to add goal.')
      setSavingGoal(false)
      return
    }
    setGoals(prev => [{ ...data, milestone_count: 0 }, ...prev])
    setGoalTitle(''); setGoalSubject(''); setGoalDate('')
    setAddingGoal(false)
    setSavingGoal(false)
  }

  async function handleCompleteGoal(id: string) {
    await supabase.from('learning_goals').update({ status: 'completed' }).eq('id', id).eq('student_id', user!.id)
    setGoals(prev => prev.filter(g => g.id !== id))
    toast.success('Goal marked complete!')
  }

  async function handleExpandGoal(id: string) {
    if (expandedGoal === id) { setExpandedGoal(null); return }
    setExpandedGoal(id)
    if (goalMilestones[id]) return
    setLoadingMilestones(id)
    const { data } = await supabase
      .from('goal_milestones')
      .select('id, title, created_at, marker:marked_by(full_name)')
      .eq('goal_id', id)
      .order('created_at', { ascending: true })
    setGoalMilestones(prev => ({
      ...prev,
      [id]: (data ?? []).map((m: any) => ({
        id: m.id, title: m.title, created_at: m.created_at,
        marker_name: (m.marker as any)?.full_name ?? null,
      })),
    }))
    setLoadingMilestones(null)
  }

  async function handleSaveStudentNote(bookingId: string) {
    if (!noteText.trim() || !user) return
    setSavingNote(true)
    const { error } = await supabase
      .from('session_notes')
      .upsert(
        { booking_id: bookingId, user_id: user.id, content: noteText.trim(), updated_at: new Date().toISOString() },
        { onConflict: 'booking_id,user_id' }
      )
    if (error) { toast.error('Failed to save note.'); setSavingNote(false); return }
    setMySessionNotes(prev => ({ ...prev, [bookingId]: noteText.trim() }))
    setWritingNoteFor(null); setNoteText(''); setSavingNote(false)
    toast.success('Note saved!')
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  )

  if (role === 'tutor') return <Navigate to="/my-profile" replace />

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there'

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 md:px-8 py-8">

        {/* Greeting */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-gray-900">Hey, {firstName}!</h1>
            <p className="text-gray-500 font-medium mt-1">Here's what's happening with your learning.</p>
          </div>
          <Link
            to="/search"
            className="hidden sm:flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100 text-sm"
          >
            <Search className="w-4 h-4" />
            Find an Instructor
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-black text-gray-900">{stats.upcoming}</p>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Upcoming</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-black text-gray-900">{stats.pending}</p>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Pending</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-black text-gray-900">{stats.completed}</p>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Completed</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Left column (2/3) ── */}
          <div className="lg:col-span-2 flex flex-col gap-6">

            {/* Pending Payments alert */}
            {pendingPayments.length > 0 && (() => {
              const total = pendingPayments.reduce((sum, p) => sum + p.price_cents, 0)
              return (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                    <CreditCard className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-gray-900 text-sm">
                      {pendingPayments.length} session{pendingPayments.length !== 1 ? 's' : ''} awaiting payment
                    </p>
                    <p className="text-xs text-gray-500 font-medium mt-0.5">
                      Total due: <span className="font-black text-amber-700">${(total / 100).toFixed(2)}</span>
                    </p>
                    <div className="flex flex-col gap-2 mt-3">
                      {pendingPayments.map(p => (
                        <div key={p.id} className="flex items-center justify-between gap-3 bg-white rounded-xl px-3 py-2.5 border border-amber-100">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-900 truncate">{p.subject}</p>
                            <p className="text-xs text-gray-500 font-medium">
                              with {p.tutor_name}
                              {p.scheduled_at && ` · ${new Date(p.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                            </p>
                          </div>
                          <button
                            onClick={() => handlePay(p)}
                            disabled={payingId === p.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-60 shrink-0"
                          >
                            {payingId === p.id
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <CreditCard className="w-3 h-3" />}
                            Pay ${(p.price_cents / 100).toFixed(2)}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Upcoming lessons */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <h2 className="font-black text-gray-900">Upcoming Lessons</h2>
                </div>
                <Link to="/lessons" className="text-sm font-bold text-blue-600 hover:text-blue-700">View all →</Link>
              </div>

              {fetching ? (
                <div className="px-6 py-12 flex justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
                </div>
              ) : upcoming.length === 0 ? (
                <div className="px-6 py-12 flex flex-col items-center gap-3 text-center">
                  <Calendar className="w-10 h-10 text-gray-200" />
                  <p className="text-gray-400 font-bold">No upcoming lessons</p>
                  <Link to="/search" className="text-sm font-bold text-blue-600 hover:underline">Find an instructor →</Link>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {upcoming.map(l => {
                    const needsPay = (l.price_cents ?? 0) > 0 && l.payment_status !== 'paid'
                    const isPaid   = l.payment_status === 'paid'
                    const isPaying = payingId === l.id
                    return (
                    <div key={l.id} className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <Link to={`/tutor/${l.tutor_id}`} className="shrink-0">
                          <Avatar name={l.tutor_name} url={l.tutor_avatar} />
                        </Link>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900 truncate">{l.subject}</p>
                          <p className="text-sm text-gray-500 font-medium">with {l.tutor_name}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                          <p className="text-sm font-bold text-blue-600 whitespace-nowrap hidden sm:block">{formatDate(l.scheduled_at)}</p>
                          {isPaid && (
                            <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-bold">
                              <CheckCircle className="w-3 h-3" /> Paid
                            </span>
                          )}
                          {needsPay && writingNoteFor !== l.id && (
                            <button
                              onClick={() => handlePay(l)}
                              disabled={isPaying}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-60"
                            >
                              {isPaying
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <CreditCard className="w-3.5 h-3.5" />}
                              Pay ${((l.price_cents ?? 0) / 100).toFixed(2)}
                            </button>
                          )}
                          {writingNoteFor !== l.id && (
                            <button
                              onClick={() => { setNoteText(mySessionNotes[l.id] ?? ''); setWritingNoteFor(l.id) }}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-xs font-bold transition-colors"
                              title="Add a pre-session note"
                            >
                              <StickyNote className="w-3.5 h-3.5" />
                              {mySessionNotes[l.id] ? 'Note' : 'Add note'}
                            </button>
                          )}
                        </div>
                      </div>
                      {mySessionNotes[l.id] && writingNoteFor !== l.id && (
                        <div className="mt-2 ml-14 bg-blue-50 rounded-lg px-3 py-2">
                          <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-0.5">Your note</p>
                          <p className="text-xs text-gray-700 font-medium leading-relaxed">{mySessionNotes[l.id]}</p>
                        </div>
                      )}
                      {writingNoteFor === l.id && (
                        <div className="mt-2 ml-14 flex flex-col gap-2">
                          <textarea
                            value={noteText}
                            onChange={e => setNoteText(e.target.value)}
                            placeholder="Questions to ask, topics to prepare, goals for this session…"
                            rows={2}
                            autoFocus
                            className="w-full px-3 py-2 border border-blue-200 rounded-lg text-xs font-medium text-gray-800 bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                          />
                          <div className="flex items-center gap-2 justify-end">
                            <button
                              onClick={() => { setWritingNoteFor(null); setNoteText('') }}
                              className="text-xs font-bold text-gray-400 hover:text-gray-600 px-2 py-1 rounded transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleSaveStudentNote(l.id)}
                              disabled={savingNote || !noteText.trim()}
                              className="flex items-center gap-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                            >
                              {savingNote && <Loader2 className="w-3 h-3 animate-spin" />}
                              Save
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                  })}
                </div>
              )}
            </div>

            {/* My Instructors */}
            {(fetching || instructors.length > 0) && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-blue-600" />
                    <h2 className="font-black text-gray-900">My Instructors</h2>
                    {instructors.length > 0 && (
                      <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">{instructors.length}</span>
                    )}
                  </div>
                  <Link to="/search" className="text-sm font-bold text-blue-600 hover:text-blue-700">Find more →</Link>
                </div>
                {fetching ? (
                  <div className="px-6 py-10 flex justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {instructors.map(t => (
                      <Link
                        key={t.id}
                        to={`/my-instructors/${t.id}`}
                        className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors group"
                      >
                        <Avatar name={t.name} url={t.avatar_url} sm />
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900 truncate">{t.name}</p>
                          {t.subjects.length > 0 && (
                            <p className="text-xs text-gray-500 font-medium truncate">{t.subjects.join(', ')}</p>
                          )}
                          {t.last_session && (
                            <p className="text-[10px] text-gray-400 font-medium mt-0.5">
                              Last session {timeAgo(t.last_session)}
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 flex items-center gap-3">
                          <div className="text-center hidden sm:block">
                            <p className="text-sm font-black text-blue-600">{t.session_count}</p>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Sessions</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition-colors" />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Recent activity */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
                <TrendingUp className="w-4 h-4 text-purple-600" />
                <h2 className="font-black text-gray-900">Recent Activity</h2>
              </div>

              {fetching ? (
                <div className="px-6 py-10 flex justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
                </div>
              ) : activity.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <p className="text-gray-400 font-medium text-sm">No recent activity yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {activity.map(a => {
                    const icon =
                      a.type === 'accepted'  ? <CheckCircle className="w-3.5 h-3.5 text-green-600" /> :
                      a.type === 'declined'  ? <XCircle     className="w-3.5 h-3.5 text-red-500"   /> :
                                               <Ban         className="w-3.5 h-3.5 text-gray-400"  />
                    const ringCls =
                      a.type === 'accepted'  ? 'bg-green-100' :
                      a.type === 'declined'  ? 'bg-red-100'   : 'bg-gray-100'
                    const label =
                      a.type === 'accepted'  ? `${a.tutor_name} accepted your ${a.subject} request` :
                      a.type === 'declined'  ? `${a.tutor_name} declined your ${a.subject} request` :
                                               `Your ${a.subject} session was cancelled`
                    return (
                      <div key={a.id} className="flex items-start gap-3 px-6 py-3.5">
                        <div className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${ringCls}`}>
                          {icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-800">{label}</p>
                          <p className="text-xs text-gray-400 font-medium mt-0.5">{timeAgo(a.created_at)}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Session Notes */}
            {(fetching || notes.length > 0) && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <StickyNote className="w-4 h-4 text-blue-500" />
                    <h2 className="font-black text-gray-900">Notes from Your Instructors</h2>
                  </div>
                  <Link to="/lessons" className="text-sm font-bold text-blue-600 hover:text-blue-700">All →</Link>
                </div>
                {fetching ? (
                  <div className="px-6 py-10 flex justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {notes.map(n => (
                      <div key={n.booking_id} className="px-6 py-4">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div>
                            <p className="font-bold text-gray-900 text-sm">{n.subject}</p>
                            <p className="text-xs text-gray-500 font-medium">with {n.tutor_name}</p>
                          </div>
                          {n.scheduled_at && (
                            <p className="text-xs text-gray-400 font-medium shrink-0">
                              {new Date(n.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </p>
                          )}
                        </div>
                        <p className="text-sm text-gray-700 font-medium leading-relaxed line-clamp-3">{n.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Right column (1/3) ── */}
          <div className="flex flex-col gap-6">

            {/* Pending requests */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <h2 className="font-black text-gray-900 text-sm">Pending Requests</h2>
                  {pending.length > 0 && (
                    <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
                      {pending.length}
                    </span>
                  )}
                </div>
                <Link to="/lessons" className="text-xs font-bold text-blue-600 hover:text-blue-700">All →</Link>
              </div>

              {fetching ? (
                <div className="px-5 py-8 flex justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
                </div>
              ) : pending.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <p className="text-gray-400 font-medium text-sm">No pending requests.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {pending.map(p => (
                    <Link
                      key={p.id}
                      to={`/tutor/${p.tutor_id}`}
                      className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors group"
                    >
                      <Avatar name={p.tutor_name} url={p.tutor_avatar} sm />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 text-sm truncate">{p.subject}</p>
                        <p className="text-xs text-gray-500 truncate">with {p.tutor_name}</p>
                        <p className="text-[10px] text-amber-600 font-bold mt-0.5">Awaiting response</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Saved tutors */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Heart className="w-4 h-4 text-red-500 fill-red-500" />
                  <h2 className="font-black text-gray-900 text-sm">Saved Instructors</h2>
                </div>
                <Link to="/profile" className="text-xs font-bold text-blue-600 hover:text-blue-700">All →</Link>
              </div>

              {fetching ? (
                <div className="px-5 py-8 flex justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
                </div>
              ) : saved.length === 0 ? (
                <div className="px-5 py-8 text-center space-y-1">
                  <p className="text-gray-400 font-medium text-sm">No saved instructors yet.</p>
                  <Link to="/search" className="text-xs font-bold text-blue-600 hover:underline block">Browse instructors →</Link>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {saved.map(t => (
                    <Link
                      key={t.tutor_id}
                      to={`/tutor/${t.tutor_id}`}
                      className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors group"
                    >
                      <Avatar name={t.tutor_name} url={t.avatar_url} sm />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 text-sm truncate">{t.tutor_name}</p>
                        {t.subject && <p className="text-xs text-gray-500 truncate">{t.subject}</p>}
                        <div className="flex items-center gap-2 mt-0.5">
                          {t.rating !== null && (
                            <span className="flex items-center gap-0.5 text-[10px] font-bold text-blue-600">
                              <Star className="w-2.5 h-2.5 fill-blue-600" />{t.rating}
                            </span>
                          )}
                          {t.hourly_rate !== null && (
                            <span className="text-[10px] font-bold text-gray-500">${t.hourly_rate}/hr</span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-500 shrink-0" />
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* My Goals */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-indigo-600" />
                  <h2 className="font-black text-gray-900 text-sm">My Goals</h2>
                  {goals.length > 0 && (
                    <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full">
                      {goals.length}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setAddingGoal(v => !v)}
                  className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
                >
                  {addingGoal ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  {addingGoal ? 'Cancel' : 'Add'}
                </button>
              </div>

              {addingGoal && (
                <div className="px-5 py-4 border-b border-gray-50 bg-indigo-50/40 flex flex-col gap-2">
                  <input
                    type="text"
                    value={goalTitle}
                    onChange={e => setGoalTitle(e.target.value)}
                    placeholder="Goal (e.g. Pass SAT Math by May)"
                    autoFocus
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={goalSubject}
                      onChange={e => setGoalSubject(e.target.value)}
                      placeholder="Subject (optional)"
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                    <input
                      type="date"
                      value={goalDate}
                      onChange={e => setGoalDate(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  </div>
                  <button
                    onClick={handleAddGoal}
                    disabled={savingGoal || !goalTitle.trim()}
                    className="w-full py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
                  >
                    {savingGoal && <Loader2 className="w-3 h-3 animate-spin" />}
                    Save Goal
                  </button>
                </div>
              )}

              {fetching ? (
                <div className="px-5 py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
              ) : goals.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <p className="text-gray-400 font-medium text-sm">No active goals yet.</p>
                  <p className="text-gray-400 text-xs mt-1">Set a goal and your instructor can mark progress.</p>
                </div>
              ) : (
                <div>
                  {goals.map(g => (
                    <div key={g.id} className="border-b border-gray-50 last:border-b-0">
                      <button
                        onClick={() => handleExpandGoal(g.id)}
                        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors text-left group"
                      >
                        <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                          <Target className="w-3.5 h-3.5 text-indigo-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900 text-sm truncate">{g.title}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {g.subject && <span className="text-[10px] font-bold text-gray-400">{g.subject}</span>}
                            {g.target_date && (
                              <span className="text-[10px] font-bold text-indigo-500">
                                by {new Date(g.target_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                            )}
                            {g.milestone_count > 0 && (
                              <span className="text-[10px] font-bold text-green-600">
                                {g.milestone_count} milestone{g.milestone_count !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); handleCompleteGoal(g.id) }}
                          className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-full bg-green-100 flex items-center justify-center shrink-0 hover:bg-green-200 transition-all"
                          title="Mark complete"
                        >
                          <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                        </button>
                      </button>
                      {expandedGoal === g.id && (
                        <div className="px-5 pb-3 bg-gray-50/50">
                          {loadingMilestones === g.id ? (
                            <div className="py-3 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-gray-300" /></div>
                          ) : (goalMilestones[g.id] ?? []).length === 0 ? (
                            <p className="text-[11px] text-gray-400 font-medium py-2 italic">No milestones yet — your instructor can mark progress here.</p>
                          ) : (
                            <div className="space-y-2 pt-2">
                              {(goalMilestones[g.id] ?? []).map(m => (
                                <div key={m.id} className="flex items-start gap-2">
                                  <div className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center shrink-0 mt-0.5">
                                    <CheckCircle className="w-2.5 h-2.5 text-green-600" />
                                  </div>
                                  <div>
                                    <p className="text-xs font-bold text-gray-800">{m.title}</p>
                                    <p className="text-[10px] text-gray-400">
                                      {m.marker_name ? `by ${m.marker_name} · ` : ''}{timeAgo(m.created_at)}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick actions */}
            <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl p-5 text-white">
              <p className="font-black text-xs mb-4 text-blue-200 uppercase tracking-widest">Quick Actions</p>
              <div className="flex flex-col gap-3">
                <Link to="/search"        className="flex items-center gap-2.5 text-sm font-bold hover:text-blue-200 transition-colors">
                  <Search      className="w-4 h-4 shrink-0" /> Find an Instructor
                </Link>
                <Link to="/lessons"       className="flex items-center gap-2.5 text-sm font-bold hover:text-blue-200 transition-colors">
                  <BookOpen    className="w-4 h-4 shrink-0" /> My Lessons
                </Link>
                <Link to="/needed-courses" className="flex items-center gap-2.5 text-sm font-bold hover:text-blue-200 transition-colors">
                  <Lightbulb   className="w-4 h-4 shrink-0" /> Request a Course
                </Link>
                <Link to="/profile"       className="flex items-center gap-2.5 text-sm font-bold hover:text-blue-200 transition-colors">
                  <User        className="w-4 h-4 shrink-0" /> Edit Profile
                </Link>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  )
}
