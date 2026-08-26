import {
  Clock,
  CircleCheck,
  Loader,
  Search,
  Sparkle,
  Upload,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import { STATUS_META, type RequestStatus } from "@/data/user-module";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  Clock,
  CircleCheck,
  Loader,
  Search,
  Sparkle,
  Upload,
  UserCheck,
};

const TONES = {
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-500",
  orange: "border-brand/40 bg-brand/10 text-brand",
  green: "border-success/30 bg-success/10 text-success",
  neutral: "border-border-subtle bg-surface-2 text-text-secondary",
};

export function StatusBadge({
  status,
  className,
  live = false,
}: {
  status: RequestStatus;
  className?: string;
  /** Announce status changes to screen readers (use on the active request card). */
  live?: boolean;
}) {
  const meta = STATUS_META[status];
  const Icon = ICONS[meta.icon] ?? Clock;
  return (
    <span
      {...(live ? { role: "status" as const, "aria-live": "polite" as const } : {})}
      title={`Status: ${meta.label}`}
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
