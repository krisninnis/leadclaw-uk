"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

type NavLink = {
  href: string;
  label: string;
  icon: string;
};

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return null;

  return createSupabaseClient(url, anonKey);
}

export default function Nav() {
  const pathname = usePathname() ?? "";
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("leadclaw_nav_collapsed");
      if (saved === "1") setCollapsed(true);
    } catch {
      // ignore storage errors
    }
  }, []);

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
    const supabase = getSupabaseClient();

    if (!supabase) {
      setAuthReady(true);
      return;
    }

    let mounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setUserEmail(data.user?.email?.toLowerCase() ?? null);
      setAuthReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUserEmail(session?.user?.email?.toLowerCase() ?? null);
      setAuthReady(true);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const adminEmails = useMemo(
    () =>
      ["kris@leadclaw.uk", "krisninnis@gmail.com"].map((email) =>
        email.toLowerCase(),
      ),
    [],
  );

  const isSignedIn = Boolean(userEmail);
  const isAdmin = Boolean(userEmail && adminEmails.includes(userEmail));

  const links: NavLink[] = [
    { href: "/", label: "Home", icon: "🏠" },
    { href: "/pricing", label: "Pricing", icon: "💳" },
    { href: "/demo", label: "Demo", icon: "🧪" },
    { href: "/contact", label: "Contact", icon: "📨" },
    ...(isSignedIn
      ? [{ href: "/portal", label: "Portal", icon: "💬" }]
      : [{ href: "/login", label: "Login", icon: "🔐" }]),
    ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: "🛠️" }] : []),
  ];

  if (pathname.startsWith("/portal")) {
    return null;
  }

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
                  Workspace
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
                {collapsed ? "→" : "←"}
              </button>
            </div>

            <Link
              href="/"
              className={[
                "group flex items-center gap-3 rounded-[24px] border border-border bg-white/80 p-3 shadow-sm transition",
                collapsed ? "justify-center" : "",
              ].join(" ")}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-white shadow-sm">
                <Image
                  src="/brand/icons/leadclaw-logo-dark.png"
                  alt="LeadClaw"
                  width={36}
                  height={36}
                  className="h-auto w-auto object-contain"
                  priority
                />
              </div>

              {!collapsed ? (
                <div className="min-w-0 leading-tight">
                  <div className="text-base font-semibold tracking-tight text-foreground">
                    LeadClaw
                  </div>
                  <div className="text-xs text-muted">
                    AI front desk for clinics
                  </div>
                </div>
              ) : null}
            </Link>

            <div className="mt-8">
              {!collapsed ? (
                <p className="px-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-2">
                  Navigation
                </p>
              ) : null}

              <nav className="mt-3 flex flex-col gap-3">
                {links.map((link) => {
                  const active = isActivePath(pathname, link.href);

                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={[
                        "group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200",
                        collapsed ? "justify-center px-3" : "",
                        active
                          ? "bg-brand-soft text-foreground shadow-sm ring-1 ring-brand/10"
                          : "text-muted hover:bg-surface-2 hover:text-foreground hover:shadow-sm",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "flex h-10 w-10 items-center justify-center rounded-xl border text-sm shadow-sm transition-all duration-200",
                          active
                            ? "border-brand/20 bg-white text-brand-strong"
                            : "border-border bg-white text-foreground group-hover:border-border-strong",
                        ].join(" ")}
                      >
                        {link.icon}
                      </span>

                      {!collapsed ? <span>{link.label}</span> : null}

                      {!collapsed && active ? (
                        <span className="ml-auto h-2.5 w-2.5 rounded-full bg-brand" />
                      ) : null}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {!collapsed ? (
              <div className="mt-8 rounded-[24px] border border-border bg-white/80 p-4 shadow-sm">
                <p className="text-sm font-semibold text-foreground">
                  Recover more missed enquiries
                </p>
                <p className="mt-2 text-xs leading-6 text-muted">
                  Give your clinic an AI front desk that captures website
                  interest and turns it into follow-up-ready leads.
                </p>
              </div>
            ) : null}

            <div className="mt-auto space-y-3 pt-6">
              {isSignedIn ? (
                <Link
                  href="/portal"
                  className={
                    collapsed
                      ? "button-secondary px-0 text-center"
                      : "button-secondary w-full"
                  }
                >
                  {collapsed ? "💬" : "Open portal"}
                </Link>
              ) : (
                <Link
                  href="/login"
                  className={
                    collapsed
                      ? "button-secondary px-0 text-center"
                      : "button-secondary w-full"
                  }
                >
                  {collapsed ? "🔐" : "Sign in"}
                </Link>
              )}

              <Link
                href="/free-trial?plan=growth"
                className={
                  collapsed
                    ? "button-primary px-0 text-center"
                    : "button-primary w-full"
                }
              >
                {collapsed ? "✨" : "Start 7-day free trial"}
              </Link>

              {authReady && isAdmin ? (
                <Link
                  href="/admin"
                  className={
                    collapsed
                      ? "button-secondary px-0 text-center"
                      : "button-secondary w-full"
                  }
                >
                  {collapsed ? "🛠️" : "Admin portal"}
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-white/92 backdrop-blur-xl md:hidden">
        <div className={`grid ${isAdmin ? "grid-cols-6" : "grid-cols-5"}`}>
          {links.map((link) => {
            const active = isActivePath(pathname, link.href);

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
