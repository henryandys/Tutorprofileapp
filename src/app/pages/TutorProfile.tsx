// src/app/pages/TutorProfile.tsx

import { useParams, Link } from "react-router";
import { fetchTutorById } from "../data/tutors";
import type { Tutor } from "../data/tutors";
import { Navbar } from "../components/Navbar";
import { Star, MapPin, Share2, Heart, MessageCircle, Clock, GraduationCap, Briefcase, Calendar, ChevronLeft, ChevronRight, Phone, Mail, Loader2, Send } from "lucide-react";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { toast } from "sonner";

interface Review {
  id: string
  student_id: string
  student_name: string
  rating: number
  body: string
  created_at: string
}

export function TutorProfile() {
  const { id } = useParams()
  const { user, profile } = useAuth()
  const [tutor, setTutor]       = useState<Tutor | null>(null)
  const [loading, setLoading]   = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Booking form state
  const [subject, setSubject]   = useState('')
  const [studentName, setStudentName] = useState('')
  const [message, setMessage]   = useState('')

  // Reviews state
  const [reviews, setReviews]           = useState<Review[]>([])
  const [loadingReviews, setLoadingReviews] = useState(true)
  const [myRating, setMyRating]         = useState(0)
  const [hoverRating, setHoverRating]   = useState(0)
  const [reviewBody, setReviewBody]     = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)
  const hasReviewed = reviews.some(r => r.student_id === user?.id)

  useEffect(() => {
    if (!id) { setLoading(false); return }
    fetchTutorById(id).then(data => {
      setTutor(data)
      setLoading(false)
    })
  }, [id])

  // Pre-fill student name from profile
  useEffect(() => {
    if (profile?.full_name) setStudentName(profile.full_name)
  }, [profile])

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

  async function handleReviewSubmit(e: React.FormEvent) {
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
        student_name: profile?.full_name ?? 'Anonymous',
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

  async function handleBooking(e: React.FormEvent) {
    e.preventDefault()
    if (!tutor) return

    if (!user) {
      toast.error('Please sign in to request a lesson.')
      return
    }

    if (!studentName.trim() || !subject.trim()) {
      toast.error('Please fill in your name and subject.')
      return
    }

    setSubmitting(true)

    const { error } = await supabase.from('bookings').insert({
      tutor_id:     tutor.id,
      student_id:   user.id,
      student_name: studentName,
      subject:      subject || tutor.subject.split(' & ')[0],
      message:      message,
      status:       'pending',
    })

    if (error) {
      toast.error('Failed to send request: ' + error.message)
    } else {
      toast.success('Lesson request sent! The tutor will get back to you soon.')
      setMessage('')
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
        <ImageWithFallback
          src={tutor.imageUrl}
          alt={tutor.name}
          className="w-full h-full object-cover object-top opacity-90 group-hover:scale-105 transition-transform duration-700"
        />
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
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">RESPONSE TIME</span>
                <span className="text-lg font-bold text-gray-900">{"< 2 hours"}</span>
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
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center shrink-0">
                    <Calendar className="w-6 h-6 text-orange-600" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-gray-900">Policy</h4>
                    <p className="text-gray-600 font-medium">24-hour cancellation notice required</p>
                  </div>
                </div>
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
                <p className="text-sm text-gray-500 mt-1">Free 15-minute consultation for new students</p>
              </div>

              <form onSubmit={handleBooking} className="flex flex-col gap-4">
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
                    className="w-full h-14 border-2 border-blue-600 text-blue-600 rounded-xl font-bold text-lg hover:bg-blue-50 transition-all"
                  >
                    Contact Tutor
                  </button>
                </div>
              </form>

              <div className="flex items-center justify-center gap-6 pt-4 border-t border-gray-100">
                <div className="flex flex-col items-center gap-1">
                  <Phone className="w-5 h-5 text-gray-400" />
                  <span className="text-[10px] font-bold text-gray-400 uppercase">CALL</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <Mail className="w-5 h-5 text-gray-400" />
                  <span className="text-[10px] font-bold text-gray-400 uppercase">EMAIL</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <MessageCircle className="w-5 h-5 text-gray-400" />
                  <span className="text-[10px] font-bold text-gray-400 uppercase">CHAT</span>
                </div>
              </div>

              <p className="text-[11px] text-center text-gray-400">
                By clicking Request Lesson, you agree to our Terms of Service.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
