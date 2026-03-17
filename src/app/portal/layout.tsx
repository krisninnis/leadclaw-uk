import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canUseLeadClawProduct } from "@/lib/subscription-access";
import PortalMobileNav from "../../components/portal-mobile-nav";
import PortalSidebarNav from "../../components/portal-sidebar-nav";

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
    .select("status, updated_at")
    .eq("email", user.email)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const allowed = canUseLeadClawProduct(subscription?.status || null);

  if (!allowed) {
    redirect("/free-trial?plan=growth");
  }

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

          <PortalSidebarNav links={portalLinks} />
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-[1500px]">{children}</div>
        </div>
      </div>

      <PortalMobileNav links={portalLinks} />
    </>
  );
}
