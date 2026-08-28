import { useState } from "react";
import { createPortal } from "react-dom";
import { BadgeIndianRupee, Check, ChevronDown, CircleCheck } from "lucide-react";
import { TEAM_STATUS_META, TEAM_STATUS_ORDER, type TeamStatus } from "@/data/team-module";
import { ConfirmDialog } from "@/components/team/ConfirmDialog";
import { useDialogA11y } from "@/lib/use-dialog-a11y";
import { cn } from "@/lib/utils";

export function StatusSelect({
  requestId,
  status,
  onChange,
  className,
}: {
  requestId: string;
  status: TeamStatus;
  onChange: (next: TeamStatus) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<TeamStatus | null>(null);
  const [done, setDone] = useState(false);

  const confirm = () => {
    if (!pending) return;
    onChange(pending);
    const completed = pending === "completed";
    setPending(null);
    if (completed) setDone(true);
  };

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Change status. Current status ${TEAM_STATUS_META[status].label}`}
        className="inline-flex min-h-9 w-full items-center justify-between gap-2 rounded-xl border border-border-strong bg-surface-2 px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-white/5"
      >
        {TEAM_STATUS_META[status].label}
        <ChevronDown className="h-3.5 w-3.5 text-text-muted" aria-hidden="true" />
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
            aria-label="Request status"
            className="absolute right-0 z-50 mt-1 w-52 overflow-hidden rounded-xl border border-border-subtle bg-surface-1 py-1 shadow-2xl"
          >
            {TEAM_STATUS_ORDER.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  role="option"
                  aria-selected={s === status}
                  onClick={() => {
                    setOpen(false);
                    if (s !== status) setPending(s);
                  }}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs text-white transition-colors hover:bg-white/5"
                >
                  {TEAM_STATUS_META[s].label}
                  {s === status && <Check className="h-3.5 w-3.5 text-brand" aria-hidden="true" />}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {pending && (
        <ConfirmDialog
          title={pending === "completed" ? "Mark request as completed?" : "Change request status?"}
          description={
            pending === "completed"
              ? `${requestId} will be marked Completed. The user and the admin will be notified and the payment status will be set to ready.`
              : `Status of ${requestId} will change to ${TEAM_STATUS_META[pending].label}.`
          }
          confirmLabel={pending === "completed" ? "Yes, mark completed" : "Change status"}
          onConfirm={confirm}
          onClose={() => setPending(null)}
        />
      )}

      {done && <CompletionDialog requestId={requestId} onClose={() => setDone(false)} />}
    </div>
  );
}

function CompletionDialog({ requestId, onClose }: { requestId: string; onClose: () => void }) {
  const panelRef = useDialogA11y<HTMLDivElement>(onClose);
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4">
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="completion-title"
        className="relative w-full max-w-sm rounded-t-2xl border border-border-subtle bg-surface-1 p-6 text-center duration-200 animate-in slide-in-from-bottom-4 sm:rounded-2xl shadow-2xl"
      >
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-emerald-400/30 bg-emerald-400/10">
          <CircleCheck className="h-6 w-6 text-emerald-400" strokeWidth={1.75} aria-hidden="true" />
        </span>
        <h2 id="completion-title" className="mt-4 text-sm font-semibold text-white">
          Request marked as completed successfully.
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-text-secondary">
          {requestId} is completed. The user and the admin have been notified.
        </p>
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand/10 px-3 py-1 text-[11px] font-semibold text-brand-light">
          <BadgeIndianRupee className="h-3 w-3" aria-hidden="true" /> Payment Status: Ready
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 min-h-11 w-full rounded-xl bg-gradient-to-r from-brand-dark to-brand-light text-xs font-semibold text-white active:scale-95"
        >
          Done
        </button>
      </div>
    </div>,
    document.body,
  );
}
