import { useRef, useState } from "react";
import { CloudUpload, Loader2, X, ChevronDown } from "lucide-react";
import type { SupportRequest, UserDocument } from "@/data/user-module";
import { buildFilePreview } from "@/lib/file-preview";
import { cn } from "@/lib/utils";

const MAX_BYTES = 25 * 1024 * 1024;
const ACCEPT = "image/*,application/pdf,.doc,.docx,.zip";

function kindOf(file: File): UserDocument["kind"] {
  if (file.type.startsWith("image/")) return "image";
  if (file.type === "application/pdf") return "pdf";
  return "doc";
}

function humanSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Props = {
  requests: SupportRequest[];
  onUpload: (
    requestId: string,
    name: string,
    kind: UserDocument["kind"],
    size: string,
    preview?: { previewUrl?: string; pageCount?: number; dimensions?: string },
    file?: File
  ) => void;
};

/** Upload a document straight into a request — files go to private storage. */
export function DocumentUpload({ requests, onUpload }: Props) {
  const [requestId, setRequestId] = useState(requests[0]?.id ?? "");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const target = requests.find((r) => r.id === requestId) ?? requests[0];

  async function handleFiles(files: FileList | null) {
    if (!files?.length || !target) return;
    setStatus(null);
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_BYTES) {
          setStatus({ tone: "error", text: `${file.name} exceeds 25 MB limit.` });
          continue;
        }
        const kind = kindOf(file);
        const preview = await buildFilePreview(file, kind).catch(() => undefined);
        onUpload(target.id, file.name, kind, humanSize(file.size), preview, file);
        setStatus({ tone: "ok", text: `${file.name} uploaded.` });
      }
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  if (!requests.length) return null;

  return (
    <section aria-labelledby="upload-heading" className="rounded-2xl border border-border-subtle bg-surface-1 p-5 shadow-lg shadow-black/10">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,16rem)] sm:items-end">
        <div>
          <h2 id="upload-heading" className="text-sm font-bold text-white tracking-tight uppercase">
            Quick Upload
          </h2>
          <p className="mt-1 text-[11px] font-bold text-text-muted uppercase tracking-tight">
            Encrypted storage. Shared with assigned team only.
          </p>
        </div>
        <div className="relative">
          <select
            value={target?.id ?? ""}
            onChange={(e) => setRequestId(e.target.value)}
            aria-label="Upload to request"
            className="w-full appearance-none rounded-xl border border-border-subtle bg-surface-2 py-2.5 pl-4 pr-10 text-xs font-bold text-white focus:border-brand/40 outline-none transition-all cursor-pointer"
          >
            {requests.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted">
            <ChevronDown className="h-4 w-4" />
          </div>
        </div>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "mt-5 rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-300",
          dragging 
            ? "border-brand bg-brand/5 scale-[0.99]" 
            : "border-border-subtle hover:border-text-muted hover:bg-white/5"
        )}
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2 text-brand shadow-lg shadow-black/20 transition-transform duration-300 group-hover:scale-110">
          <CloudUpload className="h-6 w-6" strokeWidth={2.5} aria-hidden="true" />
        </div>
        <p className="mt-3 text-[11px] font-bold text-text-secondary uppercase tracking-widest">
          Drop files or
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-2.5 text-[10px] font-bold text-white uppercase tracking-widest transition-all hover:bg-brand-light active:scale-95 disabled:opacity-60 shadow-lg shadow-brand/20"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
          {busy ? "Sending…" : "Browse Library"}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="sr-only"
          aria-label="Choose documents to upload"
          onChange={(e) => void handleFiles(e.target.files)}
        />
      </div>

      {status && (
        <div
          role="status"
          className={cn(
            "mt-4 flex items-center justify-between rounded-xl border px-4 py-2.5 transition-all animate-in fade-in slide-in-from-top-2",
            status.tone === "error" 
              ? "border-red-500/20 bg-red-500/5 text-red-400" 
              : "border-brand/20 bg-brand/5 text-brand"
          )}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider">{status.text}</span>
          <button
            type="button"
            onClick={() => setStatus(null)}
            aria-label="Dismiss upload status"
            className="rounded p-1 transition-colors hover:bg-white/10"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
          </button>
        </div>
      )}
    </section>
  );
}
