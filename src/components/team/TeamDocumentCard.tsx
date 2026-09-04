import { Download, Eye, File, FileCode2, FileImage, FileText, Trash2, Send } from "lucide-react";
import type { TeamDocument } from "@/data/team-module";
import { downloadDocument } from "@/lib/team-files";
import { useTeamDocumentUrl } from "@/lib/use-team-document-url";

export const DOC_ICONS = { pdf: FileText, image: FileImage, doc: File, html: FileCode2 } as const;

export function TeamDocumentCard({
  document: doc,
  requestTitle,
  onPreview,
  onDelete,
  onShare,
  shareLabel = "Send in Chat",
}: {
  document: TeamDocument;
  requestTitle?: string;
  onPreview: () => void;
  onDelete?: () => void;
  onShare?: () => void;
  shareLabel?: string;
}) {
  const Icon = DOC_ICONS[doc.kind] ?? File;
  const thumbUrl = useTeamDocumentUrl(doc.kind === "image" ? doc : null);

  const handleDelete = () => {
    if (!onDelete) return;
    if (confirm(`Are you sure you want to delete "${doc.name}"?`)) {
      onDelete();
    }
  };

  return (
    <article className="flex flex-col rounded-2xl border border-border-subtle bg-surface-1 p-4 transition-colors duration-200 hover:border-border-strong">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-border-subtle bg-surface-2">
          {thumbUrl ? (
            <img src={thumbUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <Icon className="h-4.5 w-4.5 text-brand" strokeWidth={1.75} aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-white">{doc.name}</h3>
          <p className="mt-0.5 truncate text-[11px] text-text-muted">
            {requestTitle ?? doc.requestId}
          </p>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-text-secondary">
        {doc.size} • {doc.uploadedAt} • by {doc.uploadedBy}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onPreview}
          aria-label={`Preview ${doc.name}`}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border-strong px-3 py-1.5 text-[11px] font-semibold text-white transition-colors duration-200 hover:bg-white/5"
        >
          <Eye className="h-3.5 w-3.5" aria-hidden="true" /> Preview
        </button>
        <button
          type="button"
          onClick={() => void downloadDocument(doc)}
          aria-label={`Download ${doc.name}`}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border-strong px-3 py-1.5 text-[11px] font-semibold text-white transition-colors duration-200 hover:bg-white/5"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" /> Download
        </button>
        {onShare && (
          <button
            type="button"
            onClick={onShare}
            aria-label={`${shareLabel} ${doc.name}`}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-brand/30 bg-brand/10 px-3 py-1.5 text-[11px] font-semibold text-brand transition-colors duration-200 hover:bg-brand/20"
          >
            <Send className="h-3.5 w-3.5" aria-hidden="true" /> {shareLabel}
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={handleDelete}
            aria-label={`Delete ${doc.name}`}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-[11px] font-semibold text-red-400 transition-colors duration-200 hover:bg-red-500/20 hover:text-red-300"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Delete
          </button>
        )}
      </div>
    </article>
  );
}
