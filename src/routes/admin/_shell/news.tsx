import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Pin, Trash2 } from "lucide-react";
import { useAdmin } from "@/lib/admin-store";
import { Button, Field, Panel, Pill, formatDate, inputClass } from "@/components/admin/AdminUI";
import * as notificationsApi from "@/lib/api/notifications";

export const Route = createFileRoute("/admin/_shell/news")({ component: AdminNews });

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
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await notificationsApi.createNews(form);
      setForm({
        title: "",
        description: "",
        category: "Service Announcement",
        published: true,
        featured: false,
        image_url: "",
      });
      await refresh();
      setMsg(
        form.published ? "Published — everyone was notified in realtime." : "Saved as a draft.",
      );
    } catch (e2) {
      setMsg(e2 instanceof Error ? e2.message : "Could not save this announcement.");
    } finally {
      setBusy(false);
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
          <p className="mb-3 rounded-xl border border-border-subtle bg-surface-1 px-3 py-2 text-[11px] text-text-secondary">
            {msg}
          </p>
        )}
        <form onSubmit={(e) => void submit(e)} className="space-y-3">
          <Field label="Title">
            <input
              required
              className={inputClass}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </Field>
          <Field label="Description">
            <textarea
              rows={4}
              className={`${inputClass} resize-y py-2`}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          <Field label="Category">
            <input
              className={inputClass}
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
          </Field>
          <Field label="Banner Image URL">
            <input
              placeholder="https://..."
              className={inputClass}
              value={form.image_url}
              onChange={(e) => setForm({ ...form, image_url: e.target.value })}
            />
          </Field>
          <div className="flex gap-4 text-[11px] text-text-secondary">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.published}
                onChange={(e) => setForm({ ...form, published: e.target.checked })}
              />{" "}
              Publish now
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(e) => setForm({ ...form, featured: e.target.checked })}
              />{" "}
              Pin
            </label>
          </div>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : form.published ? "Publish" : "Save draft"}
          </Button>
        </form>
      </Panel>

      <Panel title={`Announcements (${news.length})`}>
        <ul className="space-y-2">
          {news.map((n) => (
            <li key={n.id} className="rounded-xl border border-border-subtle bg-bg p-3">
              <div className="flex flex-wrap items-center gap-3">
                {n.image_url && (
                  <img
                    src={n.image_url}
                    alt=""
                    className="h-10 w-16 rounded-lg object-cover bg-surface-2"
                  />
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
              <p className="mt-1 line-clamp-2 text-[11px] text-text-secondary">{n.description}</p>
              <p className="mt-1 text-[10px] text-text-muted">
                {n.category} · {formatDate(n.published_at)}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
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
                    const title = window.prompt("Title", n.title);
                    if (title) void patch(n.id, { title });
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
    </div>
  );
}
