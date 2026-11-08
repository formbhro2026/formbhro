import { useEffect, useState } from "react";
import {
  Download,
  FileImage,
  FileText,
  File,
  X,
  Trash2,
  Loader2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from "lucide-react";
import type { UserDocument } from "@/data/user-module";
import { useDialogA11y } from "@/lib/use-dialog-a11y";
import { openDocument, resolveDocumentUrl } from "@/lib/doc-access";
import { useUserStore } from "@/lib/user-store";
import { registerBackHandler } from "@/lib/back-handler";
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
  const [zoomLevel, setZoomLevel] = useState(1);
  const { removeFile } = useUserStore();
  const [isDeleting, setIsDeleting] = useState(false);

  // Register hardware back button listener so back smoothly closes preview
  useEffect(() => {
    return registerBackHandler(() => {
      onClose();
      return true;
    });
  }, [onClose]);

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

  useEffect(() => {
    let cancelled = false;
    setLoadingUrl(true);
    setZoomLevel(1);
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
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/85 backdrop-blur-md sm:items-center sm:p-4 animate-in fade-in duration-200">
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
        className="relative flex flex-col w-full max-w-xl max-h-[92vh] sm:max-h-[88vh] rounded-t-3xl border border-white/10 bg-[#121214] p-4 sm:p-5 shadow-2xl duration-200 animate-in slide-in-from-bottom-4 sm:rounded-2xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3 shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="rounded-md border border-[#ff7a00]/30 bg-[#ff7a00]/15 px-1.5 py-0.5 text-[9px] font-bold text-[#ff7a00] uppercase tracking-wider">
                {doc.kind.toUpperCase()}
              </span>
              <h2
                id="document-preview-title"
                className="truncate text-sm font-bold text-white tracking-tight"
                title={doc.name}
              >
                {doc.name}
              </h2>
            </div>
            {doc.requestTitle && (
              <p className="mt-0.5 truncate text-[11px] text-zinc-400 font-medium">
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

        {/* Visual Content Box: Responsive container fitting mobile screen without auto-zoom */}
        <div className="mt-3 flex-1 min-h-[260px] max-h-[58vh] sm:max-h-[62vh] w-full flex items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[#09090b] relative">
          {loadingUrl ? (
            <div className="flex flex-col items-center gap-2 text-zinc-400">
              <Loader2 className="h-7 w-7 animate-spin text-[#ff7a00]" />
              <span className="text-xs font-medium">Loading document…</span>
            </div>
          ) : url && doc.kind === "image" ? (
            <div className="relative w-full h-full flex items-center justify-center overflow-auto p-2">
              <img
                src={url}
                alt={`Preview of ${doc.name}`}
                className="max-h-[54vh] max-w-full w-auto h-auto object-contain mx-auto select-none transition-transform duration-200"
                style={{
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: "center center",
                }}
              />
              {/* Floating Zoom Controls for Images */}
              <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-xl border border-white/10 bg-black/70 p-1 backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.min(z + 0.25, 3))}
                  className="rounded-lg p-1.5 text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.max(z - 0.25, 0.75))}
                  className="rounded-lg p-1.5 text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                {zoomLevel !== 1 && (
                  <button
                    type="button"
                    onClick={() => setZoomLevel(1)}
                    className="rounded-lg p-1.5 text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
                    title="Reset Zoom"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ) : url && doc.kind === "pdf" ? (
            <div className="w-full h-full min-h-[300px]">
              <iframe
                title={`PDF preview of ${doc.name}`}
                src={`${url}#toolbar=0&navpanes=0&view=Fit`}
                className="w-full h-full min-h-[300px] max-h-[58vh] bg-white border-0 rounded-2xl"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
              <div className="grid h-16 w-16 place-items-center rounded-2xl border border-white/10 bg-white/5 shadow-inner">
                <Icon className="h-8 w-8 text-[#ff7a00]" strokeWidth={2} aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">{doc.name}</p>
                <p className="mt-0.5 text-[11px] text-zinc-400 font-medium">
                  {doc.size}{" "}
                  {doc.pageCount ? `• ${doc.pageCount} page${doc.pageCount > 1 ? "s" : ""}` : ""}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Metadata Details Grid */}
        <dl className="mt-3 grid grid-cols-3 gap-2 rounded-xl border border-white/5 bg-white/[0.03] p-2.5 text-[11px] shrink-0">
          <div>
            <dt className="font-medium text-zinc-500 uppercase tracking-wider text-[9px]">Uploaded by</dt>
            <dd className="mt-0.5 font-semibold text-zinc-200 truncate">{doc.uploadedBy || "You"}</dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-500 uppercase tracking-wider text-[9px]">File Size</dt>
            <dd className="mt-0.5 font-semibold text-zinc-200">{doc.size || "Unknown"}</dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-500 uppercase tracking-wider text-[9px]">Format</dt>
            <dd className="mt-0.5 font-semibold text-zinc-200 uppercase">{doc.kind}</dd>
          </div>
        </dl>

        {/* Action Buttons */}
        <div className="mt-3 flex items-center gap-2 shrink-0">
          {doc.uploadedBy === "You" && (
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={isDeleting}
              aria-label={`Delete ${doc.name}`}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10 px-3 text-red-400 transition-colors duration-200 hover:bg-red-500/20 active:scale-95 disabled:opacity-50"
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
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#ff7a00]/90 to-[#ff7a00] px-4 text-xs font-bold text-white transition-all duration-200 hover:shadow-[0_0_20px_rgba(255,122,0,0.3)] active:scale-95 disabled:opacity-50"
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
            className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 text-xs font-semibold text-zinc-300 transition-colors duration-200 hover:bg-white/10 hover:text-white active:scale-95"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
