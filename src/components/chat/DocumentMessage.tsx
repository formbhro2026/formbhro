import { Download, Eye, FileImage, FileText, File } from "lucide-react";
import type { FileKind } from "@/data/user-module";

const ICONS = { pdf: FileText, image: FileImage, doc: File };

export function DocumentMessage({
  name,
  kind,
  size,
  time,
  onView,
  tone = "dark",
  previewUrl,
  pageCount,
  dimensions,
}: {
  name: string;
  kind: FileKind;
  size: string;
  time: string;
  onView: () => void;
  tone?: "dark" | "brand" | "emerald";
  previewUrl?: string;
  pageCount?: number;
  dimensions?: string;
}) {
  const Icon = ICONS[kind] ?? File;

  return (
    <div className="w-full max-w-xs p-1">
      {previewUrl && (
        <button
          type="button"
          onClick={onView}
          aria-label={`Open preview of ${name}`}
          className="mb-2 block w-full overflow-hidden rounded-xl border border-border-subtle bg-surface-3"
        >
          <img
            src={previewUrl}
            alt={`Preview of ${name}`}
            loading="lazy"
            className="max-h-48 w-full object-cover transition-transform hover:scale-105"
          />
        </button>
      )}
      <div className="flex items-center gap-3 py-1">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-3 text-brand">
          <Icon className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-white">{name}</p>
          <p className="mt-0.5 text-[10px] font-bold text-chat-meta uppercase tracking-tight">
            {kind.toUpperCase()} • {size}
            {pageCount ? ` • ${pageCount}p` : ""}
          </p>
        </div>
      </div>
      <div className="mt-2.5 flex items-center justify-between border-t border-white/10 pt-2 pb-1">
        <div className="flex gap-4">
          <button
            type="button"
            onClick={onView}
            className="text-[10px] font-bold text-brand uppercase tracking-widest hover:text-white transition-colors"
          >
            Open
          </button>
          <button
            type="button"
            onClick={onView}
            className="text-[10px] font-bold text-brand uppercase tracking-widest hover:text-white transition-colors"
          >
            Get
          </button>
        </div>
        <span className="text-[9px] font-bold text-chat-meta uppercase">{time}</span>
      </div>
    </div>
  );
}
