import { useEffect, useRef, useState } from "react";
import { FileText, Info, Plus, UploadCloud, X } from "lucide-react";
import { RequestDetails } from "@/components/chat/RequestDetails";
import { DocumentCard } from "@/components/documents/DocumentCard";
import { EmptyState } from "@/components/common/EmptyState";
import type { SupportRequest, UserDocument } from "@/data/user-module";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Tab = "documents" | "details";
type DocFilter = "this_request" | "all_docs";

export function RequestDetailsSheet({
  request,
  documents,
  allDocuments = [],
  onAddNote,
  onViewDocument,
  onDeleteDocument,
  onShareDocument,
  onUploadDocument,
  onClose,
  initialTab = "documents",
}: {
  request: SupportRequest;
  documents: UserDocument[];
  allDocuments?: UserDocument[];
  onAddNote: (note: string) => void;
  onViewDocument: (id: string) => void;
  onDeleteDocument?: (id: string, storagePath?: string) => Promise<void>;
  onShareDocument?: (doc: UserDocument) => void;
  onUploadDocument?: (file: File, name: string) => Promise<void>;
  onClose: () => void;
  initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [docFilter, setDocFilter] = useState<DocFilter>("this_request");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  // Pool of all user documents, falling back to request documents
  const allUserDocs = allDocuments.length > 0 ? allDocuments : documents;
  const currentList = docFilter === "this_request" ? documents : allUserDocs;

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUploadDocument) return;
    setIsUploading(true);
    try {
      await onUploadDocument(file, file.name);
      toast.success(`Uploaded "${file.name}"`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to upload document");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

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
        aria-label="Request details and documents"
        className="relative flex max-h-[90dvh] w-full flex-col rounded-t-[32px] border border-border-subtle bg-surface-1 duration-200 animate-in slide-in-from-bottom-6 sm:h-full sm:max-h-none sm:max-w-md sm:rounded-none sm:rounded-l-[32px] sm:slide-in-from-right-4"
      >
        <div className="shrink-0 border-b border-border-subtle px-4 pb-3 pt-4">
          <span
            aria-hidden
            className="mx-auto mb-3 block h-1.5 w-12 rounded-full bg-surface-3 sm:hidden"
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
              aria-label="Close"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-text-muted transition-colors duration-200 hover:bg-surface-2 hover:text-white"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <div
            role="tablist"
            aria-label="Request sections"
            className="mt-3 flex gap-1 rounded-xl bg-surface-2 p-1 border border-border-subtle"
          >
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
                {allUserDocs.length}
              </span>
            </button>
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
              <Info className="h-3.5 w-3.5" aria-hidden="true" /> Info & Notes
            </button>
          </div>

          {/* Sub-filter pills for documents tab */}
          {tab === "documents" && (
            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setDocFilter("this_request")}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all",
                    docFilter === "this_request"
                      ? "bg-brand/20 text-brand border border-brand/30"
                      : "bg-surface-2 text-text-muted hover:text-white border border-border-subtle",
                  )}
                >
                  This Chat ({documents.length})
                </button>
                <button
                  type="button"
                  onClick={() => setDocFilter("all_docs")}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all",
                    docFilter === "all_docs"
                      ? "bg-brand/20 text-brand border border-brand/30"
                      : "bg-surface-2 text-text-muted hover:text-white border border-border-subtle",
                  )}
                >
                  Saved Docs ({allUserDocs.length})
                </button>
              </div>

              {onUploadDocument && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand/10 px-2.5 py-1 text-[10px] font-bold text-brand hover:bg-brand hover:text-white transition-all disabled:opacity-50"
                  >
                    <Plus className="h-3 w-3" /> Upload
                  </button>
                </>
              )}
            </div>
          )}
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
              allDocuments={allUserDocs}
              onAddNote={onAddNote}
              onViewDocument={onViewDocument}
              onDeleteDocument={onDeleteDocument}
              onShareDocument={onShareDocument}
              hideDocuments
            />
          ) : currentList.length === 0 ? (
            <div className="p-6 text-center">
              <EmptyState
                icon={FileText}
                title={docFilter === "this_request" ? "No documents in this chat." : "No saved documents found."}
                description={
                  docFilter === "this_request"
                    ? "Upload documents or share from your saved vault so you don't have to upload again."
                    : "Upload documents to your account vault once and reuse them in any chat."
                }
                action={
                  onUploadDocument && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-brand bg-brand/10 px-4 py-2 text-xs font-bold text-brand hover:bg-brand hover:text-white transition-all"
                    >
                      <UploadCloud className="h-4 w-4" /> Upload Document
                    </button>
                  )
                }
              />
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-3 p-4">
              {currentList.map((d) => (
                <li key={d.id}>
                  <DocumentCard
                    document={d}
                    onView={() => onViewDocument(d.id)}
                    onShare={
                      onShareDocument
                        ? () => {
                            onShareDocument(d);
                            onClose();
                          }
                        : undefined
                    }
                    shareLabel="Send in Chat"
                    onDelete={
                      onDeleteDocument
                        ? async () => {
                            await onDeleteDocument(d.id, d.storagePath);
                          }
                        : undefined
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

