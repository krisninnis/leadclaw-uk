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
    <div className="mx-auto max-w-5xl px-6 py-16">
      <div className="space-y-8">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-slate-950">
            Your AI front desk for {clinicName}
          </h1>

          <p className="max-w-3xl text-lg text-slate-600">
            {clinicCity
              ? `This demo is tailored for ${clinicName} in ${clinicCity}.`
              : `This demo is tailored for ${clinicName}.`}{" "}
            Use the widget to see how LeadClaw can capture website enquiries and
            turn them into leads your team can follow up quickly.
          </p>

          {clinicWebsite ? (
            <p className="text-sm text-slate-500">Website: {clinicWebsite}</p>
          ) : null}
        </div>

        {lead ? (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6 shadow-sm">
            <p className="text-sm font-medium text-blue-700">
              Demo prepared for {clinicName}
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">
              See how LeadClaw could work on your website
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-700">
              This page is personalised using the details we found for{" "}
              <strong>{clinicName}</strong>
              {clinicCity ? ` in ${clinicCity}` : ""}. The goal is to show how
              an AI front desk could capture enquiries when your team is busy or
              out of hours.
            </p>
          </div>
        ) : null}

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="mb-4 text-sm font-medium text-slate-500">
            Try submitting a test enquiry like:
          </p>

          <ul className="list-disc space-y-2 pl-6 text-sm text-slate-700">
            <li>Name: Sarah Jones</li>
            <li>Email: sarah@example.com</li>
            <li>Phone: 07123 456789</li>
          </ul>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-xl font-semibold text-slate-950">
            Live demo
          </h2>

          <p className="mb-4 text-sm text-slate-600">
            Use the enquiry widget in the bottom-right corner of this page to
            see how LeadClaw could capture enquiries for {clinicName}
            {clinicCity ? ` in ${clinicCity}` : ""}.
          </p>

          {widgetReady ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              Demo widget loaded. An enquiry widget should appear in the
              bottom-right corner of this page.
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Demo widget token is not configured yet. Add
              <strong> NEXT_PUBLIC_DEMO_WIDGET_TOKEN</strong> to your Vercel
              environment variables to enable the live demo here.
            </div>
          )}
        </div>

        <div className="rounded-2xl border bg-slate-50 p-6 shadow-sm">
          <h2 className="mb-3 text-xl font-semibold text-slate-950">
            What LeadClaw does
          </h2>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <h3 className="font-medium text-slate-900">
                1. Capture enquiries
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Visitors leave their details through a simple website widget.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-slate-900">
                2. Store every lead
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Each enquiry is saved and linked to the correct clinic account.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-slate-900">
                3. Show it in the portal
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Clinic teams can view, manage, and track new leads inside their
                LeadClaw portal.
              </p>
            </div>
          </div>
        </div>

        <div className="pt-2 text-center">
          <a
            href="/pricing"
            className="inline-flex rounded-lg bg-black px-6 py-3 text-white transition hover:opacity-90"
          >
            Start a free trial for {clinicName}
          </a>
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
