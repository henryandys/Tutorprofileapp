import { ChevronDown, SlidersHorizontal, MapPin } from "lucide-react";

const filterOptions = [
  { label: "Price Range", icon: ChevronDown },
  { label: "Subject", icon: ChevronDown },
  { label: "Rating", icon: ChevronDown },
  { label: "Distance", icon: ChevronDown },
  { label: "Availability", icon: ChevronDown },
];

export function FilterBar() {
  return (
    <div className="sticky top-16 z-40 bg-white border-b border-gray-200 px-4 md:px-8 py-3 flex items-center gap-3 overflow-x-auto no-scrollbar shadow-sm">
      <div className="flex items-center border border-gray-300 rounded-lg px-4 py-2 hover:border-blue-500 transition-colors focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 bg-white min-w-[200px] md:min-w-[300px]">
        <MapPin className="w-4 h-4 text-gray-400 mr-2 shrink-0" />
        <input 
          type="text" 
          defaultValue="Seattle, WA"
          className="w-full text-sm font-semibold text-gray-700 bg-transparent focus:outline-none placeholder-gray-400"
        />
        <ChevronDown className="w-4 h-4 text-gray-400 ml-2 shrink-0" />
      </div>

      <div className="h-6 w-px bg-gray-200 mx-2 shrink-0" />

      {filterOptions.map((filter) => (
        <button 
          key={filter.label}
          className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:border-blue-500 hover:bg-blue-50 transition-colors whitespace-nowrap"
        >
          {filter.label}
          <filter.icon className="w-4 h-4 text-gray-400 group-hover:text-blue-500" />
        </button>
      ))}

      <div className="flex-1" />

      <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-bold text-gray-700 hover:border-blue-500 hover:bg-blue-50 transition-colors shrink-0">
        <SlidersHorizontal className="w-4 h-4" />
        Filters
      </button>

      <button className="hidden lg:flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm hover:shadow-md shrink-0 ml-2">
        Save Search
      </button>
    </div>
  );
}
