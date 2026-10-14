import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
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
  Building2,
  Users,
  Briefcase,
  Sparkles,
  Share2,
  Check,
  ArrowLeft,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  GraduationCap,
  Bell,
  Clock,
  Info,
  HelpCircle,
  Loader2,
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
  validateSearch: (search: Record<string, unknown>): { groupId?: string } => ({
    groupId: typeof search.groupId === "string" ? search.groupId : undefined,
  }),
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
  const { news, createRequest, requests } = useUserStore();
  const searchParams = Route.useSearch();
  const navigate = useNavigate();

  // If groupId is in URL, use it; otherwise null (main group list screen)
  const activeGroupId = (searchParams.groupId as JobGroupId | undefined) ?? null;
  const activeGroup = activeGroupId ? JOB_GROUPS.find((g) => g.id === activeGroupId) ?? null : null;

  // Search & Filter state for inside the group feed
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedQualification, setSelectedQualification] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState<"all" | "live" | "closed">("all");
  const [userAge, setUserAge] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "deadline">("newest");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  // Helper to enter a group
  const handleOpenGroup = (groupId: JobGroupId) => {
    resetFilters();
    void navigate({
      to: "/app/groups",
      search: { groupId },
    });
  };

  // Helper to exit a group back to the group list
  const handleBackToList = () => {
    resetFilters();
    void navigate({
      to: "/app/groups",
      search: {},
    });
  };

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedQualification("All");
    setSelectedStatus("all");
    setUserAge("");
    setSortBy("newest");
    setFiltersOpen(false);
  };

  const handleApplyWithFormbhro = async (item: NewsItem) => {
    if (applyingId) return;
    setApplyingId(item.id);
    try {
      const title = `Apply for: ${item.title}`;
      const category = item.organization || item.category || "Job Application";

      const activeReq = (requests ?? []).find(
        (r) => r.status !== "completed" && r.status !== "cancelled" && r.status !== "closed",
      );

      if (activeReq) {
        toast.info("Opening your active conversation with the Formbhro team.");
        void navigate({
          to: "/app/chats/$requestId",
          params: { requestId: activeReq.id },
        });
        return;
      }

      const newReq = await createRequest(title, category);
      toast.success(`Application chat opened for ${item.title}!`);
      void navigate({
        to: "/app/chats/$requestId",
        params: { requestId: newReq.id },
      });
    } catch (err: any) {
      if (
        err?.message?.includes("ACTIVE_REQUEST_LIMIT_EXCEEDED") ||
        err?.message?.includes("requests_one_active_per_user")
      ) {
        toast.info("Opening your active conversation with the Formbhro team.");
        void navigate({ to: "/app/chats" });
      } else {
        toast.error(err?.message || "Failed to start chat. Opening chats list.");
        void navigate({ to: "/app/chats" });
      }
    } finally {
      setApplyingId(null);
    }
  };

  // Items belonging strictly to the active group (Requirement 4: Completely separate feeds)
  const groupItems = useMemo(() => {
    if (!activeGroupId) return [];
    return (news ?? []).filter((item) => {
      const cat = (item.category || "").toLowerCase();
      const target = (item.custom_fields as any)?.target;
      const groupId = (item.custom_fields as any)?.group_id;

      if (activeGroupId === "jobs-update") {
        return (
          cat === "group: jobs-update" ||
          cat === "jobs update group" ||
          (target === "group" && groupId === "jobs-update") ||
          groupId === "jobs-update"
        );
      } else if (activeGroupId === "hidden-jobs-update") {
        return (
          cat === "group: hidden-jobs-update" ||
          cat === "hidden jobs update" ||
          cat.includes("hidden") ||
          (target === "group" && groupId === "hidden-jobs-update") ||
          groupId === "hidden-jobs-update"
        );
      }
      return false;
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

  const handleShare = async (item: NewsItem) => {
    const text = `📢 ${item.title}\n\nOrganization: ${item.organization || "Govt"}\nQualification: ${
      item.qualification || "Check notification"
    }\nLast Date: ${item.application_last_date || "Open"}\n\nCheck on Formbhro: https://formbhro-main.vercel.app/app/groups?groupId=${activeGroupId}`;
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      setCopiedId(item.id);
      toast.success("Job details copied to clipboard!");
      setTimeout(() => setCopiedId(null), 2500);
    }
  };

  const handleShareGroup = async () => {
    if (!activeGroup) return;
    const url = `https://formbhro-main.vercel.app/app/groups?groupId=${activeGroup.id}`;
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(
        `Join the "${activeGroup.name}" group on Formbhro for daily verified vacancies:\n${url}`,
      );
      toast.success("Group link copied to clipboard!");
    }
  };

  // =========================================================================
  // VIEW 1: DEDICATED GROUP SCREEN (WhatsApp Group View)
  // =========================================================================
  if (activeGroup) {
    const liveCount = groupItems.filter(isVacancyLive).length;
    const isHiddenGroup = activeGroup.id === "hidden-jobs-update";

    return (
      <div className="flex min-h-screen flex-col bg-bg text-text">
        {/* WhatsApp-Style Sticky Top Bar for Group */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border-subtle bg-surface-1/95 px-3 sm:px-5 backdrop-blur-md shadow-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Back to Groups list button */}
            <button
              type="button"
              onClick={handleBackToList}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border-subtle bg-surface-2 text-text hover:bg-surface-3 transition-colors active:scale-95"
              aria-label="Back to Groups"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            {/* Group Avatar */}
            <div
              className={cn(
                "grid h-10 w-10 shrink-0 place-items-center rounded-2xl border text-white shadow-md",
                isHiddenGroup
                  ? "border-purple-500/40 bg-gradient-to-br from-purple-600 to-indigo-800"
                  : "border-brand/40 bg-gradient-to-br from-brand-dark to-brand-light",
              )}
            >
              {isHiddenGroup ? (
                <Sparkles className="h-5 w-5" />
              ) : (
                <Briefcase className="h-5 w-5" />
              )}
            </div>

            {/* Group Name & Subtitle */}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm sm:text-base font-extrabold text-white truncate">
                  {activeGroup.name}
                </h1>
                <CheckCircle2
                  className={cn(
                    "h-4 w-4 shrink-0",
                    isHiddenGroup ? "text-purple-400" : "text-brand",
                  )}
                />
              </div>
              <p className="text-[11px] text-text-muted truncate">
                {groupItems.length} {groupItems.length === 1 ? "Update" : "Updates"} • {liveCount} Live Now
              </p>
            </div>
          </div>

          {/* Right Action: Share Group */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleShareGroup}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border-subtle bg-surface-2 px-3 text-xs font-semibold text-text-secondary hover:text-white transition-colors"
              title="Share Group"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Share Group</span>
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-3xl flex-1 px-3 sm:px-5 pb-28 pt-4">
          {/* Pinned Channel Notice Banner */}
          <div
            className={cn(
              "rounded-2xl border p-4 mb-4 relative overflow-hidden",
              isHiddenGroup
                ? "border-purple-500/30 bg-purple-950/20 text-purple-100"
                : "border-brand/30 bg-brand/5 text-brand-light",
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "p-2 rounded-xl shrink-0 mt-0.5",
                  isHiddenGroup ? "bg-purple-500/20 text-purple-300" : "bg-brand/20 text-brand",
                )}
              >
                <Info className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider block">
                  {activeGroup.badge} Broadcast Feed
                </span>
                <p className="text-xs text-text mt-0.5 leading-relaxed">
                  {activeGroup.description}
                </p>
              </div>
            </div>
          </div>

          {/* Search Bar + Filter Trigger Toolbar */}
          <div className="rounded-2xl border border-border-subtle bg-surface-1 p-3 shadow-sm mb-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Search ${activeGroup.name} vacancies...`}
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
                  "inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-all shrink-0",
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
              <div className="rounded-xl border border-border-subtle bg-surface-2 p-3 space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center justify-between border-b border-border-subtle pb-2">
                  <span className="text-[11px] font-bold text-white uppercase tracking-wider">
                    Filter Vacancies
                  </span>
                  {activeFilterCount > 0 && (
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="text-xs font-semibold text-brand hover:underline"
                    >
                      Reset All
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Qualification Filter */}
                  <div>
                    <label className="block text-[10px] font-semibold text-text-muted mb-1">
                      Qualification
                    </label>
                    <select
                      value={selectedQualification}
                      onChange={(e) => setSelectedQualification(e.target.value)}
                      className="w-full h-8.5 rounded-lg border border-border-subtle bg-surface-1 px-2 text-xs text-white focus:border-brand/50 outline-none"
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
                    <label className="block text-[10px] font-semibold text-text-muted mb-1">
                      Vacancy Status
                    </label>
                    <select
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value as any)}
                      className="w-full h-8.5 rounded-lg border border-border-subtle bg-surface-1 px-2 text-xs text-white focus:border-brand/50 outline-none"
                    >
                      <option value="all">All Statuses</option>
                      <option value="live">Live Now / Open</option>
                      <option value="closed">Closed / Expired</option>
                    </select>
                  </div>

                  {/* Age Eligibility Check */}
                  <div>
                    <label className="block text-[10px] font-semibold text-text-muted mb-1">
                      Your Age (e.g. 21)
                    </label>
                    <input
                      type="number"
                      min={14}
                      max={65}
                      value={userAge}
                      onChange={(e) => setUserAge(e.target.value)}
                      placeholder="Enter age"
                      className="w-full h-8.5 rounded-lg border border-border-subtle bg-surface-1 px-2.5 text-xs text-white focus:border-brand/50 outline-none"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Group Updates Feed */}
          <div className="space-y-4">
            {filteredList.length === 0 ? (
              <div className="rounded-2xl border border-border-subtle bg-surface-1 p-8 text-center">
                <EmptyState
                  icon={Briefcase}
                  title={`No updates in ${activeGroup.name}`}
                  description={
                    activeFilterCount > 0
                      ? "No vacancies currently match your selected filters. Try clearing filters to see all group posts."
                      : "New vacancy announcements will appear in this group as soon as the Formbhro team posts them. Check back soon!"
                  }
                />
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="mt-4 rounded-xl border border-border-subtle bg-surface-2 px-4 py-2 text-xs font-semibold text-brand hover:bg-surface-3 transition-colors"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            ) : (
              filteredList.map((item) => {
                const isLive = isVacancyLive(item);

                return (
                  <article
                    key={item.id}
                    className="relative overflow-hidden rounded-2xl border border-border-subtle bg-surface-1 p-4 sm:p-5 transition-all duration-200 hover:border-border-strong shadow-sm"
                  >
                    {/* Banner Image */}
                    {item.image_url && (
                      <div className="mb-3.5 overflow-hidden rounded-xl border border-white/10 max-h-56 bg-surface-2 relative group">
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
                        className="inline-flex items-center gap-1 rounded-lg border border-border-subtle bg-surface-2 px-2.5 py-1 text-xs font-semibold text-text-secondary hover:text-white transition-colors"
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
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border-subtle/50">
                      <span className="text-[10px] text-text-muted">
                        Published {item.date} • Verified by Formbhro
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
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
                        <button
                          type="button"
                          disabled={applyingId === item.id}
                          onClick={() => void handleApplyWithFormbhro(item)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-brand/40 bg-brand/10 px-3.5 py-1.5 text-xs font-bold text-brand-light hover:bg-brand/20 active:scale-95 transition-all disabled:opacity-60 cursor-pointer"
                        >
                          {applyingId === item.id ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
                              <span>Connecting...</span>
                            </>
                          ) : (
                            <>
                              <HelpCircle className="h-3.5 w-3.5 text-brand" />
                              <span>Apply with Formbhro</span>
                            </>
                          )}
                        </button>
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

  // =========================================================================
  // VIEW 2: MAIN GROUPS DIRECTORY (WhatsApp Community / Group List)
  // Displays ONLY available groups. Group updates are NOT displayed here.
  // =========================================================================
  return (
    <div className="flex min-h-screen flex-col bg-bg text-text">
      <UserHeader title="Job Groups" />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-28 pt-4 sm:px-6">
        {/* Navigation Header */}
        <div className="mb-5 flex items-center justify-between">
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
            All Updates <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Informative Welcome Banner */}
        <div className="mb-6 rounded-2xl border border-border-subtle bg-surface-1 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand/15 text-brand border border-brand/30">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                Official Formbhro Broadcast Channels
              </h2>
              <p className="mt-1 text-xs text-text-secondary leading-relaxed">
                Click any group below to open its dedicated feed. Similar to WhatsApp groups, each group contains its own updates, eligibility criteria, and application links.
              </p>
            </div>
          </div>
        </div>

        {/* WhatsApp-Style Group Channels List */}
        <div className="space-y-3.5">
          {JOB_GROUPS.map((group) => {
            const count = (news ?? []).filter((n) => {
              const c = (n.category || "").toLowerCase();
              const target = (n.custom_fields as any)?.target;
              const gId = (n.custom_fields as any)?.group_id;
              if (group.id === "jobs-update") {
                return (
                  c === "group: jobs-update" ||
                  c === "jobs update group" ||
                  (target === "group" && gId === "jobs-update") ||
                  gId === "jobs-update"
                );
              } else {
                return (
                  c === "group: hidden-jobs-update" ||
                  c === "hidden jobs update" ||
                  c.includes("hidden") ||
                  (target === "group" && gId === "hidden-jobs-update") ||
                  gId === "hidden-jobs-update"
                );
              }
            }).length;

            const isHiddenGroup = group.id === "hidden-jobs-update";

            return (
              <button
                key={group.id}
                type="button"
                onClick={() => handleOpenGroup(group.id)}
                className="w-full text-left rounded-2xl border border-border-subtle bg-surface-1 p-4 sm:p-5 transition-all duration-200 hover:border-brand/40 hover:bg-surface-2 hover:shadow-lg hover:shadow-brand/5 active:scale-[0.99] group relative overflow-hidden"
              >
                <div className="flex items-start gap-4">
                  {/* Left Avatar */}
                  <div
                    className={cn(
                      "grid h-14 w-14 shrink-0 place-items-center rounded-2xl border text-white shadow-md transition-transform duration-200 group-hover:scale-105",
                      isHiddenGroup
                        ? "border-purple-500/40 bg-gradient-to-br from-purple-600 to-indigo-800"
                        : "border-brand/40 bg-gradient-to-br from-brand-dark to-brand-light",
                    )}
                  >
                    {isHiddenGroup ? (
                      <Sparkles className="h-7 w-7" />
                    ) : (
                      <Briefcase className="h-7 w-7" />
                    )}
                  </div>

                  {/* Middle Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <h2 className="text-base font-bold text-white group-hover:text-brand transition-colors truncate">
                          {group.name}
                        </h2>
                        <CheckCircle2
                          className={cn(
                            "h-4 w-4 shrink-0",
                            isHiddenGroup ? "text-purple-400" : "text-brand",
                          )}
                        />
                      </div>
                      <span
                        className={cn(
                          "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0",
                          isHiddenGroup
                            ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                            : "bg-brand/20 text-brand-light border border-brand/30",
                        )}
                      >
                        {group.badge} Group
                      </span>
                    </div>

                    <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">
                      {group.description}
                    </p>

                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="font-mono font-bold text-text-muted text-[11px]">
                        🟢 {count} {count === 1 ? "Update Available" : "Updates Available"}
                      </span>
                      <span className="font-semibold text-brand inline-flex items-center gap-1 text-[11px] group-hover:translate-x-0.5 transition-transform">
                        Open Group <ChevronRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Informative Help Box */}
        <div className="mt-6 rounded-2xl border border-dashed border-border-subtle bg-surface-1/40 p-4 text-center">
          <p className="text-xs text-text-muted leading-relaxed">
            Need urgent assistance with a vacancy application? Reach out to our verified team in{" "}
            <Link to="/app/chats" className="font-bold text-brand hover:underline">
              My Chats
            </Link>{" "}
            and we'll handle your form submission end-to-end.
          </p>
        </div>
      </main>
    </div>
  );
}
