"use client";

import { useEffect, useRef } from "react";
import {
  flushQueuedGaEvents,
  trackGaEvent,
  type GaEventName,
  type GaEventParams,
} from "@/lib/ga";

type GaEventOnMountProps = {
  name: GaEventName;
  params?: GaEventParams;
  dedupeKey?: string;
  flushPending?: boolean;
};

export default function GaEventOnMount({
  name,
  params,
  dedupeKey,
  flushPending = false,
}: GaEventOnMountProps) {
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;

    if (flushPending) {
      flushQueuedGaEvents(params);
    }

    trackGaEvent(name, params, { dedupeKey });
  }, [dedupeKey, flushPending, name, params]);

  return null;
}
