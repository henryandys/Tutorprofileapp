import { useState, useEffect, useRef } from "react"
import { Link, useParams, Navigate } from "react-router"
import { Navbar } from "../components/Navbar"
import { useAuth } from "../../context/AuthContext"
import { supabase } from "../../lib/supabase"
import { toast } from "sonner"
import {
  ArrowLeft, Calendar, CheckCircle, Target, Flag, MessageCircle,
  StickyNote, PenLine, Loader2, ChevronDown, ChevronUp, Send, X,
} from "lucide-react"
import { markConversationRead } from "../components/NotificationsPanel"

interface StudentProfile {
  id: string
  full_name: string | null
  avatar_url: string | null
}

interface Booking {
  id: string
  subject: string
  status: string
  scheduled_at: string | null
  message: string | null
  created_at: string
}

interface SessionNote {
  booking_id:  string
  user_id:     string
  content:     string
  author_name: string
  updated_at:  string
}

interface Goal {
  id: string
  title: string
  subject: string | null
  target_date: string | null
  status: 'active' | 'completed' | 'paused'
  created_at: string
}

interface Milestone {
  id: string
  goal_id: string
  title: string
  created_at: string
  marker_name: string | null
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    return (
      <img
        src={url} alt={name}
        className="w-16 h-16 rounded-2xl object-cover shrink-0 bg-gray-100"
        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
      />
    )
  }
  return (
    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center shrink-0">
      <span className="text-white font-black text-2xl select-none">{name.charAt(0).toUpperCase()}</span>
    </div>
  )
}

function SmAvatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    return (
      <img
        src={url} alt={name}
        className="w-9 h-9 rounded-xl object-cover shrink-0 bg-gray-100"
        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
      />
    )
  }
  return (
    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center shrink-0">
      <span className="text-white font-black text-sm select-none">{name.charAt(0).toUpperCase()}</span>
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
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function StudentDetail() {
  const { id: studentId } = useParams<{ id: string }>()
  const { user, profile, role, loading } = useAuth()

  const [student,   setStudent]   = useState<StudentProfile | null>(null)
  const [bookings,  setBookings]  = useState<Booking[]>([])
  const [notes,     setNotes]     = useState<SessionNote[]>([])
  const [goals,     setGoals]     = useState<Goal[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [msgCounts, setMsgCounts] = useState<Record<string, number>>({})
  const [fetching,  setFetching]  = useState(true)

  // Note editing
  const [writingNoteFor, setWritingNoteFor] = useState<string | null>(null)
  const [noteContent,    setNoteContent]    = useState('')
  const [savingNote,     setSavingNote]     = useState(false)

  // Session history toggle
  const [historyOpen, setHistoryOpen] = useState(false)

  // Milestone panel
  const [milestonePanelGoalId, setMilestonePanelGoalId] = useState<string | null>(null)
  const [milestoneText,        setMilestoneText]        = useState('')
  const [savingMilestone,      setSavingMilestone]      = useState(false)

  // Unified messages panel
  const [showMessages, setShowMessages] = useState(false)
  const [allMessages,  setAllMessages]  = useState<{ id: string; booking_id: string; sender_id: string; body: string; created_at: string }[]>([])
  const [loadingMsgs,  setLoadingMsgs]  = useState(false)
  const [msgBody,      setMsgBody]      = useState('')
  const [sendingMsg,   setSendingMsg]   = useState(false)
  const [senderNames,  setSenderNames]  = useState<Record<string, string>>({})
  const msgBottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user || !studentId) return
    load()
  }, [user, studentId])

  async function openMessages() {
    setShowMessages(true)
    setLoadingMsgs(true)
    const ids = bookings.map(b => b.id)
    if (user) ids.forEach(bid => markConversationRead(user.id, bid))
    if (ids.length === 0) { setLoadingMsgs(false); return }
    const { data } = await supabase
      .from('messages')
      .select('id, booking_id, sender_id, body, created_at')
      .in('booking_id', ids)
      .order('created_at', { ascending: true })
    const msgs = data ?? []
    setAllMessages(msgs)
    // Fetch display names for every unique sender
    const uniqueIds = [...new Set(msgs.map(m => m.sender_id))]
    if (uniqueIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', uniqueIds)
      const names: Record<string, string> = {}
      for (const p of profiles ?? []) names[p.id] = p.full_name ?? 'Unknown'
      setSenderNames(names)
    }
    setLoadingMsgs(false)
    setTimeout(() => msgBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  // Realtime for open messages panel — subscribe to each active booking
  useEffect(() => {
    if (!showMessages || bookings.length === 0) return
    const activeIds = bookings
      .filter(b => ['accepted', 'pending'].includes(b.status))
      .map(b => b.id)
    if (activeIds.length === 0) return
    const channels = activeIds.map(bid =>
      supabase
        .channel(`student-detail-msg-${bid}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `booking_id=eq.${bid}` },
          payload => {
            const msg = payload.new as { id: string; booking_id: string; sender_id: string; body: string; created_at: string }
            setAllMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
            setTimeout(() => msgBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
            setSenderNames(prev => {
              if (prev[msg.sender_id]) return prev
              supabase.from('profiles').select('id, full_name').eq('id', msg.sender_id).single()
                .then(({ data: p }) => {
                  if (p) setSenderNames(n => ({ ...n, [p.id]: p.full_name ?? 'Unknown' }))
                })
              return prev
            })
          }
        )
        .subscribe()
    )
    return () => { channels.forEach(c => supabase.removeChannel(c)) }
  }, [showMessages, bookings])

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!msgBody.trim() || !user) return
    const target = bookings.find(b => b.status === 'accepted')
      ?? bookings.find(b => b.status === 'pending')
      ?? bookings[0]
    if (!target) return
    setSendingMsg(true)
    const { error } = await supabase.from('messages').insert({
      booking_id: target.id,
      sender_id:  user.id,
      body:       msgBody.trim(),
    })
    if (error) { toast.error('Failed to send: ' + error.message) }
    else { setMsgBody('') }
    setSendingMsg(false)
  }

  async function load() {
    if (!user || !studentId) return
    setFetching(true)

    const [profileRes, bookingsRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, avatar_url').eq('id', studentId).single(),
      supabase
        .from('bookings')
        .select('id, subject, status, scheduled_at, message, created_at')
        .eq('tutor_id', user.id)
        .eq('student_id', studentId)
        .order('scheduled_at', { ascending: false }),
    ])

    if (profileRes.error || !profileRes.data) {
      setFetching(false)
      return
    }
    setStudent(profileRes.data)

    const bk = (bookingsRes.data ?? []) as Booking[]
    setBookings(bk)

    const bookingIds = bk.map(b => b.id)
    if (bookingIds.length === 0) { setFetching(false); return }

    const [notesRes, goalsRes, messagesRes] = await Promise.all([
      supabase
        .from('session_notes')
        .select('booking_id, user_id, content, updated_at')
        .in('booking_id', bookingIds),
      supabase
        .from('learning_goals')
        .select('id, title, subject, target_date, status, created_at')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false }),
      supabase
        .from('messages')
        .select('booking_id, id')
        .in('booking_id', bookingIds),
    ])

    const noteRows = (notesRes.data ?? []) as { booking_id: string; user_id: string; content: string; updated_at: string }[]
    const authorIds = [...new Set(noteRows.map(n => n.user_id))]
    const { data: authorProfiles } = authorIds.length > 0
      ? await supabase.from('profiles').select('id, full_name').in('id', authorIds)
      : { data: [] }
    const nameMap: Record<string, string> = {}
    for (const p of authorProfiles ?? []) nameMap[(p as any).id] = (p as any).full_name ?? 'Unknown'
    setNotes(noteRows.map(n => ({ ...n, author_name: nameMap[n.user_id] ?? 'Unknown' })))

    const rawGoals = (goalsRes.data ?? []) as Goal[]
    setGoals(rawGoals)

    const counts: Record<string, number> = {}
    for (const m of (messagesRes.data ?? []) as { booking_id: string; id: string }[]) {
      counts[m.booking_id] = (counts[m.booking_id] ?? 0) + 1
    }
    setMsgCounts(counts)

    if (rawGoals.length > 0) {
      const goalIds = rawGoals.map(g => g.id)
      const { data: msData } = await supabase
        .from('goal_milestones')
        .select('id, goal_id, title, created_at, marker:marked_by(full_name)')
        .in('goal_id', goalIds)
        .order('created_at', { ascending: false })
      setMilestones(
        (msData ?? []).map((m: any) => ({
          id:          m.id,
          goal_id:     m.goal_id,
          title:       m.title,
          created_at:  m.created_at,
          marker_name: m.marker?.full_name ?? null,
        }))
      )
    }

    setFetching(false)
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
    const authorName = profile?.full_name ?? 'You'
    setNotes(prev => {
      const existing = prev.find(n => n.booking_id === bookingId && n.user_id === user!.id)
      if (existing) return prev.map(n => n.booking_id === bookingId && n.user_id === user!.id ? { ...n, content: noteContent.trim(), updated_at: new Date().toISOString() } : n)
      return [{ booking_id: bookingId, user_id: user!.id, content: noteContent.trim(), author_name: authorName, updated_at: new Date().toISOString() }, ...prev]
    })
    setWritingNoteFor(null)
    setNoteContent('')
    setSavingNote(false)
    toast.success('Note saved!')
  }

  async function saveMilestone(goalId: string) {
    if (!milestoneText.trim()) return
    setSavingMilestone(true)
    const { data, error } = await supabase
      .from('goal_milestones')
      .insert({ goal_id: goalId, marked_by: user!.id, title: milestoneText.trim() })
      .select('id, goal_id, title, created_at')
      .single()
    if (error) { toast.error('Failed to save milestone.'); setSavingMilestone(false); return }
    setMilestones(prev => [{
      id: data.id, goal_id: data.goal_id, title: data.title,
      created_at: data.created_at, marker_name: profile?.full_name ?? null,
    }, ...prev])
    setMilestoneText('')
    setMilestonePanelGoalId(null)
    setSavingMilestone(false)
    toast.success('Milestone marked!')
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  )
  if (role !== 'tutor') return <Navigate to="/dashboard" replace />
  if (!studentId) return <Navigate to="/instructor-dashboard" replace />

  const now = new Date().toISOString()
  const upcoming  = bookings.filter(b => b.status === 'accepted' && b.scheduled_at && b.scheduled_at >= now)
  const completed = bookings.filter(b => b.status === 'completed')
  const pending   = bookings.filter(b => b.status === 'pending')
  const history   = bookings.filter(b => ['completed', 'accepted', 'declined', 'cancelled'].includes(b.status))
  const subjects  = [...new Set(bookings.filter(b => ['accepted', 'completed'].includes(b.status)).map(b => b.subject))]
  const lastSession = bookings.filter(b => b.scheduled_at && ['accepted', 'completed'].includes(b.status))
    .reduce((latest: string | null, b) => (!latest || (b.scheduled_at! > latest)) ? b.scheduled_at : latest, null)
  const notesMap: Record<string, SessionNote[]> = {}
  for (const n of notes) { (notesMap[n.booking_id] ??= []).push(n) }
  const myNote = (bookingId: string) => notesMap[bookingId]?.find(n => n.user_id === user?.id)
  const goalsWithMs = goals.map(g => ({ ...g, milestones: milestones.filter(m => m.goal_id === g.id) }))
  const activeGoals    = goalsWithMs.filter(g => g.status === 'active')
  const completedGoals = goalsWithMs.filter(g => g.status === 'completed')
  const bookingsWithMsgs = bookings.filter(b => (msgCounts[b.id] ?? 0) > 0)

  const studentName = student?.full_name ?? 'Student'

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 md:px-8 py-8">

        {/* Back */}
        <Link
          to="/instructor-dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-500 hover:text-gray-800 transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        {fetching ? (
          <div className="flex justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
          </div>
        ) : !student ? (
          <div className="text-center py-24 text-gray-400 font-medium">Student not found.</div>
        ) : (
          <>
            {/* ── Hero ─────────────────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6 flex flex-wrap items-start gap-4 sm:gap-5">
              <Avatar name={studentName} url={student.avatar_url} />
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-black text-gray-900">{studentName}</h1>
                {subjects.length > 0 && (
                  <p className="text-sm font-medium text-gray-500 mt-0.5">{subjects.join(' · ')}</p>
                )}
                {lastSession && (
                  <p className="text-xs text-gray-400 font-medium mt-1">Last session: {timeAgo(lastSession)}</p>
                )}
              </div>
              {/* Stats — full-width row on mobile, inline on sm+ */}
              <div className="w-full sm:w-auto flex items-center justify-around sm:justify-end gap-6 sm:gap-4 sm:shrink-0 border-t border-gray-100 pt-3 sm:border-t-0 sm:pt-0">
                <div className="text-center">
                  <p className="text-2xl font-black text-blue-600">{upcoming.length}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Upcoming</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-black text-green-600">{completed.length}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Completed</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-black text-amber-500">{pending.length}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Pending</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Left 2/3 */}
              <div className="lg:col-span-2 flex flex-col gap-6">

                {/* Upcoming sessions */}
                {upcoming.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
                      <Calendar className="w-4 h-4 text-blue-600" />
                      <h2 className="font-black text-gray-900">Upcoming Sessions</h2>
                      <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">{upcoming.length}</span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {upcoming.map(b => {
                        const ownNote   = myNote(b.id)
                        const isWriting = writingNoteFor === b.id
                        return (
                          <div key={b.id} className="px-6 py-4">
                            <div className="flex items-center gap-4">
                              <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                                <Calendar className="w-4 h-4 text-blue-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-gray-900">{b.subject}</p>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <p className="text-sm font-bold text-blue-600 whitespace-nowrap hidden sm:block">{formatDate(b.scheduled_at!)}</p>
                                {!isWriting && (
                                  <button
                                    onClick={() => { setWritingNoteFor(b.id); setNoteContent(ownNote?.content ?? '') }}
                                    className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-xs font-bold transition-colors"
                                  >
                                    <StickyNote className="w-3.5 h-3.5" />
                                    {ownNote ? 'Note' : 'Add note'}
                                  </button>
                                )}
                              </div>
                            </div>
                            {ownNote && !isWriting && (
                              <div className="mt-2 ml-13 bg-blue-50 rounded-lg px-3 py-2">
                                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-0.5">Your note</p>
                                <p className="text-xs text-gray-700 font-medium leading-relaxed">{ownNote.content}</p>
                              </div>
                            )}
                            {isWriting && (
                              <div className="mt-2 ml-13 flex flex-col gap-2">
                                <textarea
                                  value={noteContent}
                                  onChange={e => setNoteContent(e.target.value)}
                                  placeholder="Pre-session notes, topics to cover, homework to review…"
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
                                    onClick={() => handleSaveNote(b.id)}
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
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Learning Goals */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
                    <Target className="w-4 h-4 text-indigo-600" />
                    <h2 className="font-black text-gray-900">Learning Goals</h2>
                    {goals.length > 0 && (
                      <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full">{goals.length}</span>
                    )}
                  </div>
                  {goals.length === 0 ? (
                    <div className="px-6 py-10 text-center">
                      <Target className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                      <p className="text-sm text-gray-400 font-medium">{studentName} hasn't set any goals yet.</p>
                      <p className="text-xs text-gray-400 mt-1">Goals are set by the student from their dashboard.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {activeGoals.map(g => (
                        <div key={g.id} className="px-6 py-4">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
                              <Target className="w-4 h-4 text-indigo-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-bold text-gray-900">{g.title}</p>
                                {g.subject && (
                                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded-full">{g.subject}</span>
                                )}
                                {g.target_date && (
                                  <span className="text-[10px] font-bold text-gray-400">
                                    Target: {new Date(g.target_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                  </span>
                                )}
                              </div>

                              {/* Milestones */}
                              {g.milestones.length > 0 && (
                                <div className="mt-2 flex flex-col gap-1">
                                  {g.milestones.map(m => (
                                    <div key={m.id} className="flex items-center gap-2 text-xs text-gray-600">
                                      <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                                      <span className="font-medium">{m.title}</span>
                                      {m.marker_name && (
                                        <span className="text-gray-400">· {m.marker_name}</span>
                                      )}
                                      <span className="text-gray-400">· {timeAgo(m.created_at)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Add milestone */}
                              {milestonePanelGoalId === g.id ? (
                                <div className="mt-3 bg-indigo-50/60 rounded-xl p-3 flex flex-col gap-2 border border-indigo-100">
                                  <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Mark a milestone</p>
                                  <input
                                    type="text"
                                    value={milestoneText}
                                    onChange={e => setMilestoneText(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') saveMilestone(g.id); if (e.key === 'Escape') setMilestonePanelGoalId(null) }}
                                    placeholder="e.g. Mastered quadratic equations, completed chapter 5…"
                                    autoFocus
                                    className="w-full px-3 py-2 border border-indigo-200 rounded-lg text-xs font-medium text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => saveMilestone(g.id)}
                                      disabled={savingMilestone || !milestoneText.trim()}
                                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                                    >
                                      {savingMilestone ? <Loader2 className="w-3 h-3 animate-spin" /> : <Flag className="w-3 h-3" />}
                                      Save milestone
                                    </button>
                                    <button
                                      onClick={() => setMilestonePanelGoalId(null)}
                                      className="px-3 py-1.5 border border-gray-200 text-gray-500 rounded-lg text-xs font-bold hover:bg-gray-50 transition-colors"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => { setMilestonePanelGoalId(g.id); setMilestoneText('') }}
                                  className="mt-2.5 flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-xs font-bold transition-colors"
                                >
                                  <Flag className="w-3 h-3" />
                                  Mark milestone
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      {completedGoals.length > 0 && (
                        <div className="px-6 py-3">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Completed goals</p>
                          <div className="flex flex-col gap-1.5">
                            {completedGoals.map(g => (
                              <div key={g.id} className="flex items-center gap-2 text-sm text-gray-400">
                                <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                                <span className="font-medium line-through">{g.title}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Session History + Notes */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <button
                    onClick={() => setHistoryOpen(o => !o)}
                    className="w-full flex items-center justify-between px-6 py-4 border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <StickyNote className="w-4 h-4 text-blue-500" />
                      <h2 className="font-black text-gray-900">Session History &amp; Notes</h2>
                      <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">{history.length}</span>
                    </div>
                    {historyOpen
                      ? <ChevronUp   className="w-4 h-4 text-gray-400" />
                      : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </button>
                  {historyOpen && (
                    history.length === 0 ? (
                      <div className="px-6 py-10 text-center">
                        <p className="text-sm text-gray-400 font-medium">No sessions yet.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-50">
                        {history.map(b => {
                          const bookingNotes = notesMap[b.id] ?? []
                          const ownNote = myNote(b.id)
                          const statusColor =
                            b.status === 'completed' ? 'text-green-600 bg-green-50' :
                            b.status === 'accepted'  ? 'text-blue-600 bg-blue-50'   :
                            b.status === 'declined'  ? 'text-red-500 bg-red-50'     :
                                                       'text-gray-500 bg-gray-100'
                          return (
                            <div key={b.id} className="px-6 py-4">
                              <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                                  <Calendar className="w-4 h-4 text-gray-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-bold text-gray-900">{b.subject}</p>
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${statusColor}`}>
                                      {b.status}
                                    </span>
                                    {b.scheduled_at && (
                                      <span className="text-xs text-gray-400 font-medium">
                                        {new Date(b.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                      </span>
                                    )}
                                  </div>

                                  {/* Other participants' notes (read-only) */}
                                  {bookingNotes.filter(n => n.user_id !== user?.id).map(n => (
                                    <div key={n.user_id} className="mt-2 bg-gray-50 rounded-lg px-3 py-2">
                                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{n.author_name}</p>
                                      <p className="text-xs text-gray-600 font-medium leading-relaxed">{n.content}</p>
                                    </div>
                                  ))}

                                  {/* Own note (editable) */}
                                  {writingNoteFor === b.id ? (
                                    <div className="mt-2 flex flex-col gap-2">
                                      <textarea
                                        value={noteContent}
                                        onChange={e => setNoteContent(e.target.value)}
                                        placeholder="What was covered? Homework? Topics for next session…"
                                        rows={3}
                                        autoFocus
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                                      />
                                      <div className="flex gap-2">
                                        <button
                                          onClick={() => { setWritingNoteFor(null); setNoteContent('') }}
                                          disabled={savingNote}
                                          className="px-3 py-1.5 border border-gray-200 text-gray-500 rounded-lg text-xs font-bold hover:bg-gray-50 transition-colors"
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          onClick={() => handleSaveNote(b.id)}
                                          disabled={savingNote}
                                          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 disabled:opacity-60 transition-colors"
                                        >
                                          {savingNote && <Loader2 className="w-3 h-3 animate-spin" />}
                                          Save Note
                                        </button>
                                      </div>
                                    </div>
                                  ) : ownNote ? (
                                    <div className="mt-2 bg-blue-50 rounded-lg px-3 py-2">
                                      <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Your note</p>
                                      <p className="text-xs text-gray-600 font-medium leading-relaxed">{ownNote.content}</p>
                                      <button
                                        onClick={() => { setWritingNoteFor(b.id); setNoteContent(ownNote.content) }}
                                        className="text-[10px] font-bold text-blue-500 hover:text-blue-700 mt-1 flex items-center gap-1"
                                      >
                                        <PenLine className="w-2.5 h-2.5" /> Edit
                                      </button>
                                    </div>
                                  ) : (b.status === 'completed' || b.status === 'accepted') ? (
                                    <button
                                      onClick={() => { setWritingNoteFor(b.id); setNoteContent('') }}
                                      className="mt-1.5 flex items-center gap-1 text-xs font-bold text-amber-600 hover:text-amber-700 transition-colors"
                                    >
                                      <PenLine className="w-3 h-3" /> Add note
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  )}
                </div>

              </div>

              {/* Right 1/3 */}
              <div className="flex flex-col gap-6">

                {/* Messages */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
                    <MessageCircle className="w-4 h-4 text-blue-600" />
                    <h2 className="font-black text-gray-900 text-sm">Messages</h2>
                    {Object.values(msgCounts).reduce((a, b) => a + b, 0) > 0 && (
                      <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
                        {Object.values(msgCounts).reduce((a, b) => a + b, 0)}
                      </span>
                    )}
                  </div>
                  <div className="px-5 py-4">
                    <button
                      onClick={openMessages}
                      className="w-full flex items-center gap-3 px-4 py-3 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors text-left"
                    >
                      <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
                        <MessageCircle className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900">Chat with {studentName}</p>
                        <p className="text-[10px] text-gray-500 font-medium">
                          {Object.values(msgCounts).reduce((a, b) => a + b, 0)} message{Object.values(msgCounts).reduce((a, b) => a + b, 0) !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <span className="text-xs font-bold text-blue-600 shrink-0">Open →</span>
                    </button>
                  </div>
                </div>

                {/* Quick actions */}
                <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl p-5 text-white">
                  <p className="font-black text-xs mb-4 text-blue-200 uppercase tracking-widest">Quick Actions</p>
                  <div className="flex flex-col gap-3">
                    <Link
                      to="/instructor-dashboard"
                      className="flex items-center gap-2.5 text-sm font-bold hover:text-blue-200 transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4 shrink-0" /> Back to Dashboard
                    </Link>
                    <Link
                      to="/lessons"
                      className="flex items-center gap-2.5 text-sm font-bold hover:text-blue-200 transition-colors"
                    >
                      <StickyNote className="w-4 h-4 shrink-0" /> Manage All Lessons
                    </Link>
                  </div>
                </div>

                {/* Session stats */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Session Stats</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-600">Total sessions</span>
                    <span className="text-sm font-black text-gray-900">{bookings.filter(b => ['accepted','completed'].includes(b.status)).length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-600">Notes written</span>
                    <span className="text-sm font-black text-gray-900">{notes.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-600">Active goals</span>
                    <span className="text-sm font-black text-indigo-600">{activeGoals.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-600">Milestones marked</span>
                    <span className="text-sm font-black text-green-600">{milestones.length}</span>
                  </div>
                  {subjects.length > 0 && (
                    <div className="pt-2 border-t border-gray-100">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Subjects</p>
                      <div className="flex flex-wrap gap-1">
                        {subjects.map(s => (
                          <span key={s} className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </div>
          </>
        )}
      </main>

      {showMessages && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden" style={{ height: '72vh' }}>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <div>
                <h3 className="font-black text-gray-900">{studentName}</h3>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">All Messages</p>
              </div>
              <button
                onClick={() => { setShowMessages(false); setMsgBody('') }}
                className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-2">
              {loadingMsgs ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              ) : allMessages.length === 0 ? (
                <p className="text-center text-gray-400 font-medium text-sm py-10">
                  No messages yet — say hello!
                </p>
              ) : (
                allMessages.map(msg => {
                  const isMine    = msg.sender_id === user?.id
                  const isStudent = msg.sender_id === studentId
                  const isGuardian = !isMine && !isStudent
                  const name = isMine
                    ? (profile?.full_name ?? 'You')
                    : (senderNames[msg.sender_id] ?? (isStudent ? studentName : 'Guardian'))
                  const bubble = isMine
                    ? 'bg-blue-600 text-white rounded-br-sm'
                    : isGuardian
                    ? 'bg-green-100 text-green-900 rounded-bl-sm'
                    : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                  const timeColor  = isMine ? 'text-blue-200' : isGuardian ? 'text-green-500' : 'text-gray-400'
                  const nameColor  = isMine ? 'text-blue-500' : isGuardian ? 'text-green-600' : 'text-gray-400'
                  return (
                    <div key={msg.id} className={`flex flex-col gap-0.5 ${isMine ? 'items-end' : 'items-start'}`}>
                      <p className={`text-[10px] font-bold px-1 ${nameColor}`}>{name}</p>
                      <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm font-medium leading-relaxed ${bubble}`}>
                        {msg.body}
                        <div className={`text-[10px] mt-1 ${timeColor}`}>
                          {new Date(msg.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={msgBottomRef} />
            </div>

            {/* Input */}
            <form onSubmit={sendMessage} className="px-6 py-4 border-t border-gray-100 flex gap-3 shrink-0">
              <input
                value={msgBody}
                onChange={e => setMsgBody(e.target.value)}
                placeholder="Type a message…"
                className="flex-1 h-11 px-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-800 bg-gray-50 text-sm"
              />
              <button
                type="submit"
                disabled={sendingMsg || !msgBody.trim()}
                className="h-11 w-11 flex items-center justify-center bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors shrink-0"
              >
                {sendingMsg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
