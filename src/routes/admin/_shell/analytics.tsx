import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Users, UserCog, Inbox, CheckCircle2, Timer, Clock } from "lucide-react";
import { useAdmin } from "@/lib/admin-store";
import { Panel, StatCard } from "@/components/admin/AdminUI";

export const Route = createFileRoute("/admin/_shell/analytics")({ component: AdminAnalytics });

function hoursBetween(a: string, b: string) {
  return (new Date(b).getTime() - new Date(a).getTime()) / 36e5;
}

function AdminAnalytics() {
  const { requests, roles, team, documents, profileOf } = useAdmin();

  const stats = useMemo(() => {
    const completed = requests.filter((r) => r.completed_at);
    const avgCompletion = completed.length
      ? completed.reduce((sum, r) => sum + hoursBetween(r.created_at, r.completed_at!), 0) /
        completed.length
      : 0;
    const assigned = requests.filter((r) => r.assigned_at);
    const avgResponse = assigned.length
      ? assigned.reduce((sum, r) => sum + hoursBetween(r.created_at, r.assigned_at!), 0) /
        assigned.length
      : 0;

    const since = (days: number) => {
      const cut = Date.now() - days * 864e5;
      return requests.filter((r) => new Date(r.created_at).getTime() >= cut).length;
    };

    const perTeam = team
      .map((t) => {
        const mine = requests.filter((r) => r.assigned_team_id === t.id);
        const lastActivity =
          mine.length > 0
            ? Math.max(...mine.map((r) => new Date(r.last_activity_at || r.created_at).getTime()))
            : 0;
        const isOnline = lastActivity > Date.now() - 30 * 60 * 1000; // Online if active in last 30 mins
        return {
          id: t.id,
          name: profileOf(t.id)?.full_name ?? t.team_code,
          total: mine.length,
          done: mine.filter((r) => r.status === "completed").length,
          isOnline,
        };
      })
      .sort((a, b) => (a.isOnline === b.isOnline ? b.done - a.done : a.isOnline ? -1 : 1));

    const perUser = requests.reduce<Record<string, number>>((acc, r) => {
      acc[r.user_id] = (acc[r.user_id] ?? 0) + 1;
      return acc;
    }, {});
    const topUsers = Object.entries(perUser)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const perDoc = documents.reduce<Record<string, number>>((acc, d) => {
      acc[d.file_name] = (acc[d.file_name] ?? 0) + 1;
      return acc;
    }, {});
    const topDocs = Object.entries(perDoc)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return {
      avgCompletion,
      avgResponse,
      daily: since(1),
      weekly: since(7),
      monthly: since(30),
      perTeam,
      topUsers,
      topDocs,
    };
  }, [requests, team, documents, profileOf]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        <StatCard
          label="Total users"
          value={roles.filter((r) => r.role === "user").length}
          icon={Users}
        />
        <StatCard label="Total team" value={team.length} icon={UserCog} />
        <StatCard label="Total requests" value={requests.length} icon={Inbox} />
        <StatCard
          label="Completed"
          value={requests.filter((r) => r.status === "completed").length}
          icon={CheckCircle2}
        />
        <StatCard
          label="Avg completion"
          value={`${stats.avgCompletion.toFixed(1)} h`}
          icon={Timer}
        />
        <StatCard
          label="Avg first response"
          value={`${stats.avgResponse.toFixed(1)} h`}
          icon={Clock}
        />
        <StatCard label="Requests / 24h" value={stats.daily} icon={Inbox} />
        <StatCard
          label="Requests / 7d"
          value={stats.weekly}
          icon={Inbox}
          hint={`${stats.monthly} in the last 30 days`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Team Engagement & Status">
          <ul className="space-y-2 text-xs">
            {stats.perTeam.map((t) => (
              <li key={t.id} className="rounded-xl border border-border-subtle bg-bg px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${t.isOnline ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-surface-3"}`}
                    />
                    <span className="truncate font-semibold text-white">{t.name}</span>
                  </div>
                  <span className="text-[10px] font-bold text-text-muted uppercase">
                    {t.done}/{t.total} COMPLETED
                  </span>
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${t.total ? (t.done / t.total) * 100 : 0}%` }}
                  />
                </div>
              </li>
            ))}
            {!stats.perTeam.length && (
              <li className="py-6 text-center text-text-muted">No team members yet.</li>
            )}
          </ul>
        </Panel>

        <Panel title="Platform Growth (Requests)">
          <div className="space-y-6 py-2">
            <div className="flex items-end justify-between gap-1 h-32 px-2">
              {[stats.daily, stats.weekly / 7, stats.monthly / 30, (stats.monthly * 1.2) / 30].map(
                (val, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                    <div
                      className="w-full bg-brand/20 group-hover:bg-brand/40 transition-all rounded-t-sm relative"
                      style={{
                        height: `${Math.max(10, (val / (Math.max(stats.daily, 1) * 2)) * 100)}%`,
                      }}
                    >
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity">
                        {Math.round(val)}
                      </div>
                    </div>
                    <span className="text-[9px] font-bold text-text-muted uppercase">
                      {["Today", "Avg/W", "Avg/M", "Proj"].map((v) => v)[i]}
                    </span>
                  </div>
                ),
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-surface-2 p-3 border border-border-subtle">
                <p className="text-[10px] font-bold text-text-muted uppercase">Conversion Rate</p>
                <p className="text-lg font-bold text-white">
                  {requests.length
                    ? Math.round(
                        (requests.filter((r) => r.status === "completed").length /
                          requests.length) *
                          100,
                      )
                    : 0}
                  %
                </p>
              </div>
              <div className="rounded-lg bg-surface-2 p-3 border border-border-subtle">
                <p className="text-[10px] font-bold text-text-muted uppercase">Active Load</p>
                <p className="text-lg font-bold text-white">
                  {
                    requests.filter((r) => r.status !== "completed" && r.status !== "cancelled")
                      .length
                  }
                </p>
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="Most Active Users">
          <ul className="space-y-2 text-xs">
            {stats.topUsers.map(([id, count]) => (
              <li
                key={id}
                className="flex items-center justify-between gap-2 rounded-xl border border-border-subtle bg-bg px-3 py-2.5"
              >
                <div className="flex items-center gap-2 truncate">
                  <div className="h-6 w-6 rounded-full bg-brand/10 flex items-center justify-center text-[10px] font-bold text-brand">
                    {profileOf(id)?.full_name?.charAt(0) || "U"}
                  </div>
                  <span className="truncate text-white font-medium">
                    {profileOf(id)?.full_name ?? "User"}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-text-muted uppercase">
                  {count} REQS
                </span>
              </li>
            ))}
            {!stats.topUsers.length && (
              <li className="py-6 text-center text-center text-text-muted">No activity yet.</li>
            )}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
