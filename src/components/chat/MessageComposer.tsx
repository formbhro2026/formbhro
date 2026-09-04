import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  File,
  FileImage,
  FileText,
  Plus,
  RotateCcw,
  Send,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { AttachmentMenu, type PickKind } from "@/components/chat/AttachmentMenu";
import { buildFilePreview, type FilePreview } from "@/lib/file-preview";
import { listQuickReplies } from "@/lib/api/notifications";
import type { QuickReplyRow } from "@/lib/api/types";

const MAX_BYTES = 10 * 1024 * 1024;

type UploadStatus = "uploading" | "success" | "error";

type Upload = {
  id: string;
  name: string;
  kind: PickKind;
  size: string;
  bytes: number;
  progress: number;
  status: UploadStatus;
  error?: string;
  preview?: FilePreview;
  previewLoading?: boolean;
  file?: File;
};

const KIND_ICON: Record<PickKind, typeof File> = { image: FileImage, pdf: FileText, doc: File };

function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function kindOf(file: File): PickKind {
  if (file.type.startsWith("image/")) return "image";
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) return "pdf";
  return "doc";
}

export function MessageComposer({
  onSend,
  onUpload,
  requestLabel,
  onTyping,
  onOpenSavedDocs,
}: {
  onSend: (text: string) => void;
  onUpload: (
    name: string,
    kind: PickKind,
    size: string,
    preview?: FilePreview,
    file?: File,
  ) => void;
  requestLabel?: string;
  onTyping?: () => void;
  onOpenSavedDocs?: () => void;
}) {
  const [text, setText] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [dragging, setDragging] = useState(false);
  const [quickReplies, setQuickReplies] = useState<QuickReplyRow[]>([]);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const quickRepliesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const attachButtonRef = useRef<HTMLButtonElement>(null);
  const timersRef = useRef<Record<string, number>>({});
  const objectUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    void listQuickReplies().then(setQuickReplies).catch(() => {});
  }, []);

  useEffect(
    () => () => {
      Object.values(timersRef.current).forEach((t) => window.clearInterval(t));
      objectUrlsRef.current.forEach((url) => {
        if (url.startsWith("blob:")) URL.revokeObjectURL(url);
      });
    },
    [],
  );

  const attachedTo = requestLabel ? `Attached to ${requestLabel}` : "Attached to this request";

  const runUpload = useCallback(
    (upload: Upload) => {
      setUploads((prev) => {
        const exists = prev.some((u) => u.id === upload.id);
        return exists
          ? prev.map((u) =>
              u.id === upload.id
                ? { ...upload, progress: 0, status: "uploading", error: undefined }
                : u,
            )
          : [...prev, upload];
      });

      if (upload.bytes > MAX_BYTES) {
        window.setTimeout(() => {
          setUploads((prev) =>
            prev.map((u) =>
              u.id === upload.id
                ? { ...u, status: "error", error: "File is larger than 10 MB" }
                : u,
            ),
          );
          toast.error(`${upload.name} couldn't be uploaded`, {
            description: "Maximum file size is 10 MB.",
          });
        }, 300);
        return;
      }

      window.clearInterval(timersRef.current[upload.id]);
      let progress = 0;
      timersRef.current[upload.id] = window.setInterval(() => {
        progress = Math.min(100, progress + 12 + Math.round(Math.random() * 10));
        const done = progress >= 100;
        setUploads((prev) =>
          prev.map((u) =>
            u.id === upload.id && u.status === "uploading"
              ? { ...u, progress, status: done ? "success" : "uploading" }
              : u,
          ),
        );
        if (!done) return;
        window.clearInterval(timersRef.current[upload.id]);
        delete timersRef.current[upload.id];
        onUpload(upload.name, upload.kind, upload.size, upload.preview, upload.file);
        toast.success(`${upload.name} uploaded`, { description: attachedTo });
        const cleanup = window.setTimeout(
          () => setUploads((cur) => cur.filter((x) => x.id !== upload.id)),
          2600,
        );
        timersRef.current[`cleanup-${upload.id}`] = cleanup;
      }, 180);
    },
    [attachedTo, onUpload],
  );

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      Array.from(files).forEach((file, i) => {
        const kind = kindOf(file);
        const id = `u-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`;
        const previewable = kind !== "doc" && file.size <= MAX_BYTES;
        runUpload({
          id,
          name: file.name,
          kind,
          size: formatSize(file.size),
          bytes: file.size,
          progress: 0,
          status: "uploading",
          previewLoading: previewable,
          file,
        });
        if (!previewable) return;
        buildFilePreview(file, kind).then((preview) => {
          if (preview.previewUrl) objectUrlsRef.current.push(preview.previewUrl);
          setUploads((prev) =>
            prev.map((u) => (u.id === id ? { ...u, preview, previewLoading: false } : u)),
          );
        });
      });
    },
    [runUpload],
  );

  const pick = (opt: { kind: PickKind; accept: string; capture?: "environment" }) => {
    setMenuOpen(false);
    if (opt.capture) {
      if (!cameraInputRef.current) return;
      cameraInputRef.current.click();
    } else {
      if (!fileInputRef.current) return;
      fileInputRef.current.accept = opt.accept;
      fileInputRef.current.click();
    }
  };

  const cancel = (id: string) => {
    window.clearInterval(timersRef.current[id]);
    delete timersRef.current[id];
    setUploads((prev) => prev.filter((u) => u.id !== id));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    onSend(value);
    setText("");
    inputRef.current?.focus();
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
      }}
      className={`sticky bottom-0 z-20 px-3 pb-[max(0.75rem,calc(env(safe-area-inset-bottom)+0.75rem))] pt-3 bg-surface-1/95 backdrop-blur-sm border-t border-border-subtle transition-colors duration-200 sm:px-4 ${
        dragging ? "bg-surface-2" : ""
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="sr-only"
        onChange={(e) => {
          if (e.target.files?.length) addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          if (e.target.files?.length) addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {dragging && (
        <p className="mb-2 rounded-xl border border-dashed border-brand/40 px-3 py-2 text-center text-xs text-brand bg-brand/5">
          Drop files to attach them to this request
        </p>
      )}

      {uploads.length > 0 && (
        <ul aria-live="polite" className="mb-3 space-y-2">
          {uploads.map((u) => {
            const Icon = KIND_ICON[u.kind];
            return (
              <li
                key={u.id}
                className={`rounded-2xl border p-3 transition-colors duration-200 ${
                  u.status === "error"
                    ? "border-danger/40 bg-danger/5"
                    : u.status === "success"
                      ? "border-success/40 bg-success/5"
                      : "border-border-subtle bg-surface-2"
                }`}
              >
                <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                  <span className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-border-subtle bg-surface-3">
                    {u.preview?.previewUrl ? (
                      <img
                        src={u.preview.previewUrl}
                        alt={`Preview of ${u.name}`}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : u.previewLoading ? (
                      <span
                        className="h-full w-full animate-pulse bg-surface-3"
                        aria-label="Generating preview"
                      />
                    ) : (
                      <Icon className="h-5 w-5 text-brand" strokeWidth={2} aria-hidden="true" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-bold text-white">{u.name}</span>
                    <span className="mt-0.5 block text-[10px] text-text-muted font-bold uppercase tracking-tight">
                      {u.kind.toUpperCase()} · {u.size}
                      {u.preview?.pageCount
                        ? ` · ${u.preview.pageCount} page${u.preview.pageCount > 1 ? "s" : ""}`
                        : ""}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-text-muted font-bold">
                      {u.status === "uploading" && <>Uploading… {u.progress}%</>}
                      {u.status === "success" && (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                          Complete · {u.size}
                        </>
                      )}
                      {u.status === "error" && (
                        <>
                          <AlertCircle className="h-3.5 w-3.5 text-danger" aria-hidden="true" />
                          {u.error ?? "Upload failed"}
                        </>
                      )}
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    {u.status === "error" && (
                      <button
                        type="button"
                        onClick={() =>
                          runUpload({ ...u, progress: 0, status: "uploading", error: undefined })
                        }
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold text-brand transition-colors duration-200 hover:bg-surface-3"
                      >
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Retry
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => cancel(u.id)}
                      className="rounded-lg p-1 text-text-muted transition-colors duration-200 hover:bg-surface-3 hover:text-white"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </span>
                </div>
                {u.status !== "error" && (
                  <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-surface-3">
                    <div
                      className={`h-full rounded-full transition-[width] duration-200 ${
                        u.status === "success" ? "bg-success" : "bg-brand"
                      }`}
                      style={{ width: `${u.progress}%` }}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={submit} className="mx-auto relative flex max-w-5xl items-end gap-2 lg:gap-3">
        {menuOpen && (
          <AttachmentMenu
            onPick={pick}
            onOpenSavedDocs={onOpenSavedDocs}
            onClose={() => {
              setMenuOpen(false);
              attachButtonRef.current?.focus();
            }}
          />
        )}

        {/* Quick Replies Popup on '/' shortcut */}
        {(showQuickReplies || text.startsWith("/")) && quickReplies.length > 0 && (
          <div
            ref={quickRepliesRef}
            className="absolute bottom-full left-0 mb-2 w-[min(20rem,calc(100vw-3rem))] max-h-64 overflow-y-auto rounded-2xl border border-border-subtle bg-surface-1 p-2 shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-150"
          >
            <div className="mb-2 px-2 pb-2 pt-1 text-[11px] font-semibold text-text-muted border-b border-border-subtle flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-bold text-white">
                <Zap className="h-3.5 w-3.5 text-brand" /> Quick Replies
              </span>
              <span className="text-[10px] text-brand-light font-mono">
                Type to filter
              </span>
            </div>
            {(() => {
              const query = text.startsWith("/") ? text.slice(1).trim().toLowerCase() : "";
              const filtered = query
                ? quickReplies.filter(
                    (qr) =>
                      qr.title.toLowerCase().includes(query) ||
                      qr.body.toLowerCase().includes(query),
                  )
                : quickReplies;

              if (filtered.length === 0) {
                return (
                  <div className="p-3 text-center text-xs text-text-muted">
                    No quick replies match "{query}"
                  </div>
                );
              }

              return filtered.map((qr) => (
                <button
                  key={qr.id}
                  type="button"
                  className="w-full text-left rounded-xl px-3 py-2 text-sm text-text hover:bg-surface-2 transition-colors mb-1 group"
                  onClick={() => {
                    setText(qr.body);
                    setShowQuickReplies(false);
                    inputRef.current?.focus();
                  }}
                >
                  <div className="font-semibold truncate text-xs text-white group-hover:text-brand transition-colors">
                    {qr.title}
                  </div>
                  <div className="text-[11px] text-text-muted truncate mt-0.5 leading-tight">
                    {qr.body}
                  </div>
                </button>
              ));
            })()}
          </div>
        )}

        <button
          ref={attachButtonRef}
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Upload document"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center text-text-secondary transition-colors duration-200 hover:text-white"
        >
          <Plus className="h-6 w-6" strokeWidth={2.5} aria-hidden="true" />
        </button>

        <textarea
          ref={inputRef}
          rows={1}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            onTyping?.();
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setShowQuickReplies(false);
            }
            if (e.key === "Enter" && !e.shiftKey) {
              const query = text.startsWith("/") ? text.slice(1).trim().toLowerCase() : "";
              if (text.startsWith("/")) {
                const filtered = query
                  ? quickReplies.filter(
                      (qr) =>
                        qr.title.toLowerCase().includes(query) ||
                        qr.body.toLowerCase().includes(query),
                    )
                  : quickReplies;
                if (filtered.length > 0) {
                  e.preventDefault();
                  setText(filtered[0].body);
                  setShowQuickReplies(false);
                  return;
                }
              }
              e.preventDefault();
              submit(e);
            }
          }}
          placeholder="Type a message (or '/' for quick replies)…"
          aria-label="Message"
          className="min-h-11 max-h-32 min-w-0 flex-1 resize-none rounded-2xl border-none bg-surface-3 px-4 py-2.5 text-[15px] text-white placeholder:text-text-muted focus:ring-0 outline-none transition-shadow"
        />

        <button
          type="submit"
          aria-label="Send message"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-brand transition-transform duration-200 active:scale-95 disabled:opacity-50"
          disabled={!text.trim()}
        >
          <Send className="h-6 w-6 fill-current" strokeWidth={1.5} aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}
