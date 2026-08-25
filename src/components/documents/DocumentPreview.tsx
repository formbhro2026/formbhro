import { useEffect, useState } from "react";
import { Download, FileImage, FileText, File, X } from "lucide-react";
import type { UserDocument } from "@/data/user-module";
import { useDialogA11y } from "@/lib/use-dialog-a11y";
import { openDocument, resolveDocumentUrl } from "@/lib/doc-access";

const ICONS = { pdf: FileText, image: FileImage, doc: File };

export function DocumentPreview({ document: doc, onClose }: { document: UserDocument; onClose: () => void }) {
  const Icon = ICONS[doc.kind] ?? File;
  const panelRef = useDialogA11y<HTMLDivElement>(onClose);
  const [url, setUrl] = useState<string | null>(doc.previewUrl ?? null);

  useEffect(() => {
    let cancelled = false;
    setUrl(doc.previewUrl ?? null);
    if (doc.storagePath) {
      void resolveDocumentUrl(doc).then((signed) => {
        if (!cancelled) setUrl(signed);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [doc]);
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4">
      <button type="button" tabIndex={-1} aria-hidden="true" onClick={onClose} className="absolute inset-0 cursor-default" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="document-preview-title"
        className="relative w-full max-w-lg rounded-t-2xl border border-white/10 bg-surface-1 p-5 duration-200 animate-in slide-in-from-bottom-4 sm:rounded-2xl"
      >
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            <h2 id="document-preview-title" className="truncate text-sm font-semibold text-white">
              {doc.name}
            </h2>
            <p className="mt-0.5 truncate text-[11px] text-text-muted">{doc.requestTitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close document preview"
            className="rounded-lg p-2 text-text-muted transition-colors hover:bg-white/5 hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 grid h-56 place-items-center overflow-hidden rounded-xl border border-white/10 bg-surface-2">
          {url && doc.kind === "image" ? (
            <img
              src={url}
              alt={`Preview of ${doc.name}`}
              className="h-full w-full object-contain"
            />
          ) : url && doc.kind === "pdf" ? (
            <iframe src={url} title={`Preview of ${doc.name}`} className="h-full w-full" />
          ) : (
            <div className="flex flex-col items-center gap-2 text-text-muted">
              <Icon className="h-9 w-9 text-brand" strokeWidth={1.25} aria-hidden="true" />
              <p className="text-xs">{doc.kind === "image" ? "Image preview" : `${doc.kind.toUpperCase()} preview`}</p>
            </div>
          )}
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-[11px]">
          <div>
            <dt className="text-text-muted">Uploaded by</dt>
            <dd className="mt-0.5 text-white">{doc.uploadedBy}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Upload date</dt>
            <dd className="mt-0.5 text-white">{doc.date}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Size</dt>
            <dd className="mt-0.5 text-white">
              {doc.size}
              {doc.pageCount ? ` • ${doc.pageCount} page${doc.pageCount > 1 ? "s" : ""}` : ""}
              {doc.dimensions ? ` • ${doc.dimensions}` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-text-muted">Request</dt>
            <dd className="mt-0.5 truncate text-white">{doc.requestTitle}</dd>
          </div>
        </dl>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={() => void openDocument(doc, true)}
            aria-label={`Download ${doc.name}`}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-dark to-brand-light px-4 py-2.5 text-sm font-semibold text-white transition-transform duration-200 active:scale-95"
          >
            <Download className="h-4 w-4" aria-hidden="true" /> Download
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-white/5"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
