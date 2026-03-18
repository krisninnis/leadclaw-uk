"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type PortalLink = {
  href: string;
  label: string;
  icon: string;
};

function isActive(pathname: string, href: string) {
  if (href === "/portal") return pathname === "/portal";
  return pathname.startsWith(href);
}

export default function PortalMobileNav({ links }: { links: PortalLink[] }) {
  const pathname = usePathname() ?? "";

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-white/95 backdrop-blur-xl lg:hidden">
      <div className="grid grid-cols-4 sm:grid-cols-8">
        {links.map((link) => {
          const active = isActive(pathname, link.href);

          return (
            <Link
              key={`${link.href}-mobile`}
              href={link.href}
              className={[
                "flex flex-col items-center justify-center gap-1 px-2 py-3 text-[11px] font-medium transition-colors",
                active
                  ? "text-brand-strong"
                  : "text-muted hover:text-foreground",
              ].join(" ")}
            >
              <span
                className={[
                  "flex h-8 w-8 items-center justify-center rounded-full text-base transition-all",
                  active ? "bg-brand-soft" : "",
                ].join(" ")}
              >
                {link.icon}
              </span>
              <span>{link.label}</span>
            </Link>
          );
        })}

        {/* Add Profile Link */}
        <Link
          href="/portal/profile"
          className={[
            "flex flex-col items-center justify-center gap-1 px-2 py-3 text-[11px] font-medium transition-colors",
            pathname.startsWith("/portal/profile")
              ? "text-brand-strong"
              : "text-muted hover:text-foreground",
          ].join(" ")}
        >
          <span
            className={[
              "flex h-8 w-8 items-center justify-center rounded-full text-base transition-all",
              pathname.startsWith("/portal/profile") ? "bg-brand-soft" : "",
            ].join(" ")}
          >
            👤
          </span>
          <span>Profile</span>
        </Link>
      </div>
    </nav>
  );
}
