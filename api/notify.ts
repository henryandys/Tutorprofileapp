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
           <p>You can now message your tutor. <a href="${h(d.appUrl)}/profile">View your requests →</a></p>`,
  }),
  booking_declined: (d) => ({
    subject: `Update on your lesson request`,
    html: `<p>Hi ${h(d.studentName)},</p>
           <p>Your lesson request for <strong>${h(d.subject)}</strong> with <strong>${h(d.tutorName)}</strong> was declined.</p>
           <p><a href="${h(d.appUrl)}/search">Find another tutor →</a></p>`,
  }),
  new_message: (d) => ({
    subject: `New message from ${h(d.senderName)}`,
    html: `<p>You have a new message from <strong>${h(d.senderName)}</strong> about <strong>${h(d.subject)}</strong>.</p>
           <p><a href="${h(d.appUrl)}/profile">View your messages →</a></p>`,
  }),
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const callerId = await getCallerUserId(req)
  if (!callerId) return res.status(401).json({ error: 'Unauthorized' })

  const { type, recipientId, data } = req.body ?? {}
  if (!type || !recipientId) return res.status(400).json({ error: 'Missing type or recipientId' })

  const template = EMAIL_TEMPLATES[type]
  if (!template) return res.status(400).json({ error: `Unknown type: ${type}` })

  // Look up recipient email via admin client
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.getUserById(recipientId)
  if (authError || !authData?.user?.email) {
    return res.status(404).json({ error: 'Recipient not found' })
  }
  const toEmail = authData.user.email

  const appUrl = data?.appUrl ?? 'https://tutorfind.app'
  const { subject, html } = template({ ...data, appUrl })

  const emailRes = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from:    'TutorFind <onboarding@resend.dev>',
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
