import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Newspaper,
  Share2,
  Check,
  Search,
  SlidersHorizontal,
  X,
  ExternalLink,
  Calendar,
  Users,
  GraduationCap,
  MapPin,
  Clock,
  FileText,
  Building2,
  HelpCircle,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { useState, useMemo } from "react";
import { UserHeader } from "@/components/layout/UserHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { useUserStore } from "@/lib/user-store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { NewsItem } from "@/data/user-module";

export const Route = createFileRoute("/app/news")({
  ssr: false,
  component: NewsUpdates,
  head: () => ({
    meta: [
      { title: "Vacancies & Updates — Formbhro" },
      {
        name: "description",
        content:
          "Latest government jobs, exam notifications, admissions and service updates from the Formbhro team.",
      },
      { property: "og:title", content: "Vacancies & Updates — Formbhro" },
      {
        property: "og:description",
        content: "Latest government jobs and announcements verified by Formbhro.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const QUALIFICATIONS = [
  "All Qualifications",
  "10th Pass",
  "12th Pass",
  "ITI",
  "Diploma",
  "Graduation",
  "Postgraduation",
  "Other",
] as const;

const STATUS_FILTERS = [
  { id: "all", label: "All Statuses" },
  { id: "live", label: "Live (Open)" },
  { id: "upcoming", label: "Upcoming" },
  { id: "closed", label: "Closed" },
  { id: "expired", label: "Expired" },
] as const;

function computeVacancyStatus(item: NewsItem): "live" | "upcoming" | "closed" | "expired" {
  if (item.vacancy_status === "closed") return "closed";
  const now = new Date();
  if (item.application_last_date) {
    const end = new Date(item.application_last_date);
    end.setHours(23, 59, 59, 999);
    if (now > end) return "expired";
  }
  if (item.application_start_date) {
    const start = new Date(item.application_start_date);
    if (now < start) return "upcoming";
  }
  return item.vacancy_status || "live";
}

function getStatusBadge(status: "live" | "upcoming" | "closed" | "expired") {
  switch (status) {
    case "live":
      return {
        label: "Applications Open",
        className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
      };
    case "upcoming":
      return {
        label: "Upcoming Window",
        className: "border-sky-500/30 bg-sky-500/10 text-sky-400",
      };
    case "closed":
      return {
        label: "Manually Closed",
        className: "border-rose-500/30 bg-rose-500/10 text-rose-400",
      };
    case "expired":
      return {
        label: "Deadline Passed",
        className: "border-white/20 bg-surface-2 text-text-muted",
      };
  }
}

function NewsUpdates() {
  const { news } = useUserStore();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Search & Filters state
  const [q, setQ] = useState("");
  const [selectedQualification, setSelectedQualification] = useState("All Qualifications");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [userAge, setUserAge] = useState<string>("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "deadline" | "vacancies">("newest");
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);

  // Active filter count
  const activeFilterCount =
    (selectedQualification !== "All Qualifications" ? 1 : 0) +
    (selectedStatus !== "all" ? 1 : 0) +
    (userAge ? 1 : 0) +
    (selectedLocation ? 1 : 0);

  const handleResetFilters = () => {
    setQ("");
    setSelectedQualification("All Qualifications");
    setSelectedStatus("all");
    setUserAge("");
    setSelectedLocation("");
    setSortBy("newest");
  };

  // Filtered & sorted vacancy list
  const filteredList = useMemo(() => {
    const term = q.trim().toLowerCase();
    const ageNum = userAge ? parseInt(userAge, 10) : null;

    let items = news.filter((item) => {
      const computedStatus = computeVacancyStatus(item);

      // Search term
      if (term) {
        const fullContent = `${item.title} ${item.description} ${item.organization || ""} ${
          item.category || ""
        } ${item.location || ""}`.toLowerCase();
        if (!fullContent.includes(term)) return false;
      }

      // Qualification
      if (selectedQualification !== "All Qualifications") {
        if (
          item.qualification &&
          !item.qualification.toLowerCase().includes(selectedQualification.toLowerCase())
        ) {
          return false;
        }
      }

      // Vacancy Status
      if (selectedStatus !== "all" && computedStatus !== selectedStatus) {
        return false;
      }

      // Location
      if (selectedLocation) {
        if (
          !item.location ||
          !item.location.toLowerCase().includes(selectedLocation.toLowerCase())
        ) {
          return false;
        }
      }

      // Age eligibility match
      if (ageNum !== null && !isNaN(ageNum)) {
        if (item.min_age !== null && item.min_age !== undefined && ageNum < item.min_age) {
          return false;
        }
        if (item.max_age !== null && item.max_age !== undefined && ageNum > item.max_age) {
          return false;
        }
      }

      return true;
    });

    // Sorting
    items = items.slice().sort((a, b) => {
      if (sortBy === "deadline") {
        const dateA = a.application_last_date ? new Date(a.application_last_date).getTime() : Infinity;
        const dateB = b.application_last_date ? new Date(b.application_last_date).getTime() : Infinity;
        return dateA - dateB;
      }
      if (sortBy === "vacancies") {
        return (b.total_vacancies || 0) - (a.total_vacancies || 0);
      }
      // default: newest published / pinned first
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;
      return 0;
    });

    return items;
  }, [news, q, selectedQualification, selectedStatus, userAge, selectedLocation, sortBy]);

  const handleShare = async (item: NewsItem) => {
    const url = typeof window !== "undefined" ? window.location.href : "https://formbhro.com/app/news";
    const shareText = `📢 *${item.title}*\n${item.organization ? `🏢 Department: ${item.organization}\n` : ""}${
      item.application_last_date ? `⏰ Last Date: ${item.application_last_date}\n` : ""
    }\n${item.description}\n\nApply or get help with Formbhro: ${url}`;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: item.title,
          text: shareText,
          url,
        });
        toast.success("Shared successfully!");
        return;
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.warn("Native share failed, falling back to clipboard:", err);
        } else {
          return;
        }
      }
    }

    // Fallback: Copy to clipboard
    try {
      await navigator.clipboard.writeText(shareText);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2500);
      toast.success("Details copied to clipboard! You can paste anywhere.");
    } catch {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`, "_blank");
    }
  };

  return (
    <>
      <UserHeader title="Vacancies & News" />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-28 pt-5 sm:px-6 lg:pb-12">
        {/* Page Heading */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">
              Vacancies &amp; Updates
            </h1>
            <p className="mt-0.5 text-xs text-text-secondary sm:text-sm">
              Discover verified government jobs, recruitment forms &amp; official notifications.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-border-subtle bg-surface-2 px-3 py-1 text-xs font-semibold text-text-muted">
              {filteredList.length} {filteredList.length === 1 ? "vacancy" : "vacancies"}
            </span>
          </div>
        </div>

        {/* Search Bar & Filter Toggle */}
        <div className="mt-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by job title, organization (e.g. UPSC, SSC), department..."
                className="h-11 w-full rounded-2xl border border-border-subtle bg-surface-1 pl-10 pr-4 text-xs sm:text-sm text-white placeholder:text-text-muted focus:border-brand/50 focus:outline-none"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setFilterPanelOpen((prev) => !prev)}
              aria-expanded={filterPanelOpen}
              className={cn(
                "inline-flex h-11 items-center gap-2 rounded-2xl border px-3.5 text-xs font-semibold transition-all shrink-0",
                activeFilterCount > 0
                  ? "border-brand bg-brand/10 text-brand-light"
                  : "border-border-subtle bg-surface-1 text-text-secondary hover:border-border-strong hover:text-white",
              )}
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">Filters</span>
              {activeFilterCount > 0 && (
                <span className="grid h-5 w-5 place-items-center rounded-full bg-brand text-[10px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Expandable Advanced Filters Panel */}
          {filterPanelOpen && (
            <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4 shadow-xl space-y-4 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between border-b border-border-subtle pb-2.5">
                <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-brand" /> Filter &amp; Eligibility
                  Criteria
                </span>
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="text-xs font-semibold text-brand hover:underline"
                  >
                    Clear All
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Qualification Filter */}
                <div>
                  <label className="block text-[11px] font-semibold text-text-muted mb-1.5">
                    Qualification
                  </label>
                  <select
                    value={selectedQualification}
                    onChange={(e) => setSelectedQualification(e.target.value)}
                    className="w-full h-9 rounded-xl border border-border-subtle bg-surface-2 px-2.5 text-xs text-white focus:border-brand/50 outline-none"
                  >
                    {QUALIFICATIONS.map((qOpt) => (
                      <option key={qOpt} value={qOpt}>
                        {qOpt}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status Filter */}
                <div>
                  <label className="block text-[11px] font-semibold text-text-muted mb-1.5">
                    Vacancy Status
                  </label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="w-full h-9 rounded-xl border border-border-subtle bg-surface-2 px-2.5 text-xs text-white focus:border-brand/50 outline-none"
                  >
                    {STATUS_FILTERS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Age Eligibility Check */}
                <div>
                  <label className="block text-[11px] font-semibold text-text-muted mb-1.5">
                    Your Age (Eligibility Match)
                  </label>
                  <input
                    type="number"
                    min={14}
                    max={70}
                    placeholder="e.g. 24"
                    value={userAge}
                    onChange={(e) => setUserAge(e.target.value)}
                    className="w-full h-9 rounded-xl border border-border-subtle bg-surface-2 px-2.5 text-xs text-white focus:border-brand/50 outline-none"
                  />
                </div>

                {/* Sort Order */}
                <div>
                  <label className="block text-[11px] font-semibold text-text-muted mb-1.5">
                    Sort By
                  </label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="w-full h-9 rounded-xl border border-border-subtle bg-surface-2 px-2.5 text-xs text-white focus:border-brand/50 outline-none"
                  >
                    <option value="newest">Newest Published</option>
                    <option value="deadline">Closing Soonest</option>
                    <option value="vacancies">Highest Vacancies</option>
                  </select>
                </div>
              </div>

              {userAge && (
                <div className="rounded-xl border border-brand/20 bg-brand/5 p-2.5 text-[11px] text-text-secondary flex items-start gap-2">
                  <Sparkles className="h-4 w-4 shrink-0 text-brand mt-0.5" />
                  <span>
                    Filtering vacancies matching age <strong>{userAge}</strong>. Results display
                    positions where your age falls within the eligible range. Always verify with the
                    official notification.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Vacancy Cards List */}
        <div className="mt-6 space-y-4">
          {filteredList.length === 0 ? (
            <div className="rounded-2xl border border-border-subtle bg-surface-1 p-8 text-center">
              <EmptyState
                icon={Newspaper}
                title="No vacancies match your criteria"
                description="Try clearing some filters or searching for different keywords."
              />
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="mt-4 rounded-xl border border-border-subtle bg-surface-2 px-4 py-2 text-xs font-semibold text-brand hover:bg-surface-3 transition-colors"
                >
                  Reset All Filters
                </button>
              )}
            </div>
          ) : (
            filteredList.map((item) => {
              const status = computeVacancyStatus(item);
              const badge = getStatusBadge(status);

              return (
                <article
                  key={item.id}
                  className={cn(
                    "relative overflow-hidden rounded-2xl border bg-surface-1 p-5 transition-all duration-200 hover:border-border-strong shadow-sm",
                    item.featured
                      ? "border-brand/40 shadow-brand/5"
                      : "border-border-subtle",
                  )}
                >
                  {/* Optional Banner Image */}
                  {item.image_url && (
                    <div className="mb-4 overflow-hidden rounded-xl border border-white/10 max-h-56 bg-surface-2 relative">
                      <img
                        src={item.image_url}
                        alt={item.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    </div>
                  )}

                  {/* Top Badges Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle/60 pb-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                          badge.className,
                        )}
                      >
                        {badge.label}
                      </span>

                      {item.organization && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-border-subtle bg-surface-2 px-2.5 py-0.5 text-[10px] font-semibold text-white">
                          <Building2 className="h-3 w-3 text-brand" />
                          {item.organization}
                        </span>
                      )}

                      <span className="rounded-full border border-border-subtle/80 bg-surface-2/60 px-2.5 py-0.5 text-[10px] font-medium text-text-muted">
                        {item.category}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void handleShare(item)}
                        className="inline-flex items-center gap-1 rounded-lg border border-border-subtle bg-surface-2 px-2.5 py-1 text-xs font-semibold text-text-secondary hover:text-white transition-colors"
                        title="Share Vacancy"
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
                  </div>

                  {/* Title & Description */}
                  <div className="mt-3">
                    <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                      {item.title}
                    </h2>
                    <p className="mt-1.5 text-xs sm:text-sm text-text-secondary leading-relaxed line-clamp-3">
                      {item.description}
                    </p>
                  </div>

                  {/* Key Metadata Grid */}
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5 rounded-xl border border-border-subtle/60 bg-surface-2/50 p-3 text-xs">
                    {/* Qualification */}
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-semibold text-text-muted flex items-center gap-1">
                        <GraduationCap className="h-3 w-3 text-brand" /> Qualification
                      </span>
                      <p className="font-semibold text-white truncate">
                        {item.qualification || "As per notification"}
                      </p>
                    </div>

                    {/* Age Criteria */}
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-semibold text-text-muted flex items-center gap-1">
                        <Users className="h-3 w-3 text-brand" /> Age Limit
                      </span>
                      <p className="font-semibold text-white">
                        {item.min_age && item.max_age
                          ? `${item.min_age} - ${item.max_age} yrs`
                          : item.max_age
                            ? `Max ${item.max_age} yrs`
                            : "Refer Notification"}
                      </p>
                    </div>

                    {/* Vacancies Count */}
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-semibold text-text-muted flex items-center gap-1">
                        <FileText className="h-3 w-3 text-brand" /> Posts
                      </span>
                      <p className="font-semibold text-white">
                        {item.total_vacancies ? `${item.total_vacancies} Posts` : "Specified in notice"}
                      </p>
                    </div>

                    {/* Application Deadline */}
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-semibold text-text-muted flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-brand" /> Last Date
                      </span>
                      <p
                        className={cn(
                          "font-bold truncate",
                          status === "expired"
                            ? "text-rose-400"
                            : status === "live"
                              ? "text-emerald-400"
                              : "text-white",
                        )}
                      >
                        {item.application_last_date || "Check notice"}
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons Row */}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-border-subtle/50">
                    <div className="flex flex-wrap items-center gap-2">
                      {item.apply_url && (
                        <a
                          href={item.apply_url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2 text-xs font-bold text-white hover:bg-brand-light transition-colors"
                        >
                          <span>Apply Online</span>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}

                      {item.notification_url && (
                        <a
                          href={item.notification_url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex items-center gap-1.5 rounded-xl border border-border-subtle bg-surface-2 px-3 py-2 text-xs font-semibold text-text-secondary hover:text-white hover:bg-surface-3 transition-colors"
                        >
                          <FileText className="h-3.5 w-3.5 text-text-muted" />
                          <span>Official PDF</span>
                        </a>
                      )}
                    </div>

                    <Link
                      to="/app/chat"
                      search={{ q: `Need help filling ${item.title}` }}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-brand/30 bg-brand/10 px-3.5 py-2 text-xs font-bold text-brand-light hover:bg-brand/20 transition-colors"
                    >
                      <HelpCircle className="h-3.5 w-3.5" />
                      <span>Apply with Formbhro</span>
                    </Link>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </main>
    </>
  );
}
