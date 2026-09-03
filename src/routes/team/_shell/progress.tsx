import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BarChart3, Calendar, CheckCircle2, Clock } from "lucide-react";
import { TeamHeader } from "@/components/team/TeamHeader";
import { TeamStatusBadge, PriorityBadge } from "@/components/team/TeamStatusBadge";
import { StatusSelect } from "@/components/team/StatusSelect";
import { EmptyState } from "@/components/common/EmptyState";
import { useTeamStore } from "@/lib/team-store";
import type { TeamRequest, TeamStatus } from "@/data/team-module";
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

function getYearMonth(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  return `${year}-${month}`;
}

function formatMonthLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  if (!y || !m) return yearMonth;
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function TeamProgress() {
  const { requests, setStatus } = useTeamStore();
  const [tab, setTab] = useState<TeamStatus>("pending");

  // Filter: 'all' | 'current' | 'previous' | 'custom'
  const [periodType, setPeriodType] = useState<"all" | "current" | "previous" | "custom">("all");
  const [customMonth, setCustomMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}`;
  });

  const now = new Date();
  const currentYearMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}`;
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevYearMonth = `${prevDate.getFullYear()}-${(prevDate.getMonth() + 1).toString().padStart(2, "0")}`;

  const selectedTargetMonth = useMemo(() => {
    if (periodType === "all") return null;
    if (periodType === "current") return currentYearMonth;
    if (periodType === "previous") return prevYearMonth;
    return customMonth;
  }, [periodType, customMonth, currentYearMonth, prevYearMonth]);

  // Discovered available months from real assigned requests
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    months.add(currentYearMonth);
    months.add(prevYearMonth);
    for (const r of requests) {
      const comp = getYearMonth(r.completedAt);
      if (comp) months.add(comp);
      const created = getYearMonth(r.createdAt);
      if (created) months.add(created);
    }
    return Array.from(months).sort().reverse();
  }, [requests, currentYearMonth, prevYearMonth]);

  // Request matching logic for the chosen period
  const matchesPeriod = (r: TeamRequest): boolean => {
    if (!selectedTargetMonth) return true; // All time

    if (r.status === "completed") {
      // Authoritative completed_at timestamp
      const compYm = getYearMonth(r.completedAt) || getYearMonth(r.lastUpdated);
      return compYm === selectedTargetMonth;
    } else {
      // Created / assigned period
      const createdYm = getYearMonth(r.createdAt) || getYearMonth(r.createdOn);
      return createdYm === selectedTargetMonth;
    }
  };

  const filteredRequests = useMemo(() => {
    return requests.filter(matchesPeriod);
  }, [requests, selectedTargetMonth]);

  const counts = useMemo(() => {
    const map = new Map<TeamStatus, number>();
    for (const t of TABS) {
      map.set(t.key, filteredRequests.filter((r) => r.status === t.key).length);
    }
    return map;
  }, [filteredRequests]);

  const visible = useMemo(() => {
    return filteredRequests.filter((r) => r.status === tab);
  }, [filteredRequests, tab]);

  // Summary Metrics
  const completedInPeriod = useMemo(() => {
    return filteredRequests.filter((r) => r.status === "completed").length;
  }, [filteredRequests]);

  const totalInPeriod = filteredRequests.length;
  const completionRate = totalInPeriod > 0 ? Math.round((completedInPeriod / totalInPeriod) * 100) : 0;

  return (
    <>
      <TeamHeader title="Progress" />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-6 sm:px-6 lg:pb-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-text">Work Progress</h2>
            <p className="mt-0.5 text-xs text-text-secondary">
              Track assigned requests, completion metrics, and monthly output.
            </p>
          </div>

          {/* Month / Period Filter Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-xl border border-border-subtle bg-surface-2 p-1 text-xs">
              <Calendar className="h-3.5 w-3.5 text-brand ml-1.5" />
              <button
                type="button"
                onClick={() => setPeriodType("all")}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors",
                  periodType === "all"
                    ? "bg-brand text-white shadow-sm"
                    : "text-text-muted hover:text-white",
                )}
              >
                All Time
              </button>
              <button
                type="button"
                onClick={() => setPeriodType("current")}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors",
                  periodType === "current"
                    ? "bg-brand text-white shadow-sm"
                    : "text-text-muted hover:text-white",
                )}
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => setPeriodType("previous")}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors",
                  periodType === "previous"
                    ? "bg-brand text-white shadow-sm"
                    : "text-text-muted hover:text-white",
                )}
              >
                Last Month
              </button>
              <select
                aria-label="Select custom month"
                value={periodType === "custom" ? customMonth : ""}
                onChange={(e) => {
                  if (e.target.value) {
                    setCustomMonth(e.target.value);
                    setPeriodType("custom");
                  }
                }}
                className={cn(
                  "rounded-lg border-none bg-surface-3 py-1 pl-2 pr-6 text-[11px] font-semibold outline-none transition-colors cursor-pointer",
                  periodType === "custom" ? "text-brand" : "text-text-muted hover:text-white",
                )}
              >
                <option value="" disabled>
                  Select Month…
                </option>
                {availableMonths.map((ym) => (
                  <option key={ym} value={ym}>
                    {formatMonthLabel(ym)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Selected Period Metrics Bar */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-border-subtle bg-surface-1 p-3.5">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">
              <Calendar className="h-3 w-3 text-brand" /> Period
            </div>
            <p className="mt-1 text-xs font-bold text-white truncate">
              {periodType === "all"
                ? "All Time"
                : selectedTargetMonth
                  ? formatMonthLabel(selectedTargetMonth)
                  : "All Time"}
            </p>
          </div>
          <div className="rounded-2xl border border-border-subtle bg-surface-1 p-3.5">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">
              <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Completed Work
            </div>
            <p className="mt-1 text-sm font-black text-white">
              {completedInPeriod} <span className="text-[10px] font-normal text-text-muted">({completionRate}% rate)</span>
            </p>
          </div>
          <div className="col-span-2 sm:col-span-1 rounded-2xl border border-border-subtle bg-surface-1 p-3.5">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">
              <Clock className="h-3 w-3 text-amber-400" /> Active in Period
            </div>
            <p className="mt-1 text-sm font-black text-white">
              {totalInPeriod - completedInPeriod} <span className="text-[10px] font-normal text-text-muted">requests</span>
            </p>
          </div>
        </div>

        {/* Status Tabs */}
        <div
          role="tablist"
          aria-label="Request status"
          className="mt-5 flex gap-2 overflow-x-auto pb-1"
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

        {/* Request List */}
        <div role="tabpanel" className="mt-4">
          {visible.length === 0 ? (
            <EmptyState
              icon={BarChart3}
              title="No requests found."
              description={
                periodType === "all"
                  ? "Nothing in this status right now."
                  : `No ${tab} requests recorded for ${selectedTargetMonth ? formatMonthLabel(selectedTargetMonth) : "this period"}.`
              }
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
                    <span>
                      {r.status === "completed" && r.completedAt
                        ? `Completed ${new Date(r.completedAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}`
                        : `Assigned ${r.assignedAt}`}
                    </span>
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

