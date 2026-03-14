"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/pricing", label: "Pricing", icon: "💳" },
  { href: "/demo", label: "Demo", icon: "🧪" },
  { href: "/apply", label: "Apply", icon: "📝" },
  { href: "/portal", label: "Portal", icon: "💬" },
  { href: "/contact", label: "Contact", icon: "📨" },
  { href: "/help", label: "Help", icon: "❓" },
  { href: "/admin", label: "Admin", icon: "🛠️" },
];

const adminLinks = [
  { href: "/admin/outreach", label: "Outreach Dashboard", icon: "📊" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export default function Nav() {
  const pathname = usePathname() ?? "";
  const inAdmin = pathname.startsWith("/admin");

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-slate-200 bg-white/90 backdrop-blur md:flex md:flex-col">
        <div className="border-b border-slate-200 px-6 py-5">
          <Link
            href="/"
            className="text-lg font-semibold tracking-tight text-slate-900"
          >
            LeadClaw AI
          </Link>
          <p className="mt-1 text-xs text-slate-500">
            Automation OS for UK clinics
          </p>
        </div>

        <nav className="flex-1 space-y-2 px-4 py-4">
          {links.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                  active
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <span>{link.icon}</span>
                <span>{link.label}</span>
              </Link>
            );
          })}

          {inAdmin && (
            <>
              <div className="mt-6 border-t border-slate-200 pt-4 text-xs font-semibold uppercase text-slate-400">
                Admin Tools
              </div>

              {adminLinks.map((link) => {
                const active = isActive(pathname, link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                      active
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <span>{link.icon}</span>
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </>
          )}
        </nav>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-7">
          {links.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex flex-col items-center gap-1 px-2 py-2 text-[11px] ${
                  active ? "text-slate-900" : "text-slate-500"
                }`}
              >
                <span>{link.icon}</span>
                <span>{link.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
