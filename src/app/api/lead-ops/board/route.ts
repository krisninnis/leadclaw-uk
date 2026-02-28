import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type LeadRow = {
  id: string
  company_name: string
  contact_email: string | null
  city: string | null
  status: string
  notes: string | null
  updated_at: string
}

type OutreachEvent = {
  lead_id: string
  event_type: string
  created_at: string
  payload: Record<string, unknown> | null
}

function parseNotes(raw: string | null) {
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    return { note_text: raw }
  }
}

export async function GET() {
  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ ok: false, error: 'supabase_not_configured' }, { status: 400 })

  const { data: leads, error: leadsErr } = await admin
    .from('leads')
    .select('id,company_name,contact_email,city,status,notes,updated_at')
    .order('updated_at', { ascending: false })
    .limit(300)

  if (leadsErr) return NextResponse.json({ ok: false, error: leadsErr.message }, { status: 500 })

  const leadIds = (leads || []).map((l) => l.id)
  let events: OutreachEvent[] = []

  if (leadIds.length > 0) {
    const { data: evData } = await admin
      .from('outreach_events')
      .select('lead_id,event_type,created_at,payload')
      .in('lead_id', leadIds)
      .order('created_at', { ascending: false })
      .limit(2000)

    events = (evData as OutreachEvent[]) || []
  }

  const latestByLead = new Map<string, OutreachEvent>()
  for (const ev of events) {
    if (!latestByLead.has(ev.lead_id)) latestByLead.set(ev.lead_id, ev)
  }

  const rows = ((leads as LeadRow[]) || []).map((lead) => {
    const notes = parseNotes(lead.notes)
    const latest = latestByLead.get(lead.id)
    return {
      ...lead,
      notes,
      last_event_type: latest?.event_type || null,
      last_contact_at: latest?.created_at || null,
      follow_up_due_at: (notes as Record<string, unknown>).follow_up_due_at || null,
      outcome_label: (notes as Record<string, unknown>).outcome_label || null,
    }
  })

  const summary = {
    total: rows.length,
    contacted: rows.filter((r) => ['contacted', 'replied', 'interested', 'not_interested', 'do_not_contact'].includes(r.status)).length,
    replied: rows.filter((r) => r.status === 'replied').length,
    interested: rows.filter((r) => r.status === 'interested').length,
    notInterested: rows.filter((r) => r.status === 'not_interested').length,
    followUpsDue: rows.filter((r) => r.follow_up_due_at && new Date(String(r.follow_up_due_at)).getTime() <= Date.now()).length,
  }

  return NextResponse.json({ ok: true, summary, leads: rows })
}

export async function POST(req: NextRequest) {
  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ ok: false, error: 'supabase_not_configured' }, { status: 400 })

  const body = await req.json().catch(() => null)
  const leadId = body?.leadId as string | undefined
  const status = body?.status as string | undefined
  const outcomeLabel = body?.outcomeLabel as string | undefined
  const followUpDueAt = body?.followUpDueAt as string | null | undefined
  const note = body?.note as string | undefined

  if (!leadId || !status) {
    return NextResponse.json({ ok: false, error: 'leadId and status required' }, { status: 400 })
  }

  const { data: existing } = await admin.from('leads').select('notes').eq('id', leadId).maybeSingle()
  const parsed = parseNotes((existing?.notes as string | null) || null) as Record<string, unknown>
  const merged = {
    ...parsed,
    outcome_label: outcomeLabel || parsed.outcome_label || null,
    follow_up_due_at: followUpDueAt || null,
    last_manual_note: note || parsed.last_manual_note || null,
    updated_via: 'lead_ops_board',
    updated_at: new Date().toISOString(),
  }

  const { error: updateErr } = await admin
    .from('leads')
    .update({
      status,
      notes: JSON.stringify(merged),
      updated_at: new Date().toISOString(),
    })
    .eq('id', leadId)

  if (updateErr) return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 })

  await admin.from('outreach_events').insert({
    lead_id: leadId,
    channel: 'crm',
    event_type: 'lead_outcome_updated',
    payload: { status, outcomeLabel, followUpDueAt, note },
  })

  await admin.from('system_events').insert({
    level: 'info',
    category: 'lead_ops',
    message: `Lead outcome updated: ${leadId} -> ${status}`,
    meta: { leadId, status, outcomeLabel, followUpDueAt },
  })

  return NextResponse.json({ ok: true })
}
