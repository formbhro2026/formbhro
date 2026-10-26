import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { CreditCard, Check, CheckCircle, ChevronDown, FileText, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type PaymentStatus,
  PAYMENT_STATUS_META,
  PAYMENT_STATUS_ORDER,
} from "@/data/team-module";
import { useTeamStore } from "@/lib/team-store";

export function PaymentStatusBadge({
  status = "pending",
  className,
}: {
  status?: PaymentStatus;
  className?: string;
}) {
  const meta = PAYMENT_STATUS_META[status] || PAYMENT_STATUS_META.pending;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        meta.badgeClass,
        className,
      )}
    >
      <CreditCard className="h-3 w-3" aria-hidden="true" />
      {meta.label}
    </span>
  );
}

export function PaymentStatusSelect({
  requestId,
  status = "pending",
  onChange,
  className,
}: {
  requestId: string;
  status?: PaymentStatus;
  onChange: (status: PaymentStatus) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const currentMeta = PAYMENT_STATUS_META[status] || PAYMENT_STATUS_META.pending;

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", onClickOutside);
      return () => document.removeEventListener("mousedown", onClickOutside);
    }
  }, [open]);

  return (
    <div ref={ref} className={cn("relative inline-block", className)}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={`Payment status: ${currentMeta.label}. Click to change.`}
        className={cn(
          "inline-flex h-8 items-center justify-between gap-1.5 rounded-xl border px-2.5 text-xs font-semibold transition-all shadow-xs",
          currentMeta.badgeClass,
          "hover:brightness-110",
        )}
      >
        <span className="flex items-center gap-1.5">
          <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{currentMeta.label}</span>
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[170px] rounded-xl border border-border-subtle bg-surface-1 p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-100">
          <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-text-muted">
            Update Payment Status
          </p>
          <div className="space-y-0.5">
            {PAYMENT_STATUS_ORDER.map((s) => {
              const itemMeta = PAYMENT_STATUS_META[s];
              const isSelected = s === status;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    onChange(s);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors text-left",
                    isSelected
                      ? "bg-surface-2 text-white font-bold"
                      : "text-text-secondary hover:bg-surface-2 hover:text-white",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        s === "paid" && "bg-emerald-400",
                        s === "pending" && "bg-amber-400",
                        s === "unpaid" && "bg-red-400",
                        s === "waived" && "bg-blue-400",
                        s === "failed" && "bg-rose-400",
                      )}
                    />
                    {itemMeta.label}
                  </span>
                  {isSelected && <Check className="h-3.5 w-3.5 text-brand" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function PaymentNoteButton({
  requestId,
  currentNote = "",
  paymentStatus = "ready",
}: {
  requestId: string;
  currentNote?: string;
  paymentStatus?: PaymentStatus;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(currentNote);
  const [saving, setSaving] = useState(false);
  const { updatePaymentStatus } = useTeamStore();

  useEffect(() => {
    setNote(currentNote);
  }, [currentNote]);

  const handleSave = async () => {
    setSaving(true);
    try {
      updatePaymentStatus(requestId, paymentStatus, note.trim());
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-text-muted hover:border-brand/40 hover:text-brand transition-colors"
      >
        <FileText className="h-3 w-3" />
        <span>{currentNote ? "Edit Note" : "+ Add Note"}</span>
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl border border-border-subtle bg-surface-1 p-5 shadow-2xl">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileText className="h-4 w-4 text-brand" />
                  Payment Note & Remarks
                </h3>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded p-1 text-text-muted hover:bg-white/10 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="text-xs text-text-secondary mb-3">
                Add amount received (kitni payment aai), UPI/cash transaction details, or waiver reasons for{" "}
                <strong>{requestId.slice(0, 10)}</strong>.
              </p>

              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. ₹250 received via UPI / Cash (Ref #987654321)..."
                rows={3}
                className="w-full rounded-xl border border-border-subtle bg-surface-2 p-3 text-xs text-white placeholder:text-text-muted focus:border-brand/50 outline-none resize-none"
              />

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-xl border border-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/5"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-1.5 text-xs font-bold text-white hover:bg-brand-light shadow-sm disabled:opacity-50"
                >
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save Note
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

export function CompletionPaymentModal({
  open,
  onClose,
  requestId,
  currentStatus = "paid",
  currentNote = "",
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  requestId: string;
  currentStatus?: PaymentStatus;
  currentNote?: string;
  onConfirm: (paymentStatus: PaymentStatus, note: string) => void;
}) {
  const [status, setStatus] = useState<PaymentStatus>(
    currentStatus === "pending" || currentStatus === "unpaid" ? "paid" : currentStatus,
  );
  const [note, setNote] = useState(currentNote);

  useEffect(() => {
    setStatus(currentStatus === "pending" || currentStatus === "unpaid" ? "paid" : currentStatus);
    setNote(currentNote);
  }, [currentStatus, currentNote, open]);

  if (!open) return null;

  const STATUS_OPTIONS: { key: PaymentStatus; label: string; dotColor: string }[] = [
    { key: "paid", label: "Paid", dotColor: "bg-emerald-400" },
    { key: "pending", label: "Pending", dotColor: "bg-amber-400" },
    { key: "unpaid", label: "Unpaid", dotColor: "bg-red-400" },
    { key: "waived", label: "Waived", dotColor: "bg-blue-400" },
  ];

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl border border-emerald-500/30 bg-surface-1 p-5 shadow-2xl space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
              <CheckCircle className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-white">Form Completed</h3>
              <p className="text-[11px] text-text-muted">
                Record payment status & amount received for <strong>{requestId}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-text-muted hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Payment Status Selection */}
        <div>
          <label className="text-xs font-semibold text-text-secondary block mb-1.5">
            Payment Status
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {STATUS_OPTIONS.map((opt) => {
              const isSelected = status === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setStatus(opt.key)}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-xl border py-2 px-2.5 text-xs font-semibold transition-all",
                    isSelected
                      ? "border-emerald-500 bg-emerald-500/20 text-white font-bold shadow-sm"
                      : "border-border-subtle bg-surface-2 text-text-muted hover:bg-surface-3 hover:text-text",
                  )}
                >
                  <span className={cn("h-2 w-2 rounded-full", opt.dotColor)} />
                  <span>{opt.label}</span>
                  {isSelected && <Check className="h-3 w-3 text-emerald-400 ml-0.5" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Kitni payment aai / Payment Note */}
        <div>
          <label className="text-xs font-semibold text-text-secondary block mb-1.5">
            Amount Received & Payment Note (Kitni payment aai)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. ₹250 received via UPI (Ref #987654321) / Cash received..."
            rows={3}
            autoFocus
            className="w-full rounded-xl border border-border-subtle bg-surface-2 p-3 text-xs text-white placeholder:text-text-muted focus:border-emerald-500/50 outline-none resize-none"
          />
          <p className="text-[10px] text-text-muted mt-1">
            This will be recorded directly into the request's Payment Notes for accounting and auditing.
          </p>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(status, "")}
            className="rounded-xl border border-border-subtle bg-surface-2 px-3 py-1.5 text-xs font-semibold text-text-muted hover:text-white hover:bg-surface-3 transition-colors"
          >
            Skip Note
          </button>
          <button
            type="button"
            onClick={() => onConfirm(status, note.trim())}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 shadow-md shadow-emerald-950 transition-colors"
          >
            <Check className="h-3.5 w-3.5" />
            Complete & Save Note
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
