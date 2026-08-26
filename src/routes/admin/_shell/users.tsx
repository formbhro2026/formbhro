import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useAdmin } from "@/lib/admin-store";
import {
  Button,
  EmptyRow,
  Panel,
  Pill,
  SearchBox,
  TableWrap,
  formatDate,
} from "@/components/admin/AdminUI";
import { setUserActive } from "@/lib/api/admin.functions";

export const Route = createFileRoute("/admin/_shell/users")({ component: AdminUsers });

function AdminUsers() {
  const { profiles, roles, requests, refresh, activity } = useAdmin();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "suspended">("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const userIds = useMemo(
    () => new Set(roles.filter((r) => r.role === "user").map((r) => r.user_id)),
    [roles],
  );

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return profiles
      .filter((p) => userIds.has(p.id))
      .filter((p) => (filter === "all" ? true : filter === "active" ? p.is_active : !p.is_active))
      .filter((p) => {
        if (!term) return true;
        const refs = requests
          .filter((r) => r.user_id === p.id)
          .map((r) => r.reference.toLowerCase());
        return (
          p.full_name.toLowerCase().includes(term) ||
          p.email.toLowerCase().includes(term) ||
          (p.phone ?? "").toLowerCase().includes(term) ||
          p.id.toLowerCase().includes(term) ||
          refs.some((r) => r.includes(term))
        );
      });
  }, [profiles, userIds, filter, q, requests]);

  const detail = profiles.find((p) => p.id === selected) ?? null;
  const detailRequests = requests.filter((r) => r.user_id === detail?.id);

  const toggleActive = async (id: string, active: boolean) => {
    setBusy(id);
    try {
      await setUserActive({ data: { id, active } });
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <Panel
        title={`Users (${list.length})`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {(["all", "active", "suspended"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold capitalize ${
                  filter === f
                    ? "border-brand/40 bg-brand/10 text-brand-light"
                    : "border-border-strong text-text-secondary"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        }
      >
        <div className="mb-3">
          <SearchBox
            value={q}
            onChange={setQ}
            label="Search users"
            placeholder="Name, email, phone, request ID…"
          />
        </div>

        <TableWrap>
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-text-muted">
              <th className="px-3 py-2 font-medium">User</th>
              <th className="px-3 py-2 font-medium">Contact</th>
              <th className="px-3 py-2 font-medium">Requests</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Joined</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {list.map((p) => {
              const mine = requests.filter((r) => r.user_id === p.id);
              return (
                <tr key={p.id} className="border-t border-border-subtle/50">
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => setSelected(p.id)}
                      className="text-left text-xs font-semibold text-white hover:text-brand-light"
                    >
                      {p.full_name || "Unnamed"}
                    </button>
                  </td>
                  <td className="px-3 py-2.5 text-text-secondary">
                    <div className="truncate font-mono text-brand-light">{p.email}</div>
                    <div className="text-[11px] text-text-muted">{p.phone ?? "—"}</div>
                  </td>
                  <td className="px-3 py-2.5 text-text-secondary">
                    {mine.length} total · {mine.filter((r) => r.status === "completed").length} done
                  </td>
                  <td className="px-3 py-2.5">
                    <Pill tone={p.is_active ? "ok" : "bad"}>
                      {p.is_active ? "Active" : "Suspended"}
                    </Pill>
                  </td>
                  <td className="px-3 py-2.5 text-text-muted">{formatDate(p.created_at)}</td>
                  <td className="px-3 py-2.5 text-right">
                    <Button
                      variant={p.is_active ? "danger" : "ghost"}
                      disabled={busy === p.id}
                      onClick={() => void toggleActive(p.id, !p.is_active)}
                    >
                      {p.is_active ? "Suspend" : "Activate"}
                    </Button>
                  </td>
                </tr>
              );
            })}
            {!list.length && <EmptyRow colSpan={6} text="No users match this search." />}
          </tbody>
        </TableWrap>
      </Panel>

      {detail && (
        <Panel
          title={`Profile — ${detail.full_name || detail.email}`}
          action={
            <Button variant="ghost" onClick={() => setSelected(null)}>
              Close
            </Button>
          }
        >
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-2 rounded-xl border border-border-subtle bg-bg p-3 text-xs">
              <div className="flex items-center gap-3">
                {detail.avatar_url ? (
                  <img
                    src={detail.avatar_url}
                    alt=""
                    className="h-12 w-12 rounded-full object-cover"
                  />
                ) : (
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-brand/15 text-sm font-bold text-brand-light">
                    {(detail.full_name || detail.email).slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">
                    {detail.full_name || "Unnamed"}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-brand-light">{detail.email}</p>
                </div>
              </div>
              <p className="text-text-secondary">Phone: {detail.phone ?? "—"}</p>
              <p className="text-text-secondary">Joined: {formatDate(detail.created_at)}</p>
              <p className="text-text-secondary">Requests: {detailRequests.length}</p>
              <div className="flex flex-wrap gap-2 pt-2">
                <Link
                  to="/admin/chats"
                  search={{ request: detailRequests[0]?.id }}
                  className="inline-flex"
                >
                  <Button variant="ghost">Open chats</Button>
                </Link>
                <Button
                  variant={detail.is_active ? "danger" : "primary"}
                  onClick={() => void toggleActive(detail.id, !detail.is_active)}
                >
                  {detail.is_active ? "Suspend" : "Activate"}
                </Button>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-4">
              <div>
                <h3 className="mb-2 text-xs font-semibold text-white">Recent Action Logs</h3>
                <ul className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {activity
                    .filter((a) => a.actor_id === detail.id)
                    .map((a) => (
                      <li
                        key={a.id}
                        className="rounded-lg border border-border-subtle bg-bg/50 px-3 py-2 text-[10px]"
                      >
                        <p className="text-white font-medium">{a.label || a.action}</p>
                        <p className="text-text-muted mt-0.5">{formatDate(a.created_at)}</p>
                      </li>
                    ))}
                  {!activity.some((a) => a.actor_id === detail.id) && (
                    <li className="py-4 text-center text-[10px] text-text-muted uppercase">
                      No activity logs
                    </li>
                  )}
                </ul>
              </div>

              <div>
                <h3 className="mb-2 text-xs font-semibold text-white">Request history</h3>
                <ul className="space-y-2">
                  {detailRequests.map((r) => (
                    <li
                      key={r.id}
                      className="rounded-xl border border-border-subtle bg-bg px-3 py-2.5 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          to="/admin/requests"
                          onClick={() => setSelected(null)}
                          className="truncate font-semibold text-white hover:text-brand-light"
                        >
                          {r.title}
                        </Link>
                        <Pill tone={r.status === "completed" ? "ok" : "brand"}>{r.status}</Pill>
                      </div>
                      <p className="mt-1 text-[11px] text-text-muted">
                        {r.reference} · Team: {r.assigned_team_id ? "assigned" : "unassigned"} ·{" "}
                        {formatDate(r.last_activity_at)}
                      </p>
                    </li>
                  ))}
                  {!detailRequests.length && (
                    <li className="py-6 text-center text-xs text-text-muted">No requests yet.</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
}
