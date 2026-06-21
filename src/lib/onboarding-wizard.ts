// Onboarding Wizard (Phase 1) — shared constants + helpers.
//
// Pure module: NO server-only imports here. Imported by both the client wizard
// component and the server API routes / page, so it must stay isomorphic.

export type IndustryValue =
  | "dentist"
  | "aesthetic_clinic"
  | "physiotherapist"
  | "chiropractor"
  | "vet"
  | "plumber"
  | "electrician"
  | "builder"
  | "roofer"
  | "landscaper"
  | "locksmith"
  | "recruitment_agency"
  | "law_firm"
  | "accountant"
  | "estate_agent"
  | "marketing_agency"
  | "web_design_agency"
  | "it_support"
  | "consultant"
  | "other";

export type IndustryOption = {
  value: IndustryValue;
  label: string;
  // Keywords used by the homepage analyser to guess the industry.
  keywords: string[];
};

// Order mirrors the product spec exactly.
export const INDUSTRY_OPTIONS: IndustryOption[] = [
  { value: "dentist", label: "Dentist", keywords: ["dentist", "dental", "teeth", "orthodont", "implants", "hygienist"] },
  { value: "aesthetic_clinic", label: "Aesthetic Clinic", keywords: ["aesthetic", "botox", "filler", "skin clinic", "cosmetic", "anti-wrinkle", "lip filler"] },
  { value: "physiotherapist", label: "Physiotherapist", keywords: ["physio", "physiotherap", "sports injury", "rehabilitation", "manual therapy"] },
  { value: "chiropractor", label: "Chiropractor", keywords: ["chiropract", "spinal", "adjustment", "back pain clinic"] },
  { value: "vet", label: "Vet", keywords: ["vet", "veterinary", "animal hospital", "pet clinic", "pets"] },
  { value: "plumber", label: "Plumber", keywords: ["plumber", "plumbing", "boiler", "heating engineer", "leak", "drainage"] },
  { value: "electrician", label: "Electrician", keywords: ["electrician", "electrical", "rewire", "fuse board", "niceic", "consumer unit"] },
  { value: "builder", label: "Builder", keywords: ["builder", "building contractor", "construction", "extension", "renovation", "groundwork"] },
  { value: "roofer", label: "Roofer", keywords: ["roofer", "roofing", "roof repair", "guttering", "flat roof", "tiling"] },
  { value: "landscaper", label: "Landscaper", keywords: ["landscap", "gardener", "garden design", "lawn", "paving", "turf"] },
  { value: "locksmith", label: "Locksmith", keywords: ["locksmith", "lock", "key cutting", "uPVC door", "emergency entry"] },
  { value: "recruitment_agency", label: "Recruitment Agency", keywords: ["recruit", "staffing", "candidates", "vacancies", "talent", "headhunt"] },
  { value: "law_firm", label: "Law Firm", keywords: ["solicitor", "law firm", "lawyer", "legal", "conveyancing", "litigation", "barrister"] },
  { value: "accountant", label: "Accountant", keywords: ["accountant", "accountancy", "bookkeeping", "tax return", "vat", "payroll"] },
  { value: "estate_agent", label: "Estate Agent", keywords: ["estate agent", "properties for sale", "lettings", "valuation", "homes for sale", "rightmove"] },
  { value: "marketing_agency", label: "Marketing Agency", keywords: ["marketing agency", "seo", "ppc", "social media marketing", "branding", "digital marketing"] },
  { value: "web_design_agency", label: "Web Design Agency", keywords: ["web design", "web development", "website design", "ux", "ui design"] },
  { value: "it_support", label: "IT Support", keywords: ["it support", "managed it", "cyber security", "helpdesk", "msp", "network support"] },
  { value: "consultant", label: "Consultant", keywords: ["consultant", "consulting", "consultancy", "advisory"] },
  { value: "other", label: "Other", keywords: [] },
];

export const INDUSTRY_VALUES: IndustryValue[] = INDUSTRY_OPTIONS.map((o) => o.value);

export function industryLabel(value: string | null | undefined): string {
  const match = INDUSTRY_OPTIONS.find((o) => o.value === value);
  return match ? match.label : "Other";
}

export type PlatformValue =
  | "wordpress"
  | "shopify"
  | "wix"
  | "squarespace"
  | "webflow"
  | "gohighlevel"
  | "framer"
  | "custom"
  | "not_sure";

export type PlatformOption = {
  value: PlatformValue;
  label: string;
  keywords: string[];
};

export const PLATFORM_OPTIONS: PlatformOption[] = [
  { value: "wordpress", label: "WordPress", keywords: ["wp-content", "wp-includes", "wordpress"] },
  { value: "shopify", label: "Shopify", keywords: ["cdn.shopify.com", "shopify", "myshopify.com"] },
  { value: "wix", label: "Wix", keywords: ["wix.com", "wixstatic", "_wix", "parastorage"] },
  { value: "squarespace", label: "Squarespace", keywords: ["squarespace", "static1.squarespace.com", "sqs"] },
  { value: "webflow", label: "Webflow", keywords: ["webflow", "wf-", "assets.website-files.com"] },
  { value: "gohighlevel", label: "GoHighLevel", keywords: ["gohighlevel", "highlevel", "leadconnector", "msgsndr"] },
  { value: "framer", label: "Framer", keywords: ["framer.com", "framerusercontent", "framer-"] },
  { value: "custom", label: "Custom Website", keywords: [] },
  { value: "not_sure", label: "Not Sure", keywords: [] },
];

export const PLATFORM_VALUES: PlatformValue[] = PLATFORM_OPTIONS.map((o) => o.value);

export function platformLabel(value: string | null | undefined): string {
  const match = PLATFORM_OPTIONS.find((o) => o.value === value);
  return match ? match.label : "Custom Website";
}

// Per-platform install guidance shown in Step 4. Kept short, one primary action
// per platform, copy snippet always available alongside.
export type PlatformInstall = {
  heading: string;
  intro: string;
  steps: string[];
};

export const PLATFORM_INSTALL: Record<PlatformValue, PlatformInstall> = {
  wordpress: {
    heading: "Add the code to WordPress",
    intro: "Use a header/footer code plugin (the WPCode plugin is free and reliable). A native LeadClaw plugin is coming soon.",
    steps: [
      "Install and activate the free WPCode plugin from Plugins → Add New.",
      "Open Code Snippets → Header & Footer.",
      "Paste your LeadClaw snippet into the Footer box.",
      "Save changes, then purge any caching/CDN plugin.",
    ],
  },
  shopify: {
    heading: "Add the code to Shopify",
    intro: "Paste the snippet just before the closing </body> tag in your theme.",
    steps: [
      "Go to Online Store → Themes → … → Edit code.",
      "Open Layout → theme.liquid.",
      "Paste your LeadClaw snippet immediately before </body>.",
      "Save the file.",
    ],
  },
  wix: {
    heading: "Add the code to Wix",
    intro: "Use the Custom Code section in your site settings.",
    steps: [
      "Go to Settings → Custom Code (under Advanced).",
      "Click + Add Custom Code.",
      "Paste your LeadClaw snippet and set it to load on All pages, in the Body – end.",
      "Apply and publish your site.",
    ],
  },
  squarespace: {
    heading: "Add the code to Squarespace",
    intro: "Inject the snippet via Code Injection.",
    steps: [
      "Go to Settings → Advanced → Code Injection.",
      "Paste your LeadClaw snippet into the Footer box.",
      "Save.",
      "Publish your site if it isn't already live.",
    ],
  },
  webflow: {
    heading: "Add the code to Webflow",
    intro: "Add the snippet to your site-wide custom code.",
    steps: [
      "Go to Project Settings → Custom Code.",
      "Paste your LeadClaw snippet into the Footer Code (before </body>) box.",
      "Save changes.",
      "Publish your site.",
    ],
  },
  gohighlevel: {
    heading: "Add the code to GoHighLevel",
    intro: "Add the snippet to your funnel/website tracking code.",
    steps: [
      "Open Sites → your funnel/website → Settings.",
      "Find the Tracking Code / Footer section.",
      "Paste your LeadClaw snippet into the Body / Footer area.",
      "Save and publish.",
    ],
  },
  framer: {
    heading: "Add the code to Framer",
    intro: "Add the snippet to your site's custom code.",
    steps: [
      "Open Project Settings → General → Custom Code.",
      "Paste your LeadClaw snippet into End of <body> tag.",
      "Save.",
      "Publish your site.",
    ],
  },
  custom: {
    heading: "Add the code to your website",
    intro: "Paste the snippet just before the closing </body> tag on every page.",
    steps: [
      "Open your site's main template or layout file.",
      "Paste your LeadClaw snippet immediately before </body>.",
      "Deploy / publish the change.",
      "Load your live site once so we can detect the widget.",
    ],
  },
  not_sure: {
    heading: "Not sure what powers your site?",
    intro: "No problem — the universal snippet works anywhere. Paste it before </body>, or send it to whoever manages your website.",
    steps: [
      "Copy the snippet below.",
      "Paste it before the closing </body> tag, or email it to your web person.",
      "Publish the change.",
      "Load your live site once so we can detect the widget.",
    ],
  },
};

// The shape of the JSON we persist on onboarding_sites.settings.onboarding.
export type OnboardingConfig = {
  businessName: string | null;
  websiteUrl: string | null;
  industry: IndustryValue | null;
  platform: PlatformValue | null;
  services: string[];
  openingHours: string | null;
  enquiryPhone: string | null;
  enquiryEmail: string | null;
  completed: boolean;
  completedAt: string | null;
};

export function emptyOnboardingConfig(): OnboardingConfig {
  return {
    businessName: null,
    websiteUrl: null,
    industry: null,
    platform: null,
    services: [],
    openingHours: null,
    enquiryPhone: null,
    enquiryEmail: null,
    completed: false,
    completedAt: null,
  };
}

// Detect industry from free homepage text. Returns the best-scoring industry, or
// null when nothing matches confidently.
export function detectIndustry(text: string): IndustryValue | null {
  const haystack = text.toLowerCase();
  let best: { value: IndustryValue; score: number } | null = null;

  for (const option of INDUSTRY_OPTIONS) {
    if (option.value === "other") continue;
    let score = 0;
    for (const keyword of option.keywords) {
      if (haystack.includes(keyword.toLowerCase())) score += 1;
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { value: option.value, score };
    }
  }

  return best ? best.value : null;
}

// Detect the website platform from raw HTML.
export function detectPlatform(html: string): PlatformValue | null {
  const haystack = html.toLowerCase();
  for (const option of PLATFORM_OPTIONS) {
    if (!option.keywords.length) continue;
    if (option.keywords.some((k) => haystack.includes(k.toLowerCase()))) {
      return option.value;
    }
  }
  return null;
}
