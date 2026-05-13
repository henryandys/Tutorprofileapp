import { useState, useEffect } from "react"
import { useParams, Link, useNavigate } from "react-router"
import { Navbar } from "../components/Navbar"
import { useAuth } from "../../context/AuthContext"
import { supabase } from "../../lib/supabase"
import { Shield, CheckCircle, AlertCircle, Loader2, Users } from "lucide-react"
import { toast } from "sonner"

export function JoinFamily() {
  const { token } = useParams<{ token: string }>()
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  const [accepting,   setAccepting]   = useState(false)
  const [accepted,    setAccepted]    = useState(false)
  const [errorMsg,    setErrorMsg]    = useState<string | null>(null)
  const [studentName, setStudentName] = useState<string | null>(null)

  // Preview: look up the student name from the token (without auth)
  useEffect(() => {
    if (!token) return
    supabase
      .from('parent_links')
      .select('student_id, profiles:student_id(full_name)')
      .eq('invite_token', token)
      .eq('status', 'pending')
      .maybeSingle()
      .then(({ data }) => {
        if (data) setStudentName((data.profiles as any)?.full_name ?? null)
      })
  }, [token])

  async function handleAccept() {
    if (!user || !token) return
    setAccepting(true)
    setErrorMsg(null)
    const { data, error } = await supabase.rpc('accept_parent_invite', { p_token: token })
    if (error || (data as any)?.error) {
      setErrorMsg((data as any)?.error ?? error?.message ?? 'Something went wrong.')
      setAccepting(false)
      return
    }
    setAccepted(true)
    toast.success('You now have guardian access!')
    setTimeout(() => navigate('/guardian-dashboard'), 1500)
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-lg mx-auto px-4 py-16">
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">

          {/* Header */}
          <div className="bg-gradient-to-br from-green-500 to-teal-600 px-8 py-10 text-center text-white">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-black mb-1">Guardian Invite</h1>
            {studentName ? (
              <p className="text-green-100 font-medium">
                <span className="font-bold text-white">{studentName}</span> has invited you to follow their lessons and progress.
              </p>
            ) : (
              <p className="text-green-100 font-medium">You've been invited to follow a student's lessons and progress.</p>
            )}
          </div>

          <div className="px-8 py-8">
            {accepted ? (
              <div className="text-center space-y-3">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
                <p className="text-lg font-black text-gray-900">Guardian access granted!</p>
                <p className="text-sm text-gray-500 font-medium">Redirecting to your Guardian Dashboard…</p>
              </div>
            ) : errorMsg ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 bg-red-50 rounded-xl border border-red-100">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm font-bold text-red-700">{errorMsg}</p>
                </div>
                <p className="text-sm text-gray-500 text-center font-medium">
                  Ask the student to generate a new invite link from their profile.
                </p>
              </div>
            ) : !user ? (
              <div className="space-y-6 text-center">
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <p className="text-sm font-bold text-blue-800">You need to be signed in to accept this invite.</p>
                </div>
                <div className="flex flex-col gap-3">
                  <Link
                    to="/login"
                    state={{ next: `/join-family/${token}` }}
                    className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors text-center"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/login?mode=signup"
                    state={{ next: `/join-family/${token}` }}
                    className="w-full py-3 border border-gray-200 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-50 transition-colors text-center"
                  >
                    Create a Parent/Guardian Account
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-start gap-3 p-4 bg-green-50 rounded-xl border border-green-100">
                  <Users className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-green-800">As a guardian you'll be able to:</p>
                    <ul className="mt-2 space-y-1 text-sm text-green-700 font-medium">
                      <li>· View upcoming and past lessons</li>
                      <li>· Read session notes from instructors</li>
                      <li>· See which tutors your child is working with</li>
                    </ul>
                  </div>
                </div>
                <button
                  onClick={handleAccept}
                  disabled={accepting}
                  className="w-full py-3.5 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {accepting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                  {accepting ? 'Accepting…' : 'Accept Guardian Access'}
                </button>
                <p className="text-xs text-gray-400 text-center font-medium">
                  You can be removed at any time by the student.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
