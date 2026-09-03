import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Pin, Trash2, Image, AlertCircle, X, Check } from "lucide-react";
import { useAdmin } from "@/lib/admin-store";
import { Button, Field, Panel, Pill, formatDate, inputClass } from "@/components/admin/AdminUI";
import * as notificationsApi from "@/lib/api/notifications";

export const Route = createFileRoute("/admin/_shell/news")({ component: AdminNews });

function isValidHttpUrl(string: string) {
  if (!string.trim()) return false;
  try {
    const url = new URL(string.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_) {
    return false;
  }
}

function AdminNews() {
  const { news, refresh } = useAdmin();
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "Service Announcement",
    published: true,
    featured: false,
    image_url: "",
  });
  const [previewError, setPreviewError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "error" } | null>(null);

  // Edit modal state
  const [editingItem, setEditingItem] = useState<{
    id: string;
    title: string;
    description: string;
    category: string;
    published: boolean;
    featured: boolean;
    image_url: string;
  } | null>(null);
  const [editPreviewError, setEditPreviewError] = useState(false);
  const [editBusy, setEditBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);

    const trimmedUrl = form.image_url.trim();
    if (trimmedUrl && !isValidHttpUrl(trimmedUrl)) {
      setMsg({
        text: "Please enter a valid Image URL starting with http:// or https://",
        type: "error",
      });
      setBusy(false);
      return;
    }

    try {
      await notificationsApi.createNews({
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category.trim() || "Service Announcement",
        published: form.published,
        featured: form.featured,
        image_url: trimmedUrl || undefined,
      });
      setForm({
        title: "",
        description: "",
        category: "Service Announcement",
        published: true,
        featured: false,
        image_url: "",
      });
      setPreviewError(false);
      await refresh();
      setMsg({
        text: form.published
          ? "Published — everyone was notified in realtime."
          : "Saved as a draft.",
        type: "ok",
      });
    } catch (e2) {
      setMsg({
        text: e2 instanceof Error ? e2.message : "Could not save this announcement.",
        type: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setEditBusy(true);

    const trimmedUrl = editingItem.image_url.trim();
    if (trimmedUrl && !isValidHttpUrl(trimmedUrl)) {
      alert("Please enter a valid Image URL starting with http:// or https://");
      setEditBusy(false);
      return;
    }

    try {
      await notificationsApi.updateNews(editingItem.id, {
        title: editingItem.title.trim(),
        description: editingItem.description.trim(),
        category: editingItem.category.trim() || "Service Announcement",
        published: editingItem.published,
        featured: editingItem.featured,
        image_url: trimmedUrl || null,
      });
      setEditingItem(null);
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update announcement.");
    } finally {
      setEditBusy(false);
    }
  };

  const patch = async (id: string, next: Parameters<typeof notificationsApi.updateNews>[1]) => {
    await notificationsApi.updateNews(id, next);
    await refresh();
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      <Panel title="Create announcement">
        {msg && (
          <div
            className={`mb-3 flex items-start gap-2 rounded-xl border px-3 py-2 text-[11px] ${
              msg.type === "ok"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-danger/30 bg-danger/10 text-danger"
            }`}
          >
            {msg.type === "ok" ? (
              <Check className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-danger mt-0.5" />
            )}
            <p>{msg.text}</p>
          </div>
        )}
        <form onSubmit={(e) => void submit(e)} className="space-y-3">
          <Field label="Title">
            <input
              required
              className={inputClass}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. New Passport Services Available"
            />
          </Field>
          <Field label="Description">
            <textarea
              rows={4}
              className={`${inputClass} resize-y py-2`}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Detailed announcement text…"
            />
          </Field>
          <Field label="Category">
            <input
              className={inputClass}
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="Service Announcement"
            />
          </Field>
          <Field label="Banner Image URL">
            <input
              type="url"
              placeholder="https://example.com/image.jpg"
              className={inputClass}
              value={form.image_url}
              onChange={(e) => {
                setForm({ ...form, image_url: e.target.value });
                setPreviewError(false);
              }}
            />
          </Field>

          {/* Live Image Preview */}
          {form.image_url.trim() && (
            <div className="rounded-xl border border-border-subtle bg-surface-2 p-2 overflow-hidden">
              <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1.5 flex items-center gap-1.5">
                <Image className="h-3.5 w-3.5 text-brand" /> Live Preview
              </div>
              {previewError ? (
                <div className="flex items-center gap-2 rounded-lg bg-danger/10 border border-danger/20 p-2 text-[10px] text-danger">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>Unable to load image from this URL. Please verify the link.</span>
                </div>
              ) : (
                <div className="relative rounded-lg overflow-hidden border border-border-subtle bg-black/40 max-h-36">
                  <img
                    src={form.image_url.trim()}
                    alt="Preview"
                    className="w-full h-36 object-cover"
                    onError={() => setPreviewError(true)}
                    onLoad={() => setPreviewError(false)}
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex gap-4 text-[11px] text-text-secondary">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.published}
                onChange={(e) => setForm({ ...form, published: e.target.checked })}
              />{" "}
              Publish now
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(e) => setForm({ ...form, featured: e.target.checked })}
              />{" "}
              Pin
            </label>
          </div>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Saving…" : form.published ? "Publish" : "Save draft"}
          </Button>
        </form>
      </Panel>

      <Panel title={`Announcements (${news.length})`}>
        <ul className="space-y-2">
          {news.map((n) => (
            <li key={n.id} className="rounded-xl border border-border-subtle bg-bg p-3">
              <div className="flex flex-wrap items-center gap-3">
                {n.image_url ? (
                  <img
                    src={n.image_url}
                    alt=""
                    className="h-12 w-20 rounded-lg object-cover bg-surface-2 border border-border-subtle shrink-0"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="h-12 w-16 rounded-lg bg-surface-2 border border-border-subtle flex items-center justify-center text-text-muted shrink-0">
                    <Image className="h-4 w-4" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="min-w-0 truncate text-xs font-semibold text-white">{n.title}</p>
                    <Pill tone={n.published ? "ok" : "warn"}>
                      {n.published ? "Published" : "Draft"}
                    </Pill>
                    {n.featured && <Pill tone="brand">Pinned</Pill>}
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-[10px] text-text-muted">{n.category}</p>
                </div>
              </div>
              <p className="mt-1.5 line-clamp-2 text-[11px] text-text-secondary leading-relaxed">
                {n.description}
              </p>
              <p className="mt-1 text-[10px] text-text-muted">
                {n.category} · {formatDate(n.published_at)}
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <Button
                  variant="ghost"
                  onClick={() => void patch(n.id, { published: !n.published })}
                >
                  {n.published ? "Unpublish" : "Publish"}
                </Button>
                <Button variant="ghost" onClick={() => void patch(n.id, { featured: !n.featured })}>
                  <Pin className="h-3 w-3" aria-hidden="true" /> {n.featured ? "Unpin" : "Pin"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditingItem({
                      id: n.id,
                      title: n.title,
                      description: n.description,
                      category: n.category,
                      published: n.published,
                      featured: n.featured,
                      image_url: n.image_url || "",
                    });
                    setEditPreviewError(false);
                  }}
                >
                  Edit
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    if (window.confirm("Delete this announcement?")) {
                      void notificationsApi.deleteNews(n.id).then(() => refresh());
                    }
                  }}
                >
                  <Trash2 className="h-3 w-3" aria-hidden="true" /> Delete
                </Button>
              </div>
            </li>
          ))}
          {!news.length && (
            <li className="py-8 text-center text-xs text-text-muted">No announcements yet.</li>
          )}
        </ul>
      </Panel>

      {/* Edit Announcement Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl border border-border-subtle bg-surface-1 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <h3 className="text-sm font-bold text-white">Edit Announcement</h3>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="rounded-lg p-1.5 text-text-muted hover:bg-surface-2 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={(e) => void handleEditSubmit(e)} className="space-y-3">
              <Field label="Title">
                <input
                  required
                  className={inputClass}
                  value={editingItem.title}
                  onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                />
              </Field>
              <Field label="Description">
                <textarea
                  rows={3}
                  className={`${inputClass} resize-y py-2`}
                  value={editingItem.description}
                  onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                />
              </Field>
              <Field label="Category">
                <input
                  className={inputClass}
                  value={editingItem.category}
                  onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
                />
              </Field>
              <Field label="Banner Image URL">
                <input
                  type="url"
                  placeholder="https://example.com/image.jpg"
                  className={inputClass}
                  value={editingItem.image_url}
                  onChange={(e) => {
                    setEditingItem({ ...editingItem, image_url: e.target.value });
                    setEditPreviewError(false);
                  }}
                />
              </Field>

              {editingItem.image_url.trim() && (
                <div className="rounded-xl border border-border-subtle bg-surface-2 p-2 overflow-hidden">
                  {editPreviewError ? (
                    <div className="flex items-center gap-2 rounded-lg bg-danger/10 border border-danger/20 p-2 text-[10px] text-danger">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>Unable to load image from this URL.</span>
                    </div>
                  ) : (
                    <div className="relative rounded-lg overflow-hidden border border-border-subtle bg-black/40 max-h-32">
                      <img
                        src={editingItem.image_url.trim()}
                        alt="Preview"
                        className="w-full h-32 object-cover"
                        onError={() => setEditPreviewError(true)}
                        onLoad={() => setEditPreviewError(false)}
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-4 text-[11px] text-text-secondary pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingItem.published}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, published: e.target.checked })
                    }
                  />{" "}
                  Published
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingItem.featured}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, featured: e.target.checked })
                    }
                  />{" "}
                  Pinned
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
                <Button variant="ghost" type="button" onClick={() => setEditingItem(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={editBusy}>
                  {editBusy ? "Saving…" : "Save Changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

