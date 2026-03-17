"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import AppFooter from "@/components/app-footer";

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";

  const isPortalRoute = pathname.startsWith("/portal");
  const isAdminRoute = pathname.startsWith("/admin");

  const mainClassName = isPortalRoute
    ? "w-full px-0 pb-24 pt-0"
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
