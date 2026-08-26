import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, MessageSquare } from "lucide-react";
import {
  listQuickReplies,
  createQuickReply,
  updateQuickReply,
  deleteQuickReply,
} from "@/lib/api/notifications";
import type { QuickReplyRow } from "@/lib/api/types";
import { Button } from "@/components/admin/AdminUI";
import { toast } from "sonner";

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

  const fetchReplies = async () => {
    try {
      const data = await listQuickReplies();
      setReplies(data);
    } catch (err) {
      toast.error("Failed to load quick replies");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchReplies();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing?.title || !editing?.body) {
      toast.error("Title and body are required");
      return;
    }

    try {
      if (editing.id) {
        await updateQuickReply(editing.id, editing.title, editing.body);
        toast.success("Quick reply updated");
      } else {
        await createQuickReply(editing.title, editing.body);
        toast.success("Quick reply created");
      }
      setEditing(null);
      void fetchReplies();
    } catch (err) {
      toast.error("Failed to save quick reply");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this quick reply?")) return;
    try {
      await deleteQuickReply(id);
      toast.success("Quick reply deleted");
      void fetchReplies();
    } catch (err) {
      toast.error("Failed to delete quick reply");
    }
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border-subtle bg-surface-1 px-6 py-4">
        <div>
          <h1 className="text-xl font-bold text-white">Quick Replies</h1>
          <p className="mt-1 text-sm text-text-muted">Manage pre-approved messages for the team.</p>
        </div>
        <Button onClick={() => setEditing({})} className="gap-2">
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
              Create templates for your team to use in chats.
            </p>
            <Button onClick={() => setEditing({})} className="mt-6 gap-2 mx-auto">
              <Plus className="h-4 w-4" /> Create First Reply
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {replies.map((r) => (
              <div
                key={r.id}
                className="rounded-xl border border-border-subtle bg-surface-1 p-5 shadow-sm relative group flex flex-col"
              >
                <h3 className="font-semibold text-white">{r.title}</h3>
                <p className="mt-2 text-sm text-text-muted line-clamp-4 flex-1 whitespace-pre-wrap">
                  {r.body}
                </p>

                <div className="mt-4 flex justify-end gap-2 border-t border-border-subtle pt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => setEditing(r)}
                    className="p-1.5 text-text-muted hover:text-white rounded bg-surface-2 transition-colors"
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border-subtle bg-surface-1 shadow-2xl">
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
                    placeholder="e.g. Welcome Message"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-text-secondary">
                    Message Body
                  </label>
                  <textarea
                    className="w-full rounded-xl border border-border-subtle bg-surface-2 px-3.5 py-2.5 text-sm text-white placeholder-text-muted outline-none focus:border-brand"
                    rows={6}
                    value={editing.body || ""}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setEditing({ ...editing, body: e.target.value })
                    }
                    placeholder="Enter the template text..."
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <Button variant="ghost" type="button" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button type="submit">Save</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
