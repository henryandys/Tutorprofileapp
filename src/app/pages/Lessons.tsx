import { useState, useEffect, useMemo } from "react"
import { Link } from "react-router"
import { Navbar } from "../components/Navbar"
import { ChevronLeft, ChevronRight, Calendar, Clock, Loader2, User, CheckCircle, XCircle } from "lucide-react"
import { useAuth } from "../../context/AuthContext"
import { supabase } from "../../lib/supabase"
import { ConversationModal } from "../components/ConversationModal"
import { sendNotificationEmail } from "../../lib/notify"
import { toast } from "sonner"

interface Lesson {
  id:           string
  subject:      string
  status:       'pending' | 'accepted' | 'declined'
  scheduled_at: string | null
  created_at:   string
  message:      string
  other_name:   string
  other_user_id: string
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

  const [lessons, setLessons]       = useState<Lesson[]>([])
  const [loading, setLoading]       = useState(true)
  const [calMonth, setCalMonth]     = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [chatLesson, setChatLesson]  = useState<Lesson | null>(null)

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
    const q = isTutor
      ? supabase.from('bookings').select('id,subject,status,scheduled_at,created_at,message,student_name,student_id').eq('tutor_id', user.id)
      : supabase.from('bookings').select('id,subject,status,scheduled_at,created_at,message,tutor_id,tutor:tutor_id(full_name)').eq('student_id', user.id)
    q.then(({ data }) => {
      setLessons((data ?? []).map((b: any) => ({
        id:            b.id,
        subject:       b.subject,
        status:        b.status,
        scheduled_at:  b.scheduled_at ?? null,
        created_at:    b.created_at,
        message:       b.message ?? '',
        other_name:    isTutor ? b.student_name : (b.tutor?.full_name ?? 'Tutor'),
        other_user_id: isTutor ? b.student_id   : b.tutor_id,
      })))
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
                    const isToday    = key === today.toDateString()
                    const isSelected = selectedDay?.toDateString() === key
                    const hasAccepted = dayLessons.some(l => l.status === 'accepted')
                    const hasPending  = dayLessons.some(l => l.status === 'pending')
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
                        {dayLessons.length > 0 && (
                          <div className="flex gap-0.5 mt-0.5">
                            {hasAccepted && <span className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-green-500'}`} />}
                            {hasPending  && <span className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white/80' : 'bg-yellow-400'}`} />}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-100">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                    <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" /> Accepted
                  </span>
                  <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                    <span className="w-2 h-2 rounded-full bg-yellow-400 shrink-0" /> Pending
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
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
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
          {isTutor && l.status === 'pending' && (
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
