export type TrialStage = 'd3' | 'd5' | 'd6' | 'expired'

export function detectTrialStage(trialEndIso?: string | null): TrialStage | null {
  if (!trialEndIso) return null
  const trialEnd = new Date(trialEndIso).getTime()
  if (Number.isNaN(trialEnd)) return null

  const now = Date.now()
  const diffDays = Math.floor((trialEnd - now) / (24 * 60 * 60 * 1000))

  if (diffDays === 3) return 'd3'
  if (diffDays === 1) return 'd5'
  if (diffDays === 0) return 'd6'
  if (diffDays < 0) return 'expired'
  return null
}

export function renderTrialEmail(input: { stage: TrialStage; checkoutUrl: string; name?: string | null }) {
  const who = input.name?.trim() || 'there'

  if (input.stage === 'd3') {
    return {
      subject: 'Your trial is live — quick wins to switch on',
      text: `Hi ${who}, your trial is running.\n\nTo get value quickly:\n1) Install the widget snippet\n2) Set business hours/services\n3) Run a test enquiry\n\nNeed help? Reply here and we’ll do it with you.`,
    }
  }

  if (input.stage === 'd5') {
    return {
      subject: 'Your trial ends soon — keep automations running',
      text: `Hi ${who}, your trial is nearly over.\n\nUpgrade now to keep missed-enquiry recovery, follow-ups, and rebooking nudges active:\n${input.checkoutUrl}`,
    }
  }

  if (input.stage === 'd6') {
    return {
      subject: 'Final day of trial — avoid losing active automations',
      text: `Hi ${who}, this is your final trial day.\n\nContinue without interruption here:\n${input.checkoutUrl}`,
    }
  }

  return {
    subject: 'Your trial has ended — reactivate in one click',
    text: `Hi ${who}, your trial has ended.\n\nReactivate now to resume your automations:\n${input.checkoutUrl}`,
  }
}
