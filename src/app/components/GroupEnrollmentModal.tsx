import { useState, useEffect } from "react"
import { X, Users, Loader2, MessageCircle, UserMinus, Send } from "lucide-react"
import { toast } from "sonner"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../context/AuthContext"
import { ConversationModal } from "./ConversationModal"

interface Enrollment {
  id:           string
  student_id:   string
  student_name: string
  enrolled_at:  string
}

interface Group {
  id:           string
  title:        string
  subject:      string
  scheduled_at: string
  max_students: number
}

interface Props {
  group:    Group
  onClose:  () => void
  onRemove?: (enrollmentId: string) => void
}

export function GroupEnrollmentModal({ group: g, onClose, onRemove }: Props) {
  const { user, profile } = useAuth()
  const [enrollments, setEnrollments]   = useState<Enrollment[]>([])
  const [loading, setLoading]           = useState(true)
  const [removingId, setRemovingId]     = useState<string | null>(null)
  const [messagingId, setMessagingId]   = useState<string | null>(null)
  const [chatBookingId, setChatBookingId]     = useState<string | null>(null)
  const [chatStudentName, setChatStudentName] = useState('')
  const [chatStudentId, setChatStudentId]     = useState('')
  const [broadcastOpen, setBroadcastOpen]     = useState(false)
  const [broadcastText, setBroadcastText]     = useState('')
  const [broadcasting, setBroadcasting]       = useState(false)

  useEffect(() => {
    supabase
      .from('group_lesson_enrollments')
      .select('id, student_id, student_name, enrolled_at')
      .eq('group_lesson_id', g.id)
      .order('enrolled_at', { ascending: true })
      .then(({ data }) => {
        setEnrollments(data ?? [])
        setLoading(false)
      })
  }, [g.id])

  async function handleRemove(enrollment: Enrollment) {
    setRemovingId(enrollment.id)
    const { error } = await supabase
      .from('group_lesson_enrollments')
      .delete()
      .eq('id', enrollment.id)
    if (error) {
      toast.error('Could not remove student: ' + error.message)
    } else {
      setEnrollments(prev => prev.filter(e => e.id !== enrollment.id))
      onRemove?.(enrollment.id)
      toast.success(`${enrollment.student_name} removed from session.`)
    }
    setRemovingId(null)
  }

  async function handleMessage(enrollment: Enrollment) {
    if (!user) return
    setMessagingId(enrollment.id)
    // Find or create a booking to anchor the conversation
    const { data: existing } = await supabase
      .from('bookings')
      .select('id')
      .eq('tutor_id', user.id)
      .eq('student_id', enrollment.student_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    if (existing) {
      setChatStudentName(enrollment.student_name)
      setChatStudentId(enrollment.student_id)
      setChatBookingId(existing.id)
      setMessagingId(null)
      return
    }
    const { data: created, error } = await supabase
      .from('bookings')
      .insert({
        tutor_id:     user.id,
        student_id:   enrollment.student_id,
        student_name: enrollment.student_name,
        subject:      g.subject,
        message:      '',
        status:       'pending',
      })
      .select('id')
      .single()
    if (error || !created) {
      toast.error('Could not open chat.')
    } else {
      setChatStudentName(enrollment.student_name)
      setChatStudentId(enrollment.student_id)
      setChatBookingId(created.id)
    }
    setMessagingId(null)
  }

  async function handleMessageAll() {
    if (!user || !broadcastText.trim() || enrollments.length === 0) return
    setBroadcasting(true)
    let sent = 0, failed = 0

    for (const enrollment of enrollments) {
      let bookingId: string | null = null

      const { data: existing } = await supabase
        .from('bookings')
        .select('id')
        .eq('tutor_id', user.id)
        .eq('student_id', enrollment.student_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (existing) {
        bookingId = existing.id
      } else {
        const { data: created } = await supabase
          .from('bookings')
          .insert({
            tutor_id:     user.id,
            student_id:   enrollment.student_id,
            student_name: enrollment.student_name,
            subject:      g.subject,
            message:      '',
            status:       'pending',
          })
          .select('id')
          .single()
        bookingId = created?.id ?? null
      }

      if (bookingId) {
        const { error } = await supabase
          .from('messages')
          .insert({ booking_id: bookingId, sender_id: user.id, content: broadcastText.trim() })
        error ? failed++ : sent++
      } else {
        failed++
      }
    }

    setBroadcasting(false)
    setBroadcastOpen(false)
    setBroadcastText('')
    if (failed === 0) {
      toast.success(`Message sent to ${sent} student${sent !== 1 ? 's' : ''}.`)
    } else {
      toast.error(`Sent to ${sent}, failed for ${failed}.`)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden max-h-[80vh]">

          {/* Header */}
          <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100 shrink-0">
            <div>
              <h3 className="font-black text-gray-900">{g.title}</h3>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                {new Date(g.scheduled_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}{' '}
                · {new Date(g.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Count bar */}
          <div className="px-6 py-3 bg-purple-50 border-b border-purple-100 flex items-center justify-between shrink-0">
            <span className="text-sm font-bold text-purple-700 flex items-center gap-2">
              <Users className="w-4 h-4" />
              {loading ? '…' : enrollments.length} / {g.max_students} enrolled
            </span>
            <div className="flex items-center gap-3">
              {!loading && enrollments.length > 0 && (
                <button
                  onClick={() => setBroadcastOpen(v => !v)}
                  className="flex items-center gap-1.5 text-xs font-bold text-purple-700 hover:text-purple-900 transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  Message All
                </button>
              )}
              <div className="w-24 h-2 bg-purple-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all"
                  style={{ width: loading ? '0%' : `${Math.min(100, (enrollments.length / g.max_students) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Broadcast compose */}
          {broadcastOpen && (
            <div className="px-6 py-4 bg-blue-50 border-b border-blue-100 flex flex-col gap-3 shrink-0">
              <p className="text-xs font-bold text-blue-600 uppercase tracking-widest">
                Message all {enrollments.length} student{enrollments.length !== 1 ? 's' : ''}
              </p>
              <textarea
                value={broadcastText}
                onChange={e => setBroadcastText(e.target.value)}
                placeholder="Type your message…"
                rows={3}
                disabled={broadcasting}
                className="w-full px-4 py-3 border border-blue-200 rounded-xl text-sm font-medium text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none disabled:opacity-60"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setBroadcastOpen(false); setBroadcastText('') }}
                  disabled={broadcasting}
                  className="flex-1 h-9 border-2 border-gray-200 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleMessageAll}
                  disabled={broadcasting || !broadcastText.trim()}
                  className="flex-1 h-9 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {broadcasting
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending…</>
                    : <><Send className="w-3.5 h-3.5" /> Send</>}
                </button>
              </div>
            </div>
          )}

          {/* Student list */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
              </div>
            ) : enrollments.length === 0 ? (
              <div className="text-center py-10">
                <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="font-bold text-gray-400">No one enrolled yet</p>
              </div>
            ) : (
              <ul className="flex flex-col divide-y divide-gray-100">
                {enrollments.map((e, i) => (
                  <li key={e.id} className="flex items-center gap-3 py-3.5">
                    <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-black text-sm shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-bold text-gray-900">{e.student_name}</span>
                      <span className="text-xs text-gray-400 font-medium">
                        Enrolled {new Date(e.enrolled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleMessage(e)}
                        disabled={messagingId === e.id}
                        title="Message student"
                        className="p-2 rounded-xl text-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-50"
                      >
                        {messagingId === e.id
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <MessageCircle className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleRemove(e)}
                        disabled={removingId === e.id}
                        title="Remove from session"
                        className="p-2 rounded-xl text-red-400 hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        {removingId === e.id
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <UserMinus className="w-4 h-4" />}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {chatBookingId && (
        <ConversationModal
          bookingId={chatBookingId}
          otherName={chatStudentName}
          otherUserId={chatStudentId}
          subject={g.subject}
          onClose={() => {
            setChatBookingId(null)
            setChatStudentName('')
            setChatStudentId('')
          }}
        />
      )}
    </>
  )
}
