// // src/app/pages/Login.tsx

import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation, useSearchParams, Link } from 'react-router'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import type { UserRole } from '../../lib/supabase'
import { toast } from 'sonner'
import { Mail, RefreshCw, KeyRound, UserPlus } from 'lucide-react'

import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle }
  from '../components/ui/card'

type Mode = 'signin' | 'signup' | 'verify' | 'forgot' | 'forgot_sent'

function ageFromDob(dob: string): number {
  const today = new Date()
  const birth = new Date(dob)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

// Latest date of birth allowed for a tutor (must be at least 16)
function maxTutorDob(): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 16)
  return d.toISOString().split('T')[0]
}

// Latest possible DOB (can't be born in the future)
const todayStr = new Date().toISOString().split('T')[0]

export default function Login() {
  const { signIn, signUp, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  const from = (location.state as any)?.from?.pathname ?? '/'

  const [mode, setMode]           = useState<Mode>('signin')
  const [email, setEmail]         = useState('')
  const [password, setPass]       = useState('')
  const [name, setName]           = useState('')
  const [dob, setDob]             = useState('')
  const [role, setRole]           = useState<UserRole>('student')
  const [error, setError]         = useState<string | null>(null)
  const [loading, setLoading]     = useState(false)
  const [resending, setResending] = useState(false)
  const [referrerName, setReferrerName] = useState<string | null>(null)
  const didRedirect   = useRef(false)
  const signupRoleRef = useRef<UserRole | null>(null)

  // Read referral param and fetch referrer's name
  useEffect(() => {
    const ref = searchParams.get('ref')
    if (!ref) return
    localStorage.setItem('referrer_id', ref)
    setMode('signup')
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', ref)
      .single()
      .then(({ data }) => { if (data?.full_name) setReferrerName(data.full_name) })
  }, [searchParams])

  // For signup: redirect once user session is confirmed, recording referral if present.
  useEffect(() => {
    if (user && signupRoleRef.current && !didRedirect.current) {
      // Record referral if the user signed up via an invite link
      const referrerId = localStorage.getItem('referrer_id')
      if (referrerId && referrerId !== user.id) {
        const createdAt = new Date((user as any).created_at ?? 0)
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)
        if (createdAt >= tenMinutesAgo) {
          supabase
            .from('referrals')
            .insert({ referrer_id: referrerId, referred_id: user.id, status: 'joined' })
            .then(() => localStorage.removeItem('referrer_id'))
        }
      }
      didRedirect.current = true
      const dest = signupRoleRef.current === 'tutor' ? '/my-profile' : signupRoleRef.current === 'parent' ? '/guardian-dashboard' : '/profile'
      navigate(dest, { replace: true })
      toast.success('Welcome! Please fill out your profile to get started.')
    }
  }, [user])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (mode === 'signin') {
      const { error } = await signIn(email, password)
      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }
      navigate(from, { replace: true })
      return
    } else {
      if (!name.trim()) {
        setError('Please enter your full name.')
        setLoading(false)
        return
      }
      if (!dob) {
        setError('Please enter your date of birth.')
        setLoading(false)
        return
      }
      if (role === 'tutor' && ageFromDob(dob) < 16) {
        setError('You must be at least 16 years old to register as an instructor.')
        setLoading(false)
        return
      }
      signupRoleRef.current = role
      const { error, needsEmailVerification } = await signUp(email, password, name, role, dob)
      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }
      if (needsEmailVerification) {
        setMode('verify')
        setLoading(false)
        return
      }
      // useEffect will redirect once user session is set (email confirmation disabled)
    }

    setLoading(false)
  }

  async function handleForgotPassword() {
    if (!email) { toast.error('Enter your email address first.'); return }
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (error) { toast.error(error.message); return }
    setMode('forgot_sent')
  }

  async function handleResend() {
    if (!email) return
    setResending(true)
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    setResending(false)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Verification email resent — check your inbox.')
    }
  }

  if (mode === 'forgot') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center mb-2">
              <KeyRound className="w-8 h-8 text-blue-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-center">Reset your password</CardTitle>
            <CardDescription className="text-center">
              Enter your email and we'll send you a reset link.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoFocus
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button className="w-full" onClick={handleForgotPassword} disabled={loading || !email}>
              {loading ? 'Sending…' : 'Send reset link'}
            </Button>
            <button
              type="button"
              className="text-sm text-muted-foreground underline hover:text-foreground"
              onClick={() => { setMode('signin'); setError(null) }}
            >
              Back to sign in
            </button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  if (mode === 'forgot_sent') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background px-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader className="space-y-4 pb-2">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center">
              <Mail className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl font-bold">Check your inbox</CardTitle>
            <CardDescription className="text-base">
              We sent a password reset link to{' '}
              <span className="font-semibold text-foreground">{email}</span>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">
              Didn't receive it? Check your spam folder, or try again.
            </p>
            <Button variant="outline" className="w-full" onClick={handleForgotPassword} disabled={loading}>
              {loading
                ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Sending…</>
                : <><RefreshCw className="w-4 h-4 mr-2" />Resend reset email</>}
            </Button>
          </CardContent>
          <CardFooter className="justify-center">
            <button
              type="button"
              className="text-sm text-muted-foreground underline hover:text-foreground"
              onClick={() => { setMode('signin'); setError(null) }}
            >
              Back to sign in
            </button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  if (mode === 'verify') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background px-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader className="space-y-4 pb-2">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center">
              <Mail className="w-8 h-8 text-blue-600" />
            </div>
            <CardTitle className="text-2xl font-bold">Check your inbox</CardTitle>
            <CardDescription className="text-base">
              We sent a verification link to <span className="font-semibold text-foreground">{email}</span>.
              Click the link in that email to activate your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">
              Didn't receive it? Check your spam folder, or resend below.
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={handleResend}
              disabled={resending}
            >
              {resending
                ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Sending…</>
                : <><RefreshCw className="w-4 h-4 mr-2" />Resend verification email</>
              }
            </Button>
          </CardContent>
          <CardFooter className="justify-center">
            <button
              type="button"
              className="text-sm text-muted-foreground underline hover:text-foreground"
              onClick={() => { setMode('signin'); setError(null) }}
            >
              Back to sign in
            </button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-block">
            ← Back to Home
          </Link>
          <CardTitle className="text-2xl font-bold">
            {mode === 'signin' ? 'Welcome back' : 'Create an account'}
          </CardTitle>
          <CardDescription>
            {mode === 'signin'
              ? 'Sign in to your instructor account'
              : 'Join as a student or instructor'}
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">

            {mode === 'signup' && (
              <div className="space-y-1">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  placeholder="Jane Smith"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </div>
            )}

            {mode === 'signup' && (
              <div className="space-y-1">
                <Label htmlFor="dob">Date of birth</Label>
                <Input
                  id="dob"
                  type="date"
                  value={dob}
                  max={role === 'tutor' ? maxTutorDob() : todayStr}
                  onChange={e => { setDob(e.target.value); setError(null) }}
                  required
                />
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                    onClick={() => { setMode('forgot'); setError(null) }}
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPass(e.target.value)}
                required
                minLength={8}
              />
            </div>

            {mode === 'signup' && referrerName && (
              <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                <UserPlus className="w-5 h-5 text-blue-600 shrink-0" />
                <p className="text-sm font-semibold text-blue-800">
                  <span className="font-black">{referrerName}</span> invited you to join InstructorFinder!
                </p>
              </div>
            )}

            {mode === 'signup' && (
              <div className="space-y-1">
                <Label>I am a…</Label>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {(['student', 'tutor', 'parent'] as UserRole[]).map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => { setRole(r); setError(null) }}
                      className={`flex-1 py-2 rounded-md border text-sm font-medium transition-colors
                        ${role === r
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-input bg-background hover:bg-accent'
                        }`}
                    >
                      {r === 'tutor' ? 'Instructor' : r === 'parent' ? 'Parent/Guardian' : 'Student'}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground pt-1">
                  Instructors must be at least 16. Parents can monitor their child's lessons.
                </p>
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </CardContent>

          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? 'Please wait…'
                : mode === 'signin' ? 'Sign in' : 'Create account'}
            </Button>

            <p className="text-sm text-muted-foreground text-center">
              {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
              <button
                type="button"
                className="underline text-foreground"
                onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null) }}
              >
                {mode === 'signin' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
