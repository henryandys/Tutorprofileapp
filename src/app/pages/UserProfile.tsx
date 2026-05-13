import { useState, useEffect, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { Navbar } from "../components/Navbar";
import { User, Mail, Phone, MapPin, Camera, Save, Bell, Shield, CreditCard, ChevronRight, Clock, Loader2, Heart, Star, GraduationCap, Lightbulb, Users, Copy, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Link, useNavigate, Navigate } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { findBannedWord, CONTENT_POLICY_MESSAGE } from "../../lib/contentPolicy";

interface StudentBooking {
  id:           string
  tutor_id:     string
  subject:      string
  message:      string
  status:       'pending' | 'accepted' | 'declined'
  created_at:   string
  scheduled_at: string | null
  tutor:        { full_name: string } | null
}

interface SavedTutorRow {
  tutor_id:     string
  tutor_name:   string
  avatar_url:   string | null
  hourly_rate:  number | null
  rating:       number | null
  review_count: number | null
  subject:      string | null
}

interface UserProfileForm {
  firstName: string;
  lastName:  string;
  email:     string;
  phone:     string;
  location:  string;
  bio:       string;
}

export function UserProfile() {
  const { user, profile, role, loading, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
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

  useEffect(() => {
    if (role === 'tutor')   navigate('/my-profile',         { replace: true })
    if (role === 'parent')  navigate('/guardian-dashboard', { replace: true })
  }, [role, navigate])

  const [bookings, setBookings]               = useState<StudentBooking[]>([])
  const [msgCount, setMsgCount]               = useState(0)
  const [sessionNotifCount, setSessionNotifCount] = useState(0)
  const [savedTutors, setSavedTutors]         = useState<SavedTutorRow[]>([])
  const notifSectionRef = useRef<HTMLDivElement>(null)

  // Guardian link state
  interface GuardianRow { id: string; parent_id: string | null; parent_name: string; parent_avatar: string | null; created_at: string; status: string }
  const [guardians,         setGuardians]         = useState<GuardianRow[]>([])
  const [generatingInvite,  setGeneratingInvite]  = useState(false)
  const [pendingInviteLink, setPendingInviteLink] = useState<string | null>(null)
  const [inviteCopied,      setInviteCopied]      = useState(false)

  // Fetch notification counts for students
  useEffect(() => {
    if (!user) return
    const lastCheck = localStorage.getItem(`notifLastCheck_${user.id}`) ?? new Date(0).toISOString()
    const seenIds: string[] = JSON.parse(localStorage.getItem(`notifSeenBookings_${user.id}`) ?? '[]')
    supabase
      .from('bookings')
      .select('id, status')
      .eq('student_id', user.id)
      .then(({ data }) => {
        const all = data ?? []
        setSessionNotifCount(all.filter(b => b.status !== 'pending' && !seenIds.includes(b.id)).length)
        const acceptedIds = all.filter(b => b.status === 'accepted').map(b => b.id)
        if (acceptedIds.length > 0) {
          supabase
            .from('messages')
            .select('id', { count: 'exact', head: true })
            .in('booking_id', acceptedIds)
            .neq('sender_id', user.id)
            .gt('created_at', lastCheck)
            .then(({ count }) => setMsgCount(count ?? 0))
        }
      })
  }, [user])

  // Fetch student bookings for the My Lesson Requests section
  useEffect(() => {
    if (!user) return
    supabase
      .from('bookings')
      .select('*, tutor:tutor_id(full_name)')
      .eq('student_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setBookings((data ?? []) as StudentBooking[]))
  }, [user])

  // Load saved tutors with profile + stats
  useEffect(() => {
    if (!user) return
    supabase
      .from('saved_tutors')
      .select('tutor_id')
      .eq('student_id', user.id)
      .order('created_at', { ascending: false })
      .then(async ({ data: saved }) => {
        if (!saved || saved.length === 0) return
        const ids = saved.map((r: any) => r.tutor_id as string)
        const [{ data: profiles }, { data: tProfiles }] = await Promise.all([
          supabase.from('profiles').select('id, full_name, avatar_url').in('id', ids),
          supabase.from('tutor_profiles').select('id, hourly_rate, subjects').in('id', ids),
        ])
        const { data: reviews } = await supabase
          .from('reviews')
          .select('tutor_id, rating')
          .in('tutor_id', ids)
        const ratingMap: Record<string, { sum: number; count: number }> = {}
        for (const r of reviews ?? []) {
          if (!ratingMap[r.tutor_id]) ratingMap[r.tutor_id] = { sum: 0, count: 0 }
          ratingMap[r.tutor_id].sum   += r.rating
          ratingMap[r.tutor_id].count += 1
        }
        const profileMap: Record<string, any> = {}
        for (const p of profiles ?? []) profileMap[p.id] = p
        const tpMap: Record<string, any> = {}
        for (const tp of tProfiles ?? []) tpMap[tp.id] = tp

        setSavedTutors(ids.map(id => {
          const p  = profileMap[id] ?? {}
          const tp = tpMap[id] ?? {}
          const stats = ratingMap[id]
          return {
            tutor_id:    id,
            tutor_name:  p.full_name ?? 'Tutor',
            avatar_url:  p.avatar_url ?? null,
            hourly_rate: tp.hourly_rate ?? null,
            subject:     Array.isArray(tp.subjects) ? tp.subjects[0] : (tp.subjects ?? null),
            rating:      stats ? Math.round((stats.sum / stats.count) * 10) / 10 : null,
            review_count: stats?.count ?? null,
          }
        }))
      })
  }, [user])

  // Load active guardians for the student
  useEffect(() => {
    if (!user) return
    supabase
      .from('parent_links')
      .select('id, parent_id, status, created_at, parent:parent_id(full_name, avatar_url)')
      .eq('student_id', user.id)
      .eq('status', 'active')
      .then(({ data }) => {
        setGuardians(
          (data ?? []).map((r: any) => ({
            id:           r.id,
            parent_id:    r.parent_id,
            parent_name:  r.parent?.full_name ?? 'Guardian',
            parent_avatar: r.parent?.avatar_url ?? null,
            created_at:   r.created_at,
            status:       r.status,
          }))
        )
      })
  }, [user])

  async function generateInviteLink() {
    if (!user) return
    setGeneratingInvite(true)
    const { data, error } = await supabase
      .from('parent_links')
      .insert({ student_id: user.id })
      .select('invite_token')
      .single()
    if (error || !data) { toast.error('Failed to generate link.'); setGeneratingInvite(false); return }
    const link = `${window.location.origin}/join-family/${data.invite_token}`
    setPendingInviteLink(link)
    setGeneratingInvite(false)
  }

  async function copyInviteLink() {
    if (!pendingInviteLink) return
    await navigator.clipboard.writeText(pendingInviteLink)
    setInviteCopied(true)
    setTimeout(() => setInviteCopied(false), 2000)
  }

  async function revokeGuardian(linkId: string) {
    const { error } = await supabase.from('parent_links').delete().eq('id', linkId).eq('student_id', user!.id)
    if (error) { toast.error('Failed to remove guardian.'); return }
    setGuardians(prev => prev.filter(g => g.id !== linkId))
    toast.success('Guardian access removed.')
  }

  const totalNotifCount = msgCount + sessionNotifCount

  function handleNotifClick() {
    if (!user) return
    if (totalNotifCount === 0) {
      navigate('/lessons')
      return
    }
    localStorage.setItem(`notifLastCheck_${user.id}`, new Date().toISOString())
    setMsgCount(0)
    setSessionNotifCount(0)
    supabase
      .from('bookings')
      .select('id')
      .eq('student_id', user.id)
      .neq('status', 'pending')
      .then(({ data }) => {
        const ids = (data ?? []).map(b => b.id)
        const existing: string[] = JSON.parse(localStorage.getItem(`notifSeenBookings_${user.id}`) ?? '[]')
        localStorage.setItem(
          `notifSeenBookings_${user.id}`,
          JSON.stringify([...new Set([...existing, ...ids])])
        )
      })
    notifSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const { register, handleSubmit, reset } = useForm<UserProfileForm>({
    defaultValues: { firstName: '', lastName: '', email: '', phone: '', location: '', bio: '' }
  })

  useEffect(() => {
    if (profile && user) {
      const parts = (profile.full_name ?? '').split(' ')
      reset({
        firstName: parts[0] ?? '',
        lastName:  parts.slice(1).join(' '),
        email:     user.email ?? '',
        phone:     profile.phone ?? '',
        location:  profile.location ?? '',
        bio:       profile.bio ?? '',
      })
    }
  }, [profile, user])

  const onSubmit = async (data: UserProfileForm) => {
    if (!user) return
    const bannedWord = findBannedWord(data.bio)
    if (bannedWord) {
      toast.error(`Your bio contains a banned word: "${bannedWord}". ${CONTENT_POLICY_MESSAGE}`)
      return
    }
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name:  `${data.firstName} ${data.lastName}`.trim(),
        location:   data.location,
        bio:        data.bio,
        phone:      data.phone || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
    if (error) {
      toast.error('Failed to save: ' + error.message)
    } else {
      await refreshProfile()
      toast.success('Profile updated successfully!')
    }
    setSaving(false)
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  )
  if (role === 'tutor') return <Navigate to="/my-profile" replace />

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 md:px-8 py-10">


        <div className="flex flex-col lg:flex-row gap-8">

          {/* Sidebar */}
          <aside className="w-full lg:w-64 shrink-0">
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="p-6 border-b border-gray-100 flex flex-col items-center text-center">
                <div
                  className="relative mb-4 group cursor-pointer"
                  onClick={() => avatarInputRef.current?.click()}
                >
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.full_name ?? ''}
                      className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md"
                    />
                  ) : (
                    <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center border-4 border-white shadow-md">
                      <User className="w-12 h-12 text-blue-600" />
                    </div>
                  )}
                  <div className="absolute bottom-0 right-0 bg-blue-600 p-2 rounded-full border-2 border-white text-white group-hover:bg-blue-700 transition-colors">
                    {uploadingAvatar ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
                  </div>
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
                <h2 className="font-bold text-gray-900 text-lg">
                  {profile?.full_name ?? user?.email ?? 'Loading…'}
                </h2>
                <p className="text-sm text-gray-500 font-medium capitalize">
                  {role ?? 'Student'} Account
                </p>
              </div>

              <nav className="p-2">
                <button className="w-full flex items-center gap-3 px-4 py-3 bg-blue-50 text-blue-700 rounded-xl font-bold text-sm transition-colors">
                  <User className="w-4 h-4" />
                  Personal Info
                </button>

                <button
                  onClick={handleNotifClick}
                  className="w-full flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-xl font-bold text-sm transition-colors"
                >
                  <div className="relative shrink-0">
                    <Bell className="w-4 h-4" />
                    {totalNotifCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
                    )}
                  </div>
                  Notifications
                  {totalNotifCount > 0 && (
                    <div className="ml-auto flex items-center gap-1">
                      {msgCount > 0 && (
                        <span className="bg-blue-600 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[1.1rem] text-center leading-none">
                          {msgCount}
                        </span>
                      )}
                      {sessionNotifCount > 0 && (
                        <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[1.1rem] text-center leading-none">
                          {sessionNotifCount}
                        </span>
                      )}
                    </div>
                  )}
                </button>

                <Link
                  to="/privacy-security"
                  className="w-full flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-xl font-bold text-sm transition-colors"
                >
                  <Shield className="w-4 h-4" />
                  Privacy & Security
                </Link>
                <button className="w-full flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-xl font-bold text-sm transition-colors">
                  <CreditCard className="w-4 h-4" />
                  Payments
                </button>

                <div className="mt-2 pt-2 border-t border-gray-100 space-y-0.5">
                  <Link
                    to="/needed-courses?mine=true"
                    className="w-full flex items-center gap-3 px-4 py-3 text-amber-600 hover:bg-amber-50 rounded-xl font-bold text-sm transition-colors"
                  >
                    <Lightbulb className="w-4 h-4" />
                    Needed Courses
                  </Link>
                  <Link
                    to="/become-a-tutor"
                    className="w-full flex items-center gap-3 px-4 py-3 text-purple-600 hover:bg-purple-50 rounded-xl font-bold text-sm transition-colors"
                  >
                    <GraduationCap className="w-4 h-4" />
                    Become an Instructor
                  </Link>
                </div>
              </nav>
            </div>
          </aside>

          {/* Main form */}
          <div className="flex-1">
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
              <header className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                <div>
                  <h1 className="text-2xl font-black text-gray-900">Personal Information</h1>
                  <p className="text-sm text-gray-500 font-medium">Update your profile details and how we contact you.</p>
                </div>
                <button
                  onClick={handleSubmit(onSubmit)}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-60"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </header>

              <form className="p-8 space-y-10">

                {/* Basic Details */}
                <section>
                  <div className="flex items-center gap-2 mb-6">
                    <div className="w-1 h-6 bg-blue-600 rounded-full" />
                    <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">Basic Details</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">FIRST NAME</label>
                      <input
                        {...register("firstName", { required: true })}
                        className="w-full h-12 px-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 bg-gray-50"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">LAST NAME</label>
                      <input
                        {...register("lastName")}
                        className="w-full h-12 px-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 bg-gray-50"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">EMAIL ADDRESS</label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                        <input
                          {...register("email")}
                          disabled
                          className="w-full h-12 pl-12 pr-4 border border-gray-200 rounded-xl font-bold text-gray-400 bg-gray-100 cursor-not-allowed"
                        />
                      </div>
                      <p className="text-[11px] text-gray-400 px-1">Email cannot be changed here.</p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">PHONE NUMBER</label>
                      <div className="relative">
                        <Phone className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                        <input
                          {...register("phone")}
                          placeholder="(555) 000-0000"
                          className="w-full h-12 pl-12 pr-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 bg-gray-50"
                        />
                      </div>
                    </div>
                  </div>
                </section>

                {/* Location */}
                <section>
                  <div className="flex items-center gap-2 mb-6">
                    <div className="w-1 h-6 bg-blue-600 rounded-full" />
                    <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">Location Settings</h3>
                  </div>
                  <div className="flex flex-col gap-1.5 max-w-md">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">DEFAULT CITY / ZIP</label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                      <input
                        {...register("location")}
                        className="w-full h-12 pl-12 pr-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 bg-gray-50"
                      />
                    </div>
                    <p className="text-[11px] text-gray-400 font-medium px-1 mt-1">
                      This helps us show you instructors available for in-person sessions in your area.
                    </p>
                  </div>
                </section>

                {/* Bio */}
                <section>
                  <div className="flex items-center gap-2 mb-6">
                    <div className="w-1 h-6 bg-blue-600 rounded-full" />
                    <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">Bio</h3>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">
                      TELL TUTORS ABOUT YOUR GOALS
                    </label>
                    <textarea
                      {...register("bio")}
                      rows={5}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-800 bg-gray-50"
                    />
                  </div>
                </section>

                <div className="pt-8 flex justify-end">
                  <button type="button" className="text-red-500 font-bold text-sm hover:underline">
                    Deactivate Account
                  </button>
                </div>
              </form>
            </div>

            {/* My Lesson Requests — link to calendar page */}
            <Link
                ref={notifSectionRef as any}
                to="/lessons"
                className="mt-8 bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden flex items-center justify-between px-8 py-6 hover:border-blue-200 hover:shadow-md transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center shrink-0">
                    <Clock className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-black text-gray-900">My Lesson Requests</h2>
                      {sessionNotifCount > 0 && (
                        <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                          {sessionNotifCount} new
                        </span>
                      )}
                      {msgCount > 0 && (
                        <span className="px-2 py-0.5 bg-blue-600 text-white text-xs font-bold rounded-full">
                          {msgCount} message{msgCount !== 1 ? 's' : ''}
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

            {/* Saved Tutors */}
            {savedTutors.length > 0 && (
              <div className="mt-8 bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-8 py-5 border-b border-gray-100 flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-50 rounded-2xl flex items-center justify-center shrink-0">
                    <Heart className="w-5 h-5 text-red-500 fill-red-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-gray-900">Saved Instructors</h2>
                    <p className="text-sm text-gray-500 font-medium">{savedTutors.length} tutor{savedTutors.length !== 1 ? 's' : ''} saved</p>
                  </div>
                </div>
                <div className="divide-y divide-gray-100">
                  {savedTutors.map(t => (
                    <Link
                      key={t.tutor_id}
                      to={`/tutor/${t.tutor_id}`}
                      className="flex items-center gap-4 px-8 py-4 hover:bg-gray-50 transition-colors group"
                    >
                      {t.avatar_url ? (
                        <img
                          src={t.avatar_url}
                          alt={t.tutor_name}
                          className="w-12 h-12 rounded-xl object-cover shrink-0 bg-gray-100"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center shrink-0">
                          <span className="text-white font-black text-xl select-none">
                            {t.tutor_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-gray-900 truncate">{t.tutor_name}</p>
                        {t.subject && (
                          <p className="text-sm text-gray-500 font-medium truncate">{t.subject}</p>
                        )}
                        <div className="flex items-center gap-2 mt-0.5">
                          {t.rating !== null && (
                            <span className="flex items-center gap-0.5 text-xs font-bold text-blue-600">
                              <Star className="w-3 h-3 fill-blue-600" />{t.rating}
                              {t.review_count !== null && (
                                <span className="text-gray-400 font-medium ml-0.5">({t.review_count})</span>
                              )}
                            </span>
                          )}
                          {t.hourly_rate !== null && (
                            <span className="text-xs font-bold text-gray-700">${t.hourly_rate}/hr</span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors shrink-0" />
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {/* Family Access */}
            <div className="mt-8 bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-50 rounded-2xl flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-gray-900">Family Access</h2>
                    <p className="text-sm text-gray-500 font-medium">Let a parent or guardian view your lessons and notes.</p>
                  </div>
                </div>
                <button
                  onClick={generateInviteLink}
                  disabled={generatingInvite}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 transition-colors disabled:opacity-60"
                >
                  {generatingInvite ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />}
                  Generate Invite Link
                </button>
              </div>

              {pendingInviteLink && (
                <div className="px-8 py-4 bg-green-50 border-b border-green-100">
                  <p className="text-xs font-bold text-green-700 mb-2">Share this link with your parent or guardian — it works once:</p>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={pendingInviteLink}
                      className="flex-1 h-9 px-3 border border-green-200 rounded-lg text-xs font-mono text-gray-700 bg-white focus:outline-none"
                    />
                    <button
                      onClick={copyInviteLink}
                      className="flex items-center gap-1.5 px-3 h-9 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 transition-colors shrink-0"
                    >
                      {inviteCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {inviteCopied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
              )}

              {guardians.length === 0 ? (
                <div className="px-8 py-8 text-center">
                  <p className="text-gray-400 font-medium text-sm">No guardians linked yet.</p>
                  <p className="text-gray-400 text-xs mt-1">Generate an invite link and share it with a parent or guardian.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {guardians.map(g => (
                    <div key={g.id} className="flex items-center gap-4 px-8 py-4">
                      {g.parent_avatar ? (
                        <img src={g.parent_avatar} alt={g.parent_name} className="w-10 h-10 rounded-xl object-cover shrink-0 bg-gray-100" />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                          <span className="text-green-700 font-black text-sm">{g.parent_name.charAt(0).toUpperCase()}</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 truncate">{g.parent_name}</p>
                        <p className="text-xs text-gray-400 font-medium">
                          Connected {new Date(g.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                      <button
                        onClick={() => revokeGuardian(g.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs font-bold hover:bg-red-50 transition-colors"
                      >
                        <X className="w-3 h-3" /> Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Become a Tutor CTA */}
            <div className="mt-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-3xl p-8 text-white">
              <div className="flex items-center gap-3 mb-2">
                <GraduationCap className="w-7 h-7" />
                <h2 className="text-xl font-black">Become an Instructor</h2>
              </div>
              <p className="text-blue-100 font-medium mb-6 leading-relaxed">
                Share your knowledge, set your own schedule, and earn money teaching what you love.
              </p>
              <Link
                to="/become-a-tutor"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-blue-700 rounded-xl font-bold hover:bg-blue-50 transition-colors shadow-lg"
              >
                Get Started
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </main>

    </div>
  )
}
