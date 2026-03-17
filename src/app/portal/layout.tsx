"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
const portalLinks = [
  { href: "/portal", label: "Dashboard" },
  { href: "/portal/leads", label: "Leads" },
  { href: "/portal/install", label: "Install" },
  { href: "/portal/support", label: "Support" },
  { href: "/portal/billing", label: "Billing" },
  { href: "/portal/settings", label: "Settings" },
  { href: "/portal/resources", label: "Resources" },
  { href: "/portal/activity", label: "Activity" },
];

function isActive(pathname: string, href: string) {
  if (href === "/portal") return pathname === "/portal";
  return pathname.startsWith(href);
}

export default function PortalLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";

  return (
    <div className="mx-auto flex w-full max-w-[1440px] gap-6 px-4 pb-10 pt-4 md:px-6">
      <aside className="hidden w-72 shrink-0 rounded-[28px] border border-border bg-white p-4 shadow-sm lg:block">
        <div className="mb-6 rounded-[24px] border border-border bg-surface-2 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-2">
            Client portal
          </p>
          <h2 className="mt-2 text-lg font-semibold text-foreground">
            LeadClaw
          </h2>
          <p className="mt-1 text-sm text-muted">
            Clinic workspace for leads, install, billing, and support.
          </p>
        </div>

        <nav className="flex flex-col gap-2">
          {portalLinks.map((link) => {
            const active = isActive(pathname, link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={[
                  "rounded-2xl px-4 py-3 text-sm font-medium transition",
                  active
                    ? "bg-brand-soft text-foreground"
                    : "text-muted hover:bg-surface-2 hover:text-foreground",
                ].join(" ")}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
