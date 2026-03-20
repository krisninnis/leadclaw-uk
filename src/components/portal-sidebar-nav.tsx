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

export default function PortalSidebarNav({ links }: { links: PortalLink[] }) {
  const pathname = usePathname() ?? "";
  const adminLink = links.find((link) => link.href === "/admin");
  const mainLinks = links.filter((link) => link.href !== "/admin");

  return (
    <nav className="flex-1 space-y-2 overflow-y-auto p-4">
      {mainLinks.map((link) => {
        const active = isActive(pathname, link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={[
              "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition",
              active
                ? "bg-brand-soft text-foreground shadow-sm"
                : "text-muted hover:bg-surface-2 hover:text-foreground",
            ].join(" ")}
          >
            <span className="text-base">{link.icon}</span>
            <span>{link.label}</span>
          </Link>
        );
      })}

      <Link
        href="/portal/profile"
        className={[
          "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition",
          pathname.startsWith("/portal/profile")
            ? "bg-brand-soft text-foreground shadow-sm"
            : "text-muted hover:bg-surface-2 hover:text-foreground",
        ].join(" ")}
      >
        <span className="text-base">👤</span>
        <span>Profile</span>
      </Link>

      {adminLink ? (
        <div className="pt-4">
          <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-2">
            Admin
          </p>

          <Link
            href="/admin"
            className={[
              "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition",
              pathname.startsWith("/admin")
                ? "bg-brand-soft text-foreground shadow-sm"
                : "text-muted hover:bg-surface-2 hover:text-foreground",
            ].join(" ")}
          >
            <span className="text-base">{adminLink.icon}</span>
            <span>Back to Admin</span>
          </Link>
        </div>
      ) : null}
    </nav>
  );
}
