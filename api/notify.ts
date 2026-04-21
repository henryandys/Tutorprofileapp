import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const EMAIL_TEMPLATES: Record<string, (d: any) => { subject: string; html: string }> = {
  new_booking: (d) => ({
    subject: `New lesson request from ${d.studentName}`,
    html: `<p>Hi ${d.tutorName},</p>
           <p><strong>${d.studentName}</strong> sent you a lesson request for <strong>${d.subject}</strong>.</p>
           ${d.message ? `<blockquote style="border-left:3px solid #2563eb;padding-left:12px;color:#555">${d.message}</blockquote>` : ''}
           <p><a href="${d.appUrl}/my-profile">Review the request →</a></p>`,
  }),
  booking_accepted: (d) => ({
    subject: `Your lesson request was accepted!`,
    html: `<p>Hi ${d.studentName},</p>
           <p>Your lesson request for <strong>${d.subject}</strong> with <strong>${d.tutorName}</strong> has been <strong style="color:#16a34a">accepted</strong>.</p>
           <p>You can now message your tutor. <a href="${d.appUrl}/profile">View your requests →</a></p>`,
  }),
  booking_declined: (d) => ({
    subject: `Update on your lesson request`,
    html: `<p>Hi ${d.studentName},</p>
           <p>Your lesson request for <strong>${d.subject}</strong> with <strong>${d.tutorName}</strong> was declined.</p>
           <p><a href="${d.appUrl}/search">Find another tutor →</a></p>`,
  }),
  new_message: (d) => ({
    subject: `New message from ${d.senderName}`,
    html: `<p>You have a new message from <strong>${d.senderName}</strong> about <strong>${d.subject}</strong>.</p>
           <p><a href="${d.appUrl}/profile">View your messages →</a></p>`,
  }),
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

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
      from:    'TutorFind <notifications@tutorfind.app>',
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
