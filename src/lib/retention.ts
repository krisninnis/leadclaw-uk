export type RetentionBehavior =
  | 'missed_enquiry_recovery'
  | 'unanswered_followup'
  | 'rebooking_nudge'
  | 'aftercare_reassurance'
  | 'dormant_reactivation'
  | 'consultation_guidance'

export type RetentionContext = {
  clientName?: string | null
  service?: string | null
  clinicName?: string | null
  objection?: string | null
  daysSinceLastVisit?: number | null
}

export function renderRetentionMessage(behavior: RetentionBehavior, ctx: RetentionContext) {
  const name = ctx.clientName?.trim() || 'there'
  const service = ctx.service?.trim() || 'your treatment'
  const clinic = ctx.clinicName?.trim() || 'our clinic'

  switch (behavior) {
    case 'missed_enquiry_recovery':
      return {
        subject: `Quick follow-up from ${clinic}`,
        text: `Hi ${name} — we saw your enquiry and didn’t want you to be left waiting. If you still want help with ${service}, reply with your preferred day/time and we’ll sort it.`,
      }

    case 'unanswered_followup':
      return {
        subject: `Still interested in ${service}?`,
        text: `Hi ${name} — quick check-in in case this got buried. If you want to continue with ${service}, reply YES and we’ll send the next step.`,
      }

    case 'rebooking_nudge':
      return {
        subject: `Time to top up ${service}?`,
        text: `Hi ${name} — it may be a good time to rebook your ${service}. If you’d like, reply with morning/afternoon/evening and we’ll suggest options.`,
      }

    case 'aftercare_reassurance':
      return {
        subject: `${service} aftercare check-in`,
        text: `Hi ${name} — just checking in after your ${service}. Mild sensitivity/tightness can be normal early on. If anything feels unusual, reply here and we’ll guide you.`,
      }

    case 'dormant_reactivation':
      return {
        subject: `Want to restart your routine?`,
        text: `Hi ${name} — it’s been a little while since we last saw you. If you want to restart with ${service}, we can make it simple with a quick recommendation.`,
      }

    case 'consultation_guidance':
      return {
        subject: `Quick answers before you decide`,
        text: `Hi ${name} — totally normal to have questions before booking. Tell us your main concern (${ctx.objection || 'results, comfort, or downtime'}) and we’ll give you a clear, no-pressure recommendation.`,
      }

    default:
      return {
        subject: `Update from ${clinic}`,
        text: `Hi ${name} — quick update from ${clinic}. Reply if you want us to continue from where you left off.`,
      }
  }
}

export function treatmentIntervalDays(service?: string | null) {
  const s = (service || '').toLowerCase()
  if (s.includes('botox')) return 90
  if (s.includes('lashes')) return 21
  if (s.includes('brows')) return 28
  if (s.includes('spray tan')) return 14
  if (s.includes('facial')) return 35
  if (s.includes('whitening')) return 120
  return 60
}
