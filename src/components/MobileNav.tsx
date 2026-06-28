"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui";
import { Icon, type IconName } from "@/components/nav-icons";
import { isActive } from "@/components/nav";

type Tab = { href: string; label: string; icon: IconName };

// Primäre Tabs unten; restliche Bereiche im „Mehr"-Sheet.
const PRIMARY: Tab[] = [
  { href: "/", label: "Start", icon: "dashboard" },
  { href: "/overview", label: "Trades", icon: "overview" },
  { href: "/stats", label: "Statistik", icon: "stats" },
  { href: "/cash", label: "Konto", icon: "cash" },
];

const MORE: Tab[] = [
  { href: "/tax", label: "Steuer", icon: "tax" },
  { href: "/accounts", label: "Depots", icon: "accounts" },
  { href: "/settings", label: "Einstellungen", icon: "settings" },
];

/**
 * Untere Tab-Leiste für Mobil/Tablet (md:hidden). Vier Haupt-Tabs plus ein
 * „Mehr"-Sheet mit den übrigen Bereichen und dem Abmelden-Button.
 */
export function MobileNav({ logoutAction }: { logoutAction: () => void | Promise<void> }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const moreActive = MORE.some((m) => isActive(m.href, pathname));

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setOpen(false)}>
          <div
            className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-white/10 bg-zinc-900 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-zinc-700" />
            <div className="grid grid-cols-1 gap-1">
              {MORE.map((m) => (
                <Link
                  key={m.href}
                  href={m.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium",
                    isActive(m.href, pathname)
                      ? "bg-emerald-500/10 text-emerald-300 ring-1 ring-inset ring-emerald-500/20"
                      : "text-zinc-200 hover:bg-white/5",
                  )}
                >
                  <Icon name={m.icon} />
                  {m.label}
                </Link>
              ))}
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium text-zinc-200 hover:bg-white/5 hover:text-red-400"
                >
                  <Icon name="logout" />
                  Abmelden
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-white/10 bg-zinc-950/90 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {PRIMARY.map((t) => {
          const active = isActive(t.href, pathname);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
                active ? "text-emerald-400" : "text-zinc-500",
              )}
            >
              <Icon name={t.icon} size={22} />
              {t.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
            open || moreActive ? "text-emerald-400" : "text-zinc-500",
          )}
        >
          <Icon name="more" size={22} />
          Mehr
        </button>
      </nav>
    </>
  );
}
