import { useState } from "react";
import { Download, Eye, FileImage, FileText, File, Trash2, Send, Loader2 } from "lucide-react";
import type { UserDocument } from "@/data/user-module";
import { openDocument } from "@/lib/doc-access";
import { useDocumentUrl } from "@/lib/use-document-url";
import { cn } from "@/lib/utils";

const ICONS = { pdf: FileText, image: FileImage, doc: File };

export function DocumentCard({
  document: doc,
  onView,
  onDelete,
  onShare,
  shareLabel = "Share in Chat",
}: {
  document: UserDocument;
  onView: () => void;
  onDelete?: () => void;
  onShare?: () => void;
  shareLabel?: string;
}) {
  const Icon = ICONS[doc.kind] ?? File;
  const thumbUrl = useDocumentUrl(doc);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onDelete) return;
    if (window.confirm(`Are you sure you want to delete "${doc.name}"?`)) {
      setIsDeleting(true);
      try {
        await onDelete();
      } finally {
        setIsDeleting(false);
      }
    }
  };

  return (
    <article className="group flex flex-col rounded-2xl border border-border-subtle bg-surface-1 p-5 transition-all duration-200 hover:border-text-muted hover:bg-surface-2 hover:shadow-xl hover:shadow-black/20">
      <div className="flex items-start gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-surface-3 text-brand transition-transform group-hover:scale-105">
          {thumbUrl && doc.kind === "image" ? (
            <img
              src={thumbUrl}
              alt={`Preview of ${doc.name}`}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <Icon className="h-6 w-6" strokeWidth={2.5} aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold text-white transition-colors group-hover:text-brand">
            {doc.name}
          </h3>
          <p className="mt-0.5 truncate text-[10px] font-bold text-brand uppercase tracking-wider">
            {doc.requestTitle}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-1">
        <p className="text-[10px] font-bold text-text-muted uppercase tracking-tight">
          Uploaded by <span className="text-text-secondary">{doc.uploadedBy}</span>
        </p>
        <p className="text-[10px] font-bold text-text-muted uppercase tracking-tight">
          {doc.date} • {doc.size}
          {doc.pageCount ? ` • ${doc.pageCount}p` : ""}
        </p>
      </div>

      {onShare && (
        <div className="mt-4">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onShare();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-brand/40 bg-brand/10 px-3 py-2 text-[11px] font-bold text-brand uppercase tracking-wider transition-all hover:bg-brand hover:text-white active:scale-95 shadow-sm"
          >
            <Send className="h-3.5 w-3.5" /> {shareLabel}
          </button>
        </div>
      )}

      <div className={cn("mt-4 grid gap-2", onDelete ? "grid-cols-3" : "grid-cols-2")}>
        <button
          type="button"
          onClick={onView}
          aria-label={`View ${doc.name}`}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-border-subtle bg-surface-3 px-2.5 py-2 text-[10px] font-bold text-white uppercase tracking-wider transition-all hover:bg-surface-1 active:scale-95"
        >
          <Eye className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" /> View
        </button>
        <button
          type="button"
          onClick={() => void openDocument(doc, true)}
          aria-label={`Download ${doc.name}`}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-brand/20 bg-brand/5 px-2.5 py-2 text-[10px] font-bold text-brand uppercase tracking-wider transition-all hover:bg-brand hover:text-white active:scale-95"
        >
          <Download className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" /> Get
        </button>
        {onDelete && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            aria-label={`Delete ${doc.name}`}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-red-500/20 bg-red-500/10 px-2.5 py-2 text-[10px] font-bold text-red-400 uppercase tracking-wider transition-all hover:bg-red-500/20 hover:text-red-300 active:scale-95 disabled:opacity-50"
          >
            {isDeleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
            )}
            Delete
          </button>
        )}
      </div>
    </article>
  );
}
