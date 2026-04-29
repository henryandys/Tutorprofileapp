// src/context/AuthContext.tsx

import React, { createContext, useContext, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile, UserRole } from '../lib/supabase'

interface AuthContextValue {
  session:        Session | null
  user:           User    | null
  profile:        Profile | null
  role:           UserRole | null
  loading:        boolean
  signUp:         (email: string, password: string, name: string, role: UserRole) => Promise<{ error: Error | null }>
  signIn:         (email: string, password: string) => Promise<{ error: Error | null }>
  signOut:        () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  async function fetchProfile(userId: string): Promise<Profile | null> {
    const timeout = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), 5000)
    )

    const query = supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
      .then(({ data, error }) => {
        if (error) return null
        return data as Profile
      })

    return Promise.race([query, timeout])
  }

  async function refreshProfile() {
    if (!session?.user) return
    const p = await fetchProfile(session.user.id)
    setProfile(p)
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        const p = await fetchProfile(session.user.id)
        setProfile(p)
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session)
        if (session?.user) {
          const p = await fetchProfile(session.user.id)
          setProfile(p)
        } else {
          setProfile(null)
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function signUp(
    email: string,
    password: string,
    name: string,
    role: UserRole
  ): Promise<{ error: Error | null }> {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name, role },
      },
    })
    return { error: error as Error | null }
  }

  async function signIn(
    email: string,
    password: string
  ): Promise<{ error: Error | null }> {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error as Error | null }
  }

  async function signOut() {
    try {
      await supabase.auth.signOut()
    } catch {
      // signOut lock errors are safe to ignore
    } finally {
      setProfile(null)
      setSession(null)
    }
  }

  const value: AuthContextValue = {
    session,
    user:    session?.user ?? null,
    profile,
    role:    profile?.role ?? null,
    loading,
    signUp,
    signIn,
    signOut,
    refreshProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
