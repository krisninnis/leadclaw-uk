import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  clinic: z.string().min(2),
  website: z.string().optional(),
  planInterest: z.string().optional(),
  issueType: z.string().optional(),
  message: z.string().min(5),
})

export async function POST(req: Request) {
  try {
    const json = await req.json()
    const data = schema.parse(json)

    const admin = createAdminClient()
    if (!admin) return NextResponse.json({ ok: false, error: 'supabase_not_configured' }, { status: 400 })

    const issueType = (data.issueType || 'general').toLowerCase()

    const note = [
      `CONTACT_FORM`,
      `planInterest=${data.planInterest || 'not_specified'}`,
      `issueType=${issueType}`,
      `message=${data.message}`,
    ].join(' | ')

    const { error } = await admin.from('applications').insert({
      clinic_name: data.clinic,
      contact_name: data.name,
      email: data.email,
      phone: 'not_provided',
      city: 'unknown',
      website: data.website || null,
      services: 'contact_request',
      lead_volume: null,
      notes: note,
      agreed: true,
      terms_version: 'contact-form-v1',
      terms_accepted_at: new Date().toISOString(),
      privacy_accepted_at: new Date().toISOString(),
      waiver_accepted_at: new Date().toISOString(),
      agreement_ip: req.headers.get('x-forwarded-for') || null,
      status: 'new',
    })

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

    await admin.from('system_events').insert({
      level: issueType === 'complaint' ? 'warn' : 'info',
      category: issueType === 'complaint' ? 'complaint' : 'contact',
      message: `New ${issueType} request from ${data.email}`,
      meta: { clinic: data.clinic, planInterest: data.planInterest || null, issueType },
    })

    if (issueType === 'complaint') {
      const support = process.env.SUPPORT_CONTACT_EMAIL?.trim()
      if (support) {
        await sendEmail({
          to: support,
          subject: `🚨 Complaint submitted: ${data.clinic}`,
          text: `Complaint received from ${data.name} (${data.email})\nClinic: ${data.clinic}\nWebsite: ${data.website || '-'}\n\nMessage:\n${data.message}`,
          html: `<p><strong>Complaint received</strong></p><p>From: ${data.name} (${data.email})<br/>Clinic: ${data.clinic}<br/>Website: ${data.website || '-'}</p><p>${data.message.replace(/\n/g, '<br/>')}</p>`,
        })
      }
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_request' }, { status: 400 })
  }
}
