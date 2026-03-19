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
    price: "Free",
    period: "",
    description:
      "A simple AI receptionist widget to capture enquiries. No automation included.",
    mascot: "Fox",
    themeClass:
      "border-amber-200 bg-[linear-gradient(180deg,rgba(255,251,235,0.95),rgba(255,255,255,0.96))]",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-200",
    buttonClass:
      "inline-flex items-center justify-center rounded-full bg-amber-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-amber-600",
    features: [
      "AI website enquiry widget",
      "Basic lead capture",
      "Limited monthly conversations",
      "No automated follow-ups",
      "No missed call recovery",
      "Self-setup only",
    ],
    cta: "/free-trial?plan=growth",
  },
  {
    name: "Growth",
    slug: "growth",
    price: "£79",
    period: "/month",
    description:
      "Turn missed enquiries into booked appointments with automation and follow-up.",
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
      "Automated follow-ups (email/SMS)",
      "Missed call → instant text reply",
      "Lead notifications",
      "Clinic lead dashboard",
      "7-day free trial included",
    ],
    cta: "/free-trial?plan=growth",
  },
  {
    name: "Pro",
    slug: "pro",
    price: "£149",
    period: "/month",
    description:
      "Advanced automation and performance tools for clinics serious about growth.",
    mascot: "Dragon",
    themeClass:
      "border-cyan-200 bg-[linear-gradient(180deg,rgba(236,254,255,0.96),rgba(255,255,255,0.96))]",
    badgeClass: "bg-cyan-100 text-cyan-800 border-cyan-200",
    buttonClass:
      "inline-flex items-center justify-center rounded-full bg-cyan-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-cyan-700",
    features: [
      "Everything in Growth",
      "Advanced automation flows",
      "Multi-location support",
      "Performance analytics dashboard",
      "Priority onboarding support",
      "Custom AI tuning for your clinic",
    ],
    cta: "/free-trial?plan=pro",
  },
];

export const comparisonRows: ComparisonRow[] = [
  {
    label: "AI website widget",
    values: ["Included", "Included", "Included"],
  },
  {
    label: "Lead capture",
    values: ["Basic", "Advanced", "Advanced"],
  },
  {
    label: "Automated follow-ups",
    values: ["—", "Included", "Included"],
  },
  {
    label: "Missed call recovery",
    values: ["—", "Included", "Included"],
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
      "You start on the Growth plan for 7 days. This lets you experience full automation, lead capture, and follow-ups before deciding to continue.",
  },
  {
    question: "What happens after the 7-day trial?",
    answer:
      "You can continue on Growth, upgrade to Pro, or switch to the free Basic plan with limited functionality.",
  },
  {
    question: "Do I need a new website?",
    answer:
      "No. LeadClaw works with your existing clinic website using a lightweight widget.",
  },
  {
    question: "Can this actually generate bookings?",
    answer:
      "Yes. The system captures and follows up with missed enquiries automatically, helping turn more visitors into booked appointments.",
  },
];
