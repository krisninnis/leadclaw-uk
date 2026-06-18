"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { tryCreateClient } from "@/lib/supabase/client";
import TrialCtaLink from "@/components/trial-cta-link";
import type { Session, User } from "@supabase/supabase-js";
import {
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  GitCompare,
  Home,
  LogIn,
  MessageCircle,
  Sparkles,
  Stethoscope,
} from "lucide-react";

type NavLink = {
  href: string;
  label: string;
  icon: ReactNode;
};

const solutionsLinks: NavLink[] = [
  {
    href: "/ai-receptionist-for-dentists-uk",
    label: "Dentists",
    icon: <Stethoscope size={16} />,
  },
  {
    href: "/ai-receptionist-for-aesthetic-clinics-uk",
    label: "Aesthetic Clinics",
    icon: <Stethoscope size={16} />,
  },
  {
    href: "/ai-receptionist-for-physiotherapists-uk",
    label: "Physiotherapists",
    icon: <Stethoscope size={16} />,
  },
  {
    href: "/ai-receptionist-for-chiropractors-uk",
    label: "Chiropractors",
    icon: <Stethoscope size={16} />,
  },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Nav() {
  const pathname = usePathname() ?? "";
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [solutionsOpen, setSolutionsOpen] = useState(true);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const saved = window.localStorage.getItem("leadclaw_nav_collapsed");
      return saved === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(
        "leadclaw_nav_collapsed",
        collapsed ? "1" : "0",
      );
    } catch {
      // ignore storage errors
    }
  }, [collapsed]);

  useEffect(() => {
    const supabase = tryCreateClient();
    let mounted = true;

    if (!supabase) {
      queueMicrotask(() => {
        if (mounted) setUserEmail(null);
      });
      return;
    }

    supabase.auth
      .getUser()
      .then(({ data }: { data: { user: User | null } }) => {
        if (!mounted) return;
        setUserEmail(data.user?.email?.toLowerCase() ?? null);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: string, session: Session | null) => {
        if (!mounted) return;
        setUserEmail(session?.user?.email?.toLowerCase() ?? null);
      },
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const isSignedIn = Boolean(userEmail);

  // Primary sidebar links (Solutions is rendered separately as a dropdown).
  const primaryLinks: NavLink[] = [
    { href: "/", label: "Home", icon: <Home size={18} /> },
    { href: "/pricing", label: "Pricing", icon: <CreditCard size={18} /> },
    { href: "/compare", label: "Compare", icon: <GitCompare size={18} /> },
    { href: "/resources", label: "Resources", icon: <BookOpen size={18} /> },
  ];

  const accountLink: NavLink = isSignedIn
    ? { href: "/portal", label: "Portal", icon: <MessageCircle size={18} /> }
    : { href: "/login", label: "Login", icon: <LogIn size={18} /> };

  // Mobile bottom bar: exactly 5 slots (keeps grid-cols-5 intact).
  const mobileLinks: NavLink[] = [
    { href: "/", label: "Home", icon: <Home size={18} /> },
    {
      href: "/ai-receptionist-uk",
      label: "Solutions",
      icon: <Stethoscope size={18} />,
    },
    { href: "/pricing", label: "Pricing", icon: <CreditCard size={18} /> },
    { href: "/free-trial", label: "Free trial", icon: <Sparkles size={18} /> },
    accountLink,
  ];

  // The Sales Workspace renders its own admin-only chrome, so the public
  // marketing sidebar is hidden there (same pattern as the portal).
  if (pathname.startsWith("/portal") || pathname.startsWith("/admin/sales")) {
    return null;
  }

  const sidebarLinkClass = (active: boolean) =>
    [
      "group flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition",
      active
        ? "bg-slate-900 text-white shadow-sm"
        : "text-foreground hover:bg-white hover:shadow-sm",
      collapsed ? "justify-center" : "",
    ].join(" ");

  const solutionsActive = solutionsLinks.some((l) =>
    isActivePath(pathname, l.href),
  );

  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-50 hidden border-r border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(248,250,252,0.9))] backdrop-blur-xl transition-all duration-300 md:flex ${
          collapsed ? "w-24" : "w-80"
        }`}
      >
        <div className="flex h-full min-h-0 w-full flex-col">
          <div className="flex h-full min-h-0 flex-col overflow-y-auto p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              {!collapsed ? (
                <p className="pl-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-2">
                  Menu
                </p>
              ) : (
                <span />
              )}

              <button
                type="button"
                onClick={() => setCollapsed((value) => !value)}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-white text-sm text-foreground shadow-sm transition hover:-translate-y-0.5 hover:border-border-strong hover:bg-surface-2"
              >
                {collapsed ? (
                  <ChevronRight size={18} aria-hidden="true" />
                ) : (
                  <ChevronLeft size={18} aria-hidden="true" />
                )}
              </button>
            </div>

            <Link
              href="/"
              className={`group flex items-center gap-3 rounded-2xl border border-transparent px-3 py-3 transition hover:border-border hover:bg-white ${
                collapsed ? "justify-center" : ""
              }`}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-lg text-white shadow-sm">
                LC
              </div>

              {!collapsed && (
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    LeadClaw
                  </p>
                  <p className="truncate text-xs text-muted">
                    AI receptionist software
                  </p>
                </div>
              )}
            </Link>

            <nav className="mt-6 flex flex-col gap-2">
              {/* Home */}
              <Link
                href="/"
                className={sidebarLinkClass(isActivePath(pathname, "/"))}
                title={collapsed ? "Home" : undefined}
              >
                <span className="shrink-0">
                  <Home size={18} />
                </span>
                {!collapsed && <span>Home</span>}
              </Link>

              {/* Solutions dropdown */}
              {collapsed ? (
                <Link
                  href="/ai-receptionist-uk"
                  className={sidebarLinkClass(solutionsActive)}
                  title="Solutions"
                >
                  <span className="shrink-0">
                    <Stethoscope size={18} />
                  </span>
                </Link>
              ) : (
                <div>
                  <button
                    type="button"
                    onClick={() => setSolutionsOpen((v) => !v)}
                    aria-expanded={solutionsOpen}
                    className={[
                      "group flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition",
                      solutionsActive
                        ? "bg-slate-900 text-white shadow-sm"
                        : "text-foreground hover:bg-white hover:shadow-sm",
                    ].join(" ")}
                  >
                    <span className="shrink-0">
                      <Stethoscope size={18} />
                    </span>
                    <span className="flex-1 text-left">Solutions</span>
                    <ChevronDown
                      size={16}
                      className={`shrink-0 transition-transform ${
                        solutionsOpen ? "rotate-180" : ""
                      }`}
                      aria-hidden="true"
                    />
                  </button>

                  {solutionsOpen && (
                    <div className="mt-1 ml-4 flex flex-col gap-1 border-l border-border pl-3">
                      {solutionsLinks.map((link) => {
                        const active = isActivePath(pathname, link.href);
                        return (
                          <Link
                            key={link.href}
                            href={link.href}
                            className={[
                              "rounded-xl px-3 py-2 text-sm transition",
                              active
                                ? "bg-brand-soft font-semibold text-brand-strong"
                                : "text-muted hover:bg-white hover:text-foreground",
                            ].join(" ")}
                          >
                            {link.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Pricing, Compare, Resources */}
              {primaryLinks
                .filter((l) => l.href !== "/")
                .map((link) => {
                  const active = isActivePath(pathname, link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={sidebarLinkClass(active)}
                      title={collapsed ? link.label : undefined}
                    >
                      <span className="shrink-0">{link.icon}</span>
                      {!collapsed && <span>{link.label}</span>}
                    </Link>
                  );
                })}

              {/* Account (Login / Portal) */}
              <Link
                href={accountLink.href}
                className={sidebarLinkClass(
                  isActivePath(pathname, accountLink.href),
                )}
                title={collapsed ? accountLink.label : undefined}
              >
                <span className="shrink-0">{accountLink.icon}</span>
                {!collapsed && <span>{accountLink.label}</span>}
              </Link>
            </nav>

            {/* Start Free Trial CTA */}
            <div className="mt-6">
              <TrialCtaLink
                href="/free-trial"
                location="sidebar_cta"
                className={[
                  "button-primary flex w-full items-center justify-center gap-2",
                  collapsed ? "px-0" : "",
                ].join(" ")}
              >
                <Sparkles size={16} className="shrink-0" aria-hidden="true" />
                {!collapsed && <span>Start Free Trial</span>}
              </TrialCtaLink>
            </div>

            <div className="mt-auto pt-6" />
          </div>
        </div>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-white/92 backdrop-blur-xl md:hidden">
        <div className="grid grid-cols-5">
          {mobileLinks.map((link) => {
            const active = isActivePath(pathname, link.href);

            return (
              <Link
                key={`${link.href}-mobile`}
                href={link.href}
                className={[
                  "flex flex-col items-center justify-center gap-1 px-1 py-3 text-[11px] font-medium transition-colors",
                  active
                    ? "text-brand-strong"
                    : "text-muted hover:text-foreground",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex h-8 w-8 items-center justify-center rounded-full transition-all",
                    active ? "bg-brand-soft" : "",
                  ].join(" ")}
                >
                  {link.icon}
                </span>
                <span className="truncate">{link.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
