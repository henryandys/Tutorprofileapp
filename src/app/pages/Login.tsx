// // src/app/pages/Login.tsx

import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router'
import { useAuth } from '../../context/AuthContext'
import type { UserRole } from '../../lib/supabase'

import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle }
  from '../components/ui/card'

type Mode = 'signin' | 'signup'

export default function Login() {
  const { signIn, signUp, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const from = (location.state as any)?.from?.pathname ?? '/'

  const [mode, setMode]       = useState<Mode>('signin')
  const [email, setEmail]     = useState('')
  const [password, setPass]   = useState('')
  const [name, setName]       = useState('')
  const [role, setRole]       = useState<UserRole>('student')
  const [error, setError]     = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // For signup: redirect once user session is confirmed
  useEffect(() => {
    if (user && mode === 'signup') {
      navigate(from, { replace: true })
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
      // Navigate immediately after successful sign in
      navigate(from, { replace: true })
      return
    } else {
      if (!name.trim()) {
        setError('Please enter your full name.')
        setLoading(false)
        return
      }
      const { error } = await signUp(email, password, name, role)
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
              ? 'Sign in to your tutor account'
              : 'Join as a student or tutor'}
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
                      onClick={() => setRole(r)}
                      className={`flex-1 py-2 rounded-md border text-sm font-medium transition-colors
                        ${role === r
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-input bg-background hover:bg-accent'
                        }`}
                    >
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </button>
                  ))}
                </div>
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
