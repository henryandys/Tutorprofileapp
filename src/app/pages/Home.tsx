import { useState } from "react";
import { Navbar } from "../components/Navbar";
import { Search as SearchIcon, MapPin, CheckCircle, Star, Users, ArrowRight } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";

export function Home() {
  const navigate = useNavigate()
  const [subject, setSubject]   = useState("")
  const [location, setLocation] = useState("")

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
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full font-bold text-sm mb-8 animate-bounce">
              <Star className="w-4 h-4 fill-blue-700" />
              Rated #1 Tutor Marketplace in 2026
            </div>
            
            <h1 className="text-5xl md:text-7xl font-black text-gray-900 tracking-tight leading-none mb-8">
              Find the perfect tutor <br />
              <span className="text-blue-600">in your neighborhood.</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-gray-500 font-medium max-w-2xl mb-12">
              Browse thousands of local experts, read reviews, and book sessions instantly. From Calculus to Coding.
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

            <div className="mt-8 flex flex-wrap justify-center gap-6">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="font-bold text-gray-600">Verified Tutors</span>
              </div>
              <div className="flex items-center gap-2">
                
                
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="font-bold text-gray-600">No Commitments</span>
              </div>
            </div>
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
                Find a tutor <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="flex flex-col gap-6 p-8 bg-white rounded-3xl shadow-sm border border-gray-100">
              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center text-green-600">
                <Star className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-black text-gray-900 leading-tight">For Tutors</h3>
              <p className="text-gray-500 font-medium">Join our community of world-class educators. Set your own rates, manage your schedule, and grow your business.</p>
              <Link to="/become-a-tutor" className="text-green-600 font-black flex items-center gap-2 hover:gap-3 transition-all">
                Start tutoring <ArrowRight className="w-4 h-4" />
              </Link>
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
                <span className="text-2xl font-black tracking-tighter text-blue-900">TutorFind</span>
              </div>
              <p className="text-gray-500 font-medium">Making expert education accessible to every neighborhood across the country.</p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-12 md:gap-24">
              <div className="flex flex-col gap-4">
                <h4 className="font-black text-gray-900 uppercase tracking-widest text-xs">Platform</h4>
                <Link to="/search" className="text-gray-500 font-bold hover:text-blue-600">Find Tutors</Link>
                <Link to="/repository" className="text-gray-500 font-bold hover:text-blue-600">Repository</Link>
                <Link to="/become-a-tutor" className="text-gray-500 font-bold hover:text-blue-600">Become a Tutor</Link>
              </div>
              <div className="flex flex-col gap-4">
                <h4 className="font-black text-gray-900 uppercase tracking-widest text-xs">Support</h4>
                <a href="#" className="text-gray-500 font-bold hover:text-blue-600">Help Center</a>
                <a href="#" className="text-gray-500 font-bold hover:text-blue-600">Safety Guide</a>
                <a href="#" className="text-gray-500 font-bold hover:text-blue-600">Pricing</a>
              </div>
              <div className="flex flex-col gap-4">
                <h4 className="font-black text-gray-900 uppercase tracking-widest text-xs">Legal</h4>
                <a href="#" className="text-gray-500 font-bold hover:text-blue-600">Privacy</a>
                <a href="#" className="text-gray-500 font-bold hover:text-blue-600">Terms</a>
                <a href="#" className="text-gray-500 font-bold hover:text-blue-600">Cookies</a>
              </div>
            </div>
          </div>
          
          <div className="pt-12 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
            <p className="text-gray-400 font-bold text-sm">© 2026 TutorFind Technologies Inc. All rights reserved.</p>
            <div className="flex gap-6">
              <div className="w-10 h-10 bg-gray-50 rounded-full" />
              <div className="w-10 h-10 bg-gray-50 rounded-full" />
              <div className="w-10 h-10 bg-gray-50 rounded-full" />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
