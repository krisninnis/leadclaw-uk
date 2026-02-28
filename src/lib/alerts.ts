export async function sendOpsAlert(input: {
  level: 'warn' | 'error'
  category: string
  message: string
  meta?: Record<string, unknown>
}) {
  const url = process.env.ALERT_WEBHOOK_URL
  if (!url) return

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `[LeadClaw ${input.level.toUpperCase()}] ${input.category}: ${input.message}`,
        level: input.level,
        category: input.category,
        meta: input.meta || null,
        at: new Date().toISOString(),
      }),
    })
  } catch {
    // avoid throwing from alert path
  }
}
