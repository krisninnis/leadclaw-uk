import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'

const schema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
})

export async function POST(req: Request) {
  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ ok: false, error: 'supabase_not_configured' }, { status: 400 })

  try {
    const body = await req.json()
    const data = schema.parse(body)

    const { error } = await admin.from('newsletter_subscribers').upsert(
      {
        email: data.email.toLowerCase(),
        name: data.name || null,
        source: 'website',
        status: 'active',
      },
      { onConflict: 'email' }
    )

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_request' }, { status: 400 })
  }
}
