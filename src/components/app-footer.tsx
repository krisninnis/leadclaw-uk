"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AppFooter() {
  const pathname = usePathname() ?? "";

  if (pathname.startsWith("/portal")) {
    return null;
  }

  return (
    <footer className="border-t border-border bg-white/80 backdrop-blur-sm md:ml-[320px]">
      <div className="container-shell flex flex-wrap items-center gap-4 py-6 text-xs text-muted">
        <Link
          href="/legal/terms"
          className="transition-colors hover:text-foreground"
        >
          Terms
        </Link>

        <Link
          href="/legal/privacy"
          className="transition-colors hover:text-foreground"
        >
          Privacy
        </Link>

        <Link
          href="/legal/trial-waiver"
          className="transition-colors hover:text-foreground"
        >
          Trial Terms
        </Link>

        <Link
          href="/legal/dpa"
          className="transition-colors hover:text-foreground"
        >
          DPA
        </Link>

        <Link
          href="/legal/compliance-checklist"
          className="transition-colors hover:text-foreground"
        >
          Compliance
        </Link>

        <span className="ml-auto text-muted-2">
          © {new Date().getFullYear()} LeadClaw AI
        </span>
      </div>
    </footer>
  );
}
