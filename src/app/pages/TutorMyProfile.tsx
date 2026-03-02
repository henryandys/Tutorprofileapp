import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { Navbar } from "../components/Navbar";
import { 
  User, 
  BookOpen, 
  DollarSign, 
  MapPin, 
  GraduationCap, 
  Briefcase, 
  Plus, 
  X, 
  Save,
  Camera,
  Users,
  Award,
  Star,
  FileText,
  ChevronRight
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router";

interface TutorProfileForm {
  name: string;
  email: string;
  location: string;
  hourlyRate: number;
  bio: string;
  education: string;
  experience: string;
  specialties: { value: string }[];
  ageGroups: {
    elementary: boolean;
    middleSchool: boolean;
    highSchool: boolean;
    college: boolean;
    adult: boolean;
  };
}

export function TutorMyProfile() {
  const [isEditing, setIsEditing] = useState(false);
  
  // Load existing profile data (mock data for now)
  const defaultValues: TutorProfileForm = {
    name: "Dr. Sarah Mitchell",
    email: "sarah.mitchell@email.com",
    location: "Downtown, Seattle",
    hourlyRate: 85,
    bio: "Ph.D. in Physics with over 10 years of experience helping students master complex mathematical concepts. I specialize in AP Physics and university-level Calculus.",
    education: "Ph.D. in Theoretical Physics, MIT",
    experience: "12 years teaching, 5 years private tutoring",
    specialties: [
      { value: "Advanced Calculus" },
      { value: "Physics" },
      { value: "AP Physics" }
    ],
    ageGroups: {
      elementary: false,
      middleSchool: false,
      highSchool: true,
      college: true,
      adult: true
    }
  };

  const { register, handleSubmit, control, formState: { errors } } = useForm<TutorProfileForm>({
    defaultValues
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "specialties"
  });

  const onSubmit = (data: TutorProfileForm) => {
    console.log("Updated profile data:", data);
    
    // Save to localStorage for demo purposes
    localStorage.setItem("tutorProfile", JSON.stringify(data));
    
    toast.success("Profile updated successfully!");
    setIsEditing(false);
  };

  const handleAddSpecialty = () => {
    append({ value: "" });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-black text-gray-900 tracking-tight mb-2">
                My Profile
              </h1>
              <p className="text-gray-500 font-medium">
                Manage your tutor profile, specialties, and preferences
              </p>
            </div>
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg"
              >
                Edit Profile
              </button>
            ) : (
              <button
                onClick={() => setIsEditing(false)}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 transition-all"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Profile Photo & Basic Info */}
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <User className="w-6 h-6 text-blue-600" />
              Basic Information
            </h2>
            
            <div className="flex flex-col md:flex-row gap-8 items-start">
              <div className="relative group">
                <div className="w-32 h-32 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-4xl font-bold">
                  SM
                </div>
                {isEditing && (
                  <button 
                    type="button" 
                    className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full shadow-lg hover:bg-blue-700"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">
                    Full Name
                  </label>
                  <input
                    {...register("name", { required: "Name is required" })}
                    disabled={!isEditing}
                    className="w-full h-12 px-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 bg-gray-50 transition-all disabled:bg-gray-100 disabled:text-gray-600"
                  />
                  {errors.name && (
                    <span className="text-xs text-red-500 font-bold">{errors.name.message}</span>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">
                    Email
                  </label>
                  <input
                    type="email"
                    {...register("email", { required: "Email is required" })}
                    disabled={!isEditing}
                    className="w-full h-12 px-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 bg-gray-50 transition-all disabled:bg-gray-100 disabled:text-gray-600"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">
                    Location
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                    <input
                      {...register("location", { required: "Location is required" })}
                      disabled={!isEditing}
                      className="w-full h-12 pl-12 pr-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 bg-gray-50 transition-all disabled:bg-gray-100 disabled:text-gray-600"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">
                    Hourly Rate ($)
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                    <input
                      type="number"
                      {...register("hourlyRate", { required: "Rate is required", min: 1 })}
                      disabled={!isEditing}
                      className="w-full h-12 pl-12 pr-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 bg-gray-50 transition-all disabled:bg-gray-100 disabled:text-gray-600"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">
                About / Bio
              </label>
              <textarea
                {...register("bio", { required: "Bio is required", minLength: 50 })}
                disabled={!isEditing}
                rows={4}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-800 bg-gray-50 transition-all disabled:bg-gray-100 disabled:text-gray-600"
              />
            </div>
          </div>

          {/* Specialties Section */}
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <BookOpen className="w-6 h-6 text-blue-600" />
                Specialties & Subjects
              </h2>
              {isEditing && (
                <button
                  type="button"
                  onClick={handleAddSpecialty}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg font-bold hover:bg-blue-200 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Add Specialty
                </button>
              )}
            </div>

            <div className="space-y-3">
              {fields.map((field, index) => (
                <div key={field.id} className="flex items-center gap-3">
                  <div className="flex-1">
                    <input
                      {...register(`specialties.${index}.value`, {
                        required: "Specialty is required"
                      })}
                      disabled={!isEditing}
                      placeholder="e.g. Advanced Calculus, AP Physics, SAT Prep"
                      className="w-full h-12 px-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 bg-gray-50 transition-all disabled:bg-gray-100 disabled:text-gray-600"
                    />
                  </div>
                  {isEditing && fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="p-3 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {!isEditing && fields.length === 0 && (
              <p className="text-gray-400 text-center py-8 font-medium">
                No specialties added yet. Click "Edit Profile" to add your teaching specialties.
              </p>
            )}
          </div>

          {/* Age Groups Section */}
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Users className="w-6 h-6 text-blue-600" />
              Target Age Groups
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <label className={`flex items-center gap-3 p-4 border-2 rounded-xl transition-all cursor-pointer ${
                isEditing ? "hover:border-blue-300 hover:bg-blue-50" : "cursor-not-allowed"
              }`}>
                <input
                  type="checkbox"
                  {...register("ageGroups.elementary")}
                  disabled={!isEditing}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
                <div className="flex-1">
                  <div className="font-bold text-gray-900">Elementary</div>
                  <div className="text-sm text-gray-500">Grades K-5</div>
                </div>
              </label>

              <label className={`flex items-center gap-3 p-4 border-2 rounded-xl transition-all cursor-pointer ${
                isEditing ? "hover:border-blue-300 hover:bg-blue-50" : "cursor-not-allowed"
              }`}>
                <input
                  type="checkbox"
                  {...register("ageGroups.middleSchool")}
                  disabled={!isEditing}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
                <div className="flex-1">
                  <div className="font-bold text-gray-900">Middle School</div>
                  <div className="text-sm text-gray-500">Grades 6-8</div>
                </div>
              </label>

              <label className={`flex items-center gap-3 p-4 border-2 rounded-xl transition-all cursor-pointer ${
                isEditing ? "hover:border-blue-300 hover:bg-blue-50" : "cursor-not-allowed"
              }`}>
                <input
                  type="checkbox"
                  {...register("ageGroups.highSchool")}
                  disabled={!isEditing}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
                <div className="flex-1">
                  <div className="font-bold text-gray-900">High School</div>
                  <div className="text-sm text-gray-500">Grades 9-12</div>
                </div>
              </label>

              <label className={`flex items-center gap-3 p-4 border-2 rounded-xl transition-all cursor-pointer ${
                isEditing ? "hover:border-blue-300 hover:bg-blue-50" : "cursor-not-allowed"
              }`}>
                <input
                  type="checkbox"
                  {...register("ageGroups.college")}
                  disabled={!isEditing}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
                <div className="flex-1">
                  <div className="font-bold text-gray-900">College</div>
                  <div className="text-sm text-gray-500">Undergraduate & Graduate</div>
                </div>
              </label>

              <label className={`flex items-center gap-3 p-4 border-2 rounded-xl transition-all cursor-pointer ${
                isEditing ? "hover:border-blue-300 hover:bg-blue-50" : "cursor-not-allowed"
              }`}>
                <input
                  type="checkbox"
                  {...register("ageGroups.adult")}
                  disabled={!isEditing}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
                <div className="flex-1">
                  <div className="font-bold text-gray-900">Adult Learners</div>
                  <div className="text-sm text-gray-500">Professional development</div>
                </div>
              </label>
            </div>
          </div>

          {/* Education & Experience Section */}
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Award className="w-6 h-6 text-blue-600" />
              Credentials & Experience
            </h2>

            <div className="space-y-6">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">
                  Education
                </label>
                <div className="relative">
                  <GraduationCap className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                  <input
                    {...register("education", { required: "Education is required" })}
                    disabled={!isEditing}
                    placeholder="e.g. Ph.D. in Physics, MIT"
                    className="w-full h-12 pl-12 pr-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 bg-gray-50 transition-all disabled:bg-gray-100 disabled:text-gray-600"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">
                  Professional Experience
                </label>
                <div className="relative">
                  <Briefcase className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                  <input
                    {...register("experience", { required: "Experience is required" })}
                    disabled={!isEditing}
                    placeholder="e.g. 10+ years teaching university level"
                    className="w-full h-12 pl-12 pr-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 bg-gray-50 transition-all disabled:bg-gray-100 disabled:text-gray-600"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Profile Stats (Read-only) */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl shadow-lg p-8 text-white">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Star className="w-6 h-6" />
              Your Performance
            </h2>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-4xl font-black mb-1">4.9</div>
                <div className="text-sm text-blue-100 font-medium">Average Rating</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-black mb-1">124</div>
                <div className="text-sm text-blue-100 font-medium">Total Reviews</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-black mb-1">156</div>
                <div className="text-sm text-blue-100 font-medium">Students Taught</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-black mb-1">98%</div>
                <div className="text-sm text-blue-100 font-medium">Response Rate</div>
              </div>
            </div>
          </div>

          {/* Resource Repository Section */}
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-2">
                  <FileText className="w-6 h-6 text-blue-600" />
                  Resource Repository
                </h2>
                <p className="text-gray-500 text-sm font-medium">
                  Access and share teaching materials with other tutors
                </p>
              </div>
              <Link 
                to="/repository"
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg"
              >
                View Repository
                <ChevronRight className="w-5 h-5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                <div className="text-3xl font-black text-blue-600 mb-1">23</div>
                <div className="text-sm font-bold text-blue-900">Resources Shared</div>
                <div className="text-xs text-blue-600 mt-1">By you</div>
              </div>
              <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                <div className="text-3xl font-black text-green-600 mb-1">456</div>
                <div className="text-sm font-bold text-green-900">Downloads</div>
                <div className="text-xs text-green-600 mt-1">Of your resources</div>
              </div>
              <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
                <div className="text-3xl font-black text-purple-600 mb-1">1,247</div>
                <div className="text-sm font-bold text-purple-900">Available Resources</div>
                <div className="text-xs text-purple-600 mt-1">In the repository</div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          {isEditing && (
            <div className="flex justify-end gap-4 pt-4">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-8 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 px-10 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-xl shadow-blue-200"
              >
                <Save className="w-5 h-5" />
                Save Changes
              </button>
            </div>
          )}
        </form>
      </main>
    </div>
  );
}