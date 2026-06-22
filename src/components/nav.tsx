"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui";

type IconName = "dashboard" | "overview" | "stats" | "tax" | "cash" | "add" | "accounts" | "settings";

const links: { href: string; label: string; icon: IconName; dividerBefore?: boolean }[] = [
  { href: "/", label: "Dashboard", icon: "dashboard" },
  { href: "/overview", label: "Trades", icon: "overview" },
  { href: "/stats", label: "Statistik", icon: "stats", dividerBefore: true },
  { href: "/tax", label: "Steuer", icon: "tax" },
  { href: "/cash", label: "Kontostand", icon: "cash", dividerBefore: true },
  { href: "/accounts", label: "Depots", icon: "accounts" },
];

function Icon({ name }: { name: IconName }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const paths: Record<IconName, React.ReactNode> = {
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </>
    ),
    overview: (
      <>
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <circle cx="3.5" cy="6" r="1" />
        <circle cx="3.5" cy="12" r="1" />
        <circle cx="3.5" cy="18" r="1" />
      </>
    ),
    stats: (
      <>
        <path d="M4 19V5" />
        <path d="M4 19h16" />
        <path d="M8 16v-4" />
        <path d="M13 16V8" />
        <path d="M18 16v-7" />
      </>
    ),
    tax: (
      <>
        <line x1="19" y1="5" x2="5" y2="19" />
        <circle cx="6.5" cy="6.5" r="2.5" />
        <circle cx="17.5" cy="17.5" r="2.5" />
      </>
    ),
    cash: (
      <>
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <circle cx="12" cy="12" r="2.5" />
        <path d="M6 12h.01M18 12h.01" />
      </>
    ),
    add: (
      <>
        <circle cx="12" cy="12" r="9" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </>
    ),
    accounts: (
      <>
        <rect x="3" y="6" width="18" height="13" rx="2" />
        <path d="M16 6V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v1" />
        <circle cx="16.5" cy="12.5" r="1.2" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </>
    ),
  };
  return <svg {...common}>{paths[name]}</svg>;
}

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {links.map((l) => {
        const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
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
