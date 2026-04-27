import { useState, useEffect, useMemo } from "react"
import { Link, useSearchParams } from "react-router"
import { Navbar } from "../components/Navbar"
import { ChevronLeft, ChevronRight, Calendar, Clock, Loader2, User, CheckCircle, XCircle, Users, MessageCircle, XOctagon, MapPin, Star, RefreshCw, Square, CheckSquare, CreditCard, Timer, StickyNote } from "lucide-react"
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
  reschedule_proposed_at: string | null
  reschedule_status:      'pending' | 'accepted' | 'declined' | null
  reschedule_proposed_by: string | null
  price_cents:            number | null
  payment_status:         'pending' | 'paid' | 'refunded' | null
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
  recurrence_type:  string | null
}

const STATUS_STYLE: Record<string, string> = {
  pending:   'bg-yellow-100 text-yellow-700',
  accepted:  'bg-green-100 text-green-700',
  declined:  'bg-red-100 text-red-600',
  cancelled: 'bg-gray-100 text-gray-500',
  completed: 'bg-teal-100 text-teal-700',
}

const DOW      = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const DOW_KEYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
const MONTHS   = ['January','February','March','April','May','June','July','August','September','October','November','December']

function generateSlots(start: string, end: string): string[] {
  const slots: string[] = []
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  let mins = sh * 60 + sm
  const endMins = eh * 60 + em
  while (mins < endMins) {
    const h = Math.floor(mins / 60); const m = mins % 60
    const period = h >= 12 ? 'PM' : 'AM'; const hour = h % 12 || 12
    slots.push(`${hour}:${String(m).padStart(2, '0')} ${period}`)
    mins += 30
  }
  return slots
}
function slotToMinutes(slot: string): number {
  const [time, period] = slot.split(' '); const [hStr, mStr] = time.split(':')
  let h = parseInt(hStr); const m = parseInt(mStr)
  if (period === 'PM' && h !== 12) h += 12
  if (period === 'AM' && h === 12) h = 0
  return h * 60 + m
}
function toScheduledAt(date: Date, slot: string): string {
  const d = new Date(date); const mins = slotToMinutes(slot)
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0); return d.toISOString()
}
function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getCountdown(scheduledAt: string): { label: string; cls: string } | null {
  const now = new Date()
  const t = new Date(scheduledAt)
  const diffMs = t.getTime() - now.getTime()
  if (diffMs <= 0) return null

  const todayMidnight = new Date(now); todayMidnight.setHours(0, 0, 0, 0)
  const lessonMidnight = new Date(t); lessonMidnight.setHours(0, 0, 0, 0)
  const daysDiff = Math.round((lessonMidnight.getTime() - todayMidnight.getTime()) / 86_400_000)

  const hrs  = Math.floor(diffMs / 3_600_000)
  const mins = Math.ceil(diffMs / 60_000)

  if (daysDiff === 0) {
    if (mins < 60) return { label: `in ${mins}m`, cls: 'bg-red-100 text-red-700' }
    return { label: `Today · ${hrs}h away`, cls: 'bg-red-100 text-red-700' }
  }
  if (daysDiff === 1) return { label: 'Tomorrow', cls: 'bg-amber-100 text-amber-700' }
  if (daysDiff <= 7)  return { label: `in ${daysDiff} days`, cls: 'bg-blue-100 text-blue-700' }
  return null
}

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
  const [rescheduleLesson, setRescheduleLesson] = useState<Lesson | null>(null)
  const [cancelBooking, setCancelBooking]   = useState<Lesson | null>(null)
  const [cancelGroup, setCancelGroup]       = useState<GroupEntry | null>(null)
  const [cancellingId, setCancellingId]     = useState<string | null>(null)
  const [declineLesson, setDeclineLesson]   = useState<Lesson | null>(null)
  const [decliningId, setDecliningId]       = useState<string | null>(null)
  const [declineBatch, setDeclineBatch]     = useState(false)
  const [completingId, setCompletingId]     = useState<string | null>(null)
  const [reviewLesson, setReviewLesson]     = useState<Lesson | null>(null)
  const [reviewedTutors, setReviewedTutors] = useState<Set<string>>(new Set())
  const [dismissedIds, setDismissedIds]     = useState<Set<string>>(new Set())
  const [selectedIds, setSelectedIds]       = useState<Set<string>>(new Set())
  const [batchProcessing, setBatchProcessing] = useState(false)
  const [payingId, setPayingId]             = useState<string | null>(null)
  const [searchParams, setSearchParams]     = useSearchParams()
  const [notes, setNotes]                   = useState<Record<string, string>>({})
  const [noteLesson, setNoteLesson]         = useState<Lesson | null>(null)
  const [waitlistedGroups, setWaitlistedGroups] = useState<GroupEntry[]>([])
  const [leavingWaitlistId, setLeavingWaitlistId] = useState<string | null>(null)

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

  async function handleLeaveWaitlist(groupId: string) {
    if (!user) return
    setLeavingWaitlistId(groupId)
    await supabase.from('group_lesson_waitlist').delete().eq('group_lesson_id', groupId).eq('student_id', user.id)
    setWaitlistedGroups(prev => prev.filter(g => g.id !== groupId))
    setLeavingWaitlistId(null)
    toast.success('Removed from waitlist.')
  }

  async function handleLeaveGroup(g: GroupEntry, message: string) {
    if (!user) return
    setCancellingId(g.id)
    const { error } = await supabase.from('group_lesson_enrollments')
      .delete().eq('group_lesson_id', g.id).eq('student_id', user.id)
    if (error) { toast.error('Could not leave session.'); setCancellingId(null); return }
    // Notify the first person on the waitlist that a spot opened
    supabase
      .from('group_lesson_waitlist')
      .select('student_id, student_name')
      .eq('group_lesson_id', g.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .then(({ data }) => {
        if (!data || data.length === 0) return
        sendNotificationEmail({
          type:        'waitlist_spot_open',
          recipientId: data[0].student_id,
          data: { sessionTitle: g.title, subject: g.subject, tutorName: g.tutor_name ?? 'your tutor' },
        })
      })
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

  async function updateStatus(lessonId: string, status: 'accepted') {
    const { error } = await supabase
      .from('bookings')
      .update({ status })
      .eq('id', lessonId)
      .eq('tutor_id', user!.id)
    if (error) { toast.error('Failed to update booking.'); return }
    setLessons(prev => prev.map(l => {
      if (l.id !== lessonId) return l
      sendNotificationEmail({
        type: 'booking_accepted',
        recipientId: l.other_user_id,
        data: { tutorName: profile?.full_name ?? 'Your tutor', studentName: l.other_name, subject: l.subject },
      })
      return { ...l, status }
    }))
    setSelectedIds(prev => { const next = new Set(prev); next.delete(lessonId); return next })
    toast.success('Booking accepted.')
  }

  async function handleDeclineBooking(lesson: Lesson, reason: string) {
    setDecliningId(lesson.id)
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'declined' })
      .eq('id', lesson.id)
      .eq('tutor_id', user!.id)
    if (error) { toast.error('Failed to decline booking.'); setDecliningId(null); return }
    await supabase.from('messages').insert({ booking_id: lesson.id, sender_id: user!.id, content: reason.trim() })
    sendNotificationEmail({
      type: 'booking_declined',
      recipientId: lesson.other_user_id,
      data: { tutorName: profile?.full_name ?? 'Your tutor', studentName: lesson.other_name, subject: lesson.subject },
    })
    setLessons(prev => prev.map(l => l.id === lesson.id ? { ...l, status: 'declined' as const } : l))
    setSelectedIds(prev => { const next = new Set(prev); next.delete(lesson.id); return next })
    setDeclineLesson(null)
    setDecliningId(null)
    toast.success('Booking declined.')
  }

  useEffect(() => {
    if (!user) return

    const asTutorQ   = supabase.from('bookings').select('*').eq('tutor_id', user.id)
    const asStudentQ = supabase.from('bookings').select('*, tutor:tutor_id(full_name)').eq('student_id', user.id)

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
        id:                     b.id,
        subject:                b.subject,
        status:                 b.status,
        scheduled_at:           b.scheduled_at ?? null,
        created_at:             b.created_at,
        message:                b.message ?? '',
        other_name:             b.student_name,
        other_user_id:          b.student_id,
        perspective:            'tutor' as const,
        reschedule_proposed_at: b.reschedule_proposed_at ?? null,
        reschedule_status:      b.reschedule_status ?? null,
        reschedule_proposed_by: b.reschedule_proposed_by ?? null,
        price_cents:            b.price_cents ?? null,
        payment_status:         b.payment_status ?? null,
      }))
      const asStudent: Lesson[] = ((studentRes?.data ?? []) as any[]).map(b => ({
        id:                     b.id,
        subject:                b.subject,
        status:                 b.status,
        scheduled_at:           b.scheduled_at ?? null,
        created_at:             b.created_at,
        message:                b.message ?? '',
        other_name:             b.tutor?.full_name ?? 'Tutor',
        other_user_id:          b.tutor_id,
        perspective:            'student' as const,
        reschedule_proposed_at: b.reschedule_proposed_at ?? null,
        reschedule_status:      b.reschedule_status ?? null,
        reschedule_proposed_by: b.reschedule_proposed_by ?? null,
        price_cents:            b.price_cents ?? null,
        payment_status:         b.payment_status ?? null,
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
        recurrence_type:  g.recurrence_type ?? null,
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
          recurrence_type:  g.recurrence_type ?? null,
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

  // Load dismissed lesson IDs from localStorage
  useEffect(() => {
    if (!user) return
    const stored: string[] = JSON.parse(localStorage.getItem(`dismissedLessons_${user.id}`) ?? '[]')
    setDismissedIds(new Set(stored))
  }, [user])

  // Load waitlisted group sessions for students
  useEffect(() => {
    if (!user || isTutor) return
    supabase
      .from('group_lesson_waitlist')
      .select('group_lesson_id, group_lessons(id, title, subject, scheduled_at, duration_minutes, max_students, price, tutor_id, group_lesson_enrollments(count))')
      .eq('student_id', user.id)
      .then(async ({ data }) => {
        if (!data || data.length === 0) return
        const rows = data as any[]
        const tutorIds = [...new Set(rows.map(r => r.group_lessons?.tutor_id as string).filter(Boolean))]
        const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', tutorIds)
        const nameMap: Record<string, string> = {}
        for (const p of profiles ?? []) nameMap[p.id] = p.full_name
        setWaitlistedGroups(rows.map(r => {
          const g = r.group_lessons
          if (!g) return null
          return {
            id:               g.id,
            title:            g.title,
            subject:          g.subject,
            scheduled_at:     g.scheduled_at,
            duration_minutes: g.duration_minutes,
            max_students:     g.max_students,
            price:            g.price,
            enrollment_count: g.group_lesson_enrollments?.[0]?.count ?? 0,
            perspective:      'student' as const,
            tutor_name:       nameMap[g.tutor_id] ?? null,
            tutor_id:         g.tutor_id ?? null,
            location:         null,
            recurrence_type:  null,
          }
        }).filter(Boolean) as GroupEntry[])
      })
  }, [user, isTutor])

  // Load private notes for all completed lessons
  useEffect(() => {
    if (!user || lessons.length === 0) return
    const completedIds = lessons.filter(l => l.status === 'completed').map(l => l.id)
    if (completedIds.length === 0) return
    supabase
      .from('session_notes')
      .select('booking_id, content')
      .eq('user_id', user.id)
      .in('booking_id', completedIds)
      .then(({ data }) => {
        const map: Record<string, string> = {}
        for (const n of data ?? []) map[n.booking_id] = n.content
        setNotes(map)
      })
  }, [user, lessons])

  function handleDismiss(id: string) {
    const next = new Set([...dismissedIds, id])
    setDismissedIds(next)
    if (user) localStorage.setItem(`dismissedLessons_${user.id}`, JSON.stringify([...next]))
  }

  async function handleRescheduleRequest(lesson: Lesson, proposedAt: string) {
    const { error } = await supabase
      .from('bookings')
      .update({ reschedule_proposed_at: proposedAt, reschedule_status: 'pending', reschedule_proposed_by: user!.id })
      .eq('id', lesson.id)
    if (error) { toast.error('Failed to send reschedule request.'); return }
    setLessons(prev => prev.map(l =>
      l.id === lesson.id
        ? { ...l, reschedule_proposed_at: proposedAt, reschedule_status: 'pending' as const, reschedule_proposed_by: user!.id }
        : l
    ))
    setRescheduleLesson(null)
    toast.success('Reschedule request sent!')
  }

  async function handleRescheduleResponse(lesson: Lesson, accept: boolean) {
    const updates = accept
      ? { scheduled_at: lesson.reschedule_proposed_at, reschedule_proposed_at: null, reschedule_status: 'accepted' as const }
      : { reschedule_proposed_at: null, reschedule_status: 'declined' as const }
    // Verify user is the responder (not the proposer) via the appropriate FK column
    const userField = lesson.perspective === 'tutor' ? 'tutor_id' : 'student_id'
    const { error } = await supabase
      .from('bookings')
      .update(updates)
      .eq('id', lesson.id)
      .eq(userField, user!.id)
    if (error) { toast.error('Failed to update reschedule.'); return }
    setLessons(prev => prev.map(l => l.id === lesson.id ? { ...l, ...updates } : l))
    toast.success(accept ? 'Reschedule approved!' : 'Reschedule declined.')
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function handleBatchAction(status: 'accepted' | 'declined') {
    if (status === 'declined') { setDeclineBatch(true); return }
    const ids = [...selectedIds]
    if (ids.length === 0) return
    setBatchProcessing(true)
    const { error } = await supabase
      .from('bookings')
      .update({ status })
      .in('id', ids)
      .eq('tutor_id', user!.id)
    if (error) { toast.error('Batch update failed.'); setBatchProcessing(false); return }
    const updated = lessons.filter(l => ids.includes(l.id))
    for (const l of updated) {
      sendNotificationEmail({
        type: 'booking_accepted',
        recipientId: l.other_user_id,
        data: { tutorName: profile?.full_name ?? 'Your tutor', studentName: l.other_name, subject: l.subject },
      })
    }
    setLessons(prev => prev.map(l => ids.includes(l.id) ? { ...l, status } : l))
    setSelectedIds(new Set())
    setBatchProcessing(false)
    toast.success(`${ids.length} booking${ids.length !== 1 ? 's' : ''} accepted.`)
  }

  async function handleBatchDecline(reason: string) {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    setBatchProcessing(true)
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'declined' })
      .in('id', ids)
      .eq('tutor_id', user!.id)
    if (error) { toast.error('Batch update failed.'); setBatchProcessing(false); return }
    const updated = lessons.filter(l => ids.includes(l.id))
    await Promise.all(updated.map(l =>
      supabase.from('messages').insert({ booking_id: l.id, sender_id: user!.id, content: reason.trim() })
    ))
    for (const l of updated) {
      sendNotificationEmail({
        type: 'booking_declined',
        recipientId: l.other_user_id,
        data: { tutorName: profile?.full_name ?? 'Your tutor', studentName: l.other_name, subject: l.subject },
      })
    }
    setLessons(prev => prev.map(l => ids.includes(l.id) ? { ...l, status: 'declined' as const } : l))
    setSelectedIds(new Set())
    setBatchProcessing(false)
    setDeclineBatch(false)
    toast.success(`${ids.length} booking${ids.length !== 1 ? 's' : ''} declined.`)
  }

  // Show toast when Stripe redirects back
  useEffect(() => {
    const result = searchParams.get('payment')
    if (!result) return
    if (result === 'success') toast.success('Payment successful! Your session is confirmed.')
    if (result === 'cancelled') toast.info('Payment cancelled.')
    setSearchParams({}, { replace: true })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handlePay(lesson: Lesson) {
    if (!user) return
    setPayingId(lesson.id)
    const { data: { session } } = await import('../../lib/supabase').then(m => m.supabase.auth.getSession())
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
          studentName: profile?.full_name ?? user.email?.split('@')[0] ?? 'Student',
          tutorName:   lesson.other_name,
          successUrl:  `${window.location.origin}/lessons?payment=success`,
          cancelUrl:   `${window.location.origin}/lessons?payment=cancelled`,
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

  async function handleSaveNote(bookingId: string, content: string) {
    if (!user) return
    const { error } = await supabase
      .from('session_notes')
      .upsert(
        { booking_id: bookingId, user_id: user.id, content, updated_at: new Date().toISOString() },
        { onConflict: 'booking_id,user_id' },
      )
    if (error) { toast.error('Failed to save note.'); return }
    setNotes(prev => ({ ...prev, [bookingId]: content }))
    setNoteLesson(null)
    toast.success('Note saved!')
  }

  const activeLessons = useMemo(
    () => lessons.filter(l => !dismissedIds.has(l.id)),
    [lessons, dismissedIds]
  )

  const byDate = useMemo(() => {
    const map: Record<string, Lesson[]> = {}
    for (const l of activeLessons) {
      if (!l.scheduled_at) continue
      const key = new Date(l.scheduled_at).toDateString()
      ;(map[key] ??= []).push(l)
    }
    return map
  }, [activeLessons])

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
    return activeLessons
      .filter(l => l.scheduled_at && new Date(l.scheduled_at) >= today)
      .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())
  }, [selectedDay, byDate, activeLessons, today])

  const unscheduled = useMemo(() =>
    activeLessons.filter(l => !l.scheduled_at), [activeLessons])

  const needsReview = useMemo(() =>
    activeLessons.filter(l =>
      l.status === 'completed' &&
      l.perspective === 'student' &&
      !reviewedTutors.has(l.other_user_id)
    ), [activeLessons, reviewedTutors])

  const pendingFromStudents = useMemo(
    () => activeLessons.filter(l => l.perspective === 'tutor' && l.status === 'pending'),
    [activeLessons]
  )

  // Completed lessons not still prompting a review (reviewed, or tutor-side)
  const pastLessons = useMemo(() =>
    activeLessons
      .filter(l => l.status === 'completed' && (isTutor || reviewedTutors.has(l.other_user_id)))
      .sort((a, b) =>
        new Date(b.scheduled_at ?? b.created_at).getTime() -
        new Date(a.scheduled_at ?? a.created_at).getTime()
      ),
    [activeLessons, isTutor, reviewedTutors]
  )

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
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-black text-gray-900">
                  {selectedDay
                    ? selectedDay.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
                    : 'Upcoming Lessons'}
                </h2>
                {isTutor && pendingFromStudents.length > 1 && !selectedDay && (
                  <button
                    onClick={() => {
                      if (selectedIds.size === pendingFromStudents.length) setSelectedIds(new Set())
                      else setSelectedIds(new Set(pendingFromStudents.map(l => l.id)))
                    }}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    {selectedIds.size === pendingFromStudents.length
                      ? 'Deselect all'
                      : `Select all ${pendingFromStudents.length} pending`}
                  </button>
                )}
              </div>

              {/* Batch action bar */}
              {isTutor && selectedIds.size > 0 && (
                <div className="flex items-center justify-between gap-4 bg-blue-600 text-white rounded-2xl px-5 py-3 mb-4 shadow-lg">
                  <span className="text-sm font-bold">{selectedIds.size} selected</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleBatchAction('accepted')}
                      disabled={batchProcessing}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-green-700 rounded-lg font-bold text-sm hover:bg-green-50 transition-colors disabled:opacity-60"
                    >
                      {batchProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      Accept all
                    </button>
                    <button
                      onClick={() => handleBatchAction('declined')}
                      disabled={batchProcessing}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 text-white rounded-lg font-bold text-sm hover:bg-white/30 transition-colors disabled:opacity-60"
                    >
                      <XCircle className="w-4 h-4" /> Decline all
                    </button>
                    <button
                      onClick={() => setSelectedIds(new Set())}
                      disabled={batchProcessing}
                      className="px-2 py-1.5 text-white/70 hover:text-white font-bold text-xs transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}

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
                      onDecline={() => setDeclineLesson(l)}
                      onCancel={() => setCancelBooking(l)}
                      onMarkComplete={isTutor ? () => handleMarkComplete(l) : undefined}
                      completing={completingId === l.id}
                      onDismiss={() => handleDismiss(l.id)}
                      onReschedule={l.status === 'accepted' && !l.reschedule_status ? () => setRescheduleLesson(l) : undefined}
                      onRescheduleAccept={l.reschedule_status === 'pending' && l.reschedule_proposed_by === l.other_user_id ? () => handleRescheduleResponse(l, true) : undefined}
                      onRescheduleDecline={l.reschedule_status === 'pending' && l.reschedule_proposed_by === l.other_user_id ? () => handleRescheduleResponse(l, false) : undefined}
                      selected={selectedIds.has(l.id)}
                      onToggleSelect={isTutor && l.perspective === 'tutor' && l.status === 'pending' ? () => toggleSelect(l.id) : undefined}
                      onPay={l.perspective === 'student' && l.status === 'accepted' && (l.price_cents ?? 0) > 0 && l.payment_status !== 'paid' ? () => handlePay(l) : undefined}
                      paying={payingId === l.id}
                      onNote={l.status === 'completed' ? () => setNoteLesson(l) : undefined}
                      notePreview={notes[l.id]}
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
                        onDismiss={() => handleDismiss(l.id)}
                        onNote={l.status === 'completed' ? () => setNoteLesson(l) : undefined}
                        notePreview={notes[l.id]}
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
                    {notes[l.id] && (
                      <span className="text-xs text-gray-400 italic line-clamp-1 flex items-center gap-1 mt-0.5">
                        <StickyNote className="w-3 h-3 shrink-0 text-gray-300" /> {notes[l.id]}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setNoteLesson(l)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm hover:bg-blue-50 hover:text-blue-600 transition-colors"
                    >
                      <StickyNote className="w-4 h-4" /> {notes[l.id] ? 'Note' : 'Add Note'}
                    </button>
                    <button
                      onClick={() => setReviewLesson(l)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-yellow-400 text-yellow-900 rounded-xl font-bold text-sm hover:bg-yellow-500 transition-colors"
                    >
                      <Star className="w-4 h-4 fill-yellow-900" /> Rate Session
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* ── Waitlisted Sessions ── */}
        {!loading && !isTutor && waitlistedGroups.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-500" />
              Waitlisted Sessions
            </h2>
            <div className="flex flex-col gap-3">
              {waitlistedGroups.map(g => (
                <div key={g.id} className="bg-white rounded-2xl border border-amber-100 shadow-sm p-5 flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">⏳ Waitlisted</span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700">Group</span>
                    </div>
                    <span className="font-bold text-gray-900">{g.title}</span>
                    <span className="text-sm font-bold text-purple-600">{g.subject}</span>
                    {g.tutor_name && (
                      <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
                        <User className="w-3 h-3 shrink-0 text-gray-400" /> {g.tutor_name}
                      </span>
                    )}
                    <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3 shrink-0" />
                      {new Date(g.scheduled_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                      {' · '}
                      {new Date(g.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </span>
                    <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
                      <Users className="w-3 h-3 shrink-0" />
                      {g.enrollment_count} / {g.max_students} enrolled · Full
                    </span>
                  </div>
                  <button
                    onClick={() => handleLeaveWaitlist(g.id)}
                    disabled={leavingWaitlistId === g.id}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-500 rounded-xl font-bold text-sm hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-60"
                  >
                    {leavingWaitlistId === g.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <XOctagon className="w-4 h-4" />}
                    Leave
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Past Sessions (with notes) ── */}
        {!loading && pastLessons.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
              <StickyNote className="w-5 h-5 text-gray-400" />
              Past Sessions
            </h2>
            <div className="flex flex-col gap-3">
              {pastLessons.map(l => (
                <LessonCard
                  key={`past-${l.id}`}
                  lesson={l}
                  isTutor={isTutor}
                  onChat={() => setChatLesson(l)}
                  onAccept={() => {}}
                  onDecline={() => {}}
                  onCancel={() => {}}
                  onDismiss={() => handleDismiss(l.id)}
                  onNote={() => setNoteLesson(l)}
                  notePreview={notes[l.id]}
                />
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
          description={
            cancelBooking.perspective === 'tutor'
              ? 'This will cancel the session. Please explain why so the student knows.'
              : 'This will mark the session as cancelled. You can optionally send a message to let them know why.'
          }
          required={cancelBooking.perspective === 'tutor'}
          saving={cancellingId === cancelBooking.id}
          onConfirm={msg => handleCancelBooking(cancelBooking, msg)}
          onClose={() => setCancelBooking(null)}
        />
      )}

      {declineLesson && (
        <CancelSessionModal
          title={`Decline request from ${declineLesson.other_name}?`}
          description="Please let the student know why you're unable to take this booking."
          confirmLabel="Decline Request"
          required
          saving={decliningId === declineLesson.id}
          onConfirm={reason => handleDeclineBooking(declineLesson, reason)}
          onClose={() => setDeclineLesson(null)}
        />
      )}

      {declineBatch && (
        <CancelSessionModal
          title={`Decline ${selectedIds.size} request${selectedIds.size !== 1 ? 's' : ''}?`}
          description="Please provide a reason that will be sent to all selected students."
          confirmLabel="Decline All"
          required
          saving={batchProcessing}
          onConfirm={reason => handleBatchDecline(reason)}
          onClose={() => setDeclineBatch(false)}
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

      {rescheduleLesson && (
        <RescheduleModal
          lesson={rescheduleLesson}
          tutorId={rescheduleLesson.perspective === 'student' ? rescheduleLesson.other_user_id : user!.id}
          onConfirm={async (proposedAt) => { await handleRescheduleRequest(rescheduleLesson, proposedAt) }}
          onClose={() => setRescheduleLesson(null)}
        />
      )}

      {noteLesson && (
        <SessionNoteModal
          lesson={noteLesson}
          initialContent={notes[noteLesson.id] ?? ''}
          onSave={handleSaveNote}
          onClose={() => setNoteLesson(null)}
        />
      )}
    </div>
  )
}

function LessonCard({ lesson: l, isTutor, onChat, onAccept, onDecline, onCancel, onMarkComplete, completing, onDismiss, onReschedule, onRescheduleAccept, onRescheduleDecline, selected, onToggleSelect, onPay, paying, onNote, notePreview }: {
  lesson: Lesson
  isTutor: boolean
  onChat: () => void
  onAccept: () => void
  onDecline: () => void
  onCancel: () => void
  onMarkComplete?: () => void
  completing?: boolean
  onDismiss: () => void
  onReschedule?: () => void
  onRescheduleAccept?: () => void
  onRescheduleDecline?: () => void
  selected?: boolean
  onToggleSelect?: () => void
  onPay?: () => void
  paying?: boolean
  onNote?: () => void
  notePreview?: string
}) {
  const isStudentPerspective = l.perspective === 'student'
  const isCancellable = l.status === 'pending' || l.status === 'accepted'
  const isDimmed = l.status === 'cancelled' || l.status === 'completed' || l.status === 'declined'
  const isDismissible = l.status === 'declined' || l.status === 'cancelled' || l.status === 'completed'
  const hasPendingReschedule = l.reschedule_status === 'pending'
  const countdown = l.status === 'accepted' && l.scheduled_at ? getCountdown(l.scheduled_at) : null
  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-5 relative transition-colors ${
      selected           ? 'border-blue-400 bg-blue-50/40' :
      isDimmed           ? 'border-gray-100 opacity-60' :
      hasPendingReschedule ? 'border-orange-200' :
      isStudentPerspective ? 'border-blue-100' :
                             'border-gray-100'
    }`}>
      {onToggleSelect && (
        <button
          type="button"
          onClick={onToggleSelect}
          className="absolute top-4 left-4 text-blue-500 hover:text-blue-700 z-10 transition-colors"
          title={selected ? 'Deselect' : 'Select'}
        >
          {selected
            ? <CheckSquare className="w-5 h-5" />
            : <Square className="w-5 h-5 text-gray-300 hover:text-blue-400" />}
        </button>
      )}
      {isDismissible && (
        <button
          onClick={onDismiss}
          title="Remove from view"
          className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-full text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors z-10"
        >
          <XCircle className="w-4 h-4" />
        </button>
      )}
      <div className={`flex items-start justify-between gap-3 ${isDismissible ? 'pr-6' : ''} ${onToggleSelect ? 'pl-8' : ''}`}>
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
            {countdown && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 ${countdown.cls}`}>
                <Timer className="w-2.5 h-2.5" /> {countdown.label}
              </span>
            )}
            {hasPendingReschedule && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-600 flex items-center gap-1">
                <RefreshCw className="w-2.5 h-2.5" /> Reschedule requested
              </span>
            )}
            {l.payment_status === 'paid' && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700 flex items-center gap-1">
                <CreditCard className="w-2.5 h-2.5" /> Paid
              </span>
            )}
            {l.perspective === 'student' && l.status === 'accepted' && (l.price_cents ?? 0) > 0 && l.payment_status !== 'paid' && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 flex items-center gap-1">
                <CreditCard className="w-2.5 h-2.5" /> Payment required
              </span>
            )}
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
          {/* Other party proposed — show their proposed time so this user can respond */}
          {hasPendingReschedule && l.reschedule_proposed_at && l.reschedule_proposed_by === l.other_user_id && (
            <span className="text-xs text-orange-600 font-bold flex items-center gap-1 mt-0.5">
              <RefreshCw className="w-3 h-3 shrink-0" />
              Proposes:{' '}
              {new Date(l.reschedule_proposed_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              {' · '}
              {new Date(l.reschedule_proposed_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </span>
          )}
          {/* I proposed — show my proposed time and waiting message */}
          {hasPendingReschedule && l.reschedule_proposed_at && l.reschedule_proposed_by !== l.other_user_id && (
            <span className="text-xs text-orange-500 font-medium flex items-center gap-1 mt-0.5">
              <RefreshCw className="w-3 h-3 shrink-0" />
              Your request:{' '}
              {new Date(l.reschedule_proposed_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              {' · '}
              {new Date(l.reschedule_proposed_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              {' · Awaiting response'}
            </span>
          )}
          {/* I proposed and it was accepted/declined */}
          {l.reschedule_status === 'accepted' && l.reschedule_proposed_by !== l.other_user_id && (
            <span className="text-xs text-green-600 font-bold flex items-center gap-1 mt-0.5">
              <CheckCircle className="w-3 h-3 shrink-0" /> Reschedule approved — time updated above
            </span>
          )}
          {l.reschedule_status === 'declined' && l.reschedule_proposed_by !== l.other_user_id && (
            <span className="text-xs text-red-500 font-bold flex items-center gap-1 mt-0.5">
              <XCircle className="w-3 h-3 shrink-0" /> Reschedule declined — original time kept
            </span>
          )}
          {l.message && (
            <p className="text-sm text-gray-500 font-medium mt-1 line-clamp-2">{l.message}</p>
          )}
          {notePreview && (
            <p className="text-xs text-gray-400 italic line-clamp-1 flex items-center gap-1 mt-1">
              <StickyNote className="w-3 h-3 shrink-0 text-gray-300" /> {notePreview}
            </p>
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
          {/* Tutor: approve or decline a reschedule request */}
          {l.perspective === 'tutor' && hasPendingReschedule && (
            <>
              <button
                onClick={onRescheduleAccept}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors"
              >
                <CheckCircle className="w-4 h-4" /> Approve
              </button>
              <button
                onClick={onRescheduleDecline}
                className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-500 rounded-xl font-bold text-sm hover:bg-red-50 hover:text-red-600 transition-colors"
              >
                <XCircle className="w-4 h-4" /> Keep original
              </button>
            </>
          )}
          {l.status === 'accepted' && !hasPendingReschedule && (
            <button
              onClick={onChat}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors"
            >
              Message
            </button>
          )}
          {l.status === 'accepted' && onMarkComplete && !hasPendingReschedule && (
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
          {/* Student: pay for accepted lesson */}
          {onPay && (
            <button
              onClick={onPay}
              disabled={paying}
              className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700 transition-colors disabled:opacity-60"
            >
              {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
              Pay ${((l.price_cents ?? 0) / 100).toFixed(2)}
            </button>
          )}
          {/* Student: request a reschedule */}
          {onReschedule && !hasPendingReschedule && (
            <button
              onClick={onReschedule}
              className="flex items-center gap-1.5 px-3 py-2 bg-orange-50 text-orange-600 rounded-xl font-bold text-sm hover:bg-orange-100 transition-colors border border-orange-200"
            >
              <RefreshCw className="w-4 h-4" /> Reschedule
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
          {onNote && (
            <button
              onClick={onNote}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm hover:bg-blue-50 hover:text-blue-600 transition-colors"
            >
              <StickyNote className="w-4 h-4" /> {notePreview ? 'Edit Note' : 'Add Note'}
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
            {g.recurrence_type && g.recurrence_type !== 'none' && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-500 flex items-center gap-1">
                <RefreshCw className="w-2.5 h-2.5" />
                {{ weekly: 'Weekly', biweekly: 'Every 2 wks', monthly: 'Monthly' }[g.recurrence_type] ?? g.recurrence_type}
              </span>
            )}
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

function CancelSessionModal({ title, description, confirmLabel = 'Cancel Session', required = false, saving, onConfirm, onClose }: {
  title:         string
  description:   string
  confirmLabel?: string
  required?:     boolean
  saving:        boolean
  onConfirm:     (message: string) => void
  onClose:       () => void
}) {
  const [msg, setMsg] = useState('')
  const canSubmit = !required || msg.trim().length > 0
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
            Reason{' '}
            {required
              ? <span className="normal-case font-medium text-red-500">(required)</span>
              : <span className="normal-case font-medium">(optional)</span>}
          </label>
          <textarea
            value={msg}
            onChange={e => setMsg(e.target.value)}
            placeholder={required ? 'Please explain why…' : 'Let them know why you\'re cancelling…'}
            rows={3}
            disabled={saving}
            className={`w-full px-4 py-3 border rounded-xl text-sm font-medium text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 resize-none disabled:opacity-60 ${
              required && msg.trim().length === 0
                ? 'border-red-300 focus:ring-red-400'
                : 'border-gray-200 focus:ring-red-400'
            }`}
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
            disabled={saving || !canSubmit}
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

function RescheduleModal({ lesson, tutorId: tutorIdProp, onConfirm, onClose }: {
  lesson:    Lesson
  tutorId:   string
  onConfirm: (proposedAt: string) => Promise<void>
  onClose:   () => void
}) {
  const tutorId = tutorIdProp
  const [avail, setAvail]             = useState<Record<string, { available: boolean; start: string; end: string }> | null>(null)
  const [blackoutDates, setBlackout]  = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [calendarOffset, setCalOff]   = useState(0)
  const [takenMinutes, setTaken]      = useState<Set<number>>(new Set())
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const duration = 60

  const weekDates = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const sunday = new Date(today)
    sunday.setDate(today.getDate() - today.getDay() + calendarOffset * 7)
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(sunday); d.setDate(sunday.getDate() + i); return d })
  }, [calendarOffset])

  useEffect(() => {
    supabase.from('tutor_profiles').select('availability, blackout_dates').eq('id', tutorId).single()
      .then(({ data }) => {
        setAvail(data?.availability ?? {})
        setBlackout(data?.blackout_dates ?? [])
        setLoading(false)
      })
  }, [tutorId])

  useEffect(() => {
    if (!selectedDate) { setTaken(new Set()); return }
    const start = new Date(selectedDate); start.setHours(0, 0, 0, 0)
    const end   = new Date(selectedDate); end.setHours(23, 59, 59, 999)
    supabase.from('bookings').select('scheduled_at, duration_minutes')
      .eq('tutor_id', tutorId).neq('status', 'declined').neq('status', 'cancelled')
      .gte('scheduled_at', start.toISOString()).lte('scheduled_at', end.toISOString())
      .then(({ data }) => {
        const blocked = new Set<number>()
        for (const b of data ?? []) {
          if (!b.scheduled_at) continue
          const d = new Date(b.scheduled_at)
          const startM = d.getHours() * 60 + d.getMinutes()
          for (let m = startM; m < startM + (b.duration_minutes ?? 60); m += 30) blocked.add(m)
        }
        setTaken(blocked)
      })
  }, [selectedDate, tutorId])

  async function handleConfirm() {
    if (!selectedDate || !selectedSlot) return
    setSaving(true)
    await onConfirm(toScheduledAt(selectedDate, selectedSlot))
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-black text-gray-900 text-lg">Request Reschedule</h3>
            <p className="text-sm text-gray-500 font-medium mt-0.5">{lesson.subject} with {lesson.other_name}</p>
          </div>
          <button onClick={onClose} disabled={saving} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400 transition-colors shrink-0 disabled:opacity-50">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
        ) : (
          <>
            {/* Date picker */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Select New Date</label>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setCalOff(o => Math.max(0, o - 1))} disabled={calendarOffset === 0} className="p-0.5 rounded text-gray-400 hover:text-gray-700 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
                  <button type="button" onClick={() => setCalOff(o => Math.min(3, o + 1))} disabled={calendarOffset === 3} className="p-0.5 rounded text-gray-400 hover:text-gray-700 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {['S','M','T','W','T','F','S'].map((d, i) => (
                  <span key={i} className="text-center text-[10px] font-bold text-gray-400">{d}</span>
                ))}
                {weekDates.map(date => {
                  const today      = new Date(); today.setHours(0, 0, 0, 0)
                  const isPast     = date < today
                  const dayKey     = DOW_KEYS[date.getDay()]
                  const dayAvail   = avail?.[dayKey]
                  const isAvail    = !!dayAvail?.available
                  const dateStr    = localDateStr(date)
                  const isBlackedOut = blackoutDates.includes(dateStr)
                  const bookable   = !isPast && isAvail && !isBlackedOut
                  const isSelected = selectedDate?.toDateString() === date.toDateString()
                  return (
                    <button
                      key={date.toISOString()}
                      type="button"
                      disabled={!bookable}
                      onClick={() => { setSelectedDate(date); setSelectedSlot(null) }}
                      className={`flex flex-col items-center py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        isSelected    ? 'bg-blue-600 text-white' :
                        isBlackedOut  ? 'text-red-300 bg-red-50 cursor-not-allowed' :
                        bookable      ? 'hover:bg-blue-50 text-gray-700' :
                                        'text-gray-300 cursor-not-allowed'
                      }`}
                    >
                      <span className="text-[9px] leading-none">{date.toLocaleDateString('en-US', { month: 'short' })}</span>
                      <span className="text-sm leading-tight">{date.getDate()}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Time slot picker */}
            {selectedDate && avail && (() => {
              const dayKey  = DOW_KEYS[selectedDate.getDay()]
              const dayAvail = avail[dayKey]
              if (!dayAvail?.available) return null
              const slots = generateSlots(dayAvail.start, dayAvail.end)
              return (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Select Time</label>
                  <div className="flex flex-wrap gap-1.5">
                    {slots.map(slot => {
                      const slotMins = slotToMinutes(slot)
                      const taken = Array.from({ length: duration / 30 }, (_, i) => takenMinutes.has(slotMins + i * 30)).some(Boolean)
                      const isSel  = selectedSlot === slot
                      return (
                        <button
                          key={slot}
                          type="button"
                          disabled={taken}
                          onClick={() => setSelectedSlot(slot)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                            isSel  ? 'bg-blue-600 text-white' :
                            taken  ? 'bg-gray-100 text-gray-300 line-through cursor-not-allowed' :
                                     'bg-gray-100 text-gray-700 hover:bg-blue-50 hover:text-blue-600'
                          }`}
                        >
                          {slot}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

            {/* Summary */}
            {selectedDate && selectedSlot && (
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-xl border border-blue-100">
                <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="text-xs font-bold text-blue-700">
                  {selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  {' · '}{selectedSlot}
                </span>
              </div>
            )}

            <div className="flex gap-3 mt-1">
              <button onClick={onClose} disabled={saving} className="flex-1 h-11 border-2 border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50 transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={saving || !selectedDate || !selectedSlot}
                className="flex-1 h-11 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Send Request
              </button>
            </div>
          </>
        )}
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

function SessionNoteModal({ lesson, initialContent, onSave, onClose }: {
  lesson:         Lesson
  initialContent: string
  onSave:         (bookingId: string, content: string) => Promise<void>
  onClose:        () => void
}) {
  const [content, setContent] = useState(initialContent)
  const [saving, setSaving]   = useState(false)

  async function handleSave() {
    setSaving(true)
    await onSave(lesson.id, content.trim())
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-black text-gray-900 text-lg flex items-center gap-2">
              <StickyNote className="w-5 h-5 text-blue-500" /> Session Note
            </h3>
            <p className="text-sm text-gray-500 font-medium mt-0.5">{lesson.subject} · {lesson.other_name}</p>
          </div>
          <button onClick={onClose} disabled={saving} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400 transition-colors shrink-0 disabled:opacity-50">
            <XCircle className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-gray-400 font-medium -mt-1">Private — only you can see this note.</p>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Your Note</label>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="What did you cover? What to review next time? Any thoughts on the session…"
            rows={5}
            disabled={saving}
            autoFocus
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none disabled:opacity-60"
          />
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} disabled={saving} className="flex-1 h-11 border-2 border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 h-11 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Note
          </button>
        </div>
      </div>
    </div>
  )
}
