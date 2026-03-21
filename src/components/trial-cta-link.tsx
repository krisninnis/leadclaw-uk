"use client";

import Link from "next/link";
import { usePostHog } from "posthog-js/react";

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
  }

  return (
    <Link href={href} className={className} onClick={handleClick}>
      {children}
    </Link>
  );
}
