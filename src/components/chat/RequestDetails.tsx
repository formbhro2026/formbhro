import { useState } from "react";
import { FileImage, FileText, File, Plus, StickyNote } from "lucide-react";
import { StatusBadge } from "@/components/common/StatusBadge";
import { RequestTimeline } from "@/components/chat/RequestTimeline";
import type { SupportRequest, UserDocument } from "@/data/user-module";

const ICONS = { pdf: FileText, image: FileImage, doc: File };

export function RequestDetails({
  request,
  documents,
  onAddNote,
  onViewDocument,
  hideDocuments = false,
}: {
  request: SupportRequest;
  documents: UserDocument[];
  onAddNote: (note: string) => void;
  onViewDocument: (id: string) => void;
  onClose?: () => void;
  hideDocuments?: boolean;
}) {
  const [note, setNote] = useState("");

  return (
    <div className="space-y-8 bg-surface-1 p-5">
      <section>
        <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">
          Request Info
        </h2>
        <dl className="mt-4 space-y-4 text-xs font-bold">
          <div className="flex items-start justify-between gap-3">
            <dt className="text-text-secondary">Reference ID</dt>
            <dd className="text-right text-white font-mono">{request.reference || request.id}</dd>
          </div>
          <div className="flex items-start justify-between gap-3">
            <dt className="text-text-secondary">Current Status</dt>
            <dd>
              <StatusBadge status={request.status} />
            </dd>
          </div>
          <div className="flex items-start justify-between gap-3">
            <dt className="text-text-secondary">Created Date</dt>
            <dd className="text-right text-white">{request.createdAt}</dd>
          </div>
          <div className="flex items-start justify-between gap-3">
            <dt className="text-text-secondary">Assigned Member</dt>
            <dd className="text-right text-white">{request.assignedTo}</dd>
          </div>
        </dl>
      </section>

      {!hideDocuments && (
        <section>
          <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">
            Shared Assets
          </h2>
          {documents.length === 0 ? (
            <p className="mt-4 text-xs text-text-muted italic">No documents shared yet.</p>
          ) : (
            <ul className="mt-4 space-y-2.5">
              {documents.map((d) => {
                const Icon = ICONS[d.kind] ?? File;
                return (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => onViewDocument(d.id)}
                      className="flex w-full items-center gap-3 rounded-2xl border border-border-subtle bg-surface-2 p-3 text-left transition-all hover:bg-surface-3 hover:border-brand/30 group"
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-3 text-brand">
                        <Icon className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-white group-hover:text-brand transition-colors">
                          {d.name}
                        </span>
                        <span className="block text-[10px] text-text-muted font-bold mt-0.5">
                          {d.size} • {d.uploadedBy}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      <section>
        <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">
          Audit Trail
        </h2>
        <div className="mt-4">
          <RequestTimeline activity={request.activity} />
        </div>
      </section>

      <section>
        <h2 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">
          <StickyNote className="h-3.5 w-3.5" aria-hidden="true" /> Personal Notes
        </h2>
        <ul className="mt-4 space-y-2.5">
          {request.notes.map((n, i) => (
            <li
              key={i}
              className="rounded-2xl border border-border-subtle bg-surface-2 p-4 text-xs font-medium leading-relaxed text-text-secondary"
            >
              {n}
            </li>
          ))}
        </ul>
        <form
          className="mt-3 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const value = note.trim();
            if (!value) return;
            onAddNote(value);
            setNote("");
          }}
        >
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Keep a private note..."
            className="min-w-0 flex-1 rounded-2xl border border-border-subtle bg-surface-2 px-4 py-3 text-sm text-white placeholder:text-text-muted focus:border-brand/40 outline-none"
          />
          <button
            type="submit"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-brand/40 bg-brand/10 text-brand transition-all hover:bg-brand hover:text-white active:scale-90 shadow-lg shadow-brand/10"
          >
            <Plus className="h-5 w-5" aria-hidden="true" />
          </button>
        </form>
      </section>
    </div>
  );
}
