import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { FileText, Search } from "lucide-react";
import { TeamHeader } from "@/components/team/TeamHeader";
import { TeamDocumentCard } from "@/components/team/TeamDocumentCard";
import { TeamDocumentPreview } from "@/components/team/TeamDocumentPreview";
import { EmptyState } from "@/components/common/EmptyState";
import { useTeamStore } from "@/lib/team-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/team/_shell/documents")({
  component: TeamDocuments,
  head: () => ({
    meta: [
      { title: "Assigned Documents — Formbhro Team" },
      {
        name: "description",
        content: "Preview and download the documents uploaded on your assigned Formbhro requests.",
      },
      { property: "og:title", content: "Assigned Documents — Formbhro Team" },
      {
        property: "og:description",
        content: "Documents from your assigned requests, ready to preview or download.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const FILTERS = [
  { key: "all", label: "All" },
  { key: "image", label: "Images" },
  { key: "pdf", label: "PDFs" },
  { key: "doc", label: "Docs" },
] as const;

function TeamDocuments() {
  const { documents, requests, deleteDocument } = useTeamStore();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [previewId, setPreviewId] = useState<string | null>(null);

  const titleFor = useMemo(() => {
    const map = new Map(requests.map((r) => [r.id, r.title]));
    return (id: string) => map.get(id) ?? id;
  }, [requests]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return documents.filter((d) => {
      if (filter !== "all" && d.kind !== filter) return false;
      if (!q) return true;
      return `${d.name} ${d.requestId} ${d.uploadedBy} ${titleFor(d.requestId)}`
        .toLowerCase()
        .includes(q);
    });
  }, [documents, filter, query, titleFor]);

  const preview = documents.find((d) => d.id === previewId) ?? null;

  return (
    <>
      <TeamHeader title="Documents" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 sm:px-6 lg:pb-10">
        <h2 className="text-lg font-bold text-text">Assigned Documents</h2>
        <p className="mt-1 text-xs text-text-secondary">
          Only documents from requests assigned to you are shown.
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <label htmlFor="doc-search" className="sr-only">
              Search documents
            </label>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
              aria-hidden="true"
            />
            <input
              id="doc-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search file, request ID or user"
              className="h-11 w-full rounded-xl border border-border-subtle bg-surface-1 pl-9 pr-3 text-xs text-text placeholder:text-text-muted focus:border-brand/50"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                aria-pressed={filter === f.key}
                className={cn(
                  "min-h-9 shrink-0 rounded-full border px-3 text-[11px] font-semibold transition-colors",
                  filter === f.key
                    ? "border-brand/40 bg-brand/10 text-brand-light"
                    : "border-border-strong text-text-secondary hover:bg-surface-2",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="mt-5">
            <EmptyState
              icon={FileText}
              title="No documents uploaded."
              description="Documents shared on your assigned requests will appear here."
            />
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 [&_article_h3]:!text-text [&_article_button:not([aria-label*='Delete'])]:!text-text [&_article_button:not([aria-label*='Delete'])]:hover:!bg-surface-2">
            {visible.map((d) => (
              <TeamDocumentCard
                key={d.id}
                document={d}
                requestTitle={titleFor(d.requestId)}
                onPreview={() => setPreviewId(d.id)}
                onDelete={() => void deleteDocument(d.id, d.storagePath)}
              />
            ))}
          </div>
        )}
      </main>

      {preview && <TeamDocumentPreview document={preview} onClose={() => setPreviewId(null)} />}
    </>
  );
}
