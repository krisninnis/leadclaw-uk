import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'leadclaw-ai',
    ts: new Date().toISOString(),
  })
}
