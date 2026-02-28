export default function HelpPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Help & Support</h1>
        <p className="mt-2 text-slate-600">Everything clients need to install and use LeadClaw without waiting for support.</p>
      </div>

      <section className="rounded-xl border bg-white p-6 space-y-4">
        <h2 className="text-xl font-semibold">Quick installation guide</h2>
        <ol className="list-decimal space-y-2 pl-6 text-sm text-slate-700">
          <li>Sign in to <strong>Portal</strong> and click <strong>Start 7-day free trial</strong>.</li>
          <li>In <strong>Free Trial Setup Section</strong>, copy your install snippet.</li>
          <li>Paste snippet just before <code>{'</body>'}</code> on all pages of your website.</li>
          <li>Save/publish site changes.</li>
          <li>Open your site in incognito/mobile and send a test message to confirm the widget appears and responds.</li>
        </ol>
        <div className="rounded border bg-slate-50 p-3 text-xs">
          <p className="font-medium">WordPress</p>
          <p>Appearance → Theme File Editor (footer) or Header/Footer plugin → paste snippet → Save.</p>
          <p className="mt-2 font-medium">Shopify</p>
          <p>Online Store → Themes → Edit code → theme.liquid → paste before <code>{'</body>'}</code> → Save.</p>
          <p className="mt-2 font-medium">Wix / Squarespace</p>
          <p>Use custom code injection area for footer / body-end scripts.</p>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-6 space-y-4">
        <h2 className="text-xl font-semibold">FAQ</h2>
        <div className="space-y-3 text-sm text-slate-700">
          <div>
            <p className="font-semibold">Do I need a credit card for trial?</p>
            <p>No. Trial starts in-portal with no card required.</p>
          </div>
          <div>
            <p className="font-semibold">Does it auto-charge after trial?</p>
            <p>No automatic rollover in the no-card trial path. Clients explicitly choose to subscribe.</p>
          </div>
          <div>
            <p className="font-semibold">How long does install take?</p>
            <p>Usually 5–10 minutes once you have website access.</p>
          </div>
          <div>
            <p className="font-semibold">Can I remove the widget?</p>
            <p>Yes. Remove the script snippet and publish your site changes.</p>
          </div>
          <div>
            <p className="font-semibold">Where do I see trial/package status?</p>
            <p>Portal shows <strong>Free Trial Setup Section</strong> during trial and <strong>Subscribed Package Section</strong> after subscription.</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-6 space-y-4">
        <h2 className="text-xl font-semibold">Troubleshooting</h2>
        <ul className="list-disc space-y-2 pl-6 text-sm text-slate-700">
          <li><strong>Widget not showing:</strong> confirm snippet is on live site, clear cache/CDN, test in incognito.</li>
          <li><strong>Portal login link broken:</strong> use <code>https://leadclaw.uk/login</code> and avoid old localhost links.</li>
          <li><strong>No responses captured:</strong> verify website visitors can see widget and test with a new browser session.</li>
          <li><strong>Status not updating:</strong> refresh portal and check Agent Activity Log in Admin.</li>
          <li><strong>Email issues:</strong> verify domain DNS and sender settings in Resend.</li>
        </ul>
      </section>

      <section className="rounded-xl border bg-white p-6">
        <h2 className="text-xl font-semibold">Support escalation</h2>
        <p className="mt-2 text-sm text-slate-700">If something is blocked after following this guide, contact support with:</p>
        <ul className="mt-2 list-disc pl-6 text-sm text-slate-700">
          <li>website URL</li>
          <li>screenshot/video of issue</li>
          <li>time of issue</li>
          <li>browser/device used</li>
        </ul>
      </section>
    </div>
  )
}
