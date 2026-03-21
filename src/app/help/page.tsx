import Link from "next/link";

const platformGuides = [
  {
    name: "WordPress",
    body: "Use your theme footer, a code injection area, or a header/footer plugin and paste the snippet before the closing </body> tag.",
  },
  {
    name: "Shopify",
    body: "Go to Online Store → Themes → Edit code → theme.liquid and paste the snippet before the closing </body> tag.",
  },
  {
    name: "Wix / Squarespace",
    body: "Use the platform’s custom code injection area for footer scripts or body-end scripts.",
  },
  {
    name: "Custom website",
    body: "Paste the LeadClaw snippet into your site template just before the closing </body> tag on all pages where you want the widget available.",
  },
];

const successChecks = [
  "The LeadClaw widget appears on your live website.",
  "You can submit a fresh test enquiry from an incognito or private browser window.",
  "The enquiry appears in your Portal lead inbox.",
  "Your Portal starts showing live enquiry activity.",
];

const troubleshootingItems = [
  {
    title: "Widget not showing",
    body: "Confirm the snippet is on the live site, clear cache or CDN layers, and test in an incognito window.",
  },
  {
    title: "Portal login issues",
    body: "Use the live login page and avoid old localhost links or outdated saved bookmarks.",
  },
  {
    title: "No enquiries showing",
    body: "Confirm the widget appears on your live site and submit a brand-new test enquiry from a private browser session.",
  },
  {
    title: "Install status not changing",
    body: "Visit your live website first, then return to the Portal install page and refresh.",
  },
  {
    title: "Need extra help",
    body: "Contact support with your website URL, the email used for Portal login, and the approximate time of the issue.",
  },
];

const faqs = [
  {
    question: "Do I need a credit card for the trial?",
    answer: "No. You can start the initial trial flow without a card.",
  },
  {
    question: "How long does installation take?",
    answer:
      "Usually 5 to 10 minutes once you have access to your website editor.",
  },
  {
    question: "Where do I get my install code?",
    answer:
      "Always copy your install snippet from your own Portal. Each snippet includes your clinic’s unique widget token.",
  },
  {
    question: "How do I continue after the trial?",
    answer:
      "Use the upgrade flow shown in your Portal or on the Pricing page to activate a paid package.",
  },
  {
    question: "Can I remove the widget later?",
    answer:
      "Yes. Remove the LeadClaw script snippet from your site and publish the change.",
  },
  {
    question: "Where do I see my setup and subscription status?",
    answer:
      "Your Portal shows your install status, lead inbox, and current trial or subscription state.",
  },
];

export default function HelpPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-[24px] border bg-white p-6 md:p-8">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-strong">
            Help &amp; setup
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-5xl">
            Install LeadClaw and start capturing enquiries
          </h1>
          <p className="mt-4 text-base leading-8 text-muted md:text-lg">
            Everything you need to get your widget live, test it properly, and
            confirm your enquiries are flowing into your Portal.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link href="/portal/install" className="button-primary">
            Open Portal install guide
          </Link>
          <Link href="/login" className="button-secondary">
            Sign in to Portal
          </Link>
        </div>
      </section>

      <section className="rounded-[24px] border bg-white p-6 md:p-8">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          The fastest setup path
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-muted">
          The simplest way to get live is to use your Portal install page and
          follow this exact order.
        </p>

        <ol className="mt-6 grid gap-4 md:grid-cols-2">
          {[
            "Sign in to your Portal.",
            "Open the Install your widget section.",
            "Copy your unique LeadClaw install snippet.",
            "Paste it before the closing </body> tag on your website.",
            "Publish your website changes.",
            "Visit your live website.",
            "Open an incognito or private browser window.",
            "Send a test enquiry and check that it appears in your Portal.",
          ].map((step, index) => (
            <li
              key={step}
              className="rounded-[22px] border border-border bg-surface-2 p-5"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                  {index + 1}
                </div>
                <p className="text-sm leading-7 text-foreground">{step}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-[24px] border bg-white p-6 md:p-8">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Platform-specific install help
        </h2>
        <p className="mt-2 text-sm leading-7 text-muted">
          Use the option closest to how your website is managed.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {platformGuides.map((platform) => (
            <div
              key={platform.name}
              className="rounded-[22px] border border-border bg-surface-2 p-5"
            >
              <h3 className="text-base font-semibold text-foreground">
                {platform.name}
              </h3>
              <p className="mt-2 text-sm leading-7 text-muted">
                {platform.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[24px] border bg-white p-6 md:p-8">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          How to confirm it is working
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {successChecks.map((item) => (
            <div
              key={item}
              className="rounded-[22px] border border-emerald-200 bg-emerald-50 p-5"
            >
              <p className="text-sm font-medium leading-7 text-emerald-900">
                {item}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[24px] border bg-white p-6 md:p-8">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          FAQ
        </h2>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {faqs.map((faq) => (
            <div
              key={faq.question}
              className="rounded-[22px] border border-border bg-surface-2 p-5"
            >
              <h3 className="text-base font-semibold text-foreground">
                {faq.question}
              </h3>
              <p className="mt-2 text-sm leading-7 text-muted">{faq.answer}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[24px] border bg-white p-6 md:p-8">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Troubleshooting
        </h2>

        <div className="mt-6 space-y-4">
          {troubleshootingItems.map((item) => (
            <div
              key={item.title}
              className="rounded-[22px] border border-border bg-surface-2 p-5"
            >
              <p className="text-sm font-semibold text-foreground">
                {item.title}
              </p>
              <p className="mt-2 text-sm leading-7 text-muted">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[24px] border bg-white p-6 md:p-8">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Still blocked?
        </h2>
        <p className="mt-2 text-sm leading-7 text-muted">
          If something is still not working after following the guide, contact
          support with the details below so the issue can be checked quickly.
        </p>

        <ul className="mt-4 list-disc space-y-2 pl-6 text-sm leading-7 text-muted">
          <li>Your Portal login email</li>
          <li>Your website URL</li>
          <li>A screenshot or short video of the issue</li>
          <li>The approximate time the issue happened</li>
          <li>Your browser and device</li>
        </ul>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link href="/portal/support" className="button-primary">
            Contact support
          </Link>
          <Link href="/pricing" className="button-secondary">
            View pricing
          </Link>
        </div>
      </section>
    </div>
  );
}
