import { useState } from "react";
import { Navbar } from "../components/Navbar";
import { Search, Plus, Download, Book, School, GraduationCap, Filter, FileText, ChevronRight, Share2, Star } from "lucide-react";
import { toast } from "sonner";

interface Resource {
  id: string;
  title: string;
  subject: string;
  gradeLevel: string;
  school: string;
  author: string;
  type: "PDF" | "Doc" | "Slides" | "Link";
  downloads: number;
  rating: number;
  date: string;
}

const MOCK_RESOURCES: Resource[] = [
  {
    id: "1",
    title: "AP Calculus BC - Integration Techniques Cheat Sheet",
    subject: "Mathematics",
    gradeLevel: "12th Grade",
    school: "Garfield High School",
    author: "Dr. Sarah Mitchell",
    type: "PDF",
    downloads: 124,
    rating: 4.9,
    date: "2026-02-10"
  },
  {
    id: "2",
    title: "Physics Mechanics - Lab Report Template",
    subject: "Science",
    gradeLevel: "11th Grade",
    school: "Roosevelt High",
    author: "James Wilson",
    type: "Doc",
    downloads: 89,
    rating: 4.7,
    date: "2026-01-25"
  },
  {
    id: "3",
    title: "SAT Evidence-Based Reading Practice Set",
    subject: "English",
    gradeLevel: "10th-12th Grade",
    school: "District-wide",
    author: "Elena Rodriguez",
    type: "PDF",
    downloads: 452,
    rating: 5.0,
    date: "2026-02-15"
  },
  {
    id: "4",
    title: "World History - French Revolution Timeline",
    subject: "History",
    gradeLevel: "9th Grade",
    school: "Lakeside School",
    author: "Marcus Chen",
    type: "Slides",
    downloads: 67,
    rating: 4.5,
    date: "2026-02-01"
  }
];

export function Repository() {
  const [resources, setResources] = useState<Resource[]>(MOCK_RESOURCES);
  const [searchQuery, setSearchQuery] = useState("");
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  const handleDownload = (title: string) => {
    toast.success(`Downloading: ${title}`);
  };

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Resource submitted for review!");
    setIsUploadOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <Navbar />
      
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 md:px-8 py-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight mb-2">Resource Repository</h1>
            <p className="text-gray-500 font-medium">Shared teaching materials for tutors, by tutors.</p>
          </div>
          <button 
            onClick={() => setIsUploadOpen(true)}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 shrink-0"
          >
            <Plus className="w-5 h-5" />
            Upload Resource
          </button>
        </div>

        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col lg:flex-row gap-4 mb-8">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
            <input 
              type="text"
              placeholder="Search by subject, school, or topic..."
              className="w-full h-12 pl-12 pr-4 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-800 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <div className="relative">
              <Filter className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <select className="h-12 pl-9 pr-8 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none font-bold text-gray-600 appearance-none cursor-pointer">
                <option>Grade Level</option>
                <option>K-5</option>
                <option>6-8</option>
                <option>9-12</option>
                <option>College</option>
              </select>
            </div>
            <div className="relative">
              <School className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <select className="h-12 pl-9 pr-8 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none font-bold text-gray-600 appearance-none cursor-pointer">
                <option>Area Schools</option>
                <option>Seattle Public</option>
                <option>Bellevue School Dist</option>
                <option>Private Schools</option>
              </select>
            </div>
          </div>
        </div>

        {/* Resource Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {resources.map((resource) => (
            <div key={resource.id} className="group bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-2 rounded-lg ${
                    resource.type === 'PDF' ? 'bg-red-50 text-red-600' :
                    resource.type === 'Doc' ? 'bg-blue-50 text-blue-600' :
                    resource.type === 'Slides' ? 'bg-orange-50 text-orange-600' : 'bg-gray-50 text-gray-600'
                  }`}>
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="flex items-center gap-1 text-xs font-bold text-amber-500 bg-amber-50 px-2 py-1 rounded-full">
                    <Star className="w-3 h-3 fill-amber-500" />
                    {resource.rating}
                  </div>
                </div>

                <h3 className="font-black text-gray-900 mb-2 line-clamp-2 leading-tight group-hover:text-blue-600 transition-colors">
                  {resource.title}
                </h3>
                
                <div className="space-y-2 mb-6">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                    <Book className="w-3.5 h-3.5" />
                    {resource.subject}
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                    <GraduationCap className="w-3.5 h-3.5" />
                    {resource.gradeLevel}
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                    <School className="w-3.5 h-3.5" />
                    {resource.school}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                  <div className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">
                    BY {resource.author}
                  </div>
                  <div className="text-[10px] text-gray-400 font-bold">
                    {resource.downloads} DLs
                  </div>
                </div>
              </div>
              
              <button 
                onClick={() => handleDownload(resource.title)}
                className="w-full py-3 bg-gray-50 text-gray-600 font-bold text-sm flex items-center justify-center gap-2 group-hover:bg-blue-600 group-hover:text-white transition-colors"
              >
                <Download className="w-4 h-4" />
                Download {resource.type}
              </button>
            </div>
          ))}
        </div>

        {/* Empty State Mockup */}
        {resources.length === 0 && (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">No resources found</h3>
            <p className="text-gray-500">Try adjusting your filters or search terms.</p>
          </div>
        )}
      </main>

      {/* Upload Modal (Simplified) */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden">
            <div className="p-8">
              <h2 className="text-2xl font-black text-gray-900 mb-2">Upload Resource</h2>
              <p className="text-gray-500 font-medium mb-8">Share your materials with the tutor community.</p>
              
              <form onSubmit={handleUpload} className="space-y-6">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">RESOURCE TITLE</label>
                  <input required placeholder="e.g. Geometry Final Exam Prep" className="w-full h-12 px-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 bg-gray-50" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">SUBJECT</label>
                    <input required placeholder="Mathematics" className="w-full h-12 px-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 bg-gray-50" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">GRADE LEVEL</label>
                    <input required placeholder="10th Grade" className="w-full h-12 px-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 bg-gray-50" />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">SCHOOL (OPTIONAL)</label>
                  <input placeholder="e.g. Ballard High" className="w-full h-12 px-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 bg-gray-50" />
                </div>

                <div className="border-2 border-dashed border-gray-200 rounded-2xl p-10 flex flex-col items-center justify-center bg-gray-50 group hover:border-blue-400 transition-colors cursor-pointer">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mb-3 group-hover:scale-110 transition-transform">
                    <Plus className="w-6 h-6 text-blue-600" />
                  </div>
                  <p className="text-sm font-bold text-gray-600">Click to select files or drag & drop</p>
                  <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase tracking-widest">PDF, DOC, JPG UP TO 20MB</p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsUploadOpen(false)}
                    className="flex-1 py-3 text-gray-600 font-bold rounded-xl hover:bg-gray-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-[2] py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                  >
                    Publish Resource
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
