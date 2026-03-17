"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const portalLinks = [
  { href: "/portal", label: "Dashboard", icon: "🏠" },
  { href: "/portal/leads", label: "Leads", icon: "📥" },
  { href: "/portal/install", label: "Install", icon: "🧩" },
  { href: "/portal/support", label: "Support", icon: "💬" },
  { href: "/portal/billing", label: "Billing", icon: "💳" },
  { href: "/portal/settings", label: "Settings", icon: "⚙️" },
  { href: "/portal/resources", label: "Resources", icon: "📘" },
  { href: "/portal/activity", label: "Activity", icon: "📈" },
];

function isActive(pathname: string, href: string) {
  if (href === "/portal") return pathname === "/portal";
  return pathname.startsWith(href);
}

export default function PortalLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";

  return (
    <>
      <div className="mx-auto flex w-full max-w-none gap-6 px-4 pb-28 pt-4 md:px-6 xl:px-8 2xl:px-10">
        <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-80 shrink-0 overflow-hidden rounded-[28px] border border-border bg-white shadow-sm lg:flex lg:flex-col">
          <div className="border-b border-border p-5">
            <div className="rounded-[24px] border border-border bg-surface-2 p-4">
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
          </div>

          <nav className="flex-1 space-y-2 overflow-y-auto p-4">
            {portalLinks.map((link) => {
              const active = isActive(pathname, link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={[
                    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition",
                    active
                      ? "bg-brand-soft text-foreground shadow-sm"
                      : "text-muted hover:bg-surface-2 hover:text-foreground",
                  ].join(" ")}
                >
                  <span className="text-base">{link.icon}</span>
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-[1500px]">{children}</div>
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-white/95 backdrop-blur-xl lg:hidden">
        <div className="grid grid-cols-4 sm:grid-cols-8">
          {portalLinks.map((link) => {
            const active = isActive(pathname, link.href);

            return (
              <Link
                key={`${link.href}-mobile`}
                href={link.href}
                className={[
                  "flex flex-col items-center justify-center gap-1 px-2 py-3 text-[11px] font-medium transition-colors",
                  active
                    ? "text-brand-strong"
                    : "text-muted hover:text-foreground",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex h-8 w-8 items-center justify-center rounded-full text-base transition-all",
                    active ? "bg-brand-soft" : "",
                  ].join(" ")}
                >
                  {link.icon}
                </span>
                <span>{link.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
