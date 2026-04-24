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

  const { bookingId, amountCents, subject, studentName, tutorName, successUrl, cancelUrl } = req.body ?? {}
  if (!bookingId || !amountCents || !subject) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: `${subject} lesson with ${tutorName ?? 'tutor'}` },
          unit_amount: Math.round(amountCents),
        },
        quantity: 1,
      }],
      mode: 'payment',
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
