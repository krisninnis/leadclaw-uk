export type PricingPlan = {
  name: string;
  slug: "starter" | "growth" | "pro";
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
    name: "Starter",
    slug: "starter",
    price: "£49",
    period: "/month",
    description: "Friendly lead capture for smaller clinics getting started.",
    mascot: "Fox",
    themeClass:
      "border-amber-200 bg-[linear-gradient(180deg,rgba(255,251,235,0.95),rgba(255,255,255,0.96))]",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-200",
    buttonClass:
      "inline-flex items-center justify-center rounded-full bg-amber-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-amber-600",
    features: [
      "AI website enquiry widget",
      "Lead capture into clinic portal",
      "Email notifications",
      "Simple setup",
      "Best for smaller clinics",
    ],
    cta: "/checkout?plan=starter",
  },
  {
    name: "Growth",
    slug: "growth",
    price: "£99",
    period: "/month",
    description:
      "More power for clinics that want stronger follow-up and better lead handling.",
    mascot: "Panther",
    themeClass:
      "border-violet-200 bg-[linear-gradient(180deg,rgba(248,245,255,0.96),rgba(255,255,255,0.96))]",
    badgeClass: "bg-violet-100 text-violet-800 border-violet-200",
    buttonClass:
      "button-primary inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold",
    featured: true,
    features: [
      "Everything in Starter",
      "Priority clinic workflow",
      "Improved lead visibility",
      "Better fit for active clinics",
      "Recommended plan",
    ],
    cta: "/checkout?plan=growth",
  },
  {
    name: "Pro",
    slug: "pro",
    price: "£199",
    period: "/month",
    description:
      "Flagship automation tier for ambitious clinics that want the strongest setup.",
    mascot: "Dragon",
    themeClass:
      "border-cyan-200 bg-[linear-gradient(180deg,rgba(236,254,255,0.96),rgba(255,255,255,0.96))]",
    badgeClass: "bg-cyan-100 text-cyan-800 border-cyan-200",
    buttonClass:
      "inline-flex items-center justify-center rounded-full bg-cyan-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-cyan-700",
    features: [
      "Everything in Growth",
      "Premium plan positioning",
      "Best for high-intent clinics",
      "Stronger premium branding fit",
      "Top-tier LeadClaw experience",
    ],
    cta: "/checkout?plan=pro",
  },
];

export const comparisonRows: ComparisonRow[] = [
  {
    label: "Website enquiry capture",
    values: ["Included", "Included", "Included"],
  },
  {
    label: "Clinic lead portal",
    values: ["Included", "Included", "Included"],
  },
  {
    label: "Email alerts",
    values: ["Included", "Included", "Included"],
  },
  {
    label: "Plan theme / premium presentation",
    values: ["Basic", "Enhanced", "Flagship"],
  },
  {
    label: "Best clinic stage",
    values: ["Getting started", "Growing", "Established / scaling"],
  },
];

export const faqs: PricingFaq[] = [
  {
    question: "How quickly can I get started?",
    answer:
      "LeadClaw is designed to be lightweight. Once your clinic is set up and the widget is installed, you can begin capturing website enquiries without rebuilding your site.",
  },
  {
    question: "Do I need a new website?",
    answer:
      "No. The product is designed to sit on top of your existing clinic website using a lightweight widget approach.",
  },
  {
    question: "Which plan should most clinics choose?",
    answer:
      "Growth is the best default for most clinics because it gives a stronger, more premium setup while still staying cost-effective.",
  },
  {
    question: "Can one extra treatment lead justify the subscription?",
    answer:
      "In many clinics, yes. A single recovered enquiry for a treatment can easily outweigh a monthly subscription if it turns into a booking.",
  },
];
