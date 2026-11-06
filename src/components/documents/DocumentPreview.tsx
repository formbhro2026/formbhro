import { useEffect, useState } from "react";
import { Download, FileImage, FileText, File, X, Trash2, Loader2, ExternalLink, Eye, Share2 } from "lucide-react";
import type { UserDocument } from "@/data/user-module";
import { useDialogA11y } from "@/lib/use-dialog-a11y";
import { openDocument, resolveDocumentUrl } from "@/lib/doc-access";
import { useUserStore } from "@/lib/user-store";
import { cn } from "@/lib/utils";

const ICONS = { pdf: FileText, image: FileImage, doc: File };

export function DocumentPreview({
  document: doc,
  onClose,
}: {
  document: UserDocument;
  onClose: () => void;
}) {
  const Icon = ICONS[doc.kind] ?? File;
  const panelRef = useDialogA11y<HTMLDivElement>(onClose);
  const [url, setUrl] = useState<string | null>(doc.previewUrl ?? null);
  const [loadingUrl, setLoadingUrl] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const { removeFile } = useUserStore();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete "${doc.name}"?`)) return;
    setIsDeleting(true);
    try {
      await removeFile(doc.id, doc.storagePath);
      onClose();
    } catch (err) {
      console.error("Failed to delete document:", err);
      setIsDeleting(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await openDocument(doc, true);
    } finally {
      setDownloading(false);
    }
  };

  const handleOpenExternal = () => {
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoadingUrl(true);
    setUrl(doc.previewUrl ?? null);

    void resolveDocumentUrl(doc, false)
      .then((signed) => {
        if (!cancelled) {
          if (signed) setUrl(signed);
          setLoadingUrl(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadingUrl(false);
      });

    return () => {
      cancelled = true;
    };
  }, [doc]);

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/80 backdrop-blur-md sm:items-center sm:p-4 animate-in fade-in duration-200">
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
        aria-labelledby="document-preview-title"
        className="relative w-full max-w-lg rounded-t-3xl border border-white/10 bg-[#121214] p-5 shadow-2xl duration-200 animate-in slide-in-from-bottom-4 sm:rounded-2xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="rounded-md border border-[#ff7a00]/30 bg-[#ff7a00]/15 px-1.5 py-0.5 text-[9px] font-bold text-[#ff7a00] uppercase tracking-wider">
                {doc.kind.toUpperCase()}
              </span>
              <h2 id="document-preview-title" className="truncate text-sm font-bold text-white tracking-tight" title={doc.name}>
                {doc.name}
              </h2>
            </div>
            {doc.requestTitle && (
              <p className="mt-1 truncate text-[11px] text-zinc-400 font-medium">
                {doc.requestTitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close document preview"
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white active:scale-95"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Visual Content Box */}
        <div className="mt-4 flex h-60 w-full items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0c] relative">
          {loadingUrl ? (
            <div className="flex flex-col items-center gap-2 text-zinc-400">
              <Loader2 className="h-6 w-6 animate-spin text-[#ff7a00]" />
              <span className="text-xs font-medium">Loading document…</span>
            </div>
          ) : url && doc.kind === "image" ? (
            <img
              src={url}
              alt={`Preview of ${doc.name}`}
              className="h-full w-full object-contain p-2"
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
              <div className="grid h-16 w-16 place-items-center rounded-2xl border border-white/10 bg-white/5 shadow-inner">
                <Icon className="h-8 w-8 text-[#ff7a00]" strokeWidth={2} aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">{doc.name}</p>
                <p className="mt-0.5 text-[11px] text-zinc-400 font-medium">
                  {doc.size} {doc.pageCount ? `• ${doc.pageCount} page${doc.pageCount > 1 ? "s" : ""}` : ""}
                </p>
              </div>
              {url && (
                <button
                  type="button"
                  onClick={handleOpenExternal}
                  className="mt-1 inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Open in Viewer
                </button>
              )}
            </div>
          )}
        </div>

        {/* Metadata Details Grid */}
        <dl className="mt-4 grid grid-cols-2 gap-2.5 rounded-xl border border-white/5 bg-white/[0.03] p-3 text-[11px]">
          <div>
            <dt className="font-medium text-zinc-500 uppercase tracking-wider text-[10px]">Uploaded by</dt>
            <dd className="mt-0.5 font-semibold text-zinc-200">{doc.uploadedBy || "You"}</dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-500 uppercase tracking-wider text-[10px]">Date</dt>
            <dd className="mt-0.5 font-semibold text-zinc-200">{doc.date || "Recently"}</dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-500 uppercase tracking-wider text-[10px]">File Size</dt>
            <dd className="mt-0.5 font-semibold text-zinc-200">{doc.size || "Unknown"}</dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-500 uppercase tracking-wider text-[10px]">Format</dt>
            <dd className="mt-0.5 font-semibold text-zinc-200 uppercase">{doc.kind}</dd>
          </div>
        </dl>

        {/* Action Buttons */}
        <div className="mt-4 flex items-center gap-2">
          {doc.uploadedBy === "You" && (
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={isDeleting}
              aria-label={`Delete ${doc.name}`}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10 px-3.5 text-red-400 transition-colors duration-200 hover:bg-red-500/20 active:scale-95 disabled:opacity-50"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => void handleDownload()}
            disabled={downloading}
            aria-label={`Download ${doc.name}`}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#ff7a00]/90 to-[#ff7a00] px-4 text-sm font-semibold text-white transition-all duration-200 hover:shadow-[0_0_20px_rgba(255,122,0,0.3)] active:scale-95 disabled:opacity-50"
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" aria-hidden="true" />
            )}
            {downloading ? "Downloading…" : "Download Document"}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-zinc-300 transition-colors duration-200 hover:bg-white/10 hover:text-white active:scale-95"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
