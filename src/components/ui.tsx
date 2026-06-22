import * as React from "react";

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function Button({
  className,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const variants: Record<string, string> = {
    primary:
      "bg-gradient-to-b from-emerald-500 to-emerald-600 text-white shadow-sm shadow-emerald-900/40 hover:from-emerald-400 hover:to-emerald-500",
    secondary:
      "bg-white/5 text-zinc-100 ring-1 ring-inset ring-white/10 hover:bg-white/10",
    ghost: "bg-transparent text-zinc-200 hover:bg-white/5",
    danger:
      "bg-gradient-to-b from-red-500 to-red-600 text-white shadow-sm shadow-red-900/40 hover:from-red-400 hover:to-red-500",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-lg border border-white/10 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-colors focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20",
        className,
      )}
      {...props}
    />
  );
}

/** Filtert die Eingabe auf Zahlen (optional ganzzahlig) und zeigt rechts eine Einheit. */
export function NumberInput({
  className,
  unit,
  integer = false,
  onChange,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  unit?: string;
  integer?: boolean;
}) {
  function sanitize(value: string): string {
    let s = value.replace(/[^0-9.,]/g, "");
    if (integer) {
      s = s.replace(/[.,]/g, "");
    } else {
      // nur ein Dezimaltrenner erlaubt
      const sep = s.search(/[.,]/);
      if (sep !== -1) {
        s = s.slice(0, sep + 1) + s.slice(sep + 1).replace(/[.,]/g, "");
      }
    }
    return s;
  }

  return (
    <div className="relative">
      <input
        type="text"
        inputMode={integer ? "numeric" : "decimal"}
        autoComplete="off"
        className={cn(
          "w-full rounded-lg border border-white/10 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-colors focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20",
          unit && "pr-14",
          className,
        )}
        onChange={(e) => {
          const clean = sanitize(e.target.value);
          if (clean !== e.target.value) e.target.value = clean;
          onChange?.(e);
        }}
        {...props}
      />
      {unit && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-zinc-500">
          {unit}
        </span>
      )}
    </div>
  );
}

export function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full rounded-lg border border-white/10 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20",
        className,
      )}
      {...props}
    />
  );
}

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1 block text-sm font-medium text-zinc-300", className)}
      {...props}
    />
  );
}

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-white/5 bg-zinc-900/40 p-5 shadow-lg shadow-black/20 backdrop-blur-sm",
        className,
      )}
      {...props}
    />
  );
}

export function InfoTip({
  text,
  className,
  width = "w-60",
}: {
  text: React.ReactNode;
  className?: string;
  width?: string;
}) {
  return (
    <span className={cn("group relative ml-1 inline-flex items-center align-middle print:hidden", className)}>
      <span className="flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-zinc-600 text-[10px] font-medium leading-none text-zinc-400">
        i
      </span>
      <span
        className={cn(
          "pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 -translate-x-1/2 rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-xs font-normal leading-snug text-zinc-200 opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100",
          width,
        )}
      >
        {text}
      </span>
    </span>
  );
}

export function FieldError({ message }: { message?: string | null }) {
  if (!message) return null;
  return <p className="mt-1 text-sm text-red-400">{message}</p>;
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div className="rounded-md border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">
      {message}
    </div>
  );
}

export function Badge({
  children,
  color = "zinc",
}: {
  children: React.ReactNode;
  color?: "zinc" | "green" | "red" | "amber" | "blue";
}) {
  const colors: Record<string, string> = {
    zinc: "bg-zinc-800 text-zinc-300",
    green: "bg-emerald-900/60 text-emerald-300",
    red: "bg-red-900/60 text-red-300",
    amber: "bg-amber-900/60 text-amber-300",
    blue: "bg-blue-900/60 text-blue-300",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        colors[color],
      )}
    >
      {children}
    </span>
  );
}
