import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const token = process.env.ONBOARDING_API_TOKEN?.trim()
  const auth = req.headers.get('authorization') || ''
  if (!token || auth !== `Bearer ${token}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const supportEmail = process.env.SUPPORT_CONTACT_EMAIL?.trim() || null

  return NextResponse.json({
    ok: true,
    supportEmail,
    welcomeEmailTemplate: {
      subject: 'Your AI assistant setup is ready (10-minute launch)',
      body: 'Hi {{ClientName}},\\n\\nYour assistant is ready for {{Domain}}.\\n1) Add script: {{WidgetScript}}\\n2) Complete settings: {{SettingsLink}}\\n3) Test in incognito/mobile.\\n\\nReply DONE when complete.',
    },
    nonTechnicalExplainer:
      'This assistant captures missed enquiries, follows up automatically, nudges clients to rebook at the right time, and sends aftercare check-ins to recover revenue with less manual chasing.',
    troubleshootingChecklist: [
      'Script is present on all pages (source view check).',
      'No duplicate widget snippet/tag.',
      'Cache and CDN purged after install.',
      'Tested on desktop + incognito + mobile.',
      'Widget token/domain match expected values.',
      'Handoff channel (email/WhatsApp/SMS) configured.',
    ],
  })
}
