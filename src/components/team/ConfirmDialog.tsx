import { useDialogA11y } from "@/lib/use-dialog-a11y";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function ConfirmDialog({
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "brand",
  onConfirm,
  onClose,
  children,
}: {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "brand" | "danger";
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
}) {
  const panelRef = useDialogA11y<HTMLDivElement>(onClose);
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4">
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
        aria-labelledby="confirm-dialog-title"
        className="relative w-full max-w-sm rounded-t-2xl border border-border-subtle bg-bg p-5 duration-200 animate-in slide-in-from-bottom-4 sm:rounded-2xl"
      >
        <h2 id="confirm-dialog-title" className="text-sm font-semibold text-white">
          {title}
        </h2>
        {description && (
          <p className="mt-2 text-xs leading-relaxed text-text-secondary">{description}</p>
        )}
        {children}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-xl border border-border-strong px-4 text-xs font-semibold text-white transition-colors hover:bg-white/5"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={cn(
              "min-h-11 rounded-xl px-4 text-xs font-semibold text-white transition-transform active:scale-95",
              tone === "danger"
                ? "bg-red-500/90 hover:bg-red-500"
                : "bg-gradient-to-r from-brand-dark to-brand-light",
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
