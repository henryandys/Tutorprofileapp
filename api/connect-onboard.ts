import type { VercelRequest, VercelResponse } from '@vercel/node'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' })

async function getCaller(req: VercelRequest): Promise<{ id: string; email: string | null } | null> {
  const auth = req.headers['authorization']
  if (!auth?.startsWith('Bearer ')) return null
  const token = auth.slice(7)
  const client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!)
  const { data, error } = await client.auth.getUser(token)
  if (error || !data?.user) return null
  return { id: data.user.id, email: data.user.email ?? null }
}

// Creates the tutor's Stripe Express account on first call, then returns the
// URL the tutor should be sent to: onboarding while setup is incomplete, the
// Express dashboard once payouts are enabled.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const caller = await getCaller(req)
  if (!caller) return res.status(401).json({ error: 'Unauthorized' })

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: tutor, error: tutorErr } = await supabase
    .from('tutor_profiles')
    .select('id, stripe_account_id')
    .eq('id', caller.id)
    .maybeSingle()
  if (tutorErr) return res.status(500).json({ error: tutorErr.message })
  if (!tutor)   return res.status(403).json({ error: 'Only tutors can set up payouts' })

  const appUrl = process.env.APP_URL ?? 'http://localhost:5173'

  try {
    let accountId = tutor.stripe_account_id as string | null

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: caller.email ?? undefined,
        metadata: { user_id: caller.id },
      })
      accountId = account.id
      const { error: saveErr } = await supabase
        .from('tutor_profiles')
        .update({ stripe_account_id: accountId })
        .eq('id', caller.id)
      if (saveErr) return res.status(500).json({ error: saveErr.message })
    }

    const account = await stripe.accounts.retrieve(accountId)

    if (account.payouts_enabled) {
      const login = await stripe.accounts.createLoginLink(accountId)
      return res.status(200).json({ url: login.url, mode: 'dashboard' })
    }

    const link = await stripe.accountLinks.create({
      account:     accountId,
      refresh_url: `${appUrl}/my-profile?connect=refresh`,
      return_url:  `${appUrl}/my-profile?connect=return`,
      type:        'account_onboarding',
    })
    return res.status(200).json({ url: link.url, mode: 'onboarding' })
  } catch (err: any) {
    console.error('Stripe Connect error:', err)
    return res.status(500).json({ error: err.message })
  }
}
