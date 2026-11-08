import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { FileText, Search, User, Loader2, ArrowRight } from "lucide-react";
import { TeamDocumentCard } from "@/components/team/TeamDocumentCard";
import { TeamDocumentPreview } from "@/components/team/TeamDocumentPreview";
import { EmptyState } from "@/components/common/EmptyState";
import { searchUserDocuments } from "@/lib/api/admin.functions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/_shell/documents")({
  ssr: false,
  component: AdminDocuments,
  head: () => ({
    meta: [
      { title: "User Document Search — Formbhro Admin" },
      {
        name: "description",
        content: "Search and inspect documents uploaded by a specific user via User ID.",
      },
      { property: "og:title", content: "User Document Search — Formbhro Admin" },
      {
        property: "og:description",
        content: "Admin secure document inspection by User ID.",
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

function AdminDocuments() {
  const [searchInput, setSearchInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchedUser, setSearchedUser] = useState<{
    id: string;
    name: string;
    email?: string;
    phone?: string;
  } | null>(null);
  const [userDocs, setUserDocs] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [previewId, setPreviewId] = useState<string | null>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = searchInput.trim();
    if (!q) {
      toast.error("Please enter a User ID, email, or phone number");
      return;
    }

    setSearching(true);
    setHasSearched(true);
    try {
      const res = await searchUserDocuments({ data: { query: q } });
      if (!res.user) {
        setSearchedUser(null);
        setUserDocs([]);
        toast.info("No user found matching this ID");
      } else {
        setSearchedUser(res.user);
        setUserDocs(res.documents);
        if (res.documents.length === 0) {
          toast.info(`Found ${res.user.name}, but no documents uploaded yet`);
        } else {
          toast.success(`Loaded ${res.documents.length} document(s) for ${res.user.name}`);
        }
      }
    } catch (err: any) {
      console.error("Failed to search documents:", err);
      toast.error(err?.message || "Failed to search user documents");
    } finally {
      setSearching(false);
    }
  };

  const visibleDocs = useMemo(() => {
    return userDocs.filter((d) => {
      if (filter !== "all" && d.kind !== filter) return false;
      return true;
    });
  }, [userDocs, filter]);

  const preview = userDocs.find((d) => d.id === previewId) ?? null;

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 sm:px-6 lg:pb-10">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-text">User Document Search</h2>
            <p className="mt-0.5 text-xs text-text-secondary">
              Search by specific User ID to inspect and verify uploaded documents. Documents are not displayed openly.
            </p>
          </div>
        </div>

        {/* User ID Search Bar */}
        <form onSubmit={handleSearch} className="mt-5 flex flex-col gap-2.5 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Enter User ID (UUID), Email, or Phone..."
              className="h-11 w-full rounded-xl border border-border-subtle bg-surface-1 pl-10 pr-4 text-xs text-text placeholder:text-text-muted focus:border-brand/50 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={searching || !searchInput.trim()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand px-5 text-xs font-bold text-white shadow-md shadow-brand/20 transition-all hover:bg-brand-hover active:scale-95 disabled:opacity-50"
          >
            {searching ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Searching…</span>
              </>
            ) : (
              <>
                <span>Search User</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </form>

        {/* User Details Banner if Searched */}
        {searchedUser && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand/30 bg-brand/10 p-3.5 animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/20 text-brand">
                <User className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white">{searchedUser.name}</h3>
                  <span className="rounded-md border border-white/10 bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
                    {searchedUser.id.slice(0, 8)}…
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-text-secondary">
                  {searchedUser.email} {searchedUser.phone ? `• ${searchedUser.phone}` : ""}
                </p>
              </div>
            </div>

            {/* Kind Filters */}
            <div className="flex gap-1.5 overflow-x-auto">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  aria-pressed={filter === f.key}
                  className={cn(
                    "h-8 shrink-0 rounded-lg border px-2.5 text-[11px] font-semibold transition-colors",
                    filter === f.key
                      ? "border-brand/40 bg-brand/20 text-brand-light font-bold"
                      : "border-border-subtle bg-surface-2 text-text-secondary hover:text-white",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Results Area */}
        {!hasSearched ? (
          <div className="mt-8 rounded-2xl border border-dashed border-border-subtle p-12 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-border-subtle bg-surface-2 text-text-muted">
              <Search className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-sm font-bold text-text">No User Selected</h3>
            <p className="mx-auto mt-1 max-w-sm text-xs text-text-secondary">
              Enter a User ID, email, or phone number in the search bar above to view and inspect all documents uploaded by that user.
            </p>
          </div>
        ) : visibleDocs.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              icon={FileText}
              title="No documents found."
              description={
                searchedUser
                  ? `No uploaded documents found for ${searchedUser.name}.`
                  : "No user found matching this query."
              }
            />
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visibleDocs.map((d) => (
              <TeamDocumentCard
                key={d.id}
                document={d}
                requestTitle={d.requestTitle}
                onPreview={() => setPreviewId(d.id)}
              />
            ))}
          </div>
        )}
      </main>

      {preview && (
        <TeamDocumentPreview
          document={preview}
          onClose={() => setPreviewId(null)}
        />
      )}
    </div>
  );
}

