import { createFileRoute, Link } from "@tanstack/react-router";
import { useUserStore } from "@/lib/user-store";
import { UserHeader } from "@/components/layout/UserHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";
import {
  Search,
  SlidersHorizontal,
  X,
  ExternalLink,
  Calendar,
  Building2,
  GraduationCap,
  Users,
  Clock,
  Sparkles,
  Share2,
  Check,
  Briefcase,
  Lock,
  Layers,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import {
  JOB_GROUPS,
  DEFAULT_QUALIFICATIONS,
  isVacancyLive,
  matchesAgeCriteria,
  type JobGroupId,
} from "@/data/vacancy-groups";
import type { NewsItem } from "@/data/user-module";

export const Route = createFileRoute("/app/groups")({
  ssr: false,
  component: UserJobGroups,
  head: () => ({
    meta: [
      { title: "Job Update Groups — Formbhro" },
      {
        name: "description",
        content: "Explore verified Jobs Update and Hidden Jobs Update recruitment groups.",
      },
    ],
  }),
});

function UserJobGroups() {
  const { news } = useUserStore();
  const [activeGroupId, setActiveGroupId] = useState<JobGroupId>("jobs-update");

  // Filters State (independent per user interaction)
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedQualification, setSelectedQualification] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState<"all" | "live" | "closed">("all");
  const [userAge, setUserAge] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "deadline">("newest");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const activeGroup = JOB_GROUPS.find((g) => g.id === activeGroupId) || JOB_GROUPS[0];

  // Filter items belonging to the active group
  const groupItems = useMemo(() => {
    return (news ?? []).filter((item) => {
      const cat = (item.category || "").toLowerCase();
      if (activeGroupId === "jobs-update") {
        // Matches Jobs Update group or general government vacancies
        return (
          cat.includes("jobs update") ||
          cat.includes("job") ||
          cat.includes("vacancy") ||
          cat.includes("recruitment") ||
          (!cat.includes("hidden") && !cat.includes("internal"))
        );
      } else {
        // Matches Hidden Jobs Update group
        return (
          cat.includes("hidden") ||
          cat.includes("private") ||
          cat.includes("off-campus") ||
          cat.includes("special")
        );
      }
    });
  }, [news, activeGroupId]);

  // Apply search & interactive filters
  const filteredList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    let list = groupItems.filter((item) => {
      // 1. Search query
      if (q) {
        const full = `${item.title} ${item.description} ${item.organization || ""} ${
          item.qualification || ""
        }`.toLowerCase();
        if (!full.includes(q)) return false;
      }

      // 2. Qualification
      if (selectedQualification !== "All") {
        if (!item.qualification) return false;
        if (!item.qualification.toLowerCase().includes(selectedQualification.toLowerCase())) {
          return false;
        }
      }

      // 3. Status (Live vs Closed)
      const isLive = isVacancyLive(item);
      if (selectedStatus === "live" && !isLive) return false;
      if (selectedStatus === "closed" && isLive) return false;

      // 4. Age match
      if (!matchesAgeCriteria(userAge, item.min_age, item.max_age)) return false;

      return true;
    });

    // Sort order
    if (sortBy === "deadline") {
      list = [...list].sort((a, b) => {
        const dateA = a.application_last_date ? new Date(a.application_last_date).getTime() : Infinity;
        const dateB = b.application_last_date ? new Date(b.application_last_date).getTime() : Infinity;
        return dateA - dateB;
      });
    }

    return list;
  }, [groupItems, searchQuery, selectedQualification, selectedStatus, userAge, sortBy]);

  const activeFilterCount =
    (selectedQualification !== "All" ? 1 : 0) +
    (selectedStatus !== "all" ? 1 : 0) +
    (userAge ? 1 : 0);

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedQualification("All");
    setSelectedStatus("all");
    setUserAge("");
    setSortBy("newest");
  };

  const handleShare = async (item: NewsItem) => {
    const text = `📢 ${item.title}\n\nOrganization: ${item.organization || "Govt"}\nQualification: ${
      item.qualification || "Check notification"
    }\nLast Date: ${item.application_last_date || "Open"}\n\nCheck on Formbhro: https://formbhro.com/app/groups`;
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      setCopiedId(item.id);
      toast.success("Job details copied to clipboard!");
      setTimeout(() => setCopiedId(null), 2500);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-bg text-text">
      <UserHeader title="Job Groups" />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-28 pt-4 sm:px-6">
        {/* Navigation Breadcrumb / Section Switcher */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold text-white sm:text-2xl flex items-center gap-2">
              <Users className="h-6 w-6 text-brand" /> Job Update Groups
            </h1>
            <p className="mt-0.5 text-xs text-text-secondary">
              Organized vacancy groups verified by Formbhro team.
            </p>
          </div>
          <Link
            to="/app/news"
            className="text-xs font-semibold text-brand hover:underline inline-flex items-center gap-1"
          >
            All Updates <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Group Selector Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {JOB_GROUPS.map((group) => {
            const isSelected = activeGroupId === group.id;
            const count = (news ?? []).filter((n) => {
              const c = (n.category || "").toLowerCase();
              return group.id === "jobs-update"
                ? c.includes("job") || c.includes("vacancy") || !c.includes("hidden")
                : c.includes("hidden") || c.includes("special") || c.includes("off-campus");
            }).length;

            return (
              <button
                key={group.id}
                type="button"
                onClick={() => {
                  setActiveGroupId(group.id);
                  resetFilters();
                }}
                className={cn(
                  "p-4 rounded-2xl border text-left transition-all duration-200 relative overflow-hidden group",
                  isSelected
                    ? "border-brand bg-surface-1 shadow-lg shadow-brand/10 ring-1 ring-brand/30"
                    : "border-border-subtle bg-surface-1/70 hover:border-border-strong hover:bg-surface-1",
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={cn(
                      "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      group.id === "hidden-jobs-update"
                        ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                        : "bg-brand/20 text-brand-light border border-brand/30",
                    )}
                  >
                    {group.badge} Group
                  </span>
                  <span className="text-xs font-mono font-bold text-text-muted">
                    {count} {count === 1 ? "Update" : "Updates"}
                  </span>
                </div>
                <h2 className="text-base font-bold text-white group-hover:text-brand transition-colors">
                  {group.name}
                </h2>
                <p className="text-xs text-text-secondary mt-1 leading-relaxed line-clamp-2">
                  {group.description}
                </p>
                {isSelected && (
                  <div className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-brand">
                    <span>Active Group Filter</span>
                    <span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Group Banner & Search Box */}
        <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4 shadow-sm mb-6 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border-subtle pb-3">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-brand">
                Now Browsing
              </span>
              <h3 className="text-base font-bold text-white">{activeGroup.name}</h3>
              <p className="text-xs text-text-secondary">{activeGroup.tagline}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full bg-surface-2 border border-border-subtle text-xs font-semibold text-text-muted">
                {filteredList.length} matching
              </span>
            </div>
          </div>

          {/* Search Bar + Filter Trigger */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${activeGroup.name} by title, department...`}
                className="h-10 w-full rounded-xl border border-border-subtle bg-surface-2 pl-10 pr-4 text-xs sm:text-sm text-white placeholder:text-text-muted focus:border-brand/50 outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setFiltersOpen((o) => !o)}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition-all shrink-0",
                activeFilterCount > 0
                  ? "border-brand bg-brand/10 text-brand-light"
                  : "border-border-subtle bg-surface-2 text-text-secondary hover:text-white",
              )}
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">Filters</span>
              {activeFilterCount > 0 && (
                <span className="grid h-4 w-4 place-items-center rounded-full bg-brand text-[9px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Collapsible Advanced Filters */}
          {filtersOpen && (
            <div className="rounded-xl border border-border-subtle bg-surface-2 p-3.5 space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-border-subtle pb-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Filter Criteria
                </span>
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="text-xs font-semibold text-brand hover:underline"
                  >
                    Clear All
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Qualification Filter */}
                <div>
                  <label className="block text-[11px] font-semibold text-text-muted mb-1">
                    Qualification
                  </label>
                  <select
                    value={selectedQualification}
                    onChange={(e) => setSelectedQualification(e.target.value)}
                    className="w-full h-9 rounded-lg border border-border-subtle bg-surface-1 px-2.5 text-xs text-white focus:border-brand/50 outline-none"
                  >
                    <option value="All">All Qualifications</option>
                    {DEFAULT_QUALIFICATIONS.map((q) => (
                      <option key={q} value={q}>
                        {q}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Vacancy Status Filter */}
                <div>
                  <label className="block text-[11px] font-semibold text-text-muted mb-1">
                    Vacancy Status
                  </label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value as any)}
                    className="w-full h-9 rounded-lg border border-border-subtle bg-surface-1 px-2.5 text-xs text-white focus:border-brand/50 outline-none"
                  >
                    <option value="all">All Statuses</option>
                    <option value="live">Live Now / Open</option>
                    <option value="closed">Closed / Expired</option>
                  </select>
                </div>

                {/* Age Eligibility Check */}
                <div>
                  <label className="block text-[11px] font-semibold text-text-muted mb-1">
                    Your Age (e.g. 21)
                  </label>
                  <input
                    type="number"
                    min={14}
                    max={65}
                    value={userAge}
                    onChange={(e) => setUserAge(e.target.value)}
                    placeholder="Enter your age"
                    className="w-full h-9 rounded-lg border border-border-subtle bg-surface-1 px-2.5 text-xs text-white focus:border-brand/50 outline-none"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Vacancy Cards List */}
        <div className="space-y-4">
          {filteredList.length === 0 ? (
            <div className="rounded-2xl border border-border-subtle bg-surface-1 p-8 text-center">
              <EmptyState
                icon={Briefcase}
                title={`No updates in ${activeGroup.name}`}
                description="No vacancies currently match your selected filters. Try resetting the filters or switching groups."
              />
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-4 rounded-xl border border-border-subtle bg-surface-2 px-4 py-2 text-xs font-semibold text-brand hover:bg-surface-3 transition-colors"
                >
                  Reset All Filters
                </button>
              )}
            </div>
          ) : (
            filteredList.map((item) => {
              const isLive = isVacancyLive(item);

              return (
                <article
                  key={item.id}
                  className="relative overflow-hidden rounded-2xl border border-border-subtle bg-surface-1 p-5 transition-all duration-200 hover:border-border-strong shadow-sm"
                >
                  {/* Banner Image */}
                  {item.image_url && (
                    <div className="mb-4 overflow-hidden rounded-xl border border-white/10 max-h-56 bg-surface-2 relative group">
                      <img
                        src={item.image_url}
                        alt={item.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    </div>
                  )}

                  {/* Top Badges Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle pb-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                          isLive
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                            : "border-zinc-500/30 bg-zinc-500/10 text-zinc-400",
                        )}
                      >
                        {isLive ? "● Live Now" : "Closed"}
                      </span>

                      {item.organization && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-border-subtle bg-surface-2 px-2.5 py-0.5 text-[10px] font-semibold text-white">
                          <Building2 className="h-3 w-3 text-brand" />
                          {item.organization}
                        </span>
                      )}

                      <span className="rounded-full border border-border-subtle bg-surface-2 px-2.5 py-0.5 text-[10px] font-medium text-text-muted">
                        {item.category || activeGroup.name}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleShare(item)}
                      className="inline-flex items-center gap-1 rounded-lg border border-border-subtle bg-surface-2 px-2 py-1 text-xs font-semibold text-text-secondary hover:text-white transition-colors"
                      title="Share vacancy"
                    >
                      {copiedId === item.id ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          <span className="text-[11px] text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Share2 className="h-3.5 w-3.5" />
                          <span className="text-[11px]">Share</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Title & Description */}
                  <div className="mt-3">
                    <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                      {item.title}
                    </h2>
                    <p className="mt-1.5 text-xs sm:text-sm text-text-secondary leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  {/* Key Details Grid */}
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 border-y border-border-subtle/80 py-3 text-xs">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">
                        Qualification
                      </span>
                      <span className="font-semibold text-white mt-0.5 block truncate">
                        {item.qualification || "As per notification"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">
                        Age Criteria
                      </span>
                      <span className="font-semibold text-white mt-0.5 block truncate">
                        {item.min_age || item.max_age
                          ? `${item.min_age ?? "18"} - ${item.max_age ?? "45"} Yrs`
                          : "18 - 45 Yrs"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">
                        Last Date
                      </span>
                      <span className="font-semibold text-brand-light mt-0.5 block truncate">
                        {item.application_last_date || "Open"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">
                        Vacancies
                      </span>
                      <span className="font-semibold text-white mt-0.5 block truncate">
                        {item.total_vacancies ? `${item.total_vacancies} Posts` : "Multiple Posts"}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-[10px] text-text-muted">
                      Published {item.date} • Verified by Formbhro
                    </span>
                    <div className="flex items-center gap-2">
                      {item.apply_url && (
                        <a
                          href={item.apply_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-1.5 text-xs font-bold text-white shadow-md shadow-brand/20 hover:bg-brand-light transition-all active:scale-95"
                        >
                          Apply Online <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                      {item.notification_url && (
                        <a
                          href={item.notification_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-xl border border-border-subtle bg-surface-2 px-3 py-1.5 text-xs font-semibold text-white hover:bg-surface-3 transition-colors"
                        >
                          Notification PDF
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
