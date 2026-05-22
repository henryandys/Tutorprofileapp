import { useState, useEffect } from 'react'
import { Link2, Check, Send, Users, Loader2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { sendNotificationEmail } from '../../lib/notify'
import { toast } from 'sonner'

interface Props {
  variant?: 'tutor' | 'student'
}

export function InviteCard({ variant = 'student' }: Props) {
  const { user, profile } = useAuth()
  const [copied,        setCopied]        = useState(false)
  const [inviteEmail,   setInviteEmail]   = useState('')
  const [sending,       setSending]       = useState(false)
  const [referralCount, setReferralCount] = useState<number | null>(null)

  const inviteUrl = `${window.location.origin}/login?ref=${user?.id ?? ''}`

  useEffect(() => {
    if (!user) return
    supabase
      .from('referrals')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_id', user.id)
      .then(({ count }) => setReferralCount(count ?? 0))
  }, [user])

  function handleCopy() {
    navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleSendInvite() {
    if (!inviteEmail.trim() || !user || !profile) return
    setSending(true)

    // Record the pending referral
    await supabase.from('referrals').insert({
      referrer_id:    user.id,
      referred_email: inviteEmail.trim(),
      status:         'pending',
    })

    // Send the invite email
    sendNotificationEmail({
      type: 'referral_invite',
      data: {
        referrerName:   profile.full_name,
        inviteUrl,
        recipientEmail: inviteEmail.trim(),
      },
    })

    setInviteEmail('')
    setSending(false)
    setReferralCount(c => (c ?? 0) + 1)
    toast.success(`Invite sent to ${inviteEmail.trim()}!`)
  }

  const heading = variant === 'tutor'
    ? 'Invite Students'
    : 'Invite a Friend'
  const subtext = variant === 'tutor'
    ? 'Share your link and grow your student roster.'
    : 'Know someone who needs a tutor? Send them your link.'

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
        <Users className="w-4 h-4 text-blue-600" />
        <h2 className="font-black text-gray-900 text-sm">{heading}</h2>
        {referralCount !== null && referralCount > 0 && (
          <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full ml-auto">
            {referralCount} invited
          </span>
        )}
      </div>

      <div className="px-5 py-4 space-y-3">
        <p className="text-xs text-gray-500 font-medium">{subtext}</p>

        {/* Copy link */}
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <p className="text-xs text-gray-500 font-mono truncate">{inviteUrl}</p>
          </div>
          <button
            onClick={handleCopy}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors shrink-0 ${
              copied
                ? 'bg-green-100 text-green-700'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {copied
              ? <><Check className="w-3.5 h-3.5" />Copied!</>
              : <><Link2 className="w-3.5 h-3.5" />Copy</>
            }
          </button>
        </div>

        {/* Email invite */}
        <div className="flex items-center gap-2">
          <input
            type="email"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSendInvite()}
            placeholder="friend@example.com"
            className="flex-1 min-w-0 px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            onClick={handleSendInvite}
            disabled={sending || !inviteEmail.trim()}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50 shrink-0"
          >
            {sending
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Send className="w-3.5 h-3.5" />
            }
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
