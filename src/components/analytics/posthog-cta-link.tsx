"use client";

import Link from "next/link";
import { track, type AnalyticsEvent, type AnalyticsProps } from "@/lib/analytics";

// A Next.js <Link> that emits a canonical CTA funnel event (plus a generic
// `cta_clicked`) when clicked. Navigation is unaffected if analytics is off.
export default function PosthogCtaLink({
  href,
  event,
  className,
  children,
  props,
}: {
  href: string;
  event: AnalyticsEvent;
  className?: string;
  children: React.ReactNode;
  props?: AnalyticsProps;
}) {
  function handleClick() {
    const base = props ?? {};
    track("cta_clicked", { ...base, cta: event, href });
    track(event, { ...base, href });
  }

  return (
    <Link href={href} className={className} onClick={handleClick}>
      {children}
    </Link>
  );
}
