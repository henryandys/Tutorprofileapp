import { useState, useEffect, useRef } from "react";
import { Navbar } from "../components/Navbar";
import { Search, Plus, Download, Book, GraduationCap, Filter, FileText, Star, X, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";

type Visibility = 'public' | 'accepted_only' | 'specific'

interface Resource {
  id:                  string
  tutor_id:            string
  tutor_name:          string
  title:               string
  subject:             string
  grade_level:         string
  school:              string
  description:         string
  file_url:            string
  file_name:           string
  file_type:           string
  downloads:           number
  created_at:          string
  visibility:          Visibility
  allowed_student_ids: string[]
}

const GRADE_OPTIONS = ['K–5', '6–8', '9–12', 'College', 'All Levels']

// Maps allowed MIME types to a safe file extension used for storage paths.
// Any file whose MIME type is not in this map is rejected before upload.
const ALLOWED_MIME_TYPES: Record<string, string> = {
  'application/pdf':                                                          'pdf',
  'application/msword':                                                       'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':  'docx',
  'application/vnd.ms-powerpoint':                                            'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':'pptx',
  'application/vnd.ms-excel':                                                 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':        'xlsx',
}

function fileTypeLabel(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf') return 'PDF'
  if (['doc', 'docx'].includes(ext)) return 'Doc'
  if (['ppt', 'pptx'].includes(ext)) return 'Slides'
  if (['xls', 'xlsx'].includes(ext)) return 'Sheet'
  return ext.toUpperCase() || 'File'
}

function typeBadgeClass(type: string) {
  if (type === 'PDF')    return 'bg-red-50 text-red-600'
  if (type === 'Doc')    return 'bg-blue-50 text-blue-600'
  if (type === 'Slides') return 'bg-orange-50 text-orange-600'
  if (type === 'Sheet')  return 'bg-green-50 text-green-600'
  return 'bg-gray-50 text-gray-600'
}

export function Repository() {
  const { user, profile, role } = useAuth()
  const isTutor = role === 'tutor'

  const [resources, setResources]   = useState<Resource[]>([])
  const [loading, setLoading]       = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [gradeFilter, setGradeFilter] = useState('')

  // Upload modal state
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [uploading, setUploading]       = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [formTitle, setFormTitle]         = useState('')
  const [formSubject, setFormSubject]     = useState('')
  const [formGrade, setFormGrade]         = useState('')
  const [formSchool, setFormSchool]       = useState('')
  const [formDesc, setFormDesc]           = useState('')
  const [formVisibility, setFormVisibility] = useState<Visibility>('public')
  const [formAllowedIds, setFormAllowedIds] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Accepted students (for tutors choosing "specific" visibility)
  const [acceptedStudents, setAcceptedStudents] = useState<{ id: string; name: string }[]>([])
  useEffect(() => {
    if (!user || !isTutor) return
    supabase
      .from('bookings')
      .select('student_id, student_name')
      .eq('tutor_id', user.id)
      .eq('status', 'accepted')
      .then(({ data }) => {
        const seen = new Set<string>()
        const unique = (data ?? []).filter(b => {
          if (seen.has(b.student_id)) return false
          seen.add(b.student_id)
          return true
        })
        setAcceptedStudents(unique.map(b => ({ id: b.student_id, name: b.student_name })))
      })
  }, [user, isTutor])

  // Tutor IDs the current student has an accepted booking with (for filtering)
  const [acceptedTutorIds, setAcceptedTutorIds] = useState<string[]>([])
  useEffect(() => {
    if (!user || isTutor) return
    supabase
      .from('bookings')
      .select('tutor_id')
      .eq('student_id', user.id)
      .eq('status', 'accepted')
      .then(({ data }) => setAcceptedTutorIds((data ?? []).map(b => b.tutor_id)))
  }, [user, isTutor])

  useEffect(() => {
    supabase
      .from('resources')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error('Failed to load resources.')
        setResources(data ?? [])
        setLoading(false)
      })
  }, [])

  const filtered = resources.filter(r => {
    // Visibility gate
    const isOwn = user && r.tutor_id === user.id
    if (!isOwn) {
      if (r.visibility === 'accepted_only' && !acceptedTutorIds.includes(r.tutor_id)) return false
      if (r.visibility === 'specific' && (!user || !r.allowed_student_ids.includes(user.id))) return false
    }
    // Search / grade filters
    const q = searchQuery.toLowerCase()
    const matchesQuery = !q || r.title.toLowerCase().includes(q) ||
      r.subject.toLowerCase().includes(q) ||
      r.school.toLowerCase().includes(q) ||
      r.tutor_name.toLowerCase().includes(q)
    const matchesGrade = !gradeFilter || r.grade_level === gradeFilter
    return matchesQuery && matchesGrade
  })

  async function handleDownload(resource: Resource) {
    window.open(resource.file_url, '_blank')
    await supabase
      .from('resources')
      .update({ downloads: resource.downloads + 1 })
      .eq('id', resource.id)
    setResources(prev => prev.map(r =>
      r.id === resource.id ? { ...r, downloads: r.downloads + 1 } : r
    ))
  }

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!user || !selectedFile) { toast.error('Please select a file.'); return }
    if (!formTitle.trim() || !formSubject.trim() || !formGrade) {
      toast.error('Please fill in all required fields.')
      return
    }

    const safeExt = ALLOWED_MIME_TYPES[selectedFile.type]
    if (!safeExt) {
      toast.error('File type not allowed. Please upload a PDF, Word, PowerPoint, or Excel file.')
      return
    }

    setUploading(true)

    const path = `${user.id}/${Date.now()}.${safeExt}`

    const { error: storageError } = await supabase.storage
      .from('resources')
      .upload(path, selectedFile, { upsert: false })

    if (storageError) {
      toast.error('Upload failed: ' + storageError.message)
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('resources')
      .getPublicUrl(path)

    const { data: inserted, error: insertError } = await supabase
      .from('resources')
      .insert({
        tutor_id:    user.id,
        tutor_name:  profile?.full_name ?? 'Unknown',
        title:       formTitle.trim(),
        subject:     formSubject.trim(),
        grade_level: formGrade,
        school:      formSchool.trim(),
        description: formDesc.trim(),
        file_url:            publicUrl,
        file_name:           selectedFile.name,
        file_type:           fileTypeLabel(selectedFile.name),
        visibility:          formVisibility,
        allowed_student_ids: formVisibility === 'specific' ? formAllowedIds : [],
      })
      .select()
      .single()

    if (insertError) {
      toast.error('Failed to save resource: ' + insertError.message)
      setUploading(false)
      return
    }

    setResources(prev => [inserted, ...prev])
    toast.success('Resource published!')
    setIsUploadOpen(false)
    setSelectedFile(null)
    setFormTitle(''); setFormSubject(''); setFormGrade('')
    setFormSchool(''); setFormDesc('')
    setFormVisibility('public'); setFormAllowedIds([])
    setUploading(false)
  }

  function openModal() {
    if (!isTutor) { toast.error('Only tutors can upload resources.'); return }
    setIsUploadOpen(true)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 md:px-8 py-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight mb-2">Resource Repository</h1>
            <p className="text-gray-500 font-medium">Shared teaching materials, uploaded by tutors.</p>
          </div>
          {isTutor && (
            <button
              onClick={openModal}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 shrink-0"
            >
              <Plus className="w-5 h-5" />
              Upload Resource
            </button>
          )}
        </div>

        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col lg:flex-row gap-4 mb-8">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by subject, title, tutor, or school…"
              className="w-full h-12 pl-12 pr-4 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-800"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
            <select
              value={gradeFilter}
              onChange={e => setGradeFilter(e.target.value)}
              className="h-12 pl-9 pr-8 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none font-bold text-gray-600 appearance-none cursor-pointer"
            >
              <option value="">All Grade Levels</option>
              {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-1">No resources found</h3>
            <p className="text-gray-500 font-medium">
              {resources.length === 0 ? 'No resources have been uploaded yet.' : 'Try adjusting your search or filters.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map(resource => {
              const typeLabel = resource.file_type || fileTypeLabel(resource.file_name)
              return (
                <div key={resource.id} className="group bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col">
                  <div className="p-6 flex-1">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`p-2 rounded-lg ${typeBadgeClass(typeLabel)}`}>
                        <FileText className="w-6 h-6" />
                      </div>
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${typeBadgeClass(typeLabel)}`}>
                        {typeLabel}
                      </span>
                    </div>

                    <h3 className="font-black text-gray-900 mb-3 line-clamp-2 leading-tight group-hover:text-blue-600 transition-colors">
                      {resource.title}
                    </h3>

                    {resource.description && (
                      <p className="text-xs text-gray-500 font-medium mb-3 line-clamp-2">{resource.description}</p>
                    )}

                    <div className="space-y-1.5 mb-4">
                      <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                        <Book className="w-3.5 h-3.5 shrink-0" />
                        {resource.subject}
                      </div>
                      <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                        <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                        {resource.grade_level}
                      </div>
                      {resource.school && (
                        <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                          <Star className="w-3.5 h-3.5 shrink-0" />
                          {resource.school}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                      <div className="text-[10px] text-gray-400 uppercase tracking-widest font-bold truncate max-w-[65%]">
                        {resource.tutor_name}
                      </div>
                      <div className="text-[10px] text-gray-400 font-bold shrink-0">
                        {resource.downloads} DLs
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDownload(resource)}
                    className="w-full py-3 bg-gray-50 text-gray-600 font-bold text-sm flex items-center justify-center gap-2 group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0"
                  >
                    <Download className="w-4 h-4" />
                    Download {typeLabel}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Upload Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-8 overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-black text-gray-900">Upload Resource</h2>
                  <p className="text-gray-500 font-medium text-sm mt-1">Share your materials with the community.</p>
                  <p className="text-gray-500 font-medium text-sm mt-1">Note:  Do not upload any 3rd party documents without permission.  You are liable for any actions by the 3rd party.</p>
                </div>
                <button
                  onClick={() => setIsUploadOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUpload} className="space-y-5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Title *</label>
                  <input
                    required
                    value={formTitle}
                    onChange={e => setFormTitle(e.target.value)}
                    placeholder="e.g. AP Calculus — Integration Cheat Sheet"
                    className="w-full h-12 px-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 bg-gray-50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Subject *</label>
                    <input
                      required
                      value={formSubject}
                      onChange={e => setFormSubject(e.target.value)}
                      placeholder="Mathematics"
                      className="w-full h-12 px-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 bg-gray-50"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Grade Level *</label>
                    <select
                      required
                      value={formGrade}
                      onChange={e => setFormGrade(e.target.value)}
                      className="w-full h-12 px-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 bg-gray-50"
                    >
                      <option value="">Select…</option>
                      {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">School (optional)</label>
                  <input
                    value={formSchool}
                    onChange={e => setFormSchool(e.target.value)}
                    placeholder="e.g. Garfield High School"
                    className="w-full h-12 px-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 bg-gray-50"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Description (optional)</label>
                  <textarea
                    value={formDesc}
                    onChange={e => setFormDesc(e.target.value)}
                    rows={2}
                    placeholder="Briefly describe what this resource covers…"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-800 bg-gray-50"
                  />
                </div>

                {/* Visibility */}
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Who can see this?</label>
                  <div className="flex flex-col gap-2 mt-2">
                    {(['public', 'accepted_only', 'specific'] as Visibility[]).map(v => (
                      <label key={v} className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="visibility"
                          value={v}
                          checked={formVisibility === v}
                          onChange={() => { setFormVisibility(v); setFormAllowedIds([]) }}
                          className="accent-blue-600"
                        />
                        <span className="font-medium text-gray-700 text-sm">
                          {v === 'public'       && 'Everyone'}
                          {v === 'accepted_only' && 'Only students I\'ve accepted'}
                          {v === 'specific'      && 'Specific students only'}
                        </span>
                      </label>
                    ))}
                  </div>
                  {formVisibility === 'specific' && (
                    <div className="mt-3 border border-gray-200 rounded-xl p-3 bg-gray-50">
                      {acceptedStudents.length === 0 ? (
                        <p className="text-xs text-gray-400 font-medium">No accepted students yet.</p>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {acceptedStudents.map(s => (
                            <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={formAllowedIds.includes(s.id)}
                                onChange={e => setFormAllowedIds(prev =>
                                  e.target.checked ? [...prev, s.id] : prev.filter(id => id !== s.id)
                                )}
                                className="accent-blue-600"
                              />
                              <span className="text-sm font-medium text-gray-700">{s.name}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* File picker */}
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0] ?? null
                      if (file && !ALLOWED_MIME_TYPES[file.type]) {
                        toast.error('File type not allowed. Please upload a PDF, Word, PowerPoint, or Excel file.')
                        e.target.value = ''
                        return
                      }
                      setSelectedFile(file)
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={`w-full border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center transition-colors ${
                      selectedFile
                        ? 'border-blue-400 bg-blue-50'
                        : 'border-gray-200 bg-gray-50 hover:border-blue-400'
                    }`}
                  >
                    {selectedFile ? (
                      <>
                        <FileText className="w-8 h-8 text-blue-600 mb-2" />
                        <p className="text-sm font-bold text-blue-700">{selectedFile.name}</p>
                        <p className="text-xs text-blue-500 font-medium mt-0.5">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB — click to change
                        </p>
                      </>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-gray-400 mb-2" />
                        <p className="text-sm font-bold text-gray-600">Click to select a file</p>
                        <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase tracking-widest">
                          PDF, DOC, DOCX, PPT, PPTX, XLS — up to 50 MB
                        </p>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsUploadOpen(false)}
                    className="flex-1 py-3 text-gray-600 font-bold rounded-xl hover:bg-gray-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploading || !selectedFile}
                    className="flex-[2] py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {uploading ? 'Uploading…' : 'Publish Resource'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
