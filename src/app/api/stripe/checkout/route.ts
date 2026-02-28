import { NextResponse } from 'next/server'
import { getStripe, PRICE_IDS } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const { plan, email } = await req.json()
    const stripe = getStripe()

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!stripe) return NextResponse.json({ ok: false, error: 'stripe_not_configured' }, { status: 400 })

    const priceId = PRICE_IDS[plan as keyof typeof PRICE_IDS]
    if (!priceId) return NextResponse.json({ ok: false, error: 'missing_price_id' }, { status: 400 })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || 'http://localhost:3000'

    const trialDays = 7

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email || undefined,
      success_url: `${appUrl}/portal?checkout=success`,
      cancel_url: `${appUrl}/pricing?checkout=cancelled`,
      // Do not force card capture on trial start.
      payment_method_collection: 'if_required',
      subscription_data: {
        trial_period_days: trialDays,
        // Cancel trial if no payment method is added by trial end.
        trial_settings: {
          end_behavior: { missing_payment_method: 'cancel' },
        },
        metadata: {
          plan,
          userId: user?.id || '',
          trialAutoCancel: 'true',
        },
      },
      metadata: {
        plan,
        userId: user?.id || '',
        trialAutoCancel: 'true',
      },
    })

    return NextResponse.json({ ok: true, url: session.url })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'checkout_failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
