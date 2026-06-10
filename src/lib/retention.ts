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
  const service = ctx.service?.trim() || 'your request'
  const workspace = ctx.clinicName?.trim() || 'our team'

  switch (behavior) {
    case 'missed_enquiry_recovery':
      return {
        subject: `Quick follow-up from ${workspace}`,
        text: `Hi ${name} - we saw your request and did not want you to be left waiting. If you still want help with ${service}, reply with the best next step and we will pick it up.`,
      }

    case 'unanswered_followup':
      return {
        subject: `Still need help with ${service}?`,
        text: `Hi ${name} - quick check-in in case this got buried. If you want to continue with ${service}, reply YES and we will send the next step.`,
      }

    case 'rebooking_nudge':
      return {
        subject: `Ready to continue with ${service}?`,
        text: `Hi ${name} - it may be a good time to continue with ${service}. Reply with morning, afternoon, or evening and we will suggest the next option.`,
      }

    case 'aftercare_reassurance':
      return {
        subject: `${service} check-in`,
        text: `Hi ${name} - just checking in after ${service}. If anything needs attention or you have a follow-up question, reply here and we will help.`,
      }

    case 'dormant_reactivation':
      return {
        subject: `Want to restart the conversation?`,
        text: `Hi ${name} - it has been a little while since we last heard from you. If you want to continue with ${service}, we can make the next step simple.`,
      }

    case 'consultation_guidance':
      return {
        subject: `Quick answers before you decide`,
        text: `Hi ${name} - it is normal to have questions before moving forward. Tell us your main concern (${ctx.objection || 'timing, pricing, or process'}) and we will give you a clear, no-pressure answer.`,
      }

    default:
      return {
        subject: `Update from ${workspace}`,
        text: `Hi ${name} - quick update from ${workspace}. Reply if you want us to continue from where you left off.`,
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
