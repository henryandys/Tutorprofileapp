// Fire-and-forget email notifications via the Vercel API route.
// Failures are logged but never surface to the user as errors.

import { supabase } from './supabase'

type NotifyPayload =
  | { type: 'new_booking';         recipientId: string; data: { tutorName: string; studentName: string; subject: string; message?: string } }
  | { type: 'booking_accepted';    recipientId: string; data: { tutorName: string; studentName: string; subject: string } }
  | { type: 'booking_declined';    recipientId: string; data: { tutorName: string; studentName: string; subject: string } }
  | { type: 'new_message';         recipientId: string; data: { senderName: string; subject: string } }
  | { type: 'waitlist_spot_open';  recipientId: string; data: { sessionTitle: string; subject: string; tutorName: string } }

export function sendNotificationEmail(payload: NotifyPayload): void {
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (!session?.access_token) return
    fetch('/api/notify', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        ...payload,
        data: { ...payload.data, appUrl: window.location.origin },
      }),
    }).catch(err => console.warn('Notification email failed:', err))
  })
}
