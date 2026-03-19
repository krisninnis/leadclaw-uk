import { mkdir, appendFile } from 'fs/promises'
import path from 'path'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { LEGAL_VERSION } from '@/lib/legal'

const schema = z.object({
  clinicName: z.string().min(2),
  contactName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(7),
  city: z.string().min(2),
  website: z.string().optional(),
  services: z.string().min(2),
  leadVolume: z.string().optional(),
  notes: z.string().optional(),
  agree: z.string().optional(),
  termsVersion: z.string().optional(),
})

export async function POST(req: Request) {
  try {
    const json = await req.json()
    const data = schema.parse(json)

    if (!data.agree) {
      return NextResponse.json({ ok: false, error: 'agreement_required' }, { status: 400 })
    }

    const nowIso = new Date().toISOString()
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null

    const payload = {
      clinic_name: data.clinicName,
      contact_name: data.contactName,
      email: data.email,
      phone: data.phone,
      city: data.city,
      website: data.website || null,
      services: data.services,
      lead_volume: data.leadVolume || null,
      notes: data.notes || null,
      agreed: true,
      terms_version: data.termsVersion || LEGAL_VERSION,
      terms_accepted_at: nowIso,
      privacy_accepted_at: nowIso,
      waiver_accepted_at: nowIso,
      agreement_ip: ip,
      status: 'new',
    }

    const admin = createAdminClient()

    if (admin) {
      const { error } = await admin.from('applications').insert(payload)
      if (error) throw error
      return NextResponse.json({ ok: true, storage: 'supabase' })
    }

    const dataDir = path.join(process.cwd(), 'data')
    const out = path.join(dataDir, 'applications.jsonl')
    await mkdir(dataDir, { recursive: true })
    await appendFile(out, JSON.stringify({ ...payload, created_at: nowIso }) + '\n')

    return NextResponse.json({ ok: true, storage: 'local_fallback' })
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_request' }, { status: 400 })
  }
}
