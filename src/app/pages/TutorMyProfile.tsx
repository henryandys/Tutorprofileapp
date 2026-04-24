// src/app/pages/TutorMyProfile.tsx

import { useState, useEffect, useRef, useCallback } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { Navbar } from "../components/Navbar";
import {
  User, BookOpen, DollarSign, MapPin, GraduationCap, Briefcase,
  Plus, X, Save, Camera, Award, Star, FileText, Calendar,
  ChevronRight, Loader2, Clock, Shield, CreditCard, Users
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { CreateGroupLessonModal, type GroupLesson } from "../components/CreateGroupLessonModal";
import { GroupEnrollmentModal } from "../components/GroupEnrollmentModal";

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
  policy:           string;
  specialties:      { value: string }[];
}

interface Booking {
  id:           string;
  student_id:   string;
  student_name: string;
  subject:      string;
  message:      string;
  status:       'pending' | 'accepted' | 'declined';
  created_at:   string;
  scheduled_at: string | null;
}

type Visibility = 'public' | 'accepted_only' | 'specific'

interface TutorResource {
  id:                  string;
  title:               string;
  subject:             string;
  grade_level:         string;
  file_url:            string;
  file_name:           string;
  file_type:           string;
  downloads:           number;
  created_at:          string;
  visibility:          Visibility;
  allowed_student_ids: string[];
}

export function TutorMyProfile() {
  const { user, profile, refreshProfile } = useAuth()
  const [isEditing, setIsEditing]       = useState(false)
  const [saving, setSaving]             = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const handleAvatarChange = useCallback(async (e: { target: HTMLInputElement & EventTarget }) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    const allowed: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
    if (!allowed[file.type]) { toast.error('Please upload a JPEG, PNG, or WebP image.'); return }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5 MB.'); return }
    setUploadingAvatar(true)
    const path = `${user.id}/avatar.${allowed[file.type]}`
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (uploadError) { toast.error('Upload failed: ' + uploadError.message); setUploadingAvatar(false); return }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    const { error: updateError } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id)
    if (updateError) { toast.error('Failed to save avatar.') } else { await refreshProfile(); toast.success('Profile picture updated!') }
    setUploadingAvatar(false)
    e.target.value = ''
  }, [user, refreshProfile])
  const [bookings, setBookings]         = useState<Booking[]>([])
  const [loadingBookings, setLoadingBookings] = useState(true)
  const [tutorData, setTutorData]       = useState<any>(null)
  const [myResources, setMyResources]   = useState<TutorResource[]>([])
  const [loadingResources, setLoadingResources] = useState(true)
  const [groupLessons, setGroupLessons] = useState<GroupLesson[]>([])
  const [loadingGroupLessons, setLoadingGroupLessons] = useState(true)
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [enrollmentGroup, setEnrollmentGroup] = useState<GroupLesson | null>(null)

  const [availability, setAvailability]   = useState<WeekAvail>(DEFAULT_AVAIL)
  const [blackoutDates, setBlackoutDates] = useState<string[]>([])
  const [newBlackout, setNewBlackout]     = useState('')

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
        if (data?.blackout_dates) {
          setBlackoutDates(data.blackout_dates)
        }
        reset({
          name:             profile?.full_name ?? '',
          location:         profile?.location ?? '',
          hourlyRate:       data?.hourly_rate ?? 0,
          tutoringLocation: data?.tutoring_location ?? '',
          bio:              profile?.bio ?? '',
          education:        data?.education ?? '',
          experience:       data?.experience_yrs ? `${data.experience_yrs} years` : '',
          policy:           data?.policy ?? '',
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

    // Fetch this tutor's uploaded resources
    supabase
      .from('resources')
      .select('*')
      .eq('tutor_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setMyResources(data ?? [])
        setLoadingResources(false)
      })

    // Fetch group lessons with enrollment counts
    supabase
      .from('group_lessons')
      .select('*, group_lesson_enrollments(count)')
      .eq('tutor_id', user.id)
      .order('scheduled_at', { ascending: true })
      .then(({ data }) => {
        setGroupLessons(
          (data ?? []).map((g: any) => ({
            ...g,
            enrollment_count: g.group_lesson_enrollments?.[0]?.count ?? 0,
          }))
        )
        setLoadingGroupLessons(false)
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
        blackout_dates:    blackoutDates,
        policy:            data.policy,
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


  async function handleDeleteResource(resource: TutorResource) {
    // Extract the storage path from the public URL
    const storagePath = resource.file_url.split('/storage/v1/object/public/resources/')[1]
    if (storagePath) {
      await supabase.storage.from('resources').remove([decodeURIComponent(storagePath)])
    }
    const { error } = await supabase.from('resources').delete().eq('id', resource.id).eq('tutor_id', user!.id)
    if (error) {
      toast.error('Failed to remove: ' + error.message)
      return
    }
    setMyResources(prev => prev.filter(r => r.id !== resource.id))
    toast.success('Resource removed from repository.')
  }

  async function updateResourceVisibility(resourceId: string, visibility: Visibility, allowedIds: string[]) {
    const { error } = await supabase
      .from('resources')
      .update({ visibility, allowed_student_ids: visibility === 'specific' ? allowedIds : [] })
      .eq('id', resourceId)
      .eq('tutor_id', user!.id)
    if (error) { toast.error('Failed to update visibility.'); return }
    setMyResources(prev => prev.map(r =>
      r.id === resourceId ? { ...r, visibility, allowed_student_ids: visibility === 'specific' ? allowedIds : [] } : r
    ))
  }

  // Unique accepted students derived from bookings
  const acceptedStudents = (() => {
    const seen = new Set<string>()
    return bookings
      .filter(b => b.status === 'accepted')
      .filter(b => { if (seen.has(b.student_id)) return false; seen.add(b.student_id); return true })
      .map(b => ({ id: b.student_id, name: b.student_name }))
  })()

  const pendingCount = bookings.filter(b => b.status === 'pending').length

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
              <div
                className="relative group cursor-pointer"
                onClick={() => avatarInputRef.current?.click()}
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-32 h-32 rounded-full object-cover" />
                ) : (
                  <div className="w-32 h-32 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-4xl font-bold">
                    {(profile?.full_name ?? 'T').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full shadow-lg hover:bg-blue-700 transition-colors">
                  {uploadingAvatar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
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

          {/* Policy */}
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Calendar className="w-6 h-6 text-blue-600" />
              Session Policy
            </h2>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">
                Cancellation, Payment & Session Rules
              </label>
              <textarea
                {...register("policy")}
                disabled={!isEditing}
                rows={4}
                placeholder="e.g. 24-hour cancellation notice required. Payment due before session. Sessions held via Zoom or in-person."
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

            {/* Blocked Dates */}
            <div className="mt-6 pt-6 border-t border-gray-100">
              <h3 className="text-sm font-black text-gray-700 mb-1 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-red-400" /> Blocked Dates
              </h3>
              <p className="text-xs text-gray-400 font-medium mb-3">Specific dates you won't be available — overrides your weekly schedule.</p>

              {isEditing && (
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="date"
                    value={newBlackout}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={e => setNewBlackout(e.target.value)}
                    className="h-9 px-3 border border-gray-200 rounded-lg text-sm font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newBlackout || blackoutDates.includes(newBlackout)) return
                      setBlackoutDates(prev => [...prev, newBlackout].sort())
                      setNewBlackout('')
                    }}
                    disabled={!newBlackout}
                    className="h-9 px-4 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-bold hover:bg-red-100 transition-colors disabled:opacity-40"
                  >
                    Block Date
                  </button>
                </div>
              )}

              {blackoutDates.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No dates blocked.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {blackoutDates.map(d => (
                    <span key={d} className="flex items-center gap-1.5 px-3 py-1 bg-red-50 border border-red-100 rounded-full text-xs font-bold text-red-600">
                      {new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {isEditing && (
                        <button
                          type="button"
                          onClick={() => setBlackoutDates(prev => prev.filter(x => x !== d))}
                          className="hover:text-red-800 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Performance stats */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl shadow-lg p-8 text-white">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Star className="w-6 h-6" />
              Your Performance
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <Link to="/my-reviews" className="text-center group cursor-pointer">
                <div className="text-4xl font-black mb-1 group-hover:scale-110 transition-transform">{tutorData?.rating ?? '—'}</div>
                <div className="text-sm text-blue-100 font-medium group-hover:text-white transition-colors">Average Rating</div>
              </Link>
              <Link to="/my-reviews" className="text-center group cursor-pointer">
                <div className="text-4xl font-black mb-1 group-hover:scale-110 transition-transform">{tutorData?.review_count ?? 0}</div>
                <div className="text-sm text-blue-100 font-medium group-hover:text-white transition-colors">Total Reviews</div>
              </Link>
              <Link to="/lessons" className="text-center group cursor-pointer">
                <div className="text-4xl font-black mb-1 group-hover:scale-110 transition-transform">{bookings.length}</div>
                <div className="text-sm text-blue-100 font-medium group-hover:text-white transition-colors">Lesson Requests</div>
              </Link>
              <Link to="/lessons" className="text-center group cursor-pointer">
                <div className="text-4xl font-black mb-1 group-hover:scale-110 transition-transform">{pendingCount}</div>
                <div className="text-sm text-blue-100 font-medium group-hover:text-white transition-colors">Pending</div>
              </Link>
            </div>
          </div>

          {/* Lesson Requests — link to calendar */}
          <Link
            to="/lessons"
            className="bg-white rounded-3xl shadow-lg border border-gray-100 p-8 flex items-center justify-between hover:border-blue-200 hover:shadow-xl transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center shrink-0">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-gray-900">Lesson Requests</h2>
                  {pendingCount > 0 && (
                    <span className="px-2.5 py-0.5 bg-blue-600 text-white text-xs font-bold rounded-full">
                      {pendingCount} pending
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 font-medium mt-0.5">
                  {bookings.length === 0
                    ? 'No lesson requests yet'
                    : `${bookings.length} request${bookings.length !== 1 ? 's' : ''} · View calendar`}
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors shrink-0" />
          </Link>

          {/* Group Sessions */}
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-1">
                  <Users className="w-6 h-6 text-purple-600" />
                  Group Sessions
                </h2>
                <p className="text-gray-500 text-sm font-medium">Sessions multiple students can enroll in</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateGroup(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-all shadow-lg shadow-purple-200 text-sm"
              >
                <Plus className="w-4 h-4" />
                New Session
              </button>
            </div>

            {loadingGroupLessons ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
              </div>
            ) : groupLessons.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-2xl">
                <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-400 font-medium text-sm">No group sessions yet.</p>
                <button type="button" onClick={() => setShowCreateGroup(true)} className="text-purple-600 font-bold text-sm hover:underline mt-1">
                  Create your first one
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {groupLessons.map(gl => {
                  const spotsLeft = gl.max_students - (gl.enrollment_count ?? 0)
                  const isFull    = spotsLeft <= 0
                  const isPast    = new Date(gl.scheduled_at) < new Date()
                  return (
                    <div key={gl.id} className="py-4 flex items-start justify-between gap-4 cursor-pointer hover:bg-purple-50 -mx-2 px-2 rounded-xl transition-colors" onClick={() => setEnrollmentGroup(gl)}>
                      <div className="flex items-start gap-4 min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          isPast ? 'bg-gray-100' : 'bg-purple-100'
                        }`}>
                          <Users className={`w-5 h-5 ${isPast ? 'text-gray-400' : 'text-purple-600'}`} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-gray-900 truncate">{gl.title}</p>
                            {gl.status === 'cancelled' && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-600">Cancelled</span>
                            )}
                            {isFull && gl.status === 'open' && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-600">Full</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 font-medium mt-0.5">
                            {gl.subject} ·{' '}
                            {new Date(gl.scheduled_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}{' '}
                            {new Date(gl.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}{' '}
                            · {gl.duration_minutes} min
                          </p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs font-bold text-gray-500 flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {gl.enrollment_count ?? 0} / {gl.max_students} enrolled
                              <span className="text-purple-500 font-bold ml-1">· View roster</span>
                            </span>
                            {gl.price > 0 && (
                              <span className="text-xs font-bold text-green-600">${gl.price}/student</span>
                            )}
                            {gl.price === 0 && (
                              <span className="text-xs font-bold text-green-600">Free</span>
                            )}
                          </div>
                          {gl.description && (
                            <p className="text-sm text-gray-500 font-medium mt-1 line-clamp-1">{gl.description}</p>
                          )}
                        </div>
                      </div>
                      {gl.status === 'open' && !isPast && (
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation()
                            const { error } = await supabase
                              .from('group_lessons')
                              .update({ status: 'cancelled' })
                              .eq('id', gl.id)
                              .eq('tutor_id', user!.id)
                            if (error) { toast.error('Could not cancel session.'); return }
                            setGroupLessons(prev => prev.map(g => g.id === gl.id ? { ...g, status: 'cancelled' } : g))
                            toast.success('Session cancelled.')
                          }}
                          className="shrink-0 text-xs font-bold text-red-500 hover:text-red-700 px-3 py-1.5 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Repository */}
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-2">
                  <FileText className="w-6 h-6 text-blue-600" />
                  My Repository Files
                </h2>
                <p className="text-gray-500 text-sm font-medium">Files you've uploaded to the shared repository</p>
              </div>
              <Link to="/repository" className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg">
                View Repository
                <ChevronRight className="w-5 h-5" />
              </Link>
            </div>

            {loadingResources ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            ) : myResources.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-2xl">
                <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-400 font-medium text-sm">No files uploaded yet.</p>
                <Link to="/repository" className="text-blue-600 font-bold text-sm hover:underline">
                  Go to the repository to upload
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {myResources.map(resource => (
                  <div key={resource.id} className="py-4 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-gray-900 truncate">{resource.title}</p>
                          <p className="text-xs text-gray-400 font-medium">
                            {resource.subject} · {resource.grade_level} · {resource.downloads} downloads
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href={resource.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="View file"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </a>
                        <button
                          type="button"
                          onClick={() => handleDeleteResource(resource)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remove from repository"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Visibility control */}
                    <div className="ml-14 flex flex-col gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Access:</span>
                        {(['public', 'accepted_only', 'specific'] as Visibility[]).map(v => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => updateResourceVisibility(resource.id, v, resource.allowed_student_ids)}
                            className={`text-xs font-bold px-3 py-1 rounded-full border transition-colors ${
                              resource.visibility === v
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-gray-500 border-gray-200 hover:border-blue-400'
                            }`}
                          >
                            {v === 'public'        && 'Everyone'}
                            {v === 'accepted_only' && 'Accepted only'}
                            {v === 'specific'      && 'Specific students'}
                          </button>
                        ))}
                      </div>

                      {resource.visibility === 'specific' && (
                        <div className="border border-gray-200 rounded-xl p-3 bg-gray-50">
                          {acceptedStudents.length === 0 ? (
                            <p className="text-xs text-gray-400 font-medium">No accepted students yet.</p>
                          ) : (
                            <div className="flex flex-wrap gap-x-4 gap-y-2">
                              {acceptedStudents.map(s => (
                                <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={resource.allowed_student_ids.includes(s.id)}
                                    onChange={e => {
                                      const next = e.target.checked
                                        ? [...resource.allowed_student_ids, s.id]
                                        : resource.allowed_student_ids.filter(id => id !== s.id)
                                      updateResourceVisibility(resource.id, 'specific', next)
                                    }}
                                    className="accent-blue-600"
                                  />
                                  <span className="text-sm font-medium text-gray-700">{s.name}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Account links */}
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
            <Link to="/privacy-security" className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors border-b border-gray-100 group">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-gray-400" />
                <span className="font-bold text-gray-700">Privacy &amp; Security</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
            </Link>
            <button className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors group">
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5 text-gray-400" />
                <span className="font-bold text-gray-700">Payments</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
            </button>
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

      {showCreateGroup && (
        <CreateGroupLessonModal
          tutorSubjects={(tutorData?.subjects ?? []) as string[]}
          onCreated={lesson => {
            setGroupLessons(prev => [lesson, ...prev])
            setShowCreateGroup(false)
          }}
          onClose={() => setShowCreateGroup(false)}
        />
      )}

      {enrollmentGroup && (
        <GroupEnrollmentModal
          group={enrollmentGroup}
          onClose={() => setEnrollmentGroup(null)}
          onRemove={() => {
            setGroupLessons(prev => prev.map(g =>
              g.id === enrollmentGroup.id
                ? { ...g, enrollment_count: Math.max(0, (g.enrollment_count ?? 1) - 1) }
                : g
            ))
          }}
        />
      )}
    </div>
  )
}
