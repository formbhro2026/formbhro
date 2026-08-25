import { TriangleAlert, RotateCw } from "lucide-react";

export function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this right now. Please try again.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-border-subtle bg-bg px-6 py-12 text-center">
      <TriangleAlert className="h-7 w-7 text-amber-300" strokeWidth={1.5} aria-hidden="true" />
      <p className="mt-4 text-sm font-semibold text-white">{title}</p>
      <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-text-secondary">{description}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex items-center gap-2 rounded-full border border-border-strong px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/5"
        >
          <RotateCw className="h-3.5 w-3.5" aria-hidden="true" /> Retry
        </button>
      )}
    </div>
  );
}
