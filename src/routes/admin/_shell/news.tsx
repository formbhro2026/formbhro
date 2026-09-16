import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { Pin, Trash2, Image, AlertCircle, X, Check, Upload, Loader2 } from "lucide-react";
import { useAdmin } from "@/lib/admin-store";
import { Button, Field, Panel, Pill, formatDate, inputClass } from "@/components/admin/AdminUI";
import * as notificationsApi from "@/lib/api/notifications";
import { supabase } from "@/integrations/supabase/client";
import { resolveImageUrl, uploadNewsBanner } from "@/lib/api/admin.functions";

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

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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

  // Upload and resolver states
  const [uploading, setUploading] = useState(false);
  const [editUploading, setEditUploading] = useState(false);
  const [resolvingUrl, setResolvingUrl] = useState(false);
  const [editResolvingUrl, setEditResolvingUrl] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileUpload = async (file: File, isEdit: boolean = false) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file (PNG, JPG, WebP, etc.).");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert("Image size should be less than 10MB.");
      return;
    }

    if (isEdit) {
      setEditUploading(true);
      setEditPreviewError(false);
    } else {
      setUploading(true);
      setPreviewError(false);
    }

    try {
      let publicUrl = "";
      try {
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData.user?.id;
        if (uid) {
          const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : ".jpg";
          const nameWithoutExt = file.name.includes(".") ? file.name.slice(0, file.name.lastIndexOf(".")) : file.name;
          const safeName = nameWithoutExt.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50);
          const storagePath = `${uid}/banner-${Date.now()}-${safeName}${ext}`;

          const { error: uploadError } = await supabase.storage.from("avatars").upload(storagePath, file, {
            contentType: file.type || "image/jpeg",
            upsert: true,
          });

          if (!uploadError) {
            const { data } = supabase.storage.from("avatars").getPublicUrl(storagePath);
            if (data?.publicUrl) publicUrl = data.publicUrl;
          }
        }
      } catch (clientErr) {
        console.warn("[AdminNews] Direct storage upload failed, attempting server upload:", clientErr);
      }

      if (!publicUrl) {
        const base64 = await fileToBase64(file);
        const res = await uploadNewsBanner({
          data: {
            fileName: file.name,
            fileBase64: base64,
            mimeType: file.type || "image/jpeg",
          },
        });
        publicUrl = res.url;
      }

      if (publicUrl) {
        if (isEdit) {
          setEditingItem((prev) => (prev ? { ...prev, image_url: publicUrl } : null));
          setEditPreviewError(false);
        } else {
          setForm((prev) => ({ ...prev, image_url: publicUrl }));
          setPreviewError(false);
        }
      }
    } catch (err) {
      console.error("[AdminNews] Banner upload failed:", err);
      alert(err instanceof Error ? err.message : "Failed to upload banner image. Please try again.");
    } finally {
      if (isEdit) setEditUploading(false);
      else setUploading(false);
    }
  };

  const handleUrlChange = async (urlVal: string, isEdit: boolean = false) => {
    let finalUrl = urlVal;

    const gDriveMatch = finalUrl.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (gDriveMatch) {
      finalUrl = `https://lh3.googleusercontent.com/d/${gDriveMatch[1]}`;
    } else if (finalUrl.includes("dropbox.com")) {
      finalUrl = finalUrl.replace(/[?&]dl=0/, "").replace(/[?&]raw=1/, "") + (finalUrl.includes("?") ? "&raw=1" : "?raw=1");
    } else {
      const imgurMatch = finalUrl.match(/imgur\.com\/(?:a\/|gallery\/)?([a-zA-Z0-9]+)$/);
      if (imgurMatch) finalUrl = `https://i.imgur.com/${imgurMatch[1]}.jpg`;
    }

    if (isEdit) {
      setEditingItem((prev) => (prev ? { ...prev, image_url: finalUrl } : null));
      setEditPreviewError(false);
    } else {
      setForm((prev) => ({ ...prev, image_url: finalUrl }));
      setPreviewError(false);
    }

    // Auto-resolve ImgBB viewer page link (e.g. ibb.co/m5BvK5z8) to direct image URL
    if (finalUrl.includes("ibb.co/") && !finalUrl.includes("i.ibb.co/")) {
      if (isEdit) setEditResolvingUrl(true);
      else setResolvingUrl(true);
      try {
        const resolved = await resolveImageUrl({ data: { url: finalUrl } });
        if (resolved?.url && resolved.url !== finalUrl) {
          if (isEdit) {
            setEditingItem((prev) => (prev ? { ...prev, image_url: resolved.url } : null));
            setEditPreviewError(false);
          } else {
            setForm((prev) => ({ ...prev, image_url: resolved.url }));
            setPreviewError(false);
          }
        }
      } catch (e) {
        console.warn("[AdminNews] Error resolving URL:", e);
      } finally {
        if (isEdit) setEditResolvingUrl(false);
        else setResolvingUrl(false);
      }
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);

    let trimmedUrl = form.image_url.trim();
    if (trimmedUrl && trimmedUrl.includes("ibb.co/") && !trimmedUrl.includes("i.ibb.co/")) {
      try {
        const resolved = await resolveImageUrl({ data: { url: trimmedUrl } });
        if (resolved?.url) trimmedUrl = resolved.url;
      } catch (_) {}
    }

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

    let trimmedUrl = editingItem.image_url.trim();
    if (trimmedUrl && trimmedUrl.includes("ibb.co/") && !trimmedUrl.includes("i.ibb.co/")) {
      try {
        const resolved = await resolveImageUrl({ data: { url: trimmedUrl } });
        if (resolved?.url) trimmedUrl = resolved.url;
      } catch (_) {}
    }

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
          <Field label="Banner Image">
            <div className="space-y-2">
              {/* File upload button row */}
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleFileUpload(file, false);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  disabled={uploading || resolvingUrl || busy}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 rounded-xl bg-surface-2 hover:bg-surface-3 border border-border-subtle px-3 py-2 text-xs font-medium text-text-primary transition-colors disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-brand" />
                      <span>Uploading banner…</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 text-brand" />
                      <span>Upload Banner File</span>
                    </>
                  )}
                </button>
                <span className="text-[11px] text-text-muted">or paste link below</span>
              </div>

              {/* URL input */}
              <div className="relative">
                <input
                  type="url"
                  placeholder="https://example.com/banner.jpg (or ImgBB link)"
                  className={`${inputClass} pr-8`}
                  value={form.image_url}
                  onChange={(e) => void handleUrlChange(e.target.value, false)}
                />
                {resolvingUrl && (
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-brand" />
                  </div>
                )}
                {form.image_url && !resolvingUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setForm((prev) => ({ ...prev, image_url: "" }));
                      setPreviewError(false);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-white p-1"
                    title="Clear URL"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </Field>

          {/* Live Image Preview */}
          {form.image_url.trim() && (
            <div className="rounded-xl border border-border-subtle bg-surface-2 p-2.5 overflow-hidden">
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                  <Image className="h-3.5 w-3.5 text-brand" /> Live Preview
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setForm((prev) => ({ ...prev, image_url: "" }));
                    setPreviewError(false);
                  }}
                  className="text-[10px] text-danger hover:underline flex items-center gap-1"
                >
                  <Trash2 className="h-3 w-3" /> Remove
                </button>
              </div>
              {previewError ? (
                <div className="rounded-lg bg-danger/10 border border-danger/20 p-2.5 text-[11px] text-danger space-y-1">
                  <div className="flex items-center gap-2 font-medium">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>Unable to load image from this URL.</span>
                  </div>
                  <p className="text-[10px] text-text-muted">
                    Tip: Use the <strong>Upload Banner File</strong> button above to upload directly from your device.
                  </p>
                </div>
              ) : (
                <div className="relative rounded-lg overflow-hidden border border-border-subtle bg-black/40 max-h-48">
                  <img
                    src={form.image_url.trim()}
                    alt="Preview"
                    className="w-full h-44 object-cover"
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
              <Field label="Banner Image">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={editFileInputRef}
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleFileUpload(file, true);
                        e.target.value = "";
                      }}
                    />
                    <button
                      type="button"
                      disabled={editUploading || editResolvingUrl || editBusy}
                      onClick={() => editFileInputRef.current?.click()}
                      className="flex items-center gap-2 rounded-xl bg-surface-2 hover:bg-surface-3 border border-border-subtle px-3 py-2 text-xs font-medium text-text-primary transition-colors disabled:opacity-50"
                    >
                      {editUploading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin text-brand" />
                          <span>Uploading…</span>
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 text-brand" />
                          <span>Upload Banner File</span>
                        </>
                      )}
                    </button>
                    <span className="text-[11px] text-text-muted">or paste link below</span>
                  </div>

                  <div className="relative">
                    <input
                      type="url"
                      placeholder="https://example.com/banner.jpg (or ImgBB link)"
                      className={`${inputClass} pr-8`}
                      value={editingItem.image_url}
                      onChange={(e) => void handleUrlChange(e.target.value, true)}
                    />
                    {editResolvingUrl && (
                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                        <Loader2 className="h-4 w-4 animate-spin text-brand" />
                      </div>
                    )}
                    {editingItem.image_url && !editResolvingUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingItem((prev) => (prev ? { ...prev, image_url: "" } : null));
                          setEditPreviewError(false);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-white p-1"
                        title="Clear URL"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </Field>

              {editingItem.image_url.trim() && (
                <div className="rounded-xl border border-border-subtle bg-surface-2 p-2.5 overflow-hidden">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                      <Image className="h-3.5 w-3.5 text-brand" /> Live Preview
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingItem((prev) => (prev ? { ...prev, image_url: "" } : null));
                        setEditPreviewError(false);
                      }}
                      className="text-[10px] text-danger hover:underline flex items-center gap-1"
                    >
                      <Trash2 className="h-3 w-3" /> Remove
                    </button>
                  </div>
                  {editPreviewError ? (
                    <div className="rounded-lg bg-danger/10 border border-danger/20 p-2.5 text-[11px] text-danger space-y-1">
                      <div className="flex items-center gap-2 font-medium">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        <span>Unable to load image from this URL.</span>
                      </div>
                      <p className="text-[10px] text-text-muted">
                        Tip: Use the <strong>Upload Banner File</strong> button above to upload directly from your device.
                      </p>
                    </div>
                  ) : (
                    <div className="relative rounded-lg overflow-hidden border border-border-subtle bg-black/40 max-h-48">
                      <img
                        src={editingItem.image_url.trim()}
                        alt="Preview"
                        className="w-full h-40 object-cover"
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

