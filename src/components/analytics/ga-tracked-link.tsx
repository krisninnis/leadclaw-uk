"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  safePathFromHref,
  safePlanFromHref,
  trackGaEvent,
  type GaEventName,
  type GaEventParams,
} from "@/lib/ga";

type GaTrackedLinkProps = {
  href: string;
  className?: string;
  children: ReactNode;
  eventName: GaEventName;
  eventParams?: GaEventParams;
};

export default function GaTrackedLink({
  href,
  className,
  children,
  eventName,
  eventParams,
}: GaTrackedLinkProps) {
  function handleClick() {
    trackGaEvent(eventName, {
      destination_route: safePathFromHref(href),
      plan: safePlanFromHref(href),
      ...eventParams,
    });
  }

  return (
    <Link href={href} className={className} onClick={handleClick}>
      {children}
    </Link>
  );
}
