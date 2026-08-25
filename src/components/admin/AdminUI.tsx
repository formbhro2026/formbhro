import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { Search } from "lucide-react";

export function Panel({
  title,
  action,
  children,
  className,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl border border-border-subtle bg-surface-1 p-4 sm:p-5", className)}>
      {(title || action) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-sm font-semibold text-white">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">{label}</p>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-brand/30 bg-brand/10">
          <Icon className="h-4 w-4 text-brand" strokeWidth={1.75} aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 text-2xl font-bold text-white tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-text-secondary">{hint}</p>}
    </div>
  );
}

export function SearchBox({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
}) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
      <input
        type="search"
        value={value}
        aria-label={label}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-10 w-full rounded-xl border border-border-subtle bg-bg pl-9 pr-3 text-xs text-white placeholder:text-text-muted focus:border-brand/50 focus:outline-none"
      />
    </div>
  );
}

export function Pill({ tone = "neutral", children }: { tone?: "neutral" | "brand" | "ok" | "warn" | "bad"; children: ReactNode }) {
  const tones = {
    neutral: "border-border-strong bg-surface-1 text-text-secondary",
    brand: "border-brand/40 bg-brand/10 text-brand-light",
    ok: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
    warn: "border-amber-400/30 bg-amber-400/10 text-amber-300",
    bad: "border-red-400/30 bg-red-400/10 text-red-300",
  } as const;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold", tones[tone])}>
      {children}
    </span>
  );
}

export function Button({
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  const variants = {
    primary: "bg-gradient-to-r from-brand-dark to-brand-light text-white",
    ghost: "border border-border-strong bg-surface-1 text-text-secondary hover:text-white",
    danger: "border border-red-400/30 bg-red-400/10 text-red-300",
  } as const;
  return (
    <button
      {...props}
      className={cn(
        "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-transform duration-200 active:scale-95 disabled:opacity-60",
        variants[variant],
        className,
      )}
    />
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-text-secondary">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "min-h-10 w-full rounded-xl border border-border-subtle bg-bg px-3 text-xs text-white placeholder:text-text-muted focus:border-brand/50 focus:outline-none";

export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[640px] border-collapse text-left text-xs">{children}</table>
    </div>
  );
}

export function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-8 text-center text-xs text-text-muted">
        {text}
      </td>
    </tr>
  );
}

export function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
