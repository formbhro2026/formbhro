import { Download, Eye, FileImage, FileText, File } from "lucide-react";
import type { UserDocument } from "@/data/user-module";
import { openDocument } from "@/lib/doc-access";
import { useDocumentUrl } from "@/lib/use-document-url";
import { cn } from "@/lib/utils";

const ICONS = { pdf: FileText, image: FileImage, doc: File };

export function DocumentCard({
  document: doc,
  onView,
}: {
  document: UserDocument;
  onView: () => void;
}) {
  const Icon = ICONS[doc.kind] ?? File;
  const thumbUrl = useDocumentUrl(doc);

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

      <div className="mt-5 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onView}
          aria-label={`View ${doc.name}`}
          className="flex items-center justify-center gap-2 rounded-xl border border-border-subtle bg-surface-3 px-3 py-2.5 text-[10px] font-bold text-white uppercase tracking-widest transition-all hover:bg-surface-1 active:scale-95"
        >
          <Eye className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" /> View
        </button>
        <button
          type="button"
          onClick={() => void openDocument(doc, true)}
          aria-label={`Download ${doc.name}`}
          className="flex items-center justify-center gap-2 rounded-xl border border-brand/20 bg-brand/5 px-3 py-2.5 text-[10px] font-bold text-brand uppercase tracking-widest transition-all hover:bg-brand hover:text-white active:scale-95"
        >
          <Download className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" /> Get
        </button>
      </div>
    </article>
  );
}
