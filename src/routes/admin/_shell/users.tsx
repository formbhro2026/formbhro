import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { getAdminUsers, setUserActive, type AdminUserRow } from "@/lib/api/admin.functions";

export const Route = createFileRoute("/admin/_shell/users")({ component: AdminUsers });

function AdminUsers() {
  const { requestsPage, refresh, activity } = useAdmin();
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "suspended">("all");
  const [selected, setSelected] = useState<AdminUserRow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const limit = 50;

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q);
      setPage(1); // Reset page on new search
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-users", page, limit, filter, debouncedQ],
    queryFn: () => getAdminUsers({ data: { page, limit, filter, search: debouncedQ } }),
  });

  const list = data?.users ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  // The requestsPage only holds requests visible on the admin dashboard,
  // so this isn't a true full history, but it matches the previous behavior.
  const detailRequests = useMemo(() => {
    if (!selected) return [];
    return requestsPage.filter((r) => r.user_id === selected.id);
  }, [selected, requestsPage]);

  const toggleActive = async (id: string, active: boolean) => {
    setBusy(id);
    try {
      await setUserActive({ data: { id, active } });
      await refetch();
      if (selected && selected.id === id) {
        setSelected({ ...selected, is_active: active });
      }
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <Panel
        title={`Users (${total})`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {(["all", "active", "suspended"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => {
                  setFilter(f);
                  setPage(1);
                }}
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
            placeholder="Name, email, phone..."
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
            {isLoading ? (
              <EmptyRow colSpan={6} text="Loading users..." />
            ) : (
              list.map((p) => {
                return (
                  <tr key={p.id} className="border-t border-border-subtle/50">
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => setSelected(p)}
                        className="text-left text-xs font-semibold text-white hover:text-brand-light"
                      >
                        {p.full_name || "Unnamed"}
                      </button>
                    </td>
                    <td className="px-3 py-2.5 text-text-secondary">
                      <div className="truncate font-mono text-brand-light">{p.email}</div>
                      <div className="text-[11px] text-text-muted">{p.phone ?? "—"}</div>
                    </td>
                    <td className="px-3 py-2.5 text-text-secondary">{p.requests_count} total</td>
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
              })
            )}
            {!isLoading && !list.length && (
              <EmptyRow colSpan={6} text="No users match this search." />
            )}
          </tbody>
        </TableWrap>

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between border-t border-border-subtle/50 pt-4 text-xs">
            <span className="text-text-muted">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="ghost"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Panel>

      {selected && (
        <Panel
          title={`Profile — ${selected.full_name || selected.email}`}
          action={
            <Button variant="ghost" onClick={() => setSelected(null)}>
              Close
            </Button>
          }
        >
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-2 rounded-xl border border-border-subtle bg-bg p-3 text-xs">
              <div className="flex items-center gap-3">
                {selected.avatar_url ? (
                  <img
                    src={selected.avatar_url}
                    alt=""
                    className="h-12 w-12 rounded-full object-cover"
                  />
                ) : (
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-brand/15 text-sm font-bold text-brand-light">
                    {(selected.full_name || selected.email).slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">
                    {selected.full_name || "Unnamed"}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-brand-light">{selected.email}</p>
                </div>
              </div>
              <p className="text-text-secondary">Phone: {selected.phone ?? "—"}</p>
              <p className="text-text-secondary">Joined: {formatDate(selected.created_at)}</p>
              <p className="text-text-secondary">Requests: {selected.requests_count}</p>
              <div className="flex flex-wrap gap-2 pt-2">
                <Link
                  to="/admin/chats"
                  search={{ request: detailRequests[0]?.id }}
                  className="inline-flex"
                >
                  <Button variant="ghost">Open chats</Button>
                </Link>
                <Button
                  variant={selected.is_active ? "danger" : "primary"}
                  onClick={() => void toggleActive(selected.id, !selected.is_active)}
                >
                  {selected.is_active ? "Suspend" : "Activate"}
                </Button>
              </div>
            </div>

            <div className="space-y-4 lg:col-span-2">
              <div>
                <h3 className="mb-2 text-xs font-semibold text-white">Recent Action Logs</h3>
                <ul className="max-h-40 space-y-2 overflow-y-auto pr-1">
                  {activity
                    .filter((a) => a.actor_id === selected.id)
                    .map((a) => (
                      <li
                        key={a.id}
                        className="rounded-lg border border-border-subtle bg-bg/50 px-3 py-2 text-[10px]"
                      >
                        <p className="font-medium text-white">{a.label || a.action}</p>
                        <p className="mt-0.5 text-text-muted">{formatDate(a.created_at)}</p>
                      </li>
                    ))}
                  {!activity.some((a) => a.actor_id === selected.id) && (
                    <li className="py-4 text-center text-[10px] uppercase text-text-muted">
                      No activity logs
                    </li>
                  )}
                </ul>
              </div>

              <div>
                <h3 className="mb-2 text-xs font-semibold text-white">Recent Requests</h3>
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
                    <li className="py-6 text-center text-xs text-text-muted">
                      No recent requests on page.
                    </li>
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
