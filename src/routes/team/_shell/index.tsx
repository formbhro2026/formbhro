import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Bell,
  Briefcase,
  CircleCheck,
  Clock,
  FileText,
  Hourglass,
  Info,
  MessageSquareText,
  Plus,
  SlidersHorizontal,
  Timer,
} from "lucide-react";
import { TeamHeader } from "@/components/team/TeamHeader";
import { TeamStatusBadge, PriorityBadge } from "@/components/team/TeamStatusBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { useTeamStore } from "@/lib/team-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/team/_shell/")({
  component: TeamHome,
  head: () => ({
    meta: [
      { title: "Team Home — Formbhro Support Workspace" },
      {
        name: "description",
        content:
          "Daily overview of your assigned chats, pending requests and completed work in Formbhro.",
      },
      { property: "og:title", content: "Team Home — Formbhro Support Workspace" },
      {
        property: "og:description",
        content: "Your assigned chats, pending requests and completed work at a glance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

function TeamHome() {
  const { member, requests, pool, assignToMe } = useTeamStore();
  const [claiming, setClaiming] = useState<string | null>(null);

  const stats = useMemo(() => {
    const pending = requests.filter((r) => r.status === "pending").length;
    const waiting = requests.filter((r) => r.status === "waiting-user").length;
    const review = requests.filter((r) => r.status === "under-review").length;
    const completedToday = requests.filter((r) => r.status === "completed").length;
    return { pending, waiting, review, completedToday };
  }, [requests]);

  const kpiCards = [
    {
      label: "Assigned Chats",
      value: requests.length,
      icon: MessageSquareText,
      color: "text-white",
    },
    { label: "Pending", value: stats.pending, icon: Clock, color: "text-amber-300" },
    {
      label: "Waiting for Documents",
      value: stats.waiting,
      icon: FileText,
      color: "text-text-muted",
    },
    {
      label: "Completed Today",
      value: stats.completedToday,
      icon: CircleCheck,
      color: "text-emerald-400",
    },
    { label: "Avg. Response Time", value: "18m", icon: Timer, color: "text-white" },
    { label: "Satisfaction Score", value: "4.8/5", icon: Briefcase, color: "text-brand-light" },
  ];

  return (
    <>
      <TeamHeader title="Home" />
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 pb-28 pt-6 sm:px-6 lg:pb-10">
        <header className="mb-6">
          <h2 className="text-xl font-bold text-white sm:text-2xl">
            {greeting()}, {member?.name.split(" ")[0]} 👋
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            Here's what's happening with your assigned requests today.
          </p>
        </header>

        {/* KPI Grid */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {kpiCards.map((card) => (
            <div
              key={card.label}
              className="rounded-xl border border-border-subtle bg-surface-1 p-4"
            >
              <div className="flex items-center gap-2">
                <card.icon className="h-4 w-4 text-brand" strokeWidth={1.75} />
                <span className={cn("text-lg font-bold tabular-nums", card.color)}>
                  {card.value}
                </span>
              </div>
              <p className="mt-2 text-[11px] font-medium text-text-muted uppercase tracking-wider">
                {card.label}
              </p>
            </div>
          ))}
        </section>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_350px]">
          {/* Main Content Area */}
          <div className="space-y-6">
            <section className="rounded-2xl border border-border-subtle bg-surface-1 overflow-hidden">
              <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
                <h3 className="flex items-center gap-2 text-sm font-bold text-white uppercase tracking-wider">
                  New Requests{" "}
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand/20 text-[10px] text-brand-light">
                    {pool.length}
                  </span>
                </h3>
              </div>

              <div className="p-2">
                {pool.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-sm font-medium text-text-muted">No new requests in the pool.</p>
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {pool.slice(0, 5).map((r) => (
                      <li key={r.id} className="group flex items-center justify-between gap-4 rounded-xl p-3 transition-colors hover:bg-white/5">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 bg-surface-3 text-xs font-bold text-text-muted">
                            {r.userInitials}
                          </div>
                          <div className="min-w-0">
                            <h4 className="truncate text-sm font-semibold text-white">
                              {r.title}
                            </h4>
                            <p className="truncate text-xs text-text-muted mt-0.5">
                              {r.userName} • {r.id}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            setClaiming(r.id);
                            await assignToMe(r.id);
                            setClaiming(null);
                          }}
                          disabled={claiming === r.id}
                          className="flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-bold text-white transition-colors hover:bg-brand-light disabled:opacity-50"
                        >
                          {claiming === r.id ? (
                            <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          ) : (
                            <Plus className="h-3.5 w-3.5" />
                          )}
                          Claim
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-border-subtle bg-surface-1 overflow-hidden">
              <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
                <h3 className="flex items-center gap-2 text-sm font-bold text-white uppercase tracking-wider">
                  Assigned Chats{" "}
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand/20 text-[10px] text-brand-light">
                    {requests.length}
                  </span>
                </h3>
                <div className="flex items-center gap-2">
                  <button className="text-text-muted hover:text-white transition-colors">
                    <SlidersHorizontal className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="p-2">
                {requests.length === 0 ? (
                  <div className="py-10">
                    <EmptyState
                      icon={MessageSquareText}
                      title="No requests assigned."
                      description="New assignments from your admin will appear here."
                    />
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {requests.slice(0, 5).map((r) => (
                      <li key={r.id}>
                        <Link
                          to="/team/work"
                          search={{ r: r.id }}
                          className="group flex items-center gap-4 rounded-xl p-3 transition-colors hover:bg-white/5"
                        >
                          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 bg-surface-3 text-xs font-bold text-brand-light">
                            {r.userInitials}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="truncate text-sm font-semibold text-white">
                                {r.title}
                              </h4>
                              <span className="shrink-0 text-[10px] text-text-muted">
                                {r.lastUpdated.split("•")[1] || r.lastUpdated}
                              </span>
                            </div>
                            <div className="mt-0.5 flex items-center gap-2">
                              <p className="truncate text-xs text-text-muted">
                                {r.id} • {r.userName}
                              </p>
                            </div>
                            <p className="mt-1 truncate text-xs text-text-secondary">
                              {r.lastMessage}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <TeamStatusBadge status={r.status} className="scale-90 origin-right" />
                            {r.unread > 0 && (
                              <span className="grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[9px] font-bold text-white">
                                {r.unread}
                              </span>
                            )}
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}

                {requests.length > 5 && (
                  <Link
                    to="/team/work"
                    className="flex w-full items-center justify-center gap-2 py-4 text-xs font-semibold text-brand-light hover:text-white transition-colors border-t border-border-subtle mt-1"
                  >
                    View All Chats
                  </Link>
                )}
              </div>
            </section>
          </div>

          {/* Right Sidebar */}
          <aside className="space-y-6">
            <section className="rounded-2xl border border-border-subtle bg-surface-1 p-5">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
                My Performance
              </h3>
              <div className="flex flex-col items-center">
                <div className="relative flex items-center justify-center">
                  <svg className="h-32 w-32 -rotate-90">
                    <circle
                      cx="64"
                      cy="64"
                      r="58"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="transparent"
                      className="text-white/5"
                    />
                    <circle
                      cx="64"
                      cy="64"
                      r="58"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="transparent"
                      strokeDasharray={364.4}
                      strokeDashoffset={364.4 * (1 - 0.85)}
                      className="text-brand"
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-xl font-bold text-white">85%</span>
                    <span className="text-[10px] text-text-muted font-medium uppercase">
                      Excellent
                    </span>
                  </div>
                </div>

                <div className="mt-6 w-full grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-lg font-bold text-white">18</p>
                    <p className="text-[10px] text-text-muted font-medium uppercase">Completed</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-white">42</p>
                    <p className="text-[10px] text-text-muted font-medium uppercase">Responded</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-border-subtle bg-surface-1 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Announcements
                </h3>
                <Link to="/team" className="text-[10px] font-semibold text-brand-light">
                  View All
                </Link>
              </div>

              <ul className="space-y-4">
                <li className="flex gap-3">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
                    <Bell className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-white leading-snug">
                      New document guidelines have been updated.
                    </p>
                    <p className="mt-1 text-[10px] text-text-muted">2 hours ago</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/5 text-text-muted">
                    <Info className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-white leading-snug">
                      System maintenance scheduled on 02 June 2024.
                    </p>
                    <p className="mt-1 text-[10px] text-text-muted">1 day ago</p>
                  </div>
                </li>
              </ul>
            </section>
          </aside>
        </div>
      </main>
    </>
  );
}

function ActivityColumn({
  title,
  icon: Icon,
  items,
}: {
  title: string;
  icon: typeof MessageSquareText;
  items: ReturnType<typeof useTeamStore>["requests"];
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-surface-1 p-4">
      <h4 className="flex items-center gap-2 text-xs font-semibold text-white">
        <Icon className="h-3.5 w-3.5 text-brand" aria-hidden="true" /> {title}
      </h4>
      {items.length === 0 ? (
        <p className="mt-3 text-[11px] text-text-muted">Nothing here yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((r) => (
            <li key={r.id}>
              <Link
                to="/team/work"
                search={{ r: r.id }}
                className="block rounded-xl border border-white/10 bg-surface-2 p-3 transition-colors hover:border-white/20"
              >
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <p className="truncate text-xs font-semibold text-white">{r.title}</p>
                  <PriorityBadge priority={r.priority} />
                </div>
                <p className="mt-1 truncate text-[11px] text-text-muted">
                  {r.userName} • {r.id}
                </p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <TeamStatusBadge status={r.status} />
                  <span className="shrink-0 text-[10px] text-text-muted">{r.lastUpdated}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
