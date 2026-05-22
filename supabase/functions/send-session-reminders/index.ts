import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const APP_URL = Deno.env.get('APP_URL') ?? 'https://tutorfind.app'

function h(str: unknown): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#x27;')
}

function formatSessionTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  })
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'InstructorFinder <onboarding@resend.dev>',
      to,
      subject,
      html,
    }),
  })
  if (!res.ok) console.error(`Resend error to ${to}:`, await res.text())
}

Deno.serve(async () => {
  const now = new Date()
  // Window: bookings between 23h and 25h from now (catches the ~24h mark across hourly runs)
  const windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000).toISOString()
  const windowEnd   = new Date(now.getTime() + 25 * 60 * 60 * 1000).toISOString()

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, subject, scheduled_at, student_name, student_id, tutor_id')
    .eq('status', 'accepted')
    .gt('scheduled_at', windowStart)
    .lt('scheduled_at', windowEnd)
    .is('reminder_sent_at', null)

  if (error) {
    console.error('Query error:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  const bookingList = bookings ?? []
  if (bookingList.length === 0) {
    return new Response(JSON.stringify({ sent: 0, bookings: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Fetch profiles for all tutors and students in one query
  const allUserIds = [...new Set([
    ...bookingList.map(b => b.student_id),
    ...bookingList.map(b => b.tutor_id),
  ])]

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email_notifications')
    .in('id', allUserIds)

  const profileMap: Record<string, { full_name: string; email_notifications: boolean }> = {}
  for (const p of profiles ?? []) {
    profileMap[p.id] = { full_name: p.full_name, email_notifications: p.email_notifications ?? true }
  }

  let sent = 0
  const sentIds: string[] = []

  for (const booking of bookingList) {
    const sessionTime = formatSessionTime(booking.scheduled_at)
    const tutorName   = profileMap[booking.tutor_id]?.full_name  ?? 'Your instructor'
    const studentName = booking.student_name

    // Remind student
    if (profileMap[booking.student_id]?.email_notifications !== false) {
      const { data: studentAuth } = await supabase.auth.admin.getUserById(booking.student_id)
      if (studentAuth?.user?.email) {
        await sendEmail(
          studentAuth.user.email,
          `Reminder: Your ${booking.subject} lesson is tomorrow`,
          `<p>Hi ${h(studentName)},</p>
           <p>This is a reminder that your <strong>${h(booking.subject)}</strong> lesson
           with <strong>${h(tutorName)}</strong> is scheduled for
           <strong>${h(sessionTime)}</strong>.</p>
           <p><a href="${APP_URL}/lessons">View your lessons →</a></p>
           <p style="color:#9ca3af;font-size:12px;margin-top:24px">
             To stop receiving these reminders,
             <a href="${APP_URL}/privacy-security" style="color:#9ca3af">update your notification settings</a>.
           </p>`,
        )
        sent++
      }
    }

    // Remind tutor
    if (profileMap[booking.tutor_id]?.email_notifications !== false) {
      const { data: tutorAuth } = await supabase.auth.admin.getUserById(booking.tutor_id)
      if (tutorAuth?.user?.email) {
        await sendEmail(
          tutorAuth.user.email,
          `Reminder: Your ${booking.subject} session is tomorrow`,
          `<p>Hi ${h(tutorName)},</p>
           <p>This is a reminder that you have a <strong>${h(booking.subject)}</strong> session
           with <strong>${h(studentName)}</strong> scheduled for
           <strong>${h(sessionTime)}</strong>.</p>
           <p><a href="${APP_URL}/instructor-dashboard">View your dashboard →</a></p>
           <p style="color:#9ca3af;font-size:12px;margin-top:24px">
             To stop receiving these reminders,
             <a href="${APP_URL}/privacy-security" style="color:#9ca3af">update your notification settings</a>.
           </p>`,
        )
        sent++
      }
    }

    sentIds.push(booking.id)
  }

  // Mark all processed bookings so they won't be reminded again
  if (sentIds.length > 0) {
    await supabase
      .from('bookings')
      .update({ reminder_sent_at: now.toISOString() })
      .in('id', sentIds)
  }

  return new Response(JSON.stringify({ sent, bookings: sentIds.length }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
