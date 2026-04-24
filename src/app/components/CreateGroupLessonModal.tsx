import { useState } from "react"
import { X, Loader2, Users, DollarSign, MapPin } from "lucide-react"
import { toast } from "sonner"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../context/AuthContext"

export interface GroupLesson {
  id:               string
  title:            string
  subject:          string
  description:      string | null
  scheduled_at:     string
  duration_minutes: number
  max_students:     number
  price:            number
  location:         string | null
  status:           'open' | 'cancelled' | 'completed'
  created_at:       string
  enrollment_count?: number
}

interface Props {
  tutorSubjects: string[]
  onCreated:     (lesson: GroupLesson) => void
  onClose:       () => void
}

const DURATIONS = [
  { label: '30 min',  value: 30 },
  { label: '1 hour',  value: 60 },
  { label: '1.5 hrs', value: 90 },
  { label: '2 hours', value: 120 },
]

export function CreateGroupLessonModal({ tutorSubjects, onCreated, onClose }: Props) {
  const { user } = useAuth()
  const [saving, setSaving] = useState(false)

  const [title,    setTitle]    = useState('')
  const [subject,  setSubject]  = useState(tutorSubjects[0] ?? '')
  const [date,     setDate]     = useState('')
  const [time,     setTime]     = useState('10:00')
  const [duration, setDuration] = useState(60)
  const [maxStudents, setMaxStudents] = useState(8)
  const [price,    setPrice]    = useState(0)
  const [desc,     setDesc]     = useState('')
  const [location, setLocation] = useState('')

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault()
    if (!user) return
    if (!title.trim()) { toast.error('Please add a session title.'); return }
    if (!date)         { toast.error('Please select a date.'); return }

    const scheduled_at = new Date(`${date}T${time}:00`).toISOString()
    setSaving(true)

    const { data, error } = await supabase
      .from('group_lessons')
      .insert({
        tutor_id:         user.id,
        title:            title.trim(),
        subject:          subject,
        description:      desc.trim() || null,
        location:         location.trim() || null,
        scheduled_at,
        duration_minutes: duration,
        max_students:     maxStudents,
        price,
        status:           'open',
      })
      .select('*')
      .single()

    if (error || !data) {
      toast.error('Failed to create session: ' + (error?.message ?? 'unknown error'))
    } else {
      toast.success('Group session created!')
      onCreated({ ...data, enrollment_count: 0 })
    }
    setSaving(false)
  }

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-xl font-black text-gray-900">New Group Session</h2>
            <p className="text-sm text-gray-400 font-medium">Let multiple students book the same slot</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex flex-col gap-5 px-6 py-5">

          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Session Title</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. SAT Math Group Study"
              className="w-full h-12 px-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 bg-gray-50"
            />
          </div>

          {/* Subject */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Subject</label>
            {tutorSubjects.length > 1 ? (
              <select
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="w-full h-12 px-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 bg-gray-50"
              >
                {tutorSubjects.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            ) : (
              <input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="w-full h-12 px-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 bg-gray-50"
              />
            )}
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Date</label>
              <input
                type="date"
                min={today}
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full h-12 px-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 bg-gray-50"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Time</label>
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="w-full h-12 px-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 bg-gray-50"
              />
            </div>
          </div>

          {/* Duration */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Duration</label>
            <div className="flex gap-2 flex-wrap">
              {DURATIONS.map(d => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setDuration(d.value)}
                  className={`px-4 py-2 rounded-xl font-bold text-sm border transition-colors ${
                    duration === d.value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-200 text-gray-600 hover:border-blue-400 bg-gray-50'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Max students + Price */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                <Users className="w-3 h-3" /> Max Students
              </label>
              <input
                type="number"
                min={2}
                max={50}
                value={maxStudents}
                onChange={e => setMaxStudents(Math.max(2, Math.min(50, Number(e.target.value))))}
                className="w-full h-12 px-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 bg-gray-50"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                <DollarSign className="w-3 h-3" /> Price / Student
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">$</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={price}
                  onChange={e => setPrice(Math.max(0, Number(e.target.value)))}
                  className="w-full h-12 pl-8 pr-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 bg-gray-50"
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Description <span className="normal-case font-medium">(optional)</span></label>
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="What will students learn? Any prerequisites?"
              rows={3}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-800 bg-gray-50"
            />
          </div>

          {/* Location */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
              <MapPin className="w-3 h-3" /> Location <span className="normal-case font-medium">(optional)</span>
            </label>
            <input
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="e.g. 123 Main St, Seattle, WA — leave blank to use your profile address"
              className="w-full h-12 px-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-800 bg-gray-50"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1 pb-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-12 border-2 border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 h-12 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Creating…' : 'Create Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
