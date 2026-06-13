import { PLAN_MONTHLY_PRICES } from "@/lib/plans";

export type PricingPlan = {
  name: string;
  slug: "basic" | "growth" | "pro";
  price: string;
  period: string;
  description: string;
  mascot: string;
  themeClass: string;
  badgeClass: string;
  buttonClass: string;
  featured?: boolean;
  features: string[];
  cta: string;
};

export type ComparisonRow = {
  label: string;
  values: [string, string, string];
};

export type PricingFaq = {
  question: string;
  answer: string;
};

export const plans: PricingPlan[] = [
  {
    name: "Basic",
    slug: "basic",
    price: PLAN_MONTHLY_PRICES.basic.display,
    period: "",
    description:
      "A simple AI Receptionist widget for capturing requests on your website. No advanced automation included.",
    mascot: "Fox",
    themeClass:
      "border-amber-200 bg-[linear-gradient(180deg,rgba(255,251,235,0.95),rgba(255,255,255,0.96))]",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-200",
    buttonClass:
      "inline-flex items-center justify-center rounded-full bg-amber-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-amber-600",
    features: [
      "AI website intake widget",
      "Basic request capture",
      "Limited monthly conversations",
      "Workspace lead inbox",
      "Self-setup install guide",
      "Upgrade when you need automations",
    ],
    cta: "/signup?plan=basic",
  },
  {
    name: "Growth",
    slug: "growth",
    price: PLAN_MONTHLY_PRICES.growth.display,
    period: "/month",
    description:
      "AI workflows for capturing requests, tracking leads, and automating follow-ups.",
    mascot: "Panther",
    themeClass:
      "border-violet-200 bg-[linear-gradient(180deg,rgba(248,245,255,0.96),rgba(255,255,255,0.96))]",
    badgeClass: "bg-violet-100 text-violet-800 border-violet-200",
    buttonClass:
      "button-primary inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold",
    featured: true,
    features: [
      "Everything in Basic",
      "Unlimited AI conversations",
      "Follow-Up Assistant workflows",
      "Lead notifications",
      "Lead Tracker workspace",
      "Data Cleaner for messy inputs",
      "7-day free trial included",
    ],
    cta: "/free-trial?plan=growth",
  },
  {
    name: "Pro",
    slug: "pro",
    price: PLAN_MONTHLY_PRICES.pro.display,
    period: "/month",
    description:
      "Advanced automation and reporting tools for teams with more complex operations.",
    mascot: "Dragon",
    themeClass:
      "border-cyan-200 bg-[linear-gradient(180deg,rgba(236,254,255,0.96),rgba(255,255,255,0.96))]",
    badgeClass: "bg-cyan-100 text-cyan-800 border-cyan-200",
    buttonClass:
      "inline-flex items-center justify-center rounded-full bg-cyan-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-cyan-700",
    features: [
      "Everything in Growth",
      "Advanced automation flows",
      "Document Extractor workflows",
      "Weekly Report Bot",
      "Performance analytics dashboard",
      "Priority onboarding support",
      "Custom AI tuning for your workspace",
    ],
    cta: "/free-trial?plan=pro",
  },
];

export const comparisonRows: ComparisonRow[] = [
  {
    label: "AI Receptionist widget",
    values: ["Included", "Included", "Included"],
  },
  {
    label: "Request capture",
    values: ["Basic", "Advanced", "Advanced"],
  },
  {
    label: "Automated follow-ups",
    values: ["Not included", "Included", "Included"],
  },
  {
    label: "Data Cleaner",
    values: ["Not included", "Included", "Included"],
  },
  {
    label: "Document Extractor",
    values: ["Not included", "Not included", "Included"],
  },
  {
    label: "Weekly Report Bot",
    values: ["Not included", "Not included", "Included"],
  },
  {
    label: "Monthly conversations",
    values: ["Limited", "Unlimited", "Unlimited"],
  },
  {
    label: "Support level",
    values: ["Self-serve", "Standard", "Priority"],
  },
];

export const faqs: PricingFaq[] = [
  {
    question: "How does the free trial work?",
    answer:
      "You start on the Growth plan for 7 days. This lets you experience core workflow automation, request capture, and follow-ups before deciding to continue.",
  },
  {
    question: "What happens after the 7-day trial?",
    answer:
      "You can continue on Growth, upgrade to Pro, or switch to the free Basic plan with limited functionality.",
  },
  {
    question: "Do I need a new website?",
    answer:
      "No. LeadClaw works with your existing business website using a lightweight widget.",
  },
  {
    question: "Can this help my team save admin time?",
    answer:
      "Yes. LeadClaw captures requests, keeps work visible, and automates routine follow-ups so your team spends less time chasing details manually.",
  },
];
