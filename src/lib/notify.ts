// Fire-and-forget email notifications via the Vercel API route.
// Failures are logged but never surface to the user as errors.

type NotifyPayload =
  | { type: 'new_booking';      recipientId: string; data: { tutorName: string; studentName: string; subject: string; message?: string } }
  | { type: 'booking_accepted'; recipientId: string; data: { tutorName: string; studentName: string; subject: string } }
  | { type: 'booking_declined'; recipientId: string; data: { tutorName: string; studentName: string; subject: string } }
  | { type: 'new_message';      recipientId: string; data: { senderName: string; subject: string } }

export function sendNotificationEmail(payload: NotifyPayload): void {
  fetch('/api/notify', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      ...payload,
      data: { ...payload.data, appUrl: window.location.origin },
    }),
  }).catch(err => console.warn('Notification email failed:', err))
}
