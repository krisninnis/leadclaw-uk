"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Flame,
  Puzzle,
  MessageCircle,
  CreditCard,
  Settings,
  BookOpen,
  BarChart2,
  User,
  Wrench,
} from "lucide-react";

type PortalLink = {
  href: string;
  label: string;
  icon: string;
};

const iconMap: Record<string, React.ReactNode> = {
  dashboard: <LayoutDashboard size={18} />,
  leads: <Flame size={18} />,
  install: <Puzzle size={18} />,
  support: <MessageCircle size={18} />,
  billing: <CreditCard size={18} />,
  settings: <Settings size={18} />,
  resources: <BookOpen size={18} />,
  activity: <BarChart2 size={18} />,
  profile: <User size={18} />,
  admin: <Wrench size={18} />,
};

function getIcon(label: string) {
  return iconMap[label.toLowerCase()] ?? <LayoutDashboard size={18} />;
}

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
            <span className="shrink-0">{getIcon(link.label)}</span>
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
        <span className="shrink-0">
          <User size={18} />
        </span>
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
            <span className="shrink-0">
              <Wrench size={18} />
            </span>
            <span>Back to Admin</span>
          </Link>
        </div>
      ) : null}
    </nav>
  );
}
