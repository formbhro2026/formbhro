import { useState } from "react";
import { Download, Eye, FileImage, FileText, File, Trash2, Send, Loader2, Check } from "lucide-react";
import type { UserDocument } from "@/data/user-module";
import { openDocument } from "@/lib/doc-access";
import { useDocumentUrl } from "@/lib/use-document-url";
import { cn } from "@/lib/utils";

const ICONS = { pdf: FileText, image: FileImage, doc: File };

const KIND_BADGES: Record<string, { label: string; bg: string; text: string }> = {
  pdf: { label: "PDF", bg: "bg-rose-500/15 border-rose-500/30", text: "text-rose-400" },
  image: { label: "IMG", bg: "bg-sky-500/15 border-sky-500/30", text: "text-sky-400" },
  doc: { label: "DOC", bg: "bg-indigo-500/15 border-indigo-500/30", text: "text-indigo-400" },
};

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
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const badge = KIND_BADGES[doc.kind] ?? KIND_BADGES.doc;

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

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (downloading) return;
    setDownloading(true);
    try {
      await openDocument(doc, true);
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 3000);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <article
      onClick={onView}
      className="group flex flex-col justify-between rounded-2xl border border-white/10 bg-[#121214] p-4 transition-all duration-200 hover:border-white/25 hover:bg-[#18181b] hover:shadow-xl hover:shadow-black/40 cursor-pointer"
    >
      <div>
        <div className="flex items-start gap-3">
          <span className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-white/5 transition-transform group-hover:scale-105">
            {thumbUrl && doc.kind === "image" ? (
              <img
                src={thumbUrl}
                alt={`Preview of ${doc.name}`}
                loading="lazy"
                className="h-full w-full object-contain p-0.5"
              />
            ) : (
              <Icon className="h-6 w-6 text-[#ff7a00]" strokeWidth={2} aria-hidden="true" />
            )}
            <span
              className={cn(
                "absolute bottom-0 right-0 rounded-tl-md border-t border-l px-1 py-0.2 text-[8px] font-black tracking-wider",
                badge.bg,
                badge.text
              )}
            >
              {badge.label}
            </span>
          </span>

          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-bold text-white transition-colors group-hover:text-[#ff7a00]" title={doc.name}>
              {doc.name}
            </h3>
            <p className="mt-0.5 truncate text-[11px] font-medium text-zinc-400">
              {doc.requestTitle || "Support Document"}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-400">
          <span className="font-medium text-zinc-300">{doc.size}</span>
          {doc.pageCount ? (
            <>
              <span>•</span>
              <span>{doc.pageCount}p</span>
            </>
          ) : null}
          <span>•</span>
          <span className="text-zinc-500">{doc.date}</span>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {onShare && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onShare();
            }}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#ff7a00]/30 bg-[#ff7a00]/10 px-3 py-2 text-xs font-semibold text-[#ff7a00] transition-all hover:bg-[#ff7a00] hover:text-white active:scale-95"
          >
            <Send className="h-3.5 w-3.5" /> {shareLabel}
          </button>
        )}

        <div className={cn("grid gap-2", onDelete ? "grid-cols-3" : "grid-cols-2")}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onView();
            }}
            aria-label={`View ${doc.name}`}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2.5 py-2 text-xs font-semibold text-zinc-200 transition-all hover:bg-white/10 hover:text-white active:scale-95"
          >
            <Eye className="h-3.5 w-3.5" /> View
          </button>

          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            aria-label={`Download ${doc.name}`}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-semibold transition-all active:scale-95 disabled:opacity-50",
              downloaded
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : "border border-[#ff7a00]/30 bg-[#ff7a00]/15 text-[#ff7a00] hover:bg-[#ff7a00] hover:text-white"
            )}
          >
            {downloading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : downloaded ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            {downloading ? "Saving…" : downloaded ? "Saved" : "Download"}
          </button>

          {onDelete && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              aria-label={`Delete ${doc.name}`}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-500/20 bg-red-500/10 px-2.5 py-2 text-xs font-semibold text-red-400 transition-all hover:bg-red-500/20 hover:text-red-300 active:scale-95 disabled:opacity-50"
            >
              {isDeleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              Delete
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
