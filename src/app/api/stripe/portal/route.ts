import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'

export async function POST(req: Request) {
  try {
    const { customerId } = await req.json()
    const stripe = getStripe()
    if (!stripe) return NextResponse.json({ ok: false, error: 'stripe_not_configured' }, { status: 400 })
    if (!customerId) return NextResponse.json({ ok: false, error: 'missing_customer_id' }, { status: 400 })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/portal`,
    })

    return NextResponse.json({ ok: true, url: session.url })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'portal_failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
