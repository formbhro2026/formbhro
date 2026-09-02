import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { FileText, Search, Plus, Filter } from "lucide-react";
import { UserHeader } from "@/components/layout/UserHeader";
import { DocumentCard } from "@/components/documents/DocumentCard";
import { DocumentPreview } from "@/components/documents/DocumentPreview";
import { DocumentUpload } from "@/components/documents/DocumentUpload";
import { EmptyState } from "@/components/common/EmptyState";
import { useUserStore } from "@/lib/user-store";
import { useAddDocument } from "@/components/layout/FillNowProvider";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/documents")({
  ssr: false,
  component: MyDocuments,
  head: () => ({
    meta: [
      { title: "My Documents — Formbhro" },
      {
        name: "description",
        content:
          "Access documents shared across your Formbhro requests, filtered by request and file type.",
      },
      { property: "og:title", content: "My Documents — Formbhro" },
      {
        property: "og:description",
        content: "Access documents shared across your Formbhro requests.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const CATEGORIES = [
  { label: "All", kind: null },
  { label: "PDF", kind: "pdf" },
  { label: "Images", kind: "image" },
  { label: "Docs", kind: "doc" },
] as const;

import { PullToRefresh } from "@/components/common/PullToRefresh";

function MyDocuments() {
  const { documents, requests, attachFile, refresh, loading } = useUserStore();
  const { openAddDocument } = useAddDocument();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<string | null>(null);
  const [requestFilter, setRequestFilter] = useState("all");
  const [previewId, setPreviewId] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      documents.filter(
        (d) =>
          (!query || d.name.toLowerCase().includes(query.toLowerCase())) &&
          (!kind || d.kind === kind) &&
          (requestFilter === "all" ||
            (requestFilter === "personal" ? !d.requestId : d.requestId === requestFilter)),
      ),
    [documents, query, kind, requestFilter],
  );

  const preview = useMemo(
    () => documents.find((d) => d.id === previewId),
    [documents, previewId],
  );

  return (
    <div className="flex min-h-full flex-col bg-bg text-text">
      <UserHeader title="My Documents" />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-28 pt-5 sm:px-6 lg:pb-10">
        <PullToRefresh onRefresh={refresh}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-bold text-text tracking-tight">My Documents</h1>
              <p className="mt-1 text-sm text-text-secondary">
                View, download, and manage all your documents in one secure place.
              </p>
            </div>
            <button
              type="button"
              onClick={openAddDocument}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-brand/20 transition-all hover:bg-brand-light active:scale-95"
            >
              <Plus className="h-4 w-4" /> Add Document
            </button>
          </div>

          <div className="mt-6 flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search documents by name..."
                  className="w-full rounded-xl border border-border-subtle bg-surface-1 py-2.5 pl-10 pr-4 text-xs font-medium text-text placeholder:text-text-muted focus:border-brand/40 outline-none transition-all"
                />
              </div>

              <div className="relative min-w-[200px]">
                <Filter className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted pointer-events-none" />
                <select
                  value={requestFilter}
                  onChange={(e) => setRequestFilter(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-border-subtle bg-surface-1 py-2.5 pl-10 pr-8 text-xs font-medium text-text focus:border-brand/40 outline-none transition-all cursor-pointer"
                >
                  <option value="all">All Requests</option>
                  <option value="personal">Personal Documents</option>
                  {requests.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title} ({r.id})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 no-scrollbar">
              {CATEGORIES.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => setKind(c.kind)}
                  aria-pressed={kind === c.kind}
                  className={cn(
                    "shrink-0 rounded-full border px-4 py-2 text-[10px] font-bold uppercase tracking-wider transition-all duration-200",
                    kind === c.kind
                      ? "border-brand/40 bg-brand/10 text-brand shadow-lg shadow-brand/5"
                      : "border-border-subtle text-text-muted hover:border-text-secondary hover:text-text",
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6">
            {loading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-pulse">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="h-32 w-full rounded-[20px] bg-surface-1 border border-border-subtle"
                  />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-12">
                <EmptyState
                  icon={FileText}
                  title="No documents found."
                  description="Your documents will appear here once you or the team uploads them."
                  action={
                    <button
                      type="button"
                      onClick={openAddDocument}
                      className="inline-flex items-center gap-2 rounded-full border border-brand bg-brand/10 px-4 py-2 text-xs font-bold text-brand hover:bg-brand hover:text-white transition-colors"
                    >
                      <Plus className="h-4 w-4" /> Add Document
                    </button>
                  }
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((d) => (
                  <DocumentCard key={d.id} document={d} onView={() => setPreviewId(d.id)} />
                ))}
              </div>
            )}
          </div>
        </PullToRefresh>
      </main>

      {preview && <DocumentPreview document={preview} onClose={() => setPreviewId(null)} />}
    </div>
  );
}
