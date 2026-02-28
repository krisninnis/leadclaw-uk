import { NextResponse } from 'next/server'
import { suppressEmail } from '@/lib/email'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const email = searchParams.get('email')

  if (!email) return NextResponse.json({ ok: false, error: 'missing_email' }, { status: 400 })

  await suppressEmail(email, 'unsubscribe_link')

  return new NextResponse(
    `<html><body style="font-family:Arial;padding:24px"><h2>You're unsubscribed</h2><p>${email} has been removed from future outreach emails.</p></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
}
