import { useState } from "react";
import { tutors } from "../data/tutors";
import { Navbar } from "../components/Navbar";
import { FilterBar } from "../components/FilterBar";
import { TutorCard } from "../components/TutorCard";
import { Map } from "../components/Map";
import { motion, AnimatePresence } from "motion/react";
import { ChevronRight, Grid, List, Map as MapIcon, X } from "lucide-react";

export function Search() {
  const [selectedTutorId, setSelectedTutorId] = useState<string | undefined>(undefined);
  const [viewMode, setViewMode] = useState<"split" | "list" | "map">("map");

  const selectedTutor = tutors.find(t => t.id === selectedTutorId);

  return (
    <div className="flex flex-col h-screen bg-white">
      <Navbar />
      <FilterBar />

      <main className="flex-1 flex overflow-hidden relative">
        {/* Tutor Sidebar Section */}
        <AnimatePresence>
          {selectedTutor && (
            <motion.section 
              initial={{ x: -400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -400, opacity: 0 }}
              transition={{ type: "spring", damping: 20, stiffness: 100 }}
              className="absolute lg:relative z-40 h-full w-[90%] sm:w-[400px] lg:w-[450px] bg-white border-r border-gray-200 shadow-2xl lg:shadow-none overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900">Tutor Profile</h2>
                  <button 
                    onClick={() => setSelectedTutorId(undefined)}
                    className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <TutorCard 
                  tutor={selectedTutor} 
                  isSelected={true}
                />

                <div className="mt-8 pt-8 border-t border-gray-100">
                  <h3 className="font-bold text-gray-900 mb-4">Why choose {selectedTutor.name}?</h3>
                  <p className="text-sm text-gray-600 leading-relaxed mb-6">
                    {selectedTutor.bio}
                  </p>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm font-medium text-gray-700">
                      <div className="w-2 h-2 bg-blue-600 rounded-full" />
                      {selectedTutor.education}
                    </div>
                    <div className="flex items-center gap-3 text-sm font-medium text-gray-700">
                      <div className="w-2 h-2 bg-blue-600 rounded-full" />
                      {selectedTutor.experience}
                    </div>
                  </div>
                </div>

                <div className="mt-8">
                  <button 
                    className="w-full h-12 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                    onClick={() => window.location.href = `/tutor/${selectedTutor.id}`}
                  >
                    View Full Profile
                  </button>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* List View Overlay (If user explicitly switches to list) */}
        {viewMode === "list" && (
          <section className="absolute inset-0 z-30 bg-gray-50 overflow-y-auto">
            <div className="p-6 max-w-5xl mx-auto">
              <div className="flex items-center justify-between mb-8">
                <h1 className="text-2xl font-bold text-gray-900">All Tutors in Seattle</h1>
                <button 
                  onClick={() => setViewMode("map")}
                  className="px-4 py-2 bg-white border border-gray-200 rounded-lg font-bold text-sm shadow-sm hover:bg-gray-50"
                >
                  Back to Map
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {tutors.map(tutor => (
                  <TutorCard 
                    key={tutor.id} 
                    tutor={tutor} 
                    onClick={() => {
                      setSelectedTutorId(tutor.id);
                      setViewMode("map");
                    }}
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Map Section - Always present but fills space */}
        <section className="flex-1 h-full relative z-10">
          <Map 
            tutors={tutors} 
            selectedId={selectedTutorId} 
            onSelect={(id) => setSelectedTutorId(id)}
          />
          
          {/* View Toggles */}
          <div className="absolute top-6 left-6 z-20 flex bg-white rounded-xl shadow-xl border border-gray-100 p-1">
            <button 
              onClick={() => setViewMode("map")}
              className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${
                viewMode === "map" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <MapIcon className="w-4 h-4" />
              Map
            </button>
            <button 
              onClick={() => setViewMode("list")}
              className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${
                viewMode === "list" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <List className="w-4 h-4" />
              List
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
