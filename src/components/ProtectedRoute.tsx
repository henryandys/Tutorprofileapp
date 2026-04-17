// src/components/ProtectedRoute.tsx
// ─────────────────────────────────────────────────────────────
// Wrap any route that requires login (or a specific role).
//
// Usage in your router:
//   <ProtectedRoute>
//     <TutorMyProfile />
//   </ProtectedRoute>
//
//   <ProtectedRoute requiredRole="tutor">
//     <CreateProfile />
//   </ProtectedRoute>
// ─────────────────────────────────────────────────────────────

import { Navigate } from 'react-router'
import { useAuth } from '../context/AuthContext'
import type { UserRole } from '../lib/supabase'

interface Props {
  children: React.ReactNode
  requiredRole?: UserRole
}

export function ProtectedRoute({ children, requiredRole }: Props) {
  const { user, role, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (requiredRole && role !== requiredRole) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
