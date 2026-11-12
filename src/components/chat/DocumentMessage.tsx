import { useState } from "react";
import { Download, Eye, FileImage, FileText, File, Check, Loader2 } from "lucide-react";
import type { FileKind } from "@/data/user-module";
import { cn } from "@/lib/utils";

const ICONS = { pdf: FileText, image: FileImage, doc: File };

const KIND_THEMES: Record<FileKind, { bg: string; text: string; border: string; badge: string; label: string }> = {
  pdf: {
    bg: "bg-rose-500/10",
    text: "text-rose-400",
    border: "border-rose-500/20",
    badge: "bg-rose-500/20 text-rose-300",
    label: "PDF",
  },
  image: {
    bg: "bg-sky-500/10",
    text: "text-sky-400",
    border: "border-sky-500/20",
    badge: "bg-sky-500/20 text-sky-300",
    label: "IMG",
  },
  doc: {
    bg: "bg-indigo-500/10",
    text: "text-indigo-400",
    border: "border-indigo-500/20",
    badge: "bg-indigo-500/20 text-indigo-300",
    label: "DOC",
  },
};

export function DocumentMessage({
  name,
  kind,
  size,
  time,
  onView,
  onDownload,
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
  onDownload?: () => void;
  tone?: "dark" | "brand" | "emerald";
  previewUrl?: string;
  pageCount?: number;
  dimensions?: string;
}) {
  const Icon = ICONS[kind] ?? File;
  const theme = KIND_THEMES[kind] ?? KIND_THEMES.doc;
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (downloading) return;
    setDownloading(true);
    try {
      if (onDownload) {
        await onDownload();
      } else {
        onView();
      }
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 3000);
    } catch (_) {
      // error handled inside download function
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="w-full max-w-[290px] sm:max-w-xs select-none">
      {/* Optional image preview thumbnail: uses object-contain to prevent auto-zooming or cropping */}
      {previewUrl && kind === "image" && (
        <button
          type="button"
          onClick={onView}
          aria-label={`Open preview of ${name}`}
          className="group relative mb-2 flex items-center justify-center w-full min-h-[140px] max-h-64 overflow-hidden rounded-xl border border-white/10 bg-black/50 transition-all hover:border-white/20 active:scale-[0.99] p-1.5 touch-manipulation cursor-pointer"
        >
          <img
            src={previewUrl}
            alt={`Preview of ${name}`}
            loading="lazy"
            className="max-h-60 max-w-full w-auto h-auto object-contain mx-auto rounded-lg select-none"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100 flex items-end p-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-black/75 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm shadow">
              <Eye className="h-3.5 w-3.5" /> Tap to view
            </span>
          </div>
        </button>
      )}

      {/* Main Document Card */}
      <div
        role="button"
        tabIndex={0}
        onClick={onView}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onView();
          }
        }}
        className={cn(
          "relative overflow-hidden rounded-xl border p-2.5 transition-all duration-200 cursor-pointer active:scale-[0.99]",
          tone === "emerald"
            ? "border-emerald-500/20 bg-emerald-950/20 hover:border-emerald-500/40"
            : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/[0.08]"
        )}
      >
        <div className="flex items-center gap-3">
          {/* File Icon with Category Theme */}
          <div
            className={cn(
              "relative grid h-11 w-11 shrink-0 place-items-center rounded-xl border shadow-sm",
              theme.bg,
              theme.border,
              theme.text
            )}
          >
            <Icon className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" />
            <span
              className={cn(
                "absolute -bottom-1 -right-1 rounded-md px-1 py-0.2 text-[8px] font-black tracking-wider shadow-sm",
                theme.badge
              )}
            >
              {theme.label}
            </span>
          </div>

          {/* File Name & Meta */}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-white tracking-tight" title={name}>
              {name}
            </p>
            <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-zinc-400">
              <span className="font-semibold uppercase tracking-wider">{theme.label}</span>
              <span>•</span>
              <span className="font-medium">{size}</span>
              {pageCount ? (
                <>
                  <span>•</span>
                  <span>{pageCount}p</span>
                </>
              ) : null}
            </div>
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="mt-2.5 flex items-center justify-between border-t border-white/10 pt-2">
          <div className="flex items-center gap-1.5">
            {/* Dedicated Preview Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onView();
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-zinc-300 transition-colors hover:bg-white/10 hover:text-white active:scale-95"
            >
              <Eye className="h-3 w-3" /> Preview
            </button>

            {/* Dedicated Download Button */}
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className={cn(
                "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all active:scale-95 disabled:opacity-50",
                downloaded
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-[#ff7a00]/15 text-[#ff7a00] border border-[#ff7a00]/30 hover:bg-[#ff7a00] hover:text-white"
              )}
            >
              {downloading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : downloaded ? (
                <Check className="h-3 w-3" />
              ) : (
                <Download className="h-3 w-3" />
              )}
              {downloading ? "Saving…" : downloaded ? "Saved" : "Download"}
            </button>
          </div>

          <span className="text-[9px] font-semibold text-zinc-500">{time}</span>
        </div>
      </div>
    </div>
  );
}
