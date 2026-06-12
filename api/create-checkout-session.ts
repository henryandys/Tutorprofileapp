import type { VercelRequest, VercelResponse } from '@vercel/node'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' })

async function getCallerUserId(req: VercelRequest): Promise<string | null> {
  const auth = req.headers['authorization']
  if (!auth?.startsWith('Bearer ')) return null
  const token = auth.slice(7)
  const client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!)
  const { data, error } = await client.auth.getUser(token)
  if (error || !data?.user) return null
  return data.user.id
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const callerId = await getCallerUserId(req)
  if (!callerId) return res.status(401).json({ error: 'Unauthorized' })

  const { bookingId, subject, tutorName, successUrl, cancelUrl } = req.body ?? {}
  if (!bookingId) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  // The amount and payout destination come from the database, never the client.
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data: booking, error: bookingErr } = await supabase
    .from('bookings')
    .select('id, subject, price_cents, payment_status, tutor_id')
    .eq('id', bookingId)
    .maybeSingle()
  if (bookingErr) return res.status(500).json({ error: bookingErr.message })
  if (!booking)   return res.status(404).json({ error: 'Booking not found' })
  if (!booking.price_cents || booking.price_cents <= 0) {
    return res.status(400).json({ error: 'This booking has no price set' })
  }
  if (booking.payment_status === 'paid') {
    return res.status(400).json({ error: 'This booking is already paid' })
  }

  // If the tutor has completed Stripe Connect onboarding, route their share
  // directly to their account and keep only the platform fee.
  const { data: tutor } = await supabase
    .from('tutor_profiles')
    .select('stripe_account_id, stripe_payouts_enabled')
    .eq('id', booking.tutor_id)
    .maybeSingle()

  const feePercent = Number(process.env.PLATFORM_FEE_PERCENT ?? '10')
  const useConnect = !!(tutor?.stripe_account_id && tutor?.stripe_payouts_enabled)

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: `${booking.subject ?? subject ?? 'Tutoring'} lesson with ${tutorName ?? 'tutor'}` },
          unit_amount: booking.price_cents,
        },
        quantity: 1,
      }],
      mode: 'payment',
      ...(useConnect && {
        payment_intent_data: {
          application_fee_amount: Math.round(booking.price_cents * feePercent / 100),
          transfer_data: { destination: tutor!.stripe_account_id! },
        },
      }),
      success_url: successUrl ?? `${process.env.APP_URL ?? 'http://localhost:5173'}/lessons?payment=success`,
      cancel_url:  cancelUrl  ?? `${process.env.APP_URL ?? 'http://localhost:5173'}/lessons?payment=cancelled`,
      metadata: { booking_id: bookingId, student_id: callerId },
    })
    return res.status(200).json({ url: session.url })
  } catch (err: any) {
    console.error('Stripe error:', err)
    return res.status(500).json({ error: err.message })
  }
}
