import {
  isLeadEligibleForOutreach,
  type OutreachEligibilityLead,
  type OutreachEligibilityResult,
} from "@/lib/outreach-eligibility";
import {
  renderOutreachTemplate,
  type OutreachTemplate,
  type OutreachTemplateLead,
} from "@/lib/outreach-templates";

export type OutreachDraftLead = OutreachEligibilityLead &
  OutreachTemplateLead & {
    id?: string;
    company_name?: string | null;
  };

export type OutreachDraftResult = {
  eligible: boolean;
  eligibility: OutreachEligibilityResult;
  subject: string;
  body: string;
};

export function buildOutreachDraft(
  lead: OutreachDraftLead,
  template: OutreachTemplate,
  suppressedEmails: string[] = [],
): OutreachDraftResult {
  const eligibility = isLeadEligibleForOutreach(lead, suppressedEmails);

  if (template.status !== "active") {
    eligibility.reasons.push("template_archived");
  }

  const rendered = renderOutreachTemplate(
    template.subject_template,
    template.body_template,
    lead,
  );

  return {
    eligible: eligibility.reasons.length === 0,
    eligibility,
    subject: rendered.subject,
    body: rendered.body,
  };
}
