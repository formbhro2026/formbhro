import { createFileRoute } from "@tanstack/react-router";
import { Users, UserCog, Inbox, CheckCircle2, Timer, Clock } from "lucide-react";
import { useAdmin } from "@/lib/admin-store";
import { Panel, StatCard } from "@/components/admin/AdminUI";

export const Route = createFileRoute("/admin/_shell/analytics")({ component: AdminAnalytics });

function AdminAnalytics() {
  const { stats, roles, team, profileOf } = useAdmin();

  if (!stats) return <div className="p-4 text-text-muted">Loading analytics...</div>;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        <StatCard label="Total users" value={stats.users} icon={Users} />
        <StatCard label="Total team" value={team.length} icon={UserCog} />
        <StatCard label="Total requests" value={stats.total} icon={Inbox} />
        <StatCard label="Completed" value={stats.completed} icon={CheckCircle2} />
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
                  {stats.total ? Math.round((stats.completed / stats.total) * 100) : 0}%
                </p>
              </div>
              <div className="rounded-lg bg-surface-2 p-3 border border-border-subtle">
                <p className="text-[10px] font-bold text-text-muted uppercase">Active Load</p>
                <p className="text-lg font-bold text-white">
                  {stats.total - stats.completed /* approx pending load */}
                </p>
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="Most Active Users">
          <ul className="space-y-2 text-xs">
            {stats.topUsers.map((user) => (
              <li
                key={user.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-border-subtle bg-bg px-3 py-2.5"
              >
                <div className="flex items-center gap-2 truncate">
                  <div className="h-6 w-6 rounded-full bg-brand/10 flex items-center justify-center text-[10px] font-bold text-brand">
                    {profileOf(user.id)?.full_name?.charAt(0) || "U"}
                  </div>
                  <span className="truncate text-white font-medium">
                    {profileOf(user.id)?.full_name ?? "User"}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-text-muted uppercase">
                  {user.count} REQS
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
