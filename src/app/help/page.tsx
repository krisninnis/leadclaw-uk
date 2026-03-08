export default function HelpPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Help & Support</h1>
        <p className="mt-2 text-slate-600">
          Everything you need to install and use LeadClaw without waiting for
          support.
        </p>
      </div>

      <section className="space-y-4 rounded-xl border bg-white p-6">
        <h2 className="text-xl font-semibold">Quick installation guide</h2>
        <p className="text-sm text-slate-700">
          Always copy the install snippet from your own Portal. Your snippet
          includes your clinic’s unique widget token.
        </p>

        <ol className="list-decimal space-y-2 pl-6 text-sm text-slate-700">
          <li>
            Sign in to <strong>Portal</strong>.
          </li>
          <li>
            Open the <strong>Install your widget</strong> section.
          </li>
          <li>Copy your install snippet.</li>
          <li>
            Paste the snippet just before <code>{"</body>"}</code> on all pages
            of your website.
          </li>
          <li>Save or publish your website changes.</li>
          <li>
            Open your site in an incognito or private browser window and send a
            test enquiry.
          </li>
        </ol>

        <div className="rounded border bg-slate-50 p-3 text-xs text-slate-700">
          <p className="font-medium text-slate-900">WordPress</p>
          <p>
            Use your theme footer, a code injection area, or a header/footer
            plugin and paste the snippet before <code>{"</body>"}</code>.
          </p>

          <p className="mt-2 font-medium text-slate-900">Shopify</p>
          <p>
            Go to Online Store → Themes → Edit code → <code>theme.liquid</code>{" "}
            and paste the snippet before <code>{"</body>"}</code>.
          </p>

          <p className="mt-2 font-medium text-slate-900">Wix / Squarespace</p>
          <p>
            Use the platform’s custom code injection area for footer or body-end
            scripts.
          </p>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border bg-white p-6">
        <h2 className="text-xl font-semibold">How to confirm it is working</h2>
        <ul className="list-disc space-y-2 pl-6 text-sm text-slate-700">
          <li>The LeadClaw widget appears on your live website.</li>
          <li>You can submit a fresh test enquiry from an incognito window.</li>
          <li>The enquiry appears in your Portal lead inbox.</li>
          <li>Your Portal analytics begin showing live enquiry activity.</li>
        </ul>
      </section>

      <section className="space-y-4 rounded-xl border bg-white p-6">
        <h2 className="text-xl font-semibold">FAQ</h2>
        <div className="space-y-3 text-sm text-slate-700">
          <div>
            <p className="font-semibold">Do I need a credit card for trial?</p>
            <p>No. You can start the initial trial flow without a card.</p>
          </div>

          <div>
            <p className="font-semibold">How do I continue after the trial?</p>
            <p>
              Use the upgrade flow shown in your Portal or on the Pricing page
              to activate a paid package.
            </p>
          </div>

          <div>
            <p className="font-semibold">How long does installation take?</p>
            <p>
              Usually 5–10 minutes once you have access to your website editor.
            </p>
          </div>

          <div>
            <p className="font-semibold">Can I remove the widget later?</p>
            <p>
              Yes. Remove the LeadClaw script snippet from your site and publish
              the change.
            </p>
          </div>

          <div>
            <p className="font-semibold">
              Where do I see my setup and subscription status?
            </p>
            <p>
              Your Portal shows your install status, lead inbox, and current
              trial or subscription state.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border bg-white p-6">
        <h2 className="text-xl font-semibold">Troubleshooting</h2>
        <ul className="list-disc space-y-2 pl-6 text-sm text-slate-700">
          <li>
            <strong>Widget not showing:</strong> confirm the snippet is on the
            live site, clear cache/CDN, and test in an incognito window.
          </li>
          <li>
            <strong>Portal login issues:</strong> use{" "}
            <code>https://leadclaw.uk/login</code> and avoid old localhost or
            outdated saved links.
          </li>
          <li>
            <strong>No enquiries showing:</strong> confirm the widget appears on
            the live site and submit a new test enquiry from a private browser
            session.
          </li>
          <li>
            <strong>Install status not changing:</strong> refresh Portal and
            re-test from a fresh browser session.
          </li>
          <li>
            <strong>Email delivery issues:</strong> contact support with your
            website URL and the time of your test.
          </li>
        </ul>
      </section>

      <section className="rounded-xl border bg-white p-6">
        <h2 className="text-xl font-semibold">Support escalation</h2>
        <p className="mt-2 text-sm text-slate-700">
          If something is still blocked after following this guide, contact
          support with:
        </p>
        <ul className="mt-2 list-disc pl-6 text-sm text-slate-700">
          <li>Portal login email used</li>
          <li>Website URL</li>
          <li>Screenshot or short video of the issue</li>
          <li>Approximate time of the issue</li>
          <li>Browser and device used</li>
        </ul>
      </section>
    </div>
  );
}
