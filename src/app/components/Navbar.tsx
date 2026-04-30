// src/app/components/Navbar.tsx

import { useState, useRef, useEffect } from "react";
import { Search, Menu, User, LogOut, BookOpen, GraduationCap, Lightbulb, X } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { NotificationsPanel } from "./NotificationsPanel";

export function Navbar() {
  const { user, profile, role, signOut } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const handleLogout = async () => {
    setMenuOpen(false)
    await signOut()
    navigate('/')
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  return (
    <nav className="h-16 border-b border-gray-200 bg-white sticky top-0 z-50 px-4 md:px-8 flex items-center justify-between">

      {/* Left: Logo + Nav links */}
      <div className="flex items-center gap-8">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold text-xl">
            T
          </div>
          <span className="text-xl font-bold tracking-tight text-blue-900 hidden sm:block">
            InstructorFind
          </span>
        </Link>
        <div className="hidden lg:flex items-center gap-6">
          <Link to="/search" className="text-sm font-semibold text-gray-600 hover:text-blue-600">Find Instructors</Link>
          <Link to="/for-tutors" className="text-sm font-semibold text-gray-600 hover:text-blue-600">For Instructors</Link>
          <Link to="/needed-courses" className="text-sm font-semibold text-gray-600 hover:text-amber-600">Requested Courses</Link>
        </div>
      </div>

      {/* Center: Search bar */}
      <div className="flex-1 max-w-md mx-8 hidden md:block">
        <form className="relative" onSubmit={(e) => { e.preventDefault(); const q = (e.currentTarget.querySelector('input') as HTMLInputElement)?.value ?? ''; navigate(q ? `/search?q=${encodeURIComponent(q)}` : '/search'); }}>
          <input
            type="text"
            placeholder="Search by subject, city, or zip code"
            className="w-full h-10 pl-4 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
          />
          <button type="submit" className="absolute right-3 top-2.5 text-gray-400 hover:text-blue-600">
            <Search className="w-5 h-5" />
          </button>
        </form>
      </div>

      {/* Right: Auth + actions */}
      <div className="flex items-center gap-3 relative z-10">

        {/* Bell */}
        <NotificationsPanel />

        {user ? (
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-sm font-semibold text-gray-700 max-w-[140px] truncate">
              {profile?.full_name ?? user.email}
            </span>
            <button
              onClick={handleLogout}
              className="hidden sm:flex items-center gap-1.5 text-sm font-bold text-red-600 hover:text-red-700 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>

            {/* Hamburger — opens full menu on mobile, goes to profile on desktop */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen(o => !o)}
                className="flex items-center gap-2 border border-gray-300 rounded-full py-1.5 px-3 hover:shadow-md transition-shadow"
              >
                {menuOpen ? <X className="w-4 h-4 text-gray-500" /> : <Menu className="w-4 h-4 text-gray-500" />}
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                ) : (
                  <User className="w-5 h-5 text-gray-600 fill-gray-100" />
                )}
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl border border-gray-200 shadow-xl py-2 z-50">
                  {/* Nav links — always shown in dropdown */}
                  <Link
                    to="/search"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Search className="w-4 h-4 text-gray-400" />
                    Find Instructors
                  </Link>
                  <Link
                    to="/for-tutors"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <GraduationCap className="w-4 h-4 text-gray-400" />
                    For Instructors
                  </Link>
                  <Link
                    to="/needed-courses"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-amber-700 hover:bg-amber-50 transition-colors"
                  >
                    <Lightbulb className="w-4 h-4 text-amber-500" />
                    Requested Courses
                  </Link>

                  <div className="my-1.5 border-t border-gray-100" />

                  {/* Profile */}
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); navigate(role === 'tutor' ? '/my-profile' : '/profile') }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <User className="w-4 h-4 text-gray-400" />
                    My Profile
                  </button>
                  <Link
                    to="/lessons"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <BookOpen className="w-4 h-4 text-gray-400" />
                    My Lessons
                  </Link>

                  <div className="my-1.5 border-t border-gray-100" />

                  {/* Sign out */}
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Logged out */
          <div className="flex items-center gap-3">
            <Link to="/login" className="hidden sm:block text-sm font-bold text-gray-700 hover:text-blue-600">
              Sign In / Sign Up
            </Link>

            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen(o => !o)}
                className="flex items-center gap-2 border border-gray-300 rounded-full py-1.5 px-3 hover:shadow-md transition-shadow"
              >
                {menuOpen ? <X className="w-4 h-4 text-gray-500" /> : <Menu className="w-4 h-4 text-gray-500" />}
                <User className="w-5 h-5 text-gray-600 fill-gray-100" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl border border-gray-200 shadow-xl py-2 z-50">
                  <Link
                    to="/search"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Search className="w-4 h-4 text-gray-400" />
                    Find Instructors
                  </Link>
                  <Link
                    to="/for-tutors"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <GraduationCap className="w-4 h-4 text-gray-400" />
                    For Instructors
                  </Link>
                  <Link
                    to="/needed-courses"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-amber-700 hover:bg-amber-50 transition-colors"
                  >
                    <Lightbulb className="w-4 h-4 text-amber-500" />
                    Requested Courses
                  </Link>

                  <div className="my-1.5 border-t border-gray-100" />

                  <Link
                    to="/login"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    <User className="w-4 h-4" />
                    Sign In / Sign Up
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
