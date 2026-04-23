import { useState, useEffect, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { Navbar } from "../components/Navbar";
import { User, Mail, Phone, MapPin, Camera, Save, Bell, Shield, CreditCard, ChevronRight, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";

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

interface UserProfileForm {
  firstName: string;
  lastName:  string;
  email:     string;
  phone:     string;
  location:  string;
  bio:       string;
}

export function UserProfile() {
  const { user, profile, role, refreshProfile } = useAuth()
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
    if (role === 'tutor') navigate('/my-profile')
  }, [role, navigate])

  const [bookings, setBookings]               = useState<StudentBooking[]>([])
  const [msgCount, setMsgCount]               = useState(0)
  const [sessionNotifCount, setSessionNotifCount] = useState(0)
  const notifSectionRef = useRef<HTMLDivElement>(null)

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

  function handleNotifClick() {
    if (!user) return
    localStorage.setItem(`notifLastCheck_${user.id}`, new Date().toISOString())
    setMsgCount(0)
    setSessionNotifCount(0)
    // Mark booking IDs as seen, then scroll to section
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
        phone:     '',
        location:  profile.location ?? '',
        bio:       profile.bio ?? '',
      })
    }
  }, [profile, user])

  const onSubmit = async (data: UserProfileForm) => {
    if (!user) return
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name:  `${data.firstName} ${data.lastName}`.trim(),
        location:   data.location,
        bio:        data.bio,
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

  const totalNotifCount = msgCount + sessionNotifCount

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
                      This helps us show you tutors available for in-person sessions in your area.
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
          </div>
        </div>
      </main>

    </div>
  )
}
