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
