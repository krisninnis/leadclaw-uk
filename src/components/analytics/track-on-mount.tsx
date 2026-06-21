"use client";

import { useEffect, useRef } from "react";
import { track, type AnalyticsEvent, type AnalyticsProps } from "@/lib/analytics";

// Fires a single PostHog event when this client component mounts. Used to
// instrument "viewed" events on otherwise-server-rendered pages.
export default function TrackOnMount({
  event,
  props,
}: {
  event: AnalyticsEvent;
  props?: AnalyticsProps;
}) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    track(event, props ?? {});
    // Intentionally fire once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
