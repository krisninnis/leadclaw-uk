"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type FooterLink = { href: string; label: string };

const productLinks: FooterLink[] = [
  { href: "/pricing", label: "Pricing" },
  { href: "/demo", label: "Book a demo" },
  { href: "/free-trial", label: "Free trial" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/help", label: "Help" },
];

const solutionsLinks: FooterLink[] = [
  { href: "/ai-receptionist-for-dentists-uk", label: "Dentists" },
  { href: "/ai-receptionist-for-aesthetic-clinics-uk", label: "Aesthetic clinics" },
  { href: "/ai-receptionist-for-physiotherapists-uk", label: "Physiotherapists" },
  { href: "/ai-receptionist-for-chiropractors-uk", label: "Chiropractors" },
  { href: "/ai-receptionist-uk", label: "All solutions" },
];

const compareLinks: FooterLink[] = [
  { href: "/compare", label: "Compare alternatives" },
  { href: "/pricing", label: "Plans & pricing" },
];

const companyLinks: FooterLink[] = [
  { href: "/contact", label: "Contact" },
  { href: "/resources", label: "Resources" },
];

const legalLinks: FooterLink[] = [
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/dpa", label: "DPA" },
  { href: "/legal/trial-waiver", label: "Trial Terms" },
  { href: "/legal/compliance-checklist", label: "Compliance" },
];

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: FooterLink[];
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-2">
        {title}
      </p>
      <ul className="mt-4 space-y-2">
        {links.map((link) => (
          <li key={`${title}-${link.href}-${link.label}`}>
            <Link
              href={link.href}
              className="text-sm text-muted transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function AppFooter() {
  const pathname = usePathname() ?? "";

  // Sales Workspace is a focused admin app surface; hide the public footer
  // there (same pattern as the portal).
  if (pathname.startsWith("/portal") || pathname.startsWith("/admin/sales")) {
    return null;
  }

  return (
    <footer className="border-t border-border bg-white/80 backdrop-blur-sm md:ml-[320px]">
      <div className="container-shell py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-sm font-bold text-white">
                LC
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">LeadClaw</p>
                <p className="text-xs text-muted">AI receptionist software</p>
              </div>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-7 text-muted">
              AI receptionist and lead capture for UK service businesses -
              answer every call and enquiry, capture the lead, and follow up
              automatically.
            </p>
          </div>

          <FooterColumn title="Product" links={productLinks} />
          <FooterColumn title="Solutions" links={solutionsLinks} />
          <FooterColumn title="Compare" links={compareLinks} />
          <FooterColumn title="Company" links={companyLinks} />
          <FooterColumn title="Legal" links={legalLinks} />
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-border pt-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <span className="text-muted-2">
            Copyright {new Date().getFullYear()} LeadClaw. UK-based AI
            receptionist software
          </span>
          <span className="flex flex-wrap gap-4">
            <Link
              href="/legal/privacy"
              className="transition-colors hover:text-foreground"
            >
              Privacy
            </Link>
            <Link
              href="/legal/terms"
              className="transition-colors hover:text-foreground"
            >
              Terms
            </Link>
            <Link
              href="/contact"
              className="transition-colors hover:text-foreground"
            >
              Contact
            </Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
