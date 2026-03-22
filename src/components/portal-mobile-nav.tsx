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
  admin: <Wrench size={18} />,
};

function getIcon(label: string) {
  return iconMap[label.toLowerCase()] ?? <LayoutDashboard size={18} />;
}

function isActive(pathname: string, href: string) {
  if (href === "/portal") return pathname === "/portal";
  return pathname.startsWith(href);
}

export default function PortalMobileNav({ links }: { links: PortalLink[] }) {
  const pathname = usePathname() ?? "";
  const totalItems = links.length + 1;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-white/95 backdrop-blur-xl lg:hidden">
      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${totalItems}, minmax(0, 1fr))` }}
      >
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
                  "flex h-8 w-8 items-center justify-center rounded-full transition-all",
                  active ? "bg-brand-soft" : "",
                ].join(" ")}
              >
                {getIcon(link.label)}
              </span>
              <span>{link.label}</span>
            </Link>
          );
        })}

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
              "flex h-8 w-8 items-center justify-center rounded-full transition-all",
              pathname.startsWith("/portal/profile") ? "bg-brand-soft" : "",
            ].join(" ")}
          >
            <User size={18} />
          </span>
          <span>Profile</span>
        </Link>
      </div>
    </nav>
  );
}
