"use client";

import Link from "next/link";
import { usePostHog } from "posthog-js/react";
import {
  safePathFromHref,
  safePlanFromHref,
  trackGaEvent,
} from "@/lib/ga";

export default function TrialCtaLink({
  href,
  className,
  children,
  location,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
  location: string;
}) {
  const posthog = usePostHog();

  function handleClick() {
    posthog?.capture("start_free_trial_clicked", {
      location,
      href,
    });

    trackGaEvent("trial_start_clicked", {
      location,
      source_page: window.location.pathname,
      destination_route: safePathFromHref(href),
      plan: safePlanFromHref(href),
    });
  }

  return (
    <Link href={href} className={className} onClick={handleClick}>
      {children}
    </Link>
  );
}
