// // src/app/pages/Login.tsx

import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation, Link } from 'react-router'
import { useAuth } from '../../context/AuthContext'
import type { UserRole } from '../../lib/supabase'
import { toast } from 'sonner'

import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle }
  from '../components/ui/card'

type Mode = 'signin' | 'signup'

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

  const from = (location.state as any)?.from?.pathname ?? '/'

  const [mode, setMode]       = useState<Mode>('signin')
  const [email, setEmail]     = useState('')
  const [password, setPass]   = useState('')
  const [name, setName]       = useState('')
  const [dob, setDob]         = useState('')
  const [role, setRole]       = useState<UserRole>('student')
  const [error, setError]     = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const didRedirect   = useRef(false)
  const signupRoleRef = useRef<UserRole | null>(null)

  // For signup: redirect once user session is confirmed.
  useEffect(() => {
    if (user && signupRoleRef.current && !didRedirect.current) {
      didRedirect.current = true
      const dest = signupRoleRef.current === 'tutor' ? '/my-profile' : '/profile'
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
      const { error } = await signUp(email, password, name, role, dob)
      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }
      // useEffect will redirect once user session is set
    }

    setLoading(false)
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
              <Label htmlFor="password">Password</Label>
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

            {mode === 'signup' && (
              <div className="space-y-1">
                <Label>I am a…</Label>
                <div className="flex gap-3 mt-1">
                  {(['student', 'tutor'] as UserRole[]).map(r => (
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
                      {r === 'tutor' ? 'Instructor' : 'Student'}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground pt-1">
                  You must be at least 16 years old to create an instructor account.
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
