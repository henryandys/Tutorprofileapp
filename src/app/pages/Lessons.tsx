import { useState, useEffect, useMemo } from "react"
import { Link } from "react-router"
import { Navbar } from "../components/Navbar"
import { ChevronLeft, ChevronRight, Calendar, Clock, Loader2, User, CheckCircle, XCircle, Users, MessageCircle, XOctagon, MapPin, Star } from "lucide-react"
import { useAuth } from "../../context/AuthContext"
import { supabase } from "../../lib/supabase"
import { ConversationModal } from "../components/ConversationModal"
import { GroupEnrollmentModal } from "../components/GroupEnrollmentModal"
import { sendNotificationEmail } from "../../lib/notify"
import { toast } from "sonner"

interface Lesson {
  id:            string
  subject:       string
  status:        'pending' | 'accepted' | 'declined' | 'cancelled' | 'completed'
  scheduled_at:  string | null
  created_at:    string
  message:       string
  other_name:    string
  other_user_id: string
  perspective:   'tutor' | 'student'
}

interface GroupEntry {
  id:               string
  title:            string
  subject:          string
  scheduled_at:     string
  duration_minutes: number
  max_students:     number
  price:            number
  enrollment_count: number
  perspective:      'tutor' | 'student'
  tutor_name:       string | null
  tutor_id:         string | null
  location:         string | null
}

const STATUS_STYLE: Record<string, string> = {
  pending:   'bg-yellow-100 text-yellow-700',
  accepted:  'bg-green-100 text-green-700',
  declined:  'bg-red-100 text-red-600',
  cancelled: 'bg-gray-100 text-gray-500',
  completed: 'bg-teal-100 text-teal-700',
}

const DOW    = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

export function Lessons() {
  const { user, role, profile } = useAuth()
  const isTutor = role === 'tutor'

  const [lessons, setLessons]         = useState<Lesson[]>([])
  const [groupEntries, setGroupEntries] = useState<GroupEntry[]>([])
  const [loading, setLoading]         = useState(true)
  const [calMonth, setCalMonth]       = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [chatLesson, setChatLesson]   = useState<Lesson | null>(null)
  const [enrollmentGroup, setEnrollmentGroup] = useState<GroupEntry | null>(null)
  const [groupChat, setGroupChat] = useState<{ bookingId: string; tutorName: string; tutorId: string; subject: string } | null>(null)
  const [openingGroupChat, setOpeningGroupChat] = useState<string | null>(null)
  const [cancelBooking, setCancelBooking]   = useState<Lesson | null>(null)
  const [cancelGroup, setCancelGroup]       = useState<GroupEntry | null>(null)
  const [cancellingId, setCancellingId]     = useState<string | null>(null)
  const [completingId, setCompletingId]     = useState<string | null>(null)
  const [reviewLesson, setReviewLesson]     = useState<Lesson | null>(null)
  const [reviewedTutors, setReviewedTutors] = useState<Set<string>>(new Set())

  async function handleGroupMessage(g: GroupEntry) {
    if (!user || !g.tutor_id) return
    setOpeningGroupChat(g.id)
    const { data: existing } = await supabase
      .from('bookings')
      .select('id')
      .eq('tutor_id', g.tutor_id)
      .eq('student_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    if (existing) {
      setGroupChat({ bookingId: existing.id, tutorName: g.tutor_name ?? 'Tutor', tutorId: g.tutor_id, subject: g.subject })
      setOpeningGroupChat(null)
      return
    }
    const { data: created, error } = await supabase
      .from('bookings')
      .insert({
        tutor_id:     g.tutor_id,
        student_id:   user.id,
        student_name: profile?.full_name ?? user.email?.split('@')[0] ?? 'Student',
        subject:      g.subject,
        message:      '',
        status:       'pending',
      })
      .select('id')
      .single()
    if (error || !created) { toast.error('Could not open chat.') }
    else { setGroupChat({ bookingId: created.id, tutorName: g.tutor_name ?? 'Tutor', tutorId: g.tutor_id, subject: g.subject }) }
    setOpeningGroupChat(null)
  }

  async function handleCancelBooking(lesson: Lesson, message: string) {
    setCancellingId(lesson.id)
    const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', lesson.id)
    if (error) { toast.error('Could not cancel session.'); setCancellingId(null); return }
    if (message.trim()) {
      await supabase.from('messages').insert({ booking_id: lesson.id, sender_id: user!.id, content: message.trim() })
    }
    setLessons(prev => prev.map(l => l.id === lesson.id ? { ...l, status: 'cancelled' as const } : l))
    setCancelBooking(null)
    setCancellingId(null)
    toast.success('Session cancelled.')
  }

  async function handleLeaveGroup(g: GroupEntry, message: string) {
    if (!user) return
    setCancellingId(g.id)
    const { error } = await supabase.from('group_lesson_enrollments')
      .delete().eq('group_lesson_id', g.id).eq('student_id', user.id)
    if (error) { toast.error('Could not leave session.'); setCancellingId(null); return }
    if (message.trim() && g.tutor_id) {
      let bookingId: string | null = null
      const { data: existing } = await supabase.from('bookings').select('id')
        .eq('tutor_id', g.tutor_id).eq('student_id', user.id)
        .order('created_at', { ascending: false }).limit(1).single()
      if (existing) {
        bookingId = existing.id
      } else {
        const { data: created } = await supabase.from('bookings').insert({
          tutor_id:     g.tutor_id,
          student_id:   user.id,
          student_name: profile?.full_name ?? user.email?.split('@')[0] ?? 'Student',
          subject:      g.subject,
          message:      '',
          status:       'pending',
        }).select('id').single()
        bookingId = created?.id ?? null
      }
      if (bookingId) {
        await supabase.from('messages').insert({ booking_id: bookingId, sender_id: user.id, content: message.trim() })
      }
    }
    setGroupEntries(prev => prev.filter(ge => ge.id !== g.id))
    setCancelGroup(null)
    setCancellingId(null)
    toast.success("You've left the group session.")
  }

  async function handleCancelGroupLesson(g: GroupEntry, message: string) {
    if (!user) return
    setCancellingId(g.id)
    const { error } = await supabase.from('group_lessons').update({ status: 'cancelled' }).eq('id', g.id)
    if (error) { toast.error('Could not cancel session.'); setCancellingId(null); return }
    if (message.trim()) {
      const { data: enrollments } = await supabase.from('group_lesson_enrollments')
        .select('student_id, student_name').eq('group_lesson_id', g.id)
      for (const e of enrollments ?? []) {
        let bookingId: string | null = null
        const { data: existing } = await supabase.from('bookings').select('id')
          .eq('tutor_id', user.id).eq('student_id', e.student_id)
          .order('created_at', { ascending: false }).limit(1).single()
        if (existing) {
          bookingId = existing.id
        } else {
          const { data: created } = await supabase.from('bookings').insert({
            tutor_id:     user.id,
            student_id:   e.student_id,
            student_name: e.student_name,
            subject:      g.subject,
            message:      '',
            status:       'pending',
          }).select('id').single()
          bookingId = created?.id ?? null
        }
        if (bookingId) {
          await supabase.from('messages').insert({ booking_id: bookingId, sender_id: user.id, content: message.trim() })
        }
      }
    }
    setGroupEntries(prev => prev.filter(ge => ge.id !== g.id))
    setCancelGroup(null)
    setCancellingId(null)
    toast.success('Group session cancelled.')
  }

  async function handleMarkComplete(lesson: Lesson) {
    setCompletingId(lesson.id)
    const { error } = await supabase.from('bookings').update({ status: 'completed' }).eq('id', lesson.id)
    if (error) { toast.error('Failed to mark complete.') }
    else {
      setLessons(prev => prev.map(l => l.id === lesson.id ? { ...l, status: 'completed' } : l))
      toast.success('Session marked complete!')
    }
    setCompletingId(null)
  }

  async function handleSubmitReview(lesson: Lesson, rating: number, body: string) {
    if (!user) return
    const { error } = await supabase.from('reviews').insert({
      tutor_id:     lesson.other_user_id,
      student_id:   user.id,
      student_name: profile?.full_name ?? user.email?.split('@')[0] ?? 'Student',
      rating,
      body: body.trim(),
    })
    if (error) { toast.error('Failed to submit review: ' + error.message); return }
    setReviewedTutors(prev => new Set([...prev, lesson.other_user_id]))
    setReviewLesson(null)
    toast.success('Review submitted!')
  }

  async function updateStatus(lessonId: string, status: 'accepted' | 'declined') {
    const { error } = await supabase
      .from('bookings')
      .update({ status })
      .eq('id', lessonId)
      .eq('tutor_id', user!.id)
    if (error) { toast.error('Failed to update booking.'); return }
    setLessons(prev => prev.map(l => {
      if (l.id !== lessonId) return l
      sendNotificationEmail({
        type: status === 'accepted' ? 'booking_accepted' : 'booking_declined',
        recipientId: l.other_user_id,
        data: { tutorName: profile?.full_name ?? 'Your tutor', studentName: l.other_name, subject: l.subject },
      })
      return { ...l, status }
    }))
    toast.success(`Booking ${status}.`)
  }

  useEffect(() => {
    if (!user) return

    const asTutorQ   = supabase.from('bookings').select('id,subject,status,scheduled_at,created_at,message,student_name,student_id').eq('tutor_id', user.id)
    const asStudentQ = supabase.from('bookings').select('id,subject,status,scheduled_at,created_at,message,tutor_id,tutor:tutor_id(full_name)').eq('student_id', user.id)

    // Tutors see both sets; students see only their own bookings
    const queries = isTutor
      ? Promise.all([asTutorQ, asStudentQ])
      : Promise.all([asStudentQ]).then(([r]) => [null, r])

    const groupTutorQ   = isTutor
      ? supabase.from('group_lessons').select('*, group_lesson_enrollments(count)').eq('tutor_id', user.id)
      : Promise.resolve({ data: [] })
    const groupStudentQ = supabase
      .from('group_lesson_enrollments')
      .select('group_lesson_id, group_lessons(*)')
      .eq('student_id', user.id)

    Promise.all([queries, groupTutorQ, groupStudentQ]).then(async ([[tutorRes, studentRes], groupTutorRes, groupStudentRes]) => {
      const asTutor: Lesson[] = ((tutorRes?.data ?? []) as any[]).map(b => ({
        id:            b.id,
        subject:       b.subject,
        status:        b.status,
        scheduled_at:  b.scheduled_at ?? null,
        created_at:    b.created_at,
        message:       b.message ?? '',
        other_name:    b.student_name,
        other_user_id: b.student_id,
        perspective:   'tutor' as const,
      }))
      const asStudent: Lesson[] = ((studentRes?.data ?? []) as any[]).map(b => ({
        id:            b.id,
        subject:       b.subject,
        status:        b.status,
        scheduled_at:  b.scheduled_at ?? null,
        created_at:    b.created_at,
        message:       b.message ?? '',
        other_name:    b.tutor?.full_name ?? 'Tutor',
        other_user_id: b.tutor_id,
        perspective:   'student' as const,
      }))
      setLessons([...asTutor, ...asStudent])

      const groupAsTutor: GroupEntry[] = ((groupTutorRes.data ?? []) as any[]).map(g => ({
        id:               g.id,
        title:            g.title,
        subject:          g.subject,
        scheduled_at:     g.scheduled_at,
        duration_minutes: g.duration_minutes,
        max_students:     g.max_students,
        price:            g.price,
        enrollment_count: g.group_lesson_enrollments?.[0]?.count ?? 0,
        perspective:      'tutor' as const,
        tutor_name:       null,
        tutor_id:         g.tutor_id ?? null,
        location:         g.location ?? null,
      }))
      const enrolledRows = ((groupStudentRes.data ?? []) as any[]).filter((e: any) => e.group_lessons)
      // Fetch tutor names from profiles using the tutor_ids
      const tutorIds = [...new Set(enrolledRows.map((e: any) => e.group_lessons.tutor_id as string))]
      const tutorNames: Record<string, string> = {}
      if (tutorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', tutorIds)
        for (const p of profiles ?? []) tutorNames[p.id] = p.full_name
      }
      const groupAsStudent: GroupEntry[] = enrolledRows.map((e: any) => {
        const g = e.group_lessons
        return {
          id:               g.id,
          title:            g.title,
          subject:          g.subject,
          scheduled_at:     g.scheduled_at,
          duration_minutes: g.duration_minutes,
          max_students:     g.max_students,
          price:            g.price,
          enrollment_count: 0,
          perspective:      'student' as const,
          tutor_name:       tutorNames[g.tutor_id] ?? null,
          tutor_id:         g.tutor_id ?? null,
          location:         g.location ?? null,
        }
      })
      // Deduplicate: tutor may appear as both tutor and student
      const seen = new Set<string>()
      const merged = [...groupAsTutor, ...groupAsStudent].filter(g => {
        if (seen.has(g.id)) return false
        seen.add(g.id)
        return true
      })
      setGroupEntries(merged)
      setLoading(false)
    })
  }, [user, isTutor])

  // Load which tutors this student has already reviewed so we can hide the prompt.
  useEffect(() => {
    if (!user || isTutor) return
    supabase.from('reviews').select('tutor_id').eq('student_id', user.id)
      .then(({ data }) => {
        setReviewedTutors(new Set((data ?? []).map((r: any) => r.tutor_id as string)))
      })
  }, [user, isTutor])

  const byDate = useMemo(() => {
    const map: Record<string, Lesson[]> = {}
    for (const l of lessons) {
      if (!l.scheduled_at) continue
      const key = new Date(l.scheduled_at).toDateString()
      ;(map[key] ??= []).push(l)
    }
    return map
  }, [lessons])

  const groupByDate = useMemo(() => {
    const map: Record<string, GroupEntry[]> = {}
    for (const g of groupEntries) {
      if (!g.scheduled_at) continue
      const key = new Date(g.scheduled_at).toDateString()
      ;(map[key] ??= []).push(g)
    }
    return map
  }, [groupEntries])

  const cells = useMemo(() => {
    const firstDay    = new Date(calMonth.getFullYear(), calMonth.getMonth(), 1).getDay()
    const daysInMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0).getDate()
    const result: (Date | null)[] = Array(firstDay).fill(null)
    for (let d = 1; d <= daysInMonth; d++) result.push(new Date(calMonth.getFullYear(), calMonth.getMonth(), d))
    return result
  }, [calMonth])

  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d }, [])

  const visibleLessons = useMemo(() => {
    if (selectedDay) return (byDate[selectedDay.toDateString()] ?? []).sort((a, b) =>
      new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime()
    )
    return lessons
      .filter(l => l.scheduled_at && new Date(l.scheduled_at) >= today)
      .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())
  }, [selectedDay, byDate, lessons, today])

  const unscheduled = useMemo(() =>
    lessons.filter(l => !l.scheduled_at), [lessons])

  const needsReview = useMemo(() =>
    lessons.filter(l =>
      l.status === 'completed' &&
      l.perspective === 'student' &&
      !reviewedTutors.has(l.other_user_id)
    ), [lessons, reviewedTutors])

  const visibleGroups = useMemo(() => {
    if (selectedDay) return (groupByDate[selectedDay.toDateString()] ?? []).sort((a, b) =>
      new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
    )
    return groupEntries
      .filter(g => new Date(g.scheduled_at) >= today)
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
  }, [selectedDay, groupByDate, groupEntries, today])

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 py-8">

        <Link to="/profile" className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-500 hover:text-gray-800 mb-6 transition-colors">
          <ChevronLeft className="w-4 h-4" />
          Back to profile
        </Link>

        <h1 className="text-3xl font-black text-gray-900 mb-8">My Lessons</h1>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6 items-start">

            {/* ── Calendar ── */}
            <div className="w-full lg:w-72 shrink-0">
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">

                {/* Month nav */}
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={() => { const d = new Date(calMonth); d.setMonth(d.getMonth()-1); setCalMonth(d); setSelectedDay(null) }}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-black text-gray-900 text-sm">
                    {MONTHS[calMonth.getMonth()]} {calMonth.getFullYear()}
                  </span>
                  <button
                    onClick={() => { const d = new Date(calMonth); d.setMonth(d.getMonth()+1); setCalMonth(d); setSelectedDay(null) }}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Day-of-week headers */}
                <div className="grid grid-cols-7 mb-1">
                  {DOW.map(d => (
                    <span key={d} className="text-center text-[10px] font-bold text-gray-400 py-1">{d[0]}</span>
                  ))}
                </div>

                {/* Date cells */}
                <div className="grid grid-cols-7 gap-y-0.5">
                  {cells.map((date, i) => {
                    if (!date) return <div key={i} />
                    const key        = date.toDateString()
                    const dayLessons = byDate[key] ?? []
                    const dayGroups  = groupByDate[key] ?? []
                    const isToday    = key === today.toDateString()
                    const isSelected = selectedDay?.toDateString() === key
                    const tutorLessons   = dayLessons.filter(l => l.perspective === 'tutor')
                    const studentLessons = dayLessons.filter(l => l.perspective === 'student')
                    const hasAccepted    = tutorLessons.some(l => l.status === 'accepted')
                    const hasPending     = tutorLessons.some(l => l.status === 'pending')
                    const hasOwn         = studentLessons.some(l => l.status !== 'declined')
                    const hasGroup       = dayGroups.length > 0
                    const hasAny         = dayLessons.length > 0 || hasGroup
                    return (
                      <button
                        key={key}
                        onClick={() => setSelectedDay(isSelected ? null : date)}
                        className={`relative flex flex-col items-center justify-center py-1.5 rounded-xl transition-colors ${
                          isSelected ? 'bg-blue-600 text-white' :
                          isToday    ? 'bg-blue-50 text-blue-700 font-black' :
                                       'hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <span className="text-xs font-bold leading-none">{date.getDate()}</span>
                        {hasAny && (
                          <div className="flex gap-0.5 mt-0.5">
                            {hasAccepted && <span className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-green-500'}`} />}
                            {hasPending  && <span className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white/80' : 'bg-yellow-400'}`} />}
                            {hasOwn      && <span className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white/60' : 'bg-blue-400'}`} />}
                            {hasGroup    && <span className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white/60' : 'bg-purple-500'}`} />}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-4 pt-4 border-t border-gray-100">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                    <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" /> Accepted
                  </span>
                  <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                    <span className="w-2 h-2 rounded-full bg-yellow-400 shrink-0" /> Pending
                  </span>
                  {isTutor && (
                    <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                      <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" /> Your session
                    </span>
                  )}
                  <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                    <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" /> Group
                  </span>
                </div>
              </div>
            </div>

            {/* ── Lesson list ── */}
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-black text-gray-900 mb-4">
                {selectedDay
                  ? selectedDay.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
                  : 'Upcoming Lessons'}
              </h2>

              {visibleLessons.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
                  <Calendar className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                  <p className="font-bold text-gray-500">
                    {selectedDay ? 'No lessons on this day' : 'No upcoming scheduled lessons'}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {visibleLessons.map(l => (
                    <LessonCard
                      key={l.id}
                      lesson={l}
                      isTutor={isTutor}
                      onChat={() => setChatLesson(l)}
                      onAccept={() => updateStatus(l.id, 'accepted')}
                      onDecline={() => updateStatus(l.id, 'declined')}
                      onCancel={() => setCancelBooking(l)}
                      onMarkComplete={isTutor ? () => handleMarkComplete(l) : undefined}
                      completing={completingId === l.id}
                    />
                  ))}
                </div>
              )}

              {/* Unscheduled requests */}
              {!selectedDay && unscheduled.length > 0 && (
                <div className="mt-8">
                  <h2 className="text-lg font-black text-gray-900 mb-4">Unscheduled Requests</h2>
                  <div className="flex flex-col gap-3">
                    {unscheduled.map(l => (
                      <LessonCard
                        key={l.id}
                        lesson={l}
                        isTutor={isTutor}
                        onChat={() => setChatLesson(l)}
                        onAccept={() => updateStatus(l.id, 'accepted')}
                        onDecline={() => updateStatus(l.id, 'declined')}
                        onCancel={() => setCancelBooking(l)}
                        onMarkComplete={isTutor ? () => handleMarkComplete(l) : undefined}
                        completing={completingId === l.id}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Group Sessions */}
              {visibleGroups.length > 0 && (
                <div className="mt-8">
                  <h2 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-purple-600" />
                    Group Sessions
                  </h2>
                  <div className="flex flex-col gap-3">
                    {visibleGroups.map(g => (
                      <GroupCard
                        key={g.id}
                        group={g}
                        isTutor={isTutor}
                        openingChat={openingGroupChat === g.id}
                        onViewEnrollments={g.perspective === 'tutor' ? () => setEnrollmentGroup(g) : undefined}
                        onMessage={g.perspective === 'student' ? () => handleGroupMessage(g) : undefined}
                        onLeave={g.perspective === 'student' ? () => setCancelGroup(g) : undefined}
                        onCancelSession={g.perspective === 'tutor' ? () => setCancelGroup(g) : undefined}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Pending Reviews (students only) ── */}
        {!isTutor && needsReview.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
              Leave a Review
            </h2>
            <div className="flex flex-col gap-3">
              {needsReview.map(l => (
                <div key={l.id} className="bg-white rounded-2xl border border-yellow-100 shadow-sm p-5 flex items-center justify-between gap-4">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="font-bold text-gray-900">{l.other_name}</span>
                    <span className="text-sm font-bold text-blue-600">{l.subject}</span>
                    {l.scheduled_at && (
                      <span className="text-xs text-gray-400 font-medium">
                        {new Date(l.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setReviewLesson(l)}
                    className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-yellow-400 text-yellow-900 rounded-xl font-bold text-sm hover:bg-yellow-500 transition-colors"
                  >
                    <Star className="w-4 h-4 fill-yellow-900" /> Rate Session
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {chatLesson && (
        <ConversationModal
          bookingId={chatLesson.id}
          otherName={chatLesson.other_name}
          otherUserId={chatLesson.other_user_id}
          subject={chatLesson.subject}
          onClose={() => setChatLesson(null)}
        />
      )}

      {enrollmentGroup && (
        <GroupEnrollmentModal group={enrollmentGroup} onClose={() => setEnrollmentGroup(null)} />
      )}

      {groupChat && (
        <ConversationModal
          bookingId={groupChat.bookingId}
          otherName={groupChat.tutorName}
          otherUserId={groupChat.tutorId}
          subject={groupChat.subject}
          onClose={() => setGroupChat(null)}
        />
      )}

      {cancelBooking && (
        <CancelSessionModal
          title={`Cancel session with ${cancelBooking.other_name}?`}
          description="This will mark the session as cancelled. You can optionally send a message to let them know why."
          saving={cancellingId === cancelBooking.id}
          onConfirm={msg => handleCancelBooking(cancelBooking, msg)}
          onClose={() => setCancelBooking(null)}
        />
      )}

      {cancelGroup && cancelGroup.perspective === 'student' && (
        <CancelSessionModal
          title={`Leave "${cancelGroup.title}"?`}
          description="You'll be removed from this group session. You can optionally send a message to the tutor."
          confirmLabel="Leave Session"
          saving={cancellingId === cancelGroup.id}
          onConfirm={msg => handleLeaveGroup(cancelGroup, msg)}
          onClose={() => setCancelGroup(null)}
        />
      )}

      {cancelGroup && cancelGroup.perspective === 'tutor' && (
        <CancelSessionModal
          title={`Cancel "${cancelGroup.title}"?`}
          description={`This will cancel the session for all ${cancelGroup.enrollment_count} enrolled student${cancelGroup.enrollment_count !== 1 ? 's' : ''}. You can optionally send them all a message.`}
          saving={cancellingId === cancelGroup.id}
          onConfirm={msg => handleCancelGroupLesson(cancelGroup, msg)}
          onClose={() => setCancelGroup(null)}
        />
      )}

      {reviewLesson && (
        <ReviewModal
          lesson={reviewLesson}
          onSubmit={(rating, body) => handleSubmitReview(reviewLesson, rating, body)}
          onClose={() => setReviewLesson(null)}
        />
      )}
    </div>
  )
}

function LessonCard({ lesson: l, isTutor, onChat, onAccept, onDecline, onCancel, onMarkComplete, completing }: {
  lesson: Lesson
  isTutor: boolean
  onChat: () => void
  onAccept: () => void
  onDecline: () => void
  onCancel: () => void
  onMarkComplete?: () => void
  completing?: boolean
}) {
  const isStudentPerspective = l.perspective === 'student'
  const isCancellable = l.status === 'pending' || l.status === 'accepted'
  const isDimmed = l.status === 'cancelled' || l.status === 'completed'
  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-5 ${isDimmed ? 'border-gray-100 opacity-60' : isStudentPerspective ? 'border-blue-100' : 'border-gray-100'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {isStudentPerspective && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">Your session</span>
            )}
            <div className="flex items-center gap-1.5">
              <User className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="font-bold text-gray-900">{l.other_name}</span>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_STYLE[l.status]}`}>
              {l.status}
            </span>
          </div>
          <span className="text-sm font-bold text-blue-600">{l.subject}</span>
          {l.scheduled_at && (
            <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
              <Clock className="w-3 h-3 shrink-0" />
              {new Date(l.scheduled_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              {' · '}
              {new Date(l.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </span>
          )}
          {l.message && (
            <p className="text-sm text-gray-500 font-medium mt-1 line-clamp-2">{l.message}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {l.perspective === 'tutor' && l.status === 'pending' && (
            <>
              <button
                onClick={onAccept}
                className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700 transition-colors"
              >
                <CheckCircle className="w-4 h-4" /> Accept
              </button>
              <button
                onClick={onDecline}
                className="flex items-center gap-1.5 px-3 py-2 bg-red-100 text-red-600 rounded-xl font-bold text-sm hover:bg-red-200 transition-colors"
              >
                <XCircle className="w-4 h-4" /> Decline
              </button>
            </>
          )}
          {l.status === 'accepted' && (
            <button
              onClick={onChat}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors"
            >
              Message
            </button>
          )}
          {l.status === 'accepted' && onMarkComplete && (
            <button
              onClick={onMarkComplete}
              disabled={completing}
              title="Mark session as completed"
              className="flex items-center gap-1.5 px-3 py-2 bg-teal-50 text-teal-700 rounded-xl font-bold text-sm hover:bg-teal-100 transition-colors border border-teal-200 disabled:opacity-60"
            >
              {completing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Complete
            </button>
          )}
          {isCancellable && (
            <button
              onClick={onCancel}
              title="Cancel session"
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-500 rounded-xl font-bold text-sm hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              <XOctagon className="w-4 h-4" /> Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function GroupCard({ group: g, isTutor: _isTutor, openingChat, onViewEnrollments, onMessage, onLeave, onCancelSession }: {
  group: GroupEntry
  isTutor: boolean
  openingChat?: boolean
  onViewEnrollments?: () => void
  onMessage?: () => void
  onLeave?: () => void
  onCancelSession?: () => void
}) {
  const isTutorPerspective = g.perspective === 'tutor'
  return (
    <div
      className={`bg-white rounded-2xl border shadow-sm p-5 ${isTutorPerspective ? 'border-purple-100' : 'border-blue-100'} ${onViewEnrollments ? 'cursor-pointer hover:border-purple-300 hover:shadow-md transition-all' : ''}`}
      onClick={onViewEnrollments}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Users className="w-4 h-4 text-purple-500 shrink-0" />
            <span className="font-bold text-gray-900">{g.title}</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700">Group</span>
            {!isTutorPerspective && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">Enrolled</span>
            )}
          </div>
          <span className="text-sm font-bold text-purple-600">{g.subject}</span>
          {!isTutorPerspective && g.tutor_name && (
            <span className="text-sm font-medium text-gray-600 flex items-center gap-1">
              <User className="w-3.5 h-3.5 shrink-0 text-gray-400" />
              {g.tutor_name}
            </span>
          )}
          <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
            <Clock className="w-3 h-3 shrink-0" />
            {new Date(g.scheduled_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            {' · '}
            {new Date(g.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            {' · '}{g.duration_minutes} min
          </span>
          {g.location && (
            <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
              <MapPin className="w-3 h-3 shrink-0 text-purple-400" />
              {g.location}
            </span>
          )}
          {isTutorPerspective && (
            <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
              <Users className="w-3 h-3 shrink-0" />
              {g.enrollment_count} / {g.max_students} enrolled
              {onViewEnrollments && <span className="text-purple-500 font-bold ml-1">· View roster</span>}
            </span>
          )}
          {g.price > 0 && (
            <span className="text-xs font-bold text-green-600">${g.price}/student</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {onMessage && (
            <button
              onClick={e => { e.stopPropagation(); onMessage() }}
              disabled={openingChat}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors disabled:opacity-60"
            >
              {openingChat ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
              Message
            </button>
          )}
          {onLeave && (
            <button
              onClick={e => { e.stopPropagation(); onLeave() }}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-500 rounded-xl font-bold text-sm hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              <XOctagon className="w-4 h-4" /> Leave
            </button>
          )}
          {onCancelSession && (
            <button
              onClick={e => { e.stopPropagation(); onCancelSession() }}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-500 rounded-xl font-bold text-sm hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              <XOctagon className="w-4 h-4" /> Cancel
            </button>
          )}
          {onViewEnrollments && (
            <ChevronRight className="w-4 h-4 text-gray-300 shrink-0 mt-0.5" />
          )}
        </div>
      </div>
    </div>
  )
}

function CancelSessionModal({ title, description, confirmLabel = 'Cancel Session', saving, onConfirm, onClose }: {
  title:         string
  description:   string
  confirmLabel?: string
  saving:        boolean
  onConfirm:     (message: string) => void
  onClose:       () => void
}) {
  const [msg, setMsg] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-black text-gray-900 text-lg leading-snug">{title}</h3>
          <button onClick={onClose} disabled={saving} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400 transition-colors shrink-0 disabled:opacity-50">
            <XCircle className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-gray-500 font-medium -mt-1">{description}</p>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
            Message <span className="normal-case font-medium">(optional)</span>
          </label>
          <textarea
            value={msg}
            onChange={e => setMsg(e.target.value)}
            placeholder="Let them know why you're cancelling…"
            rows={3}
            disabled={saving}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-400 resize-none disabled:opacity-60"
          />
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 h-11 border-2 border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Keep Session
          </button>
          <button
            onClick={() => onConfirm(msg)}
            disabled={saving}
            className="flex-1 h-11 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function ReviewModal({ lesson, onSubmit, onClose }: {
  lesson:   Lesson
  onSubmit: (rating: number, body: string) => void
  onClose:  () => void
}) {
  const [rating, setRating]   = useState(0)
  const [hover, setHover]     = useState(0)
  const [body, setBody]       = useState('')
  const [saving, setSaving]   = useState(false)

  async function handleSubmit() {
    if (rating === 0) { toast.error('Please select a star rating.'); return }
    if (!body.trim()) { toast.error('Please write a short review.'); return }
    setSaving(true)
    await onSubmit(rating, body)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-black text-gray-900 text-lg">Rate Your Session</h3>
            <p className="text-sm text-gray-500 font-medium mt-0.5">with {lesson.other_name} · {lesson.subject}</p>
          </div>
          <button onClick={onClose} disabled={saving} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400 transition-colors shrink-0 disabled:opacity-50">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Star picker */}
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5].map(i => (
            <button
              key={i}
              type="button"
              onClick={() => setRating(i)}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(0)}
              className="transition-transform hover:scale-110"
            >
              <Star
                className={`w-8 h-8 transition-colors ${
                  i <= (hover || rating)
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'fill-gray-100 text-gray-300'
                }`}
              />
            </button>
          ))}
          {rating > 0 && (
            <span className="text-sm font-bold text-gray-500 ml-1">
              {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][rating]}
            </span>
          )}
        </div>

        {/* Review text */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Your Review</label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Share what you liked, what could be better, or anything that might help other students…"
            rows={4}
            disabled={saving}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none disabled:opacity-60"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 h-11 border-2 border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Not Now
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || rating === 0}
            className="flex-1 h-11 bg-yellow-400 text-yellow-900 rounded-xl font-bold hover:bg-yellow-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Submit Review
          </button>
        </div>
      </div>
    </div>
  )
}
