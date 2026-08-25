import { Download, Eye } from "lucide-react";
import type { TeamDocument } from "@/data/team-module";
import { downloadDocument } from "@/lib/team-files";
import { useTeamDocumentUrl } from "@/lib/use-team-document-url";
import { DOC_ICONS } from "@/components/team/TeamDocumentCard";
import { cn } from "@/lib/utils";

/** Attachment card rendered inside a chat bubble: thumbnail, preview and one-click download. */
export function MessageAttachment({
  document: doc,
  mine,
  onPreview,
}: {
  document: TeamDocument;
  mine: boolean;
  onPreview: (id: string) => void;
}) {
  const Icon = DOC_ICONS[doc.kind];
  const imageUrl = useTeamDocumentUrl(doc.kind === "image" ? doc : null);

  return (
    <div
      className={cn(
        "mt-1.5 overflow-hidden rounded-xl border",
        mine ? "border-white/25 bg-white/10" : "border-border-subtle bg-surface-3"
      )}
    >
      {doc.kind === "image" && imageUrl && (
        <button
          type="button"
          onClick={() => onPreview(doc.id)}
          aria-label={`Preview image ${doc.name}`}
          className="block w-full"
        >
          <img
            src={imageUrl}
            alt={`Attachment preview of ${doc.name}`}
            loading="lazy"
            className="max-h-52 w-full bg-bg object-cover"
          />
        </button>
      )}

      <div className="flex items-center gap-2 px-2.5 py-2">
        <span
          className={cn(
            "grid h-8 w-8 shrink-0 place-items-center rounded-lg",
            mine ? "bg-white/15" : "bg-white/5"
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[11px] font-semibold">{doc.name}</span>
          <span className="block truncate text-[10px] uppercase opacity-80">
            {doc.kind} • {doc.size}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onPreview(doc.id)}
            aria-label={`Preview ${doc.name}`}
            className={cn(
              "grid h-8 w-8 place-items-center rounded-lg transition-colors",
              mine ? "hover:bg-white/20" : "hover:bg-white/10"
            )}
          >
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => void downloadDocument(doc)}
            aria-label={`Download ${doc.name}`}
            className={cn(
              "grid h-8 w-8 place-items-center rounded-lg transition-colors",
              mine ? "hover:bg-white/20" : "hover:bg-white/10"
            )}
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </span>
      </div>
    </div>
  );
}
