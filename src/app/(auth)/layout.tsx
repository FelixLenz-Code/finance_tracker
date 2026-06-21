import { LogoMark } from "@/components/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <LogoMark className="h-12 w-12 shadow-xl shadow-emerald-900/40" />
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">
            Trade<span className="text-emerald-400">Tracker</span>
          </h1>
          <p className="mt-1 text-sm text-zinc-500">Aktien &amp; Optionen im Blick</p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-zinc-900/50 p-6 shadow-2xl shadow-black/40 backdrop-blur">
          {children}
        </div>
      </div>
    </div>
  );
}
