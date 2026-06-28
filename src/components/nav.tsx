"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui";
import { Icon, type IconName } from "@/components/nav-icons";

export type NavLink = { href: string; label: string; icon: IconName; dividerBefore?: boolean };

export const NAV_LINKS: NavLink[] = [
  { href: "/", label: "Dashboard", icon: "dashboard" },
  { href: "/overview", label: "Trades", icon: "overview" },
  { href: "/stats", label: "Statistik", icon: "stats", dividerBefore: true },
  { href: "/tax", label: "Steuer", icon: "tax" },
  { href: "/cash", label: "Kontostand", icon: "cash", dividerBefore: true },
  { href: "/accounts", label: "Depots", icon: "accounts" },
];

/** Aktiv-Logik: „/" nur exakt, sonst Präfix-Match. */
export function isActive(href: string, pathname: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {NAV_LINKS.map((l) => {
        const active = isActive(l.href, pathname);
        return (
          <div key={l.href}>
            {l.dividerBefore && <div className="my-2 h-px bg-white/5" />}
            <Link
              href={l.href}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                active
                  ? "bg-emerald-500/10 text-emerald-300 ring-1 ring-inset ring-emerald-500/20"
                  : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100",
              )}
            >
              <span className={cn("transition-colors", active ? "text-emerald-400" : "text-zinc-500 group-hover:text-zinc-300")}>
                <Icon name={l.icon} />
              </span>
              {l.label}
            </Link>
          </div>
        );
      })}
    </nav>
  );
}
