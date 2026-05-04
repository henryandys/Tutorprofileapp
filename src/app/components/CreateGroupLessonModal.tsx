import { useState, useMemo } from "react"
import { X, Loader2, Users, DollarSign, MapPin, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../context/AuthContext"

export type RecurrenceType = 'none' | 'weekly' | 'biweekly' | 'monthly'

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
  recurrence_type:  RecurrenceType
  parent_lesson_id: string | null
}

interface Props {
  tutorSubjects: string[]
  lesson?:       GroupLesson          // present → edit mode
  onCreated?:    (lessons: GroupLesson[]) => void
  onUpdated?:    (lessons: GroupLesson[]) => void
  onClose:       () => void
}

const DURATIONS = [
  { label: '30 min',  value: 30 },
  { label: '1 hour',  value: 60 },
  { label: '1.5 hrs', value: 90 },
  { label: '2 hours', value: 120 },
]

const RECURRENCE_OPTIONS: { label: string; value: RecurrenceType }[] = [
  { label: 'No repeat',      value: 'none'     },
  { label: 'Weekly',         value: 'weekly'   },
  { label: 'Every 2 weeks',  value: 'biweekly' },
  { label: 'Monthly',        value: 'monthly'  },
]

function addOccurrence(base: Date, type: RecurrenceType, n: number): Date {
  const d = new Date(base)
  if (type === 'weekly')   d.setDate(d.getDate() + 7 * n)
  if (type === 'biweekly') d.setDate(d.getDate() + 14 * n)
  if (type === 'monthly')  d.setMonth(d.getMonth() + n)
  return d
}

// Parse an ISO string to local YYYY-MM-DD and HH:MM strings
function splitIso(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  const date = [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return { date, time }
}

export function CreateGroupLessonModal({ tutorSubjects, lesson, onCreated, onUpdated, onClose }: Props) {
  const { user } = useAuth()
  const [saving, setSaving] = useState(false)

  const isEdit       = !!lesson
  const isRecurringSeries = isEdit && lesson!.recurrence_type && lesson!.recurrence_type !== 'none'
  const initDt       = lesson ? splitIso(lesson.scheduled_at) : { date: '', time: '10:00' }

  const [title,       setTitle]       = useState(lesson?.title       ?? '')
  const [subject,     setSubject]     = useState(lesson?.subject     ?? tutorSubjects[0] ?? '')
  const [date,        setDate]        = useState(initDt.date)
  const [time,        setTime]        = useState(initDt.time)
  const [duration,    setDuration]    = useState(lesson?.duration_minutes ?? 60)
  const [maxStudents, setMaxStudents] = useState(lesson?.max_students    ?? 8)
  const [price,       setPrice]       = useState(lesson?.price           ?? 0)
  const [desc,        setDesc]        = useState(lesson?.description     ?? '')
  const [location,    setLocation]    = useState(lesson?.location        ?? '')
  const [recurrence,  setRecurrence]  = useState<RecurrenceType>(isEdit ? 'none' : 'none')
  const [occurrences, setOccurrences] = useState(8)
  const [editScope,   setEditScope]   = useState<'this' | 'future'>('this')

  const previewDates = useMemo(() => {
    if (recurrence === 'none' || !date) return []
    const base = new Date(`${date}T${time}:00`)
    return Array.from({ length: occurrences }, (_, i) =>
      (i === 0 ? base : addOccurrence(base, recurrence, i))
        .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    )
  }, [recurrence, date, time, occurrences])

  async function handleCreate() {
    if (!user) return
    if (!title.trim()) { toast.error('Please add a session title.'); return }
    if (!date)         { toast.error('Please select a date.'); return }

    setSaving(true)
    const base = new Date(`${date}T${time}:00`)

    const { data: parent, error: parentError } = await supabase
      .from('group_lessons')
      .insert({
        tutor_id:         user.id,
        title:            title.trim(),
        subject,
        description:      desc.trim() || null,
        location:         location.trim() || null,
        scheduled_at:     base.toISOString(),
        duration_minutes: duration,
        max_students:     maxStudents,
        price,
        status:           'open',
        recurrence_type:  recurrence,
        parent_lesson_id: null,
      })
      .select('*')
      .single()

    if (parentError || !parent) {
      toast.error('Failed to create session: ' + (parentError?.message ?? 'unknown error'))
      setSaving(false)
      return
    }

    const allCreated: GroupLesson[] = [{ ...parent, enrollment_count: 0 }]

    if (recurrence !== 'none' && occurrences > 1) {
      const childRows = Array.from({ length: occurrences - 1 }, (_, i) => ({
        tutor_id:         user.id,
        title:            title.trim(),
        subject,
        description:      desc.trim() || null,
        location:         location.trim() || null,
        scheduled_at:     addOccurrence(base, recurrence, i + 1).toISOString(),
        duration_minutes: duration,
        max_students:     maxStudents,
        price,
        status:           'open',
        recurrence_type:  recurrence,
        parent_lesson_id: parent.id,
      }))

      const { data: children, error: childError } = await supabase
        .from('group_lessons')
        .insert(childRows)
        .select('*')

      if (childError) {
        toast.error('Series partially created — some sessions failed: ' + childError.message)
      } else {
        allCreated.push(...(children ?? []).map((c: any) => ({ ...c, enrollment_count: 0 })))
      }
      toast.success(`${allCreated.length} session${allCreated.length !== 1 ? 's' : ''} created!`)
    } else {
      toast.success('Group session created!')
    }

    onCreated?.(allCreated)
    setSaving(false)
  }

  async function handleEdit() {
    if (!user || !lesson) return
    if (!title.trim()) { toast.error('Please add a session title.'); return }
    if (!date)         { toast.error('Please select a date.'); return }

    setSaving(true)

    // Fields that apply to every session in the series when editing "all future"
    const sharedFields = {
      title:            title.trim(),
      subject,
      description:      desc.trim() || null,
      location:         location.trim() || null,
      duration_minutes: duration,
      max_students:     maxStudents,
      price,
    }
    // This session also gets its date/time updated
    const thisFields = {
      ...sharedFields,
      scheduled_at: new Date(`${date}T${time}:00`).toISOString(),
    }

    // Update this session
    const { data: thisData, error: thisErr } = await supabase
      .from('group_lessons')
      .update(thisFields)
      .eq('id', lesson.id)
      .eq('tutor_id', user.id)
      .select('*')
      .single()

    if (thisErr) {
      toast.error('Failed to update session.')
      setSaving(false)
      return
    }

    const updatedLessons: GroupLesson[] = [{ ...thisData, enrollment_count: lesson.enrollment_count }]

    // If "this & all future", also update content fields on sibling/child sessions
    if (isRecurringSeries && editScope === 'future') {
      const parentId = lesson.parent_lesson_id ?? lesson.id
      const { data: futureData, error: futureErr } = await supabase
        .from('group_lessons')
        .update(sharedFields)
        .or(`id.eq.${parentId},parent_lesson_id.eq.${parentId}`)
        .neq('id', lesson.id)
        .gte('scheduled_at', lesson.scheduled_at)
        .eq('tutor_id', user.id)
        .select('*')

      if (futureErr) {
        toast.error('Some sessions could not be updated.')
      } else {
        updatedLessons.push(
          ...(futureData ?? []).map((g: any) => ({ ...g, enrollment_count: g.enrollment_count ?? 0 }))
        )
      }
      toast.success(`Updated ${updatedLessons.length} session${updatedLessons.length !== 1 ? 's' : ''}!`)
    } else {
      toast.success('Session updated!')
    }

    onUpdated?.(updatedLessons)
    setSaving(false)
    onClose()
  }

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault()
    if (isEdit) {
      await handleEdit()
    } else {
      await handleCreate()
    }
  }

  const today = new Date().toISOString().split('T')[0]

  // Ensure the session's existing subject is always an option in the selector
  const subjectOptions = lesson && !tutorSubjects.includes(lesson.subject)
    ? [lesson.subject, ...tutorSubjects]
    : tutorSubjects

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-xl font-black text-gray-900">
              {isEdit ? 'Edit Group Session' : 'New Group Session'}
            </h2>
            <p className="text-sm text-gray-400 font-medium">
              {isEdit ? 'Update the details for this session' : 'Let multiple students book the same slot'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex flex-col gap-5 px-6 py-5">

          {/* Edit scope selector — recurring series only */}
          {isEdit && isRecurringSeries && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Apply changes to</label>
              <div className="flex gap-2">
                {([
                  { value: 'this',   label: 'This session only' },
                  { value: 'future', label: 'This & all future sessions' },
                ] as const).map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setEditScope(opt.value)}
                    className={`flex-1 py-2 px-3 rounded-xl font-bold text-sm border transition-colors ${
                      editScope === opt.value
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'border-gray-200 text-gray-600 hover:border-purple-400 bg-gray-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {editScope === 'future' && (
                <p className="text-xs text-gray-400 font-medium">
                  Date &amp; time changes apply to this session only. Title, subject, and other details update across all future sessions.
                </p>
              )}
            </div>
          )}

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
            {subjectOptions.length > 1 ? (
              <select
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="w-full h-12 px-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 bg-gray-50"
              >
                {subjectOptions.map(s => <option key={s} value={s}>{s}</option>)}
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
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                {isEdit ? 'Date' : 'First Date'}
              </label>
              <input
                type="date"
                min={isEdit ? undefined : today}
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

          {/* Recurrence — create mode only */}
          {!isEdit && (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> Repeat
              </label>
              <div className="flex gap-2 flex-wrap">
                {RECURRENCE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRecurrence(opt.value)}
                    className={`px-3 py-2 rounded-xl font-bold text-sm border transition-colors ${
                      recurrence === opt.value
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'border-gray-200 text-gray-600 hover:border-purple-400 bg-gray-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {recurrence !== 'none' && (
                <div className="flex items-center gap-3 mt-1">
                  <label className="text-xs font-bold text-gray-500 whitespace-nowrap">Number of sessions</label>
                  <input
                    type="number"
                    min={2}
                    max={52}
                    value={occurrences}
                    onChange={e => setOccurrences(Math.max(2, Math.min(52, Number(e.target.value))))}
                    className="w-20 h-9 px-3 border border-gray-200 rounded-lg text-sm font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-gray-50"
                  />
                </div>
              )}

              {previewDates.length > 0 && (
                <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 flex flex-col gap-1 max-h-36 overflow-y-auto">
                  <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-1">Schedule Preview</p>
                  {previewDates.map((d, i) => (
                    <span key={i} className="text-xs font-medium text-purple-700 flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-purple-200 text-purple-700 flex items-center justify-center text-[9px] font-black shrink-0">{i + 1}</span>
                      {d}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

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
              {isEdit
                ? (saving ? 'Saving…' : 'Save Changes')
                : (saving ? 'Creating…' : recurrence !== 'none' ? `Create ${occurrences} Sessions` : 'Create Session')
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
