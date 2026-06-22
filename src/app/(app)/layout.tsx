import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Nav } from "@/components/nav";
import { Logo } from "@/components/Logo";
import { logoutAction } from "@/app/(auth)/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const initials = (user.name ?? user.email).slice(0, 2).toUpperCase();

  return (
    <div className="flex min-h-full flex-1">
      <aside className="sticky top-0 flex h-screen w-64 flex-col border-r border-white/5 bg-zinc-950/60 px-4 py-5 backdrop-blur">
        <div className="px-1">
          <Logo />
        </div>

        <div className="mt-8 flex-1">
          <Nav />
        </div>

        <div className="mt-4 flex items-center gap-1 border-t border-white/5 pt-4">
          <Link
            href="/settings"
            className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-white/5"
            title="Einstellungen öffnen"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-xs font-semibold text-emerald-300 ring-1 ring-inset ring-emerald-500/25">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-200">{user.name ?? user.email}</p>
              <p className="truncate text-xs text-zinc-500">{user.email}</p>
            </div>
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              title="Abmelden"
              aria-label="Abmelden"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-white/5 hover:text-red-400"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-6xl px-6 py-8 sm:px-8">{children}</div>
      </main>
    </div>
  );
}
