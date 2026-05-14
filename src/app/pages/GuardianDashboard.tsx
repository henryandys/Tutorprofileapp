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
//
// -- 5. Parents can read messages for their linked children's bookings
// CREATE POLICY "messages_parent_read" ON messages FOR SELECT TO authenticated
//   USING (EXISTS (
//     SELECT 1 FROM parent_links pl JOIN bookings b ON b.id = messages.booking_id
//     WHERE pl.parent_id = auth.uid() AND pl.student_id = b.student_id AND pl.status = 'active'
//   ));
//
// -- 6. Parents can send messages into their linked children's bookings
// CREATE POLICY "messages_parent_insert" ON messages FOR INSERT TO authenticated
//   WITH CHECK (
//     sender_id = auth.uid() AND
//     EXISTS (
//       SELECT 1 FROM parent_links pl JOIN bookings b ON b.id = messages.booking_id
//       WHERE pl.parent_id = auth.uid() AND pl.student_id = b.student_id AND pl.status = 'active'
//     )
//   );

import { useState, useEffect, useRef } from "react"
import { Link, useNavigate, useSearchParams } from "react-router"
import { Navbar } from "../components/Navbar"
import { useAuth } from "../../context/AuthContext"
import { supabase } from "../../lib/supabase"
import { toast } from "sonner"
import {
  Calendar, BookOpen, StickyNote, GraduationCap, User,
  ChevronRight, Loader2, Users, Shield, Star, Target, CheckCircle,
  MessageCircle, X, Send, CreditCard,
} from "lucide-react"
import { markConversationRead } from "../components/NotificationsPanel"

// ── Types ─────────────────────────────────────────────────────────────────────

interface Child {
  id:         string
  name:       string
  avatar_url: string | null
  link_id:    string
}

interface ChildLesson {
  id:             string
  subject:        string
  scheduled_at:   string
  tutor_name:     string
  tutor_id:       string
  tutor_avatar:   string | null
  price_cents:    number | null
  payment_status: 'pending' | 'paid' | 'refunded' | null
}

interface ChildNote {
  key:          string
  booking_id:   string
  user_id:      string
  author_name:  string
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

interface ChildMilestone {
  id:          string
  title:       string
  created_at:  string
  marker_name: string | null
}

interface ChildGoal {
  id:         string
  title:      string
  subject:    string | null
  target_date: string | null
  milestones: ChildMilestone[]
}

interface ChildConversation {
  booking_id:    string
  subject:       string
  tutor_id:      string
  tutor_name:    string
  tutor_avatar:  string | null
  student_id:    string
  last_message:  string
  last_at:       string
  message_count: number
}

interface CompletedLesson {
  id:           string
  subject:      string
  scheduled_at: string
  tutor_name:   string
}

interface PendingPayment {
  id:           string
  subject:      string
  scheduled_at: string | null
  tutor_name:   string
  price_cents:  number
}

interface ChildData {
  lessons:          ChildLesson[]
  completedLessons: CompletedLesson[]
  notes:            ChildNote[]
  instructors:      ChildInstructor[]
  stats:            ChildStats
  goals:            ChildGoal[]
  conversations:    ChildConversation[]
  pendingPayments:  PendingPayment[]
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
  const [searchParams, setSearchParams] = useSearchParams()

  const [children,     setChildren]     = useState<Child[]>([])
  const [childData,    setChildData]    = useState<Record<string, ChildData>>({})
  const [fetching,     setFetching]     = useState(true)
  const [selectedId,   setSelectedId]   = useState<string | null>(null)

  // Invite link input
  const [inviteInput,   setInviteInput]   = useState('')
  const [connecting,    setConnecting]    = useState(false)
  const [connectError,  setConnectError]  = useState<string | null>(null)

  // Note writing
  const [writingNoteFor, setWritingNoteFor] = useState<string | null>(null)
  const [noteText,       setNoteText]       = useState('')
  const [savingNote,     setSavingNote]     = useState(false)

  // Payment
  const [payingId, setPayingId] = useState<string | null>(null)

  // Conversation modal
  const [viewConv,     setViewConv]     = useState<{ bookingId: string; subject: string; tutorName: string; studentId: string; studentName: string } | null>(null)
  const [convMessages, setConvMessages] = useState<{ id: string; sender_id: string; body: string; created_at: string }[]>([])
  const [loadingConv,  setLoadingConv]  = useState(false)
  const [convBody,     setConvBody]     = useState('')
  const [sendingConv,  setSendingConv]  = useState(false)
  const convBottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user) return
    loadData()
  }, [user])

  // Handle Stripe redirect back
  useEffect(() => {
    const result = searchParams.get('payment')
    if (!result) return
    if (result === 'success') {
      toast.success('Payment successful! The session is confirmed.')
      loadData()
    }
    if (result === 'cancelled') toast.info('Payment cancelled.')
    setSearchParams({}, { replace: true })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handlePay(lesson: { id: string; subject: string; price_cents: number | null; tutor_name: string }, childName: string) {
    if (!user) return
    setPayingId(lesson.id)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) { toast.error('Please sign in to pay.'); setPayingId(null); return }
    try {
      const res = await fetch('/api/create-checkout-session', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          bookingId:   lesson.id,
          amountCents: lesson.price_cents,
          subject:     lesson.subject,
          studentName: childName,
          tutorName:   lesson.tutor_name,
          successUrl:  `${window.location.origin}/guardian-dashboard?payment=success`,
          cancelUrl:   `${window.location.origin}/guardian-dashboard?payment=cancelled`,
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

  // Realtime subscription for the open conversation
  useEffect(() => {
    if (!viewConv) return
    const channel = supabase
      .channel(`guardian-conv-${viewConv.bookingId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `booking_id=eq.${viewConv.bookingId}` },
        payload => {
          const msg = payload.new as { id: string; sender_id: string; body: string; created_at: string }
          setConvMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
          setTimeout(() => convBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [viewConv?.bookingId])

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
        .select('id, subject, scheduled_at, student_id, price_cents, payment_status, tutor:tutor_id(id, full_name, avatar_url)')
        .in('student_id', childIds)
        .eq('status', 'accepted')
        .gte('scheduled_at', now)
        .order('scheduled_at', { ascending: true })
        .limit(30),

      supabase
        .from('bookings')
        .select('id, subject, scheduled_at, status, student_id, price_cents, payment_status, tutor:tutor_id(id, full_name, avatar_url)')
        .in('student_id', childIds)
        .in('status', ['accepted', 'completed'])
        .order('scheduled_at', { ascending: false })
        .limit(60),
    ])

    const allBookings = (allRes.data ?? []) as any[]
    const upcoming    = (upcomingRes.data ?? []) as any[]

    // 3. Session notes for accepted (upcoming) and completed lessons (all authors)
    const notedBookingIds = allBookings.filter(b => b.status === 'completed' || b.status === 'accepted').map(b => b.id)
    const notesData = notedBookingIds.length > 0
      ? (await supabase
          .from('session_notes')
          .select('booking_id, user_id, content, updated_at')
          .in('booking_id', notedBookingIds)
          .order('updated_at', { ascending: false })
          .limit(100)
        ).data ?? []
      : []
    const noteAuthorIds = [...new Set((notesData as any[]).map(n => n.user_id))]
    const noteAuthorMap: Record<string, string> = {}
    if (noteAuthorIds.length > 0) {
      const { data: nap } = await supabase.from('profiles').select('id, full_name').in('id', noteAuthorIds)
      for (const p of nap ?? []) noteAuthorMap[(p as any).id] = (p as any).full_name ?? 'Unknown'
    }

    // 4. Fetch goals for all children
    const allGoalsRes = await supabase
      .from('learning_goals')
      .select('id, student_id, title, subject, target_date')
      .in('student_id', childIds)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
    const allGoals = (allGoalsRes.data ?? []) as any[]
    const allGoalIds = allGoals.map(g => g.id)
    const mRes = allGoalIds.length > 0
      ? await supabase
          .from('goal_milestones')
          .select('id, goal_id, title, created_at, marker:marked_by(full_name)')
          .in('goal_id', allGoalIds)
          .order('created_at', { ascending: true })
      : { data: [] }
    const milestonesMap: Record<string, ChildMilestone[]> = {}
    for (const m of (mRes.data ?? []) as any[]) {
      if (!milestonesMap[m.goal_id]) milestonesMap[m.goal_id] = []
      milestonesMap[m.goal_id].push({
        id:          m.id,
        title:       m.title,
        created_at:  m.created_at,
        marker_name: m.marker?.full_name ?? null,
      })
    }

    // 5. Fetch messages for all children's bookings
    const allBookingIds = allBookings.map(b => b.id)
    const msgsRes = allBookingIds.length > 0
      ? await supabase
          .from('messages')
          .select('id, booking_id, sender_id, body, created_at')
          .in('booking_id', allBookingIds)
          .order('created_at', { ascending: false })
          .limit(500)
      : { data: [] }
    const msgsByBooking: Record<string, any[]> = {}
    for (const m of (msgsRes.data ?? []) as any[]) {
      if (!msgsByBooking[m.booking_id]) msgsByBooking[m.booking_id] = []
      msgsByBooking[m.booking_id].push(m)
    }

    // 6. Build per-child data map
    const dataMap: Record<string, ChildData> = {}
    for (const kid of kids) {
      const kidUpcoming  = upcoming.filter(b => b.student_id === kid.id)
      const kidAll       = allBookings.filter(b => b.student_id === kid.id)
      const kidCompleted = kidAll.filter(b => b.status === 'completed')
      const completedSet = new Set(kidCompleted.map(b => b.id))
      const kidAccepted  = kidAll.filter(b => b.status === 'accepted')
      const acceptedSet  = new Set(kidAccepted.map(b => b.id))

      // Instructors map
      const instrMap: Record<string, { name: string; avatar: string | null; subjects: Set<string>; sessions: number }> = {}
      for (const b of kidAll) {
        if (!b.tutor?.id) continue
        if (!instrMap[b.tutor.id]) instrMap[b.tutor.id] = { name: b.tutor.full_name ?? 'Instructor', avatar: b.tutor.avatar_url ?? null, subjects: new Set(), sessions: 0 }
        instrMap[b.tutor.id].sessions++
        if (b.subject) instrMap[b.tutor.id].subjects.add(b.subject)
      }

      // Notes with booking context (all authors) — includes upcoming (accepted) + completed
      const kidNotes: ChildNote[] = (notesData as any[])
        .filter(n => completedSet.has(n.booking_id) || acceptedSet.has(n.booking_id))
        .slice(0, 20)
        .map(n => {
          const booking = kidCompleted.find(b => b.id === n.booking_id) ?? kidAccepted.find(b => b.id === n.booking_id)
          return {
            key:          `${n.booking_id}-${n.user_id}`,
            booking_id:   n.booking_id,
            user_id:      n.user_id,
            author_name:  noteAuthorMap[n.user_id] ?? 'Unknown',
            subject:      booking?.subject ?? '',
            tutor_name:   booking?.tutor?.full_name ?? 'Instructor',
            content:      n.content,
            updated_at:   n.updated_at,
            scheduled_at: booking?.scheduled_at ?? null,
          }
        })

      dataMap[kid.id] = {
        lessons: kidUpcoming.slice(0, 6).map((b: any) => ({
          id:             b.id,
          subject:        b.subject,
          scheduled_at:   b.scheduled_at,
          tutor_name:     b.tutor?.full_name  ?? 'Instructor',
          tutor_id:       b.tutor?.id         ?? '',
          tutor_avatar:   b.tutor?.avatar_url ?? null,
          price_cents:    b.price_cents    ?? null,
          payment_status: b.payment_status ?? null,
        })),
        completedLessons: [
          ...kidAccepted.slice(0, 10).map((b: any) => ({
            id:           b.id,
            subject:      b.subject ?? '',
            scheduled_at: b.scheduled_at,
            tutor_name:   b.tutor?.full_name ?? 'Instructor',
          })),
          ...kidCompleted.slice(0, 15).map((b: any) => ({
            id:           b.id,
            subject:      b.subject ?? '',
            scheduled_at: b.scheduled_at,
            tutor_name:   b.tutor?.full_name ?? 'Instructor',
          })),
        ],
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
        goals: allGoals
          .filter(g => g.student_id === kid.id)
          .map(g => ({
            id: g.id, title: g.title, subject: g.subject, target_date: g.target_date,
            milestones: milestonesMap[g.id] ?? [],
          })),
        conversations: kidAll
          .filter(b => (msgsByBooking[b.id]?.length ?? 0) > 0)
          .map(b => {
            const msgs = msgsByBooking[b.id]
            return {
              booking_id:    b.id,
              subject:       (b as any).subject ?? '',
              tutor_id:      (b as any).tutor?.id ?? '',
              tutor_name:    (b as any).tutor?.full_name ?? 'Instructor',
              tutor_avatar:  (b as any).tutor?.avatar_url ?? null,
              student_id:    kid.id,
              last_message:  msgs[0].body,
              last_at:       msgs[0].created_at,
              message_count: msgs.length,
            }
          })
          .sort((a, b) => b.last_at.localeCompare(a.last_at)),
        pendingPayments: kidAll
          .filter((b: any) => (b.price_cents ?? 0) > 0 && b.payment_status !== 'paid')
          .map((b: any) => ({
            id:           b.id,
            subject:      b.subject ?? '',
            scheduled_at: b.scheduled_at ?? null,
            tutor_name:   b.tutor?.full_name ?? 'Instructor',
            price_cents:  b.price_cents as number,
          })),
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

  async function openConversation(conv: typeof viewConv) {
    if (!conv) return
    setViewConv(conv)
    setConvBody('')
    setLoadingConv(true)
    if (user) markConversationRead(user.id, conv.bookingId)
    const { data } = await supabase
      .from('messages')
      .select('id, sender_id, body, created_at')
      .eq('booking_id', conv.bookingId)
      .order('created_at', { ascending: true })
    setConvMessages(data ?? [])
    setLoadingConv(false)
    setTimeout(() => convBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  async function saveNote(bookingId: string) {
    if (!noteText.trim() || !user) return
    setSavingNote(true)
    const { error } = await supabase
      .from('session_notes')
      .upsert(
        { booking_id: bookingId, user_id: user.id, content: noteText.trim(), updated_at: new Date().toISOString() },
        { onConflict: 'booking_id,user_id' }
      )
    if (error) { toast.error('Failed to save note.'); setSavingNote(false); return }
    const authorName = profile?.full_name ?? 'Guardian'
    const newNote: ChildNote = {
      key:          `${bookingId}-${user.id}`,
      booking_id:   bookingId,
      user_id:      user.id,
      author_name:  authorName,
      subject:      '',
      tutor_name:   '',
      content:      noteText.trim(),
      updated_at:   new Date().toISOString(),
      scheduled_at: null,
    }
    setChildData(prev => {
      const updated = { ...prev }
      for (const kidId of Object.keys(updated)) {
        const kidData = updated[kidId]
        const exists = kidData.notes.some(n => n.booking_id === bookingId && n.user_id === user.id)
        updated[kidId] = {
          ...kidData,
          notes: exists
            ? kidData.notes.map(n => n.booking_id === bookingId && n.user_id === user.id ? { ...n, content: noteText.trim() } : n)
            : [...kidData.notes, newNote],
        }
      }
      return updated
    })
    setWritingNoteFor(null)
    setNoteText('')
    setSavingNote(false)
    toast.success('Note saved!')
  }

  async function sendConvMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!convBody.trim() || !user || !viewConv) return
    setSendingConv(true)
    const { error } = await supabase.from('messages').insert({
      booking_id: viewConv.bookingId,
      sender_id:  user.id,
      body:       convBody.trim(),
    })
    if (error) {
      toast.error('Failed to send: ' + error.message)
    } else {
      setConvBody('')
    }
    setSendingConv(false)
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

                {/* Pending Payments alert */}
                {data.pendingPayments.length > 0 && (() => {
                  const total = data.pendingPayments.reduce((sum, p) => sum + p.price_cents, 0)
                  return (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                        <CreditCard className="w-5 h-5 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-gray-900 text-sm">
                          {data.pendingPayments.length} session{data.pendingPayments.length !== 1 ? 's' : ''} awaiting payment
                        </p>
                        <p className="text-xs text-gray-500 font-medium mt-0.5">
                          Total due: <span className="font-black text-amber-700">${(total / 100).toFixed(2)}</span>
                        </p>
                        <div className="flex flex-col gap-2 mt-3">
                          {data.pendingPayments.map(p => (
                            <div key={p.id} className="flex items-center justify-between gap-3 bg-white rounded-xl px-3 py-2.5 border border-amber-100">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-gray-900 truncate">{p.subject}</p>
                                <p className="text-xs text-gray-500 font-medium">
                                  with {p.tutor_name}
                                  {p.scheduled_at && ` · ${new Date(p.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                                </p>
                              </div>
                              <button
                                onClick={() => handlePay(p, child.name)}
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
                      {data.lessons.map(l => {
                        const myNote      = data.notes.find(n => n.booking_id === l.id && n.user_id === user?.id)
                        const isWriting   = writingNoteFor === l.id
                        const needsPay    = (l.price_cents ?? 0) > 0 && l.payment_status !== 'paid'
                        const isPaid      = l.payment_status === 'paid'
                        const isPaying    = payingId === l.id
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
                                {needsPay && !isWriting && (
                                  <button
                                    onClick={() => handlePay(l, child.name)}
                                    disabled={isPaying}
                                    className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-60"
                                  >
                                    {isPaying
                                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      : <CreditCard className="w-3.5 h-3.5" />}
                                    Pay ${((l.price_cents ?? 0) / 100).toFixed(2)}
                                  </button>
                                )}
                                {!isWriting && (
                                  <button
                                    onClick={() => { setNoteText(myNote?.content ?? ''); setWritingNoteFor(l.id) }}
                                    className="flex items-center gap-1 px-2.5 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-xs font-bold transition-colors"
                                  >
                                    <StickyNote className="w-3.5 h-3.5" />
                                    {myNote ? 'Note' : 'Add note'}
                                  </button>
                                )}
                              </div>
                            </div>
                            {myNote && !isWriting && (
                              <div className="mt-2 ml-14 bg-green-50 rounded-lg px-3 py-2">
                                <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-0.5">Your note</p>
                                <p className="text-xs text-gray-700 font-medium leading-relaxed">{myNote.content}</p>
                              </div>
                            )}
                            {isWriting && (
                              <div className="mt-2 ml-14 flex flex-col gap-2">
                                <textarea
                                  value={noteText}
                                  onChange={e => setNoteText(e.target.value)}
                                  placeholder="Questions to ask, topics to prepare, goals for this session…"
                                  rows={2}
                                  autoFocus
                                  className="w-full px-3 py-2 border border-green-200 rounded-lg text-xs font-medium text-gray-800 bg-green-50 focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
                                />
                                <div className="flex items-center gap-2 justify-end">
                                  <button
                                    onClick={() => { setWritingNoteFor(null); setNoteText('') }}
                                    className="text-xs font-bold text-gray-400 hover:text-gray-600 px-2 py-1 rounded transition-colors"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => saveNote(l.id)}
                                    disabled={savingNote || !noteText.trim()}
                                    className="flex items-center gap-1 text-xs font-bold text-white bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
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

                {/* Learning Goals */}
                {data.goals.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
                      <Target className="w-4 h-4 text-indigo-600" />
                      <h2 className="font-black text-gray-900">Learning Goals</h2>
                      <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full ml-1">
                        {data.goals.length}
                      </span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {data.goals.map(g => (
                        <div key={g.id} className="px-6 py-4">
                          {/* Goal header */}
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
                              <Target className="w-4 h-4 text-indigo-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-gray-900 text-sm">{g.title}</p>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                {g.subject && <span className="text-xs text-gray-500">{g.subject}</span>}
                                {g.target_date && (
                                  <span className="text-xs font-bold text-indigo-600">
                                    by {new Date(g.target_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Milestones */}
                          {g.milestones.length > 0 ? (
                            <div className="mt-3 ml-11 space-y-2">
                              {g.milestones.map(m => (
                                <div key={m.id} className="flex items-start gap-2">
                                  <div className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center shrink-0 mt-0.5">
                                    <CheckCircle className="w-2.5 h-2.5 text-green-600" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-gray-800">{m.title}</p>
                                    <p className="text-xs text-gray-400 font-medium">
                                      {m.marker_name ? `by ${m.marker_name} · ` : ''}{timeAgo(m.created_at)}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-2 ml-11 text-xs text-gray-400 italic">No milestones marked yet.</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Session Notes */}
                {(data.completedLessons.length > 0 || data.lessons.length > 0) && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
                      <StickyNote className="w-4 h-4 text-amber-500" />
                      <h2 className="font-black text-gray-900">Session Notes</h2>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {data.completedLessons.map(lesson => {
                        const lessonNotes  = data.notes.filter(n => n.booking_id === lesson.id)
                        const myNote       = lessonNotes.find(n => n.user_id === user?.id)
                        const isWriting    = writingNoteFor === lesson.id
                        const isFuture     = lesson.scheduled_at ? new Date(lesson.scheduled_at) > new Date() : false
                        return (
                          <div key={lesson.id} className="px-6 py-4">
                            {/* Session header */}
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-bold text-gray-900">{lesson.subject}</p>
                                  {isFuture && (
                                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">Upcoming</span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500 font-medium">with {lesson.tutor_name} · {timeAgo(lesson.scheduled_at)}</p>
                              </div>
                              {!isWriting && (
                                <button
                                  onClick={() => { setNoteText(myNote?.content ?? ''); setWritingNoteFor(lesson.id) }}
                                  className="ml-2 shrink-0 text-xs font-bold text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors"
                                >
                                  {myNote ? 'Edit Note' : 'Add Note'}
                                </button>
                              )}
                            </div>

                            {/* Notes from others */}
                            {lessonNotes.filter(n => n.user_id !== user?.id).map(n => (
                              <div key={n.key} className="bg-gray-50 rounded-xl p-3 mb-2">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">{n.author_name}</p>
                                <p className="text-sm text-gray-700 font-medium leading-relaxed">{n.content}</p>
                              </div>
                            ))}

                            {/* My note (read view) */}
                            {myNote && !isWriting && (
                              <div className="bg-amber-50 rounded-xl p-3 border border-amber-100 mb-2">
                                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wide mb-1">Your note</p>
                                <p className="text-sm text-gray-700 font-medium leading-relaxed">{myNote.content}</p>
                              </div>
                            )}

                            {/* No notes yet */}
                            {lessonNotes.length === 0 && !isWriting && (
                              <p className="text-xs text-gray-400 italic">No notes for this session yet.</p>
                            )}

                            {/* Inline editor */}
                            {isWriting && (
                              <div className="space-y-2 mt-1">
                                <textarea
                                  value={noteText}
                                  onChange={e => setNoteText(e.target.value)}
                                  placeholder="Write your note about this session…"
                                  rows={3}
                                  autoFocus
                                  className="w-full px-4 py-3 border border-amber-200 rounded-xl text-sm font-medium text-gray-800 bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                                />
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => { setWritingNoteFor(null); setNoteText('') }}
                                    className="text-xs font-bold text-gray-400 hover:text-gray-600 px-3 py-1.5 rounded-lg transition-colors"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => saveNote(lesson.id)}
                                    disabled={savingNote || !noteText.trim()}
                                    className="flex items-center gap-1.5 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                                  >
                                    {savingNote && <Loader2 className="w-3 h-3 animate-spin" />}
                                    Save Note
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

                {/* Instructors */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-purple-600" />
                      <h2 className="font-black text-gray-900">Instructors</h2>
                      {data.instructors.length > 0 && (
                        <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs font-bold rounded-full">
                          {data.instructors.length}
                        </span>
                      )}
                    </div>
                    <Link to="/search" className="text-sm font-bold text-purple-600 hover:text-purple-700">Find more →</Link>
                  </div>
                  {data.instructors.length === 0 ? (
                    <div className="px-6 py-12 flex flex-col items-center gap-2 text-center">
                      <GraduationCap className="w-10 h-10 text-gray-200" />
                      <p className="text-gray-400 font-bold">No instructors yet</p>
                      <p className="text-gray-400 text-sm font-medium">Instructors will appear once your child books a session.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {data.instructors.map(t => (
                        <Link key={t.id} to={`/tutor/${t.id}`} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors group">
                          <Avatar name={t.name} url={t.avatar_url} />
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-gray-900 truncate">{t.name}</p>
                            {t.subjects.length > 0 && (
                              <p className="text-sm text-gray-500 font-medium truncate">{t.subjects.join(', ')}</p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-lg font-black text-purple-600">{t.sessions}</p>
                            <p className="text-[10px] text-gray-400 font-medium leading-none">{t.sessions === 1 ? 'session' : 'sessions'}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                {/* Messages */}
                {data.conversations.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
                      <MessageCircle className="w-4 h-4 text-blue-500" />
                      <h2 className="font-black text-gray-900">Messages</h2>
                      <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
                        {data.conversations.length}
                      </span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {data.conversations.map(c => (
                        <button
                          key={c.booking_id}
                          onClick={() => openConversation({ bookingId: c.booking_id, subject: c.subject, tutorName: c.tutor_name, studentId: c.student_id, studentName: child!.name })}
                          className="w-full flex items-start gap-4 px-6 py-4 hover:bg-gray-50 transition-colors text-left"
                        >
                          <Avatar name={c.tutor_name} url={c.tutor_avatar} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-0.5">
                              <p className="font-bold text-gray-900 text-sm truncate">{c.tutor_name}</p>
                              <p className="text-[10px] text-gray-400 font-medium shrink-0">{timeAgo(c.last_at)}</p>
                            </div>
                            <p className="text-xs text-gray-500 font-bold truncate">{c.subject}</p>
                            <p className="text-xs text-gray-400 truncate mt-0.5 italic">"{c.last_message}"</p>
                          </div>
                          <div className="shrink-0 mt-1">
                            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">{c.message_count}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

              </div>

              {/* Right 1/3 */}
              <div className="flex flex-col gap-6">

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

      {/* ── Conversation modal ────────────────────────────────────────── */}
      {viewConv && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden" style={{ height: '72vh' }}>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <div>
                <h3 className="font-black text-gray-900">{viewConv.tutorName}</h3>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{viewConv.subject}</p>
              </div>
              <button
                onClick={() => { setViewConv(null); setConvBody('') }}
                className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-3">
              {loadingConv ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              ) : convMessages.length === 0 ? (
                <p className="text-center text-gray-400 font-medium text-sm py-10">No messages yet.</p>
              ) : (
                convMessages.map(msg => {
                  const isMe      = msg.sender_id === user?.id
                  const isStudent = msg.sender_id === viewConv.studentId
                  const label     = isMe ? 'You' : isStudent ? viewConv.studentName : viewConv.tutorName
                  const align     = isMe ? 'items-end' : 'items-start'
                  const bubble    = isMe
                    ? 'bg-green-600 text-white rounded-br-sm'
                    : isStudent
                    ? 'bg-blue-100 text-blue-900 rounded-bl-sm'
                    : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                  const timeColor = isMe ? 'text-green-200' : isStudent ? 'text-blue-400' : 'text-gray-400'
                  const nameColor = isMe ? 'text-green-600' : isStudent ? 'text-blue-500' : 'text-gray-400'
                  return (
                    <div key={msg.id} className={`flex flex-col gap-0.5 ${align}`}>
                      <p className={`text-[10px] font-bold px-1 ${nameColor}`}>{label}</p>
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
              <div ref={convBottomRef} />
            </div>

            {/* Send form */}
            <form onSubmit={sendConvMessage} className="px-6 py-4 border-t border-gray-100 flex gap-3 shrink-0">
              <input
                value={convBody}
                onChange={e => setConvBody(e.target.value)}
                placeholder="Message as guardian…"
                className="flex-1 h-11 px-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400 font-medium text-gray-800 bg-gray-50 text-sm"
              />
              <button
                type="submit"
                disabled={sendingConv || !convBody.trim()}
                className="h-11 w-11 flex items-center justify-center bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors shrink-0"
              >
                {sendingConv ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
