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
            Try the AI Receptionist Live
          </h1>

          <p className="max-w-3xl text-lg text-slate-600">
            Send a message below to see how LeadClaw captures enquiries and
            responds instantly to clinic visitors.
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="mb-4 text-sm font-medium text-slate-500">
            Example questions you can ask:
          </p>

          <ul className="list-disc space-y-2 pl-6 text-sm text-slate-700">
            <li>How much is Botox?</li>
            <li>Do you offer teeth whitening?</li>
            <li>Can I book a consultation?</li>
            <li>Where are you located?</li>
          </ul>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-xl font-semibold text-slate-950">
            Live demo
          </h2>

          <p className="mb-4 text-sm text-slate-600">
            Use the chat widget in the bottom-right corner to test how the AI
            receptionist handles common clinic enquiries.
          </p>

          {widgetReady ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              Demo widget loaded. A chat bubble should appear in the
              bottom-right corner of this page.
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Demo widget token is not configured yet. Add
              <strong> NEXT_PUBLIC_DEMO_WIDGET_TOKEN</strong> to your Vercel
              environment variables to enable the live receptionist demo here.
            </div>
          )}
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
