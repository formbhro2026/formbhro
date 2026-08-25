import { ArrowRight, Plus, Loader2 } from "lucide-react";
import { useFillNow } from "@/components/layout/FillNowProvider";

export function FillNowCard() {
  const { openFillNow, isStartingChat } = useFillNow();
  return (
    <section className="relative overflow-hidden rounded-2xl border border-brand/30 bg-surface-1 p-5 sm:p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(255,122,0,0.14),transparent_65%)]"
      />
      <h2 className="text-lg font-bold text-white sm:text-xl">Need Help With a Form?</h2>
      <p className="mt-1.5 max-w-md text-sm leading-relaxed text-text-secondary">
        Start a request and connect with our support team for assistance.
      </p>
      <button
        type="button"
        disabled={isStartingChat}
        onClick={() => void openFillNow()}
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-dark to-brand-light px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_28px_-12px_rgba(255,122,0,0.85)] transition-transform duration-200 hover:scale-[1.02] active:scale-95 disabled:opacity-70"
      >
        {isStartingChat ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Starting Chat...
          </>
        ) : (
          <>
            <Plus className="h-4 w-4" aria-hidden="true" /> Fill Now{" "}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </>
        )}
      </button>
    </section>
  );
}
