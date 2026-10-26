import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Plus, Pencil, Trash2, MessageSquare, Image, Upload, X, Loader2 } from "lucide-react";
import {
  listQuickReplies,
  createQuickReply,
  updateQuickReply,
  deleteQuickReply,
  extractQuickReplyImage,
} from "@/lib/api/notifications";
import type { QuickReplyRow } from "@/lib/api/types";
import { Button } from "@/components/admin/AdminUI";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/_shell/templates")({
  component: AdminTemplates,
  head: () => ({
    meta: [{ title: "Quick Replies — Admin" }],
  }),
});

function AdminTemplates() {
  const [replies, setReplies] = useState<QuickReplyRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState<Partial<QuickReplyRow> | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchReplies = async () => {
    try {
      const data = await listQuickReplies();
      setReplies(data);
    } catch {
      toast.error("Failed to load quick replies");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchReplies();
  }, []);

  const openNewReply = () => {
    setEditing({});
    setImageUrl("");
  };

  const openEditReply = (r: QuickReplyRow) => {
    const { cleanBody, imageUrl: extractedUrl } = extractQuickReplyImage(r.body || "");
    setEditing({ ...r, body: cleanBody });
    setImageUrl(extractedUrl || "");
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file (PNG, JPG, WebP)");
      return;
    }

    setUploadingImage(true);
    try {
      const storagePath = `quick_replies/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(storagePath, file, {
        upsert: true,
        contentType: file.type,
      });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(storagePath);
      if (data?.publicUrl) {
        setImageUrl(data.publicUrl);
        toast.success("Image uploaded successfully");
      }
    } catch (err: any) {
      console.error("Image upload failed:", err);
      toast.error(err?.message || "Failed to upload image");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing?.title || !editing?.body?.trim()) {
      toast.error("Title and message body are required");
      return;
    }

    try {
      if (editing.id) {
        await updateQuickReply(editing.id, editing.title, editing.body.trim(), imageUrl.trim() || null);
        toast.success("Quick reply updated");
      } else {
        await createQuickReply(editing.title, editing.body.trim(), imageUrl.trim() || null);
        toast.success("Quick reply created");
      }
      setEditing(null);
      setImageUrl("");
      void fetchReplies();
    } catch {
      toast.error("Failed to save quick reply");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this quick reply?")) return;
    try {
      await deleteQuickReply(id);
      toast.success("Quick reply deleted");
      void fetchReplies();
    } catch {
      toast.error("Failed to delete quick reply");
    }
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border-subtle bg-surface-1 px-6 py-4">
        <div>
          <h1 className="text-xl font-bold text-white">Quick Replies</h1>
          <p className="mt-1 text-sm text-text-muted">Manage pre-approved messages and images for the team.</p>
        </div>
        <Button onClick={openNewReply} className="gap-2">
          <Plus className="h-4 w-4" /> New Reply
        </Button>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="text-center text-text-muted mt-10">Loading...</div>
        ) : replies.length === 0 ? (
          <div className="text-center mt-20 border border-border-subtle bg-surface-1 p-10 rounded-2xl">
            <MessageSquare className="h-12 w-12 text-brand mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold text-white">No Quick Replies</h3>
            <p className="text-sm text-text-muted mt-2">
              Create templates with text and images for your team to use in chats.
            </p>
            <Button onClick={openNewReply} className="mt-6 gap-2 mx-auto">
              <Plus className="h-4 w-4" /> Create First Reply
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {replies.map((r) => {
              const { cleanBody, imageUrl: itemImg } = extractQuickReplyImage(r.body || "");
              return (
                <div
                  key={r.id}
                  className="rounded-xl border border-border-subtle bg-surface-1 p-5 shadow-sm relative group flex flex-col"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-white">{r.title}</h3>
                    {itemImg && (
                      <span className="inline-flex items-center gap-1 rounded bg-brand/15 px-2 py-0.5 text-[10px] font-bold text-brand shrink-0">
                        <Image className="h-3 w-3" /> Image Included
                      </span>
                    )}
                  </div>

                  {itemImg && (
                    <div className="mt-3 overflow-hidden rounded-lg border border-border-subtle bg-surface-2">
                      <img
                        src={itemImg}
                        alt={r.title}
                        className="h-28 w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  )}

                  <p className="mt-2 text-sm text-text-muted line-clamp-3 flex-1 whitespace-pre-wrap">
                    {cleanBody}
                  </p>

                  <div className="mt-4 flex items-center justify-between border-t border-border-subtle pt-3">
                    <span className="text-[10px] text-text-muted">
                      {r.is_global ? "Global Template" : "Standard"}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditReply(r)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:border-brand/40 hover:text-white transition-colors"
                        title="Edit Quick Reply"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(r.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"
                        title="Delete Quick Reply"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-border-subtle bg-surface-1 shadow-2xl">
            <form onSubmit={handleSave} className="p-6">
              <h2 className="text-lg font-bold text-white mb-4">
                {editing.id ? "Edit Quick Reply" : "New Quick Reply"}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-text-secondary">
                    Title (internal)
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-xl border border-border-subtle bg-surface-2 px-3.5 py-2.5 text-sm text-white placeholder-text-muted outline-none focus:border-brand"
                    value={editing.title || ""}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setEditing({ ...editing, title: e.target.value })
                    }
                    placeholder="e.g. Payment QR Code / Welcome Message"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-text-secondary">
                    Message Body
                  </label>
                  <textarea
                    className="w-full rounded-xl border border-border-subtle bg-surface-2 px-3.5 py-2.5 text-sm text-white placeholder-text-muted outline-none focus:border-brand"
                    rows={4}
                    value={editing.body || ""}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setEditing({ ...editing, body: e.target.value })
                    }
                    placeholder="Enter the template text..."
                  />
                </div>

                {/* Image Option */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-text-secondary flex items-center gap-1.5">
                      <Image className="h-4 w-4 text-brand" /> Attached Image (Optional)
                    </label>
                    <span className="text-[11px] text-text-muted">QR code, guide, sample</span>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={handleImageFileChange}
                  />

                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="Paste Image URL or upload below..."
                      className="flex-1 rounded-xl border border-border-subtle bg-surface-2 px-3.5 py-2 text-xs text-white placeholder-text-muted outline-none focus:border-brand"
                    />
                    <button
                      type="button"
                      disabled={uploadingImage}
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-border-subtle bg-surface-2 px-3 py-2 text-xs font-semibold text-text-secondary hover:text-white hover:bg-surface-3 transition-colors disabled:opacity-50"
                    >
                      {uploadingImage ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Upload className="h-3.5 w-3.5 text-brand" />
                      )}
                      <span>Upload</span>
                    </button>
                  </div>

                  {imageUrl && (
                    <div className="mt-2 relative rounded-xl border border-border-subtle bg-surface-2 p-2 flex items-center gap-3">
                      <img
                        src={imageUrl}
                        alt="Preview"
                        className="h-14 w-14 rounded-lg object-cover bg-surface-3 border border-white/10 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-white truncate">Image Attached</p>
                        <p className="text-[11px] text-text-muted truncate">{imageUrl}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setImageUrl("")}
                        className="rounded-lg p-1.5 text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Remove Image"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <Button variant="ghost" type="button" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button type="submit">Save Quick Reply</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
