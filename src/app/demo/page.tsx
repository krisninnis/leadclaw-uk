import Script from "next/script";

export default function DemoPage() {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://leadclaw.uk";
  const demoToken = process.env.NEXT_PUBLIC_DEMO_WIDGET_TOKEN?.trim() || "";
  const widgetReady = demoToken.length > 0;

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <div className="space-y-8">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-slate-950">
            See LeadClaw capture a real clinic enquiry
          </h1>

          <p className="max-w-3xl text-lg text-slate-600">
            This demo shows how LeadClaw captures website enquiries and sends
            them into a simple clinic lead inbox — even when your team is busy
            or out of hours.
          </p>
        </div>

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
            test the live capture flow.
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
                Visitors submit their details through a simple website widget.
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
                3. Show it in portal
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Clinics can view new website leads instantly inside their lead
                inbox.
              </p>
            </div>
          </div>
        </div>

        <div className="pt-2 text-center">
          <a
            href="/pricing"
            className="inline-flex rounded-lg bg-black px-6 py-3 text-white transition hover:opacity-90"
          >
            Start Free Trial
          </a>
        </div>
      </div>

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
