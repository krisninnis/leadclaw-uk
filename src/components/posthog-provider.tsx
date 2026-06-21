"use client";

import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { captureAttribution, track } from "@/lib/analytics";

// Default PostHog host when NEXT_PUBLIC_POSTHOG_HOST is not set (host is
// optional). NEXT_PUBLIC_POSTHOG_KEY is required — without it analytics is
// disabled and every helper no-ops, so the app and build are unaffected.
const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com";

export default function PHProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Initialise PostHog once. Fails silently when the key is not configured.
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return; // analytics disabled — silent no-op

    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || DEFAULT_POSTHOG_HOST;

    if (!posthog.__loaded) {
      posthog.init(key, {
        api_host: host,
        person_profiles: "identified_only",
        capture_pageview: true,
        capture_pageleave: true,
        loaded: (ph) => {
          if (process.env.NODE_ENV === "development") {
            ph.debug();
          }
        },
      });
    }

    // First-touch attribution + super properties (UTMs, referrer, landing page).
    captureAttribution();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On every route change: refresh the current_page super property and emit the
  // explicit page_view event, plus social_page_view for the social campaign
  // routes. Safe no-ops when analytics is disabled.
  useEffect(() => {
    if (!pathname) return;
    captureAttribution();
    track("page_view", { route: pathname });
    if (
      pathname === "/social" ||
      pathname.startsWith("/social/") ||
      pathname === "/x"
    ) {
      track("social_page_view", { route: pathname });
    }
  }, [pathname]);

  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}
