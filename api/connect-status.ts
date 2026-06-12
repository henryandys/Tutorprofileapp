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

// Returns the tutor's payout status, syncing the latest state from Stripe
// into tutor_profiles so search/checkout can rely on the database flag.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const callerId = await getCallerUserId(req)
  if (!callerId) return res.status(401).json({ error: 'Unauthorized' })

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: tutor, error: tutorErr } = await supabase
    .from('tutor_profiles')
    .select('id, stripe_account_id, stripe_payouts_enabled')
    .eq('id', callerId)
    .maybeSingle()
  if (tutorErr) return res.status(500).json({ error: tutorErr.message })
  if (!tutor)   return res.status(403).json({ error: 'Only tutors have payout accounts' })

  if (!tutor.stripe_account_id) {
    return res.status(200).json({ connected: false, payoutsEnabled: false, detailsSubmitted: false })
  }

  try {
    const account = await stripe.accounts.retrieve(tutor.stripe_account_id)
    const payoutsEnabled = !!account.payouts_enabled

    if (payoutsEnabled !== tutor.stripe_payouts_enabled) {
      await supabase
        .from('tutor_profiles')
        .update({ stripe_payouts_enabled: payoutsEnabled })
        .eq('id', callerId)
    }

    return res.status(200).json({
      connected:        true,
      payoutsEnabled,
      detailsSubmitted: !!account.details_submitted,
    })
  } catch (err: any) {
    console.error('Stripe Connect status error:', err)
    return res.status(500).json({ error: err.message })
  }
}
