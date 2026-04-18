import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Navbar } from "../components/Navbar";
import { User, Mail, Phone, MapPin, Camera, Save, Bell, Shield, CreditCard, GraduationCap, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";

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
  const [saving, setSaving] = useState(false)

  const isTutor = role === 'tutor'

  // Split full_name into first/last for the form
  const nameParts = (profile?.full_name ?? '').split(' ')
  const firstName = nameParts[0] ?? ''
  const lastName  = nameParts.slice(1).join(' ')

  const { register, handleSubmit, reset, formState: { errors } } = useForm<UserProfileForm>({
    defaultValues: {
      firstName: '',
      lastName:  '',
      email:     '',
      phone:     '',
      location:  '',
      bio:       '',
    }
  })

  // Populate form once profile loads
  useEffect(() => {
    if (profile && user) {
      const parts = (profile.full_name ?? '').split(' ')
      reset({
        firstName: parts[0] ?? '',
        lastName:  parts.slice(1).join(' '),
        email:     user.email ?? '',
        phone:     '',   // not in schema yet — extend if needed
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 md:px-8 py-10">

        {/* Tutor banner */}
        {isTutor && (
          <div className="mb-6 bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl p-6 shadow-lg">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                  <GraduationCap className="w-8 h-8 text-white" />
                </div>
                <div className="text-white">
                  <h3 className="text-xl font-black mb-1">Tutor Profile</h3>
                  <p className="text-blue-100 text-sm font-medium">
                    Manage your teaching profile, specialties, and availability
                  </p>
                </div>
              </div>
              <Link
                to="/my-profile"
                className="flex items-center gap-2 px-6 py-3 bg-white text-blue-600 rounded-xl font-bold hover:shadow-xl transition-all"
              >
                Go to Tutor Profile
                <ChevronRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-8">

          {/* Sidebar */}
          <aside className="w-full lg:w-64 shrink-0">
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="p-6 border-b border-gray-100 flex flex-col items-center text-center">
                <div className="relative mb-4 group cursor-pointer">
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
                  <div className="absolute bottom-0 right-0 bg-blue-600 p-2 rounded-full border-2 border-white text-white">
                    <Camera className="w-3 h-3" />
                  </div>
                </div>
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
                <button className="w-full flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-xl font-bold text-sm transition-colors">
                  <Bell className="w-4 h-4" />
                  Notifications
                </button>
                <button className="w-full flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-xl font-bold text-sm transition-colors">
                  <Shield className="w-4 h-4" />
                  Privacy & Security
                </button>
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
                    <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">
                      {isTutor ? 'Tutor Bio' : 'Student Bio'}
                    </h3>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">
                      {isTutor ? 'DESCRIBE YOUR TEACHING STYLE' : 'TELL TUTORS ABOUT YOUR GOALS'}
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
          </div>
        </div>
      </main>
    </div>
  )
}