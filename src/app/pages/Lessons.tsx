import { useState, useEffect, useMemo } from "react"
import { Link } from "react-router"
import { Navbar } from "../components/Navbar"
import { ChevronLeft, ChevronRight, Calendar, Clock, Loader2, User, CheckCircle, XCircle, Users } from "lucide-react"
import { useAuth } from "../../context/AuthContext"
import { supabase } from "../../lib/supabase"
import { ConversationModal } from "../components/ConversationModal"
import { sendNotificationEmail } from "../../lib/notify"
import { toast } from "sonner"

interface Lesson {
  id:            string
  subject:       string
  status:        'pending' | 'accepted' | 'declined'
  scheduled_at:  string | null
  created_at:    string
  message:       string
  other_name:    string
  other_user_id: string
  perspective:   'tutor' | 'student'  // whether the current user is the tutor or student in this booking
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
}

const STATUS_STYLE: Record<string, string> = {
  pending:  'bg-yellow-100 text-yellow-700',
  accepted: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-600',
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

    Promise.all([queries, groupTutorQ, groupStudentQ]).then(([[tutorRes, studentRes], groupTutorRes, groupStudentRes]) => {
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
      }))
      const groupAsStudent: GroupEntry[] = ((groupStudentRes.data ?? []) as any[])
        .filter((e: any) => e.group_lessons)
        .map((e: any) => {
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
                    {visibleGroups.map(g => <GroupCard key={g.id} group={g} isTutor={isTutor} />)}
                  </div>
                </div>
              )}
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
    </div>
  )
}

function LessonCard({ lesson: l, isTutor, onChat, onAccept, onDecline }: {
  lesson: Lesson
  isTutor: boolean
  onChat: () => void
  onAccept: () => void
  onDecline: () => void
}) {
  const isStudentPerspective = l.perspective === 'student'
  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-5 ${isStudentPerspective ? 'border-blue-100' : 'border-gray-100'}`}>
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

        <div className="flex items-center gap-2 shrink-0">
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
        </div>
      </div>
    </div>
  )
}

function GroupCard({ group: g, isTutor }: { group: GroupEntry; isTutor: boolean }) {
  const isTutorPerspective = g.perspective === 'tutor'
  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-5 ${isTutorPerspective ? 'border-purple-100' : 'border-blue-100'}`}>
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
          <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
            <Clock className="w-3 h-3 shrink-0" />
            {new Date(g.scheduled_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            {' · '}
            {new Date(g.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            {' · '}{g.duration_minutes} min
          </span>
          {isTutorPerspective && (
            <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
              <Users className="w-3 h-3 shrink-0" />
              {g.enrollment_count} / {g.max_students} enrolled
            </span>
          )}
          {g.price > 0 && (
            <span className="text-xs font-bold text-green-600">${g.price}/student</span>
          )}
        </div>
      </div>
    </div>
  )
}
