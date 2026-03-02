import { MapPin } from "lucide-react";
import { Tutor } from "../data/tutors";

interface MapProps {
  tutors: Tutor[];
  selectedId?: string;
  onSelect: (id: string | undefined) => void;
}

export function Map({ tutors, selectedId, onSelect }: MapProps) {
  return (
    <div className="relative w-full h-full bg-[#f8f9fa] overflow-hidden" onClick={() => onSelect(undefined)}>
      {/* Stylized Map Grid Background */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `radial-gradient(#6c757d 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }}
      />
      
      {/* Mock Map Streets/Features */}
      <svg className="absolute inset-0 w-full h-full opacity-30" viewBox="0 0 1000 1000" preserveAspectRatio="none">
        <path d="M0,200 L1000,250 M300,0 L350,1000 M700,0 L650,1000 M0,600 L1000,550 M0,800 L1000,850" stroke="#6c757d" strokeWidth="4" fill="none" />
        <path d="M100,0 C150,200 50,400 120,600 C150,800 50,1000 80,1000" stroke="#adb5bd" strokeWidth="12" fill="none" strokeLinecap="round" />
        <rect x="200" y="300" width="100" height="150" fill="#dee2e6" rx="10" />
        <rect x="500" y="100" width="150" height="80" fill="#dee2e6" rx="10" />
        <rect x="750" y="600" width="120" height="200" fill="#dee2e6" rx="10" />
      </svg>

      {/* Tutor Pins */}
      {tutors.map((tutor) => (
        <div 
          key={tutor.id}
          className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300"
          style={{ left: `${tutor.coordinates.x}%`, top: `${tutor.coordinates.y}%` }}
        >
          <div className="group relative">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onSelect(tutor.id);
              }}
              className={`flex flex-col items-center gap-1 transition-all duration-300 ${
                selectedId === tutor.id ? "scale-110 z-20" : "scale-100 z-10"
              }`}
            >
              <div 
                className={`px-3 py-1 rounded-full border shadow-lg font-bold text-sm whitespace-nowrap transition-colors ${
                  selectedId === tutor.id 
                    ? "bg-blue-600 text-white border-blue-700 ring-4 ring-blue-100" 
                    : "bg-white text-gray-900 border-gray-200 group-hover:bg-blue-50"
                }`}
              >
                ${tutor.hourlyRate}
              </div>
              <MapPin 
                className={`w-6 h-6 drop-shadow-md transition-colors ${
                  selectedId === tutor.id ? "text-blue-600 fill-blue-600" : "text-blue-500 fill-blue-500"
                }`} 
              />
            </button>

            {/* Tooltip on hover */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-48 bg-white rounded-xl shadow-xl border border-gray-100 p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
              <div className="flex gap-2 items-center">
                <img src={tutor.imageUrl} className="w-10 h-10 rounded-full object-cover" alt="" />
                <div className="flex-1">
                  <p className="text-xs font-bold text-gray-900 leading-tight">{tutor.name}</p>
                  <p className="text-[10px] text-gray-500 line-clamp-1">{tutor.subject}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Map Controls */}
      <div className="absolute right-6 top-6 flex flex-col gap-2">
        <button className="w-10 h-10 bg-white rounded-lg shadow-md border border-gray-200 flex items-center justify-center font-bold text-xl text-gray-700 hover:bg-gray-50">+</button>
        <button className="w-10 h-10 bg-white rounded-lg shadow-md border border-gray-200 flex items-center justify-center font-bold text-xl text-gray-700 hover:bg-gray-50">-</button>
      </div>

      <div className="absolute bottom-6 right-6 flex flex-col gap-2">
        <button className="px-4 py-2 bg-white rounded-full shadow-md border border-gray-200 flex items-center gap-2 text-sm font-bold text-gray-700 hover:bg-gray-50">
          <MapPin className="w-4 h-4" />
          Center on Me
        </button>
      </div>
    </div>
  );
}
