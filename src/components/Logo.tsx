import { cn } from "@/components/ui";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-8 w-8", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id="tt-bg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#34d399" />
          <stop offset="1" stopColor="#0f766e" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill="url(#tt-bg)" />
      <g fill="#ffffff">
        <rect x="11" y="27" width="6" height="10" rx="2" />
        <rect x="21" y="21" width="6" height="16" rx="2" />
        <rect x="31" y="13" width="6" height="24" rx="2" />
      </g>
      <path
        d="M12 24 L23 18 L34 11"
        stroke="#ffffff"
        strokeOpacity="0.85"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="34" cy="11" r="2.6" fill="#ffffff" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className="h-9 w-9 shadow-lg shadow-emerald-900/30" />
      <div className="leading-tight">
        <div className="text-base font-semibold tracking-tight text-zinc-50">
          Trade<span className="text-emerald-400">Tracker</span>
        </div>
      </div>
    </div>
  );
}
