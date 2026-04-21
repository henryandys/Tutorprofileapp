// src/app/pages/TutorMyProfile.tsx

import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { Navbar } from "../components/Navbar";
import {
  User, BookOpen, DollarSign, MapPin, GraduationCap, Briefcase,
  Plus, X, Save, Camera, Award, Star, FileText,
  ChevronRight, Loader2, Clock, CheckCircle, XCircle, MessageCircle
} from "lucide-react";
import { ConversationModal } from "../components/ConversationModal";
import { toast } from "sonner";
import { Link } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as const
type Day = typeof DAYS[number]
interface DaySlot { available: boolean; start: string; end: string }
type WeekAvail = Record<Day, DaySlot>

const DEFAULT_AVAIL: WeekAvail = Object.fromEntries(
  DAYS.map(d => [d, { available: false, start: '09:00', end: '17:00' }])
) as WeekAvail

const DAY_LABELS: Record<Day, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
}

interface TutorProfileForm {
  name:             string;
  location:         string;
  tutoringLocation: string;
  hourlyRate:       number;
  bio:              string;
  education:        string;
  experience:       string;
  specialties:      { value: string }[];
}

interface Booking {
  id:           string;
  student_name: string;
  subject:      string;
  message:      string;
  status:       'pending' | 'accepted' | 'declined';
  created_at:   string;
}

export function TutorMyProfile() {
  const { user, profile, refreshProfile } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [bookings, setBookings]   = useState<Booking[]>([])
  const [loadingBookings, setLoadingBookings] = useState(true)
  const [tutorData, setTutorData] = useState<any>(null)

  const [availability, setAvailability] = useState<WeekAvail>(DEFAULT_AVAIL)

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<TutorProfileForm>()
  const { fields, append, remove } = useFieldArray({ control, name: "specialties" })

  function toggleDay(day: Day) {
    setAvailability(prev => ({ ...prev, [day]: { ...prev[day], available: !prev[day].available } }))
  }
  function updateTime(day: Day, field: 'start' | 'end', value: string) {
    setAvailability(prev => ({ ...prev, [day]: { ...prev[day], [field]: value } }))
  }

  // Load tutor profile + bookings
  useEffect(() => {
    if (!user) return

    // Fetch tutor_profiles row
    supabase
      .from('tutor_profiles')
      .select('*')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        setTutorData(data)
        if (data?.availability) {
          setAvailability({ ...DEFAULT_AVAIL, ...data.availability })
        }
        reset({
          name:             profile?.full_name ?? '',
          location:         profile?.location ?? '',
          hourlyRate:       data?.hourly_rate ?? 0,
          tutoringLocation: data?.tutoring_location ?? '',
          bio:              profile?.bio ?? '',
          education:        data?.education ?? '',
          experience:       data?.experience_yrs ? `${data.experience_yrs} years` : '',
          specialties:      (data?.subjects ?? []).map((s: string) => ({ value: s })),
        })
      })

    // Fetch incoming bookings
    supabase
      .from('bookings')
      .select('*')
      .eq('tutor_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setBookings(data ?? [])
        setLoadingBookings(false)
      })
  }, [user, profile])

  async function onSubmit(data: TutorProfileForm) {
    if (!user) return
    setSaving(true)

    const expMatch = data.experience.match(/\d+/)
    const experienceYrs = expMatch ? parseInt(expMatch[0]) : 0

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        full_name:  data.name,
        location:   data.location,
        bio:        data.bio,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    const { error: tutorError } = await supabase
      .from('tutor_profiles')
      .upsert({
        id:             user.id,
        hourly_rate:       Number(data.hourlyRate),
        tutoring_location: data.tutoringLocation,
        education:         data.education,
        experience_yrs:    experienceYrs,
        subjects:          data.specialties.map(s => s.value).filter(Boolean),
        availability:      availability,
        is_available:      true,
      }, { onConflict: 'id' })

    if (profileError || tutorError) {
      toast.error('Failed to save changes.')
    } else {
      await refreshProfile()
      toast.success('Profile updated!')
      setIsEditing(false)
    }

    setSaving(false)
  }

  async function updateBookingStatus(bookingId: string, status: 'accepted' | 'declined') {
    const { error } = await supabase
      .from('bookings')
      .update({ status })
      .eq('id', bookingId)

    if (error) {
      toast.error('Failed to update booking.')
    } else {
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status } : b))
      toast.success(`Booking ${status}.`)
    }
  }

  const pendingCount = bookings.filter(b => b.status === 'pending').length
  const [chatBooking, setChatBooking] = useState<{ id: string; name: string; subject: string } | null>(null)

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-12">

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-black text-gray-900 tracking-tight mb-2">My Profile</h1>
            <p className="text-gray-500 font-medium">Manage your tutor profile and incoming bookings</p>
          </div>
          {!isEditing ? (
            <button onClick={() => setIsEditing(true)} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg">
              Edit Profile
            </button>
          ) : (
            <button onClick={() => setIsEditing(false)} className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 transition-all">
              Cancel
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

          {/* Basic Info */}
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <User className="w-6 h-6 text-blue-600" />
              Basic Information
            </h2>

            <div className="flex flex-col md:flex-row gap-8 items-start">
              <div className="relative group">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-32 h-32 rounded-full object-cover" />
                ) : (
                  <div className="w-32 h-32 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-4xl font-bold">
                    {(profile?.full_name ?? 'T').charAt(0).toUpperCase()}
                  </div>
                )}
                {isEditing && (
                  <button type="button" className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full shadow-lg hover:bg-blue-700">
                    <Camera className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Full Name</label>
                  <input
                    {...register("name", { required: true })}
                    disabled={!isEditing}
                    className="w-full h-12 px-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 bg-gray-50 disabled:bg-gray-100 disabled:text-gray-600"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Email</label>
                  <input
                    value={user?.email ?? ''}
                    disabled
                    className="w-full h-12 px-4 border border-gray-200 rounded-xl font-bold text-gray-400 bg-gray-100 cursor-not-allowed"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Location</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                    <input
                      {...register("location")}
                      disabled={!isEditing}
                      className="w-full h-12 pl-12 pr-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 bg-gray-50 disabled:bg-gray-100 disabled:text-gray-600"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Preferred Tutoring Address</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                    <input
                      {...register("tutoringLocation")}
                      disabled={!isEditing}
                      placeholder="e.g. 123 Main St, Seattle, WA 98101"
                      className="w-full h-12 pl-12 pr-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 bg-gray-50 disabled:bg-gray-100 disabled:text-gray-600"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Hourly Rate ($)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                    <input
                      type="number"
                      {...register("hourlyRate", { required: true, min: 1 })}
                      disabled={!isEditing}
                      className="w-full h-12 pl-12 pr-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 bg-gray-50 disabled:bg-gray-100 disabled:text-gray-600"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">About / Bio</label>
              <textarea
                {...register("bio")}
                disabled={!isEditing}
                rows={4}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-800 bg-gray-50 disabled:bg-gray-100 disabled:text-gray-600"
              />
            </div>
          </div>

          {/* Specialties */}
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <BookOpen className="w-6 h-6 text-blue-600" />
                Specialties & Subjects
              </h2>
              {isEditing && (
                <button type="button" onClick={() => append({ value: '' })} className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg font-bold hover:bg-blue-200">
                  <Plus className="w-4 h-4" />
                  Add Subject
                </button>
              )}
            </div>
            <div className="space-y-3">
              {fields.length === 0 && (
                <p className="text-gray-400 text-center py-4 font-medium">No subjects added yet.</p>
              )}
              {fields.map((field, index) => (
                <div key={field.id} className="flex items-center gap-3">
                  <input
                    {...register(`specialties.${index}.value`, { required: true })}
                    disabled={!isEditing}
                    placeholder="e.g. Advanced Calculus"
                    className="flex-1 h-12 px-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 bg-gray-50 disabled:bg-gray-100 disabled:text-gray-600"
                  />
                  {isEditing && fields.length > 1 && (
                    <button type="button" onClick={() => remove(index)} className="p-3 text-red-500 hover:bg-red-50 rounded-lg">
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Credentials */}
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Award className="w-6 h-6 text-blue-600" />
              Credentials & Experience
            </h2>
            <div className="space-y-6">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Education</label>
                <div className="relative">
                  <GraduationCap className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                  <input
                    {...register("education")}
                    disabled={!isEditing}
                    placeholder="e.g. Ph.D. in Physics, MIT"
                    className="w-full h-12 pl-12 pr-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 bg-gray-50 disabled:bg-gray-100 disabled:text-gray-600"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Years of Experience</label>
                <div className="relative">
                  <Briefcase className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                  <input
                    {...register("experience")}
                    disabled={!isEditing}
                    placeholder="e.g. 10 years"
                    className="w-full h-12 pl-12 pr-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 bg-gray-50 disabled:bg-gray-100 disabled:text-gray-600"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Availability */}
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Clock className="w-6 h-6 text-blue-600" />
              Weekly Availability
            </h2>
            <div className="flex flex-col divide-y divide-gray-100">
              {DAYS.map(day => {
                const slot = availability[day]
                return (
                  <div key={day} className="flex flex-wrap items-center gap-4 py-3">
                    <span className="w-28 font-bold text-gray-700 capitalize">{DAY_LABELS[day]}</span>

                    <button
                      type="button"
                      onClick={() => isEditing && toggleDay(day)}
                      className={`px-3 py-1 rounded-full text-sm font-bold transition-colors ${
                        slot.available
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-400'
                      } ${isEditing ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                    >
                      {slot.available ? 'Available' : 'Unavailable'}
                    </button>

                    {slot.available && (
                      <div className="flex items-center gap-2 ml-auto">
                        <input
                          type="time"
                          value={slot.start}
                          disabled={!isEditing}
                          onChange={e => updateTime(day, 'start', e.target.value)}
                          className="h-9 px-3 border border-gray-200 rounded-lg text-sm font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                        />
                        <span className="text-gray-400 font-bold">–</span>
                        <input
                          type="time"
                          value={slot.end}
                          disabled={!isEditing}
                          onChange={e => updateTime(day, 'end', e.target.value)}
                          className="h-9 px-3 border border-gray-200 rounded-lg text-sm font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Performance stats */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl shadow-lg p-8 text-white">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Star className="w-6 h-6" />
              Your Performance
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-4xl font-black mb-1">{tutorData?.rating ?? '—'}</div>
                <div className="text-sm text-blue-100 font-medium">Average Rating</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-black mb-1">{tutorData?.review_count ?? 0}</div>
                <div className="text-sm text-blue-100 font-medium">Total Reviews</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-black mb-1">{bookings.length}</div>
                <div className="text-sm text-blue-100 font-medium">Lesson Requests</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-black mb-1">{pendingCount}</div>
                <div className="text-sm text-blue-100 font-medium">Pending</div>
              </div>
            </div>
          </div>

          {/* Incoming Bookings */}
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Clock className="w-6 h-6 text-blue-600" />
              Lesson Requests
              {pendingCount > 0 && (
                <span className="ml-2 px-2.5 py-0.5 bg-blue-600 text-white text-xs font-bold rounded-full">
                  {pendingCount} new
                </span>
              )}
            </h2>

            {loadingBookings ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            ) : bookings.length === 0 ? (
              <p className="text-gray-400 text-center py-8 font-medium">No lesson requests yet.</p>
            ) : (
              <div className="space-y-4">
                {bookings.map(booking => (
                  <div key={booking.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 border border-gray-100 rounded-2xl hover:border-blue-100 hover:bg-blue-50/30 transition-colors">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900">{booking.student_name}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          booking.status === 'pending'  ? 'bg-yellow-100 text-yellow-700' :
                          booking.status === 'accepted' ? 'bg-green-100 text-green-700' :
                          'bg-red-100 text-red-600'
                        }`}>
                          {booking.status}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-blue-600">{booking.subject}</span>
                      {booking.message && (
                        <p className="text-sm text-gray-500 mt-1 max-w-md">{booking.message}</p>
                      )}
                      <span className="text-xs text-gray-400 mt-1">
                        {new Date(booking.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {booking.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            onClick={() => updateBookingStatus(booking.id, 'accepted')}
                            className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg font-bold text-sm hover:bg-green-700 transition-colors"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Accept
                          </button>
                          <button
                            type="button"
                            onClick={() => updateBookingStatus(booking.id, 'declined')}
                            className="flex items-center gap-1.5 px-4 py-2 bg-red-100 text-red-600 rounded-lg font-bold text-sm hover:bg-red-200 transition-colors"
                          >
                            <XCircle className="w-4 h-4" />
                            Decline
                          </button>
                        </>
                      )}
                      {booking.status === 'accepted' && (
                        <button
                          type="button"
                          onClick={() => setChatBooking({ id: booking.id, name: booking.student_name, subject: booking.subject })}
                          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 transition-colors"
                        >
                          <MessageCircle className="w-4 h-4" />
                          Message
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Repository */}
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-2">
                  <FileText className="w-6 h-6 text-blue-600" />
                  Resource Repository
                </h2>
                <p className="text-gray-500 text-sm font-medium">Access and share teaching materials</p>
              </div>
              <Link to="/repository" className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg">
                View Repository
                <ChevronRight className="w-5 h-5" />
              </Link>
            </div>
          </div>

          {/* Save button */}
          {isEditing && (
            <div className="flex justify-end gap-4 pt-4">
              <button type="button" onClick={() => setIsEditing(false)} className="px-8 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="flex items-center gap-2 px-10 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-xl shadow-blue-200 disabled:opacity-60">
                {saving && <Loader2 className="w-5 h-5 animate-spin" />}
                <Save className="w-5 h-5" />
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          )}
        </form>
      </main>

      {chatBooking && (
        <ConversationModal
          bookingId={chatBooking.id}
          otherName={chatBooking.name}
          subject={chatBooking.subject}
          onClose={() => setChatBooking(null)}
        />
      )}
    </div>
  )
}
