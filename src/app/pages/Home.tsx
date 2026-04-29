import { useState } from "react";
import { Navbar } from "../components/Navbar";
import { Search as SearchIcon, MapPin, Star, Users, ArrowRight } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { useAuth } from "../../context/AuthContext";

export function Home() {
  const navigate = useNavigate()
  const { role }  = useAuth()
  const [subject, setSubject]   = useState("")
  const [location, setLocation] = useState("")

  function handleBecomeTutor(e: React.MouseEvent) {
    e.preventDefault()
    if (role === 'tutor') {
      toast.info("You're already an Instructor! Redirecting to your profile.")
      navigate('/my-profile')
    } else {
      navigate('/become-a-tutor')
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (subject.trim())  params.set("q", subject.trim())
    if (location.trim()) params.set("location", location.trim())
    navigate(`/search?${params.toString()}`)
  }

  return (
    <div className="min-h-screen bg-white font-sans overflow-x-hidden">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative pt-20 pb-32 overflow-hidden">
        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-4xl mx-auto text-center flex flex-col items-center">
            <h1 className="text-5xl md:text-7xl font-black text-gray-900 tracking-tight leading-none mb-8">
              Find the perfect Instructor <br />
              <span className="text-blue-600">in your neighborhood.</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-gray-500 font-medium max-w-2xl mb-12">
              Find local experts, read reviews, and book sessions instantly. From Tennis to Trig.
            </p>

            {/* Main Search Bar */}
            <form onSubmit={handleSearch} className="w-full max-w-3xl bg-white p-2 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-gray-100 flex flex-col md:flex-row gap-2">
              <div className="flex-1 relative">
                <SearchIcon className="absolute left-6 top-5 w-6 h-6 text-gray-400" />
                <input
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="Subject (e.g. Physics, SAT Prep)"
                  className="w-full h-16 pl-16 pr-6 bg-transparent text-lg font-bold text-gray-800 focus:outline-none"
                />
              </div>
              <div className="w-px h-10 bg-gray-100 hidden md:block self-center" />
              <div className="flex-1 relative">
                <MapPin className="absolute left-6 top-5 w-6 h-6 text-gray-400" />
                <input
                  type="text"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="City or Zip code"
                  className="w-full h-16 pl-16 pr-6 bg-transparent text-lg font-bold text-gray-800 focus:outline-none"
                />
              </div>
              <button type="submit" className="h-16 px-10 bg-blue-600 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-blue-700 transition-all">
                Search
                <ArrowRight className="w-5 h-5" />
              </button>
            </form>

          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute top-40 -left-20 w-64 h-64 bg-blue-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" />
        <div className="absolute top-20 -right-20 w-96 h-96 bg-purple-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" />
      </section>

      {/* Feature Grid */}
      <section className="py-24 bg-gray-50 border-y border-gray-100">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="flex flex-col gap-6 p-8 bg-white rounded-3xl shadow-sm border border-gray-100">
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
                <Users className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-black text-gray-900 leading-tight">For Students</h3>
              <p className="text-gray-500 font-medium">Find expert help for any subject. Boost your grades and confidence with personalized 1-on-1 attention.</p>
              <Link to="/search" className="text-blue-600 font-black flex items-center gap-2 hover:gap-3 transition-all">
                Find an Instructor <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="flex flex-col gap-6 p-8 bg-white rounded-3xl shadow-sm border border-gray-100">
              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center text-green-600">
                <Star className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-black text-gray-900 leading-tight">For Instructors</h3>
              <p className="text-gray-500 font-medium">Join our community of world-class educators. Set your own rates, manage your schedule, and grow your business.</p>
              <button onClick={handleBecomeTutor} className="text-green-600 font-black flex items-center gap-2 hover:gap-3 transition-all">
                Start instructing <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-6 p-8 bg-white rounded-3xl shadow-sm border border-gray-100">
              <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center text-purple-600">
                <SearchIcon className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-black text-gray-900 leading-tight">Resource Lab</h3>
              <p className="text-gray-500 font-medium">Access our shared repository of teaching materials, school-specific cheat sheets, and practice exams.</p>
              <Link to="/repository" className="text-purple-600 font-black flex items-center gap-2 hover:gap-3 transition-all">
                Explore lab <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 bg-white border-t border-gray-100">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-start gap-12 mb-16">
            <div className="max-w-xs flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black text-2xl">T</div>
                <span className="text-2xl font-black tracking-tighter text-blue-900">InstructorFinder</span>
              </div>
              <p className="text-gray-500 font-medium">Making expert education accessible to every neighborhood across the country.</p>
            </div>
            
            <div className="flex flex-col gap-4">
                <h4 className="font-black text-gray-900 uppercase tracking-widest text-xs">Platform</h4>
                <Link to="/search" className="text-gray-500 font-bold hover:text-blue-600">Find Instructors</Link>
                <Link to="/repository" className="text-gray-500 font-bold hover:text-blue-600">Repository</Link>
                <button onClick={handleBecomeTutor} className="text-gray-500 font-bold hover:text-blue-600">Become an Instructor</button>
            </div>
          </div>
          
        </div>
      </footer>
    </div>
  );
}
