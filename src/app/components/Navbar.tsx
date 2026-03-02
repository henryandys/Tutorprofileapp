import { Search, Menu, User, Bell, ChevronDown, LogOut } from "lucide-react";
import { Link } from "react-router";
import { useState } from "react";

export function Navbar() {
  const [isLoggedIn, setIsLoggedIn] = useState(false); // This would be managed by auth state in a real app

  const handleLogout = () => {
    // Handle logout logic here (clear auth tokens, etc.)
    setIsLoggedIn(false);
    window.location.href = '/';
  };

  return (
    <nav className="h-16 border-b border-gray-200 bg-white sticky top-0 z-50 px-4 md:px-8 flex items-center justify-between">
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
          <Link to="/my-profile" className="text-sm font-semibold text-gray-600 hover:text-blue-600">For Tutors</Link>
        </div>
      </div>

      <div className="flex-1 max-w-md mx-8 hidden md:block">
        <form className="relative" onSubmit={(e) => { e.preventDefault(); window.location.href = '/search'; }}>
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

      <div className="flex items-center gap-4">
        {!isLoggedIn ? (
          <Link to="/login" className="hidden sm:block text-sm font-bold text-gray-700 hover:text-blue-600">
            Sign In
          </Link>
        ) : (
          <button 
            onClick={handleLogout}
            className="hidden sm:flex items-center gap-2 text-sm font-bold text-red-600 hover:text-red-700 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        )}
        <button className="hidden sm:flex items-center gap-1 text-sm font-semibold text-gray-600">
          Seattle, WA <ChevronDown className="w-4 h-4" />
        </button>
        <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-full">
          <Bell className="w-5 h-5" />
        </button>
        <Link to="/profile" className="flex items-center gap-2 border border-gray-300 rounded-full py-1.5 px-3 hover:shadow-md transition-shadow">
          <Menu className="w-4 h-4 text-gray-500" />
          <User className="w-5 h-5 text-gray-600 fill-gray-100" />
        </Link>
      </div>
    </nav>
  );
}