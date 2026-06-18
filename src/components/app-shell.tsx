"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import AppFooter from "@/components/app-footer";

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";

  const isPortalRoute = pathname.startsWith("/portal");
  // Sales Workspace hides the public sidebar/footer and supplies its own
  // admin chrome, so it gets a full-width canvas with no sidebar gutter.
  const isSalesWorkspace = pathname.startsWith("/admin/sales");
  const isAdminRoute = pathname.startsWith("/admin");

  const mainClassName = isPortalRoute
    ? "w-full px-0 pb-24 pt-0"
    : isSalesWorkspace
      ? "w-full px-0 pb-0 pt-0"
      : isAdminRoute
        ? "mx-auto w-full max-w-[1600px] px-6 pb-28 pt-6 md:pl-[360px] md:pr-10 md:pt-8"
        : "mx-auto w-full max-w-[1400px] px-6 pb-28 pt-6 md:pl-[360px] md:pr-10 md:pt-8";

  return (
    <>
      <main className={mainClassName}>{children}</main>
      <AppFooter />
    </>
  );
}
