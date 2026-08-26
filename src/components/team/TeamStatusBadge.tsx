import { Clock, CircleCheck, Hourglass, Search, type LucideIcon } from "lucide-react";
import {
  PRIORITY_META,
  TEAM_STATUS_META,
  type Priority,
  type TeamStatus,
} from "@/data/team-module";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = { Clock, CircleCheck, Hourglass, Search };

const TONES = {
  amber: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  orange: "border-brand/40 bg-brand/10 text-brand-light",
  green: "border-emerald-400/30 bg-emerald-400/10 text-emerald-400",
  neutral: "border-border-subtle bg-surface-1 text-text-secondary",
};

export function TeamStatusBadge({ status, className }: { status: TeamStatus; className?: string }) {
  const meta = TEAM_STATUS_META[status];
  const Icon = ICONS[meta.icon] ?? Clock;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
        TONES[meta.tone],
        className,
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" strokeWidth={2} />
      <span className="sr-only">Status: </span>
      {meta.label}
    </span>
  );
}

export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  const meta = PRIORITY_META[priority];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        meta.className,
        className,
      )}
    >
      <span className="sr-only">Priority: </span>
      {meta.label}
    </span>
  );
}
