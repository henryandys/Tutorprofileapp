import { Navbar } from "../components/Navbar";
import { useNavigate } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { toast } from "sonner";
import {
  GraduationCap, BookOpen, DollarSign, Calendar, Star,
  ArrowRight, CheckCircle, Upload, Users, FileText, Shield
} from "lucide-react";

const STEPS = [
  {
    number: "01",
    icon: GraduationCap,
    title: "Create your instructor profile",
    body: "Sign up and fill in your subjects, education, experience, hourly rate, and preferred teaching location. Your profile becomes your public listing that students browse.",
    color: "blue",
  },
  {
    number: "02",
    icon: Calendar,
    title: "Set your availability",
    body: "Choose which days of the week you're available and your hours. Students see your weekly schedule directly on your profile so they know when to reach out.",
    color: "purple",
  },
  {
    number: "03",
    icon: Users,
    title: "Accept lesson requests",
    body: "Students send you a lesson request with their subject and a message. You review it and accept or decline. Once accepted, you can message the student directly.",
    color: "green",
  },
]

const REPO_FEATURES = [
  { icon: Upload,   text: "Upload PDFs, Word docs, PowerPoints, and spreadsheets" },
  { icon: BookOpen, text: "Tag resources by subject and grade level" },
  { icon: FileText, text: "Link resources to a specific school or district" },
  { icon: Users,    text: "Students and instructors can download and use your materials" },
]

const PERKS = [
  "Set your own hourly rate",
  "Choose your own schedule",
  "Message students directly",
  "Showcase your education & credentials",
  "Share teaching materials in the repository",
  "Build reviews and a public rating",
]

export function ForTutors() {
  const { role, user } = useAuth()
  const navigate = useNavigate()

  function handleGetStarted() {
    if (role === 'tutor') {
      toast.info("You're already an instructor! Redirecting to your profile.")
      navigate('/my-profile')
    } else {
      navigate('/become-a-tutor')
    }
  }

  return (
    <div className="min-h-screen bg-white font-sans">
      <Navbar />

      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-600 to-purple-700 text-white py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 rounded-full text-sm font-bold mb-8">
            <GraduationCap className="w-4 h-4" />
            Teach on your terms
          </div>
          <h1 className="text-5xl md:text-6xl font-black tracking-tight mb-6 leading-none">
            Share your knowledge.<br />
            <span className="text-blue-200">Build your business.</span>
          </h1>
          <p className="text-xl text-blue-100 font-medium max-w-2xl mx-auto mb-10">
            Join InstructorFind to connect with local students, set your own rates, manage your schedule, and share teaching materials with the community.
          </p>
          <button
            onClick={handleGetStarted}
            className="inline-flex items-center gap-3 px-10 py-4 bg-white text-blue-700 rounded-2xl font-black text-lg hover:shadow-xl transition-all"
          >
            {role === 'tutor' ? 'Go to My Profile' : 'Get Started — It\'s Free'}
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* Perks strip */}
      <section className="bg-gray-50 border-y border-gray-100 py-10 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-3 gap-4">
          {PERKS.map(perk => (
            <div key={perk} className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
              <span className="font-bold text-gray-700 text-sm">{perk}</span>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-gray-900 mb-3">How it works</h2>
            <p className="text-gray-500 font-medium text-lg">From sign-up to your first session in minutes.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {STEPS.map(step => {
              const Icon = step.icon
              const colors: Record<string, string> = {
                blue:   "bg-blue-100 text-blue-600",
                purple: "bg-purple-100 text-purple-600",
                green:  "bg-green-100 text-green-600",
              }
              return (
                <div key={step.number} className="flex flex-col gap-5">
                  <div className="flex items-center gap-4">
                    <span className="text-5xl font-black text-gray-100">{step.number}</span>
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${colors[step.color]}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                  </div>
                  <h3 className="text-xl font-black text-gray-900">{step.title}</h3>
                  <p className="text-gray-500 font-medium leading-relaxed">{step.body}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Repository section */}
      <section className="py-24 px-6 bg-gray-50 border-y border-gray-100">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-xs font-bold uppercase tracking-widest mb-6">
              <FileText className="w-3.5 h-3.5" />
              Resource Repository
            </div>
            <h2 className="text-4xl font-black text-gray-900 mb-5 leading-tight">
              Share your best teaching materials
            </h2>
            <p className="text-gray-500 font-medium text-lg leading-relaxed mb-8">
              The Resource Repository is a shared library where instructors upload worksheets, cheat sheets, practice exams, and slide decks. Students and other instructors can browse and download your materials — growing your reputation in the community.
            </p>
            <div className="flex flex-col gap-3">
              {REPO_FEATURES.map(f => {
                const Icon = f.icon
                return (
                  <div key={f.text} className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white rounded-lg border border-gray-200 flex items-center justify-center shrink-0 shadow-sm">
                      <Icon className="w-4 h-4 text-blue-600" />
                    </div>
                    <span className="text-gray-700 font-bold text-sm">{f.text}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Mock resource card */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-xl p-8 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div className="px-3 py-1 bg-red-50 text-red-600 rounded-lg text-xs font-bold">PDF</div>
              <div className="flex items-center gap-1 text-xs font-bold text-amber-500 bg-amber-50 px-2 py-1 rounded-full">
                <Star className="w-3 h-3 fill-amber-500" />
                4.9
              </div>
            </div>
            <div>
              <h4 className="font-black text-gray-900 text-lg leading-tight mb-1">
                AP Calculus BC — Integration Techniques Cheat Sheet
              </h4>
              <p className="text-sm text-gray-500 font-medium">A two-page reference for all major integration methods covered in the AP exam.</p>
            </div>
            <div className="flex flex-col gap-2 text-xs font-bold text-gray-500">
              <span className="flex items-center gap-2"><BookOpen className="w-3.5 h-3.5" /> Mathematics</span>
              <span className="flex items-center gap-2"><GraduationCap className="w-3.5 h-3.5" /> 9–12</span>
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-gray-100 text-[11px] text-gray-400 font-bold uppercase tracking-widest">
              <span>By Dr. Sarah Mitchell</span>
              <span>124 downloads</span>
            </div>
          </div>
        </div>
      </section>

      {/* Earnings section */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="flex flex-col gap-4 p-8 bg-blue-50 rounded-3xl border border-blue-100">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-black text-gray-900">You set the rate</h3>
            <p className="text-gray-600 font-medium">Set any hourly rate you want. There are no hidden fees — the rate you list is what students see.</p>
          </div>
          <div className="flex flex-col gap-4 p-8 bg-purple-50 rounded-3xl border border-purple-100">
            <div className="w-12 h-12 bg-purple-600 rounded-2xl flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-black text-gray-900">Your policies, your rules</h3>
            <p className="text-gray-600 font-medium">Set your own cancellation and payment policies directly on your profile so students know what to expect upfront.</p>
          </div>
          <div className="flex flex-col gap-4 p-8 bg-green-50 rounded-3xl border border-green-100">
            <div className="w-12 h-12 bg-green-600 rounded-2xl flex items-center justify-center">
              <Star className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-black text-gray-900">Build your reputation</h3>
            <p className="text-gray-600 font-medium">Students leave star ratings and written reviews after sessions. A strong profile attracts more bookings over time.</p>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-24 px-6 bg-gradient-to-br from-gray-900 to-gray-800 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-4xl font-black mb-4">Ready to start instructing?</h2>
          <p className="text-gray-400 font-medium text-lg mb-10">
            Create your free profile in a few minutes and start receiving lesson requests.
          </p>
          <button
            onClick={handleGetStarted}
            className="inline-flex items-center gap-3 px-10 py-4 bg-blue-600 text-white rounded-2xl font-black text-lg hover:bg-blue-700 transition-all shadow-xl shadow-blue-900/30"
          >
            {role === 'tutor' ? 'Go to My Profile' : 'Create Your Instructor Profile'}
            <ArrowRight className="w-5 h-5" />
          </button>
          {!user && (
            <p className="mt-4 text-gray-500 text-sm font-medium">
              Already have an account?{' '}
              <a href="/login" className="text-blue-400 font-bold hover:underline">Sign in</a>
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
