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

        <div className="mt-4 border-t border-white/5 pt-4">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-xs font-semibold text-emerald-300 ring-1 ring-inset ring-emerald-500/25">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-200">{user.name ?? user.email}</p>
              <p className="truncate text-xs text-zinc-500">{user.email}</p>
            </div>
          </div>
          <form action={logoutAction} className="mt-1">
            <button className="w-full rounded-lg px-2 py-2 text-left text-sm text-zinc-400 transition-colors hover:bg-white/5 hover:text-red-400">
              Abmelden
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
