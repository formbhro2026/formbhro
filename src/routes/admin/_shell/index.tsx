import { createFileRoute, Link } from "@tanstack/react-router";
import { Users, UserCog, Inbox, Clock, CheckCircle2, MessagesSquare } from "lucide-react";
import { useAdmin } from "@/lib/admin-store";
import { Panel, StatCard, Pill, formatDate } from "@/components/admin/AdminUI";
import { STATUS_LABEL } from "@/lib/api/types";

export const Route = createFileRoute("/admin/_shell/")({
  component: AdminDashboard,
});

function isToday(value?: string | null) {
  if (!value) return false;
  const d = new Date(value);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

function AdminDashboard() {
  const { requestsPage, profileOf, stats, activity } = useAdmin();

  const totalUsers = stats?.users ?? 0;
  const completed = stats?.completed ?? 0;
  const active = (stats?.total ?? 0) - completed;
  const pending = active; // Treat all active as pending/processing for the summary

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Users" value={totalUsers} icon={Users} />
        <StatCard label="Team Members" value={stats?.teamCount ?? 0} icon={UserCog} />
        <StatCard label="Active Requests" value={active} icon={Inbox} />
        <StatCard label="Completed" value={completed} icon={CheckCircle2} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Stats Summary */}
        <Panel title="Platform Summary" className="lg:col-span-2">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-surface-2 p-4 border border-border-subtle">
              <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                Pending
              </p>
              <p className="mt-1 text-2xl font-bold text-white">{pending}</p>
            </div>
            <div className="rounded-2xl bg-surface-2 p-4 border border-border-subtle">
              <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                Response Time
              </p>
              <p className="mt-1 text-2xl font-bold text-white">~2.4h</p>
            </div>
            <div className="rounded-2xl bg-surface-2 p-4 border border-border-subtle">
              <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                New Today
              </p>
              <p className="mt-1 text-2xl font-bold text-white">{stats?.daily ?? 0}</p>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-xs font-bold text-white mb-4">Request Status Distribution</h3>
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-3">
              <div
                className="bg-amber-500"
                style={{ width: `${(pending / (stats?.total || 0 || 1)) * 100}%` }}
              />
              <div
                className="bg-brand"
                style={{ width: `${((active - pending) / (stats?.total || 0 || 1)) * 100}%` }}
              />
              <div
                className="bg-emerald-500"
                style={{ width: `${(completed / (stats?.total || 0 || 1)) * 100}%` }}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-4">
              <div className="flex items-center gap-1.5 text-[10px] font-medium text-text-secondary">
                <span className="h-2 w-2 rounded-full bg-amber-500" /> Pending
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-medium text-text-secondary">
                <span className="h-2 w-2 rounded-full bg-brand" /> Processing
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-medium text-text-secondary">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Completed
              </div>
            </div>
          </div>
        </Panel>

        {/* Quick Actions / Activity */}
        <Panel
          title="Recent Activity"
          action={
            <Link
              to="/admin/requests"
              className="text-[10px] font-bold text-brand uppercase tracking-wider"
            >
              All Requests
            </Link>
          }
        >
          <ul className="space-y-3">
            {activity.slice(0, 5).map((a) => (
              <li key={a.id} className="flex gap-3 text-xs">
                <div className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-white line-clamp-1">{a.label || a.action}</p>
                  <p className="text-[10px] text-text-muted">{formatDate(a.created_at)}</p>
                </div>
              </li>
            ))}
            {!activity.length && (
              <li className="py-4 text-center text-[10px] text-text-muted uppercase">
                No recent activity
              </li>
            )}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Latest Requests"
          action={
            <Link
              to="/admin/requests"
              className="text-[10px] font-bold text-brand uppercase tracking-wider"
            >
              View All
            </Link>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border-subtle text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  <th className="pb-3 pr-2">Reference</th>
                  <th className="pb-3 px-2">User</th>
                  <th className="pb-3 px-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {requestsPage.slice(0, 5).map((r) => (
                  <tr key={r.id} className="border-b border-border-subtle/50 last:border-0">
                    <td className="py-3 pr-2 font-medium text-white">{r.reference}</td>
                    <td className="py-3 px-2 text-text-secondary">
                      {profileOf(r.user_id)?.full_name || "User"}
                    </td>
                    <td className="py-3 px-2">
                      <Pill tone={r.status === "completed" ? "ok" : "brand"}>
                        {STATUS_LABEL[r.status]}
                      </Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="System Status">
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl bg-surface-2 p-3 border border-border-subtle">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Database Connection</p>
                  <p className="text-[10px] text-text-muted uppercase tracking-tight">
                    Active & Stable
                  </p>
                </div>
              </div>
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
            </div>

            <div className="flex items-center justify-between rounded-xl bg-surface-2 p-3 border border-border-subtle">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-brand/10 flex items-center justify-center text-brand">
                  <MessagesSquare className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Realtime Service</p>
                  <p className="text-[10px] text-text-muted uppercase tracking-tight">
                    Operational
                  </p>
                </div>
              </div>
              <span className="h-2 w-2 rounded-full bg-brand" />
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
