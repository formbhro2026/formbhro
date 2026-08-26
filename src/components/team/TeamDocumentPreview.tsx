import { useMemo, useState } from "react";
import { Download, ExternalLink, Maximize2, Minimize2, X, ZoomIn, ZoomOut } from "lucide-react";
import type { TeamDocument } from "@/data/team-module";
import { downloadDocument, openDocumentInNewTab } from "@/lib/team-files";
import { useTeamDocumentUrl } from "@/lib/use-team-document-url";
import { useDialogA11y } from "@/lib/use-dialog-a11y";
import { DOC_ICONS } from "@/components/team/TeamDocumentCard";
import { cn } from "@/lib/utils";

export function TeamDocumentPreview({
  document: doc,
  onClose,
}: {
  document: TeamDocument;
  onClose: () => void;
}) {
  const panelRef = useDialogA11y<HTMLDivElement>(onClose);
  const [zoom, setZoom] = useState(1);
  const [expanded, setExpanded] = useState(false);
  const Icon = DOC_ICONS[doc.kind];
  const fileUrl = useTeamDocumentUrl(doc);

  const htmlSrcDoc = useMemo(
    () =>
      doc.kind === "html"
        ? `<!doctype html><meta charset="utf-8"><body style="margin:16px;background:#fff">${doc.html ?? ""}</body>`
        : undefined,
    [doc],
  );

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-4">
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
        aria-labelledby="team-doc-preview-title"
        className={cn(
          "relative flex w-full flex-col rounded-t-2xl border border-border-subtle bg-surface-1 duration-200 animate-in slide-in-from-bottom-4 sm:rounded-2xl",
          expanded ? "h-[92vh] max-w-5xl" : "max-h-[88vh] max-w-2xl",
        )}
      >
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-b border-border-subtle p-4">
          <div className="min-w-0">
            <h2 id="team-doc-preview-title" className="truncate text-sm font-semibold text-white">
              {doc.name}
            </h2>
            <p className="mt-0.5 truncate text-[11px] text-text-muted">
              {doc.size} • {doc.uploadedAt} • by {doc.uploadedBy}
            </p>
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

        <div className="min-h-0 flex-1 overflow-auto bg-surface-2 p-3">
          <div
            className="mx-auto grid min-h-56 place-items-center overflow-hidden rounded-xl border border-border-subtle bg-bg"
            style={{ width: `${Math.round(zoom * 100)}%` }}
          >
            {doc.kind === "image" && fileUrl ? (
              <img
                src={fileUrl}
                alt={`Preview of ${doc.name}`}
                className="h-full w-full object-contain"
              />
            ) : doc.kind === "pdf" && doc.storagePath && fileUrl ? (
              <iframe
                title={`PDF preview of ${doc.name}`}
                src={fileUrl}
                className="h-[60vh] w-full bg-white"
              />
            ) : doc.kind === "html" ? (
              <iframe
                title={`HTML preview of ${doc.name}`}
                srcDoc={htmlSrcDoc}
                sandbox=""
                className="h-[60vh] w-full bg-white"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 px-6 py-16 text-center text-text-muted">
                <Icon className="h-9 w-9 text-brand" strokeWidth={1.25} aria-hidden="true" />
                <p className="text-xs">
                  {doc.kind === "pdf" ? "PDF preview — page 1" : "Document preview"}
                </p>
                <p className="text-[11px]">Secure preview. Storage location is never exposed.</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border-subtle p-3">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
            aria-label="Zoom out"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border-strong text-white hover:bg-white/5"
          >
            <ZoomOut className="h-4 w-4" aria-hidden="true" />
          </button>
          <span className="text-[11px] tabular-nums text-text-secondary" aria-live="polite">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(2, +(z + 0.25).toFixed(2)))}
            aria-label="Zoom in"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border-strong text-white hover:bg-white/5"
          >
            <ZoomIn className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border-strong px-3 text-[11px] font-semibold text-white hover:bg-white/5"
          >
            {expanded ? (
              <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {expanded ? "Compact view" : "Resize view"}
          </button>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={() => void openDocumentInNewTab(doc)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border-strong px-3 text-[11px] font-semibold text-white hover:bg-white/5"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> New tab
            </button>
            <button
              type="button"
              onClick={() => void downloadDocument(doc)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-dark to-brand-light px-3 text-[11px] font-semibold text-white active:scale-95"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" /> Download
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
