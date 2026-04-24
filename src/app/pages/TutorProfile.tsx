// src/app/pages/TutorProfile.tsx

import { useParams, Link } from "react-router";
import { fetchTutorById } from "../data/tutors";
import type { Tutor } from "../data/tutors";
import { Navbar } from "../components/Navbar";
import { ConversationModal } from "../components/ConversationModal";
import { Star, MapPin, Share2, Heart, MessageCircle, Clock, GraduationCap, Briefcase, Calendar, ChevronLeft, ChevronRight, Loader2, Send, CornerDownRight, Users } from "lucide-react";
import type { GroupLesson } from "../components/CreateGroupLessonModal";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { toast } from "sonner";
import { sendNotificationEmail } from "../../lib/notify";

const DOW = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
function getDayKey(d: Date) { return DOW[d.getDay()] }
function generateSlots(start: string, end: string): string[] {
  const slots: string[] = []
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  let mins = sh * 60 + sm
  const endMins = eh * 60 + em
  while (mins < endMins) {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    const period = h >= 12 ? 'PM' : 'AM'
    const hour = h % 12 || 12
    slots.push(`${hour}:${String(m).padStart(2, '0')} ${period}`)
    mins += 30
  }
  return slots
}
function slotToMinutes(slot: string): number {
  const [time, period] = slot.split(' ')
  const [hStr, mStr] = time.split(':')
  let h = parseInt(hStr)
  const m = parseInt(mStr)
  if (period === 'PM' && h !== 12) h += 12
  if (period === 'AM' && h === 12) h = 0
  return h * 60 + m
}
function toScheduledAt(date: Date, slot: string): string {
  const d = new Date(date)
  const mins = slotToMinutes(slot)
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0)
  return d.toISOString()
}
function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface Review {
  id:           string
  student_id:   string
  student_name: string
  rating:       number
  body:         string
  created_at:   string
  tutor_reply:  string | null
}

export function TutorProfile() {
  const { id } = useParams()
  const { user, profile } = useAuth()
  const [tutor, setTutor]       = useState<Tutor | null>(null)
  const [loading, setLoading]   = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Booking form state
  const [subject, setSubject]       = useState('')
  const [studentName, setStudentName] = useState('')
  const [message, setMessage]       = useState('')
  const [selectedDate, setSelectedDate]     = useState<Date | null>(null)
  const [selectedSlot, setSelectedSlot]     = useState<string | null>(null)
  const [duration, setDuration]             = useState(60)
  const [takenMinutes, setTakenMinutes]     = useState<Set<number>>(new Set())
  const [calendarOffset, setCalendarOffset] = useState(0)

  const nextDates = useMemo(() => {
    const dates: Date[] = []
    const today = new Date(); today.setHours(0, 0, 0, 0)
    for (let i = 0; i < 28; i++) {
      const d = new Date(today)
      d.setDate(today.getDate() + i)
      dates.push(d)
    }
    return dates
  }, [])

  // Reviews state
  const [reviews, setReviews]           = useState<Review[]>([])
  const [loadingReviews, setLoadingReviews] = useState(true)
  const [myRating, setMyRating]         = useState(0)
  const [hoverRating, setHoverRating]   = useState(0)
  const [reviewBody, setReviewBody]     = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)
  const hasReviewed = reviews.some(r => r.student_id === user?.id)

  // Group sessions state
  const [groupSessions, setGroupSessions]   = useState<GroupLesson[]>([])
  const [enrollingId, setEnrollingId]       = useState<string | null>(null)
  const [myEnrollments, setMyEnrollments]   = useState<string[]>([]) // group_lesson ids

  // Chat state
  const [chatBookingId, setChatBookingId] = useState<string | null>(null)
  const [contactingTutor, setContactingTutor] = useState(false)

  async function handleContact() {
    if (!user) { toast.error('Please sign in to message this tutor.'); return }
    if (!tutor) return
    setContactingTutor(true)
    // Find any existing booking between this student and tutor
    const { data: existing } = await supabase
      .from('bookings')
      .select('id')
      .eq('tutor_id', tutor.id)
      .eq('student_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    if (existing) {
      setChatBookingId(existing.id)
      setContactingTutor(false)
      return
    }
    // No booking yet — create a minimal inquiry record to anchor the thread
    const { data: created, error } = await supabase
      .from('bookings')
      .insert({
        tutor_id:     tutor.id,
        student_id:   user.id,
        student_name: profile?.full_name ?? user.email?.split('@')[0] ?? 'Student',
        subject:      tutor.subject.split(' & ')[0],
        message:      '',
        status:       'pending',
      })
      .select('id')
      .single()
    if (error || !created) { toast.error('Could not open chat.'); setContactingTutor(false); return }
    setChatBookingId(created.id)
    setContactingTutor(false)
  }

  useEffect(() => {
    if (!id) { setLoading(false); return }
    fetchTutorById(id).then(async data => {
      if (data) {
        // tutors_view doesn't include blackout_dates — fetch it separately
        const { data: tp } = await supabase
          .from('tutor_profiles')
          .select('blackout_dates')
          .eq('id', id)
          .single()
        data.blackoutDates = (tp?.blackout_dates as string[]) ?? []
      }
      setTutor(data)
      setLoading(false)
    })
    // Fetch open upcoming group sessions for this tutor
    supabase
      .from('group_lessons')
      .select('*, group_lesson_enrollments(count)')
      .eq('tutor_id', id)
      .eq('status', 'open')
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .then(({ data }) => {
        setGroupSessions(
          (data ?? []).map((g: any) => ({
            ...g,
            enrollment_count: g.group_lesson_enrollments?.[0]?.count ?? 0,
          }))
        )
      })
  }, [id])

  // Fetch which group sessions the current user is already enrolled in
  useEffect(() => {
    if (!user || !id) return
    supabase
      .from('group_lesson_enrollments')
      .select('group_lesson_id')
      .eq('student_id', user.id)
      .then(({ data }) => setMyEnrollments((data ?? []).map((e: any) => e.group_lesson_id)))
  }, [user, id])

  async function handleEnroll(gl: GroupLesson) {
    if (!user) { toast.error('Please sign in to enroll.'); return }
    setEnrollingId(gl.id)
    const { error } = await supabase.from('group_lesson_enrollments').insert({
      group_lesson_id: gl.id,
      student_id:      user.id,
      student_name:    profile?.full_name ?? user.email?.split('@')[0] ?? 'Student',
    })
    if (error) {
      toast.error(error.code === '23505' ? 'You are already enrolled.' : 'Enrollment failed: ' + error.message)
    } else {
      setMyEnrollments(prev => [...prev, gl.id])
      setGroupSessions(prev => prev.map(g =>
        g.id === gl.id ? { ...g, enrollment_count: (g.enrollment_count ?? 0) + 1 } : g
      ))
      toast.success(`Enrolled in "${gl.title}"!`)
    }
    setEnrollingId(null)
  }

  // Pre-fill student name from profile
  useEffect(() => {
    if (profile?.full_name) setStudentName(profile.full_name)
  }, [profile])

  // Fetch booked slots for the selected date; each booking blocks its start + its duration in 30-min chunks.
  useEffect(() => {
    if (!selectedDate || !tutor) { setTakenMinutes(new Set()); return }
    const start = new Date(selectedDate); start.setHours(0, 0, 0, 0)
    const end   = new Date(selectedDate); end.setHours(23, 59, 59, 999)
    supabase
      .from('bookings')
      .select('scheduled_at, duration_minutes')
      .eq('tutor_id', tutor.id)
      .neq('status', 'declined')
      .neq('status', 'cancelled')
      .gte('scheduled_at', start.toISOString())
      .lte('scheduled_at', end.toISOString())
      .then(({ data }) => {
        const blocked = new Set<number>()
        for (const b of data ?? []) {
          if (!b.scheduled_at) continue
          const d = new Date(b.scheduled_at)
          const startM = d.getHours() * 60 + d.getMinutes()
          const dur = (b.duration_minutes ?? 60)
          for (let m = startM; m < startM + dur; m += 30) blocked.add(m)
        }
        setTakenMinutes(blocked)
      })
  }, [selectedDate, tutor])

  // Load reviews
  useEffect(() => {
    if (!id) return
    setLoadingReviews(true)
    supabase
      .from('reviews')
      .select('*')
      .eq('tutor_id', id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setReviews(data ?? [])
        setLoadingReviews(false)
      })
  }, [id])

  async function handleReviewSubmit(e: { preventDefault(): void }) {
    e.preventDefault()
    if (!user || !id) return
    if (myRating === 0) { toast.error('Please select a star rating.'); return }
    if (!reviewBody.trim()) { toast.error('Please write a review.'); return }

    setSubmittingReview(true)
    const { data, error } = await supabase
      .from('reviews')
      .insert({
        tutor_id:     id,
        student_id:   user.id,
        student_name: profile?.full_name
          || user.user_metadata?.full_name
          || user.email?.split('@')[0]
          || 'Student',
        rating:       myRating,
        body:         reviewBody.trim(),
      })
      .select()
      .single()

    if (error) {
      toast.error('Failed to submit review: ' + error.message)
    } else {
      setReviews(prev => [data, ...prev])
      setMyRating(0)
      setReviewBody('')
      toast.success('Review submitted!')
    }
    setSubmittingReview(false)
  }

  async function handleBooking(e: { preventDefault(): void }) {
    e.preventDefault()
    if (!tutor) return

    if (!user) {
      toast.error('Please sign in to request a lesson.')
      return
    }

    if (!selectedDate || !selectedSlot) {
      toast.error('Please select a date and time.')
      return
    }

    if (!studentName.trim() || !subject.trim()) {
      toast.error('Please fill in your name and subject.')
      return
    }

    setSubmitting(true)

    const { error } = await supabase.from('bookings').insert({
      tutor_id:         tutor.id,
      student_id:       user.id,
      student_name:     studentName,
      subject:          subject || tutor.subject.split(' & ')[0],
      message:          message,
      status:           'pending',
      scheduled_at:     toScheduledAt(selectedDate, selectedSlot),
      duration_minutes: duration,
    })

    if (error) {
      toast.error('Failed to send request: ' + error.message)
    } else {
      toast.success('Lesson request sent! The tutor will get back to you soon.')
      setMessage('')
      // Email the tutor
      sendNotificationEmail({
        type: 'new_booking',
        recipientId: tutor.id,
        data: {
          tutorName:   tutor.name,
          studentName: studentName,
          subject:     subject || tutor.subject.split(' & ')[0],
          message:     message,
        },
      })
    }

    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </div>
    )
  }

  if (!tutor) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Tutor Not Found</h1>
          <Link to="/" className="px-8 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700">
            Back to Search
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Hero */}
      <div className="relative h-[400px] md:h-[500px] bg-gray-900 overflow-hidden group">
        {tutor.imageUrl ? (
          <ImageWithFallback
            src={tutor.imageUrl}
            alt={tutor.name}
            className="w-full h-full object-cover object-top opacity-90 group-hover:scale-105 transition-transform duration-700"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-700 flex items-center justify-center">
            <span className="text-white font-black select-none opacity-30" style={{ fontSize: '220px', lineHeight: 1 }}>
              {tutor.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        <div className="absolute top-6 left-6 md:left-12">
          <Link to="/search" className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md text-white rounded-lg font-bold hover:bg-white/20 transition-all border border-white/20">
            <ChevronLeft className="w-5 h-5" />
            Back to Results
          </Link>
        </div>

        <div className="absolute top-6 right-6 md:right-12 flex items-center gap-3">
          <button className="p-3 bg-white/10 backdrop-blur-md text-white rounded-full hover:bg-white/20 border border-white/20">
            <Share2 className="w-5 h-5" />
          </button>
          <button className="p-3 bg-white/10 backdrop-blur-md text-white rounded-full hover:bg-white/20 border border-white/20">
            <Heart className="w-5 h-5" />
          </button>
        </div>

        <div className="absolute bottom-12 left-6 md:left-12 right-6 md:right-12">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-end justify-between gap-6">
            <div className="flex flex-col gap-2">
              <span className="inline-block px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-full uppercase tracking-wider w-fit">
                {tutor.subject.split(' & ')[0]}
              </span>
              <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight">{tutor.name}</h1>
              <div className="flex items-center gap-4 text-white/90">
                <div className="flex items-center gap-1.5 font-bold">
                  <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  <span className="text-lg">{tutor.rating}</span>
                  <span className="text-sm opacity-80">({tutor.reviewCount} reviews)</span>
                </div>
                <div className="flex items-center gap-1.5 font-bold">
                  <MapPin className="w-5 h-5 text-blue-400" />
                  <span className="text-lg">{tutor.location}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end text-white">
              <span className="text-sm font-bold opacity-80 uppercase tracking-widest">HOURLY RATE</span>
              <span className="text-5xl md:text-6xl font-black">${tutor.hourlyRate}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-12 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">

          {/* Main column */}
          <div className="lg:col-span-2 flex flex-col gap-12">

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 p-8 bg-gray-50 rounded-3xl border border-gray-100">
              <div className="flex flex-col gap-1 text-center md:text-left">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">EXPERIENCE</span>
                <span className="text-lg font-bold text-gray-900">{tutor.experience}</span>
              </div>
              <div className="flex flex-col gap-1 text-center md:text-left">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">REVIEWS</span>
                <span className="text-lg font-bold text-gray-900">{tutor.reviewCount}</span>
              </div>
              <div className="flex flex-col gap-1 text-center md:text-left">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">RATING</span>
                <span className="text-lg font-bold text-gray-900">{tutor.rating} / 5</span>
              </div>
            </div>

            {/* Bio */}
            <section className="flex flex-col gap-6">
              <h2 className="text-2xl font-bold text-gray-900 border-b-4 border-blue-600 w-fit pb-1">Tutor Overview</h2>
              <p className="text-xl text-gray-600 leading-relaxed font-medium">{tutor.bio}</p>
            </section>

            {/* Background */}
            <section className="flex flex-col gap-8">
              <h2 className="text-2xl font-bold text-gray-900">Background & Qualifications</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center shrink-0">
                    <GraduationCap className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-gray-900">Education</h4>
                    <p className="text-gray-600 font-medium">{tutor.education}</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center shrink-0">
                    <Briefcase className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-gray-900">Experience</h4>
                    <p className="text-gray-600 font-medium">{tutor.experience}</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center shrink-0">
                    <Clock className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-gray-900">Availability</h4>
                    <p className="text-gray-600 font-medium">
                      {Object.values(tutor.availability).some(s => s?.available)
                        ? `${Object.values(tutor.availability).filter(s => s?.available).length} day${Object.values(tutor.availability).filter(s => s?.available).length !== 1 ? 's' : ''} per week`
                        : 'Contact for availability'}
                    </p>
                  </div>
                </div>
                {tutor.policy && (
                  <div className="flex gap-4">
                    <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center shrink-0">
                      <Calendar className="w-6 h-6 text-orange-600" />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-gray-900">Policy</h4>
                      <p className="text-gray-600 font-medium">{tutor.policy}</p>
                    </div>
                  </div>
                )}
                {tutor.tutoringLocation && (
                  <div className="flex gap-4">
                    <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center shrink-0">
                      <MapPin className="w-6 h-6 text-red-500" />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-gray-900">Tutoring Location</h4>
                      <p className="text-gray-600 font-medium">{tutor.tutoringLocation}</p>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Weekly Schedule */}
            {Object.values(tutor.availability).some(s => s?.available) && (
              <section className="flex flex-col gap-6">
                <h2 className="text-2xl font-bold text-gray-900">Weekly Schedule</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as const).map(day => {
                    const slot = tutor.availability[day]
                    if (!slot?.available) return null
                    const fmt = (t: string) => {
                      const [h, m] = t.split(':').map(Number)
                      const period = h >= 12 ? 'PM' : 'AM'
                      const hour = h % 12 || 12
                      return `${hour}${m ? `:${String(m).padStart(2,'0')}` : ''} ${period}`
                    }
                    return (
                      <div key={day} className="flex items-center justify-between px-5 py-3 bg-green-50 border border-green-100 rounded-xl">
                        <span className="font-bold text-gray-900 capitalize">{day}</span>
                        <span className="text-sm font-bold text-green-700">{fmt(slot.start)} – {fmt(slot.end)}</span>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* Group Sessions */}
            {groupSessions.length > 0 && (
              <section className="flex flex-col gap-6">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <Users className="w-6 h-6 text-purple-600" />
                  Group Sessions
                </h2>
                <div className="flex flex-col gap-3">
                  {groupSessions.map(gl => {
                    const enrolled  = myEnrollments.includes(gl.id)
                    const spotsLeft = gl.max_students - (gl.enrollment_count ?? 0)
                    const isFull    = spotsLeft <= 0
                    return (
                      <div key={gl.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-purple-50 border border-purple-100 rounded-2xl">
                        <div className="flex flex-col gap-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-gray-900">{gl.title}</span>
                            {gl.price === 0
                              ? <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">Free</span>
                              : <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">${gl.price}/student</span>}
                            {isFull && !enrolled && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-600">Full</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 flex-wrap text-xs text-gray-500 font-medium">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(gl.scheduled_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}{' '}
                              {new Date(gl.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                              {' · '}{gl.duration_minutes} min
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {gl.enrollment_count ?? 0} / {gl.max_students} enrolled
                              {!isFull && !enrolled && <span className="text-purple-600 font-bold">· {spotsLeft} left</span>}
                            </span>
                          </div>
                          {gl.description && (
                            <p className="text-sm text-gray-600 font-medium mt-0.5 line-clamp-2">{gl.description}</p>
                          )}
                        </div>
                        <div className="shrink-0">
                          {enrolled ? (
                            <span className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-purple-700 bg-purple-100">
                              Enrolled
                            </span>
                          ) : (
                            <button
                              disabled={isFull || enrollingId === gl.id}
                              onClick={() => handleEnroll(gl)}
                              className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-xl font-bold text-sm hover:bg-purple-700 transition-colors shadow-lg shadow-purple-200 disabled:opacity-50"
                            >
                              {enrollingId === gl.id
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : <Users className="w-4 h-4" />}
                              {isFull ? 'Full' : 'Enroll'}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* Reviews */}
            <section className="flex flex-col gap-8">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <h2 className="text-2xl font-bold text-gray-900">Student Reviews</h2>
                <div className="flex items-center gap-2">
                  <div className="flex">
                    {[1,2,3,4,5].map(i => (
                      <Star key={i} className={`w-4 h-4 ${i <= Math.round(tutor.rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200 fill-gray-200'}`} />
                    ))}
                  </div>
                  <span className="text-sm font-bold text-gray-900">{tutor.rating} · {reviews.length} review{reviews.length !== 1 ? 's' : ''}</span>
                </div>
              </div>

              {/* Write a review — logged-in users who haven't reviewed yet */}
              {user && !hasReviewed && (
                <form onSubmit={handleReviewSubmit} className="flex flex-col gap-4 p-6 bg-blue-50 rounded-2xl border border-blue-100">
                  <h3 className="font-bold text-gray-900">Leave a Review</h3>

                  {/* Star picker */}
                  <div className="flex items-center gap-1">
                    {[1,2,3,4,5].map(i => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setMyRating(i)}
                        onMouseEnter={() => setHoverRating(i)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="p-0.5"
                      >
                        <Star className={`w-7 h-7 transition-colors ${i <= (hoverRating || myRating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300 fill-gray-100'}`} />
                      </button>
                    ))}
                    {myRating > 0 && (
                      <span className="ml-2 text-sm font-bold text-gray-600">
                        {['','Poor','Fair','Good','Great','Excellent'][myRating]}
                      </span>
                    )}
                  </div>

                  <textarea
                    value={reviewBody}
                    onChange={e => setReviewBody(e.target.value)}
                    placeholder="Share your experience with this tutor…"
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-800 bg-white"
                  />

                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="self-end flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-60"
                  >
                    {submittingReview ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {submittingReview ? 'Submitting…' : 'Submit Review'}
                  </button>
                </form>
              )}

              {!user && (
                <p className="text-sm text-gray-500 font-medium">
                  <a href="/login" className="text-blue-600 font-bold hover:underline">Sign in</a> to leave a review.
                </p>
              )}

              {/* Reviews list */}
              {loadingReviews ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              ) : reviews.length === 0 ? (
                <p className="text-gray-400 font-medium italic">No reviews yet — be the first!</p>
              ) : (
                <div className="flex flex-col gap-6">
                  {reviews.map(r => (
                    <div key={r.id} className="flex flex-col gap-2 pb-6 border-b border-gray-100 last:border-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-900">{r.student_name}</span>
                        <span className="text-xs text-gray-400">
                          {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                      <div className="flex items-center gap-0.5">
                        {[1,2,3,4,5].map(i => (
                          <Star key={i} className={`w-4 h-4 ${i <= r.rating ? 'fill-yellow-400 text-yellow-400' : 'fill-gray-100 text-gray-200'}`} />
                        ))}
                      </div>
                      <p className="text-gray-600 font-medium leading-relaxed">{r.body}</p>
                      {r.tutor_reply && (
                        <div className="mt-3 ml-3 pl-3 border-l-2 border-blue-200">
                          <p className="text-xs font-bold text-blue-600 mb-1 flex items-center gap-1">
                            <CornerDownRight className="w-3 h-3" /> Tutor's response
                          </p>
                          <p className="text-sm text-gray-600 font-medium leading-relaxed">{r.tutor_reply}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Booking sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-28 flex flex-col gap-6 bg-white rounded-3xl border border-gray-200 shadow-2xl p-8">
              <div>
                <h3 className="text-2xl font-black text-gray-900">Book a Session</h3>
              </div>

              <form onSubmit={handleBooking} className="flex flex-col gap-4">

                {/* ── Duration picker ── */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Session Duration</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {[
                      { label: '30 min', value: 30 },
                      { label: '1 hr',   value: 60 },
                      { label: '1.5 hr', value: 90 },
                      { label: '2 hr',   value: 120 },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => { setDuration(opt.value); setSelectedSlot(null) }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                          duration === opt.value
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-blue-50 hover:text-blue-600'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Date picker ── */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Select Date</label>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => setCalendarOffset(o => Math.max(0, o - 1))} disabled={calendarOffset === 0} className="p-0.5 rounded text-gray-400 hover:text-gray-700 disabled:opacity-30">
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => setCalendarOffset(o => Math.min(3, o + 1))} disabled={calendarOffset === 3} className="p-0.5 rounded text-gray-400 hover:text-gray-700 disabled:opacity-30">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {['S','M','T','W','T','F','S'].map((d, i) => (
                      <span key={i} className="text-center text-[10px] font-bold text-gray-400">{d}</span>
                    ))}
                    {nextDates.slice(calendarOffset * 7, calendarOffset * 7 + 7).map(date => {
                      const avail       = tutor.availability[getDayKey(date)]
                      const isAvail     = !!avail?.available
                      const isBlackedOut = tutor.blackoutDates.includes(localDateStr(date))
                      const bookable    = isAvail && !isBlackedOut
                      const isSelected  = selectedDate?.toDateString() === date.toDateString()
                      return (
                        <button
                          key={date.toISOString()}
                          type="button"
                          disabled={!bookable}
                          onClick={() => { setSelectedDate(date); setSelectedSlot(null) }}
                          title={isBlackedOut ? 'Tutor unavailable this date' : undefined}
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

                {/* ── Time slot picker ── */}
                {selectedDate && (() => {
                  const avail = tutor.availability[getDayKey(selectedDate)]
                  if (!avail?.available) return null
                  const slots = generateSlots(avail.start, avail.end)
                  return (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Select Start Time</label>
                      <div className="flex flex-wrap gap-1.5">
                        {slots.map(slot => {
                          const slotMins = slotToMinutes(slot)
                          // Slot is blocked if any 30-min chunk it would occupy is already taken
                          const taken = Array.from({ length: duration / 30 }, (_, i) =>
                            takenMinutes.has(slotMins + i * 30)
                          ).some(Boolean)
                          const isSelected = selectedSlot === slot
                          return (
                            <button
                              key={slot}
                              type="button"
                              disabled={taken}
                              onClick={() => setSelectedSlot(slot)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                                isSelected ? 'bg-blue-600 text-white' :
                                taken      ? 'bg-gray-100 text-gray-300 line-through cursor-not-allowed' :
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

                {/* Selected summary */}
                {selectedDate && selectedSlot && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-xl border border-blue-100">
                    <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="text-xs font-bold text-blue-700">
                      {selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      {' · '}{selectedSlot}
                      {' · '}{duration < 60 ? `${duration} min` : `${duration / 60} hr`}
                    </span>
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">SELECT SUBJECT</label>
                  <select
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    className="w-full h-12 px-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 bg-gray-50"
                  >
                    <option value="">Choose a subject…</option>
                    {tutor.subject.split(' & ').map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">YOUR NAME</label>
                  <input
                    type="text"
                    value={studentName}
                    onChange={e => setStudentName(e.target.value)}
                    placeholder="Full name"
                    className="w-full h-12 px-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 bg-gray-50"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">MESSAGE</label>
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="Tell the tutor what you need help with..."
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-800 bg-gray-50"
                  />
                </div>

                <div className="flex flex-col gap-3 mt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full h-14 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {submitting && <Loader2 className="w-5 h-5 animate-spin" />}
                    {submitting ? 'Sending…' : 'Request Lesson'}
                  </button>
                  <button
                    type="button"
                    onClick={handleContact}
                    disabled={contactingTutor}
                    className="w-full h-14 border-2 border-blue-600 text-blue-600 rounded-xl font-bold text-lg hover:bg-blue-50 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {contactingTutor
                      ? <Loader2 className="w-5 h-5 animate-spin" />
                      : <MessageCircle className="w-5 h-5" />}
                    Contact Tutor
                  </button>
                </div>
              </form>

              <p className="text-[11px] text-center text-gray-400">
                By clicking Request Lesson, you agree to our Terms of Service.
              </p>
            </div>
          </div>
        </div>
      </div>

      {chatBookingId && tutor && (
        <ConversationModal
          bookingId={chatBookingId}
          otherName={tutor.name}
          otherUserId={tutor.id}
          subject={tutor.subject.split(' & ')[0]}
          onClose={() => setChatBookingId(null)}
        />
      )}
    </div>
  )
}
