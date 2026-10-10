import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import {
  Newspaper,
  Pin,
  PinOff,
  Plus,
  Trash2,
  Calendar,
  User,
  Image as ImageIcon,
  CheckCircle,
  Archive,
  RefreshCw,
  Eye,
  X,
  Loader2,
} from "lucide-react";
import { TeamHeader } from "@/components/team/TeamHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { useTeamStore } from "@/lib/team-store";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/team/_shell/news")({
  component: TeamInternalNews,
  head: () => ({
    meta: [
      { title: "Internal News — Formbhro Team" },
      { name: "description", content: "Internal announcements, operational bulletins and team news." },
    ],
  }),
});

export interface InternalNewsItem {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  author_id: string | null;
  author_name?: string;
  is_pinned: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  is_read?: boolean;
}

function TeamInternalNews() {
  const { member } = useTeamStore();
  const [items, setItems] = useState<InternalNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pinned" | "archived">("all");
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formPinned, setFormPinned] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const fetchInternalNews = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("internal_news")
        .select("*")
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;

      const rawItems = (data ?? []) as InternalNewsItem[];

      // Fetch author profiles
      const authorIds = Array.from(new Set(rawItems.map((i) => i.author_id).filter(Boolean))) as string[];
      let authorMap = new Map<string, string>();
      if (authorIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", authorIds);
        profs?.forEach((p) => authorMap.set(p.id, p.full_name));
      }

      setItems(
        rawItems.map((item) => ({
          ...item,
          author_name: item.author_id ? authorMap.get(item.author_id) || "Team Member" : "System",
        }))
      );
    } catch (err) {
      console.warn("[InternalNews] Error fetching:", err);
      // Fallback empty list gracefully
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchInternalNews();
  }, []);

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image file size must be less than 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
      setFormImageUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formContent.trim()) {
      toast.error("Please enter a title and content.");
      return;
    }
    setPublishing(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id || null;

      const { error } = await (supabase as any).from("internal_news").insert({
        title: formTitle.trim(),
        content: formContent.trim(),
        image_url: formImageUrl.trim() || null,
        is_pinned: formPinned,
        author_id: uid,
      });

      if (error) throw error;

      toast.success("Internal announcement published!");
      setShowPublishModal(false);
      setFormTitle("");
      setFormContent("");
      setFormImageUrl("");
      setImagePreview(null);
      setFormPinned(false);
      await fetchInternalNews();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to publish announcement");
    } finally {
      setPublishing(false);
    }
  };

  const togglePin = async (item: InternalNewsItem) => {
    try {
      const { error } = await (supabase as any)
        .from("internal_news")
        .update({ is_pinned: !item.is_pinned })
        .eq("id", item.id);
      if (error) throw error;
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, is_pinned: !i.is_pinned } : i))
      );
      toast.success(item.is_pinned ? "Announcement unpinned" : "Announcement pinned");
    } catch (err) {
      toast.error("Failed to update pin state");
    }
  };

  const toggleArchive = async (item: InternalNewsItem) => {
    try {
      const { error } = await (supabase as any)
        .from("internal_news")
        .update({ is_archived: !item.is_archived })
        .eq("id", item.id);
      if (error) throw error;
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, is_archived: !i.is_archived } : i))
      );
      toast.success(item.is_archived ? "Restored from archive" : "Archived");
    } catch (err) {
      toast.error("Failed to update archive status");
    }
  };

  const deleteItem = async (item: InternalNewsItem) => {
    if (!confirm("Are you sure you want to permanently delete this internal update?")) return;
    try {
      const { error } = await (supabase as any)
        .from("internal_news")
        .delete()
        .eq("id", item.id);
      if (error) throw error;
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      toast.success("Announcement deleted");
    } catch (err) {
      toast.error("Failed to delete announcement");
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (filter === "pinned") return item.is_pinned && !item.is_archived;
      if (filter === "archived") return item.is_archived;
      return !item.is_archived;
    });
  }, [items, filter]);

  return (
    <>
      <TeamHeader title="Internal News" />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-5 sm:px-6 lg:pb-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl flex items-center gap-2">
              <Newspaper className="h-6 w-6 text-brand" />
              Internal News &amp; Bulletins
            </h1>
            <p className="mt-1 text-xs text-text-secondary">
              Private company updates, operational guidelines, and internal announcements for team members.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => void fetchInternalNews()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border-subtle bg-surface-2 px-3 py-2 text-xs font-semibold text-text-secondary hover:bg-surface-3 transition-colors"
              title="Refresh announcements"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              Refresh
            </button>
            <button
              onClick={() => setShowPublishModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-black hover:bg-brand-light transition-all shadow-lg shadow-brand/20"
            >
              <Plus className="h-4 w-4" />
              Post Announcement
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="mt-6 flex items-center gap-2 border-b border-border-subtle pb-3">
          <button
            onClick={() => setFilter("all")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
              filter === "all"
                ? "bg-brand/15 text-brand border border-brand/30"
                : "text-text-muted hover:text-white"
            )}
          >
            Active Updates ({items.filter((i) => !i.is_archived).length})
          </button>
          <button
            onClick={() => setFilter("pinned")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1.5",
              filter === "pinned"
                ? "bg-brand/15 text-brand border border-brand/30"
                : "text-text-muted hover:text-white"
            )}
          >
            <Pin className="h-3 w-3" />
            Pinned ({items.filter((i) => i.is_pinned && !i.is_archived).length})
          </button>
          <button
            onClick={() => setFilter("archived")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1.5",
              filter === "archived"
                ? "bg-brand/15 text-brand border border-brand/30"
                : "text-text-muted hover:text-white"
            )}
          >
            <Archive className="h-3 w-3" />
            Archived ({items.filter((i) => i.is_archived).length})
          </button>
        </div>

        {/* Content list */}
        <div className="mt-6 space-y-4">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-brand" />
            </div>
          ) : filteredItems.length === 0 ? (
            <EmptyState
              icon={Newspaper}
              title="No internal announcements."
              description="New organizational announcements and team updates will appear here."
            />
          ) : (
            filteredItems.map((item) => (
              <article
                key={item.id}
                className={cn(
                  "relative overflow-hidden rounded-2xl border bg-surface-1 p-5 transition-colors duration-200",
                  item.is_pinned
                    ? "border-brand/40 bg-gradient-to-br from-surface-1 to-brand/5 shadow-md shadow-brand/10"
                    : "border-border-subtle hover:border-border-strong"
                )}
              >
                {item.is_pinned && (
                  <div className="mb-2 flex items-center gap-1 text-[11px] font-bold text-brand uppercase tracking-wider">
                    <Pin className="h-3.5 w-3.5 fill-brand" />
                    Pinned Announcement
                  </div>
                )}

                {item.image_url && (
                  <div className="mb-4 overflow-hidden rounded-xl border border-white/10 max-h-72 bg-surface-2">
                    <img
                      src={item.image_url}
                      alt={item.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  </div>
                )}

                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-base font-bold text-white sm:text-lg">{item.title}</h2>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-text-muted">
                      <span className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5 text-text-muted" />
                        {item.author_name}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-text-muted" />
                        {new Date(item.created_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => void togglePin(item)}
                      title={item.is_pinned ? "Unpin announcement" : "Pin announcement"}
                      className="rounded-lg p-1.5 text-text-muted hover:bg-white/5 hover:text-brand transition-colors"
                    >
                      {item.is_pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleArchive(item)}
                      title={item.is_archived ? "Restore announcement" : "Archive announcement"}
                      className="rounded-lg p-1.5 text-text-muted hover:bg-white/5 hover:text-amber-400 transition-colors"
                    >
                      <Archive className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteItem(item)}
                      title="Delete announcement"
                      className="rounded-lg p-1.5 text-text-muted hover:bg-white/5 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 text-sm leading-relaxed text-text-secondary whitespace-pre-line">
                  {item.content}
                </div>
              </article>
            ))
          )}
        </div>
      </main>

      {/* Publish Modal */}
      {showPublishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-border-strong bg-surface-1 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Newspaper className="h-5 w-5 text-brand" />
                Post Internal Announcement
              </h2>
              <button
                onClick={() => setShowPublishModal(false)}
                className="rounded p-1 text-text-muted hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handlePublish} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  Announcement Title *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. System Maintenance Notice / Policy Update"
                  className="w-full rounded-xl border border-border-subtle bg-surface-2 px-3 py-2 text-xs text-white focus:border-brand/50 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  Content / Message *
                </label>
                <textarea
                  required
                  rows={4}
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="Details of the announcement, procedures, or guidelines..."
                  className="w-full rounded-xl border border-border-subtle bg-surface-2 px-3 py-2 text-xs text-white focus:border-brand/50 outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  Optional Image (URL or file)
                </label>
                <input
                  type="text"
                  value={formImageUrl}
                  onChange={(e) => {
                    setFormImageUrl(e.target.value);
                    setImagePreview(e.target.value || null);
                  }}
                  placeholder="https://... or upload below"
                  className="w-full rounded-xl border border-border-subtle bg-surface-2 px-3 py-2 text-xs text-white focus:border-brand/50 outline-none mb-2"
                />
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageFileChange}
                  className="text-xs text-text-muted file:mr-2 file:rounded-lg file:border-0 file:bg-surface-3 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white hover:file:bg-brand hover:file:text-black cursor-pointer"
                />
              </div>

              {imagePreview && (
                <div className="relative overflow-hidden rounded-xl border border-white/10 max-h-40 bg-surface-2">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      setImagePreview(null);
                      setFormImageUrl("");
                    }}
                    className="absolute top-2 right-2 rounded-full bg-black/60 p-1 text-white hover:bg-black"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="pin-post"
                  checked={formPinned}
                  onChange={(e) => setFormPinned(e.target.checked)}
                  className="rounded border-border-subtle bg-surface-2 text-brand focus:ring-0"
                />
                <label htmlFor="pin-post" className="text-xs text-text-secondary cursor-pointer">
                  Pin this announcement to the top
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => setShowPublishModal(false)}
                  className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/5"
                  disabled={publishing}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={publishing}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-black hover:bg-brand-light disabled:opacity-50"
                >
                  {publishing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Publish Announcement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
