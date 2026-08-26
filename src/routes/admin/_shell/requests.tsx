import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useAdmin } from "@/lib/admin-store";
import {
  Button,
  EmptyRow,
  Panel,
  Pill,
  SearchBox,
  TableWrap,
  formatDate,
  inputClass,
  Field,
} from "@/components/admin/AdminUI";
import { STATUS_LABEL, type DbRequestStatus } from "@/lib/api/types";
import { assignRequestToTeam, takeoverRequest } from "@/lib/api/admin.functions";
import * as requestsApi from "@/lib/api/requests";
import { Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

function PriorityPill({ priority }: { priority: "high" | "medium" | "low" }) {
  const tones = { high: "bad", medium: "warn", low: "neutral" } as const;
  return <Pill tone={tones[priority] || "neutral"}>{priority}</Pill>;
}

export const Route = createFileRoute("/admin/_shell/requests")({ component: AdminRequests });

const STATUSES: DbRequestStatus[] = [
  "pending",
  "assigned",
  "waiting_documents",
  "under_review",
  "in_progress",
  "completed",
  "cancelled",
];

function AdminRequests() {
  const { team, activity, profileOf, refresh, requestsPage, requestsTotal, fetchRequestsPage } =
    useAdmin();
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [status, setStatus] = useState<"all" | DbRequestStatus>("all");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pageSize = 50;

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  // Reset to page 1 on filter change
  useEffect(() => {
    setPage(1);
  }, [debouncedQ, status]);

  // Fetch page
  useEffect(() => {
    void fetchRequestsPage(page, {
      search: debouncedQ || undefined,
      status: status !== "all" ? [status] : undefined,
      limit: pageSize,
    });
  }, [page, debouncedQ, status, fetchRequestsPage]);

  const list = requestsPage;
  const totalPages = Math.max(1, Math.ceil(requestsTotal / pageSize));
  const detail = requestsPage.find((r) => r.id === open) ?? null;

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await refresh();
    } catch (e) {
      console.error("ACT_ERROR:", e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {open ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-bg lg:left-60 xl:left-64 top-14">
          <div className="flex-1 flex flex-col overflow-hidden p-4">
            <Panel
              title={detail?.reference || "Request Details"}
              className="flex-1 flex flex-col overflow-hidden"
              action={
                <Button variant="ghost" className="h-8 px-3" onClick={() => setOpen(null)}>
                  Close
                </Button>
              }
            >
              <div className="flex-1 grid gap-6 p-4 lg:grid-cols-2 overflow-y-auto">
                <div className="space-y-6">
                  <section className="space-y-3 rounded-2xl border border-border-subtle bg-surface-2 p-4 shadow-sm">
                    <header className="border-b border-white/5 pb-3">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-brand mb-2">
                        Basic Information
                      </h4>
                      <p className="text-sm font-bold text-white leading-tight">{detail?.title}</p>
                      <p className="text-[10px] font-mono text-text-muted mt-1">{detail?.id}</p>
                    </header>

                    <div className="grid grid-cols-2 gap-4 pt-1">
                      <Field label="User">
                        <div className="flex items-center gap-2 mt-1">
                          <span className="grid h-6 w-6 place-items-center rounded-full bg-brand/10 text-[10px] font-bold text-brand">
                            {(profileOf(detail?.user_id ?? "")?.full_name ?? "U")[0]}
                          </span>
                          <p className="text-xs font-medium text-white truncate">
                            {profileOf(detail?.user_id ?? "")?.full_name ?? "—"}
                          </p>
                        </div>
                      </Field>
                      <Field label="Category">
                        <p className="text-xs font-medium text-text-secondary mt-1">
                          {detail?.category}
                        </p>
                      </Field>
                      <Field label="Priority">
                        <div className="mt-1">
                          <PriorityPill priority={detail?.priority as any} />
                        </div>
                      </Field>
                      <Field label="Progress">
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="h-1.5 flex-1 bg-surface-3 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-brand transition-all duration-500"
                              style={{ width: `${detail?.progress}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-bold tabular-nums text-text-muted">
                            {detail?.progress}%
                          </span>
                        </div>
                      </Field>
                    </div>
                  </section>

                  <section className="space-y-4 rounded-2xl border border-border-subtle bg-surface-2 p-4 shadow-sm">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-brand">
                      Workflow Control
                    </h4>

                    {detail?.is_escalated && (
                      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 flex flex-col gap-3">
                        <div className="flex items-start gap-2 text-amber-500">
                          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                          <div className="text-xs">
                            <p className="font-bold">Escalated Request</p>
                            <p className="text-amber-500/80 mt-0.5">
                              This request has been flagged by the assigned team member for admin
                              intervention.
                            </p>
                          </div>
                        </div>
                        <Button
                          className="w-full bg-amber-500 text-black hover:bg-amber-400 border-none font-bold text-xs h-9 rounded-xl"
                          disabled={busy}
                          onClick={async () => {
                            if (
                              !confirm(
                                "Are you sure you want to take over this request? You will become the assigned team member and it will be de-escalated.",
                              )
                            )
                              return;
                            await act(() => takeoverRequest({ data: { request_id: detail.id } }));
                          }}
                        >
                          Take Over Request
                        </Button>
                      </div>
                    )}

                    <div className="grid gap-4">
                      <Field label="Current Status">
                        <select
                          className={cn(
                            inputClass,
                            "mt-1 border-border-strong bg-surface-3 h-10 text-xs font-medium",
                          )}
                          value={detail?.status}
                          disabled={busy}
                          onChange={(e) =>
                            void act(() =>
                              requestsApi.updateRequestStatus(
                                detail!.id,
                                e.target.value as DbRequestStatus,
                              ),
                            )
                          }
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {STATUS_LABEL[s]}
                            </option>
                          ))}
                        </select>
                      </Field>

                      <Field label="Assigned Team Member">
                        <div className="relative mt-1">
                          <select
                            className={cn(
                              inputClass,
                              "border-border-strong bg-surface-3 h-10 text-xs font-medium",
                            )}
                            value={detail?.assigned_team_id ?? ""}
                            disabled={busy}
                            onChange={async (e) => {
                              const teamId = e.target.value;
                              await act(() =>
                                assignRequestToTeam({
                                  data: {
                                    request_id: detail!.id,
                                    team_member_id: teamId || (null as any),
                                  },
                                }),
                              );
                            }}
                          >
                            <option value="">Unassigned</option>
                            {team.map((t) => (
                              <option key={t.id} value={t.id}>
                                {profileOf(t.id)?.full_name ?? t.team_code}
                              </option>
                            ))}
                          </select>
                        </div>
                      </Field>
                    </div>

                    <div className="pt-2">
                      <Link to="/admin/chats" search={{ request: detail?.id }} className="w-full">
                        <Button className="w-full bg-brand/10 text-brand hover:bg-brand/20 border border-brand/20 h-10 text-xs font-bold rounded-xl">
                          Open Request Chat
                        </Button>
                      </Link>
                    </div>
                  </section>
                </div>

                <div className="space-y-6">
                  <section className="space-y-4 rounded-2xl border border-border-subtle bg-surface-2 p-4 shadow-sm flex-1 flex flex-col">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-brand">
                      Activity Timeline
                    </h4>
                    <div className="relative border-l border-border-subtle ml-2 space-y-6 pb-2">
                      {activity
                        .filter((a) => a.request_id === detail?.id)
                        .slice(0, 10)
                        .map((a) => (
                          <div key={a.id} className="ml-5 relative">
                            <span className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full bg-brand ring-4 ring-surface-2" />
                            <p className="text-[11px] font-bold text-white leading-tight">
                              {a.label ?? a.action}
                            </p>
                            <time className="text-[9px] text-text-muted uppercase font-medium mt-1 block">
                              {formatDate(a.created_at)}
                            </time>
                          </div>
                        ))}
                      {!activity.some((a) => a.request_id === detail?.id) && (
                        <div className="ml-5 py-4 text-[10px] text-text-muted uppercase italic">
                          No recent activity
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              </div>
            </Panel>
          </div>
        </div>
      ) : null}

      <Panel
        title={`Requests (${requestsTotal})`}
        className="h-[calc(100vh-10rem)] overflow-y-auto"
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <SearchBox
            value={q}
            onChange={setQ}
            label="Search requests"
            placeholder="Request ID, user, team…"
          />
          <select
            className={`${inputClass} sm:w-44`}
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            aria-label="Filter status"
          >
            <option value="all">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>

        <TableWrap>
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-text-muted">
              <th className="px-3 py-2 font-medium">Request</th>
              <th className="px-3 py-2 font-medium">User</th>
              <th className="px-3 py-2 font-medium">Team</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Priority</th>
              <th className="px-3 py-2 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr
                key={r.id}
                className="border-t border-border-subtle/50 transition-colors cursor-pointer hover:bg-white/5"
                onClick={() => setOpen(r.id)}
              >
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-white">{r.title}</span>
                    {r.is_escalated && (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-500">
                        <AlertTriangle className="h-3 w-3" />
                        Escalated
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-text-muted">{r.reference}</div>
                </td>
                <td className="px-3 py-2.5 text-text-secondary">
                  {profileOf(r.user_id)?.full_name ?? "—"}
                </td>
                <td className="px-3 py-2.5 text-text-secondary">
                  {r.assigned_team_id ? (
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      {profileOf(r.assigned_team_id)?.full_name ?? "Assigned"}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-amber-500">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      Unassigned
                    </div>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <Pill
                    tone={
                      r.status === "completed" ? "ok" : r.status === "pending" ? "warn" : "brand"
                    }
                  >
                    {STATUS_LABEL[r.status]}
                  </Pill>
                </td>
                <td className="px-3 py-2.5 capitalize text-text-secondary">{r.priority}</td>
                <td className="px-3 py-2.5 text-text-muted">{formatDate(r.last_activity_at)}</td>
              </tr>
            ))}
            {!list.length && <EmptyRow colSpan={6} text="No requests match these filters." />}
          </tbody>
        </TableWrap>

        <div className="flex items-center justify-between p-4 border-t border-border-subtle/50 text-xs">
          <span className="text-text-muted">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              className="h-7 px-3 text-xs"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <Button
              variant="ghost"
              className="h-7 px-3 text-xs"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
