// src/app/components/Navbar.tsx

import { Search, Menu, User, Bell, ChevronDown, LogOut } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../../context/AuthContext";

export function Navbar() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await signOut()
    navigate('/')
  }

  return (
    <nav className="h-16 border-b border-gray-200 bg-white sticky top-0 z-50 px-4 md:px-8 flex items-center justify-between">
      
      {/* Left: Logo + Nav links */}
      <div className="flex items-center gap-8">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold text-xl">
            T
          </div>
          <span className="text-xl font-bold tracking-tight text-blue-900 hidden sm:block">
            TutorFind
          </span>
        </Link>
        <div className="hidden lg:flex items-center gap-6">
          <Link to="/search" className="text-sm font-semibold text-gray-600 hover:text-blue-600">Find Tutors</Link>
          <Link to="/become-a-tutor" className="text-sm font-semibold text-gray-600 hover:text-blue-600">For Tutors</Link>
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
        <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-full">
          <Bell className="w-5 h-5" />
        </button>

        {user ? (
          /* Logged in: name + sign out + profile icon */
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-sm font-semibold text-gray-700 max-w-[140px] truncate">
              {profile?.full_name ?? user.email}
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm font-bold text-red-600 hover:text-red-700 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:block">Sign Out</span>
            </button>
            <Link
              to="/profile"
              className="flex items-center gap-2 border border-gray-300 rounded-full py-1.5 px-3 hover:shadow-md transition-shadow"
            >
              <Menu className="w-4 h-4 text-gray-500" />
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
              ) : (
                <User className="w-5 h-5 text-gray-600 fill-gray-100" />
              )}
            </Link>
          </div>
        ) : (
          /* Logged out: sign in + profile icon */
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-bold text-gray-700 hover:text-blue-600">
              Sign In
            </Link>
            <Link
              to="/login"
              className="flex items-center gap-2 border border-gray-300 rounded-full py-1.5 px-3 hover:shadow-md transition-shadow"
            >
              <Menu className="w-4 h-4 text-gray-500" />
              <User className="w-5 h-5 text-gray-600 fill-gray-100" />
            </Link>
          </div>
        )}
      </div>
    </nav>
  )
}

