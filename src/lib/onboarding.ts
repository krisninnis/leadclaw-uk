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
  return input.trim().replace(/"/g, "&quot;");
}

export function buildWidgetSnippet(appUrl: string, token: string) {
  const base = normalizeAppUrl(appUrl);
  const safeToken = normalizeToken(token);

  if (!base || !safeToken) return "";

  return [
    "<script",
    "  defer",
    `  src="${base}/api/widget/bootstrap.js"`,
    `  data-claw-token="${safeToken}"`,
    '  crossorigin="anonymous"',
    "></script>",
  ].join("\n");
}

export function buildGtmSnippet(appUrl: string, token: string) {
  const base = normalizeAppUrl(appUrl);
  const safeToken = normalizeToken(token);

  if (!base || !safeToken) return "";

  return [
    `<script>window.clawWidgetToken="${safeToken}";</script>`,
    `<script defer src="${base}/api/widget/bootstrap.js" crossorigin="anonymous"></script>`,
  ].join("\n");
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
    body: `Hi ${input.clientName},

Your assistant is ready for ${input.domain}.

Next steps:
1) Add this script to your site footer (all pages):
${input.widgetSnippet}

2) Complete your business settings:
${input.settingsUrl}

3) Run a quick test message in incognito/mobile.

Reply DONE when complete and we will verify it end-to-end.${
      input.supportEmail
        ? `

Support: ${input.supportEmail}`
        : ""
    }

— Clawbot`,
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
