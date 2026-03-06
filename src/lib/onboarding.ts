export type SitePlatform =
  | "wordpress"
  | "shopify"
  | "squarespace"
  | "wix"
  | "custom";

export type InstallMethod = "script_embed" | "wordpress_plugin" | "gtm";

export const AUTONOMOUS_TASK_ORDER = [
  "create_client_workspace",
  "generate_widget_token",
  "store_settings",
  "run_validation_tests",
  "schedule_retention_automations",
  "generate_handover_report",
] as const;

export type AutonomousTaskType = (typeof AUTONOMOUS_TASK_ORDER)[number];

export function normalizeDomain(input: string) {
  return input
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/$/, "")
    .toLowerCase();
}

function normalizeAppUrl(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

function normalizeToken(input: string) {
  return input.trim();
}

export function buildWidgetSnippet(appUrl: string, token: string) {
  const base = normalizeAppUrl(appUrl);
  const safeToken = normalizeToken(token);

  if (!base || !safeToken) return "";

  return `<script defer src="${base}/api/widget/bootstrap.js" data-claw-token="${safeToken}"></script>`;
}

export function buildGtmSnippet(appUrl: string, token: string) {
  const base = normalizeAppUrl(appUrl);
  const safeToken = normalizeToken(token);

  if (!base || !safeToken) return "";

  return `<script>window.clawWidgetToken="${safeToken}";</script>\n<script defer src="${base}/api/widget/bootstrap.js"></script>`;
}

export function buildWelcomeEmail(input: {
  clientName: string;
  domain: string;
  settingsUrl: string;
  widgetSnippet: string;
  supportEmail?: string | null;
}) {
  return {
    subject: "Your AI assistant setup is ready (10-minute launch)",
    body: `Hi ${input.clientName},\n\nYour assistant is ready for ${input.domain}.\n\nNext steps:\n1) Add this script to your site footer (all pages):\n${input.widgetSnippet}\n\n2) Complete your business settings:\n${input.settingsUrl}\n\n3) Run a quick test message in incognito/mobile.\n\nReply DONE when complete and we will verify it end-to-end.${input.supportEmail ? `\n\nSupport: ${input.supportEmail}` : ""}\n\n— Clawbot`,
  };
}

export function defaultRetentionRules() {
  return [
    { behavior: "missed_enquiry_recovery", delayHours: 1 },
    { behavior: "unanswered_followup", delayHours: 24 },
    { behavior: "aftercare_reassurance", delayHours: 6 },
    { behavior: "rebooking_nudge", delayHours: 24 * 30 },
    { behavior: "dormant_reactivation", delayHours: 24 * 60 },
  ];
}
