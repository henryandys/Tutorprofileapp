import type { VercelRequest, VercelResponse } from '@vercel/node'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export const config = { api: { bodyParser: false } }

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' })

async function rawBody(readable: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const buf = await rawBody(req)
  const sig = req.headers['stripe-signature']

  if (!sig) return res.status(400).json({ error: 'Missing stripe-signature header' })

  // Connect (connected-account) events arrive via a second webhook endpoint
  // with its own signing secret, so try both secrets.
  let event: Stripe.Event | null = null
  const secrets = [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_CONNECT_WEBHOOK_SECRET].filter(Boolean) as string[]
  let sigError = 'No webhook secret configured'
  for (const secret of secrets) {
    try {
      event = stripe.webhooks.constructEvent(buf, sig, secret)
      break
    } catch (err: any) {
      sigError = err.message
    }
  }
  if (!event) {
    console.error('Webhook signature error:', sigError)
    return res.status(400).json({ error: `Webhook Error: ${sigError}` })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const bookingId = session.metadata?.booking_id

    if (bookingId && session.payment_status === 'paid') {
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      )
      const { error } = await supabase
        .from('bookings')
        .update({ payment_status: 'paid', stripe_session_id: session.id })
        .eq('id', bookingId)
      if (error) console.error('Supabase update error:', error)
    }
  }

  if (event.type === 'account.updated') {
    const account = event.data.object as Stripe.Account
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { error } = await supabase
      .from('tutor_profiles')
      .update({ stripe_payouts_enabled: !!account.payouts_enabled })
      .eq('stripe_account_id', account.id)
    if (error) console.error('Supabase update error:', error)
  }

  return res.status(200).json({ received: true })
}
