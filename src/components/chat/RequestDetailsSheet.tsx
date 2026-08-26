import { useEffect, useRef, useState } from "react";
import { FileText, Info, X } from "lucide-react";
import { RequestDetails } from "@/components/chat/RequestDetails";
import { DocumentCard } from "@/components/documents/DocumentCard";
import { EmptyState } from "@/components/common/EmptyState";
import type { SupportRequest, UserDocument } from "@/data/user-module";

type Tab = "details" | "documents";

export function RequestDetailsSheet({
  request,
  documents,
  onAddNote,
  onViewDocument,
  onClose,
  initialTab = "details",
}: {
  request: SupportRequest;
  documents: UserDocument[];
  onAddNote: (note: string) => void;
  onViewDocument: (id: string) => void;
  onClose: () => void;
  initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    openerRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("button")?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusables = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input:not([disabled]), textarea, select, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      openerRef.current?.focus?.();
    };
  }, [onClose]);

  const tabClass = (active: boolean) =>
    `inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-all duration-200 ${
      active
        ? "bg-brand/10 text-brand shadow-sm"
        : "text-text-secondary hover:bg-surface-3 hover:text-white"
    }`;

  return (
    <div className="fixed inset-0 z-[65] flex items-end justify-end bg-black/80 backdrop-blur-sm duration-200 animate-in fade-in 2xl:hidden">
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
        aria-label="Request details"
        className="relative flex max-h-[88dvh] w-full flex-col rounded-t-[32px] border border-border-subtle bg-surface-1 duration-200 animate-in slide-in-from-bottom-6 sm:h-full sm:max-h-none sm:max-w-sm sm:rounded-none sm:rounded-l-[32px] sm:slide-in-from-right-4"
      >
        <div className="shrink-0 border-b border-border-subtle px-4 pb-4 pt-4">
          <span
            aria-hidden
            className="mx-auto mb-4 block h-1.5 w-12 rounded-full bg-surface-3 sm:hidden"
          />
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-base font-bold text-white">{request.title}</p>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                {request.reference || request.id}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close request details"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-text-muted transition-colors duration-200 hover:bg-surface-2 hover:text-white"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <div
            role="tablist"
            aria-label="Request sections"
            onKeyDown={(e) => {
              if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
              e.preventDefault();
              const next: Tab = tab === "details" ? "documents" : "details";
              setTab(next);
              requestAnimationFrame(() => document.getElementById(`request-tab-${next}`)?.focus());
            }}
            className="mt-4 flex gap-1 rounded-xl bg-surface-2 p-1 border border-border-subtle"
          >
            <button
              type="button"
              role="tab"
              id="request-tab-details"
              aria-controls="request-tabpanel"
              aria-selected={tab === "details"}
              tabIndex={tab === "details" ? 0 : -1}
              onClick={() => setTab("details")}
              className={tabClass(tab === "details")}
            >
              <Info className="h-3.5 w-3.5" aria-hidden="true" /> Details
            </button>
            <button
              type="button"
              role="tab"
              id="request-tab-documents"
              aria-controls="request-tabpanel"
              aria-selected={tab === "documents"}
              tabIndex={tab === "documents" ? 0 : -1}
              onClick={() => setTab("documents")}
              className={tabClass(tab === "documents")}
            >
              <FileText className="h-3.5 w-3.5" aria-hidden="true" /> Documents
              <span className="rounded-full bg-brand/10 px-1.5 text-[10px] text-brand font-bold ml-1">
                {documents.length}
              </span>
            </button>
          </div>
        </div>

        <div
          id="request-tabpanel"
          role="tabpanel"
          tabIndex={0}
          aria-labelledby={`request-tab-${tab}`}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          {tab === "details" ? (
            <RequestDetails
              request={request}
              documents={documents}
              onAddNote={onAddNote}
              onViewDocument={onViewDocument}
              hideDocuments
            />
          ) : documents.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={FileText}
                title="No documents yet."
                description="Files you or the support team share in this chat appear here."
              />
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-3 p-4">
              {documents.map((d) => (
                <li key={d.id}>
                  <DocumentCard document={d} onView={() => onViewDocument(d.id)} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
