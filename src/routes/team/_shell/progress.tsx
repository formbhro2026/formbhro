import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import { TeamHeader } from "@/components/team/TeamHeader";
import { TeamStatusBadge, PriorityBadge } from "@/components/team/TeamStatusBadge";
import { StatusSelect } from "@/components/team/StatusSelect";
import { EmptyState } from "@/components/common/EmptyState";
import { useTeamStore } from "@/lib/team-store";
import type { TeamStatus } from "@/data/team-module";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/team/_shell/progress")({
  component: TeamProgress,
  head: () => ({
    meta: [
      { title: "Work Progress — Formbhro Team" },
      {
        name: "description",
        content:
          "Track every assigned Formbhro request by pending, in progress, waiting and completed status.",
      },
      { property: "og:title", content: "Work Progress — Formbhro Team" },
      { property: "og:description", content: "Progress across all of your assigned requests." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const TABS: { key: TeamStatus; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "under-review", label: "In Progress" },
  { key: "waiting-user", label: "Waiting" },
  { key: "completed", label: "Completed" },
];

function TeamProgress() {
  const { requests, setStatus } = useTeamStore();
  const [tab, setTab] = useState<TeamStatus>("pending");

  const counts = useMemo(() => {
    const map = new Map<TeamStatus, number>();
    for (const t of TABS) map.set(t.key, requests.filter((r) => r.status === t.key).length);
    return map;
  }, [requests]);

  const visible = requests.filter((r) => r.status === tab);

  return (
    <>
      <TeamHeader title="Progress" />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-6 sm:px-6 lg:pb-10">
        <h2 className="text-lg font-bold text-text">Progress</h2>
        <p className="mt-1 text-xs text-text-secondary">
          All requests assigned to you, grouped by status.
        </p>

        <div
          role="tablist"
          aria-label="Request status"
          className="mt-4 flex gap-2 overflow-x-auto pb-1"
        >
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              type="button"
              aria-selected={tab === t.key}
              tabIndex={tab === t.key ? 0 : -1}
              onClick={() => setTab(t.key)}
              className={cn(
                "min-h-9 shrink-0 rounded-full border px-3.5 text-[11px] font-semibold transition-colors",
                tab === t.key
                  ? "border-brand/40 bg-brand/10 text-brand-light"
                  : "border-border-strong px-3.5 text-text-secondary hover:bg-surface-2",
              )}
            >
              {t.label} ({counts.get(t.key) ?? 0})
            </button>
          ))}
        </div>

        <div role="tabpanel" className="mt-4">
          {visible.length === 0 ? (
            <EmptyState
              icon={BarChart3}
              title="No requests assigned."
              description="Nothing in this status right now."
            />
          ) : (
            <ul className="grid gap-3 lg:grid-cols-2">
              {visible.map((r) => (
                <li key={r.id} className="rounded-2xl border border-border-subtle bg-surface-1 p-4">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                    <div className="min-w-0">
                      <Link
                        to="/team/work"
                        search={{ r: r.id }}
                        className="truncate text-sm font-semibold text-text hover:underline"
                      >
                        {r.title}
                      </Link>
                      <p className="mt-0.5 truncate text-[11px] text-text-muted">
                        {r.userName} • {r.id}
                      </p>
                    </div>
                    <PriorityBadge priority={r.priority} />
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-text-secondary">
                    <span>Assigned {r.assignedAt}</span>
                    <span className="tabular-nums">{r.progress}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-dark to-brand-light"
                      style={{ width: `${r.progress}%` }}
                    />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <TeamStatusBadge status={r.status} />
                    <span className="text-[10px] text-text-muted">Updated {r.lastUpdated}</span>
                  </div>

                  <div className="mt-3">
                    <StatusSelect
                      requestId={r.id}
                      status={r.status}
                      onChange={(next) => setStatus(r.id, next)}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </>
  );
}
