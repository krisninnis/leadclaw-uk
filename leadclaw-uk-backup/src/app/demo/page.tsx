import Link from "next/link";
import Script from "next/script";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function DemoPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) || {};
  const source = typeof params.source === "string" ? params.source.trim() : "";
  const lead = typeof params.lead === "string" ? params.lead.trim() : "";

  const admin = createAdminClient();

  let clinicName = "your clinic";
  let clinicCity = "";
  let clinicWebsite = "";

  if (admin && lead) {
    const { data: leadRow } = await admin
      .from("leads")
      .select("company_name, city, website")
      .eq("id", lead)
      .maybeSingle();

    if (leadRow) {
      clinicName = leadRow.company_name || clinicName;
      clinicCity = leadRow.city || "";
      clinicWebsite = leadRow.website || "";
    }
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://leadclaw.uk";
  const demoToken = process.env.NEXT_PUBLIC_DEMO_WIDGET_TOKEN?.trim() || "";
  const widgetReady = demoToken.length > 0;

  const trackingPayload = {
    source,
    lead,
    page: "/demo",
    clinicName,
    clinicCity,
    clinicWebsite,
    personalisedDemo: Boolean(lead),
    widgetReady,
    visitedAt: new Date().toISOString(),
  };

  return (
    <div className="page-hero section-shell">
      <div className="container-shell">
        <div className="mx-auto max-w-5xl space-y-8">
          <div className="card-premium p-6 md:p-8">
            <div className="max-w-4xl space-y-4">
              <div className="badge-soft">
                <span className="h-2 w-2 rounded-full bg-brand" />
                Live clinic demo
              </div>

              <h1 className="text-balance text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
                See how LeadClaw could work for {clinicName}
              </h1>

              <p className="max-w-3xl text-lg leading-8 text-muted">
                {clinicCity
                  ? `This demo is tailored for ${clinicName} in ${clinicCity}.`
                  : `This demo is tailored for ${clinicName}.`}{" "}
                Use the widget on this page to see how LeadClaw can capture
                missed website enquiries and turn them into follow-up-ready
                leads for your team.
              </p>

              {clinicWebsite ? (
                <p className="text-sm text-muted">
                  Current website:{" "}
                  <span className="font-medium text-foreground">
                    {clinicWebsite}
                  </span>
                </p>
              ) : null}
            </div>
          </div>

          {lead ? (
            <div className="rounded-[24px] border border-brand/15 bg-brand-soft p-6 shadow-sm">
              <p className="text-sm font-semibold text-brand-strong">
                Personalised for {clinicName}
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                A realistic example of your website enquiry flow
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">
                This page uses the clinic details we found for{" "}
                <strong className="text-foreground">{clinicName}</strong>
                {clinicCity ? ` in ${clinicCity}` : ""} to show how LeadClaw
                could help capture enquiries when your team is busy or out of
                hours.
              </p>
            </div>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="card-premium p-6 md:p-8">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                Try the live widget
              </h2>

              <p className="mt-3 text-sm leading-7 text-muted">
                The enquiry widget should appear in the bottom-right corner of
                this page. Submit a test enquiry to experience the same flow a
                clinic visitor would use.
              </p>

              <div className="mt-6 rounded-[22px] border border-border bg-white p-5">
                <p className="text-sm font-semibold text-foreground">
                  Suggested test details
                </p>

                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted">
                  <li>Name: Sarah Jones</li>
                  <li>Email: sarah@example.com</li>
                  <li>Phone: 07123 456789</li>
                </ul>
              </div>

              <div className="mt-6">
                {widgetReady ? (
                  <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                    Demo widget loaded. You should see the LeadClaw enquiry
                    widget in the bottom-right corner of this page.
                  </div>
                ) : (
                  <div className="rounded-[22px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    Demo widget token is not configured yet. Add{" "}
                    <strong>NEXT_PUBLIC_DEMO_WIDGET_TOKEN</strong> in Vercel to
                    enable the live demo widget here.
                  </div>
                )}
              </div>
            </div>

            <div className="card-premium p-6 md:p-8">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                What happens next
              </h2>

              <div className="mt-5 space-y-4">
                <div className="rounded-[22px] border border-border bg-white p-5">
                  <p className="text-sm font-semibold text-foreground">
                    1. A visitor submits an enquiry
                  </p>
                  <p className="mt-2 text-sm leading-7 text-muted">
                    LeadClaw captures their details through the website widget.
                  </p>
                </div>

                <div className="rounded-[22px] border border-border bg-white p-5">
                  <p className="text-sm font-semibold text-foreground">
                    2. The enquiry is saved instantly
                  </p>
                  <p className="mt-2 text-sm leading-7 text-muted">
                    Each enquiry is stored against the correct clinic account.
                  </p>
                </div>

                <div className="rounded-[22px] border border-border bg-white p-5">
                  <p className="text-sm font-semibold text-foreground">
                    3. Your team follows up from the portal
                  </p>
                  <p className="mt-2 text-sm leading-7 text-muted">
                    Clinic teams can review, update, and manage leads from one
                    simple dashboard.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link href="/free-trial?plan=growth" className="button-primary">
                  Start 7-day free trial
                </Link>
                <Link href="/pricing" className="button-secondary">
                  View pricing
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {(source || lead) && (
        <Script
          id="leadclaw-demo-visit-tracker"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              fetch("/api/outreach/demo-visit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(${JSON.stringify(trackingPayload)})
              }).catch(() => {});
            `,
          }}
        />
      )}

      {widgetReady ? (
        <>
          <Script
            id="leadclaw-demo-token"
            strategy="beforeInteractive"
            dangerouslySetInnerHTML={{
              __html: `window.clawWidgetToken = ${JSON.stringify(demoToken)};`,
            }}
          />
          <Script
            id="leadclaw-demo-widget"
            src={`${appUrl}/api/widget/bootstrap.js`}
            strategy="afterInteractive"
          />
        </>
      ) : null}
    </div>
  );
}
