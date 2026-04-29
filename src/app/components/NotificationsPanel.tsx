import { useState, useEffect, useRef } from "react"
import { Bell, CheckCheck, BookOpen, ThumbsUp, ThumbsDown, X } from "lucide-react"
import { useNavigate } from "react-router"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../context/AuthContext"

interface Notif {
  id:         string
  type:       'new_booking' | 'accepted' | 'declined'
  title:      string
  body:       string
  created_at: string
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7)   return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function NotificationsPanel() {
  const { user, role } = useAuth()
  const navigate = useNavigate()
  const panelRef = useRef<HTMLDivElement>(null)

  const [open,    setOpen]    = useState(false)
  const [notifs,  setNotifs]  = useState<Notif[]>([])
  const [loading, setLoading] = useState(false)
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set())

  const storageKey = user ? `notifSeen_${user.id}` : ''

  // Load seen IDs from localStorage on mount
  useEffect(() => {
    if (!storageKey) return
    const stored: string[] = JSON.parse(localStorage.getItem(storageKey) ?? '[]')
    setSeenIds(new Set(stored))
  }, [storageKey])

  // Initial fetch on mount so badge is populated right away
  useEffect(() => {
    if (user) fetchNotifs()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role])

  async function fetchNotifs() {
    if (!user) return
    setLoading(true)

    let fetched: Notif[] = []
    if (role === 'tutor') {
      const { data } = await supabase
        .from('bookings')
        .select('id, student_name, subject, created_at')
        .eq('tutor_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(25)

      fetched = (data ?? []).map((b: any) => ({
        id:         b.id,
        type:       'new_booking' as const,
        title:      'New lesson request',
        body:       `${b.student_name} wants help with ${b.subject}`,
        created_at: b.created_at,
      }))
    } else {
      const { data } = await supabase
        .from('bookings')
        .select('id, subject, status, created_at, tutor:tutor_id(full_name)')
        .eq('student_id', user.id)
        .in('status', ['accepted', 'declined'])
        .order('created_at', { ascending: false })
        .limit(25)

      fetched = (data ?? []).map((b: any) => ({
        id:         b.id,
        type:       b.status as 'accepted' | 'declined',
        title:      b.status === 'accepted' ? 'Lesson accepted!' : 'Lesson declined',
        body:       b.status === 'accepted'
                      ? `${(b.tutor as any)?.full_name ?? 'Your tutor'} confirmed your ${b.subject} session`
                      : `${(b.tutor as any)?.full_name ?? 'Your tutor'} declined your ${b.subject} request`,
        created_at: b.created_at,
      }))
    }

    setNotifs(fetched)
    // Prune IDs that are no longer in the fetch window so localStorage doesn't grow unboundedly
    const activeIds = new Set(fetched.map(n => n.id))
    setSeenIds(prev => {
      const pruned = new Set([...prev].filter(id => activeIds.has(id)))
      if (pruned.size !== prev.size) localStorage.setItem(storageKey, JSON.stringify([...pruned]))
      return pruned
    })
    setLoading(false)
  }

  const unreadCount = notifs.filter(n => !seenIds.has(n.id)).length

  function persistSeen(ids: Set<string>) {
    setSeenIds(ids)
    localStorage.setItem(storageKey, JSON.stringify([...ids]))
  }

  function markAllRead() {
    persistSeen(new Set([...seenIds, ...notifs.map(n => n.id)]))
  }

  function handleClickNotif(n: Notif) {
    persistSeen(new Set([...seenIds, n.id]))
    setOpen(false)
    navigate('/lessons')
  }

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  if (!user) return null

  return (
    <div ref={panelRef} className="relative">
      {/* Bell button */}
      <button
        onClick={() => { setOpen(o => !o); if (!open) fetchNotifs() }}
        className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-0.5">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="font-black text-gray-900 text-sm">Notifications</span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {loading ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">Loading…</div>
            ) : notifs.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400 font-medium">No notifications yet</p>
              </div>
            ) : (
              notifs.map(n => {
                const isUnread = !seenIds.has(n.id)
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClickNotif(n)}
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                      isUnread ? 'bg-blue-50/50' : ''
                    }`}
                  >
                    <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      n.type === 'new_booking' ? 'bg-blue-100 text-blue-600' :
                      n.type === 'accepted'    ? 'bg-green-100 text-green-600' :
                                                 'bg-red-100 text-red-500'
                    }`}>
                      {n.type === 'new_booking' ? <BookOpen  className="w-4 h-4" /> :
                       n.type === 'accepted'    ? <ThumbsUp  className="w-4 h-4" /> :
                                                  <ThumbsDown className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold leading-tight ${isUnread ? 'text-gray-900' : 'text-gray-600'}`}>
                        {n.title}
                      </p>
                      <p className="text-xs text-gray-500 font-medium mt-0.5 leading-snug">{n.body}</p>
                      <p className="text-[10px] text-gray-400 mt-1">{formatRelative(n.created_at)}</p>
                    </div>
                    {isUnread && (
                      <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-2" />
                    )}
                  </button>
                )
              })
            )}
          </div>

          {/* Footer */}
          {notifs.length > 0 && (
            <div className="border-t border-gray-100 px-4 py-2.5">
              <button
                onClick={() => { setOpen(false); navigate('/lessons') }}
                className="w-full text-xs font-bold text-blue-600 hover:text-blue-700 text-center"
              >
                View all in Lessons →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
