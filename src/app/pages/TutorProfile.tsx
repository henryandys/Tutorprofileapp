import { useParams, Link } from "react-router";
import { tutors } from "../data/tutors";
import { Navbar } from "../components/Navbar";
import { Star, MapPin, Share2, Heart, MessageCircle, Clock, GraduationCap, Briefcase, Calendar, ChevronLeft, ChevronRight, X, Phone, Mail, Users } from "lucide-react";
import { motion } from "motion/react";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { useState } from "react";

export function TutorProfile() {
  const { id } = useParams();
  const tutor = tutors.find(t => t.id === id);
  const [activeTab, setActiveTab] = useState("overview");

  if (!tutor) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Tutor Profile Not Found</h1>
          <p className="text-gray-500 mb-8 max-w-md mx-auto">
            The tutor profile you're looking for might have been moved or is no longer available.
          </p>
          <Link to="/" className="px-8 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200">
            Back to Search
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      
      {/* Top Gallery Header (Zillow Style) */}
      <div className="relative h-[400px] md:h-[500px] bg-gray-900 overflow-hidden group">
        <ImageWithFallback 
          src={tutor.imageUrl} 
          alt={tutor.name}
          className="w-full h-full object-cover object-top opacity-90 group-hover:scale-105 transition-transform duration-700"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        
        <div className="absolute top-6 left-6 md:left-12">
          <Link to="/" className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md text-white rounded-lg font-bold hover:bg-white/20 transition-all border border-white/20 shadow-xl">
            <ChevronLeft className="w-5 h-5" />
            Back to Results
          </Link>
        </div>

        <div className="absolute top-6 right-6 md:right-12 flex items-center gap-3">
          <button className="p-3 bg-white/10 backdrop-blur-md text-white rounded-full hover:bg-white/20 transition-all border border-white/20 shadow-xl">
            <Share2 className="w-5 h-5" />
          </button>
          <button className="p-3 bg-white/10 backdrop-blur-md text-white rounded-full hover:bg-white/20 transition-all border border-white/20 shadow-xl">
            <Heart className="w-5 h-5" />
          </button>
        </div>

        <div className="absolute bottom-12 left-6 md:left-12 right-6 md:right-12">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-end justify-between gap-6">
            <div className="flex flex-col gap-2">
              <span className="inline-block px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-full uppercase tracking-wider w-fit">
                {tutor.subject.split(" & ")[0]}
              </span>
              <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
                {tutor.name}
              </h1>
              <div className="flex items-center gap-4 text-white/90">
                <div className="flex items-center gap-1.5 font-bold">
                  <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  <span className="text-lg">{tutor.rating}</span>
                  <span className="text-sm font-medium opacity-80 font-normal">({tutor.reviewCount} reviews)</span>
                </div>
                <div className="flex items-center gap-1.5 font-bold">
                  <MapPin className="w-5 h-5 text-blue-400" />
                  <span className="text-lg">{tutor.location}</span>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col items-end text-white">
              <span className="text-sm font-bold opacity-80 uppercase tracking-widest leading-none">HOURLY RATE</span>
              <span className="text-5xl md:text-6xl font-black">${tutor.hourlyRate}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-12 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          
          {/* Main Info Column */}
          <div className="lg:col-span-2 flex flex-col gap-12">
            
            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 p-8 bg-gray-50 rounded-3xl border border-gray-100 shadow-sm">
              <div className="flex flex-col gap-1 text-center md:text-left">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">EXPERIENCE</span>
                <span className="text-lg font-bold text-gray-900 leading-tight">12+ Years</span>
              </div>
              <div className="flex flex-col gap-1 text-center md:text-left">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">HOURS TAUGHT</span>
                <span className="text-lg font-bold text-gray-900 leading-tight">2,500+ Hrs</span>
              </div>
              <div className="flex flex-col gap-1 text-center md:text-left">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">RESPONSE TIME</span>
                <span className="text-lg font-bold text-gray-900 leading-tight">{"< 2 hours"}</span>
              </div>
              <div className="flex flex-col gap-1 text-center md:text-left">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">REPEAT RATE</span>
                <span className="text-lg font-bold text-gray-900 leading-tight">94%</span>
              </div>
            </div>

            {/* Overview / Bio Section */}
            <section className="flex flex-col gap-6">
              <h2 className="text-2xl font-bold text-gray-900 border-b-4 border-blue-600 w-fit pb-1">Tutor Overview</h2>
              <p className="text-xl text-gray-600 leading-relaxed font-medium">
                {tutor.bio}
              </p>
            </section>

            {/* Background / Qualifications */}
            <section className="flex flex-col gap-8">
              <h2 className="text-2xl font-bold text-gray-900">Background & Qualifications</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center shrink-0">
                    <GraduationCap className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <h4 className="text-lg font-bold text-gray-900 leading-tight">Education</h4>
                    <p className="text-gray-600 font-medium">{tutor.education}</p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center shrink-0">
                    <Briefcase className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <h4 className="text-lg font-bold text-gray-900 leading-tight">Experience</h4>
                    <p className="text-gray-600 font-medium">{tutor.experience}</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center shrink-0">
                    <Clock className="w-6 h-6 text-purple-600" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <h4 className="text-lg font-bold text-gray-900 leading-tight">Availability</h4>
                    <p className="text-gray-600 font-medium">Weekdays 4pm-9pm, Weekends 10am-4pm</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center shrink-0">
                    <Users className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <h4 className="text-lg font-bold text-gray-900 leading-tight">Group Sessions</h4>
                    <p className="text-gray-600 font-medium">Available for up to 5 students at $45/hr each</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center shrink-0">
                    <Calendar className="w-6 h-6 text-orange-600" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <h4 className="text-lg font-bold text-gray-900 leading-tight">Policy</h4>
                    <p className="text-gray-600 font-medium">24-hour cancellation notice required</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Reviews Placeholder */}
            <section className="flex flex-col gap-8">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <h2 className="text-2xl font-bold text-gray-900">Student Reviews</h2>
                <div className="flex items-center gap-2">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map(i => <Star key={i} className="w-4 h-4 fill-blue-600 text-blue-600" />)}
                  </div>
                  <span className="text-sm font-bold text-gray-900">{tutor.rating} Avg</span>
                </div>
              </div>

              <div className="flex flex-col gap-10">
                {[1, 2].map(i => (
                  <div key={i} className="flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <div className="flex gap-3 items-center">
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center font-bold text-gray-600">S</div>
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-900 leading-tight">Sarah J.</span>
                          <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">MARCH 2025</span>
                        </div>
                      </div>
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map(i => <Star key={i} className="w-3 h-3 fill-blue-600 text-blue-600" />)}
                      </div>
                    </div>
                    <p className="text-gray-600 leading-relaxed font-medium italic">
                      "I was struggling so much with my physics coursework, but Dr. Sarah has a way of explaining things that just makes sense. My grades have improved significantly in just one month!"
                    </p>
                  </div>
                ))}
                
                <button className="text-blue-600 font-bold hover:underline flex items-center gap-1">
                  Read all {tutor.reviewCount} reviews <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </section>
          </div>

          {/* Booking Sidebar Column */}
          <div className="lg:col-span-1">
            <div className="sticky top-28 flex flex-col gap-6 bg-white rounded-3xl border border-gray-200 shadow-2xl p-8 overflow-hidden">
              <div className="flex flex-col gap-1 mb-2">
                <h3 className="text-2xl font-black text-gray-900 leading-tight">Book a Session</h3>
                <p className="text-sm font-medium text-gray-500 leading-tight">
                  Free 15-minute consultation for new students
                </p>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">SELECT SUBJECT</label>
                  <select className="w-full h-12 px-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 bg-gray-50">
                    <option>{tutor.subject.split(" & ")[0]}</option>
                    <option>{tutor.subject.split(" & ")[1]}</option>
                    <option>Other</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">STUDENT NAME</label>
                  <input type="text" placeholder="Full name" className="w-full h-12 px-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 bg-gray-50" />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">MESSAGE</label>
                  <textarea placeholder="Tell the tutor what you need help with..." rows={4} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-800 bg-gray-50" />
                </div>
              </div>

              <div className="flex flex-col gap-3 mt-4">
                <button className="w-full h-14 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2">
                  Request Lesson
                </button>
                <button className="w-full h-14 border-2 border-blue-600 text-blue-600 rounded-xl font-bold text-lg hover:bg-blue-50 transition-all flex items-center justify-center gap-2">
                  Contact Tutor
                </button>
              </div>

              <div className="flex items-center justify-center gap-6 mt-4 pt-6 border-t border-gray-100">
                <div className="flex flex-col items-center gap-1">
                  <Phone className="w-5 h-5 text-gray-400" />
                  <span className="text-[10px] font-bold text-gray-400 uppercase">CALL</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <Mail className="w-5 h-5 text-gray-400" />
                  <span className="text-[10px] font-bold text-gray-400 uppercase">EMAIL</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <MessageCircle className="w-5 h-5 text-gray-400" />
                  <span className="text-[10px] font-bold text-gray-400 uppercase">CHAT</span>
                </div>
              </div>
              
              <p className="text-[11px] text-center text-gray-400 font-medium mt-2">
                By clicking Request Lesson, you agree to our Terms of Service.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
