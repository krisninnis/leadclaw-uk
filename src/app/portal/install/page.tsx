import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildWidgetSnippet } from "@/lib/onboarding";
import InstallSnippetCard from "@/components/install-snippet-card";
import { SectionHeading } from "@/components/ui";

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function formatSiteStatus(value: string | null | undefined) {
  if (!value) return "Pending";
  return value.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function getWidgetStatusTone(widgetStatus: string) {
  const lower = widgetStatus.toLowerCase();

  if (lower === "live") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (lower === "pending install") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  if (lower === "ready to install") {
    return "border-sky-200 bg-sky-50 text-sky-800";
  }

  if (lower === "paused") {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }

  return "border-slate-200 bg-slate-50 text-slate-800";
}

export default async function PortalInstallPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const admin = createAdminClient();

  let hasActiveSubscription = false;
  let portalContext: {
    domain: string | null;
    siteStatus: string | null;
    widgetToken: string | null;
    widgetLastSeenAt: string | null;
    widgetLastSeenDomain: string | null;
  } | null = null;

  if (admin) {
    const { data: subscription } = await admin
      .from("subscriptions")
      .select("status")
      .eq("email", user.email || "")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const rawSubscriptionStatus = String(
      subscription?.status || "",
    ).toLowerCase();
    hasActiveSubscription = ["trialing", "active", "past_due"].includes(
      rawSubscriptionStatus,
    );

    if (user.email) {
      const { data: client } = await admin
        .from("onboarding_clients")
        .select("id")
        .eq("contact_email", user.email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (client?.id) {
        const { data: site } = await admin
          .from("onboarding_sites")
          .select("id,domain,status")
          .eq("onboarding_client_id", client.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        let widgetToken: string | null = null;
        let widgetLastSeenAt: string | null = null;
        let widgetLastSeenDomain: string | null = null;

        if (site?.id) {
          const { data: tokenRow } = await admin
            .from("widget_tokens")
            .select("token,last_seen_at,last_seen_domain")
            .eq("onboarding_site_id", site.id)
            .eq("status", "active")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          widgetToken = tokenRow?.token || null;
          widgetLastSeenAt = tokenRow?.last_seen_at || null;
          widgetLastSeenDomain = tokenRow?.last_seen_domain || null;
        }

        portalContext = {
          domain: site?.domain || null,
          siteStatus: site?.status || null,
          widgetToken,
          widgetLastSeenAt,
          widgetLastSeenDomain,
        };
      }
    }
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://leadclaw.uk";
  const widgetSnippet = portalContext?.widgetToken
    ? buildWidgetSnippet(appUrl, portalContext.widgetToken)
    : "";
  const snippetReady = widgetSnippet.trim().length > 0;
  const widgetDetected = Boolean(portalContext?.widgetLastSeenAt);

  const widgetStatus = !hasActiveSubscription
    ? "Paused"
    : widgetDetected
      ? "Live"
      : portalContext?.siteStatus === "pending_install"
        ? "Pending install"
        : snippetReady
          ? "Ready to install"
          : "Preparing";

  const widgetToneClasses = getWidgetStatusTone(widgetStatus);

  return (
    <div className="space-y-6">
      <div className="card-premium p-6 md:p-8">
        <SectionHeading
          eyebrow="Installation"
          title="Install your LeadClaw widget"
          description="Copy your install snippet, publish it on your website, and confirm when the widget is live."
          maxWidth="lg"
        />

        <div className={`mt-6 rounded-[24px] border p-5 ${widgetToneClasses}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{widgetStatus}</p>
              <p className="mt-1 text-sm opacity-90">
                {hasActiveSubscription
                  ? widgetDetected
                    ? "Your widget has been detected on a live website."
                    : "Install and publish your snippet to start capturing leads."
                  : "Your widget is paused until your subscription is reactivated."}
              </p>
            </div>
            <span
              className={`h-3 w-3 rounded-full ${
                widgetDetected ? "bg-emerald-500" : "bg-amber-400"
              }`}
            />
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-[22px] border border-border bg-white p-5">
            <p className="text-sm font-medium text-muted">Site</p>
            <p className="mt-2 text-base font-semibold text-foreground">
              {portalContext?.domain || "Preparing setup"}
            </p>
            <p className="mt-2 text-sm text-muted">
              Setup status: {formatSiteStatus(portalContext?.siteStatus)}
            </p>
          </div>

          <div className="rounded-[22px] border border-border bg-white p-5">
            <p className="text-sm font-medium text-muted">Widget detection</p>
            <p className="mt-2 text-base font-semibold text-foreground">
              {widgetDetected ? "Detected" : "Not detected yet"}
            </p>
            <p className="mt-2 text-sm text-muted">
              Last seen:{" "}
              {formatDateTime(portalContext?.widgetLastSeenAt || null)}
            </p>
          </div>
        </div>

        {widgetDetected && (
          <div className="mt-4 rounded-[22px] border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
            <p className="font-semibold">Widget detected live</p>
            <p className="mt-2">
              Last seen:{" "}
              <strong>
                {formatDateTime(portalContext?.widgetLastSeenAt || null)}
              </strong>
            </p>
            <p className="mt-1">
              Domain:{" "}
              <strong>{portalContext?.widgetLastSeenDomain || "—"}</strong>
            </p>
          </div>
        )}

        {!widgetDetected && snippetReady && hasActiveSubscription && (
          <div className="mt-4 rounded-[22px] border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            <p className="font-semibold">Widget not detected yet</p>
            <p className="mt-2 leading-7">
              Install the snippet, publish your site, then refresh this page
              after visiting your live website.
            </p>
          </div>
        )}

        {!hasActiveSubscription && (
          <div className="mt-4 rounded-[22px] border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900">
            <p className="font-semibold">Widget paused</p>
            <p className="mt-2 leading-7">
              Your website widget is currently turned off because your
              subscription is not active. Reactivate your package to restore
              live capture on your website.
            </p>
          </div>
        )}
      </div>

      {hasActiveSubscription ? (
        <div className="card-premium p-6 md:p-8">
          <SectionHeading
            eyebrow="Install snippet"
            title="Your website code"
            description="Paste this on your website to activate your LeadClaw enquiry widget."
            maxWidth="lg"
          />

          <div className="mt-6 space-y-4">
            {snippetReady ? (
              <>
                <InstallSnippetCard widgetSnippet={widgetSnippet} />

                <div className="rounded-[24px] border border-border bg-surface-2 p-5 text-sm text-muted">
                  <p className="font-semibold text-foreground">
                    Quick install instructions
                  </p>
                  <ol className="mt-3 list-decimal space-y-2 pl-5 leading-7">
                    <li>Open your website editor or codebase.</li>
                    <li>
                      Paste the script before the closing &lt;/body&gt; tag.
                    </li>
                    <li>Publish the site changes.</li>
                    <li>
                      Visit your live website, then return here and refresh to
                      confirm the widget has been detected.
                    </li>
                  </ol>
                </div>
              </>
            ) : (
              <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Install package exists, but the widget snippet is not ready yet.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="card-premium p-6 md:p-8">
          <SectionHeading
            eyebrow="Install snippet"
            title="Snippet locked"
            description="Reactivate your plan to unlock your website install code."
            maxWidth="lg"
          />
          <div className="mt-4 rounded-[24px] border border-dashed border-border bg-surface-2 p-6 text-sm text-muted">
            Your install snippet is locked because your subscription is not
            active. Once reactivated, this section will show your ready-to-paste
            website code again.
          </div>
        </div>
      )}
    </div>
  );
}
