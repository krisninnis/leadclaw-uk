import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  canAccessPortal,
  hasFullLeadClawAccess,
  isLimitedSubscription,
  normalizeSubscriptionStatus,
} from "@/lib/subscription-access";
import PortalMobileNav from "../../components/portal-mobile-nav";
import PortalSidebarNav from "../../components/portal-sidebar-nav";

type PortalLink = {
  href: string;
  label: string;
  icon: string;
};

function titleCase(value: string | null | undefined) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (!normalized) return "Unknown";
  return normalized.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

export default async function PortalLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect("/login?next=/portal");
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("status,plan,trial_end,updated_at")
    .eq("email", user.email)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const subscriptionStatus = normalizeSubscriptionStatus(subscription?.status);
  const currentPlan = String(subscription?.plan || "basic").toLowerCase();

  const canEnterPortal = canAccessPortal(subscriptionStatus, currentPlan);
  const hasFullAccess = hasFullLeadClawAccess(subscriptionStatus);
  const isLimitedAccess = isLimitedSubscription(
    subscriptionStatus,
    currentPlan,
  );

  if (!canEnterPortal) {
    redirect("/free-trial?plan=growth");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const isAdminEmail = adminEmails.includes(user.email.toLowerCase());
  const isAdmin = profile?.role === "admin" || isAdminEmail;

  const fullPortalLinks: PortalLink[] = [
    { href: "/portal", label: "Dashboard", icon: "🏠" },
    { href: "/portal/leads", label: "Leads", icon: "📥" },
    { href: "/portal/install", label: "Install", icon: "🧩" },
    { href: "/portal/support", label: "Support", icon: "💬" },
    { href: "/portal/billing", label: "Billing", icon: "💳" },
    { href: "/portal/settings", label: "Settings", icon: "⚙️" },
    { href: "/portal/resources", label: "Resources", icon: "📘" },
    { href: "/portal/activity", label: "Activity", icon: "📈" },
  ];

  const limitedPortalLinks: PortalLink[] = [
    { href: "/portal", label: "Dashboard", icon: "🏠" },
    { href: "/portal/billing", label: "Billing", icon: "💳" },
    { href: "/portal/settings", label: "Settings", icon: "⚙️" },
    { href: "/portal/support", label: "Support", icon: "💬" },
    { href: "/portal/resources", label: "Resources", icon: "📘" },
  ];

  const portalLinks: PortalLink[] = [
    ...(hasFullAccess ? fullPortalLinks : limitedPortalLinks),
    ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: "🛠️" }] : []),
  ];

  const showLimitedBanner = isLimitedAccess;
  const trialEnded = subscriptionStatus === "expired";

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
                {hasFullAccess
                  ? "Clinic workspace for leads, install, billing, and support."
                  : "Basic workspace with billing, support, and upgrade access."}
              </p>
            </div>
          </div>

          <PortalSidebarNav links={portalLinks} />
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-[1500px] space-y-6">
            {showLimitedBanner && (
              <div className="rounded-[24px] border border-amber-300 bg-amber-50 p-5">
                <h2 className="text-lg font-semibold text-amber-950">
                  {trialEnded
                    ? "Your free trial has ended"
                    : "You are currently on the Basic package"}
                </h2>
                <p className="mt-2 text-sm leading-7 text-amber-900">
                  {trialEnded
                    ? "Your 7-day free trial has ended and your account has been moved to Basic. Upgrade to Growth or Pro to keep full access to LeadClaw features."
                    : "Your account is currently using the Basic package. Upgrade to Growth or Pro to unlock the full LeadClaw experience."}
                </p>
                <div className="mt-3 flex flex-wrap gap-3 text-sm text-amber-950">
                  <span className="rounded-full bg-white px-3 py-1 shadow-sm">
                    Current plan: {titleCase(currentPlan)}
                  </span>
                  <span className="rounded-full bg-white px-3 py-1 shadow-sm">
                    Status: {titleCase(subscriptionStatus)}
                  </span>
                </div>
                <div className="mt-4">
                  <a href="/portal/billing" className="button-primary">
                    View plans and upgrade
                  </a>
                </div>
              </div>
            )}

            {children}
          </div>
        </div>
      </div>

      <PortalMobileNav links={portalLinks} />
    </>
  );
}
