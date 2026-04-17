// src/context/AuthContext.tsx
// ─────────────────────────────────────────────────────────────
// Provides the current Supabase session + profile to any
// component in the tree via useAuth().
//
// Wrap your app with <AuthProvider> in main.tsx or App.tsx.
// ─────────────────────────────────────────────────────────────

import React, { createContext, useContext, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile, UserRole } from '../lib/supabase'

// ── Context shape ─────────────────────────────────────────────

interface AuthContextValue {
  session:     Session | null
  user:        User    | null
  profile:     Profile | null
  role:        UserRole | null
  loading:     boolean
  signUp:      (email: string, password: string, name: string, role: UserRole) => Promise<{ error: Error | null }>
  signIn:      (email: string, password: string) => Promise<{ error: Error | null }>
  signOut:     () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

// ── Provider ──────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession]   = useState<Session | null>(null)
  const [profile, setProfile]   = useState<Profile | null>(null)
  const [loading, setLoading]   = useState(true)

  // Fetch the profile row for the given user id
  async function fetchProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Error fetching profile:', error.message)
      return null
    }
    return data as Profile
  }

  // Called by consuming components (e.g. after profile edit)
  async function refreshProfile() {
    if (!session?.user) return
    const p = await fetchProfile(session.user.id)
    setProfile(p)
  }

  // Bootstrap: get existing session on mount, then subscribe to changes
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
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  // ── Auth actions ────────────────────────────────────────────

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
        // These become new.raw_user_meta_data in the trigger
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
    await supabase.auth.signOut()
    setProfile(null)
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

// ── Hook ──────────────────────────────────────────────────────

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}