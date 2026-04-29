import { useState, useEffect, useRef } from "react";
import { X, Send, Loader2, MoreVertical, Ban, MessageCircleOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { sendNotificationEmail } from "../../lib/notify";

interface Message {
  id:         string
  booking_id: string
  sender_id:  string
  body:       string
  created_at: string
}

interface Props {
  bookingId:   string
  otherName:   string
  otherUserId: string
  subject:     string
  onClose:     () => void
}

export function ConversationModal({ bookingId, otherName, otherUserId, subject, onClose }: Props) {
  const { user } = useAuth()
  const [messages, setMessages]   = useState<Message[]>([])
  const [loading, setLoading]     = useState(true)
  const [body, setBody]           = useState('')
  const [sending, setSending]     = useState(false)
  const bottomRef                 = useRef<HTMLDivElement>(null)

  // Block state
  const [blocked, setBlocked]         = useState(false)
  const [blockedByThem, setBlockedByThem] = useState(false)
  const [blockLoading, setBlockLoading] = useState(false)
  const [menuOpen, setMenuOpen]       = useState(false)
  const menuRef                       = useRef<HTMLDivElement>(null)
  // Refs so the realtime callback always reads current block state without
  // needing to be in the subscription's dep array (which would tear down the channel).
  const blockedRef       = useRef(false)
  const blockedByThemRef = useRef(false)

  // Load existing messages
  useEffect(() => {
    supabase
      .from('messages')
      .select('*')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setMessages(data ?? [])
        setLoading(false)
      })
  }, [bookingId])

  // Check block status (both directions)
  useEffect(() => {
    if (!user) return
    supabase
      .from('blocked_users')
      .select('blocker_id')
      .or(`and(blocker_id.eq.${user.id},blocked_id.eq.${otherUserId}),and(blocker_id.eq.${otherUserId},blocked_id.eq.${user.id})`)
      .then(({ data }) => {
        const rows = data ?? []
        const b  = rows.some(r => r.blocker_id === user.id)
        const bt = rows.some(r => r.blocker_id === otherUserId)
        blockedRef.current       = b
        blockedByThemRef.current = bt
        setBlocked(b)
        setBlockedByThem(bt)
      })
  }, [user, otherUserId])

  // Realtime subscription — channel is stable for the lifetime of bookingId.
  // Block state is read via refs so changes never cause a teardown/gap.
  useEffect(() => {
    const channel = supabase
      .channel(`messages-${bookingId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `booking_id=eq.${bookingId}` },
        payload => {
          const msg = payload.new as Message
          if (msg.sender_id === otherUserId && (blockedRef.current || blockedByThemRef.current)) return
          setMessages(prev => [...prev, msg])
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [bookingId, otherUserId])

  // Auto-scroll to newest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Close menu on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function handleBlock() {
    if (!user) return
    setBlockLoading(true)
    setMenuOpen(false)
    const { error } = await supabase.from('blocked_users').insert({
      blocker_id: user.id,
      blocked_id: otherUserId,
    })
    if (error) {
      toast.error('Could not block user: ' + error.message)
    } else {
      blockedRef.current = true
      setBlocked(true)
      toast.success(`${otherName} has been blocked.`)
    }
    setBlockLoading(false)
  }

  async function handleUnblock() {
    if (!user) return
    setBlockLoading(true)
    setMenuOpen(false)
    const { error } = await supabase
      .from('blocked_users')
      .delete()
      .eq('blocker_id', user.id)
      .eq('blocked_id', otherUserId)
    if (error) {
      toast.error('Could not unblock user: ' + error.message)
    } else {
      blockedRef.current = false
      setBlocked(false)
      toast.success(`${otherName} has been unblocked.`)
    }
    setBlockLoading(false)
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim() || !user) return
    setSending(true)
    const { error } = await supabase.from('messages').insert({
      booking_id: bookingId,
      sender_id:  user.id,
      body:       body.trim(),
    })
    if (error) {
      toast.error('Failed to send: ' + error.message)
    } else {
      setBody('')
      sendNotificationEmail({
        type:        'new_message',
        recipientId: otherUserId,
        data:        { senderName: user.email ?? 'Someone', subject },
      })
    }
    setSending(false)
  }

  const canSend = !blocked && !blockedByThem

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden" style={{ height: '72vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="font-black text-gray-900">{otherName}</h3>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{subject}</p>
          </div>
          <div className="flex items-center gap-1">
            {/* More menu */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(o => !o)}
                disabled={blockLoading}
                className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors"
                aria-label="More options"
              >
                {blockLoading
                  ? <Loader2 className="w-5 h-5 animate-spin" />
                  : <MoreVertical className="w-5 h-5" />}
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden z-10">
                  {blocked ? (
                    <button
                      onClick={handleUnblock}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <MessageCircleOff className="w-4 h-4 text-gray-400" />
                      Unblock {otherName}
                    </button>
                  ) : (
                    <button
                      onClick={handleBlock}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Ban className="w-4 h-4" />
                      Block {otherName}
                    </button>
                  )}
                </div>
              )}
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Block banners */}
        {blocked && (
          <div className="flex items-center justify-between px-6 py-3 bg-red-50 border-b border-red-100 shrink-0">
            <div className="flex items-center gap-2 text-sm text-red-700 font-semibold">
              <Ban className="w-4 h-4" />
              You've blocked {otherName}. They can't send you messages.
            </div>
            <button
              onClick={handleUnblock}
              className="text-xs font-bold text-red-600 hover:text-red-800 underline underline-offset-2"
            >
              Unblock
            </button>
          </div>
        )}
        {!blocked && blockedByThem && (
          <div className="flex items-center gap-2 px-6 py-3 bg-gray-50 border-b border-gray-100 shrink-0">
            <MessageCircleOff className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500 font-medium">You can't reply to this conversation.</span>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-2">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : messages.length === 0 ? (
            <p className="text-center text-gray-400 font-medium text-sm py-10">
              No messages yet — say hello!
            </p>
          ) : (
            messages.map(msg => {
              const isMine = msg.sender_id === user?.id
              const isFromBlockedUser = msg.sender_id === otherUserId && blocked
              if (isFromBlockedUser) return null
              return (
                <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm font-medium leading-relaxed ${
                    isMine
                      ? 'bg-blue-600 text-white rounded-br-sm'
                      : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                  }`}>
                    {msg.body}
                    <div className={`text-[10px] mt-1 ${isMine ? 'text-blue-200' : 'text-gray-400'}`}>
                      {new Date(msg.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              )
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        {canSend ? (
          <form onSubmit={handleSend} className="px-6 py-4 border-t border-gray-100 flex gap-3 shrink-0">
            <input
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Type a message…"
              className="flex-1 h-11 px-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-800 bg-gray-50 text-sm"
            />
            <button
              type="submit"
              disabled={sending || !body.trim()}
              className="h-11 w-11 flex items-center justify-center bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors shrink-0"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </form>
        ) : (
          <div className="px-6 py-4 border-t border-gray-100 shrink-0">
            <p className="text-center text-sm text-gray-400 font-medium">Messaging is disabled for this conversation.</p>
          </div>
        )}
      </div>
    </div>
  )
}
