import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import TrialCtaLink from "@/components/trial-cta-link";
import PosthogCtaLink from "@/components/analytics/posthog-cta-link";
import SocialDemoVideo from "@/components/analytics/social-demo-video";

const siteUrl = "https://www.leadclaw.uk";

// Shared UTM params so every CTA from this page is trackable as one campaign.
const utm = "utm_source=x&utm_medium=social&utm_campaign=missed_call_video";
const trialHref = `/free-trial?${utm}`;
const demoHref = `/demo?${utm}`;
const auditHref = `/free-audit?${utm}`;

const demoVideoSrc = "/videos/leadclaw-social-demo.mp4";
// Resolve at the server (build/render) so a missing file shows a clean
// fallback CTA instead of rendering a broken player or 404-ing the asset.
const hasDemoVideo = fs.existsSync(
  path.join(process.cwd(), "public", "videos", "leadclaw-social-demo.mp4"),
);

export const metadata: Metadata = {
  title: "LeadClaw Social | Never Miss Another Lead",
  description:
    "LeadClaw helps UK businesses capture enquiries, respond faster and turn more website visitors into leads.",
  alternates: { canonical: "/social" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    url: `${siteUrl}/social`,
    siteName: "LeadClaw",
    title: "LeadClaw Social | Never Miss Another Lead",
    description:
      "LeadClaw helps UK businesses capture enquiries, respond faster and turn more website visitors into leads.",
  },
};

const trustPoints = [
  "Built for UK service businesses",
  "7-day free trial",
  "No card required",
  "Fast setup",
  "Website audit included",
];

export default function SocialLandingPage() {
  return (
    <div className="space-y-12">
      <section className="section-shell pb-0">
        <div className="container-shell max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-strong">
            LeadClaw
          </p>
          <h1 className="mt-3 text-balance text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            Never miss another lead.
          </h1>
          <p className="mt-6 text-lg leading-8 text-muted">
            LeadClaw captures website enquiries and helps UK businesses respond
            faster, even when the team is busy.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <TrialCtaLink
              href={trialHref}
              className="button-primary"
              location="social_hero"
            >
              Start free trial
            </TrialCtaLink>
            <PosthogCtaLink
              href={demoHref}
              event="demo_clicked"
              className="button-secondary"
              props={{ location: "social_hero" }}
            >
              Book demo
            </PosthogCtaLink>
            <PosthogCtaLink
              href={auditHref}
              event="free_audit_clicked"
              className="button-secondary"
              props={{ location: "social_hero" }}
            >
              Run free website audit
            </PosthogCtaLink>
          </div>
        </div>
      </section>

      <section className="section-shell pt-0">
        <div className="container-shell">
          <div className="card-premium p-6 md:p-8">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              Why UK businesses choose LeadClaw
            </h2>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {trustPoints.map((point) => (
                <li
                  key={point}
                  className="flex items-center gap-3 text-sm font-medium text-foreground"
                >
                  <span
                    aria-hidden="true"
                    className="inline-flex h-2 w-2 shrink-0 rounded-full bg-brand-strong"
                  />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="section-shell pt-0">
        <div className="container-shell max-w-3xl">
          <div className="card-premium p-6 md:p-8">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              Seen the video?
            </h2>
            <p className="mt-3 text-sm leading-7 text-muted">
              If you found us from X, the point is simple: missed enquiries turn
              into lost customers. LeadClaw helps capture those enquiries before
              they disappear.
            </p>

            {hasDemoVideo ? (
              <SocialDemoVideo src={demoVideoSrc} />
            ) : (
              <div className="mt-6 rounded-2xl border border-dashed border-border bg-surface-2 p-6 text-center">
                <p className="text-sm font-medium text-foreground">
                  The demo video isn&rsquo;t available right now.
                </p>
                <p className="mt-1 text-sm text-muted">
                  You can still start your free trial or book a demo below.
                </p>
              </div>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <TrialCtaLink
                href={trialHref}
                className="button-primary"
                location="social_video"
              >
                Start free trial
              </TrialCtaLink>
              <PosthogCtaLink
                href={demoHref}
                event="demo_clicked"
                className="button-secondary"
                props={{ location: "social_video" }}
              >
                Book demo
              </PosthogCtaLink>
              <PosthogCtaLink
                href={auditHref}
                event="free_audit_clicked"
                className="button-secondary"
                props={{ location: "social_video" }}
              >
                Run free website audit
              </PosthogCtaLink>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
