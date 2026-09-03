import { useState } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { updateRequestPriority } from "@/lib/api/requests";
import { PriorityBadge } from "@/components/team/TeamStatusBadge";
import type { Priority } from "@/data/team-module";
import type { DbRequestPriority } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: "low", label: "Low Priority" },
  { value: "medium", label: "Medium Priority" },
  { value: "high", label: "High Priority" },
];

export function PrioritySelect({
  requestId,
  priority,
  onChange,
  className,
}: {
  requestId: string;
  priority: Priority;
  onChange?: (newPriority: Priority) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleSelect = async (newPriority: Priority) => {
    if (newPriority === priority) {
      setOpen(false);
      return;
    }
    setOpen(false);
    setBusy(true);
    try {
      await updateRequestPriority(requestId, newPriority as DbRequestPriority);
      onChange?.(newPriority);
      toast.success(`Priority set to ${newPriority}`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to update priority");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={busy}
        className="inline-flex min-h-8 items-center justify-between gap-1.5 rounded-lg border border-border-strong bg-surface-2 px-2 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-white/5 disabled:opacity-50"
      >
        {busy ? (
          <span className="flex items-center gap-1 text-[10px]">
            <Loader2 className="h-3 w-3 animate-spin" />
            Updating...
          </span>
        ) : (
          <PriorityBadge priority={priority} />
        )}
        <ChevronDown className="h-3 w-3 shrink-0 text-text-muted" aria-hidden="true" />
      </button>

      {open && (
        <>
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <ul
            role="listbox"
            aria-label="Request priority"
            className="absolute right-0 z-50 mt-1 w-44 overflow-hidden rounded-xl border border-border-subtle bg-surface-1 py-1 shadow-2xl"
          >
            {PRIORITIES.map((p) => (
              <li key={p.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={p.value === priority}
                  onClick={() => void handleSelect(p.value)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs text-white transition-colors hover:bg-white/5"
                >
                  <PriorityBadge priority={p.value} />
                  {p.value === priority && (
                    <Check className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden="true" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
