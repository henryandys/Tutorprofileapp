// src/app/pages/CreateProfile.tsx

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Navbar } from "../components/Navbar";
import { Camera, MapPin, DollarSign, BookOpen, GraduationCap, Briefcase, ChevronRight, CheckCircle2, Info, Loader2 } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";

interface ProfileForm {
  name:       string;
  subject:    string;
  hourlyRate: number;
  location:   string;
  education:  string;
  experience: string;
  bio:        string;
}

export function CreateProfile() {
  const navigate = useNavigate()
  const { user, role, refreshProfile } = useAuth()
  const [step, setSaving] = useState(1)
  const [saving, setIsSaving] = useState(false)

  // Already a tutor — send them straight to their profile
  useEffect(() => {
    if (role === 'tutor') navigate('/my-profile', { replace: true })
  }, [role, navigate])

  const { register, handleSubmit, formState: { errors } } = useForm<ProfileForm>()

  const nextStep = () => setSaving(s => Math.min(s + 1, 3))
  const prevStep = () => setSaving(s => Math.max(s - 1, 1))

  const onSubmit = async (data: ProfileForm) => {
    if (!user) {
      toast.error('You must be logged in to create a profile.')
      return
    }

    setIsSaving(true)

    try {
      // Parse experience years from the string (e.g. "10+ years" → 10)
      const expMatch = data.experience.match(/\d+/)
      const experienceYrs = expMatch ? parseInt(expMatch[0]) : 0

      // 1. Update the base profile (name, location, bio) and promote to tutor
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name:  data.name,
          location:   data.location,
          bio:        data.bio,
          role:       'tutor',
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (profileError) throw profileError

      // 2. Upsert tutor_profiles row (insert or update if exists)
      const { error: tutorError } = await supabase
        .from('tutor_profiles')
        .upsert({
          id:             user.id,
          subjects:       data.subject.split('&').map(s => s.trim()).filter(Boolean),
          hourly_rate:    Number(data.hourlyRate),
          experience_yrs: experienceYrs,
          education:      data.education,
          is_available:   true,
        }, { onConflict: 'id' })

      if (tutorError) throw tutorError

      // 3. Refresh the auth context so navbar/profile update
      await refreshProfile()

      toast.success('Profile created! Welcome to TutorFind.')
      setTimeout(() => navigate('/my-profile'), 1500)

    } catch (err: any) {
      console.error('CreateProfile error:', err)
      toast.error('Something went wrong: ' + (err.message ?? 'Unknown error'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-12">
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">

          {/* Progress Bar */}
          <div className="flex h-2 bg-gray-100">
            <div
              className="bg-blue-600 transition-all duration-500 ease-in-out"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>

          <div className="p-8 md:p-12">
            <header className="mb-10">
              <h1 className="text-3xl font-black text-gray-900 tracking-tight mb-2">
                {step === 1 && "Basic Information"}
                {step === 2 && "Experience & Education"}
                {step === 3 && "Profile Preview & Bio"}
              </h1>
              <p className="text-gray-500 font-medium">
                Step {step} of 3 — Tell us about yourself to start getting students.
              </p>
            </header>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">

              {/* ── Step 1: Basic Info ── */}
              {step === 1 && (
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row gap-8 items-center mb-8">
                    <div className="relative group">
                      <div className="w-32 h-32 bg-gray-100 rounded-full flex items-center justify-center border-2 border-dashed border-gray-300 group-hover:border-blue-500 transition-colors">
                        <Camera className="w-8 h-8 text-gray-400 group-hover:text-blue-500" />
                      </div>
                      <button type="button" className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full shadow-lg">
                        <Camera className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900 mb-1">Profile Photo</h3>
                      <p className="text-sm text-gray-500">
                        Upload a professional, friendly photo. Tutors with photos get 10x more bookings.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">FULL NAME</label>
                      <input
                        {...register("name", { required: "Name is required" })}
                        placeholder="e.g. Dr. Sarah Mitchell"
                        className="w-full h-12 px-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 bg-gray-50"
                      />
                      {errors.name && <span className="text-xs text-red-500 font-bold">{errors.name.message}</span>}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">PRIMARY SUBJECT</label>
                      <div className="relative">
                        <BookOpen className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                        <input
                          {...register("subject", { required: "Subject is required" })}
                          placeholder="e.g. Calculus & Physics"
                          className="w-full h-12 pl-12 pr-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 bg-gray-50"
                        />
                      </div>
                      {errors.subject && <span className="text-xs text-red-500 font-bold">{errors.subject.message}</span>}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">HOURLY RATE ($)</label>
                      <div className="relative">
                        <DollarSign className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                        <input
                          type="number"
                          {...register("hourlyRate", { required: "Rate is required", min: 1 })}
                          placeholder="65"
                          className="w-full h-12 pl-12 pr-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 bg-gray-50"
                        />
                      </div>
                      {errors.hourlyRate && <span className="text-xs text-red-500 font-bold">{errors.hourlyRate.message}</span>}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">LOCATION</label>
                      <div className="relative">
                        <MapPin className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                        <input
                          {...register("location", { required: "Location is required" })}
                          placeholder="e.g. Seattle, WA"
                          className="w-full h-12 pl-12 pr-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 bg-gray-50"
                        />
                      </div>
                      {errors.location && <span className="text-xs text-red-500 font-bold">{errors.location.message}</span>}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Step 2: Experience & Education ── */}
              {step === 2 && (
                <div className="space-y-6">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">EDUCATION</label>
                    <div className="relative">
                      <GraduationCap className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                      <input
                        {...register("education", { required: "Education is required" })}
                        placeholder="e.g. Ph.D. in Physics, MIT"
                        className="w-full h-12 pl-12 pr-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 bg-gray-50"
                      />
                    </div>
                    {errors.education && <span className="text-xs text-red-500 font-bold">{errors.education.message}</span>}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">YEARS OF EXPERIENCE</label>
                    <div className="relative">
                      <Briefcase className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                      <input
                        {...register("experience", { required: "Experience is required" })}
                        placeholder="e.g. 10 years university teaching"
                        className="w-full h-12 pl-12 pr-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 bg-gray-50"
                      />
                    </div>
                    {errors.experience && <span className="text-xs text-red-500 font-bold">{errors.experience.message}</span>}
                  </div>

                  <div className="bg-blue-50 p-6 rounded-2xl flex gap-4 border border-blue-100">
                    <Info className="w-6 h-6 text-blue-600 shrink-0" />
                    <div className="space-y-1">
                      <h4 className="font-bold text-blue-900">Why this matters</h4>
                      <p className="text-sm text-blue-700 leading-relaxed">
                        Students look for credentials and proven experience. Being specific about your degrees and past teaching roles helps build trust quickly.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Step 3: Bio ── */}
              {step === 3 && (
                <div className="space-y-6">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">ABOUT YOU (BIO)</label>
                    <textarea
                      {...register("bio", { required: "Bio is required", minLength: { value: 50, message: "Bio must be at least 50 characters" } })}
                      rows={6}
                      placeholder="Share your teaching philosophy, what you specialize in, and how you help students succeed..."
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-800 bg-gray-50"
                    />
                    {errors.bio && <span className="text-xs text-red-500 font-bold">{errors.bio.message}</span>}
                    <div className="flex justify-between px-1">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">MINIMUM 50 CHARACTERS</span>
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider italic">TELL YOUR STORY</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      </div>
                      <p className="text-sm font-bold text-gray-700">Display my profile on the map</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      </div>
                      <p className="text-sm font-bold text-gray-700">Notify me about new students in my area</p>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Navigation buttons ── */}
              <div className="flex items-center justify-between pt-8 border-t border-gray-100 mt-12">
                <button
                  type="button"
                  onClick={prevStep}
                  disabled={step === 1}
                  className={`px-8 py-3 rounded-xl font-bold transition-all ${
                    step === 1 ? "text-gray-300 pointer-events-none" : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  Back
                </button>

                {step < 3 ? (
                  <button
                    type="button"
                    onClick={nextStep}
                    className="flex items-center gap-2 px-10 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                  >
                    Continue
                    <ChevronRight className="w-5 h-5" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 px-12 py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 disabled:opacity-60"
                  >
                    {saving && <Loader2 className="w-5 h-5 animate-spin" />}
                    {saving ? 'Saving…' : 'Complete Profile'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        <p className="text-center text-sm text-gray-400 font-medium mt-8">
          By continuing, you agree to our <a href="#" className="underline">Tutor Guidelines</a> and <a href="#" className="underline">Privacy Policy</a>.
        </p>
      </main>
    </div>
  )
}
