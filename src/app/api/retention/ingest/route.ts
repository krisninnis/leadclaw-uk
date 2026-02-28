import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logSystemEvent } from '@/lib/ops'
import { treatmentIntervalDays } from '@/lib/retention'

type TriggerType = 'enquiry_received' | 'treatment_completed' | 'consultation_hesitation' | 'client_dormant'

function plusHours(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
}

function plusDays(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
}

export async function POST(req: Request) {
  const token = process.env.RETENTION_INGEST_TOKEN?.trim()
  const auth = req.headers.get('authorization') || ''
  if (!token || auth !== `Bearer ${token}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const body = (await req.json()) as {
    triggerType?: TriggerType
    clientName?: string
    email?: string
    phone?: string
    service?: string
    clinicName?: string
    objection?: string
  }

  const triggerType = body.triggerType
  if (!triggerType) return NextResponse.json({ ok: false, error: 'triggerType_required' }, { status: 400 })

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ ok: false, error: 'supabase_not_configured' }, { status: 400 })

  const email = body.email?.trim().toLowerCase() || null
  const phone = body.phone?.trim() || null
  if (!email && !phone) return NextResponse.json({ ok: false, error: 'email_or_phone_required' }, { status: 400 })

  const key = email || phone

  const { data: existing } = await admin
    .from('retention_clients')
    .select('id')
    .eq('external_key', key)
    .maybeSingle()

  const payload = {
    external_key: key,
    client_name: body.clientName || null,
    email,
    phone,
    service: body.service || null,
    clinic_name: body.clinicName || null,
    objection: body.objection || null,
    last_seen_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  let clientId = existing?.id as string | undefined
  if (clientId) {
    await admin.from('retention_clients').update(payload).eq('id', clientId)
  } else {
    const { data: inserted, error } = await admin.from('retention_clients').insert(payload).select('id').single()
    if (error || !inserted?.id) return NextResponse.json({ ok: false, error: error?.message || 'client_insert_failed' }, { status: 500 })
    clientId = inserted.id
  }

  const tasks: Array<{ behavior: string; due_at: string }> = []

  if (triggerType === 'enquiry_received') {
    tasks.push({ behavior: 'missed_enquiry_recovery', due_at: plusHours(1) })
    tasks.push({ behavior: 'unanswered_followup', due_at: plusHours(24) })
    tasks.push({ behavior: 'unanswered_followup', due_at: plusHours(72) })
  }

  if (triggerType === 'treatment_completed') {
    tasks.push({ behavior: 'aftercare_reassurance', due_at: plusHours(6) })
    tasks.push({ behavior: 'aftercare_reassurance', due_at: plusHours(48) })
    tasks.push({ behavior: 'rebooking_nudge', due_at: plusDays(treatmentIntervalDays(body.service)) })
  }

  if (triggerType === 'consultation_hesitation') {
    tasks.push({ behavior: 'consultation_guidance', due_at: plusHours(2) })
    tasks.push({ behavior: 'unanswered_followup', due_at: plusHours(30) })
  }

  if (triggerType === 'client_dormant') {
    tasks.push({ behavior: 'dormant_reactivation', due_at: plusHours(1) })
  }

  if (tasks.length > 0) {
    await admin.from('retention_tasks').insert(
      tasks.map((t) => ({
        retention_client_id: clientId,
        behavior: t.behavior,
        due_at: t.due_at,
        status: 'queued',
      }))
    )
  }

  await logSystemEvent({
    level: 'info',
    category: 'retention',
    message: `Retention ingest: ${triggerType} tasks=${tasks.length}`,
    meta: { triggerType, key },
  })

  return NextResponse.json({ ok: true, clientId, scheduled: tasks.length })
}
