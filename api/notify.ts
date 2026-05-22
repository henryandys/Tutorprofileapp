import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// Verify the caller is an authenticated Supabase user
async function getCallerUserId(req: VercelRequest): Promise<string | null> {
  const auth = req.headers['authorization']
  if (!auth?.startsWith('Bearer ')) return null
  const token = auth.slice(7)
  const client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!)
  const { data, error } = await client.auth.getUser(token)
  if (error || !data?.user) return null
  return data.user.id
}

function h(str: unknown): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

const EMAIL_TEMPLATES: Record<string, (d: any) => { subject: string; html: string }> = {
  new_booking: (d) => ({
    subject: `New lesson request from ${h(d.studentName)}`,
    html: `<p>Hi ${h(d.tutorName)},</p>
           <p><strong>${h(d.studentName)}</strong> sent you a lesson request for <strong>${h(d.subject)}</strong>.</p>
           ${d.message ? `<blockquote style="border-left:3px solid #2563eb;padding-left:12px;color:#555">${h(d.message)}</blockquote>` : ''}
           <p><a href="${h(d.appUrl)}/my-profile">Review the request →</a></p>`,
  }),
  booking_accepted: (d) => ({
    subject: `Your lesson request was accepted!`,
    html: `<p>Hi ${h(d.studentName)},</p>
           <p>Your lesson request for <strong>${h(d.subject)}</strong> with <strong>${h(d.tutorName)}</strong> has been <strong style="color:#16a34a">accepted</strong>.</p>
           <p>You can now message your instructor. <a href="${h(d.appUrl)}/profile">View your requests →</a></p>`,
  }),
  booking_declined: (d) => ({
    subject: `Update on your lesson request`,
    html: `<p>Hi ${h(d.studentName)},</p>
           <p>Your lesson request for <strong>${h(d.subject)}</strong> with <strong>${h(d.tutorName)}</strong> was declined.</p>
           <p><a href="${h(d.appUrl)}/search">Find another instructor →</a></p>`,
  }),
  new_message: (d) => ({
    subject: `New message from ${h(d.senderName)}`,
    html: `<p>You have a new message from <strong>${h(d.senderName)}</strong> about <strong>${h(d.subject)}</strong>.</p>
           <p><a href="${h(d.appUrl)}/profile">View your messages →</a></p>`,
  }),
  waitlist_spot_open: (d) => ({
    subject: `A spot opened in "${h(d.sessionTitle)}"!`,
    html: `<p>Good news! A spot has opened in <strong>${h(d.sessionTitle)}</strong> (${h(d.subject)}) with <strong>${h(d.tutorName)}</strong>.</p>
           <p>You're next on the waitlist — head back to enroll before it fills up.</p>
           <p><a href="${h(d.appUrl)}/lessons">Go to My Lessons →</a></p>`,
  }),
  reschedule_requested: (d) => ({
    subject: `${h(d.requesterName)} wants to reschedule your lesson`,
    html: `<p>${h(d.requesterName)} has requested to reschedule your <strong>${h(d.subject)}</strong> lesson to <strong>${h(d.proposedAt)}</strong>.</p>
           <p><a href="${h(d.appUrl)}/lessons">Review the request →</a></p>`,
  }),
  reschedule_accepted: (d) => ({
    subject: `Your reschedule request was approved`,
    html: `<p>${h(d.responderName)} approved your request to reschedule the <strong>${h(d.subject)}</strong> lesson.</p>
           <p><a href="${h(d.appUrl)}/lessons">View your lessons →</a></p>`,
  }),
  reschedule_declined: (d) => ({
    subject: `Your reschedule request was declined`,
    html: `<p>${h(d.responderName)} declined your request to reschedule the <strong>${h(d.subject)}</strong> lesson.</p>
           <p><a href="${h(d.appUrl)}/lessons">View your lessons →</a></p>`,
  }),
  referral_invite: (d) => ({
    subject: `${h(d.referrerName)} invited you to join InstructorFinder`,
    html: `<p>Hi there!</p>
           <p><strong>${h(d.referrerName)}</strong> thinks you'd love <strong>InstructorFinder</strong> — a platform to find and book tutors and instructors in your area.</p>
           <p>Create your free account using the link below:</p>
           <p style="margin:24px 0">
             <a href="${h(d.inviteUrl)}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block">
               Accept invite &amp; sign up →
             </a>
           </p>
           <p style="color:#9ca3af;font-size:12px">This invitation was sent by a member of InstructorFinder. If you didn't expect this, you can safely ignore it.</p>`,
  }),
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const callerId = await getCallerUserId(req)
  if (!callerId) return res.status(401).json({ error: 'Unauthorized' })

  const { type, recipientId, data } = req.body ?? {}
  if (!type) return res.status(400).json({ error: 'Missing type' })

  const template = EMAIL_TEMPLATES[type]
  if (!template) return res.status(400).json({ error: `Unknown type: ${type}` })

  // Referral invites go to an external email — no recipientId needed
  let toEmail: string
  if (type === 'referral_invite') {
    if (!data?.recipientEmail) return res.status(400).json({ error: 'Missing recipientEmail for referral_invite' })
    toEmail = data.recipientEmail
  } else {
    if (!recipientId) return res.status(400).json({ error: 'Missing recipientId' })

    // Check if recipient has email notifications enabled
    const { data: profileData } = await supabaseAdmin
      .from('profiles')
      .select('email_notifications')
      .eq('id', recipientId)
      .single()
    if (profileData?.email_notifications === false) {
      return res.status(200).json({ ok: true, skipped: 'notifications_disabled' })
    }

    // Look up recipient email via admin client
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.getUserById(recipientId)
    if (authError || !authData?.user?.email) {
      return res.status(200).json({ ok: true })
    }
    toEmail = authData.user.email
  }

  const appUrl = data?.appUrl ?? 'https://tutorfind.app'
  const { subject, html } = template({ ...data, appUrl })

  const emailRes = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from:    'InstructorFinder <onboarding@resend.dev>',
      to:      toEmail,
      subject,
      html,
    }),
  })

  if (!emailRes.ok) {
    const body = await emailRes.text()
    console.error('Resend error:', body)
    return res.status(500).json({ error: 'Email send failed' })
  }

  return res.status(200).json({ ok: true })
}
