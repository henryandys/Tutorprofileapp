import { useState, useEffect, useCallback } from "react"
import { Link, Navigate, useNavigate } from "react-router"
import { Navbar } from "../components/Navbar"
import { useAuth } from "../../context/AuthContext"
import { supabase } from "../../lib/supabase"
import { sendNotificationEmail } from "../../lib/notify"
import {
  Calendar, Clock, BookOpen, Heart, Search, ChevronRight, Star,
  User, CheckCircle, XCircle, Loader2, TrendingUp, Lightbulb, Ban,
  Users, GraduationCap, MessageCircle, LayoutDashboard, Check, StickyNote,
  Target, Flag, Plus, X,
} from "lucide-react"
import { toast } from "sonner"

// ── Teaching types ────────────────────────────────────────────────────────────

interface UpcomingSession {
  id:           string
  subject:      string
  scheduled_at: string
  student_name: string
}

interface PendingBooking {
  id:           string
  subject:      string
  message:      string
  created_at:   string
  student_name: string
  student_id:   string
}

interface RecentReview {
  id:           string
  rating:       number
  body:         string
  student_name: string
  created_at:   string
}

interface TeachingStats {
  upcoming:  number
  pending:   number
  students:  number
  rating:    number | null
}

interface TutorStudent {
  id:             string
  name:           string
  avatar_url:     string | null
  subjects:       string[]
  total_sessions: number
  last_session:   string | null
  goals:          { id: string; title: string; subject: string | null }[]
}

// ── Learning types ────────────────────────────────────────────────────────────

interface UsedInstructor {
  id:             string
  name:           string
  avatar_url:     string | null
  subjects:       string[]
  total_sessions: number
  last_session:   string | null
}

interface UpcomingLesson {
  id:           string
  subject:      string
  scheduled_at: string
  tutor_name:   string
  tutor_avatar: string | null
  tutor_id:     string
}

interface StudentPending {
  id:           string
  subject:      string
  created_at:   string
  tutor_name:   string
  tutor_avatar: string | null
  tutor_id:     string
}

interface Activity {
  id:         string
  type:       'accepted' | 'declined' | 'cancelled'
  subject:    string
  tutor_name: string
  created_at: string
}

interface SavedTutor {
  tutor_id:    string
  tutor_name:  string
  avatar_url:  string | null
  hourly_rate: number | null
  subject:     string | null
  rating:      number | null
}

interface StudentStats {
  upcoming:  number
  pending:   number
  completed: number
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

// ── Shared helpers ────────────────────────────────────────────────────────────

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
  if (days < 7)  return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} className={`w-3.5 h-3.5 ${i <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} />
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

type Tab = 'teaching' | 'learning'

export function InstructorDashboard() {
  const { user, profile, role, loading } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('teaching')

  // Teaching state
  const [upcomingSessions, setUpcomingSessions] = useState<UpcomingSession[]>([])
  const [pendingBookings,  setPendingBookings]  = useState<PendingBooking[]>([])
  const [reviews,          setReviews]          = useState<RecentReview[]>([])
  const [teachingStats,    setTeachingStats]    = useState<TeachingStats>({ upcoming: 0, pending: 0, students: 0, rating: null })
  const [fetchingTeaching, setFetchingTeaching] = useState(true)
  const [acceptingId,      setAcceptingId]      = useState<string | null>(null)
  const [decliningId,      setDecliningId]      = useState<string | null>(null)

  // Learning state
  const [upcomingLessons,  setUpcomingLessons]  = useState<UpcomingLesson[]>([])
  const [studentPending,   setStudentPending]   = useState<StudentPending[]>([])
  const [activity,         setActivity]         = useState<Activity[]>([])
  const [savedTutors,      setSavedTutors]      = useState<SavedTutor[]>([])
  const [usedInstructors,  setUsedInstructors]  = useState<UsedInstructor[]>([])
  const [studentStats,     setStudentStats]     = useState<StudentStats>({ upcoming: 0, pending: 0, completed: 0 })
  const [fetchingLearning, setFetchingLearning] = useState(false)
  const [learningLoaded,   setLearningLoaded]   = useState(false)

  // Notes state
  const [upcomingNoteMap,  setUpcomingNoteMap]  = useState<Record<string, string>>({})
  const [writingNoteFor,   setWritingNoteFor]   = useState<string | null>(null)
  const [noteContent,      setNoteContent]      = useState('')
  const [savingNote,       setSavingNote]       = useState(false)

  // Learning goals state (instructor as student)
  const [learningGoals,           setLearningGoals]           = useState<LearningGoal[]>([])
  const [addingLearningGoal,      setAddingLearningGoal]      = useState(false)
  const [learningGoalTitle,       setLearningGoalTitle]       = useState('')
  const [learningGoalSubject,     setLearningGoalSubject]     = useState('')
  const [learningGoalDate,        setLearningGoalDate]        = useState('')
  const [savingLearningGoal,      setSavingLearningGoal]      = useState(false)
  const [expandedLearningGoal,    setExpandedLearningGoal]    = useState<string | null>(null)
  const [learningGoalMilestones,  setLearningGoalMilestones]  = useState<Record<string, GoalMilestone[]>>({})
  const [loadingLearningMs,       setLoadingLearningMs]       = useState<string | null>(null)
  const [confirmLearningGoalId,   setConfirmLearningGoalId]   = useState<string | null>(null)

  // Students state
  const [students, setStudents] = useState<TutorStudent[]>([])

  // Milestone state
  const [milestoneStudentId, setMilestoneStudentId] = useState<string | null>(null)
  const [studentGoals,       setStudentGoals]       = useState<{id: string; title: string; subject: string|null}[]>([])
  const [loadingGoals,       setLoadingGoals]       = useState(false)
  const [selectedGoalId,     setSelectedGoalId]     = useState<string>('')
  const [milestoneText,      setMilestoneText]      = useState('')
  const [savingMilestone,    setSavingMilestone]    = useState(false)

  const loadTeaching = useCallback(async () => {
    if (!user) return
    setFetchingTeaching(true)
    const now = new Date().toISOString()

    const [sessRes, pendRes, allRes, revRes] = await Promise.all([
      supabase
        .from('bookings')
        .select('id, subject, scheduled_at, student_name')
        .eq('tutor_id', user.id)
        .eq('status', 'accepted')
        .gte('scheduled_at', now)
        .order('scheduled_at', { ascending: true })
        .limit(6),

      supabase
        .from('bookings')
        .select('id, subject, message, created_at, student_name, student_id')
        .eq('tutor_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(10),

      supabase
        .from('bookings')
        .select('id, status, scheduled_at, student_id, student_name, subject')
        .eq('tutor_id', user.id)
        .order('created_at', { ascending: false })
        .limit(500),

      supabase
        .from('reviews')
        .select('id, rating, body, student_name, created_at')
        .eq('tutor_id', user.id)
        .order('created_at', { ascending: false })
        .limit(4),
    ])

    setUpcomingSessions(sessRes.data ?? [])
    setPendingBookings(pendRes.data ?? [])
    setReviews(revRes.data ?? [])

    const all = allRes.data ?? []
    const uniqueStudents = new Set(
      all.filter(b => ['accepted', 'completed'].includes(b.status)).map(b => b.student_id)
    ).size
    const allRatings = (revRes.data ?? []).map(r => r.rating)
    const avgRating = allRatings.length > 0
      ? Math.round((allRatings.reduce((a, b) => a + b, 0) / allRatings.length) * 10) / 10
      : null

    setTeachingStats({
      upcoming: all.filter(b => b.status === 'accepted' && b.scheduled_at && b.scheduled_at >= now).length,
      pending:  all.filter(b => b.status === 'pending').length,
      students: uniqueStudents,
      rating:   avgRating,
    })

    // Build student map from all bookings
    const studentMap: Record<string, { name: string; subjects: Set<string>; sessions: number; last: string | null }> = {}
    for (const b of all) {
      if (!['accepted', 'completed'].includes(b.status)) continue
      if (!studentMap[b.student_id]) {
        studentMap[b.student_id] = { name: (b as any).student_name ?? 'Student', subjects: new Set(), sessions: 0, last: null }
      }
      const sm = studentMap[b.student_id]
      sm.sessions++
      if ((b as any).subject) sm.subjects.add((b as any).subject)
      if (b.scheduled_at && (!sm.last || b.scheduled_at > sm.last)) sm.last = b.scheduled_at
    }
    const studentIds = Object.keys(studentMap)

    // Fetch student avatars, goals, and notes for upcoming sessions
    const upcomingIds = (sessRes.data ?? []).map((s: any) => s.id as string)
    const [studentProfilesRes, goalsRes, upcomingNotesRes] = await Promise.all([
      studentIds.length > 0
        ? supabase.from('profiles').select('id, avatar_url').in('id', studentIds)
        : Promise.resolve({ data: [] }),
      studentIds.length > 0
        ? supabase
            .from('learning_goals')
            .select('id, student_id, title, subject')
            .in('student_id', studentIds)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(50)
        : Promise.resolve({ data: [] }),
      upcomingIds.length > 0
        ? supabase
            .from('session_notes')
            .select('booking_id, content')
            .eq('user_id', user.id)
            .in('booking_id', upcomingIds)
        : Promise.resolve({ data: [] }),
    ])

    const unMap: Record<string, string> = {}
    for (const n of (upcomingNotesRes.data ?? []) as any[]) unMap[n.booking_id] = n.content
    setUpcomingNoteMap(unMap)

    const avatarMap: Record<string, string | null> = {}
    for (const p of (studentProfilesRes.data ?? []) as any[]) avatarMap[p.id] = p.avatar_url ?? null

    const goalsMap: Record<string, { id: string; title: string; subject: string | null }[]> = {}
    for (const g of (goalsRes.data ?? []) as any[]) {
      if (!goalsMap[g.student_id]) goalsMap[g.student_id] = []
      goalsMap[g.student_id].push({ id: g.id, title: g.title, subject: g.subject ?? null })
    }

    setStudents(
      studentIds
        .map(id => ({
          id,
          name:           studentMap[id].name,
          avatar_url:     avatarMap[id] ?? null,
          subjects:       Array.from(studentMap[id].subjects),
          total_sessions: studentMap[id].sessions,
          last_session:   studentMap[id].last,
          goals:          goalsMap[id] ?? [],
        }))
        .sort((a, b) => (b.last_session ?? '').localeCompare(a.last_session ?? ''))
        .slice(0, 15)
    )

    setFetchingTeaching(false)
  }, [user])

  const loadLearning = useCallback(async () => {
    if (!user || learningLoaded) return
    setFetchingLearning(true)
    const now = new Date().toISOString()

    const [upRes, pendRes, allRes, actRes, savedRes, goalsRes] = await Promise.all([
      supabase
        .from('bookings')
        .select('id, subject, scheduled_at, tutor:tutor_id(id, full_name, avatar_url)')
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
        .select('status, scheduled_at, tutor_id, subject, tutor:tutor_id(full_name, avatar_url)')
        .eq('student_id', user.id)
        .order('created_at', { ascending: false })
        .limit(500),

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

      supabase
        .from('learning_goals')
        .select('id, title, subject, target_date, status, created_at')
        .eq('student_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(10),
    ])

    setUpcomingLessons(
      (upRes.data ?? []).map((b: any) => ({
        id: b.id, subject: b.subject, scheduled_at: b.scheduled_at,
        tutor_name: b.tutor?.full_name ?? 'Instructor',
        tutor_avatar: b.tutor?.avatar_url ?? null,
        tutor_id: b.tutor?.id ?? '',
      }))
    )

    setStudentPending(
      (pendRes.data ?? []).map((b: any) => ({
        id: b.id, subject: b.subject, created_at: b.created_at,
        tutor_name: b.tutor?.full_name ?? 'Instructor',
        tutor_avatar: b.tutor?.avatar_url ?? null,
        tutor_id: b.tutor?.id ?? '',
      }))
    )

    const all = allRes.data ?? []
    setStudentStats({
      upcoming:  all.filter(b => b.status === 'accepted' && b.scheduled_at && b.scheduled_at >= now).length,
      pending:   all.filter(b => b.status === 'pending').length,
      completed: all.filter(b => b.status === 'completed').length,
    })

    // Build instructor map from accepted/completed bookings
    const instrMap: Record<string, { name: string; avatar: string | null; subjects: Set<string>; sessions: number; last: string | null }> = {}
    for (const b of all as any[]) {
      if (!['accepted', 'completed'].includes(b.status) || !b.tutor_id) continue
      if (!instrMap[b.tutor_id]) {
        instrMap[b.tutor_id] = { name: b.tutor?.full_name ?? 'Instructor', avatar: b.tutor?.avatar_url ?? null, subjects: new Set(), sessions: 0, last: null }
      }
      const im = instrMap[b.tutor_id]
      im.sessions++
      if (b.subject) im.subjects.add(b.subject)
      if (b.scheduled_at && (!im.last || b.scheduled_at > im.last)) im.last = b.scheduled_at
    }
    setUsedInstructors(
      Object.entries(instrMap)
        .map(([id, v]) => ({
          id,
          name:           v.name,
          avatar_url:     v.avatar,
          subjects:       Array.from(v.subjects),
          total_sessions: v.sessions,
          last_session:   v.last,
        }))
        .sort((a, b) => (b.last_session ?? '').localeCompare(a.last_session ?? ''))
        .slice(0, 15)
    )

    setActivity(
      (actRes.data ?? []).map((b: any) => ({
        id: b.id, type: b.status as Activity['type'], subject: b.subject,
        tutor_name: (b.tutor as any)?.full_name ?? 'Instructor',
        created_at: b.created_at,
      }))
    )

    const savedIds = (savedRes.data ?? []).map((r: any) => r.tutor_id as string)
    if (savedIds.length > 0) {
      const [{ data: profiles }, { data: tProfiles }, { data: revData }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, avatar_url').in('id', savedIds),
        supabase.from('tutor_profiles').select('id, hourly_rate, subjects').in('id', savedIds),
        supabase.from('reviews').select('tutor_id, rating').in('tutor_id', savedIds),
      ])
      const pMap: Record<string, any>  = {}; for (const p  of profiles  ?? []) pMap[p.id]   = p
      const tpMap: Record<string, any> = {}; for (const tp of tProfiles ?? []) tpMap[tp.id] = tp
      const rMap: Record<string, { sum: number; count: number }> = {}
      for (const r of revData ?? []) {
        if (!rMap[r.tutor_id]) rMap[r.tutor_id] = { sum: 0, count: 0 }
        rMap[r.tutor_id].sum += r.rating; rMap[r.tutor_id].count += 1
      }
      setSavedTutors(savedIds.map(id => ({
        tutor_id: id,
        tutor_name: pMap[id]?.full_name ?? 'Instructor',
        avatar_url: pMap[id]?.avatar_url ?? null,
        hourly_rate: tpMap[id]?.hourly_rate ?? null,
        subject: Array.isArray(tpMap[id]?.subjects) ? tpMap[id].subjects[0] : (tpMap[id]?.subjects ?? null),
        rating: rMap[id] ? Math.round((rMap[id].sum / rMap[id].count) * 10) / 10 : null,
      })))
    }

    const goalsList = (goalsRes.data ?? []) as any[]
    if (goalsList.length > 0) {
      const goalIds = goalsList.map((g: any) => g.id)
      const { data: mData } = await supabase
        .from('goal_milestones')
        .select('goal_id')
        .in('goal_id', goalIds)
      const cMap: Record<string, number> = {}
      for (const m of mData ?? []) cMap[(m as any).goal_id] = (cMap[(m as any).goal_id] ?? 0) + 1
      setLearningGoals(goalsList.map((g: any) => ({ ...g, milestone_count: cMap[g.id] ?? 0 })))
    } else {
      setLearningGoals([])
    }

    setFetchingLearning(false)
    setLearningLoaded(true)
  }, [user, learningLoaded])

  useEffect(() => { if (user) loadTeaching() }, [user, loadTeaching])
  useEffect(() => { if (tab === 'learning') loadLearning() }, [tab, loadLearning])

  async function handleAddLearningGoal() {
    if (!learningGoalTitle.trim() || !user) return
    setSavingLearningGoal(true)
    const { data, error } = await supabase
      .from('learning_goals')
      .insert({ student_id: user.id, title: learningGoalTitle.trim(), subject: learningGoalSubject.trim() || null, target_date: learningGoalDate || null })
      .select('id, title, subject, target_date, status, created_at')
      .single()
    if (error || !data) { toast.error(error?.message ?? 'Failed to add goal.'); setSavingLearningGoal(false); return }
    setLearningGoals(prev => [{ ...data, milestone_count: 0 }, ...prev])
    setLearningGoalTitle(''); setLearningGoalSubject(''); setLearningGoalDate('')
    setAddingLearningGoal(false)
    setSavingLearningGoal(false)
    toast.success('Goal added!')
  }

  async function handleCompleteLearningGoal(id: string) {
    const { error } = await supabase.from('learning_goals').update({ status: 'completed' }).eq('id', id).eq('student_id', user!.id)
    if (error) { toast.error('Failed to complete goal.'); return }
    setLearningGoals(prev => prev.filter(g => g.id !== id))
    toast.success('Goal marked complete!')
  }

  async function handleExpandLearningGoal(id: string) {
    if (expandedLearningGoal === id) { setExpandedLearningGoal(null); return }
    setExpandedLearningGoal(id)
    if (learningGoalMilestones[id]) return
    setLoadingLearningMs(id)
    const { data } = await supabase
      .from('goal_milestones')
      .select('id, title, created_at, marker:marked_by(full_name)')
      .eq('goal_id', id)
      .order('created_at', { ascending: true })
    setLearningGoalMilestones(prev => ({
      ...prev,
      [id]: (data ?? []).map((m: any) => ({
        id: m.id, title: m.title, created_at: m.created_at,
        marker_name: (m.marker as any)?.full_name ?? null,
      })),
    }))
    setLoadingLearningMs(null)
  }

  async function handleSaveNote(bookingId: string) {
    if (!noteContent.trim()) { toast.error('Note cannot be empty.'); return }
    setSavingNote(true)
    const { error } = await supabase
      .from('session_notes')
      .upsert(
        { booking_id: bookingId, user_id: user!.id, content: noteContent.trim(), updated_at: new Date().toISOString() },
        { onConflict: 'booking_id,user_id' }
      )
    if (error) { toast.error('Failed to save note.'); setSavingNote(false); return }
    setUpcomingNoteMap(prev => ({ ...prev, [bookingId]: noteContent.trim() }))
    setWritingNoteFor(null)
    setNoteContent('')
    setSavingNote(false)
    toast.success('Note saved!')
  }

  async function handleAccept(booking: PendingBooking) {
    setAcceptingId(booking.id)
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'accepted' })
      .eq('id', booking.id)
      .eq('tutor_id', user!.id)
    if (error) { toast.error('Failed to accept booking.'); setAcceptingId(null); return }

    setPendingBookings(prev => prev.filter(b => b.id !== booking.id))
    setTeachingStats(prev => ({ ...prev, pending: Math.max(0, prev.pending - 1) }))
    sendNotificationEmail({
      type: 'booking_accepted',
      recipientId: booking.student_id,
      data: {
        tutorName:   profile?.full_name ?? 'Your instructor',
        studentName: booking.student_name,
        subject:     booking.subject,
      },
    })
    toast.success(`Accepted ${booking.student_name}'s request!`)
    setAcceptingId(null)
  }

  async function handleDecline(booking: PendingBooking) {
    setDecliningId(booking.id)
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'declined' })
      .eq('id', booking.id)
      .eq('tutor_id', user!.id)
    if (error) { toast.error('Failed to decline booking.'); setDecliningId(null); return }

    setPendingBookings(prev => prev.filter(b => b.id !== booking.id))
    setTeachingStats(prev => ({ ...prev, pending: Math.max(0, prev.pending - 1) }))
    sendNotificationEmail({
      type: 'booking_declined',
      recipientId: booking.student_id,
      data: {
        tutorName:   profile?.full_name ?? 'Your instructor',
        studentName: booking.student_name,
        subject:     booking.subject,
      },
    })
    toast.success(`Declined ${booking.student_name}'s request.`)
    setDecliningId(null)
  }

  async function openMilestone(studentId: string) {
    if (milestoneStudentId === studentId) { setMilestoneStudentId(null); return }
    setMilestoneStudentId(studentId)
    setSelectedGoalId('')
    setMilestoneText('')
    const cached = students.find(s => s.id === studentId)?.goals
    if (cached) { setStudentGoals(cached); return }
    setLoadingGoals(true)
    const { data } = await supabase
      .from('learning_goals')
      .select('id, title, subject')
      .eq('student_id', studentId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
    setStudentGoals(data ?? [])
    setLoadingGoals(false)
  }

  async function saveMilestone() {
    if (!selectedGoalId || !milestoneText.trim()) return
    setSavingMilestone(true)
    const { error } = await supabase
      .from('goal_milestones')
      .insert({ goal_id: selectedGoalId, marked_by: user!.id, title: milestoneText.trim() })
    if (error) { toast.error('Failed to save milestone.'); setSavingMilestone(false); return }
    toast.success('Milestone marked!')
    setMilestoneStudentId(null)
    setMilestoneText('')
    setSelectedGoalId('')
    setSavingMilestone(false)
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  )
  if (role !== 'tutor') return <Navigate to="/dashboard" replace />

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there'

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 md:px-8 py-8">

        {/* Header + tab switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-black text-gray-900">Hey, {firstName}!</h1>
            <p className="text-gray-500 font-medium mt-1">
              {tab === 'teaching' ? "Here's your teaching overview." : "Your learning activity."}
            </p>
          </div>
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 self-start sm:self-auto">
            <button
              onClick={() => setTab('teaching')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                tab === 'teaching'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              Teaching
            </button>
            <button
              onClick={() => setTab('learning')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                tab === 'learning'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Learning
            </button>
          </div>
        </div>

        {/* ━━━━ TEACHING TAB ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {tab === 'teaching' && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 sm:p-5 flex flex-col sm:flex-row items-center gap-1.5 sm:gap-3 text-center sm:text-left">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-black text-gray-900">{teachingStats.upcoming}</p>
                  <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wide">Upcoming</p>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 sm:p-5 flex flex-col sm:flex-row items-center gap-1.5 sm:gap-3 text-center sm:text-left">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-black text-gray-900">{teachingStats.pending}</p>
                  <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wide">Requests</p>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 sm:p-5 flex flex-col sm:flex-row items-center gap-1.5 sm:gap-3 text-center sm:text-left">
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-black text-gray-900">{teachingStats.students}</p>
                  <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wide">Students</p>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 sm:p-5 flex flex-col sm:flex-row items-center gap-1.5 sm:gap-3 text-center sm:text-left">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                  <Star className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-black text-gray-900">
                    {teachingStats.rating !== null ? teachingStats.rating : '—'}
                  </p>
                  <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wide">Avg Rating</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Left 2/3 */}
              <div className="lg:col-span-2 flex flex-col gap-6">

                {/* Upcoming sessions */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-blue-600" />
                      <h2 className="font-black text-gray-900">Upcoming Sessions</h2>
                    </div>
                    <Link to="/lessons" className="text-sm font-bold text-blue-600 hover:text-blue-700">View all →</Link>
                  </div>
                  {fetchingTeaching ? (
                    <div className="px-6 py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
                  ) : upcomingSessions.length === 0 ? (
                    <div className="px-6 py-12 flex flex-col items-center gap-2 text-center">
                      <Calendar className="w-10 h-10 text-gray-200" />
                      <p className="text-gray-400 font-bold">No upcoming sessions</p>
                      <p className="text-gray-400 text-sm font-medium">Accepted bookings with a scheduled time will appear here.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {upcomingSessions.map(s => (
                        <div key={s.id} className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                              <User className="w-5 h-5 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-gray-900 truncate">{s.subject}</p>
                              <p className="text-sm text-gray-500 font-medium">with {s.student_name}</p>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <p className="text-sm font-bold text-blue-600 whitespace-nowrap hidden sm:block">{formatDate(s.scheduled_at)}</p>
                              {writingNoteFor !== s.id && (
                                <button
                                  onClick={() => { setNoteContent(upcomingNoteMap[s.id] ?? ''); setWritingNoteFor(s.id) }}
                                  className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-xs font-bold transition-colors"
                                >
                                  <StickyNote className="w-3.5 h-3.5" />
                                  {upcomingNoteMap[s.id] ? 'Note' : 'Add note'}
                                </button>
                              )}
                            </div>
                          </div>
                          {upcomingNoteMap[s.id] && writingNoteFor !== s.id && (
                            <div className="mt-2 ml-14 bg-blue-50 rounded-lg px-3 py-2">
                              <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-0.5">Your note</p>
                              <p className="text-xs text-gray-700 font-medium leading-relaxed">{upcomingNoteMap[s.id]}</p>
                            </div>
                          )}
                          {writingNoteFor === s.id && (
                            <div className="mt-2 ml-14 flex flex-col gap-2">
                              <textarea
                                value={noteContent}
                                onChange={e => setNoteContent(e.target.value)}
                                placeholder="Pre-session notes, topics to cover, materials to prepare…"
                                rows={2}
                                autoFocus
                                className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm font-medium text-gray-800 bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                              />
                              <div className="flex items-center gap-2 justify-end">
                                <button
                                  onClick={() => { setWritingNoteFor(null); setNoteContent('') }}
                                  className="text-xs font-bold text-gray-400 hover:text-gray-600 px-2 py-1 rounded transition-colors"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleSaveNote(s.id)}
                                  disabled={savingNote || !noteContent.trim()}
                                  className="flex items-center gap-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                                >
                                  {savingNote && <Loader2 className="w-3 h-3 animate-spin" />}
                                  Save
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Pending requests */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-500" />
                      <h2 className="font-black text-gray-900">Pending Requests</h2>
                      {pendingBookings.length > 0 && (
                        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
                          {pendingBookings.length}
                        </span>
                      )}
                    </div>
                    <Link to="/lessons" className="text-sm font-bold text-blue-600 hover:text-blue-700">Manage →</Link>
                  </div>
                  {fetchingTeaching ? (
                    <div className="px-6 py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
                  ) : pendingBookings.length === 0 ? (
                    <div className="px-6 py-12 flex flex-col items-center gap-2 text-center">
                      <CheckCircle className="w-10 h-10 text-gray-200" />
                      <p className="text-gray-400 font-bold">All caught up!</p>
                      <p className="text-gray-400 text-sm font-medium">No pending requests right now.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {pendingBookings.map(b => (
                        <div key={b.id} className="flex items-start gap-4 px-6 py-4">
                          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                            <User className="w-5 h-5 text-gray-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-gray-900">{b.student_name}</p>
                            <p className="text-sm text-gray-600 font-medium">wants help with <span className="font-bold">{b.subject}</span></p>
                            {b.message && (
                              <p className="text-sm text-gray-500 mt-1 line-clamp-2 italic">"{b.message}"</p>
                            )}
                            <p className="text-xs text-gray-400 font-medium mt-1">{timeAgo(b.created_at)}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 mt-0.5">
                            <button
                              onClick={() => handleAccept(b)}
                              disabled={acceptingId === b.id || decliningId === b.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 transition-colors disabled:opacity-60"
                            >
                              {acceptingId === b.id
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : <Check    className="w-3 h-3" />}
                              Accept
                            </button>
                            <button
                              onClick={() => handleDecline(b)}
                              disabled={acceptingId === b.id || decliningId === b.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors disabled:opacity-60"
                            >
                              {decliningId === b.id
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : <XCircle  className="w-3 h-3" />}
                              Decline
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* My Students */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-purple-600" />
                      <h2 className="font-black text-gray-900">My Students</h2>
                      {students.length > 0 && (
                        <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs font-bold rounded-full">
                          {students.length}
                        </span>
                      )}
                    </div>
                  </div>
                  {fetchingTeaching ? (
                    <div className="px-6 py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
                  ) : students.length === 0 ? (
                    <div className="px-6 py-12 flex flex-col items-center gap-2 text-center">
                      <Users className="w-10 h-10 text-gray-200" />
                      <p className="text-gray-400 font-bold">No students yet</p>
                      <p className="text-gray-400 text-sm font-medium">Students from accepted and completed bookings will appear here.</p>
                    </div>
                  ) : (
                    <div>
                      {students.map(s => (
                        <div key={s.id} className="border-b border-gray-50 last:border-b-0">
                          <div className="flex items-center gap-4 px-6 py-3.5">
                            <button
                              type="button"
                              onClick={() => navigate(`/my-students/${s.id}`)}
                              className="flex items-center gap-4 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
                            >
                              <Avatar name={s.name} url={s.avatar_url} />
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-gray-900 truncate hover:text-blue-600 transition-colors">{s.name}</p>
                                {s.subjects.length > 0 && (
                                  <p className="text-sm text-gray-500 font-medium truncate">{s.subjects.join(', ')}</p>
                                )}
                                {s.last_session && (
                                  <p className="text-xs text-gray-400 font-medium mt-0.5">Last: {timeAgo(s.last_session)}</p>
                                )}
                                {s.goals.length > 0 && (
                                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                                    <Target className="w-3 h-3 text-indigo-400 shrink-0" />
                                    {s.goals.map(g => (
                                      <span key={g.id} className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded-full truncate max-w-[160px]">
                                        {g.title}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </button>
                            <div className="flex items-center gap-3 shrink-0">
                              {s.goals.length > 0 && (
                                <button
                                  onClick={() => openMilestone(s.id)}
                                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition-colors ${
                                    milestoneStudentId === s.id
                                      ? 'bg-indigo-600 text-white'
                                      : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                                  }`}
                                  title="Mark a milestone toward this student's goal"
                                >
                                  <Flag className="w-3 h-3" />
                                  Milestone
                                </button>
                              )}
                              <div className="text-right">
                                <p className="text-lg font-black text-purple-600">{s.total_sessions}</p>
                                <p className="text-[10px] text-gray-400 font-medium leading-none">
                                  {s.total_sessions === 1 ? 'session' : 'sessions'}
                                </p>
                              </div>
                            </div>
                          </div>
                          {milestoneStudentId === s.id && (
                            <div className="px-6 pb-4 bg-indigo-50/40 border-t border-indigo-100">
                              {loadingGoals ? (
                                <div className="py-3 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-indigo-400" /></div>
                              ) : studentGoals.length === 0 ? (
                                <p className="text-xs text-gray-400 font-medium py-3 italic">This student hasn't set any learning goals yet.</p>
                              ) : (
                                <div className="pt-3 flex flex-col gap-2">
                                  <select
                                    value={selectedGoalId}
                                    onChange={e => setSelectedGoalId(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                  >
                                    <option value="">Select goal…</option>
                                    {studentGoals.map(g => (
                                      <option key={g.id} value={g.id}>
                                        {g.title}{g.subject ? ` (${g.subject})` : ''}
                                      </option>
                                    ))}
                                  </select>
                                  <div className="flex gap-2">
                                    <input
                                      type="text"
                                      value={milestoneText}
                                      onChange={e => setMilestoneText(e.target.value)}
                                      onKeyDown={e => e.key === 'Enter' && saveMilestone()}
                                      placeholder="Milestone reached (e.g. Mastered quadratic equations)"
                                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                    />
                                    <button
                                      onClick={saveMilestone}
                                      disabled={savingMilestone || !selectedGoalId || !milestoneText.trim()}
                                      className="flex items-center gap-1 px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors disabled:opacity-60 shrink-0"
                                    >
                                      {savingMilestone ? <Loader2 className="w-3 h-3 animate-spin" /> : <Flag className="w-3 h-3" />}
                                      Mark
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

              {/* Right 1/3 */}
              <div className="flex flex-col gap-6">

                {/* Recent reviews */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <Star className="w-4 h-4 text-amber-500" />
                      <h2 className="font-black text-gray-900 text-sm">Recent Reviews</h2>
                    </div>
                    <Link to="/my-reviews" className="text-xs font-bold text-blue-600 hover:text-blue-700">All →</Link>
                  </div>
                  {fetchingTeaching ? (
                    <div className="px-5 py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
                  ) : reviews.length === 0 ? (
                    <div className="px-5 py-8 text-center">
                      <p className="text-gray-400 font-medium text-sm">No reviews yet.</p>
                      <p className="text-gray-400 text-xs mt-1">Reviews appear after students rate completed sessions.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {reviews.map(r => (
                        <div key={r.id} className="px-5 py-4">
                          <div className="flex items-center justify-between mb-1.5">
                            <p className="text-sm font-bold text-gray-900">{r.student_name}</p>
                            <Stars rating={r.rating} />
                          </div>
                          {r.body && (
                            <p className="text-xs text-gray-500 font-medium line-clamp-2 leading-relaxed">{r.body}</p>
                          )}
                          <p className="text-[10px] text-gray-400 mt-1.5">{timeAgo(r.created_at)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quick actions */}
                <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl p-5 text-white">
                  <p className="font-black text-xs mb-4 text-blue-200 uppercase tracking-widest">Quick Actions</p>
                  <div className="flex flex-col gap-3">
                    <Link to="/my-profile"  className="flex items-center gap-2.5 text-sm font-bold hover:text-blue-200 transition-colors">
                      <User          className="w-4 h-4 shrink-0" /> Edit My Profile
                    </Link>
                    <Link to="/lessons"     className="flex items-center gap-2.5 text-sm font-bold hover:text-blue-200 transition-colors">
                      <BookOpen      className="w-4 h-4 shrink-0" /> Manage Lessons
                    </Link>
                    <Link to="/my-reviews"  className="flex items-center gap-2.5 text-sm font-bold hover:text-blue-200 transition-colors">
                      <Star          className="w-4 h-4 shrink-0" /> My Reviews
                    </Link>
                    <Link to="/search"      className="flex items-center gap-2.5 text-sm font-bold hover:text-blue-200 transition-colors">
                      <Search        className="w-4 h-4 shrink-0" /> Browse Instructors
                    </Link>
                    <button
                      onClick={() => setTab('learning')}
                      className="flex items-center gap-2.5 text-sm font-bold hover:text-blue-200 transition-colors text-left"
                    >
                      <BookOpen      className="w-4 h-4 shrink-0" /> Switch to Learning
                    </button>
                  </div>
                </div>

              </div>
            </div>
          </>
        )}

        {/* ━━━━ LEARNING TAB ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {tab === 'learning' && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-8">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 sm:p-5 flex flex-col sm:flex-row items-center gap-1.5 sm:gap-4 text-center sm:text-left">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-black text-gray-900">{studentStats.upcoming}</p>
                  <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wide">Upcoming</p>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 sm:p-5 flex flex-col sm:flex-row items-center gap-1.5 sm:gap-4 text-center sm:text-left">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-black text-gray-900">{studentStats.pending}</p>
                  <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wide">Pending</p>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 sm:p-5 flex flex-col sm:flex-row items-center gap-1.5 sm:gap-4 text-center sm:text-left">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-black text-gray-900">{studentStats.completed}</p>
                  <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wide">Completed</p>
                </div>
              </div>
            </div>

            {fetchingLearning ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left 2/3 */}
                <div className="lg:col-span-2 flex flex-col gap-6">

                  {/* Upcoming lessons as student */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-blue-600" />
                        <h2 className="font-black text-gray-900">My Upcoming Lessons</h2>
                      </div>
                      <Link to="/lessons" className="text-sm font-bold text-blue-600 hover:text-blue-700">View all →</Link>
                    </div>
                    {upcomingLessons.length === 0 ? (
                      <div className="px-6 py-12 flex flex-col items-center gap-3 text-center">
                        <Calendar className="w-10 h-10 text-gray-200" />
                        <p className="text-gray-400 font-bold">No upcoming lessons</p>
                        <Link to="/search" className="text-sm font-bold text-blue-600 hover:underline">Find an instructor →</Link>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-50">
                        {upcomingLessons.map(l => (
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

                  {/* Recent activity */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
                      <TrendingUp className="w-4 h-4 text-purple-600" />
                      <h2 className="font-black text-gray-900">Recent Activity</h2>
                    </div>
                    {activity.length === 0 ? (
                      <div className="px-6 py-10 text-center">
                        <p className="text-gray-400 font-medium text-sm">No activity yet.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-50">
                        {activity.map(a => {
                          const icon =
                            a.type === 'accepted' ? <CheckCircle className="w-3.5 h-3.5 text-green-600" /> :
                            a.type === 'declined' ? <XCircle     className="w-3.5 h-3.5 text-red-500"   /> :
                                                    <Ban         className="w-3.5 h-3.5 text-gray-400"  />
                          const ring = a.type === 'accepted' ? 'bg-green-100' : a.type === 'declined' ? 'bg-red-100' : 'bg-gray-100'
                          const label =
                            a.type === 'accepted' ? `${a.tutor_name} accepted your ${a.subject} request` :
                            a.type === 'declined' ? `${a.tutor_name} declined your ${a.subject} request` :
                                                    `Your ${a.subject} session was cancelled`
                          return (
                            <div key={a.id} className="flex items-start gap-3 px-6 py-3.5">
                              <div className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${ring}`}>{icon}</div>
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

                  {/* My Instructors */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <GraduationCap className="w-4 h-4 text-blue-600" />
                        <h2 className="font-black text-gray-900">My Instructors</h2>
                        {usedInstructors.length > 0 && (
                          <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
                            {usedInstructors.length}
                          </span>
                        )}
                      </div>
                      <Link to="/search" className="text-sm font-bold text-blue-600 hover:text-blue-700">Find more →</Link>
                    </div>
                    {usedInstructors.length === 0 ? (
                      <div className="px-6 py-12 flex flex-col items-center gap-2 text-center">
                        <GraduationCap className="w-10 h-10 text-gray-200" />
                        <p className="text-gray-400 font-bold">No instructors yet</p>
                        <Link to="/search" className="text-sm font-bold text-blue-600 hover:underline">Find an instructor →</Link>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-50">
                        {usedInstructors.map(t => (
                          <Link key={t.id} to={`/tutor/${t.id}`} className="flex items-center gap-4 px-6 py-3.5 hover:bg-gray-50 transition-colors group">
                            <Avatar name={t.name} url={t.avatar_url} />
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-gray-900 truncate">{t.name}</p>
                              {t.subjects.length > 0 && (
                                <p className="text-sm text-gray-500 font-medium truncate">{t.subjects.join(', ')}</p>
                              )}
                              {t.last_session && (
                                <p className="text-xs text-gray-400 font-medium mt-0.5">Last: {timeAgo(t.last_session)}</p>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-lg font-black text-blue-600">{t.total_sessions}</p>
                              <p className="text-[10px] text-gray-400 font-medium leading-none">
                                {t.total_sessions === 1 ? 'session' : 'sessions'}
                              </p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>

                </div>

                {/* Right 1/3 */}
                <div className="flex flex-col gap-6">

                  {/* Pending as student */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-500" />
                        <h2 className="font-black text-gray-900 text-sm">Pending Requests</h2>
                        {studentPending.length > 0 && (
                          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
                            {studentPending.length}
                          </span>
                        )}
                      </div>
                      <Link to="/lessons" className="text-xs font-bold text-blue-600 hover:text-blue-700">All →</Link>
                    </div>
                    {studentPending.length === 0 ? (
                      <div className="px-5 py-8 text-center">
                        <p className="text-gray-400 font-medium text-sm">No pending requests.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-50">
                        {studentPending.map(p => (
                          <Link key={p.id} to={`/tutor/${p.tutor_id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors">
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
                    </div>
                    {savedTutors.length === 0 ? (
                      <div className="px-5 py-8 text-center space-y-1">
                        <p className="text-gray-400 font-medium text-sm">No saved instructors yet.</p>
                        <Link to="/search" className="text-xs font-bold text-blue-600 hover:underline block">Browse instructors →</Link>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-50">
                        {savedTutors.map(t => (
                          <Link key={t.tutor_id} to={`/tutor/${t.tutor_id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors group">
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

                  {/* My Learning Goals */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <Target className="w-4 h-4 text-indigo-600" />
                        <h2 className="font-black text-gray-900 text-sm">My Goals</h2>
                        {learningGoals.length > 0 && (
                          <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full">
                            {learningGoals.length}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => setAddingLearningGoal(v => !v)}
                        className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
                      >
                        {addingLearningGoal ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                        {addingLearningGoal ? 'Cancel' : 'Add'}
                      </button>
                    </div>

                    {addingLearningGoal && (
                      <div className="px-5 py-4 border-b border-gray-50 bg-indigo-50/40 flex flex-col gap-2">
                        <input
                          type="text"
                          value={learningGoalTitle}
                          onChange={e => setLearningGoalTitle(e.target.value)}
                          placeholder="Goal (e.g. Pass SAT Math by May)"
                          autoFocus
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={learningGoalSubject}
                            onChange={e => setLearningGoalSubject(e.target.value)}
                            placeholder="Subject (optional)"
                            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          />
                          <input
                            type="date"
                            value={learningGoalDate}
                            onChange={e => setLearningGoalDate(e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          />
                        </div>
                        <button
                          onClick={handleAddLearningGoal}
                          disabled={savingLearningGoal || !learningGoalTitle.trim()}
                          className="w-full py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
                        >
                          {savingLearningGoal && <Loader2 className="w-3 h-3 animate-spin" />}
                          Save Goal
                        </button>
                      </div>
                    )}

                    {learningGoals.length === 0 ? (
                      <div className="px-5 py-8 text-center">
                        <p className="text-gray-400 font-medium text-sm">No active goals yet.</p>
                        <p className="text-gray-400 text-xs mt-1">Set a goal and your instructor can mark progress.</p>
                      </div>
                    ) : (
                      <div>
                        {learningGoals.map(g => (
                          <div key={g.id} className="border-b border-gray-50 last:border-b-0">
                            <button
                              onClick={() => handleExpandLearningGoal(g.id)}
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
                              {confirmLearningGoalId === g.id ? (
                                <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                                  <span className="text-[10px] font-semibold text-gray-500 whitespace-nowrap">Done?</span>
                                  <button
                                    onClick={() => { handleCompleteLearningGoal(g.id); setConfirmLearningGoalId(null) }}
                                    className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center hover:bg-green-600 transition-colors"
                                    title="Confirm complete"
                                  >
                                    <CheckCircle className="w-3.5 h-3.5 text-white" />
                                  </button>
                                  <button
                                    onClick={() => setConfirmLearningGoalId(null)}
                                    className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300 transition-colors"
                                    title="Cancel"
                                  >
                                    <X className="w-3.5 h-3.5 text-gray-500" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={e => { e.stopPropagation(); setConfirmLearningGoalId(g.id) }}
                                  className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center shrink-0 hover:bg-green-200 transition-colors"
                                  title="Mark complete"
                                >
                                  <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                                </button>
                              )}
                            </button>
                            {expandedLearningGoal === g.id && (
                              <div className="px-5 pb-3 bg-gray-50/50">
                                {loadingLearningMs === g.id ? (
                                  <div className="py-3 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-gray-300" /></div>
                                ) : (learningGoalMilestones[g.id] ?? []).length === 0 ? (
                                  <p className="text-[11px] text-gray-400 font-medium py-2 italic">No milestones yet — your instructor can mark progress here.</p>
                                ) : (
                                  <div className="space-y-2 pt-2">
                                    {(learningGoalMilestones[g.id] ?? []).map(m => (
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
                  <div className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl p-5 text-white">
                    <p className="font-black text-xs mb-4 text-purple-200 uppercase tracking-widest">Quick Actions</p>
                    <div className="flex flex-col gap-3">
                      <Link to="/search" className="flex items-center gap-2.5 text-sm font-bold hover:text-purple-200 transition-colors">
                        <Search    className="w-4 h-4 shrink-0" /> Find an Instructor
                      </Link>
                      <Link to="/lessons" className="flex items-center gap-2.5 text-sm font-bold hover:text-purple-200 transition-colors">
                        <BookOpen  className="w-4 h-4 shrink-0" /> My Lessons
                      </Link>
                      <Link to="/needed-courses" className="flex items-center gap-2.5 text-sm font-bold hover:text-purple-200 transition-colors">
                        <Lightbulb className="w-4 h-4 shrink-0" /> Request a Course
                      </Link>
                      <button
                        onClick={() => setTab('teaching')}
                        className="flex items-center gap-2.5 text-sm font-bold hover:text-purple-200 transition-colors text-left"
                      >
                        <GraduationCap className="w-4 h-4 shrink-0" /> Switch to Teaching
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
